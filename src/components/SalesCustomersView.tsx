import React, { useState, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Project, Salesperson, CompanyRecord } from '../types';
import { formatAED } from '../utils/commercialUtils';
import { formatDateDDMMYYYY, calculateDiffDays } from '../utils/dateUtils';
import { isCompanyMatch, toCompanyCanonicalKey } from '../utils/companyUtils';
import {
  Users,
  Briefcase,
  Building,
  UserCheck,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  Edit2,
  UserX,
  UserCheck2,
  DollarSign,
  Receipt,
  Eye,
  AlertCircle,
  X,
  Layers,
  ArrowUpDown,
  Building2,
} from 'lucide-react';

interface SalesCustomersViewProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onCopyProject?: (project: Project) => void;
}

export const SalesCustomersView: React.FC<SalesCustomersViewProps> = ({
  onViewProject,
  onEditProject,
  onCopyProject,
}) => {
  const {
    projects,
    salespersons,
    activeSalespersons,
    companies,
    addSalesperson,
    updateSalesperson,
    deactivateSalesperson,
    addCompany,
    updateCompany,
    checkDuplicateCompany,
    getProjectFinancials,
  } = useProjects();

  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // Sub-tabs: 'dashboard' | 'salespersons' | 'companies'
  const [subTab, setSubTab] = useState<'dashboard' | 'salespersons' | 'companies'>('dashboard');

  // Filters for Dashboard tab
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('ALL');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<string>('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state: Salesperson Add/Edit
  const [spModalOpen, setSpModalOpen] = useState(false);
  const [spModalMode, setSpModalMode] = useState<'add' | 'edit'>('add');
  const [editingSp, setEditingSp] = useState<Salesperson | null>(null);
  const [spName, setSpName] = useState('');
  const [spMobile, setSpMobile] = useState('');
  const [spEmail, setSpEmail] = useState('');
  const [spRemarks, setSpRemarks] = useState('');
  const [spStatus, setSpStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [spSubmitting, setSpSubmitting] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);

  // Toggle Salesperson Confirmation Modal State (replaces window.confirm/alert)
  const [confirmToggleSp, setConfirmToggleSp] = useState<Salesperson | null>(null);
  const [toggleSpSubmitting, setToggleSpSubmitting] = useState(false);
  const [toggleSpError, setToggleSpError] = useState<string | null>(null);

  // Modals state: Company Add/Edit
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compModalMode, setCompModalMode] = useState<'add' | 'edit'>('add');
  const [editingComp, setEditingComp] = useState<CompanyRecord | null>(null);
  const [compName, setCompName] = useState('');
  const [compSalespersonId, setCompSalespersonId] = useState('');
  const [compContactPerson, setCompContactPerson] = useState('');
  const [compMobile, setCompMobile] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compRemarks, setCompRemarks] = useState('');
  const [compSubmitting, setCompSubmitting] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  // Real-time duplicate check when adding/editing company
  const duplicateCheck = useMemo(() => {
    if (!compName.trim()) return { isDuplicate: false, match: undefined, similarity: 0 };
    // Exclude current company if editing
    const otherCompanies = compModalMode === 'edit' && editingComp
      ? companies.filter((c) => c.id !== editingComp.id)
      : companies;
    return checkDuplicateCompany(compName.trim());
  }, [compName, compModalMode, editingComp, companies, checkDuplicateCompany]);

  // Unique companies from projects & company master for filter dropdown
  const allCompanyNames = useMemo(() => {
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

  // Selected Salesperson Record
  const activeSelectedSalesperson = useMemo(() => {
    if (selectedSalespersonId === 'ALL') return null;
    return salespersons.find((s) => s.id === selectedSalespersonId) || null;
  }, [selectedSalespersonId, salespersons]);

  // Filtered Projects for the Salesperson Dashboard
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // 1. Salesperson filter
      if (selectedSalespersonId !== 'ALL') {
        if (p.salespersonId !== selectedSalespersonId) return false;
      }
      // 2. Company filter
      if (selectedCompanyFilter !== 'ALL') {
        const targetComp = companies.find((c) => c.companyName === selectedCompanyFilter);
        const matchesComp =
          (targetComp && p.companyId && p.companyId === targetComp.id) ||
          isCompanyMatch(p.company, selectedCompanyFilter, p.mobile, targetComp?.mobile);
        if (!matchesComp) {
          return false;
        }
      }
      // 3. Project Status filter
      if (selectedProjectStatus !== 'ALL') {
        if (p.projectStatus !== selectedProjectStatus) return false;
      }
      // 4. Payment Status filter
      if (selectedPaymentStatus !== 'ALL') {
        if (p.paymentStatus !== selectedPaymentStatus) return false;
      }
      // 5. Search query (Project code, company, reference, qtn, lpo)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const codeMatch = p.projectCode?.toLowerCase().includes(query);
        const compMatch = p.company?.toLowerCase().includes(query);
        const refMatch = p.projectReference?.toLowerCase().includes(query);
        const qtnMatch = p.qtnNumber?.toLowerCase().includes(query);
        const lpoMatch = p.lpoNumber?.toLowerCase().includes(query);
        const spMatch = p.salespersonName?.toLowerCase().includes(query);
        if (!codeMatch && !compMatch && !refMatch && !qtnMatch && !lpoMatch && !spMatch) {
          return false;
        }
      }
      return true;
    });
  }, [
    projects,
    selectedSalespersonId,
    selectedCompanyFilter,
    selectedProjectStatus,
    selectedPaymentStatus,
    searchQuery,
  ]);

  // Financial calculations for the currently filtered set of projects
  const dashboardMetrics = useMemo(() => {
    let totalContractValue = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let activeProjects = 0;
    let extendedProjects = 0;
    let closedProjects = 0;

    filteredProjects.forEach((p) => {
      const fin = getProjectFinancials(p.id);
      totalContractValue += fin.contractAmount;
      totalReceived += fin.totalReceived;
      totalOutstanding += fin.outstandingAmount;

      if (fin.isOverdue && fin.outstandingAmount > 0) {
        overdueAmount += fin.outstandingAmount;
        overdueCount++;
      }

      if (p.projectStatus === 'ACTIVE') activeProjects++;
      else if (p.projectStatus === 'EXTENDED') extendedProjects++;
      else if (p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED') closedProjects++;
    });

    return {
      totalProjects: filteredProjects.length,
      activeProjects,
      extendedProjects,
      closedProjects,
      totalContractValue,
      totalReceived,
      totalOutstanding,
      overdueAmount,
      overdueCount,
    };
  }, [filteredProjects, getProjectFinancials]);

  // Handlers for Salesperson Modal
  const handleOpenAddSp = () => {
    setEditingSp(null);
    setSpModalMode('add');
    setSpName('');
    setSpMobile('');
    setSpEmail('');
    setSpRemarks('');
    setSpStatus('ACTIVE');
    setSpError(null);
    setSpModalOpen(true);
  };

  const handleOpenEditSp = (sp: Salesperson) => {
    setEditingSp(sp);
    setSpModalMode('edit');
    setSpName(sp.name);
    setSpMobile(sp.mobile);
    setSpEmail(sp.email);
    setSpRemarks(sp.remarks || '');
    setSpStatus(sp.status);
    setSpError(null);
    setSpModalOpen(true);
  };

  const handleSaveSp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spName.trim()) {
      setSpError('Salesperson name is required');
      return;
    }
    setSpSubmitting(true);
    setSpError(null);
    try {
      if (spModalMode === 'add') {
        await addSalesperson({
          name: spName.trim(),
          mobile: spMobile.trim(),
          email: spEmail.trim(),
          status: spStatus,
          remarks: spRemarks.trim(),
        });
      } else if (editingSp) {
        await updateSalesperson(editingSp.id, {
          name: spName.trim(),
          mobile: spMobile.trim(),
          email: spEmail.trim(),
          status: spStatus,
          remarks: spRemarks.trim(),
        });
      }
      setSpModalOpen(false);
    } catch (err: any) {
      setSpError(err.message || 'Failed to save salesperson');
    } finally {
      setSpSubmitting(false);
    }
  };

  const handleToggleSpStatus = (sp: Salesperson) => {
    if (!isAdmin) return;
    setConfirmToggleSp(sp);
    setToggleSpError(null);
  };

  const handleExecuteToggleSpStatus = async () => {
    if (!confirmToggleSp || !isAdmin) return;
    const newStatus = confirmToggleSp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setToggleSpSubmitting(true);
    setToggleSpError(null);
    try {
      await updateSalesperson(confirmToggleSp.id, { status: newStatus });
      setConfirmToggleSp(null);
    } catch (err: any) {
      setToggleSpError(err.message || 'Failed to update status');
    } finally {
      setToggleSpSubmitting(false);
    }
  };

  // Handlers for Company Modal
  const handleOpenAddCompany = () => {
    setEditingComp(null);
    setCompModalMode('add');
    setCompName('');
    setCompSalespersonId(activeSalespersons[0]?.id || '');
    setCompContactPerson('');
    setCompMobile('');
    setCompEmail('');
    setCompRemarks('');
    setCompError(null);
    setCompModalOpen(true);
  };

  const handleOpenEditCompany = (comp: CompanyRecord) => {
    setEditingComp(comp);
    setCompModalMode('edit');
    setCompName(comp.companyName);
    setCompSalespersonId(comp.defaultSalespersonId);
    setCompContactPerson(comp.contactPerson || '');
    setCompMobile(comp.mobile || '');
    setCompEmail(comp.email || '');
    setCompRemarks(comp.remarks || '');
    setCompError(null);
    setCompModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) {
      setCompError('Company name is required');
      return;
    }
    if (!compSalespersonId) {
      setCompError('Please assign a default salesperson for this company');
      return;
    }

    const assignedSp = salespersons.find((s) => s.id === compSalespersonId);
    const spName = assignedSp ? assignedSp.name : 'Unknown';

    setCompSubmitting(true);
    setCompError(null);
    try {
      if (compModalMode === 'add') {
        await addCompany({
          companyName: compName.trim(),
          defaultSalespersonId: compSalespersonId,
          defaultSalespersonName: spName,
          contactPerson: compContactPerson.trim(),
          mobile: compMobile.trim(),
          email: compEmail.trim(),
          remarks: compRemarks.trim(),
        });
      } else if (editingComp) {
        await updateCompany(editingComp.id, {
          companyName: compName.trim(),
          defaultSalespersonId: compSalespersonId,
          defaultSalespersonName: spName,
          contactPerson: compContactPerson.trim(),
          mobile: compMobile.trim(),
          email: compEmail.trim(),
          remarks: compRemarks.trim(),
        });
      }
      setCompModalOpen(false);
    } catch (err: any) {
      setCompError(err.message || 'Failed to save company');
    } finally {
      setCompSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Sub-Tab Bar (Unified Clean Structure) */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB]" />
              <span>Sales & Customer Ownership</span>
            </h1>
            <p className="text-xs text-[#64748B] font-normal mt-0.5">
              Manage sales representatives, company customer ownership, and commercial project performance
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenAddSp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Add Salesperson</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddCompany}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Add Company Customer</span>
            </button>
          </div>
        </div>

        {/* Primary Sub-Tabs Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#E2E8F0] pt-3 scrollbar-none">
          <button
            type="button"
            onClick={() => setSubTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'dashboard'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sales Dashboard & Projects</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                subTab === 'dashboard' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {filteredProjects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('salespersons')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'salespersons'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Salesperson Master</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                subTab === 'salespersons' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {salespersons.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('companies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'companies'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Company Ownership</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                subTab === 'companies' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {companies.length}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: SALESPERSON DASHBOARD & PROJECT LIST                */}
      {/* ============================================================== */}
      {subTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Active Salesperson Focus Card (when specific SP selected) */}
          {activeSelectedSalesperson && (
            <div className="p-4 bg-gradient-to-r from-[#172B4D] to-[#1E3A8A] text-white rounded-xl shadow-md border border-[#20365B] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg text-white ring-1 ring-white/20">
                  {activeSelectedSalesperson.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#2563EB] text-white">
                      SALESPERSON
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {activeSelectedSalesperson.name}
                    </h2>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-3">
                    {activeSelectedSalesperson.mobile && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#38BDF8]" />
                        {activeSelectedSalesperson.mobile}
                      </span>
                    )}
                    {activeSelectedSalesperson.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#38BDF8]" />
                        {activeSelectedSalesperson.email}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Quick Summary Pill on Banner */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-[#94A3B8] block text-[10px] uppercase">Active Projects</span>
                  <span className="font-bold text-white text-sm">{dashboardMetrics.activeProjects}</span>
                </div>
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-[#94A3B8] block text-[10px] uppercase">Contract Value</span>
                  <span className="font-bold text-white text-sm">{formatAED(dashboardMetrics.totalContractValue)}</span>
                </div>
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-[#94A3B8] block text-[10px] uppercase">Received</span>
                  <span className="font-bold text-[#86EFAC] text-sm">{formatAED(dashboardMetrics.totalReceived)}</span>
                </div>
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-[#94A3B8] block text-[10px] uppercase">Outstanding</span>
                  <span className="font-bold text-[#FDE047] text-sm">{formatAED(dashboardMetrics.totalOutstanding)}</span>
                </div>
                <div className="bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/30">
                  <span className="text-rose-200 block text-[10px] uppercase">Overdue</span>
                  <span className="font-bold text-[#FCA5A5] text-sm">{formatAED(dashboardMetrics.overdueAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Total Projects */}
            <div className="bg-white p-3.5 rounded-xl border border-[#E4E7EC] shadow-2xs">
              <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide block">
                Total Projects
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-bold text-[#172033] tabular-nums">
                  {dashboardMetrics.totalProjects}
                </span>
                <span className="text-[11px] text-[#667085] font-medium">
                  {dashboardMetrics.activeProjects} Active
                </span>
              </div>
            </div>

            {/* 2. Total Contract Value */}
            <div className="bg-white p-3.5 rounded-xl border border-[#E4E7EC] shadow-2xs">
              <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide block">
                Contract Value
              </span>
              <div className="mt-1">
                <span className="text-lg sm:text-xl font-bold text-[#172033] tabular-nums truncate block">
                  {formatAED(dashboardMetrics.totalContractValue)}
                </span>
              </div>
            </div>

            {/* 3. Total Received */}
            <div className="bg-white p-3.5 rounded-xl border border-[#E4E7EC] shadow-2xs">
              <span className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wide block">
                Total Received
              </span>
              <div className="mt-1">
                <span className="text-lg sm:text-xl font-bold text-[#16A34A] tabular-nums truncate block">
                  {formatAED(dashboardMetrics.totalReceived)}
                </span>
              </div>
            </div>

            {/* 4. Total Outstanding & Overdue */}
            <div className="bg-white p-3.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2]/30 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#DC2626] uppercase tracking-wide">
                  Outstanding
                </span>
                {dashboardMetrics.overdueCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#DC2626] text-white">
                    {dashboardMetrics.overdueCount} Overdue
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-lg sm:text-xl font-bold text-[#DC2626] tabular-nums truncate block">
                  {formatAED(dashboardMetrics.totalOutstanding)}
                </span>
                <span className="text-[10px] text-[#B91C1C] font-semibold block mt-0.5">
                  Overdue: {formatAED(dashboardMetrics.overdueAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-[#E4E7EC] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Salesperson Filter */}
              <div className="flex items-center gap-1.5 min-w-[170px]">
                <UserCheck className="w-3.5 h-3.5 text-[#667085]" />
                <select
                  value={selectedSalespersonId}
                  onChange={(e) => setSelectedSalespersonId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="ALL">All Sales Persons ({salespersons.length})</option>
                  {salespersons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === 'INACTIVE' ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div className="flex items-center gap-1.5 min-w-[170px]">
                <Building className="w-3.5 h-3.5 text-[#667085]" />
                <select
                  value={selectedCompanyFilter}
                  onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="ALL">All Companies</option>
                  {allCompanyNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Status Filter */}
              <select
                value={selectedProjectStatus}
                onChange={(e) => setSelectedProjectStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="ALL">All Project Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="EXTENDED">Extended</option>
                <option value="RETURNED">Returned</option>
                <option value="CLOSED">Closed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>

              {/* Payment Status Filter */}
              <select
                value={selectedPaymentStatus}
                onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="NOT_PAID">Not Paid</option>
                <option value="PARTIAL_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>

              {/* Reset Filters button */}
              {(selectedSalespersonId !== 'ALL' ||
                selectedCompanyFilter !== 'ALL' ||
                selectedProjectStatus !== 'ALL' ||
                selectedPaymentStatus !== 'ALL' ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedSalespersonId('ALL');
                    setSelectedCompanyFilter('ALL');
                    setSelectedProjectStatus('ALL');
                    setSelectedPaymentStatus('ALL');
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PRJ, QTN, LPO..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg text-xs font-normal text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          {/* Salesperson Project List Table */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#172B4D] font-bold uppercase tracking-wider text-[11px] select-none">
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Sales Person</th>
                    <th className="py-2.5 px-3">QTN / LPO</th>
                    <th className="py-2.5 px-3 text-right">Project Value</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Payment Status</th>
                    <th className="py-2.5 px-3">Project Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-[#667085]">
                        <UserCheck className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
                        <p className="font-semibold text-sm text-[#344054]">No projects match your filter criteria</p>
                        <p className="text-xs text-[#667085] mt-1">
                          Try changing the salesperson filter, company, or search query
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => {
                      const fin = getProjectFinancials(p.id);
                      const isOverdue = fin.isOverdue && fin.outstandingAmount > 0;
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                          onClick={() => onViewProject(p)}
                        >
                          {/* Project Code */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-[#2563EB] text-xs">
                              {p.projectCode}
                            </span>
                            <span className="block text-[10px] text-[#667085] font-normal truncate max-w-[130px]">
                              {p.projectReference}
                            </span>
                          </td>

                          {/* Company */}
                          <td className="py-2 px-3">
                            <span className="font-semibold text-[#172033] block truncate max-w-[160px]">
                              {p.company}
                            </span>
                            {p.mobile && (
                              <span className="text-[10px] text-[#667085] font-mono block">
                                {p.mobile}
                              </span>
                            )}
                          </td>

                          {/* Sales Person */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[#172033]">
                                {p.salespersonName || 'Unassigned'}
                              </span>
                              {p.salespersonAssignmentType === 'AUTO_ASSIGNED' ? (
                                <span
                                  title="Auto-assigned based on Company default salesperson"
                                  className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"
                                >
                                  Auto
                                </span>
                              ) : p.salespersonAssignmentType === 'MANUALLY_CHANGED' ? (
                                <span
                                  title="Manually changed on this project"
                                  className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]"
                                >
                                  Manual
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* QTN / LPO */}
                          <td className="py-2 px-3 whitespace-nowrap text-[11px] font-mono text-[#475467]">
                            <div>QTN: {p.qtnNumber || '—'}</div>
                            <div>LPO: {p.lpoNumber || '—'}</div>
                          </td>

                          {/* Project Value */}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-semibold text-[#172033] tabular-nums">
                            {formatAED(fin.contractAmount)}
                          </td>

                          {/* Received */}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-medium text-[#16A34A] tabular-nums">
                            {formatAED(fin.totalReceived)}
                          </td>

                          {/* Outstanding */}
                          <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums">
                            <span
                              className={`font-bold ${
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

                          {/* Due Date */}
                          <td className="py-2 px-3 whitespace-nowrap text-[#475467] font-medium">
                            {formatDateDDMMYYYY(p.dueDate)}
                          </td>

                          {/* Payment Status */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                p.paymentStatus === 'PAID'
                                  ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                                  : p.paymentStatus === 'PARTIAL_PAID'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                  : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                              }`}
                            >
                              {p.paymentStatus.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Project Status */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                p.projectStatus === 'ACTIVE'
                                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                                  : p.projectStatus === 'EXTENDED'
                                  ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                                  : p.projectStatus === 'RETURNED'
                                  ? 'bg-[#F1F5F9] text-[#475467] border border-[#CBD5E1]'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                              }`}
                            >
                              {p.projectStatus}
                            </span>
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
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: SALESPERSON MASTER                                  */}
      {/* ============================================================== */}
      {subTab === 'salespersons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-base font-bold text-[#172033]">Salesperson Directory</h2>
              <p className="text-xs text-[#667085]">
                Corporate sales reps responsible for accounts. Deactivating retains all historical project ownership.
              </p>
            </div>
            <button
              onClick={handleOpenAddSp}
              className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Salesperson</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salespersons.map((sp) => {
              const spProjects = projects.filter((p) => p.salespersonId === sp.id);
              const spCompanies = companies.filter((c) => c.defaultSalespersonId === sp.id);
              const activeCount = spProjects.filter((p) => p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED').length;
              const totalOut = spProjects.reduce(
                (sum, p) => sum + getProjectFinancials(p.id).outstandingAmount,
                0
              );

              return (
                <div
                  key={sp.id}
                  className={`bg-white rounded-xl border p-4 shadow-2xs space-y-3 transition ${
                    sp.status === 'INACTIVE'
                      ? 'border-[#E4E7EC] opacity-75 bg-[#F8FAFC]'
                      : 'border-[#E4E7EC] hover:border-[#2563EB]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-sm ring-1 ring-[#BFDBFE]">
                        {sp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#172033] leading-tight">{sp.name}</h3>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                            sp.status === 'ACTIVE'
                              ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                              : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                          }`}
                        >
                          {sp.status}
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditSp(sp)}
                          title="Edit Salesperson"
                          className="p-1.5 text-[#667085] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleSpStatus(sp)}
                          title={sp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            sp.status === 'ACTIVE'
                              ? 'text-[#667085] hover:text-[#DC2626] hover:bg-[#FEF2F2]'
                              : 'text-[#667085] hover:text-[#16A34A] hover:bg-[#F0FDF4]'
                          }`}
                        >
                          {sp.status === 'ACTIVE' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contact details */}
                  <div className="text-xs space-y-1 text-[#475467] pt-1 border-t border-[#F2F4F7]">
                    {sp.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-[#98A2B3]" />
                        <span className="font-mono">{sp.mobile}</span>
                      </div>
                    )}
                    {sp.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-[#98A2B3]" />
                        <span className="truncate">{sp.email}</span>
                      </div>
                    )}
                    {sp.remarks && (
                      <p className="text-[11px] text-[#667085] italic pt-1">{sp.remarks}</p>
                    )}
                  </div>

                  {/* KPI summary */}
                  <div className="pt-2 border-t border-[#F2F4F7] grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-[#F8FAFC] p-1.5 rounded-lg">
                      <span className="text-[10px] text-[#667085] block">Companies</span>
                      <span className="font-bold text-[#172033]">{spCompanies.length}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-1.5 rounded-lg">
                      <span className="text-[10px] text-[#667085] block">Active Prj</span>
                      <span className="font-bold text-[#2563EB]">{activeCount}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-1.5 rounded-lg">
                      <span className="text-[10px] text-[#667085] block">Outstanding</span>
                      <span
                        className={`font-bold text-[11px] ${
                          totalOut > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                        }`}
                      >
                        {formatAED(totalOut)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedSalespersonId(sp.id);
                      setSubTab('dashboard');
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition cursor-pointer"
                  >
                    View Sales Projects →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: COMPANY MASTER & OWNERSHIP                          */}
      {/* ============================================================== */}
      {subTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h2 className="text-base font-bold text-[#172033]">Company Customer Master</h2>
              <p className="text-xs text-[#667085]">
                Assigning a salesperson to a company automatically links it across all its projects, unless manually customized on the project page.
              </p>
            </div>
            <button
              onClick={handleOpenAddCompany}
              className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Company Customer</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#172B4D] font-bold uppercase tracking-wider text-[11px] select-none">
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">Assigned Sales Person</th>
                    <th className="py-2.5 px-3">Contact Person</th>
                    <th className="py-2.5 px-3">Mobile & Email</th>
                    <th className="py-2.5 px-3 text-center">Total Projects</th>
                    <th className="py-2.5 px-3 text-right">Outstanding (AED)</th>
                    <th className="py-2.5 px-3">Remarks</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {companies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#667085]">
                        <Building className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
                        <p className="font-semibold text-sm text-[#344054]">No companies registered in master yet</p>
                        <p className="text-xs text-[#667085] mt-1">
                          Click "Add New Company Customer" to register your first client
                        </p>
                      </td>
                    </tr>
                  ) : (
                    companies.map((c) => {
                      const compProjects = projects.filter(
                        (p) =>
                          (p.companyId && p.companyId === c.id) ||
                          isCompanyMatch(p.company, c.companyName, p.mobile, c.mobile)
                      );
                      const totalOutstanding = compProjects.reduce(
                        (sum, p) => sum + getProjectFinancials(p.id).outstandingAmount,
                        0
                      );

                      return (
                        <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                          {/* Company Name */}
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#172033] block text-xs">
                              {c.companyName}
                            </span>
                          </td>

                          {/* Default Sales Person */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                              <UserCheck className="w-3 h-3 text-[#2563EB]" />
                              <span>{c.defaultSalespersonName}</span>
                            </span>
                          </td>

                          {/* Contact Person */}
                          <td className="py-2.5 px-3 text-[#475467] font-medium">
                            {c.contactPerson || '—'}
                          </td>

                          {/* Mobile & Email */}
                          <td className="py-2.5 px-3 text-[11px] font-mono text-[#475467]">
                            <div>{c.mobile || '—'}</div>
                            <div className="text-[#667085] font-sans">{c.email || ''}</div>
                          </td>

                          {/* Projects Count */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedCompanyFilter(c.companyName);
                                setSubTab('dashboard');
                              }}
                              className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F2F4F7] text-[#344054] hover:bg-[#E4E7EC] transition cursor-pointer"
                            >
                              {compProjects.length} Projects
                            </button>
                          </td>

                          {/* Outstanding */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums font-bold">
                            <span
                              className={
                                totalOutstanding > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                              }
                            >
                              {formatAED(totalOutstanding)}
                            </span>
                          </td>

                          {/* Remarks */}
                          <td className="py-2.5 px-3 text-[11px] text-[#667085] max-w-[200px] truncate">
                            {c.remarks || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditCompany(c)}
                                title="Edit Company Details & Salesperson"
                                className="p-1 text-[#667085] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
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
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ADD / EDIT SALESPERSON                                */}
      {/* ============================================================== */}
      {spModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#172033]">
                  {spModalMode === 'add' ? 'Add New Salesperson' : 'Edit Salesperson Details'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Corporate accounts manager or commercial sales executive
                </p>
              </div>
              <button
                onClick={() => setSpModalOpen(false)}
                className="text-[#667085] hover:text-[#172033] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {spError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626] text-xs font-semibold">
                {spError}
              </div>
            )}

            <form onSubmit={handleSaveSp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Sales Person Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={spName}
                  onChange={(e) => setSpName(e.target.value)}
                  placeholder="e.g. Ahmed Al Mansoori"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={spMobile}
                  onChange={(e) => setSpMobile(e.target.value)}
                  placeholder="e.g. +971 50 123 4567"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={spEmail}
                  onChange={(e) => setSpEmail(e.target.value)}
                  placeholder="e.g. ahmed@abscaffolding.ae"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">Status</label>
                <select
                  value={spStatus}
                  onChange={(e) => setSpStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive (Deactivated)</option>
                </select>
                <p className="text-[10px] text-[#667085] mt-1">
                  Inactive salespersons are hidden from new project assignment, but historical records retain them.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Remarks / Region / Notes
                </label>
                <textarea
                  rows={2}
                  value={spRemarks}
                  onChange={(e) => setSpRemarks(e.target.value)}
                  placeholder="e.g. Northern Emirates & Industrial projects"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                <button
                  type="button"
                  onClick={() => setSpModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spSubmitting}
                  className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {spSubmitting ? 'Saving...' : spModalMode === 'add' ? 'Add Salesperson' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD / EDIT COMPANY (WITH DUPLICATE WARNING)           */}
      {/* ============================================================== */}
      {compModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#172033]">
                  {compModalMode === 'add' ? 'Add New Company Customer' : 'Edit Company Ownership'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Link customer to a responsible default Salesperson
                </p>
              </div>
              <button
                onClick={() => setCompModalOpen(false)}
                className="text-[#667085] hover:text-[#172033] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DUPLICATE DETECTION ALERT BANNER */}
            {duplicateCheck.isDuplicate && duplicateCheck.match && (
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#B45309] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                  <span>Possible Duplicate Company Detected!</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#92400E]">
                  A similar company already exists in the system:{' '}
                  <strong className="font-bold underline text-[#78350F]">
                    {duplicateCheck.match.companyName}
                  </strong>{' '}
                  (Default Sales Person:{' '}
                  <strong className="font-bold">{duplicateCheck.match.defaultSalespersonName}</strong>).
                  <br />
                  Please avoid creating duplicate spelling variations (such as LLC vs L.L.C.) to keep company records consolidated.
                </p>
              </div>
            )}

            {compError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626] text-xs font-semibold">
                {compError}
              </div>
            )}

            <form onSubmit={handleSaveCompany} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Company Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="e.g. ABC Contracting LLC"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Assigned Default Sales Person <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  required
                  value={compSalespersonId}
                  onChange={(e) => setCompSalespersonId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="">Select Sales Person...</option>
                  {salespersons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === 'INACTIVE' ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#2563EB] font-medium mt-1">
                  ⚡ Assigning a salesperson here will automatically update all projects for this company, unless an individual project was manually changed from its project page.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#344054] mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={compContactPerson}
                    onChange={(e) => setCompContactPerson(e.target.value)}
                    placeholder="e.g. Eng. Tariq"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#344054] mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={compMobile}
                    onChange={(e) => setCompMobile(e.target.value)}
                    placeholder="e.g. 050-1234567"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#172033] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Accounts / Contact Email
                </label>
                <input
                  type="email"
                  value={compEmail}
                  onChange={(e) => setCompEmail(e.target.value)}
                  placeholder="e.g. accounts@abccontracting.ae"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Remarks / Terms
                </label>
                <textarea
                  rows={2}
                  value={compRemarks}
                  onChange={(e) => setCompRemarks(e.target.value)}
                  placeholder="e.g. 30 days PDC terms approved"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                <button
                  type="button"
                  onClick={() => setCompModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={compSubmitting}
                  className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {compSubmitting ? 'Saving...' : compModalMode === 'add' ? 'Save Company' : 'Update Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Toggling Salesperson Status */}
      {confirmToggleSp && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-semibold text-[#172033] text-base">
                  {confirmToggleSp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} Salesperson
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmToggleSp(null)}
                className="text-[#667085] hover:text-[#172033] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#475467] leading-relaxed">
              Are you sure you want to{' '}
              <strong className="text-[#172033]">
                {confirmToggleSp.status === 'ACTIVE' ? 'deactivate' : 'activate'}
              </strong>{' '}
              salesperson <strong className="text-[#172033]">"{confirmToggleSp.name}"</strong>?
              <br />
              <span className="text-[#667085] text-[11px] block mt-1">
                Historical projects and payment records will retain their assigned salesperson.
              </span>
            </p>

            {toggleSpError && (
              <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded-lg text-xs">
                {toggleSpError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
              <button
                type="button"
                disabled={toggleSpSubmitting}
                onClick={() => setConfirmToggleSp(null)}
                className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={toggleSpSubmitting}
                onClick={handleExecuteToggleSpStatus}
                className={`px-4 py-1.5 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 ${
                  confirmToggleSp.status === 'ACTIVE'
                    ? 'bg-[#DC2626] hover:bg-red-700'
                    : 'bg-[#16A34A] hover:bg-green-700'
                }`}
              >
                {toggleSpSubmitting
                  ? 'Updating...'
                  : confirmToggleSp.status === 'ACTIVE'
                  ? 'Yes, Deactivate'
                  : 'Yes, Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
