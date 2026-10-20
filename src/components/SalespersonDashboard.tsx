import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { Project } from '../types';
import { formatAED } from '../utils/commercialUtils';
import { formatDateDDMMYYYY, calculateDiffDays } from '../utils/dateUtils';
import { getWhatsAppUrl } from '../utils/whatsapp';
import {
  FolderKanban,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  MessageSquare,
  Search,
  Plus,
  ArrowUpDown,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Check,
  Sparkles,
} from 'lucide-react';

export interface SalespersonDashboardProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onOpenAddModal?: () => void;
}

export const SalespersonDashboard: React.FC<SalespersonDashboardProps> = ({
  onViewProject,
  onEditProject,
  onOpenAddModal,
}) => {
  const { userProfile, currentUser } = useAuth();
  const {
    projects,
    allProjectsEver,
    getProjectFinancials,
    salespersons,
  } = useProjects();

  // Active subtab: 'ACTIVE' (Running/Extended/Overdue) vs 'CLOSED' (Returned/Completed)
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'MOST_OVERDUE_FIRST' | 'SOONEST_DUE_FIRST'>('MOST_OVERDUE_FIRST');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  // Identify assigned salesperson record
  const assignedSalesperson = useMemo(() => {
    if (!userProfile?.salespersonId) return null;
    return salespersons.find((s) => s.id === userProfile.salespersonId) || null;
  }, [salespersons, userProfile?.salespersonId]);

  const salespersonDisplayName =
    userProfile?.salespersonName ||
    assignedSalesperson?.name ||
    userProfile?.name ||
    currentUser?.displayName ||
    'Sales Representative';

  // Partition projects into Active vs Closed
  const { activeProjects, closedProjects } = useMemo(() => {
    const active: Project[] = [];
    const closed: Project[] = [];

    for (const p of projects) {
      if (p.projectStatus === 'RETURNED' || (p as any).projectStatus === 'CLOSED') {
        closed.push(p);
      } else {
        active.push(p);
      }
    }
    return { activeProjects: active, closedProjects: closed };
  }, [projects]);

  // Compute Commercial & Alert Metrics for this salesperson across active projects
  const metrics = useMemo(() => {
    let totalLpo = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    for (const p of activeProjects) {
      const fin = getProjectFinancials(p.id);
      const lpoVal = Number(p.contractAmount || p.lpoAmount || fin.contractAmount || 0);
      totalLpo += lpoVal;
      totalReceived += fin.totalReceived;
      totalOutstanding += fin.outstandingAmount;

      const diff = calculateDiffDays(p.dueDate);
      const isPastDue = diff < 0 && fin.outstandingAmount > 0;
      if (isPastDue || fin.isOverdue) {
        totalOverdue += fin.outstandingAmount;
        overdueCount += 1;
      }
    }

    const collectionRate = totalLpo > 0 ? Math.round((totalReceived / totalLpo) * 100) : 0;

    return {
      totalLpo,
      totalReceived,
      totalOutstanding,
      totalOverdue,
      overdueCount,
      collectionRate,
      activeCount: activeProjects.length,
      closedCount: closedProjects.length,
    };
  }, [activeProjects, closedProjects, getProjectFinancials]);

  // Current working list based on tab
  const currentList = activeTab === 'ACTIVE' ? activeProjects : closedProjects;

  // Filter & Sort projects:
  // Requirement: "all projects below down and sorting by most days due to less days due"
  const displayedProjects = useMemo(() => {
    let list = [...currentList];

    // Quick filter for overdue-only if attention card clicked
    if (filterOverdueOnly && activeTab === 'ACTIVE') {
      list = list.filter((p) => {
        const fin = getProjectFinancials(p.id);
        const diff = calculateDiffDays(p.dueDate);
        return (diff < 0 && fin.outstandingAmount > 0) || fin.isOverdue;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        return (
          (p.projectCode && p.projectCode.toLowerCase().includes(q)) ||
          (p.company && p.company.toLowerCase().includes(q)) ||
          (p.projectReference && p.projectReference.toLowerCase().includes(q)) ||
          (p.scaffoldingType && p.scaffoldingType.toLowerCase().includes(q)) ||
          (p.remarks && p.remarks.toLowerCase().includes(q))
        );
      });
    }

    // Sorting by most days due / overdue down to least days due
    list.sort((a, b) => {
      const diffA = calculateDiffDays(a.dueDate);
      const diffB = calculateDiffDays(b.dueDate);

      if (sortOrder === 'MOST_OVERDUE_FIRST') {
        // diffA < 0 means overdue (e.g. -45 is 45 days overdue).
        // Smallest diff (most negative) comes first!
        // -60 days before -10 days before 0 days before +30 days
        return diffA - diffB;
      } else {
        // Soonest due date first (upcoming first)
        return diffB - diffA;
      }
    });

    return list;
  }, [currentList, searchQuery, sortOrder, filterOverdueOnly, activeTab, getProjectFinancials]);

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Salesperson Executive Greeting & Account Linking Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Commercial Sales Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Sales Representative
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal">
            Assigned Portfolio:{' '}
            <span className="font-semibold text-slate-800">{salespersonDisplayName}</span>
            {userProfile?.salespersonId ? (
              <span className="ml-2 inline-flex items-center text-emerald-600 font-medium">
                <Check className="w-3 h-3 inline mr-0.5" /> ID Linked
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center text-amber-600 font-medium">
                <AlertCircle className="w-3 h-3 inline mr-0.5" /> Pending Profile Linking
              </span>
            )}
            <span className="mx-2 text-slate-300">·</span>
            <span>{metrics.activeCount} active contracts</span>
            <span className="mx-2 text-slate-300">·</span>
            <span>{metrics.closedCount} completed</span>
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2">
          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Unlinked Warning Notice if Admin hasn't connected salespersonId */}
      {!userProfile?.salespersonId && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-900">
              Account Pending Salesperson Linking
            </p>
            <p className="text-amber-700 leading-relaxed">
              Your Google login is approved, but your user profile has not yet been linked to an official Sales Representative profile in System Settings. Please contact the administrator to assign your Salesperson ID so all your historical projects link to this view.
            </p>
          </div>
        </div>
      )}

      {/* 5 Primary Commercial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total LPO Value */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total LPO Value</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatAED(metrics.totalLpo)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Across {metrics.activeCount} active contracts
          </p>
        </div>

        {/* Card 2: Received Payments */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Received</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-700 font-mono tabular-nums">
            {formatAED(metrics.totalReceived)}
          </div>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">
            {metrics.collectionRate}% collected
          </p>
        </div>

        {/* Card 3: Outstanding Balance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Outstanding Balance</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-blue-700 font-mono tabular-nums">
            {formatAED(metrics.totalOutstanding)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Pending client settlement
          </p>
        </div>

        {/* Card 4: Overdue Amount */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Overdue Amount</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-rose-700 font-mono tabular-nums">
            {formatAED(metrics.totalOverdue)}
          </div>
          <p className="mt-1 text-[11px] text-rose-600 font-medium">
            Past due receivables
          </p>
        </div>

        {/* Card 5: Overdue Attention Alert (Confirmed in Clarifications) */}
        <div
          onClick={() => {
            if (metrics.overdueCount > 0) {
              setActiveTab('ACTIVE');
              setFilterOverdueOnly(!filterOverdueOnly);
            }
          }}
          className={`rounded-xl border p-4 shadow-xs transition cursor-pointer select-none ${
            filterOverdueOnly
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
              : metrics.overdueCount > 0
              ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Attention Alert</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                metrics.overdueCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums flex items-baseline gap-1.5">
            <span className={metrics.overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'}>
              {metrics.overdueCount}
            </span>
            <span className="text-xs font-normal text-slate-500">
              {metrics.overdueCount === 1 ? 'project overdue' : 'projects overdue'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium flex items-center gap-1">
            {filterOverdueOnly ? (
              <span className="text-rose-700 font-semibold">Active filter · Click to clear</span>
            ) : metrics.overdueCount > 0 ? (
              <span className="text-amber-800">Click to isolate overdue</span>
            ) : (
              <span className="text-emerald-700">All schedules current</span>
            )}
          </p>
        </div>
      </div>

      {/* Projects Controls & Segmented Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Control: Active Projects vs Closed Projects */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => {
                setActiveTab('ACTIVE');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'ACTIVE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Active Projects</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                {activeProjects.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('CLOSED');
                setFilterOverdueOnly(false);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'CLOSED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Closed Projects</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                {closedProjects.length}
              </span>
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-lg justify-end">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reference, company, project code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Sort Toggle (Default: Most Overdue First) */}
            <button
              onClick={() =>
                setSortOrder(
                  sortOrder === 'MOST_OVERDUE_FIRST'
                    ? 'SOONEST_DUE_FIRST'
                    : 'MOST_OVERDUE_FIRST'
                )
              }
              title="Toggle sorting order"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {sortOrder === 'MOST_OVERDUE_FIRST' ? 'Most Days Overdue' : 'Soonest Due'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Alert Pill if overdue isolation active */}
        {filterOverdueOnly && (
          <div className="flex items-center justify-between p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Showing only overdue active projects requiring immediate commercial follow-up.
            </span>
            <button
              onClick={() => setFilterOverdueOnly(false)}
              className="font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Projects Fleet List */}
      <div className="space-y-3">
        {displayedProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">No Projects Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? `No projects matching "${searchQuery}" in your assigned account list.`
                : activeTab === 'ACTIVE'
                ? 'You do not have any active projects currently assigned. New contracts created or assigned to your salesperson ID will appear here.'
                : 'No closed or completed projects found in your history.'}
            </p>
            {onOpenAddModal && activeTab === 'ACTIVE' && (
              <button
                onClick={onOpenAddModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {displayedProjects.map((project) => {
              const fin = getProjectFinancials(project.id);
              const diffDays = calculateDiffDays(project.dueDate);
              const isOverdue = diffDays < 0 && fin.outstandingAmount > 0;
              const isDueToday = diffDays === 0 && fin.outstandingAmount > 0;
              const isSettled = fin.outstandingAmount <= 0;
              const whatsappUrl = project.mobile ? getWhatsAppUrl(project.mobile) : null;

              return (
                <div
                  key={project.id}
                  className={`bg-white rounded-xl border transition-all duration-150 p-4 shadow-xs hover:border-blue-300 hover:shadow-md ${
                    isOverdue
                      ? 'border-rose-200'
                      : isDueToday
                      ? 'border-amber-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left Details: Code, Reference, Company, Dates */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900 text-sm tracking-tight">
                          {project.projectCode}
                        </span>

                        <span className="text-slate-300 font-light" aria-hidden="true">·</span>

                        <span className="font-semibold text-slate-800 text-sm truncate max-w-[280px]">
                          {project.projectReference || 'Standard Scaffolding'}
                        </span>

                        <span className="text-slate-300 font-light" aria-hidden="true">·</span>

                        <span className="text-slate-500 font-medium flex items-center gap-1 truncate max-w-[220px]">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {project.company || 'Direct Client'}
                        </span>

                        <span className="text-slate-300 font-light" aria-hidden="true">·</span>

                        <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                          {project.scaffoldingType || 'RENTAL'}
                        </span>
                      </div>

                      {/* Timeline & Due Date Urgency indicator */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Delivery: {formatDateDDMMYYYY(project.deliveryDate)}</span>
                        </span>

                        <span className="text-slate-300 font-light" aria-hidden="true">·</span>

                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Due: {formatDateDDMMYYYY(project.dueDate)}</span>
                        </span>

                        <span className="text-slate-300 font-light" aria-hidden="true">·</span>

                        {/* Due Date Status Flag */}
                        {isSettled ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Settled / Fully Paid
                          </span>
                        ) : isOverdue ? (
                          <span className="text-rose-700 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            {Math.abs(diffDays)} days overdue
                          </span>
                        ) : isDueToday ? (
                          <span className="text-amber-700 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Due Today
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium">
                            {diffDays} days remaining
                          </span>
                        )}

                        {project.hirePeriodDays && (
                          <>
                            <span className="text-slate-300 font-light" aria-hidden="true">·</span>
                            <span className="text-slate-500">
                              Duration: {project.hirePeriodDays} days
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle Financial Summary */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 lg:min-w-[340px]">
                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block uppercase tracking-wider">
                          LPO Value
                        </span>
                        <span className="text-xs font-bold text-slate-900 font-mono tabular-nums block mt-0.5">
                          {formatAED(fin.contractAmount)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block uppercase tracking-wider">
                          Received
                        </span>
                        <span className="text-xs font-bold text-emerald-700 font-mono tabular-nums block mt-0.5">
                          {formatAED(fin.totalReceived)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block uppercase tracking-wider">
                          Outstanding
                        </span>
                        <span
                          className={`text-xs font-bold font-mono tabular-nums block mt-0.5 ${
                            fin.outstandingAmount > 0
                              ? isOverdue
                                ? 'text-rose-700'
                                : 'text-blue-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatAED(fin.outstandingAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Right Action Controls */}
                    <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                      {project.mobile && (
                        <>
                          <a
                            href={`tel:${project.mobile}`}
                            title={`Call ${project.mobile}`}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>

                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Chat on WhatsApp"
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      )}

                      {onEditProject && (
                        <button
                          onClick={() => onEditProject(project)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition cursor-pointer"
                        >
                          Edit
                        </button>
                      )}

                      <button
                        onClick={() => onViewProject(project)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
