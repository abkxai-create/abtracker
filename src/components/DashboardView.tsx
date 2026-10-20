import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Project, NavigationTab, CollectionPriority } from '../types';
import { calculateDiffDays, formatDateDDMMYYYY } from '../utils/dateUtils';
import { formatAED } from '../utils/commercialUtils';
import { toCompanyCanonicalKey, isCompanyMatch } from '../utils/companyUtils';
import { AnimatedNumber, AnimatedCurrency } from './AnimatedNumber';
import {
  Layers,
  Activity,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  PhoneCall,
  X,
  Clock,
  ArrowUpDown,
  DollarSign,
  Receipt,
  UserCheck,
  Users,
  Building,
  Filter,
  Search,
  ChevronRight,
  AlertCircle,
  Eye,
  Edit2,
  Sparkles,
  Archive,
} from 'lucide-react';

interface DashboardViewProps {
  onViewProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onCopyProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onAddFollowup: (project: Project) => void;
  onAddNewProject: () => void;
  onOpenImport?: () => void;
  onNavigateTab?: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onViewProject,
  onEditProject,
  onCopyProject,
  onDeleteProject,
  onAddFollowup,
  onAddNewProject,
  onNavigateTab,
}) => {
  const {
    projects,
    activeSalespersons,
    salespersons,
    companies,
    payments,
    getProjectFinancials,
    loading,
  } = useProjects();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // -------------------------------------------------------------
  // 1. DASHBOARD QUICK FILTERS (Top Bar)
  // Defaults strictly per requirement:
  // - Salesperson = ALL
  // - Project Status = ACTIVE + EXTENDED
  // - Payment Status = ALL
  // - Company = ALL
  // -------------------------------------------------------------
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('ALL');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<
    'ACTIVE_EXTENDED' | 'ALL' | 'ACTIVE' | 'EXTENDED' | 'CLOSED_RETURNED' | 'ON_HOLD'
  >('ACTIVE_EXTENDED');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<
    'ALL' | 'PENDING' | 'OVERDUE' | 'NOT_PAID' | 'PARTIAL_PAID' | 'PAID'
  >('ALL');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // -------------------------------------------------------------
  // Table Sorting: Default strictly to 'dueDate' ascending (most days due to less days due)
  // -------------------------------------------------------------
  type TableSortField =
    | 'dueDate'
    | 'projectCode'
    | 'company'
    | 'salesperson'
    | 'contractAmount'
    | 'received'
    | 'pending'
    | 'projectStatus';
  const [tableSortField, setTableSortField] = useState<TableSortField>('dueDate');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleToggleTableSort = (field: TableSortField) => {
    if (tableSortField === field) {
      setTableSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortField(field);
      if (field === 'pending' || field === 'contractAmount' || field === 'received') {
        setTableSortDirection('desc');
      } else {
        setTableSortDirection('asc');
      }
    }
  };

  // -------------------------------------------------------------
  // 2. SALESPERSON FILTER DRILLDOWN
  // When a salesperson is selected, every KPI and metric recalculates
  // using ONLY projects assigned to that salesperson.
  // Uses project.salespersonId (NOT current company default).
  // -------------------------------------------------------------
  const salespersonProjects = useMemo(() => {
    if (selectedSalesperson === 'ALL') return projects;
    return projects.filter((p) => p.salespersonId === selectedSalesperson);
  }, [projects, selectedSalesperson]);

  // Unique companies among the salesperson-filtered projects
  const availableCompanies = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => {
      const key = toCompanyCanonicalKey(c.companyName);
      if (key && !map.has(key)) map.set(key, c.companyName);
    });
    salespersonProjects.forEach((p) => {
      if (p.company) {
        const key = toCompanyCanonicalKey(p.company);
        if (key && !map.has(key)) map.set(key, p.company.trim());
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [companies, salespersonProjects]);

  // -------------------------------------------------------------
  // 3. MAIN DASHBOARD KPI CALCULATIONS (Projects, Financial, Collection)
  // All calculated automatically from the existing database.
  // -------------------------------------------------------------
  const dashboardKpi = useMemo(() => {
    let totalProjects = salespersonProjects.length;
    let activeProjects = 0;
    let extendedProjects = 0;
    let closedProjects = 0;

    let totalLpoValue = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let overdueAmount = 0;
    let overdueProjectsCount = 0;
    let dueSoonProjectsCount = 0;

    salespersonProjects.forEach((p) => {
      // Projects count
      if (p.projectStatus === 'ACTIVE') activeProjects++;
      else if (p.projectStatus === 'EXTENDED') extendedProjects++;
      else if (p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED') closedProjects++;

      // Financials
      const fin = getProjectFinancials(p.id);
      totalLpoValue += fin.contractAmount;
      totalReceived += fin.totalReceived;
      totalPending += fin.outstandingAmount;

      // Due Soon (within 7 days)
      if (p.projectStatus !== 'RETURNED' && p.projectStatus !== 'CLOSED' && p.dueDate) {
        const diff = calculateDiffDays(p.dueDate);
        if (diff >= 0 && diff <= 7) {
          dueSoonProjectsCount++;
        }
      }

      // Overdue
      if (fin.isOverdue && fin.outstandingAmount > 0) {
        overdueAmount += fin.outstandingAmount;
        overdueProjectsCount++;
      }
    });

    return {
      totalProjects,
      activeProjects,
      extendedProjects,
      closedProjects,
      dueSoonProjectsCount,
      totalLpoValue,
      totalReceived,
      totalPending,
      overdueAmount,
      overdueProjectsCount,
    };
  }, [salespersonProjects, getProjectFinancials]);


  // -------------------------------------------------------------
  // 5. SALESPERSON SUMMARY TABLE (Operational Visibility for Active Reps)
  // -------------------------------------------------------------
  const salespersonSummaryRows = useMemo(() => {
    return activeSalespersons.map((sp) => {
      const spPrjs = projects.filter((p) => p.salespersonId === sp.id);
      const activePrjs = spPrjs.filter(
        (p) => p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED'
      );

      let lpoValue = 0;
      let received = 0;
      let pending = 0;
      let overdue = 0;

      spPrjs.forEach((p) => {
        const fin = getProjectFinancials(p.id);
        lpoValue += fin.contractAmount;
        received += fin.totalReceived;
        pending += fin.outstandingAmount;
        if (fin.isOverdue && fin.outstandingAmount > 0) {
          overdue += fin.outstandingAmount;
        }
      });

      return {
        salesperson: sp,
        activeProjectsCount: activePrjs.length,
        totalProjectsCount: spPrjs.length,
        lpoValue,
        received,
        pending,
        overdue,
      };
    });
  }, [activeSalespersons, projects, getProjectFinancials]);


  // -------------------------------------------------------------
  // 7. RUNNING PROJECTS TABLE (Defaults to Active + Extended)
  // Filtered by all 4 top filters together!
  // Default sort: Most days due to less days due (urgent/overdue first)
  // -------------------------------------------------------------
  const filteredRunningProjects = useMemo(() => {
    const list = salespersonProjects.filter((p) => {
      // Project Status Filter
      if (selectedProjectStatus === 'ACTIVE_EXTENDED') {
        if (p.projectStatus !== 'ACTIVE' && p.projectStatus !== 'EXTENDED') return false;
      } else if (selectedProjectStatus === 'ACTIVE') {
        if (p.projectStatus !== 'ACTIVE') return false;
      } else if (selectedProjectStatus === 'EXTENDED') {
        if (p.projectStatus !== 'EXTENDED') return false;
      } else if (selectedProjectStatus === 'CLOSED_RETURNED') {
        if (p.projectStatus !== 'RETURNED' && p.projectStatus !== 'CLOSED') return false;
      } else if (selectedProjectStatus === 'ON_HOLD') {
        if (p.projectStatus !== 'ON_HOLD') return false;
      }

      // Company Filter
      if (selectedCompany !== 'ALL') {
        const targetComp = companies.find((c) => c.companyName === selectedCompany);
        const matchesComp =
          (targetComp && p.companyId && p.companyId === targetComp.id) ||
          isCompanyMatch(p.company, selectedCompany, p.mobile, targetComp?.mobile);
        if (!matchesComp) {
          return false;
        }
      }

      // Payment Status Filter
      const fin = getProjectFinancials(p.id);
      if (selectedPaymentStatus === 'PENDING') {
        if (fin.outstandingAmount <= 0) return false;
      } else if (selectedPaymentStatus === 'OVERDUE') {
        if (!fin.isOverdue || fin.outstandingAmount <= 0) return false;
      } else if (selectedPaymentStatus === 'NOT_PAID') {
        if (p.paymentStatus !== 'NOT_PAID') return false;
      } else if (selectedPaymentStatus === 'PARTIAL_PAID') {
        if (p.paymentStatus !== 'PARTIAL_PAID') return false;
      } else if (selectedPaymentStatus === 'PAID') {
        if (p.paymentStatus !== 'PAID') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = p.projectCode.toLowerCase().includes(q);
        const compMatch = p.company.toLowerCase().includes(q);
        const refMatch = p.projectReference.toLowerCase().includes(q);
        const spMatch = p.salespersonName?.toLowerCase().includes(q);
        if (!codeMatch && !compMatch && !refMatch && !spMatch) return false;
      }

      return true;
    });

    // Helper to compute sort score for Due Date (most days due / overdue first)
    const getProjectDueScore = (p: Project) => {
      const fin = getProjectFinancials(p.id);
      let maxOverdueDays = 0;

      // 1. Overdue on payment
      if (fin.isOverdue && fin.outstandingAmount > 0 && fin.daysOverdue > 0) {
        maxOverdueDays = Math.max(maxOverdueDays, fin.daysOverdue);
      }

      // 2. Overdue on rental hire period
      if (p.dueDate && p.projectStatus !== 'RETURNED' && p.projectStatus !== 'CLOSED') {
        const diff = calculateDiffDays(p.dueDate);
        if (diff < 0) {
          maxOverdueDays = Math.max(maxOverdueDays, Math.abs(diff));
        }
      }

      // If overdue, score is negative (e.g. -27 days overdue comes before -20, before -5)
      if (maxOverdueDays > 0) {
        return -maxOverdueDays;
      }

      // If not overdue, score is positive days remaining until due
      if (p.dueDate) {
        return calculateDiffDays(p.dueDate);
      }
      if (p.nextPaymentDueDate) {
        return calculateDiffDays(p.nextPaymentDueDate);
      }

      return 999999;
    };

    return list.sort((a, b) => {
      let comparison = 0;

      if (tableSortField === 'dueDate') {
        const scoreA = getProjectDueScore(a);
        const scoreB = getProjectDueScore(b);
        comparison = scoreA - scoreB;
      } else if (tableSortField === 'projectCode') {
        comparison = a.projectCode.localeCompare(b.projectCode);
      } else if (tableSortField === 'company') {
        comparison = a.company.localeCompare(b.company);
      } else if (tableSortField === 'salesperson') {
        comparison = (a.salespersonName || '').localeCompare(b.salespersonName || '');
      } else if (tableSortField === 'contractAmount') {
        const amtA = getProjectFinancials(a.id).contractAmount;
        const amtB = getProjectFinancials(b.id).contractAmount;
        comparison = amtA - amtB;
      } else if (tableSortField === 'received') {
        const recA = getProjectFinancials(a.id).totalReceived;
        const recB = getProjectFinancials(b.id).totalReceived;
        comparison = recA - recB;
      } else if (tableSortField === 'pending') {
        const penA = getProjectFinancials(a.id).outstandingAmount;
        const penB = getProjectFinancials(b.id).outstandingAmount;
        comparison = penA - penB;
      } else if (tableSortField === 'projectStatus') {
        comparison = a.projectStatus.localeCompare(b.projectStatus);
      }

      // Tie-breaker: sort by due date score, then project code
      if (comparison === 0) {
        const scoreA = getProjectDueScore(a);
        const scoreB = getProjectDueScore(b);
        comparison = scoreA !== scoreB ? scoreA - scoreB : a.projectCode.localeCompare(b.projectCode);
      }

      return tableSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    salespersonProjects,
    selectedProjectStatus,
    selectedCompany,
    selectedPaymentStatus,
    searchQuery,
    getProjectFinancials,
    tableSortField,
    tableSortDirection,
  ]);

  // Check if any non-default filter is applied
  const isFilteredFromDefaults =
    selectedSalesperson !== 'ALL' ||
    selectedProjectStatus !== 'ACTIVE_EXTENDED' ||
    selectedPaymentStatus !== 'ALL' ||
    selectedCompany !== 'ALL' ||
    searchQuery !== '';

  const handleResetFilters = () => {
    setSelectedSalesperson('ALL');
    setSelectedProjectStatus('ACTIVE_EXTENDED');
    setSelectedPaymentStatus('ALL');
    setSelectedCompany('ALL');
    setSearchQuery('');
  };

  // Selected Salesperson Record for Header Accent
  const activeSpRecord = useMemo(() => {
    if (selectedSalesperson === 'ALL') return null;
    return salespersons.find((s) => s.id === selectedSalesperson) || null;
  }, [selectedSalesperson, salespersons]);

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Filter skeleton */}
        <div className="bg-white p-3 rounded-xl border border-[#E4E7EC] shadow-2xs space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-[#F1F5F9] rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-8 bg-[#F1F5F9] rounded-lg animate-pulse" />
        </div>

        {/* 6 KPI Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-3.5 rounded-xl border border-[#E4E7EC] shadow-2xs space-y-2 animate-pulse">
              <div className="h-3 w-16 bg-[#F1F5F9] rounded" />
              <div className="h-6 w-24 bg-[#E2E8F0] rounded" />
              <div className="h-2.5 w-20 bg-[#F1F5F9] rounded" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 space-y-3 shadow-2xs">
          <div className="h-5 w-48 bg-[#F1F5F9] rounded animate-pulse" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* 1. DASHBOARD OPERATIONAL SCOPE & WORKSPACE LINK                */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mr-1">
            Scope:
          </span>

          <button
            type="button"
            onClick={() => {
              setSelectedProjectStatus('ACTIVE_EXTENDED');
              setSelectedPaymentStatus('ALL');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedProjectStatus === 'ACTIVE_EXTENDED' && selectedPaymentStatus === 'ALL'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#475467] hover:bg-[#F1F5F9]'
            }`}
          >
            Running Projects
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPaymentStatus('OVERDUE');
              setSelectedProjectStatus('ALL');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPaymentStatus === 'OVERDUE'
                ? 'bg-[#DC2626] text-white shadow-xs'
                : 'text-[#475467] hover:bg-[#F1F5F9]'
            }`}
          >
            Overdue
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedProjectStatus('ACTIVE');
              setSelectedPaymentStatus('PENDING');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPaymentStatus === 'PENDING'
                ? 'bg-[#D97706] text-white shadow-xs'
                : 'text-[#475467] hover:bg-[#F1F5F9]'
            }`}
          >
            Pending Payments
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedProjectStatus('ALL');
              setSelectedPaymentStatus('ALL');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedProjectStatus === 'ALL' && selectedPaymentStatus === 'ALL'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'text-[#475467] hover:bg-[#F1F5F9]'
            }`}
          >
            All
          </button>
        </div>

        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('projects')}
            className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <span>Open Projects Workspace</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* 2. OPERATIONAL KPI SUMMARY CARDS                              */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
      >
        {/* Card 1: Total Projects */}
        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider truncate">
              Total Projects
            </span>
            <Layers className="w-4 h-4 text-[#64748B]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#0F172A] tabular-nums">
            <AnimatedNumber value={dashboardKpi.totalProjects} />
          </div>
          <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All Registered</span>
        </div>

        {/* Card 2: Running Projects (Active + Extended) */}
        <div className="bg-white p-3.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/20 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider truncate">
              Running
            </span>
            <Activity className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#1D4ED8] tabular-nums">
            <AnimatedNumber value={dashboardKpi.activeProjects + dashboardKpi.extendedProjects} />
          </div>
          <span className="text-[10px] text-[#2563EB] font-medium block mt-0.5 truncate">
            {dashboardKpi.activeProjects} Active • {dashboardKpi.extendedProjects} Extended
          </span>
        </div>

        {/* Card 3: Due Soon */}
        <div className="bg-white p-3.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB]/30 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#D97706] uppercase tracking-wider truncate">
              Due Soon (≤7d)
            </span>
            <Clock className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#D97706] tabular-nums">
            <AnimatedNumber value={dashboardKpi.dueSoonProjectsCount || 0} />
          </div>
          <span className="text-[10px] text-[#B45309] font-medium block mt-0.5">Expiring Rental</span>
        </div>

        {/* Card 4: Overdue */}
        <div className="bg-white p-3.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2]/40 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wider truncate">
              Overdue
            </span>
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#DC2626] tabular-nums">
            <AnimatedNumber value={dashboardKpi.overdueProjectsCount} />
          </div>
          <span className="text-[10px] text-[#B91C1C] font-semibold block mt-0.5 truncate">
            <AnimatedCurrency value={dashboardKpi.overdueAmount} />
          </span>
        </div>

        {/* Card 5: Outstanding Balance */}
        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <span className="text-[10px] font-bold text-[#475467] uppercase tracking-wider block">
            Outstanding
          </span>
          <div className="text-sm sm:text-base font-black text-[#DC2626] tabular-nums block mt-1 truncate">
            <AnimatedCurrency value={dashboardKpi.totalPending} />
          </div>
          <span className="text-[10px] text-[#64748B] font-medium block mt-0.5 truncate">
            Pending Collections
          </span>
        </div>

        {/* Card 6: Returned Archive */}
        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#475467] uppercase tracking-wider truncate">
              Returned
            </span>
            <Archive className="w-4 h-4 text-[#64748B]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#475467] tabular-nums">
            <AnimatedNumber value={dashboardKpi.closedProjects} />
          </div>
          <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">Demobilized Yard</span>
        </div>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* 5. SALESPERSON SUMMARY TABLE (Requirement 11)                   */}
      {/* Operational visibility for active sales reps. Click to filter! */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Active Salespersons Summary</span>
            </h3>
            <p className="text-[11px] text-[#667085]">
              Commercial performance by active account rep. Click any salesperson to isolate their dashboard view.
            </p>
          </div>

          {selectedSalesperson !== 'ALL' && (
            <button
              onClick={() => setSelectedSalesperson('ALL')}
              className="text-xs text-[#2563EB] hover:underline font-semibold cursor-pointer"
            >
              Show All Salespersons
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#475467] font-semibold uppercase text-[10px]">
                <th className="py-2 px-3">Salesperson</th>
                <th className="py-2 px-3 text-center">Active Projects</th>
                <th className="py-2 px-3 text-right">LPO / Contract</th>
                <th className="py-2 px-3 text-right">Received</th>
                <th className="py-2 px-3 text-right font-bold text-[#DC2626]">Pending</th>
                <th className="py-2 px-3 text-right font-bold text-[#B91C1C]">Overdue</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {salespersonSummaryRows.map((row) => {
                const isSelected = selectedSalesperson === row.salesperson.id;
                return (
                  <tr
                    key={row.salesperson.id}
                    onClick={() =>
                      setSelectedSalesperson(isSelected ? 'ALL' : row.salesperson.id)
                    }
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFF6FF] border-l-4 border-l-[#2563EB]'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-[#172033]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                        <span>{row.salesperson.name}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-[#2563EB] text-white px-1.5 py-0.2 rounded font-bold uppercase">
                            Filtered
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-[#2563EB] tabular-nums">
                      {row.activeProjectsCount}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-[#172033] tabular-nums">
                      {formatAED(row.lpoValue)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-[#16A34A] tabular-nums">
                      {formatAED(row.received)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#DC2626] tabular-nums">
                      {formatAED(row.pending)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#B91C1C] tabular-nums">
                      {formatAED(row.overdue)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[11px] font-semibold text-[#2563EB] hover:underline">
                        {isSelected ? 'Reset' : 'Filter →'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>


      {/* ------------------------------------------------------------- */}
      {/* 7. RUNNING PROJECTS TABLE (Requirement 8 & 15)                  */}
      {/* Defaults to Active + Extended, shows running ops & payments     */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#172B4D] flex items-center gap-2 flex-wrap">
              <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>
                Running Projects Register ({filteredRunningProjects.length})
              </span>
              <span className="normal-case font-semibold text-[11px] text-[#1D4ED8] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE] inline-flex items-center gap-1 shadow-2xs">
                <Clock className="w-3 h-3 text-[#2563EB]" />
                <span>
                  {tableSortField === 'dueDate'
                    ? tableSortDirection === 'asc'
                      ? 'Sorted by most days due to less days due'
                      : 'Sorted by furthest due date first'
                    : `Sorted by ${tableSortField}`}
                </span>
              </span>
            </h3>
            <p className="text-[11px] text-[#667085] mt-0.5">
              Operational scaffolding contracts showing current project status, assigned salesperson, and live payment status
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-[#667085]">
              Showing: <strong className="text-[#172033]">{filteredRunningProjects.length}</strong> of{' '}
              {salespersonProjects.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#172B4D] font-bold uppercase tracking-wider text-[11px] select-none">
                <th
                  onClick={() => handleToggleTableSort('projectCode')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Project Number"
                >
                  <div className="flex items-center gap-1">
                    <span>Project</span>
                    {tableSortField === 'projectCode' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleTableSort('company')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Company"
                >
                  <div className="flex items-center gap-1">
                    <span>Company</span>
                    {tableSortField === 'company' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleTableSort('salesperson')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Sales Person"
                >
                  <div className="flex items-center gap-1">
                    <span>Sales Person</span>
                    {tableSortField === 'salesperson' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleTableSort('contractAmount')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Contract Amount"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>LPO / Contract</span>
                    {tableSortField === 'contractAmount' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleTableSort('received')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Total Received"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Received</span>
                    {tableSortField === 'received' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleTableSort('pending')}
                  className="py-2.5 px-3 text-right font-black cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Pending Outstanding Balance"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Pending</span>
                    {tableSortField === 'pending' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th
                  onClick={() => handleToggleTableSort('projectStatus')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  title="Click to sort by Project Status"
                >
                  <div className="flex items-center gap-1">
                    <span>Project Status</span>
                    {tableSortField === 'projectStatus' && (
                      <span className="text-[#2563EB]">{tableSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleTableSort('dueDate')}
                  className={`py-2.5 px-3 cursor-pointer transition-colors select-none ${
                    tableSortField === 'dueDate'
                      ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'hover:bg-[#F1F5F9]'
                  }`}
                  title="Sorted: Most days due to less days due (Click to toggle)"
                >
                  <div className="flex items-center gap-1 font-black">
                    <span>Due Date</span>
                    {tableSortField === 'dueDate' ? (
                      <span className="text-[#2563EB] text-[10px] font-mono font-bold bg-[#DBEAFE] px-1 rounded">
                        {tableSortDirection === 'asc' ? '▲ Most Due' : '▼ Furthest'}
                      </span>
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#98A2B3]" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filteredRunningProjects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#667085]">
                    <Layers className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
                    <p className="font-semibold text-sm text-[#344054]">
                      No projects match the current dashboard filters
                    </p>
                    <p className="text-xs text-[#667085] mt-1">
                      Click "Reset to Default" above to view all running projects
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRunningProjects.map((p) => {
                  const fin = getProjectFinancials(p.id);
                  const isOverdue = fin.isOverdue && fin.outstandingAmount > 0;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onViewProject(p)}
                      className="hover:bg-[#F8FAFC] transition cursor-pointer"
                    >
                      {/* Project Code */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-[#2563EB] text-xs">
                          {p.projectCode}
                        </span>
                        <span className="block text-[10px] text-[#667085] truncate max-w-[130px]">
                          {p.projectReference}
                        </span>
                      </td>

                      {/* Company */}
                      <td className="py-2 px-3 font-semibold text-[#172033] max-w-[170px] truncate">
                        {p.company}
                      </td>

                      {/* Sales Person */}
                      <td className="py-2 px-3 whitespace-nowrap text-[#475467]">
                        <span className="font-medium text-[#172033] block">
                          {p.salespersonName || 'Unassigned'}
                        </span>
                        <span className="text-[9px] text-[#98A2B3]">
                          {p.salespersonAssignmentType === 'MANUALLY_CHANGED'
                            ? 'Manual Override'
                            : 'Auto-Assigned'}
                        </span>
                      </td>

                      {/* LPO / Contract Value */}
                      <td className="py-2 px-3 text-right whitespace-nowrap font-semibold text-[#172033] tabular-nums">
                        {formatAED(fin.contractAmount)}
                      </td>

                      {/* Received */}
                      <td className="py-2 px-3 text-right whitespace-nowrap font-medium text-[#16A34A] tabular-nums">
                        {formatAED(fin.totalReceived)}
                      </td>

                      {/* Pending / Outstanding */}
                      <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums">
                        <span
                          className={`font-black text-xs ${
                            isOverdue
                              ? 'text-[#DC2626]'
                              : fin.outstandingAmount > 0
                              ? 'text-[#B45309]'
                              : 'text-[#16A34A]'
                          }`}
                        >
                          {formatAED(fin.outstandingAmount)}
                        </span>
                        {isOverdue && (
                          <span className="block text-[9px] font-bold text-[#DC2626] uppercase">
                            OVERDUE {fin.daysOverdue}D
                          </span>
                        )}
                      </td>

                      {/* Payment Status Badge */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            fin.paymentStatus === 'PAID'
                              ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                              : fin.paymentStatus === 'PARTIAL_PAID'
                              ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                              : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                          }`}
                        >
                          {fin.paymentStatus.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Project Status Badge */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.projectStatus === 'ACTIVE'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                              : p.projectStatus === 'EXTENDED'
                              ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                              : p.projectStatus === 'RETURNED'
                              ? 'bg-[#F1F5F9] text-[#475467] border border-[#CBD5E1]'
                              : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                          }`}
                        >
                          {p.projectStatus}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-2 px-3 whitespace-nowrap text-[#475467]">
                        <span>{formatDateDDMMYYYY(p.dueDate)}</span>
                        {calculateDiffDays(p.dueDate) < 0 && (
                          <span className="block text-[9px] text-[#DC2626] font-semibold">
                            {Math.abs(calculateDiffDays(p.dueDate))}d overdue
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewProject(p)}
                            title="View Project Details"
                            className="p-1 text-[#667085] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && onEditProject && (
                            <button
                              onClick={() => onEditProject(p)}
                              title="Edit Project"
                              className="p-1 text-[#667085] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
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
      </motion.div>
    </div>
  );
};
