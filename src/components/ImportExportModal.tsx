import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjects } from '../context/ProjectContext';
import { Project } from '../types';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isCompanyMatch } from '../utils/companyUtils';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({ isOpen, onClose }) => {
  const { importProjects, projects, salespersons } = useProjects();

  const [step, setStep] = useState<'upload' | 'mapping' | 'result'>('upload');
  const [rawGrid, setRawGrid] = useState<any[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [fileData, setFileData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  // Column mappings
  const [mapping, setMapping] = useState({
    projectCode: '',
    company: '',
    salesperson: '',
    mobile: '',
    projectReference: '',
    scaffoldingType: '',
    hirePeriodDays: '',
    deliveryDate: '',
    paymentStatus: '',
    remarks: '',
  });

  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  // Process raw grid data given a selected header row index
  const processGridWithHeader = (grid: any[][], headerIdx: number) => {
    if (!grid || grid.length === 0) return;

    const headerRow = grid[headerIdx] || [];

    // Find the last non-empty column index
    let lastColIndex = headerRow.length - 1;
    while (lastColIndex >= 0 && !String(headerRow[lastColIndex] ?? '').trim()) {
      lastColIndex--;
    }
    if (lastColIndex < 0) lastColIndex = headerRow.length - 1;

    // Build unique, clean headers
    const headerCounts = new Map<string, number>();
    const detectedHeaders: string[] = [];

    for (let c = 0; c <= lastColIndex; c++) {
      let colName = String(headerRow[c] ?? '').trim();
      if (!colName) {
        colName = `Column ${c + 1}`;
      }
      const seen = headerCounts.get(colName) || 0;
      headerCounts.set(colName, seen + 1);
      detectedHeaders.push(seen === 0 ? colName : `${colName} (${seen + 1})`);
    }

    // Build data rows from headerIdx + 1 onwards
    const parsedRows: any[] = [];
    for (let r = headerIdx + 1; r < grid.length; r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;

      // Skip row if completely empty
      const hasContent = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '');
      if (!hasContent) continue;

      const rowObj: Record<string, any> = {};
      detectedHeaders.forEach((h, colIdx) => {
        rowObj[h] = row[colIdx] !== undefined && row[colIdx] !== null ? row[colIdx] : '';
      });
      parsedRows.push(rowObj);
    }

    setHeaders(detectedHeaders);
    setFileData(parsedRows);
    setHeaderRowIndex(headerIdx);

    // Auto-match headers to AB Tracker project fields
    const autoMap = {
      projectCode:
        detectedHeaders.find((k) =>
          /^(project\s*)?(code|num(ber)?|id)|prj\s*(code|num|id)/i.test(k)
        ) || '',
      company:
        detectedHeaders.find((k) =>
          /company|client|customer|contractor/i.test(k)
        ) || '',
      salesperson:
        detectedHeaders.find((k) =>
          /sales\s*person|sales\s*rep|sales\s*agent|sales\s*man|salesperson|sales/i.test(k)
        ) || '',
      mobile:
        detectedHeaders.find((k) =>
          /mobile|phone|whatsapp|contact|tel/i.test(k)
        ) || '',
      projectReference:
        detectedHeaders.find((k) =>
          /reference|site|location|lpo|project\s*ref/i.test(k)
        ) || '',
      scaffoldingType:
        detectedHeaders.find((k) =>
          /scaffold.*type|type/i.test(k)
        ) || '',
      hirePeriodDays:
        detectedHeaders.find((k) =>
          /hire.*period|hire.*day|period.*day|hire|duration/i.test(k)
        ) || '',
      deliveryDate:
        detectedHeaders.find((k) =>
          /delivery|start.*date/i.test(k)
        ) || '',
      paymentStatus:
        detectedHeaders.find((k) =>
          /payment|paid/i.test(k)
        ) || '',
      remarks:
        detectedHeaders.find((k) =>
          /remark|note|comment|desc/i.test(k)
        ) || '',
    };

    setMapping(autoMap);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // Read raw grid (2D array: any[][])
        const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!grid || grid.length === 0) {
          setFileError('The uploaded spreadsheet file is empty.');
          return;
        }

        // Intelligently find header row (even if rows 1 and 2 are blank or title rows)
        const headerKeywords = [
          /company|client|customer|contractor/i,
          /sales\s*person|sales\s*rep|sales/i,
          /mobile|phone|whatsapp|tel|contact/i,
          /ref(erence)?|site|location|lpo/i,
          /scaffold|type/i,
          /hire|period|days/i,
          /delivery|start.*date/i,
          /payment|status|paid/i,
          /remark|note|comment/i,
        ];

        let bestHeaderIndex = 0;
        let maxScore = -1;

        for (let r = 0; r < Math.min(grid.length, 25); r++) {
          const row = grid[r];
          if (!Array.isArray(row)) continue;

          const nonBlank = row.map((c) => String(c ?? '').trim()).filter(Boolean);
          if (nonBlank.length < 2) continue;

          let score = 0;
          for (const cell of nonBlank) {
            if (headerKeywords.some((regex) => regex.test(cell))) {
              score++;
            }
          }

          if (score > maxScore) {
            maxScore = score;
            bestHeaderIndex = r;
          }
        }

        // Fallback: first row with at least 2 non-number text cells
        if (maxScore < 2) {
          for (let r = 0; r < Math.min(grid.length, 25); r++) {
            const row = grid[r];
            if (!Array.isArray(row)) continue;
            const nonBlank = row.map((c) => String(c ?? '').trim()).filter(Boolean);
            const textCells = nonBlank.filter((c) => isNaN(Number(c)));
            if (textCells.length >= 2) {
              bestHeaderIndex = r;
              break;
            }
          }
        }

        setRawGrid(grid);
        processGridWithHeader(grid, bestHeaderIndex);
        setFileError(null);
        setStep('mapping');
      } catch (err: any) {
        setFileError('Failed to read file: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Convert raw row date to ISO YYYY-MM-DD
  const normalizeDate = (val: any): string => {
    if (val === undefined || val === null || val === '') {
      return new Date().toISOString().split('T')[0];
    }

    // 1. If it's a JS Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // 2. If it's an Excel numeric serial date (e.g. 46263)
    if (typeof val === 'number') {
      if (XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
        try {
          const parsed = XLSX.SSF.parse_date_code(val);
          if (parsed && parsed.y && parsed.m && parsed.d) {
            return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
          }
        } catch {}
      }
      const utcDays = Math.floor(val - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }

    const str = String(val).trim();
    if (!str) return new Date().toISOString().split('T')[0];

    // 3. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) {
      const parts = str.split(/[\/\-\.]/);
      if (parts.length === 3) {
        let [d, m, y] = parts;
        if (y.length === 2) y = '20' + y;
        return `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    // 4. YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(str)) {
      const parts = str.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    // 5. Standard Date.parse fallback
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split('T')[0];
  };

  // Parse rows to project entities
  const mappedProjects: Array<Partial<Project>> = fileData.map((row) => {
    const rawDelivery = mapping.deliveryDate ? row[mapping.deliveryDate] : '';
    const deliveryDate = normalizeDate(rawDelivery);

    let scaffoldingType = 'RENTAL';
    if (mapping.scaffoldingType && row[mapping.scaffoldingType]) {
      const t = String(row[mapping.scaffoldingType]).toUpperCase();
      if (t.includes('EREC') || t.includes('DISM')) {
        scaffoldingType = 'EREC/DISM';
      }
    }

    let paymentStatus = 'NOT_PAID';
    if (mapping.paymentStatus && row[mapping.paymentStatus]) {
      const p = String(row[mapping.paymentStatus]).toUpperCase();
      if (p.includes('PARTIAL')) paymentStatus = 'PARTIAL_PAID';
      else if (p.includes('NOT') || p.includes('UNPAID')) paymentStatus = 'NOT_PAID';
      else if (p.includes('PAID')) paymentStatus = 'PAID';
    }

    // Hire Period Days
    let hirePeriodDays = 30;
    if (mapping.hirePeriodDays && row[mapping.hirePeriodDays] !== undefined && row[mapping.hirePeriodDays] !== '') {
      const parsedDays = parseInt(String(row[mapping.hirePeriodDays]), 10);
      if (!isNaN(parsedDays) && parsedDays > 0) {
        hirePeriodDays = parsedDays;
      }
    }

    return {
      projectCode: mapping.projectCode ? String(row[mapping.projectCode] || '').trim() : undefined,
      company: mapping.company ? String(row[mapping.company] || '').trim() : '',
      salespersonName: mapping.salesperson ? String(row[mapping.salesperson] || '').trim() : undefined,
      mobile: mapping.mobile ? String(row[mapping.mobile] || '').trim() : '',
      projectReference: mapping.projectReference ? String(row[mapping.projectReference] || '').trim() : '',
      scaffoldingType: scaffoldingType as any,
      hirePeriodDays,
      deliveryDate,
      paymentStatus: paymentStatus as any,
      remarks: mapping.remarks ? String(row[mapping.remarks] || '').trim() : '',
    };
  });

  // Duplicate count warning
  const duplicateCount = mappedProjects.filter((mp) => {
    return projects.some(
      (p) =>
        isCompanyMatch(p.company, mp.company || '') &&
        p.projectReference?.toLowerCase() === mp.projectReference?.toLowerCase() &&
        p.deliveryDate === mp.deliveryDate
    );
  }).length;

  // Execute Import
  const handleExecuteImport = async () => {
    setImporting(true);
    try {
      const res = await importProjects(mappedProjects, skipDuplicates);
      setImportResult(res);
      setFileError(null);
      setStep('result');
    } catch (err: any) {
      setFileError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = (type: 'csv' | 'xlsx') => {
    const sp1 = salespersons && salespersons.length > 0 ? salespersons[0].name : 'Khurram';
    const sp2 = salespersons && salespersons.length > 1 ? salespersons[1].name : (salespersons && salespersons.length > 0 ? salespersons[0].name : 'Zeeshan');

    const sampleRows = [
      {
        'Project Number': 'PRJ-1001',
        'Company Name': 'Al Futtaim Scaffolding LLC',
        'Salesperson': sp1,
        'Mobile Number': '052-9876543',
        'Project Reference': 'Downtown Tower Phase 2',
        'Scaffolding Type': 'RENTAL',
        'Hire Period (Days)': 30,
        'Delivery Date': '26/09/2026',
        'Payment Status': 'NOT_PAID',
        Remarks: 'Cuplok standard components with access ladders',
      },
      {
        'Project Number': 'PRJ-1002',
        'Company Name': 'Emaar Engineering',
        'Salesperson': sp2,
        'Mobile Number': '050-1122334',
        'Project Reference': 'Creek Harbour Plot 18',
        'Scaffolding Type': 'EREC/DISM',
        'Hire Period (Days)': 60,
        'Delivery Date': '15/09/2026',
        'Payment Status': 'PARTIAL_PAID',
        Remarks: 'Includes licensed erection and safety inspections',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample_Template');

    if (type === 'csv') {
      XLSX.writeFile(wb, 'AB_Tracker_Sample_Template.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, 'AB_Tracker_Sample_Template.xlsx', { bookType: 'xlsx' });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Smooth Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B1526]/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-3xl w-full max-h-[92vh] flex flex-col my-auto z-10"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between bg-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-lg shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">CSV & XLSX Project Import</h2>
              <p className="text-xs text-[#667085] font-normal">
                Bulk upload scaffolding project records with automated column mapping & duplicate prevention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#667085] hover:text-[#172033] hover:bg-[#F2F4F7] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body based on current step */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {fileError && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-xl text-xs font-semibold flex items-center justify-between">
              <span>{fileError}</span>
              <button
                type="button"
                onClick={() => setFileError(null)}
                className="text-[#DC2626] hover:underline cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div className="border-2 border-dashed border-[#D0D5DD] hover:border-[#2563EB] rounded-2xl p-8 text-center bg-[#F8FAFC] hover:bg-[#EFF6FF]/40 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-10 h-10 text-[#2563EB] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#172033]">
                  Click or drag CSV or XLSX file here
                </p>
                <p className="text-xs text-[#667085] mt-1 font-normal">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma Separated (.csv) files with automatic header row detection
                </p>
              </div>

              {/* Sample Template Download */}
              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-[#172033] block">Need the standard format?</span>
                  <span className="text-[#667085] text-[11px] font-normal">
                    Download our ready-to-fill project import template
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-xs text-[#1E40AF] font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span>
                    Uploaded: <strong>{fileName}</strong> ({fileData.length} records detected)
                  </span>
                  <span className="block text-[11px] text-[#2563EB] mt-0.5">
                    Headers automatically detected from Row {headerRowIndex + 1}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {rawGrid.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs text-[#344054]">
                      <span className="text-[11px] font-medium text-[#667085]">Header Row:</span>
                      <select
                        value={headerRowIndex}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value, 10);
                          processGridWithHeader(rawGrid, idx);
                        }}
                        className="px-2 py-1 bg-white border border-[#BFDBFE] rounded-md text-xs font-semibold text-[#1E40AF] cursor-pointer"
                      >
                        {rawGrid.slice(0, Math.min(10, rawGrid.length)).map((row, idx) => (
                          <option key={idx} value={idx}>
                            Row {idx + 1} ({row.filter((c) => String(c ?? '').trim()).slice(0, 3).join(', ') || 'Empty'}...)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={() => setStep('upload')}
                    className="text-[#2563EB] hover:text-blue-800 underline text-xs font-semibold cursor-pointer"
                  >
                    Change file
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#172B4D] text-xs uppercase tracking-wider">
                    Map Spreadsheet Columns to Project Fields
                  </h3>
                  <span className="text-[11px] text-[#059669] font-semibold bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                    Auto-aligned with spreadsheet
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Project Number / Code (Optional)
                    </label>
                    <select
                      value={mapping.projectCode}
                      onChange={(e) => setMapping({ ...mapping, projectCode: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Auto-generate unique PRJ-XXXX</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#667085] mt-0.5 block">
                      Duplicates or blank cells will be assigned the next sequential unique number automatically.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Company Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <select
                      value={mapping.company}
                      onChange={(e) => setMapping({ ...mapping, company: e.target.value })}
                      className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium ${
                        !mapping.company ? 'border-[#FDA29B] bg-[#FFFBFA]' : 'border-[#D0D5DD]'
                      }`}
                    >
                      <option value="">Select column...</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Salesperson (Sales Rep)
                    </label>
                    <select
                      value={mapping.salesperson}
                      onChange={(e) => setMapping({ ...mapping, salesperson: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Auto-assign or default salesperson</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#16A34A] mt-0.5 block font-medium">
                      ⚡ Company will be automatically added to this salesperson after import.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Mobile / WhatsApp
                    </label>
                    <select
                      value={mapping.mobile}
                      onChange={(e) => setMapping({ ...mapping, mobile: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Select column...</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Project Reference / Site <span className="text-[#DC2626]">*</span>
                    </label>
                    <select
                      value={mapping.projectReference}
                      onChange={(e) => setMapping({ ...mapping, projectReference: e.target.value })}
                      className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium ${
                        !mapping.projectReference ? 'border-[#FDA29B] bg-[#FFFBFA]' : 'border-[#D0D5DD]'
                      }`}
                    >
                      <option value="">Select column...</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Scaffolding Type (RENTAL / EREC/DISM)
                    </label>
                    <select
                      value={mapping.scaffoldingType}
                      onChange={(e) => setMapping({ ...mapping, scaffoldingType: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Default to RENTAL</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Hire Period Days
                    </label>
                    <select
                      value={mapping.hirePeriodDays}
                      onChange={(e) => setMapping({ ...mapping, hirePeriodDays: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Default to 30 days</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Delivery Date (DD/MM/YYYY or YYYY-MM-DD)
                    </label>
                    <select
                      value={mapping.deliveryDate}
                      onChange={(e) => setMapping({ ...mapping, deliveryDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Default to Today</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Payment Status
                    </label>
                    <select
                      value={mapping.paymentStatus}
                      onChange={(e) => setMapping({ ...mapping, paymentStatus: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Default to NOT_PAID</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-[#344054] mb-1">
                      Remarks
                    </label>
                    <select
                      value={mapping.remarks}
                      onChange={(e) => setMapping({ ...mapping, remarks: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer font-medium"
                    >
                      <option value="">Select column (Optional)...</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="space-y-2 pt-3 border-t border-[#E4E7EC]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                    <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                      Live Import Preview (First {Math.min(5, mappedProjects.length)} of {mappedProjects.length} rows)
                    </h4>
                  </div>
                  <span className="text-[11px] text-[#475467] font-normal">
                    Updates in real-time as column mappings change
                  </span>
                </div>

                <div className="border border-[#E4E7EC] rounded-xl overflow-hidden overflow-x-auto bg-[#F8FAFC]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F9] border-b border-[#E4E7EC] text-[#172B4D] font-bold text-[11px]">
                        <th className="py-2 px-3">Company</th>
                        <th className="py-2 px-3">Salesperson</th>
                        <th className="py-2 px-3">Reference</th>
                        <th className="py-2 px-3">Mobile</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3 text-center">Days</th>
                        <th className="py-2 px-3">Delivery</th>
                        <th className="py-2 px-3">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E7EC] bg-white text-[#172033]">
                      {mappedProjects.slice(0, 5).map((p, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
                          <td className="py-2 px-3 font-semibold text-[#172033] max-w-[170px] truncate" title={p.company}>
                            {p.company || <span className="text-[#DC2626] font-normal italic">Missing *</span>}
                          </td>
                          <td className="py-2 px-3 text-[#172033] font-medium max-w-[130px] truncate" title={p.salespersonName || 'Auto-assign'}>
                            {p.salespersonName ? (
                              <span className="inline-flex items-center gap-1 text-[#2563EB] font-semibold text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                                {p.salespersonName}
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] italic text-[11px]">Auto-assign</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#344054] max-w-[150px] truncate" title={p.projectReference}>
                            {p.projectReference || <span className="text-[#DC2626] font-normal italic">Missing *</span>}
                          </td>
                          <td className="py-2 px-3 text-[#344054] font-mono text-[11px]">
                            {p.mobile || '-'}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                p.scaffoldingType === 'RENTAL'
                                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                                  : 'bg-[#F8FAFC] text-[#344054] border-[#D0D5DD]'
                              }`}
                            >
                              {p.scaffoldingType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-xs">
                            {p.hirePeriodDays}d
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-[#344054]">
                            {formatDateDDMMYYYY(p.deliveryDate)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                p.paymentStatus === 'PAID'
                                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                                  : p.paymentStatus === 'PARTIAL_PAID'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                  : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                              }`}
                            >
                              {p.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Duplicate Detection Warning */}
              {duplicateCount > 0 && (
                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-start gap-2.5 text-xs text-[#92400E]">
                  <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold text-[#B45309]">Duplicate Detection:</span>
                    <p className="text-[#92400E]">
                      Found <strong className="font-semibold">{duplicateCount}</strong> records matching existing projects in Company + Reference + Delivery Date.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer font-medium pt-1 text-[#92400E]">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded text-[#2563EB] focus:ring-[#2563EB] accent-[#2563EB]"
                      />
                      <span>Skip duplicate records automatically (recommended)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Result */}
          {step === 'result' && importResult && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#172033]">Import Completed Successfully</h3>

              <div className="max-w-sm mx-auto bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#667085] font-normal">Successfully Imported:</span>
                  <span className="font-bold text-[#059669]">{importResult.imported} projects</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] font-normal">Duplicates Skipped:</span>
                  <span className="font-semibold text-[#D97706]">{importResult.skipped} records</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="pt-2 border-t border-[#E4E7EC]">
                    <span className="font-semibold text-[#DC2626]">Errors ({importResult.errors.length}):</span>
                    <div className="max-h-28 overflow-y-auto mt-1 space-y-1 text-[11px] text-[#DC2626] font-normal">
                      {importResult.errors.map((err, idx) => (
                        <div key={idx}>{err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-[#E4E7EC] bg-[#F8FAFC] rounded-b-2xl flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg text-xs sm:text-sm transition cursor-pointer"
          >
            {step === 'result' ? 'Close' : 'Cancel'}
          </button>

          {step === 'mapping' && (
            <button
              type="button"
              disabled={importing || !mapping.company || !mapping.projectReference}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-lg text-xs sm:text-sm shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <span>Import {fileData.length} Projects</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
);
};
