import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectStatus, PaymentStatus, ScaffoldingType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { formatDateDDMMYYYY, calculateDiffDays, getDueStatus } from '../utils/dateUtils';
import { formatAED } from '../utils/commercialUtils';
import { toCompanyCanonicalKey, isCompanyMatch } from '../utils/companyUtils';
import * as XLSX from 'xlsx';
import {
  Eye,
  Edit2,
  Copy,
  Trash2,
  Download,
  Search,
  Filter,
  X,
  Plus,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  Building,
  UserCheck,
  CreditCard,
  FileSpreadsheet,
  Flame,
  ArrowUpDown,
} from 'lucide-react';

interface ProjectsViewProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onCopyProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  onAddFollowup?: (project: Project) => void;
  onOpenAddModal?: () => void;
  onOpenImport?: () => void;
  initialFilterTab?: 'ALL' | 'RUNNING' | 'DUE_SOON' | 'OVERDUE' | 'RETURNED' | 'CLOSED';
}

type TabKey = 'ALL' | 'RUNNING' | 'DUE_SOON' | 'OVERDUE' | 'RETURNED' | 'CLOSED';

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onViewProject,
  onEditProject,
  onCopyProject,
  onDeleteProject,
  onAddFollowup,
  onOpenAddModal,
  onOpenImport,
  initialFilterTab = 'ALL',
}) => {
  const { userProfile } = useAuth();
  const { projects, salespersons, companies, loading, getProjectFinancials } = useProjects();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // 1. Primary Filter Tab (Default to ALL to show all operational projects immediately)
  const [activeTab, setActiveTab] = useState<TabKey>(initialFilterTab);

  // 2. Secondary Filter Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ScaffoldingType>('ALL');
  const [sortBy, setSortBy] = useState<'dueUrgent' | 'mostDueDays' | 'newest' | 'code' | 'outstanding'>('dueUrgent');
  const isMostDueDaysActive = sortBy === 'mostDueDays';

  // One-Tap Toggle: One click apply, one click remove
  const handleToggleMostDueDays = () => {
    setSortBy((prev) => (prev === 'mostDueDays' ? 'dueUrgent' : 'mostDueDays'));
  };

  // Pagination (100 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Open action menu popover id
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Click outside to close action menu
  useEffect(() => {
    const handleDocClick = () => setActionMenuOpenId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Calculate live tab counts across whole database
  const tabCounts = useMemo(() => {
    let all = projects.length;
    let running = 0;
    let dueSoon = 0;
    let overdue = 0;
    let returned = 0;
    let closed = 0;

    projects.forEach((p) => {
      const fin = getProjectFinancials(p.id);
      const isReturned = p.projectStatus === 'RETURNED';
      const isClosed = p.projectStatus === 'CLOSED';
      const isRunning = p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED';

      if (isRunning) running++;
      if (isReturned) returned++;
      if (isClosed) closed++;

      // Due soon: within next 7 days and not returned/closed
      if (!isReturned && !isClosed && p.dueDate) {
        const diff = calculateDiffDays(p.dueDate);
        if (diff >= 0 && diff <= 7) {
          dueSoon++;
        }
      }

      // Overdue: either rental overdue or payment overdue
      if (fin.isOverdue && fin.outstandingAmount > 0) {
        overdue++;
      } else if (!isReturned && !isClosed && p.dueDate) {
        const diff = calculateDiffDays(p.dueDate);
        if (diff < 0) {
          overdue++;
        }
      }
    });

    return { all, running, dueSoon, overdue, returned, closed };
  }, [projects, getProjectFinancials]);

  const totalActiveContractValue = useMemo(() => {
    return projects
      .filter((p) => p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED')
      .reduce((sum, p) => sum + getProjectFinancials(p.id).totalContractValue, 0);
  }, [projects, getProjectFinancials]);

  // Unique companies list for filter dropdown
  const availableCompanies = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => {
      const key = toCompanyCanonicalKey(c.companyName);
      if (key && !map.has(key)) map.set(key, c.companyName);
    });
    projects.forEach((p) => {
      if (p.company) {
        const key = toCompanyCanonicalKey(p.company);
        if (key && !map.has(key)) map.set(key, p.company.trim());
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [companies, projects]);

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) => {
      const fin = getProjectFinancials(p.id);
      const isReturned = p.projectStatus === 'RETURNED';
      const isClosed = p.projectStatus === 'CLOSED';
      const isRunning = p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED';

      // 1. Primary Tab Condition
      if (activeTab === 'RUNNING' && !isRunning) return false;
      if (activeTab === 'RETURNED' && !isReturned) return false;
      if (activeTab === 'CLOSED' && !isClosed) return false;

      if (activeTab === 'DUE_SOON') {
        if (isReturned || isClosed || !p.dueDate) return false;
        const diff = calculateDiffDays(p.dueDate);
        if (diff < 0 || diff > 7) return false;
      }

      if (activeTab === 'OVERDUE') {
        const isRentalOverdue = !isReturned && !isClosed && p.dueDate && calculateDiffDays(p.dueDate) < 0;
        const isPaymentOverdue = fin.isOverdue && fin.outstandingAmount > 0;
        if (!isRentalOverdue && !isPaymentOverdue) return false;
      }

      // 2. Company Filter
      if (companyFilter !== 'ALL') {
        const targetComp = companies.find((c) => c.companyName === companyFilter);
        const matchesComp =
          (targetComp && p.companyId && p.companyId === targetComp.id) ||
          isCompanyMatch(p.company, companyFilter, p.mobile, targetComp?.mobile);
        if (!matchesComp) return false;
      }

      // 3. Salesperson Filter
      if (salespersonFilter !== 'ALL') {
        if (p.salespersonId !== salespersonFilter) return false;
      }

      // 4. Project Status Filter
      if (statusFilter !== 'ALL') {
        if (p.projectStatus !== statusFilter) return false;
      }

      // 5. Payment Status Filter
      if (paymentFilter !== 'ALL') {
        if (p.paymentStatus !== paymentFilter) return false;
      }

      // 6. Scaffolding Type Filter
      if (typeFilter !== 'ALL') {
        if (p.scaffoldingType !== typeFilter) return false;
      }

      // 6. Local Search Input
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const codeMatch = p.projectCode?.toLowerCase().includes(term);
        const compMatch = p.company?.toLowerCase().includes(term);
        const refMatch = p.projectReference?.toLowerCase().includes(term);
        const spMatch = p.salespersonName?.toLowerCase().includes(term);
        const mobMatch = p.mobile?.includes(term);
        const remMatch = p.remarks?.toLowerCase().includes(term);
        if (!codeMatch && !compMatch && !refMatch && !spMatch && !mobMatch && !remMatch) {
          return false;
        }
      }

      return true;
    });

    // 7. Sorting
    return list.sort((a, b) => {
      if (sortBy === 'mostDueDays') {
        // Sort projects by most days overdue (highest overdue days first: e.g. 100d overdue > 45d > 5d > due today > upcoming)
        const getMostDueDaysScore = (p: Project) => {
          const isFinished = p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED';
          if (!p.dueDate) return isFinished ? -9999999 : -5000000;
          const diff = calculateDiffDays(p.dueDate);
          // diff < 0 means overdue (diff = -45 -> 45 days overdue)
          // overdue projects get 100000 + Math.abs(diff)
          // non-overdue projects (diff >= 0) get 100000 - diff
          const baseScore = diff < 0 ? 100000 + Math.abs(diff) : 100000 - diff;
          return isFinished ? baseScore - 500000 : baseScore;
        };
        const scoreA = getMostDueDaysScore(a);
        const scoreB = getMostDueDaysScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.projectCode.localeCompare(b.projectCode);
      }

      if (sortBy === 'newest') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return b.projectCode.localeCompare(a.projectCode, undefined, { numeric: true });
      }

      if (sortBy === 'code') {
        return a.projectCode.localeCompare(b.projectCode, undefined, { numeric: true });
      }

      if (sortBy === 'outstanding') {
        const outA = getProjectFinancials(a.id).outstandingAmount;
        const outB = getProjectFinancials(b.id).outstandingAmount;
        return outB - outA;
      }

      // Default: 'dueUrgent' (most days overdue or least days remaining first)
      const getScore = (p: Project) => {
        const fin = getProjectFinancials(p.id);
        if (fin.isOverdue && fin.daysOverdue > 0) {
          return -fin.daysOverdue;
        }
        if (p.dueDate && p.projectStatus !== 'RETURNED' && p.projectStatus !== 'CLOSED') {
          const diff = calculateDiffDays(p.dueDate);
          if (diff < 0) return diff;
          return diff;
        }
        return 999999;
      };

      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.projectCode.localeCompare(b.projectCode);
    });
  }, [
    projects,
    activeTab,
    companyFilter,
    salespersonFilter,
    paymentFilter,
    typeFilter,
    searchTerm,
    sortBy,
    getProjectFinancials,
  ]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, companyFilter, salespersonFilter, paymentFilter, typeFilter, searchTerm, sortBy]);

  // Pagination slice
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // Export to Excel / CSV
  const handleExport = (format: 'xlsx' | 'csv') => {
    const exportData = filteredProjects.map((p) => {
      const fin = getProjectFinancials(p.id);
      return {
        'Project Code': p.projectCode,
        Company: p.company,
        Reference: p.projectReference,
        Salesperson: p.salespersonName || 'Unassigned',
        'Scaffolding Type': p.scaffoldingType,
        'Delivery Date': formatDateDDMMYYYY(p.deliveryDate),
        'Due Date': formatDateDDMMYYYY(p.dueDate),
        'Project Status': p.projectStatus,
        'Payment Status': p.paymentStatus,
        'Contract Value (AED)': fin.contractAmount,
        'Received (AED)': fin.totalReceived,
        'Outstanding (AED)': fin.outstandingAmount,
        'Overdue Days': fin.daysOverdue,
        Mobile: p.mobile || '',
        Remarks: p.remarks || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      XLSX.writeFile(wb, `AB_Tracker_Projects_${activeTab}_${timestamp}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `AB_Tracker_Projects_${activeTab}_${timestamp}.xlsx`, { bookType: 'xlsx' });
    }
  };

  const hasActiveFilters =
    companyFilter !== 'ALL' ||
    salespersonFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    searchTerm !== '' ||
    sortBy !== 'dueUrgent';

  const handleResetFilters = () => {
    setCompanyFilter('ALL');
    setSalespersonFilter('ALL');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setTypeFilter('ALL');
    setSearchTerm('');
    setSortBy('dueUrgent');
  };

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-3">
          <div className="h-6 w-48 bg-[#F1F5F9] rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-[#F1F5F9] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-[#F8FAFC] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Header & Primary Tabs */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Projects Workspace
            </h1>
            <p className="text-xs text-[#64748B] font-normal mt-0.5">
              Central operational database for all active, extended, due, and archived contracts
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#334155] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Bulk import projects from CSV or Excel"
              >
                <Download className="w-3.5 h-3.5 rotate-180 text-[#64748B]" />
                <span className="hidden sm:inline">Import Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#334155] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Export filtered projects list to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Export</span>
            </button>

            {isAdmin && onOpenAddModal && (
              <button
                type="button"
                onClick={onOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Salesperson Status & Isolation Banner */}
        {userProfile?.role === 'SALESPERSON' && !userProfile.salespersonId && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Salesperson Profile Pending Link:</span>{' '}
              <span>
                Your Google account is assigned the SALESPERSON role, but has not yet been linked to a specific Salesperson profile. Please request your Administrator to link your profile under Settings & CRM &gt; Users.
              </span>
            </div>
          </div>
        )}

        {userProfile?.role === 'SALESPERSON' && userProfile.salespersonId && (
          <div className="px-3.5 py-2 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="font-medium">
                Viewing assigned projects for salesperson:{' '}
                <strong className="font-semibold text-blue-950">
                  {userProfile.salespersonName || 'You'}
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded font-mono font-semibold">
              {projects.length} Assigned Project{projects.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {/* Compact Operational KPIs Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Running Fleet
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base font-extrabold font-mono text-[#0F172A]">
                {tabCounts.running}
              </span>
              <span className="text-[11px] text-[#64748B]">Active & Extended</span>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#D97706] uppercase tracking-wider block">
              Due Soon (≤7d)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base font-extrabold font-mono text-[#D97706]">
                {tabCounts.dueSoon}
              </span>
              <span className="text-[11px] text-[#64748B]">Due this week</span>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wider block">
              Overdue Attention
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base font-extrabold font-mono text-[#DC2626]">
                {tabCounts.overdue}
              </span>
              <span className="text-[11px] text-[#64748B]">Overdue rentals</span>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
            <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider block">
              Total On Hire
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base font-extrabold font-mono text-[#2563EB]">
                {formatAED(totalActiveContractValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Filter Tabs Bar & One-Tap Most Due Days Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E2E8F0] pb-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'ALL'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>All</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475467]'
                }`}
              >
                {tabCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('RUNNING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'RUNNING'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>Running</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'RUNNING' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475467]'
                }`}
              >
                {tabCounts.running}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DUE_SOON')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'DUE_SOON'
                  ? 'bg-[#D97706] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>Due Soon (≤7d)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'DUE_SOON' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475467]'
                }`}
              >
                {tabCounts.dueSoon}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'OVERDUE'
                  ? 'bg-[#DC2626] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>Overdue</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-[#FEE2E2] text-[#DC2626]'
                }`}
              >
                {tabCounts.overdue}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('RETURNED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'RETURNED'
                  ? 'bg-[#475467] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>Returned</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'RETURNED' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475467]'
                }`}
              >
                {tabCounts.returned}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CLOSED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'CLOSED'
                  ? 'bg-[#64748B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>Closed</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'CLOSED' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475467]'
                }`}
              >
                {tabCounts.closed}
              </span>
            </button>
          </div>

          {/* ONE TAP BUTTON: Sort by Most Due Days (1-Click Apply, 1-Click Remove) */}
          <button
            type="button"
            onClick={handleToggleMostDueDays}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shrink-0 shadow-xs ${
              isMostDueDaysActive
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white ring-2 ring-amber-300 ring-offset-1 shadow-md'
                : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300'
            }`}
            title={isMostDueDaysActive ? 'Click to remove Most Due Days sort' : 'One click sort by most overdue days'}
          >
            <Flame className={`w-3.5 h-3.5 ${isMostDueDaysActive ? 'text-amber-100 animate-pulse' : 'text-amber-500'}`} />
            <span>{isMostDueDaysActive ? 'Most Due Days Active' : 'Sort: Most Due Days'}</span>
            {isMostDueDaysActive ? (
              <span className="px-1.5 py-0.2 bg-black/20 hover:bg-black/30 text-white rounded text-[10px] font-black uppercase">
                ✕ Remove
              </span>
            ) : (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9.5px] font-semibold">
                1-Tap
              </span>
            )}
          </button>
        </div>

        {/* 2. Secondary Filter Row (Compact & Fast) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 pt-1 text-xs">
          {/* Search Input */}
          <div className="relative col-span-2 sm:col-span-1 lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by code, company, LPO..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* Company filter */}
          <div>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Companies</option>
              {availableCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Salesperson filter */}
          <div>
            {userProfile?.role === 'SALESPERSON' ? (
              <div
                className="w-full px-2 py-1.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs font-semibold text-blue-900 truncate"
                title={`Locked to your assigned projects (${userProfile.salespersonName || 'You'})`}
              >
                {userProfile.salespersonName || 'My Projects'}
              </div>
            ) : (
              <select
                value={salespersonFilter}
                onChange={(e) => setSalespersonFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="ALL">All Salespersons</option>
                {salespersons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Project Status filter (only when activeTab is ALL or specific) */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXTENDED">Extended</option>
              <option value="RETURNED">Returned</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Payment filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Payments</option>
              <option value="NOT_PAID">Unpaid (Not Paid)</option>
              <option value="PARTIAL_PAID">Partial Paid</option>
              <option value="PAID">Fully Paid</option>
            </select>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="dueUrgent">Sort: Due Urgency</option>
              <option value="mostDueDays">🔥 Sort: Most Due Days (Overdue)</option>
              <option value="newest">Sort: Newest First</option>
              <option value="code">Sort: Project Code</option>
              <option value="outstanding">Sort: Outstanding AED</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Reset active filters"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Projects Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <span>
            Showing <strong className="text-[#0F172A]">{paginatedProjects.length}</strong> of{' '}
            <strong className="text-[#0F172A]">{filteredProjects.length}</strong> projects
          </span>

          <span className="text-[11px] text-[#94A3B8]">
            Click row to view full project file & commercial history
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475467] font-bold uppercase text-[10px] tracking-wider select-none">
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Reference / LPO</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Delivery</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-[#0F172A] transition-colors select-none group"
                  onClick={handleToggleMostDueDays}
                  title={isMostDueDaysActive ? 'Click to remove Most Due Days sort' : 'Click to sort by most due days (overdue first)'}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Due / Timeline</span>
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 transition-colors ${
                        isMostDueDaysActive
                          ? 'text-amber-600 font-bold'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    {isMostDueDaysActive && (
                      <span className="px-1 py-0.2 bg-amber-500 text-white rounded text-[8.5px] font-black uppercase">
                        Sorted
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Payment / Outstanding</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {paginatedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B]">
                    <Layers className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    {projects.length === 0 ? (
                      <>
                        <p className="font-semibold text-sm text-[#334155]">No projects found.</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          There are currently no projects recorded in the system database.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-sm text-[#334155]">
                          No projects match the current filters.
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          Try adjusting or clearing your search filters to display records.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-3 px-3 py-1.5 bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold rounded-lg hover:bg-[#DBEAFE] transition-colors cursor-pointer"
                          >
                            Clear Filters
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedProjects.map((p) => {
                  const fin = getProjectFinancials(p.id);
                  const dueInfo = getDueStatus(p.dueDate, p.projectStatus);
                  const isRentalOverdue =
                    p.projectStatus !== 'RETURNED' &&
                    p.projectStatus !== 'CLOSED' &&
                    p.dueDate &&
                    calculateDiffDays(p.dueDate) < 0;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onViewProject(p)}
                      className="hover:bg-[#F8FAFC] transition-colors duration-150 cursor-pointer group"
                    >
                      {/* Project Code */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#2563EB] text-xs">
                            {p.projectCode}
                          </span>
                        </div>
                        {p.salespersonName && (
                          <span className="block text-[10px] text-[#94A3B8] truncate max-w-[120px]">
                            {p.salespersonName}
                          </span>
                        )}
                      </td>

                      {/* Company */}
                      <td className="py-2.5 px-3 font-semibold text-[#0F172A] max-w-[160px] truncate">
                        {p.company}
                      </td>

                      {/* Reference */}
                      <td className="py-2.5 px-3 text-[#475467] max-w-[150px] truncate">
                        <span>{p.projectReference || '—'}</span>
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            p.scaffoldingType === 'RENTAL'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                              : 'bg-[#F0FDF4] text-[#15803D]'
                          }`}
                        >
                          {p.scaffoldingType}
                        </span>
                      </td>

                      {/* Delivery Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#64748B]">
                        {formatDateDDMMYYYY(p.deliveryDate)}
                      </td>

                      {/* Due Date & Timeline */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#334155]">{formatDateDDMMYYYY(p.dueDate)}</span>
                          {isRentalOverdue && (
                            <span className="px-1.5 py-0.2 bg-[#FEE2E2] text-[#DC2626] font-bold rounded text-[9px] uppercase tracking-wider">
                              {Math.abs(calculateDiffDays(p.dueDate!))}D Late
                            </span>
                          )}
                          {!isRentalOverdue && p.dueDate && calculateDiffDays(p.dueDate) <= 7 && (
                            <span className="px-1.5 py-0.2 bg-[#FEF3C7] text-[#D97706] font-semibold rounded text-[9px]">
                              {calculateDiffDays(p.dueDate)}d left
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Project Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.projectStatus === 'ACTIVE'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                              : p.projectStatus === 'EXTENDED'
                              ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                              : p.projectStatus === 'RETURNED'
                              ? 'bg-[#F1F5F9] text-[#475467] border-[#E2E8F0]'
                              : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                          }`}
                        >
                          {p.projectStatus}
                        </span>
                      </td>

                      {/* Payment Status & Outstanding */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              p.paymentStatus === 'PAID'
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : p.paymentStatus === 'PARTIAL_PAID'
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'bg-[#FEE2E2] text-[#B91C1C]'
                            }`}
                          >
                            {p.paymentStatus === 'PARTIAL_PAID' ? 'PARTIAL' : p.paymentStatus.replace('_', ' ')}
                          </span>
                        </div>
                        {fin.outstandingAmount > 0 && (
                          <span
                            className={`block text-[11px] font-black mt-0.5 ${
                              fin.isOverdue ? 'text-[#DC2626]' : 'text-[#B45309]'
                            }`}
                          >
                            {formatAED(fin.outstandingAmount)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewProject(p)}
                            className="px-2 py-1 text-[11px] font-bold text-[#2563EB] hover:bg-[#EFF6FF] rounded transition-colors cursor-pointer flex items-center gap-1"
                            title="Open Project File"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {isAdmin && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuOpenId(actionMenuOpenId === p.id ? null : p.id);
                                }}
                                className="p-1 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded transition-colors cursor-pointer"
                                title="More actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {actionMenuOpenId === p.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 z-30 text-left">
                                  {onEditProject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuOpenId(null);
                                        onEditProject(p);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer text-left"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-[#64748B]" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                  {onCopyProject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuOpenId(null);
                                        onCopyProject(p);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer text-left"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                                      <span>Duplicate</span>
                                    </button>
                                  )}
                                  {onDeleteProject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuOpenId(null);
                                        onDeleteProject(p);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-1.5 cursor-pointer text-left"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Move to Trash</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <div>
              Page {currentPage} of {totalPages}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-[#E2E8F0] rounded font-medium hover:bg-[#F1F5F9] transition disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-[#E2E8F0] rounded font-medium hover:bg-[#F1F5F9] transition disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
