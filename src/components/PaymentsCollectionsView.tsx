import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import {
  Project,
  PaymentReceipt,
  PaymentMethod,
  PaymentType,
  CollectionPriority,
  FollowUpStatus,
} from '../types';
import { formatAED } from '../utils/commercialUtils';
import {
  formatDateDDMMYYYY,
  calculateDiffDays,
  toInputDateFormat,
} from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import {
  DollarSign,
  AlertTriangle,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  CheckCircle,
  Receipt,
  Search,
  Filter,
  Eye,
  UserCheck,
  Building,
  CreditCard,
  PhoneCall,
  X,
  Layers,
  Trash2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowUpDown,
  Phone,
} from 'lucide-react';

interface PaymentsCollectionsViewProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
}

export const PaymentsCollectionsView: React.FC<PaymentsCollectionsViewProps> = ({
  onViewProject,
}) => {
  const {
    projects,
    salespersons,
    payments,
    commercialMetrics,
    getProjectFinancials,
    addPaymentReceipt,
    deletePaymentReceipt,
    addPaymentFollowup,
    updateProject,
  } = useProjects();

  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // Sub-tabs: 'attention' (Do Not Miss Payment) | 'all_commercial' | 'ledger'
  const [activeSubTab, setActiveSubTab] = useState<'attention' | 'all_commercial' | 'ledger'>(
    'attention'
  );

  // Filters
  const [salespersonFilter, setSalespersonFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPaidInRegister, setShowPaidInRegister] = useState<boolean>(true);

  // Pagination (100 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 100;

  // Reset page when switching tabs or filters
  const handleTabChange = (tab: 'attention' | 'all_commercial' | 'ledger') => {
    setActiveSubTab(tab);
    setCurrentPage(1);
  };

  // Quick Action Modal: Record Payment Receipt
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [targetProjectForPayment, setTargetProjectForPayment] = useState<Project | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(toInputDateFormat(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paymentType, setPaymentType] = useState<PaymentType>('Rental');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Delete Wrong Payment Modal & Notification State
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<PaymentReceipt | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [deletePaymentError, setDeletePaymentError] = useState<string | null>(null);

  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [selectedProjectForReceipts, setSelectedProjectForReceipts] = useState<Project | null>(null);

  // Quick Action Modal: Record Follow-Up & Promise to Pay
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [targetProjectForFollowup, setTargetProjectForFollowup] = useState<Project | null>(null);
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupDate, setFollowupDate] = useState(toInputDateFormat(new Date()));
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [followupStatus, setFollowupStatus] = useState<FollowUpStatus>('Called');
  const [promisedDate, setPromisedDate] = useState('');
  const [promisedAmount, setPromisedAmount] = useState('');
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [followupErrorMsg, setFollowupErrorMsg] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Data item computation: Projects with their calculated financials
  // -------------------------------------------------------------
  const allProjectsWithFinancials = useMemo(() => {
    return projects.map((p) => {
      const fin = getProjectFinancials(p.id);
      return { project: p, financials: fin };
    });
  }, [projects, getProjectFinancials]);

  // -------------------------------------------------------------
  // Section: "DO NOT MISS PAYMENT" / Collection Queue
  // Items requiring attention:
  // - Overdue payments
  // - Unpaid or partially paid projects with outstanding balance
  // - Upcoming due dates
  // -------------------------------------------------------------
  const attentionItems = useMemo(() => {
    return allProjectsWithFinancials
      .filter(({ project, financials }) => {
        const hasOutstanding = financials.outstandingAmount > 0;
        const isOverdue = financials.isOverdue;
        const isPartial = project.paymentStatus === 'PARTIAL_PAID';

        const isDueSoon =
          financials.nextPaymentDue &&
          calculateDiffDays(financials.nextPaymentDue) <= 30;

        const requiresAttention =
          hasOutstanding && (isOverdue || isPartial || isDueSoon || project.projectStatus === 'ACTIVE');

        if (!requiresAttention) return false;

        // Salesperson filter
        if (salespersonFilter !== 'ALL' && project.salespersonId !== salespersonFilter) {
          return false;
        }

        // Priority filter
        if (priorityFilter !== 'ALL' && financials.priority !== priorityFilter) {
          return false;
        }

        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = project.projectCode.toLowerCase().includes(q);
          const matchComp = project.company.toLowerCase().includes(q);
          const matchRef = project.projectReference.toLowerCase().includes(q);
          const matchSP = project.salespersonName?.toLowerCase().includes(q);
          if (!matchCode && !matchComp && !matchRef && !matchSP) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort priority: CRITICAL (0) -> HIGH (1) -> MEDIUM (2) -> UPCOMING (3) -> CLEAR (4)
        const order: Record<CollectionPriority, number> = {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 2,
          UPCOMING: 3,
          CLEAR: 4,
        };
        const pA = order[a.financials.priority];
        const pB = order[b.financials.priority];
        if (pA !== pB) return pA - pB;

        // Within same priority, sort highest outstanding balance first
        return b.financials.outstandingAmount - a.financials.outstandingAmount;
      });
  }, [allProjectsWithFinancials, salespersonFilter, priorityFilter, searchQuery]);

  // -------------------------------------------------------------
  // Filtered Register of All Projects
  // -------------------------------------------------------------
  const commercialRegisterItems = useMemo(() => {
    return allProjectsWithFinancials.filter(({ project, financials }) => {
      if (!showPaidInRegister && financials.outstandingAmount === 0) {
        return false;
      }
      if (salespersonFilter !== 'ALL' && project.salespersonId !== salespersonFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = project.projectCode.toLowerCase().includes(q);
        const matchComp = project.company.toLowerCase().includes(q);
        const matchRef = project.projectReference.toLowerCase().includes(q);
        const matchSP = project.salespersonName?.toLowerCase().includes(q);
        if (!matchCode && !matchComp && !matchRef && !matchSP) return false;
      }
      return true;
    });
  }, [allProjectsWithFinancials, showPaidInRegister, salespersonFilter, searchQuery]);

  // Filtered Payment Receipts Ledger
  const filteredPaymentReceipts = useMemo(() => {
    return payments.filter((pmt) => {
      if (salespersonFilter !== 'ALL') {
        const prj = projects.find((p) => p.id === pmt.projectId);
        if (prj && prj.salespersonId !== salespersonFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = pmt.projectCode.toLowerCase().includes(q);
        const matchComp = pmt.company.toLowerCase().includes(q);
        const matchRef = pmt.paymentReference?.toLowerCase().includes(q) || false;
        const matchRemarks = pmt.remarks?.toLowerCase().includes(q) || false;
        if (!matchCode && !matchComp && !matchRef && !matchRemarks) return false;
      }
      return true;
    });
  }, [payments, projects, salespersonFilter, searchQuery]);

  // Active items count based on tab
  const activeTabTotalCount = useMemo(() => {
    if (activeSubTab === 'attention') return attentionItems.length;
    if (activeSubTab === 'all_commercial') return commercialRegisterItems.length;
    return filteredPaymentReceipts.length;
  }, [activeSubTab, attentionItems.length, commercialRegisterItems.length, filteredPaymentReceipts.length]);

  const totalPages = Math.ceil(activeTabTotalCount / pageSize) || 1;

  // Paginated slices
  const paginatedAttentionItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return attentionItems.slice(start, start + pageSize);
  }, [attentionItems, currentPage, pageSize]);

  const paginatedCommercialRegisterItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return commercialRegisterItems.slice(start, start + pageSize);
  }, [commercialRegisterItems, currentPage, pageSize]);

  const paginatedPaymentReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPaymentReceipts.slice(start, start + pageSize);
  }, [filteredPaymentReceipts, currentPage, pageSize]);

  // Export to Excel / CSV matching ProjectsView pattern
  const handleExport = (format: 'xlsx' | 'csv') => {
    let exportData: any[] = [];
    const timestamp = new Date().toISOString().split('T')[0];
    let sheetName = 'Collections';

    if (activeSubTab === 'attention') {
      sheetName = 'Action_Queue';
      exportData = attentionItems.map(({ project, financials }) => ({
        'Priority': financials.priority,
        'Project Code': project.projectCode,
        'Company': project.company,
        'Reference': project.projectReference,
        'Salesperson': project.salespersonName || 'Unassigned',
        'Contract Value (AED)': financials.contractAmount,
        'Total Received (AED)': financials.totalReceived,
        'Outstanding (AED)': financials.outstandingAmount,
        'Status': financials.isOverdue ? `OVERDUE (${financials.daysOverdue}d)` : project.paymentStatus,
        'Next Follow-Up': project.nextFollowUpDate ? formatDateDDMMYYYY(project.nextFollowUpDate) : '',
        'Customer Promised Date': project.promisedPaymentDate ? formatDateDDMMYYYY(project.promisedPaymentDate) : '',
        'Promised Amount (AED)': project.promisedAmount || '',
      }));
    } else if (activeSubTab === 'all_commercial') {
      sheetName = 'Commercial_Register';
      exportData = commercialRegisterItems.map(({ project, financials }) => ({
        'Project Code': project.projectCode,
        'Company': project.company,
        'Reference': project.projectReference,
        'Salesperson': project.salespersonName || 'Unassigned',
        'Service Type': project.scaffoldingType,
        'Delivery Date': formatDateDDMMYYYY(project.deliveryDate),
        'Due Date': formatDateDDMMYYYY(project.dueDate),
        'Contract Value (AED)': financials.contractAmount,
        'Received (AED)': financials.totalReceived,
        'Outstanding (AED)': financials.outstandingAmount,
        'Payment Status': financials.calculatedPaymentStatus,
        'Project Status': project.projectStatus,
      }));
    } else {
      sheetName = 'Receipts_Ledger';
      exportData = filteredPaymentReceipts.map((pmt) => ({
        'Receipt Date': formatDateDDMMYYYY(pmt.paymentReceivedDate),
        'Project Code': pmt.projectCode,
        'Company': pmt.company,
        'Amount Received (AED)': pmt.paymentReceivedAmount,
        'Method': pmt.paymentMethod,
        'Payment Type': pmt.paymentType || 'Rental',
        'Reference / Cheque #': pmt.paymentReference || '',
        'Remarks': pmt.remarks || '',
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (format === 'csv') {
      XLSX.writeFile(wb, `AB_Tracker_${sheetName}_${timestamp}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `AB_Tracker_${sheetName}_${timestamp}.xlsx`, { bookType: 'xlsx' });
    }
  };

  // Handlers for Record Payment Receipt
  const handleOpenRecordPayment = (project: Project) => {
    setTargetProjectForPayment(project);
    const fin = getProjectFinancials(project.id);
    const payable = fin.payableOutstandingAmount !== undefined ? fin.payableOutstandingAmount : fin.outstandingAmount;
    setPaymentAmount(payable > 0 ? String(payable) : '');
    setPaymentDate(toInputDateFormat(new Date()));
    setPaymentMethod('Bank Transfer');
    setPaymentType('Rental');
    setPaymentReference('');
    setPaymentRemarks('');
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectForPayment) return;
    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid received amount greater than 0');
      return;
    }

    // Enforce billing cutoff at business-logic level
    const fin = getProjectFinancials(targetProjectForPayment.id);
    const payableLimit = fin.payableOutstandingAmount !== undefined ? fin.payableOutstandingAmount : fin.outstandingAmount;
    if (payableLimit <= 0) {
      setPaymentError(
        'Cannot record payment for unelapsed rental days. Today is the billing cutoff. Future days remain unaccrued.'
      );
      return;
    }

    setSubmittingPayment(true);
    setPaymentError(null);
    try {
      await addPaymentReceipt({
        projectId: targetProjectForPayment.id,
        projectCode: targetProjectForPayment.projectCode,
        company: targetProjectForPayment.company,
        paymentReceivedAmount: amountNum,
        paymentReceivedDate: paymentDate,
        paymentMethod,
        paymentType,
        paymentReference: paymentReference.trim() || undefined,
        remarks: paymentRemarks.trim() || undefined,
      });

      setPaymentModalOpen(false);
      setSuccessNotice(
        `Recorded ${formatAED(amountNum)} for ${targetProjectForPayment.projectCode} (${targetProjectForPayment.company}).`
      );
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to save payment receipt');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Handler for Delete Wrong Payment Receipt
  const handleExecuteDeletePayment = async () => {
    if (!confirmDeletePayment) return;
    setDeletingPayment(true);
    setDeletePaymentError(null);
    try {
      await deletePaymentReceipt(confirmDeletePayment.id);
      const code = confirmDeletePayment.projectCode;
      const amt = confirmDeletePayment.paymentReceivedAmount;
      setConfirmDeletePayment(null);
      setSuccessNotice(`Deleted wrong payment receipt of ${formatAED(amt)} for ${code}. Recalculated balances.`);
    } catch (err: any) {
      setDeletePaymentError(err.message || 'Failed to delete payment receipt');
    } finally {
      setDeletingPayment(false);
    }
  };

  // Handlers for Record Follow-Up
  const handleOpenFollowup = (project: Project) => {
    setTargetProjectForFollowup(project);
    setFollowupNotes('');
    setFollowupDate(toInputDateFormat(new Date()));
    setNextFollowupDate('');
    setFollowupStatus('Called');
    setPromisedDate('');
    setPromisedAmount('');
    setFollowupErrorMsg(null);
    setFollowupModalOpen(true);
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectForFollowup || !followupNotes.trim()) return;

    setSubmittingFollowup(true);
    setFollowupErrorMsg(null);
    try {
      await addPaymentFollowup(targetProjectForFollowup.id, followupNotes.trim(), followupDate, {
        promisedDate: promisedDate || undefined,
        promisedAmount: promisedAmount ? Number(promisedAmount) : undefined,
        followUpStatus: followupStatus,
      });

      if (nextFollowupDate) {
        await updateProject(
          targetProjectForFollowup.id,
          {
            nextFollowUpDate: nextFollowupDate,
            lastFollowUpDate: followupDate,
            followUpStatus: followupStatus,
            followUpRemarks: followupNotes.trim(),
          },
          `Follow-up logged. Next call: ${nextFollowupDate}`
        );
      }

      setFollowupModalOpen(false);
      setSuccessNotice(`Follow-up saved for ${targetProjectForFollowup.projectCode}.`);
    } catch (err: any) {
      setFollowupErrorMsg(err.message || 'Failed to save follow-up');
    } finally {
      setSubmittingFollowup(false);
    }
  };

  const hasActiveFilters =
    salespersonFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    searchQuery.trim() !== '' ||
    !showPaidInRegister;

  const handleResetFilters = () => {
    setSalespersonFilter('ALL');
    setPriorityFilter('ALL');
    setSearchQuery('');
    setShowPaidInRegister(true);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Primary Tabs Card (Clean Structure Matching ProjectsView) */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB]" />
              <span>Payments & Collections</span>
            </h1>
            <p className="text-xs text-[#64748B] font-normal mt-0.5">
              Commercial tracking: Quotation → LPO → Contract → Received Payments & Follow-Up
            </p>
          </div>

          {/* Clean Action Buttons Matching ProjectsView */}
          <div className="flex items-center gap-2">
            {commercialMetrics.attentionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] font-bold text-xs rounded-lg shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>{commercialMetrics.attentionCount} Require Attention</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#334155] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Export active table to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Compact Operational KPIs Ribbon (4 Clean Cards Matching ProjectsView) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Card 1: Total Contract / LPO Value */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Contract / LPO Value
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#0F172A]">
                {formatAED(commercialMetrics.totalContractValue)}
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] block mt-0.5">
              Total active contracts
            </span>
          </div>

          {/* Card 2: Total Received */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wider block">
              Total Received
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#16A34A]">
                {formatAED(commercialMetrics.totalReceived)}
              </span>
            </div>
            <span className="text-[11px] text-[#15803D] block mt-0.5">
              {payments.length} receipts logged
            </span>
          </div>

          {/* Card 3: Total Outstanding */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wider block">
              Total Outstanding
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#DC2626]">
                {formatAED(commercialMetrics.totalOutstanding)}
              </span>
            </div>
            <span className="text-[11px] text-[#991B1B] block mt-0.5">
              Contract − Received
            </span>
          </div>

          {/* Card 4: Total Overdue */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#D97706] uppercase tracking-wider block">
              Total Overdue
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#D97706]">
                {formatAED(commercialMetrics.totalOverdue)}
              </span>
            </div>
            <span className="text-[11px] text-[#B45309] block mt-0.5">
              Immediate collection
            </span>
          </div>
        </div>

        {/* Primary Sub-Tabs Ribbon Matching ProjectsView Navigation Pattern */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#E2E8F0] pt-3 scrollbar-none">
          <button
            type="button"
            onClick={() => handleTabChange('attention')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'attention'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>DO NOT MISS PAYMENT</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'attention'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-100 text-[#DC2626]'
              }`}
            >
              {attentionItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('all_commercial')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'all_commercial'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Commercial Register</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'all_commercial'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {commercialRegisterItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ledger')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ledger'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Receipts Ledger</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'ledger'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successNotice && (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-xl text-xs font-medium flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-[#15803D] hover:underline cursor-pointer font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Secondary Filter Toolbar (Clean Box Matching ProjectsView) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search Box with Search Icon */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Code, Client, Reference..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* Salesperson Filter Dropdown */}
          <div className="flex items-center gap-1 min-w-[150px]">
            <UserCheck className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <select
              value={salespersonFilter}
              onChange={(e) => {
                setSalespersonFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg font-semibold text-[#0F172A] text-xs focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="ALL">Salesperson: All</option>
              {salespersons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter (Only in Attention Tab) */}
          {activeSubTab === 'attention' && (
            <div className="flex items-center gap-1 min-w-[140px]">
              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg font-semibold text-[#0F172A] text-xs focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="ALL">Priority: All</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="HIGH">High Only</option>
                <option value="MEDIUM">Medium Only</option>
                <option value="UPCOMING">Upcoming</option>
              </select>
            </div>
          )}

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] border border-[#FECACA] rounded-lg font-semibold transition cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Toggle Settled in Register */}
        {activeSubTab === 'all_commercial' && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-semibold text-[#475569]">
            <input
              type="checkbox"
              checked={showPaidInRegister}
              onChange={(e) => {
                setShowPaidInRegister(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded text-[#2563EB] focus:ring-[#2563EB]"
            />
            <span>Include Fully Paid</span>
          </label>
        )}
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: DO NOT MISS PAYMENT (ATTENTION QUEUE)               */}
      {/* ============================================================== */}
      {activeSubTab === 'attention' && (
        <div className="space-y-3">
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center justify-between text-xs text-[#991B1B]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>
                <strong>Collection Priority Queue:</strong> Automatically sorted by highest urgency (overdue & missed promises) down to upcoming payments. Focus on clearing outstanding balances.
              </span>
            </div>
            <span className="font-bold text-[#DC2626] whitespace-nowrap">
              {attentionItems.length} Records
            </span>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider text-[11px] select-none">
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Company & Project</th>
                    <th className="py-2.5 px-3">Sales Person</th>
                    <th className="py-2.5 px-3 text-right">Contract Value</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right font-black">Outstanding</th>
                    <th className="py-2.5 px-3">Due / Status</th>
                    <th className="py-2.5 px-3">Follow-Up & Promise</th>
                    <th className="py-2.5 px-3 text-center">Collection Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {paginatedAttentionItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#64748B]">
                        <CheckCircle2 className="w-9 h-9 text-[#16A34A] mx-auto mb-2" />
                        <p className="font-bold text-sm text-[#0F172A]">All Clear! No Pending Collections</p>
                        <p className="text-xs text-[#64748B] mt-1">
                          No overdue projects or pending follow-ups meet this filter criteria.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedAttentionItems.map(({ project, financials }) => {
                      const hasMissedPromise = financials.hasMissedPromise;
                      const isNextFollowupOverdue =
                        project.nextFollowUpDate && calculateDiffDays(project.nextFollowUpDate) < 0;

                      return (
                        <tr
                          key={project.id}
                          className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                            hasMissedPromise
                              ? 'bg-[#FFFBEB]/60'
                              : financials.priority === 'CRITICAL'
                              ? 'bg-[#FEF2F2]/30'
                              : ''
                          }`}
                          onClick={() => onViewProject(project)}
                        >
                          {/* Priority Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                financials.priority === 'CRITICAL'
                                  ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                                  : financials.priority === 'HIGH'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                  : financials.priority === 'MEDIUM'
                                  ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                                  : 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]'
                              }`}
                            >
                              {financials.priority === 'CRITICAL' && (
                                <AlertCircle className="w-3 h-3 text-[#DC2626]" />
                              )}
                              <span>{financials.priority}</span>
                            </span>
                          </td>

                          {/* Company & Project */}
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#0F172A] block text-xs truncate max-w-[180px]">
                              {project.company}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-bold text-[#2563EB] text-[11px]">
                                {project.projectCode}
                              </span>
                              <span className="text-[10px] text-[#64748B] truncate max-w-[120px]">
                                {project.projectReference}
                              </span>
                            </div>
                          </td>

                          {/* Sales Person */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-[#475569] font-medium">
                            <span className="block">{project.salespersonName || 'Unassigned'}</span>
                            <span className="text-[10px] text-[#94A3B8]">
                              {project.salespersonAssignmentType === 'MANUALLY_CHANGED'
                                ? 'Manual'
                                : 'Default'}
                            </span>
                          </td>

                          {/* Contract Value */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-[#0F172A] tabular-nums">
                            {formatAED(financials.contractAmount)}
                          </td>

                          {/* Received */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                            <span className="font-bold text-[#16A34A] block">
                              {formatAED(financials.totalReceived)}
                            </span>
                            {financials.payments.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProjectForReceipts(project);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-semibold cursor-pointer"
                                title="View payment receipts for this project"
                              >
                                <span>{financials.payments.length} {financials.payments.length === 1 ? 'receipt' : 'receipts'}</span>
                              </button>
                            )}
                          </td>

                          {/* Outstanding (Highlight) */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                            <span className="font-black text-sm text-[#DC2626] block">
                              {formatAED(financials.outstandingAmount)}
                            </span>
                          </td>

                          {/* Due / Status Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {financials.isOverdue ? (
                              <div className="bg-[#FEF2F2] border border-[#FECACA] px-2 py-1 rounded text-center">
                                <span className="font-black text-[#DC2626] text-[10px] uppercase block tracking-wider">
                                  OVERDUE
                                </span>
                                <span className="font-bold text-[#B91C1C] text-[10px] block">
                                  {financials.daysOverdue} DAYS
                                </span>
                                <span className="font-mono text-[#991B1B] text-[9px] block">
                                  {formatAED(financials.outstandingAmount)} PENDING
                                </span>
                              </div>
                            ) : financials.nextPaymentDue ? (
                              <div>
                                <span className="text-[#475569] font-medium block">
                                  Due {formatDateDDMMYYYY(financials.nextPaymentDue)}
                                </span>
                                <span className="text-[10px] text-[#2563EB] block">
                                  in {calculateDiffDays(financials.nextPaymentDue)} days
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#64748B]">
                                {project.paymentStatus.replace('_', ' ')}
                              </span>
                            )}
                          </td>

                          {/* Follow-Up & Promise to Pay */}
                          <td className="py-2.5 px-3 text-[11px]">
                            {/* MISSED PROMISE ALERT */}
                            {hasMissedPromise && (
                              <div className="mb-1 p-1 bg-[#FEF2F2] border border-[#FECACA] rounded text-[10px] font-bold text-[#DC2626] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-[#DC2626] shrink-0" />
                                <span>
                                  Promised {formatDateDDMMYYYY(project.promisedPaymentDate!)} — NOT RECEIVED
                                </span>
                              </div>
                            )}

                            {/* Promise to pay if pending */}
                            {!hasMissedPromise && project.promisedPaymentDate && (
                              <div className="text-[10px] font-semibold text-[#B45309] bg-[#FFFBEB] px-1.5 py-0.5 rounded w-fit mb-1 border border-[#FDE68A]">
                                Promise: {formatAED(project.promisedAmount)} on{' '}
                                {formatDateDDMMYYYY(project.promisedPaymentDate)}
                              </div>
                            )}

                            {/* Last & Next Follow-Up */}
                            <div className="text-[#475569] text-[10px]">
                              {project.lastFollowUpDate && (
                                <div>Last: {formatDateDDMMYYYY(project.lastFollowUpDate)}</div>
                              )}
                              {project.nextFollowUpDate && (
                                <div
                                  className={`font-semibold ${
                                    isNextFollowupOverdue
                                      ? 'text-[#DC2626] underline font-bold'
                                      : 'text-[#2563EB]'
                                  }`}
                                >
                                  Next: {formatDateDDMMYYYY(project.nextFollowUpDate)}
                                  {isNextFollowupOverdue && ' (DUE NOW)'}
                                </div>
                              )}
                              {!project.lastFollowUpDate && !project.nextFollowUpDate && (
                                <span className="text-[#94A3B8] italic">No follow-ups recorded</span>
                              )}
                            </div>
                          </td>

                          {/* Quick Action Buttons */}
                          <td
                            className="py-2.5 px-3 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Record Payment */}
                              {financials.payableOutstandingAmount === 0 && financials.outstandingAmount > 0 ? (
                                <button
                                  type="button"
                                  disabled
                                  title="Upcoming period: No rental has accrued through today (Billing cutoff: Today)"
                                  className="px-2 py-1 bg-gray-100 text-gray-400 font-semibold text-[10px] rounded border border-gray-200 cursor-not-allowed flex items-center gap-1"
                                >
                                  <DollarSign className="w-3 h-3 text-gray-400" />
                                  <span>Upcoming</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecordPayment(project)}
                                  title="Record Payment Receipt"
                                  className="px-2 py-1 bg-[#16A34A] hover:bg-green-700 text-white font-semibold text-[10px] rounded shadow-2xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  <span>Receipt</span>
                                </button>
                              )}

                              {/* Follow-Up */}
                              <button
                                type="button"
                                onClick={() => handleOpenFollowup(project)}
                                title="Log Follow-Up & Promise to Pay"
                                className="px-2 py-1 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-[10px] rounded shadow-2xs transition cursor-pointer flex items-center gap-1"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Follow-Up</span>
                              </button>

                              {/* View Details */}
                              <button
                                type="button"
                                onClick={() => onViewProject(project)}
                                title="View Project Details"
                                className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Matching ProjectsView */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                <div>
                  Showing{' '}
                  <span className="font-bold text-[#0F172A]">
                    {(currentPage - 1) * pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-[#0F172A]">
                    {Math.min(attentionItems.length, currentPage * pageSize)}
                  </span>{' '}
                  of <span className="font-bold text-[#0F172A]">{attentionItems.length}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-[#0F172A]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: COMMERCIAL PROJECT REGISTER                         */}
      {/* ============================================================== */}
      {activeSubTab === 'all_commercial' && (
        <div className="space-y-3">
          <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs text-[#64748B] shadow-2xs">
            <span>
              <strong>Commercial Breakdown:</strong> Showing Contract / LPO values, total payments received, and remaining outstanding balance.
            </span>
            <span className="font-bold text-[#0F172A]">
              {commercialRegisterItems.length} Projects Total
            </span>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider text-[11px] select-none">
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Sales Person</th>
                    <th className="py-2.5 px-3 text-right">Contract / LPO Value</th>
                    <th className="py-2.5 px-3 text-right text-[#16A34A]">Total Received</th>
                    <th className="py-2.5 px-3 text-right font-black text-[#DC2626]">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Payment Status</th>
                    <th className="py-2.5 px-3 text-center">Project Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {paginatedCommercialRegisterItems.map(({ project, financials }) => {
                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        onClick={() => onViewProject(project)}
                      >
                        {/* Project Code */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-[#2563EB] text-xs">
                            {project.projectCode}
                          </span>
                          <span className="block text-[10px] text-[#64748B] truncate max-w-[130px]">
                            {project.projectReference}
                          </span>
                        </td>

                        {/* Company */}
                        <td className="py-2 px-3">
                          <span className="font-semibold text-[#0F172A] block truncate max-w-[160px]">
                            {project.company}
                          </span>
                        </td>

                        {/* Sales Person */}
                        <td className="py-2 px-3 whitespace-nowrap text-[#475569]">
                          {project.salespersonName || '—'}
                        </td>

                        {/* Contract Value */}
                        <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-[#0F172A] tabular-nums">
                          {formatAED(financials.contractAmount)}
                        </td>

                        {/* Total Received */}
                        <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums">
                          <span className="font-bold text-[#16A34A] block">
                            {formatAED(financials.totalReceived)}
                          </span>
                          {financials.payments.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProjectForReceipts(project);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-semibold cursor-pointer"
                              title="View payment receipts for this project"
                            >
                              <span>{financials.payments.length} {financials.payments.length === 1 ? 'receipt' : 'receipts'}</span>
                            </button>
                          )}
                        </td>

                        {/* Outstanding Amount */}
                        <td className="py-2 px-3 text-right whitespace-nowrap font-black tabular-nums">
                          <span
                            className={
                              financials.outstandingAmount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                            }
                          >
                            {formatAED(financials.outstandingAmount)}
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              financials.outstandingAmount === 0
                                ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                                : financials.isOverdue
                                ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                                : financials.totalReceived > 0
                                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                            }`}
                          >
                            {financials.calculatedPaymentStatus.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Project Status */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F8FAFC] border border-[#CBD5E1] text-[#334155]">
                            {project.projectStatus}
                          </span>
                        </td>

                        {/* Actions */}
                        <td
                          className="py-2 px-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {financials.payableOutstandingAmount === 0 && financials.outstandingAmount > 0 ? (
                              <button
                                type="button"
                                disabled
                                title="Upcoming period: No rental accrued through today"
                                className="p-1 text-gray-300 cursor-not-allowed"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordPayment(project)}
                                title="Record Receipt"
                                className="p-1 text-[#16A34A] hover:bg-[#F0FDF4] rounded transition cursor-pointer"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onViewProject(project)}
                              title="View Project"
                              className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                <div>
                  Showing{' '}
                  <span className="font-bold text-[#0F172A]">
                    {(currentPage - 1) * pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-[#0F172A]">
                    {Math.min(commercialRegisterItems.length, currentPage * pageSize)}
                  </span>{' '}
                  of <span className="font-bold text-[#0F172A]">{commercialRegisterItems.length}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-[#0F172A]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: PAYMENT RECEIPTS LEDGER                             */}
      {/* ============================================================== */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#16A34A]" />
              <span>Payment Receipts Ledger ({filteredPaymentReceipts.length})</span>
            </h3>
            <span className="text-xs text-[#64748B]">
              Real-time register of all customer payments and bank transfers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider text-[11px] select-none">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Project & Client</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Reference / Cheque #</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3 text-right">Received (AED)</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {paginatedPaymentReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                      No payment receipts logged yet matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedPaymentReceipts.map((pmt) => (
                    <tr key={pmt.id} className="hover:bg-[#F8FAFC] transition">
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[#475569]">
                        {formatDateDDMMYYYY(pmt.paymentReceivedDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[#2563EB] font-bold block">
                          {pmt.projectCode}
                        </span>
                        <span className="text-[11px] text-[#0F172A] font-semibold truncate max-w-[150px] block">
                          {pmt.company}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#475569]">
                        <span className="px-2 py-0.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded text-[10px] font-medium">
                          {pmt.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#475569] font-medium">
                        {pmt.paymentType || 'Rental'}
                      </td>
                      <td className="py-2.5 px-3">
                        {pmt.paymentReference ? (
                          <span className="font-mono text-xs text-[#2563EB] font-semibold">
                            {pmt.paymentReference}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#64748B] italic truncate max-w-[180px]">
                        {pmt.remarks || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-sm text-[#16A34A] tabular-nums">
                        {formatAED(pmt.paymentReceivedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePayment(pmt)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-md transition cursor-pointer shadow-2xs active:scale-95"
                          title="Delete Wrong Payment Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
              <div>
                Showing{' '}
                <span className="font-bold text-[#0F172A]">
                  {(currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-[#0F172A]">
                  {Math.min(filteredPaymentReceipts.length, currentPage * pageSize)}
                </span>{' '}
                of <span className="font-bold text-[#0F172A]">{filteredPaymentReceipts.length}</span> receipts
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-[#0F172A]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: RECORD PAYMENT RECEIPT                                */}
      {/* ============================================================== */}
      {paymentModalOpen && targetProjectForPayment && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Record Payment Receipt</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  <span className="font-mono text-[#2563EB] font-bold">
                    {targetProjectForPayment.projectCode}
                  </span>{' '}
                  — {targetProjectForPayment.company}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626] text-xs font-semibold">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Payment Received Amount (AED) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#16A34A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Date Received <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Payment Method <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Payment Type <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Rental">Rental</option>
                    <option value="Advance">Advance</option>
                    <option value="Monthly Payment">Monthly Payment</option>
                    <option value="Final Payment">Final Payment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Cheque No. / Transfer Reference
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. CHQ #448921 or FT-998822"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="e.g. Cleared through Emirates NBD account"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#334155] rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-1.5 bg-[#16A34A] hover:bg-green-700 text-white rounded-lg font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submittingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: FOLLOW-UP & PROMISE TO PAY                            */}
      {/* ============================================================== */}
      {followupModalOpen && targetProjectForFollowup && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">
                  Collection Follow-Up & Promise
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  <span className="font-mono text-[#2563EB] font-bold">
                    {targetProjectForFollowup.projectCode}
                  </span>{' '}
                  — {targetProjectForFollowup.company}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowupModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {followupErrorMsg && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626] text-xs font-semibold">
                {followupErrorMsg}
              </div>
            )}

            <form onSubmit={handleSaveFollowup} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Follow-Up Date <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Follow-Up Status <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={followupStatus}
                    onChange={(e) => setFollowupStatus(e.target.value as FollowUpStatus)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Not Contacted">Not Contacted</option>
                    <option value="Reminder Sent">Reminder Sent</option>
                    <option value="Called">Called</option>
                    <option value="Promise to Pay">Promise to Pay</option>
                    <option value="Payment Awaited">Payment Awaited</option>
                    <option value="Escalated">Escalated</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Follow-Up Notes & Discussion <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  placeholder="e.g. Spoke with Finance Director. Cheque prepared and signed..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Next Follow-Up Date
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#2563EB] focus:outline-none focus:border-[#2563EB]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">
                  If this date passes without payment, it will be automatically highlighted in the collection queue.
                </p>
              </div>

              {/* Promise to Pay Section */}
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl space-y-2">
                <span className="font-bold text-[#B45309] block text-xs">
                  Customer Promise to Pay (Optional)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-[#92400E] text-[10px] mb-1">
                      Promised Date
                    </label>
                    <input
                      type="date"
                      value={promisedDate}
                      onChange={(e) => setPromisedDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#FDE68A] rounded-lg text-xs text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#92400E] text-[10px] mb-1">
                      Promised Amount (AED)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={promisedAmount}
                      onChange={(e) => setPromisedAmount(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#FDE68A] rounded-lg text-xs font-bold text-[#0F172A]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[#92400E]">
                  If promised date passes without receiving payment, system marks as <strong>MISSED PROMISE</strong> and elevates priority to <strong>CRITICAL</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setFollowupModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#334155] rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFollowup}
                  className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submittingFollowup ? 'Saving...' : 'Save Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: DELETE WRONG PAYMENT CONFIRMATION DIALOG              */}
      {/* ============================================================== */}
      {confirmDeletePayment &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] bg-[#0B1526]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deletingPayment) setConfirmDeletePayment(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] max-w-md w-full p-5 sm:p-6 my-auto animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#FEF2F2] text-[#DC2626] rounded-xl border border-[#FECACA] shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Delete Wrong Payment Record?
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Are you sure you want to delete this payment receipt? The project's collected amount, outstanding balance, and payment status will be automatically reversed.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingPayment}
                  onClick={() => setConfirmDeletePayment(null)}
                  className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {deletePaymentError && (
                <div className="mt-3 p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-medium">
                  {deletePaymentError}
                </div>
              )}

              {/* Payment Details summary card */}
              <div className="my-4 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Project:</span>
                  <span className="font-mono font-bold text-[#2563EB]">
                    {confirmDeletePayment.projectCode}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Company:</span>
                  <span className="font-semibold text-[#0F172A] truncate max-w-[200px]">
                    {confirmDeletePayment.company}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Amount Received:</span>
                  <span className="font-black text-sm text-[#DC2626] tabular-nums">
                    {formatAED(confirmDeletePayment.paymentReceivedAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Date Received:</span>
                  <span className="font-medium text-[#0F172A]">
                    {formatDateDDMMYYYY(confirmDeletePayment.paymentReceivedDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Method:</span>
                  <span className="font-medium text-[#0F172A]">
                    {confirmDeletePayment.paymentMethod || 'Bank Transfer'}
                  </span>
                </div>
                {confirmDeletePayment.paymentReference && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Reference:</span>
                    <span className="font-mono text-[#2563EB]">
                      {confirmDeletePayment.paymentReference}
                    </span>
                  </div>
                )}
                {confirmDeletePayment.remarks && (
                  <div className="pt-1 border-t border-[#E2E8F0] text-[#64748B] italic text-[11px]">
                    "{confirmDeletePayment.remarks}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  disabled={deletingPayment}
                  onClick={() => setConfirmDeletePayment(null)}
                  className="px-3.5 py-2 bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#334155] font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingPayment}
                  onClick={handleExecuteDeletePayment}
                  className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingPayment ? 'Deleting...' : 'Yes, Delete Payment'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ============================================================== */}
      {/* MODAL 4: PROJECT RECEIPTS & WRONG PAYMENT REMOVAL MODAL        */}
      {/* ============================================================== */}
      {selectedProjectForReceipts &&
        createPortal(
          <div
            className="fixed inset-0 z-[990] bg-[#0B1526]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedProjectForReceipts(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] max-w-xl w-full p-5 sm:p-6 my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded text-xs font-mono font-bold">
                      {selectedProjectForReceipts.projectCode}
                    </span>
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Payments Received Receipts
                    </h3>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {selectedProjectForReceipts.company} — {selectedProjectForReceipts.projectReference}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProjectForReceipts(null)}
                  className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipts list */}
              <div className="my-4 flex-1 overflow-y-auto space-y-2.5">
                {(() => {
                  const projectReceipts = payments.filter(
                    (p) => p.projectId === selectedProjectForReceipts.id
                  );
                  if (projectReceipts.length === 0) {
                    return (
                      <div className="py-8 text-center text-[#94A3B8] text-xs">
                        No payment receipts logged for this project.
                      </div>
                    );
                  }
                  return projectReceipts.map((pmt) => (
                    <div
                      key={pmt.id}
                      className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-[#16A34A] tabular-nums">
                            {formatAED(pmt.paymentReceivedAmount)}
                          </span>
                          <span className="px-1.5 py-0.5 bg-white border border-[#CBD5E1] rounded text-[10px] text-[#475569] font-medium">
                            {pmt.paymentMethod}
                          </span>
                          {pmt.paymentReference && (
                            <span className="text-[10px] font-mono text-[#2563EB]">
                              Ref: {pmt.paymentReference}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          Received on {formatDateDDMMYYYY(pmt.paymentReceivedDate)}
                          {pmt.installmentMonth ? ` • For ${pmt.installmentMonth}` : ''}
                        </div>
                        {pmt.remarks && (
                          <div className="text-[11px] text-[#64748B] italic truncate">
                            "{pmt.remarks}"
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeletePayment(pmt);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition cursor-pointer shrink-0 shadow-2xs"
                        title="Delete this wrong payment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  ));
                })()}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B]">
                <span>
                  Wrong amount entered? Click <strong>Delete</strong> next to any receipt to remove and recalculate.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProjectForReceipts(null)}
                  className="px-3 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#334155] font-semibold rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
