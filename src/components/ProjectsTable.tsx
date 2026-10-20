import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectStatus, PaymentStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { formatDateDDMMYYYY, getDueStatus } from '../utils/dateUtils';
import { getWhatsAppUrl } from '../utils/whatsapp';
import * as XLSX from 'xlsx';
import {
  Eye,
  Edit2,
  Copy,
  Trash2,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  SlidersHorizontal,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface ProjectsTableProps {
  projects: Project[];
  title?: string;
  subtitle?: string;
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onCopyProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  onAddFollowup?: (project: Project) => void;
  onOpenImport?: () => void;
  isDashboard?: boolean;
}

export const ProjectsTable: React.FC<ProjectsTableProps> = ({
  projects,
  title,
  subtitle,
  onViewProject,
  onEditProject,
  onCopyProject,
  onDeleteProject,
  onAddFollowup,
  onOpenImport,
  isDashboard = false,
}) => {
  const { userProfile } = useAuth();
  const { bulkSoftDeleteProjects, bulkUpdateProjects, companies } = useProjects();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // 100 items per page specification

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Modals state
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkPaymentModalOpen, setBulkPaymentModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ProjectStatus>('ACTIVE');
  const [newPayment, setNewPayment] = useState<PaymentStatus>('PAID');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Search filtering within the provided projects list
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(
      (p) =>
        p.projectCode?.toLowerCase().includes(term) ||
        p.company?.toLowerCase().includes(term) ||
        p.projectReference?.toLowerCase().includes(term) ||
        p.mobile?.toLowerCase().includes(term) ||
        p.scaffoldingType?.toLowerCase().includes(term) ||
        p.remarks?.toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // Clean up selectedIds when projects array changes
  useEffect(() => {
    const validIds = new Set(projects.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [projects]);

  // Selection calculations on the currently visible page
  const allPageSelected =
    paginatedProjects.length > 0 && paginatedProjects.every((p) => selectedIds.has(p.id));
  const somePageSelected =
    paginatedProjects.some((p) => selectedIds.has(p.id)) && !allPageSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = somePageSelected;
    }
  }, [somePageSelected]);

  const toggleSelectPage = () => {
    if (allPageSelected) {
      // Deselect all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedProjects.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedProjects.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredProjects.map((p) => p.id)));
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Export helper (can export all filtered or selected only)
  const exportData = (format: 'csv' | 'xlsx', onlySelected = false) => {
    const listToExport = onlySelected
      ? projects.filter((p) => selectedIds.has(p.id))
      : filteredProjects;

    const rows = listToExport.map((p) => {
      const dueStatus = getDueStatus(p.dueDate, p.projectStatus);
      return {
        'Project Code': p.projectCode,
        Company: p.company,
        Mobile: p.mobile,
        Reference: p.projectReference,
        'Scaffolding Type': p.scaffoldingType,
        'Hire Period (Days)': p.hirePeriodDays,
        'Delivery Date': formatDateDDMMYYYY(p.deliveryDate),
        'Due Date': formatDateDDMMYYYY(p.dueDate),
        'Overdue / Remaining': dueStatus.label,
        'Project Status': p.projectStatus,
        'Returned Date': p.returnedDate ? formatDateDDMMYYYY(p.returnedDate) : '-',
        'Payment Status': p.paymentStatus,
        Remarks: p.remarks || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

    const prefix = onlySelected ? 'AB_Tracker_Selected_Projects' : 'AB_Tracker_Projects';
    const fileName = `${prefix}_${new Date().toISOString().split('T')[0]}.${format}`;
    if (format === 'csv') {
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
    }
  };

  // Bulk Move to Trash (Delete)
  const handleConfirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setProcessing(true);
    setFeedback(null);
    try {
      const count = await bulkSoftDeleteProjects(ids);
      setSelectedIds(new Set());
      setBulkDeleteModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Moved ${count} project${count > 1 ? 's' : ''} to Trash successfully.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to move projects to Trash.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Bulk Update Project Status
  const handleConfirmBulkStatus = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setProcessing(true);
    setFeedback(null);
    try {
      const updates: Partial<Project> = { projectStatus: newStatus };
      if (newStatus === 'RETURNED' || newStatus === 'CLOSED') {
        updates.returnedDate = new Date().toISOString().split('T')[0];
      }
      const count = await bulkUpdateProjects(
        ids,
        updates,
        `Bulk updated project status to ${newStatus}`
      );
      setSelectedIds(new Set());
      setBulkStatusModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Updated project status to ${newStatus} for ${count} project${count > 1 ? 's' : ''}.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update projects.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Bulk Update Payment Status
  const handleConfirmBulkPayment = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setProcessing(true);
    setFeedback(null);
    try {
      const count = await bulkUpdateProjects(
        ids,
        { paymentStatus: newPayment },
        `Bulk updated payment status to ${newPayment}`
      );
      setSelectedIds(new Set());
      setBulkPaymentModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Updated payment status to ${newPayment} for ${count} project${count > 1 ? 's' : ''}.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update payment status.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Selected projects for preview in confirmation modals
  const selectedProjects = useMemo(() => {
    return projects.filter((p) => selectedIds.has(p.id));
  }, [projects, selectedIds]);

  return (
    <div className="bg-white rounded-xl shadow-xs border border-[#E4E7EC] overflow-hidden space-y-0">
      {/* Table Header / Action Bar with clean contrast accent */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#E4E7EC] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {title || subtitle ? (
          <div>
            {title && <h2 className="text-sm sm:text-base font-bold text-[#172B4D] tracking-tight">{title}</h2>}
            {subtitle && <p className="text-[11px] text-[#475467] font-medium mt-0.5">{subtitle}</p>}
          </div>
        ) : null}

        <div
          className={`flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
            !title && !subtitle ? 'w-full justify-between' : ''
          }`}
        >
          {/* Quick Search */}
          <div className="relative flex-1 sm:flex-initial sm:min-w-[260px]">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search code, company, ref..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition text-[#172033] placeholder:text-[#98A2B3] font-medium"
            />
          </div>

          {/* Action Tools in one line: only shown in projects / non-dashboard sections */}
          {!isDashboard && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Export Buttons */}
              <div className="flex items-center gap-1 bg-[#F2F4F7] p-0.5 rounded-lg border border-[#E4E7EC]">
                <button
                  onClick={() => exportData('xlsx')}
                  title="Export filtered projects as Excel (.xlsx)"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#344054] hover:text-[#172033] hover:bg-white rounded-md transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => exportData('csv')}
                  title="Export filtered projects as CSV (.csv)"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#344054] hover:text-[#172033] hover:bg-white rounded-md transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>CSV</span>
                </button>
              </div>

              {/* Import Button (ADMIN Only) */}
              {isAdmin && onOpenImport && (
                <button
                  onClick={onOpenImport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 rotate-180" />
                  <span>Import</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Temporary Feedback Notification */}
      {feedback && (
        <div
          className={`p-2.5 mx-3 sm:mx-4 mt-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#059669] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[#667085] hover:text-[#172033] p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating / Pinned Bulk Action Toolbar when items are selected */}
      {!isDashboard && selectedIds.size > 0 && (
        <div className="bg-[#172B4D] text-white p-2.5 sm:p-3 m-2 sm:m-2.5 rounded-xl shadow-lg border border-[#20365B] flex flex-col md:flex-row md:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 bg-[#2563EB] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-xs">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectedIds.size}</span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white">
              {selectedIds.size === 1 ? '1 project selected' : `${selectedIds.size} projects selected`}
            </span>

            {/* Select all across pages banner option */}
            {selectedIds.size < filteredProjects.length && (
              <button
                onClick={selectAllFiltered}
                className="text-xs text-[#93C5FD] hover:text-white underline font-medium ml-1 cursor-pointer"
              >
                Select all {filteredProjects.length} projects
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-[#94A3B8] hover:text-white underline cursor-pointer ml-1"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Export Selected */}
            <div className="flex items-center bg-[#13233F] border border-[#20365B] rounded-lg p-0.5">
              <button
                onClick={() => exportData('xlsx', true)}
                title="Export selected projects as Excel"
                className="px-2.5 py-1 text-[11px] font-semibold text-[#E2E8F0] hover:text-white hover:bg-[#1F365D] rounded transition cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3 h-3 text-[#3B82F6]" />
                <span>Export ({selectedIds.size})</span>
              </button>
            </div>

            {/* Admin only actions: Update Status & Payment, Move to Trash */}
            {isAdmin && (
              <>
                {/* Bulk Status Update */}
                <button
                  onClick={() => setBulkStatusModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1F365D] hover:bg-[#2B4C80] border border-[#2B4C80] text-white text-xs font-medium rounded-lg transition cursor-pointer shadow-xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>Update Status</span>
                </button>

                {/* Bulk Payment Update */}
                <button
                  onClick={() => setBulkPaymentModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1F365D] hover:bg-[#2B4C80] border border-[#2B4C80] text-white text-xs font-medium rounded-lg transition cursor-pointer shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5 text-[#34D399]" />
                  <span>Update Payment</span>
                </button>

                {/* Bulk Move to Trash */}
                <button
                  onClick={() => setBulkDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-200" />
                  <span>Move to Trash ({selectedIds.size})</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#172B4D] font-bold uppercase tracking-wider text-[11px] sm:text-xs select-none">
              {/* Checkbox column - hidden on dashboard */}
              {!isDashboard && (
                <th className="py-2 px-2.5 w-9 text-center">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    title={allPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                    className="w-3.5 h-3.5 rounded text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                  />
                </th>
              )}
              <th className="py-2 px-3">Code</th>
              <th className="py-2 px-3">Company</th>
              <th className="py-2 px-3">WhatsApp / Mobile</th>
              <th className="py-2 px-3">Reference</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3 text-center">Hire Days</th>
              <th className="py-2 px-3">Delivery</th>
              <th className="py-2 px-3">Due Date & Timeline</th>
              <th className="py-2 px-3">Project Status</th>
              <th className="py-2 px-3">Payment</th>
              {!isDashboard && <th className="py-2 px-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EC] text-[#172033]">
            {paginatedProjects.length === 0 ? (
              <tr>
                <td colSpan={isDashboard ? 10 : 12} className="py-10 text-center text-[#475467]">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#98A2B3]" />
                  <p className="text-sm font-semibold text-[#172033]">No projects found</p>
                  <p className="text-xs text-[#667085] mt-0.5">
                    {searchTerm ? 'Try adjusting your search criteria' : 'Create or import your first project'}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedProjects.map((project) => {
                const isSelected = selectedIds.has(project.id);
                const dueStatus = getDueStatus(project.dueDate, project.projectStatus, project.paymentStatus);
                const waUrl = getWhatsAppUrl(
                  project.mobile,
                  `Hello ${project.company}, regarding scaffolding project ${project.projectCode} (Ref: ${project.projectReference})`
                );

                return (
                  <tr
                    key={project.id}
                    onClick={() => onViewProject(project)}
                    className={`transition-colors cursor-pointer group ${
                      !isDashboard && isSelected
                        ? 'bg-[#EFF6FF]/70 hover:bg-[#EFF6FF] border-l-4 border-l-[#2563EB]'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                    title="Click to view project details"
                  >
                    {/* Checkbox - hidden on dashboard */}
                    {!isDashboard && (
                      <td
                        className="py-2 px-2.5 w-9 text-center"
                        onClick={(e) => toggleSelectRow(project.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            // Handled by td onClick
                          }}
                          className="w-3.5 h-3.5 rounded text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                        />
                      </td>
                    )}

                    {/* Project Code */}
                    <td className="py-2 px-3 font-mono font-bold whitespace-nowrap tabular-nums text-xs sm:text-[13px]">
                      <span className="text-[#2563EB] hover:text-[#1D4ED8] group-hover:underline">
                        {project.projectCode}
                      </span>
                    </td>

                    {/* Company */}
                    <td
                      className="py-2 px-3 font-bold text-xs sm:text-[13.5px] text-[#172033] max-w-[200px] truncate tracking-tight"
                      title={
                        (project.companyId && companies.find((c) => c.id === project.companyId)?.companyName) ||
                        project.company
                      }
                    >
                      {(project.companyId && companies.find((c) => c.id === project.companyId)?.companyName) ||
                        project.company}
                    </td>

                    {/* WhatsApp Action Mobile */}
                    <td className="py-2 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {project.mobile ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open WhatsApp chat (does not voice dial)"
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] hover:bg-[#DCFCE7] border border-[#A7F3D0] font-mono text-xs font-semibold transition cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 fill-current text-[#059669]" viewBox="0 0 24 24">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.77.813 2.797.814 3.179 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.769-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.06-2.029-.485-1.571-.643-2.583-2.247-2.662-2.35-.078-.103-.637-.847-.637-1.616 0-.769.403-1.147.547-1.303.144-.155.312-.194.417-.194.103 0 .208.001.298.006.096.005.223-.036.349.266.13.312.443 1.077.482 1.156.039.078.065.17.013.273-.052.104-.078.169-.156.26-.078.091-.163.203-.234.273-.078.078-.16.163-.069.319.091.156.405.669.87 1.082.599.532 1.103.697 1.259.775.156.078.248.065.339-.039.091-.104.391-.456.495-.612.104-.156.208-.13.349-.078.144.052.912.43 1.069.508.156.078.26.117.298.182.039.065.039.378-.105.783z" />
                          </svg>
                          <span>{project.mobile}</span>
                        </a>
                      ) : (
                        <span className="text-[#98A2B3]">-</span>
                      )}
                    </td>

                    {/* Reference */}
                    <td className="py-2 px-3 text-[#344054] font-medium text-xs sm:text-[13px] max-w-[170px] truncate" title={project.projectReference}>
                      {project.projectReference}
                    </td>

                    {/* Scaffolding Type */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          project.scaffoldingType === 'RENTAL'
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                            : 'bg-[#F8FAFC] text-[#344054] border-[#D0D5DD]'
                        }`}
                      >
                        {project.scaffoldingType}
                      </span>
                    </td>

                    {/* Hire Period Days */}
                    <td className="py-2 px-3 text-center tabular-nums">
                      <span className="font-mono font-bold text-xs sm:text-[13px] text-[#172033]">
                        {project.hirePeriodDays}d
                      </span>
                      {project.extensionDays && Number(project.extensionDays) > 0 ? (
                        <span className="block text-[10px] font-semibold text-[#B45309]">
                          (+{project.extensionDays}d ext)
                        </span>
                      ) : null}
                    </td>

                    {/* Delivery Date */}
                    <td className="py-2 px-3 whitespace-nowrap text-[#344054] font-mono text-xs sm:text-[12.5px] font-medium tabular-nums">
                      {formatDateDDMMYYYY(project.deliveryDate)}
                    </td>

                    {/* Due Date & Dynamic Overdue Pill */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs sm:text-[13px] font-bold text-[#172033] tabular-nums">
                          {formatDateDDMMYYYY(project.dueDate)}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold w-fit mt-0.5 ${dueStatus.badgeColorClass}`}
                        >
                          {dueStatus.label}
                        </span>
                      </div>
                    </td>

                    {/* Project Status */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border shadow-xs ${
                          project.projectStatus === 'RETURNED'
                            ? 'bg-[#F8FAFC] text-[#475467] border-[#CBD5E1]'
                            : project.projectStatus === 'ACTIVE'
                            ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                            : project.projectStatus === 'EXTENDED'
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                            : project.projectStatus === 'ON_HOLD'
                            ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                            : 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]'
                        }`}
                      >
                        {project.projectStatus}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border shadow-xs ${
                          project.paymentStatus === 'PAID'
                            ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                            : project.paymentStatus === 'PARTIAL_PAID'
                            ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                            : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                        }`}
                      >
                        {project.paymentStatus === 'PARTIAL_PAID'
                          ? 'PARTIAL'
                          : project.paymentStatus === 'NOT_PAID'
                          ? 'NOT PAID'
                          : 'PAID'}
                      </span>
                    </td>

                    {/* Quick Row Actions - hidden on dashboard */}
                    {!isDashboard && (
                      <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => onViewProject(project)}
                            title="View Details"
                            className="p-1 text-[#475467] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && onEditProject && (
                            <button
                              onClick={() => onEditProject(project)}
                              title="Edit Project"
                              className="p-1 text-[#475467] hover:text-[#B45309] hover:bg-[#FFFBEB] rounded-md transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && onCopyProject && (
                            <button
                              onClick={() => onCopyProject(project)}
                              title="Copy Project"
                              className="p-1 text-[#475467] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && onAddFollowup && (
                            <button
                              onClick={() => onAddFollowup(project)}
                              title="Add Payment Follow-up"
                              className="p-1 text-[#475467] hover:text-[#059669] hover:bg-[#ECFDF5] rounded-md transition-colors cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && onDeleteProject && (
                            <button
                              onClick={() => onDeleteProject(project)}
                              title="Move to Trash"
                              className="p-1 text-[#475467] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer (100 items/page) */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#F8FAFC] border-t border-[#E4E7EC] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-[#475467]">
        <div>
          Showing{' '}
          <span className="font-bold text-[#172B4D] tabular-nums">
            {filteredProjects.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-bold text-[#172B4D] tabular-nums">
            {Math.min(currentPage * pageSize, filteredProjects.length)}
          </span>{' '}
          of <span className="font-bold text-[#172B4D] tabular-nums">{filteredProjects.length}</span> records
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 bg-white border border-[#D0D5DD] rounded-md text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold tabular-nums text-[#172B4D]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 bg-white border border-[#D0D5DD] rounded-md text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bulk Modals (Move to Trash, Status, Payment) - only in non-dashboard views */}
      {!isDashboard && (
        <>
          {/* MODAL 1: Bulk Move to Trash (Delete) Confirmation */}
          {bulkDeleteModalOpen && (
            <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-[#DC2626]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#FEF2F2] rounded-lg border border-[#FECACA]">
                      <Trash2 className="w-5 h-5 text-[#DC2626]" />
                    </div>
                    <h3 className="font-semibold text-[#172033] text-base">
                      Move {selectedIds.size} Projects to Trash?
                    </h3>
                  </div>
                  <button
                    onClick={() => setBulkDeleteModalOpen(false)}
                    className="text-[#667085] hover:text-[#172033] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#475467] leading-relaxed font-normal">
                  You are about to soft-delete <strong className="text-[#172033] font-semibold">{selectedIds.size}</strong> projects.
                  They will be moved to the Trash archive and excluded from active metrics. You can restore them anytime from the Trash tab.
                </p>

                {/* List of projects being deleted */}
                <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded-lg p-3 max-h-40 overflow-y-auto space-y-1 text-xs">
                  <div className="font-semibold text-[#667085] text-[11px] uppercase tracking-wider mb-1">
                    Selected Projects:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProjects.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-[#D0D5DD] text-[#344054] font-mono text-[11px]"
                      >
                        {p.projectCode} <span className="text-[#667085] font-sans ml-1 text-[10px]">({p.company})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                  <button
                    type="button"
                    onClick={() => setBulkDeleteModalOpen(false)}
                    className="px-4 py-2 bg-white border border-[#D0D5DD] text-[#344054] hover:bg-[#F2F4F7] rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkDelete}
                    disabled={processing}
                    className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Moving to Trash...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Move {selectedIds.size} Projects to Trash</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 2: Bulk Update Project Status */}
          {bulkStatusModalOpen && (
            <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-[#2563EB]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#EFF6FF] rounded-lg border border-[#BFDBFE]">
                      <SlidersHorizontal className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <h3 className="font-semibold text-[#172033] text-base">
                      Update Status for {selectedIds.size} Projects
                    </h3>
                  </div>
                  <button
                    onClick={() => setBulkStatusModalOpen(false)}
                    className="text-[#667085] hover:text-[#172033] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#667085] font-normal">
                  Choose the new Project Status to apply across all {selectedIds.size} selected projects.
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#344054]">New Project Status:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ACTIVE', 'EXTENDED', 'RETURNED', 'CLOSED'] as ProjectStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setNewStatus(st)}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                          newStatus === st
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB]'
                            : 'border-[#D0D5DD] bg-white hover:bg-[#F8FAFC] text-[#344054]'
                        }`}
                      >
                        <span>{st}</span>
                        {newStatus === st && <CheckCircle className="w-4 h-4 text-[#2563EB]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {(newStatus === 'RETURNED' || newStatus === 'CLOSED') && (
                  <p className="text-[11px] text-[#475467] bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E4E7EC]">
                    ℹ️ Marking projects as {newStatus} will record today as the Returned Date for equipment tracking.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                  <button
                    type="button"
                    onClick={() => setBulkStatusModalOpen(false)}
                    className="px-4 py-2 bg-white border border-[#D0D5DD] text-[#344054] hover:bg-[#F2F4F7] rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkStatus}
                    disabled={processing}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Apply Status to {selectedIds.size} Projects</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 3: Bulk Update Payment Status */}
          {bulkPaymentModalOpen && (
            <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-[#16A34A]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#F0FDF4] rounded-lg border border-[#BBF7D0]">
                      <DollarSign className="w-5 h-5 text-[#16A34A]" />
                    </div>
                    <h3 className="font-semibold text-[#172033] text-base">
                      Update Payment for {selectedIds.size} Projects
                    </h3>
                  </div>
                  <button
                    onClick={() => setBulkPaymentModalOpen(false)}
                    className="text-[#667085] hover:text-[#172033] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#667085] font-normal">
                  Choose the new Payment Status to apply across all {selectedIds.size} selected projects.
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#344054]">New Payment Status:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['PAID', 'PARTIAL_PAID', 'NOT_PAID'] as PaymentStatus[]).map((pst) => (
                      <button
                        key={pst}
                        type="button"
                        onClick={() => setNewPayment(pst)}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                          newPayment === pst
                            ? 'border-[#16A34A] bg-[#F0FDF4] text-[#16A34A] ring-1 ring-[#16A34A]'
                            : 'border-[#D0D5DD] bg-white hover:bg-[#F8FAFC] text-[#344054]'
                        }`}
                      >
                        <span>
                          {pst === 'PARTIAL_PAID' ? 'PARTIAL' : pst === 'NOT_PAID' ? 'NOT PAID' : 'PAID'}
                        </span>
                        {newPayment === pst && <CheckCircle className="w-4 h-4 text-[#16A34A]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                  <button
                    type="button"
                    onClick={() => setBulkPaymentModalOpen(false)}
                    className="px-4 py-2 bg-white border border-[#D0D5DD] text-[#344054] hover:bg-[#F2F4F7] rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkPayment}
                    disabled={processing}
                    className="px-4 py-2 bg-[#16A34A] hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Apply Payment to {selectedIds.size} Projects</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
