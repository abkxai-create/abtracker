import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { CompanyRecord, Project, PaymentReceipt } from '../types';
import { formatAED } from '../utils/commercialUtils';
import { formatDateDDMMYYYY, toInputDateFormat } from '../utils/dateUtils';
import { getWhatsAppUrl } from '../utils/whatsapp';
import { isCompanyMatch, toCompanyCanonicalKey } from '../utils/companyUtils';
import { AnimatedNumber } from './AnimatedNumber';
import * as XLSX from 'xlsx';
import {
  Building2,
  Building,
  Search,
  Filter,
  ArrowLeft,
  DollarSign,
  FolderKanban,
  Receipt,
  Phone,
  Mail,
  User,
  Plus,
  ExternalLink,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  Share2,
  Edit2,
  ChevronRight,
  TrendingUp,
  FileText,
  CreditCard,
  Briefcase,
  X,
  Check,
  Loader2,
  MessageSquare,
} from 'lucide-react';

export interface CompaniesViewProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onOpenAddModal?: () => void;
  initialSelectedCompanyId?: string | null;
  onClearInitialCompany?: () => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  onViewProject,
  onEditProject,
  onOpenAddModal,
  initialSelectedCompanyId = null,
  onClearInitialCompany,
}) => {
  const {
    companies,
    projects,
    allProjectsEver,
    payments,
    salespersons,
    activeSalespersons,
    getProjectFinancials,
    addCompany,
    updateCompany,
    addPaymentReceipt,
  } = useProjects();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // Navigation: selected company for deep-dive dossier view (null = directory view)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(initialSelectedCompanyId);

  // Sync when initialSelectedCompanyId changes from parent
  React.useEffect(() => {
    if (initialSelectedCompanyId) {
      setSelectedCompanyId(initialSelectedCompanyId);
    }
  }, [initialSelectedCompanyId]);

  // Deep-dive Dossier active subtab
  const [dossierTab, setDossierTab] = useState<'projects' | 'ledger' | 'contacts' | 'commercial'>('projects');

  // Search & Filters for Directory View
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSalesperson, setFilterSalesperson] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE_PROJECTS' | 'OUTSTANDING' | 'SETTLED'>('ALL');

  // Projects filter within Company Dossier
  const [projectStatusFilter, setProjectStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RETURNED'>('ALL');

  // Modal: Add / Edit Company
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyModalMode, setCompanyModalMode] = useState<'add' | 'edit'>('add');
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [modalCompName, setModalCompName] = useState('');
  const [modalCompSalespersonId, setModalCompSalespersonId] = useState('');
  const [modalCompContact, setModalCompContact] = useState('');
  const [modalCompMobile, setModalCompMobile] = useState('');
  const [modalCompEmail, setModalCompEmail] = useState('');
  const [modalCompRemarks, setModalCompRemarks] = useState('');
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companyFormError, setCompanyFormError] = useState<string | null>(null);

  // Quick Action: Record Payment Receipt Modal directly from Company Dossier
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [targetProjectIdForPayment, setTargetProjectIdForPayment] = useState<string>('');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentDateInput, setPaymentDateInput] = useState<string>(toInputDateFormat(new Date()));
  const [paymentMethodInput, setPaymentMethodInput] = useState<'Bank Transfer' | 'Cheque' | 'Cash' | 'Other'>('Bank Transfer');
  const [paymentTypeInput, setPaymentTypeInput] = useState<'Rental' | 'Advance' | 'Monthly Payment' | 'Final Payment' | 'Other'>('Rental');
  const [paymentRefInput, setPaymentRefInput] = useState<string>('');
  const [paymentRemarksInput, setPaymentRemarksInput] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Company Financial & Operational Aggregations
  // --------------------------------------------------------------------------
  const getCompanyStats = React.useCallback(
    (comp: CompanyRecord) => {
      // Find all projects linked to this company
      const companyProjects = projects.filter((p) => isCompanyMatch(p.company, comp.companyName));

      let totalContractValue = 0;
      let totalReceived = 0;
      let totalOutstanding = 0;
      let overdueAmount = 0;
      let activeProjectsCount = 0;
      let returnedProjectsCount = 0;

      companyProjects.forEach((p) => {
        const fin = getProjectFinancials(p.id);
        totalContractValue += fin.totalContractValue;
        totalReceived += fin.totalReceived;
        totalOutstanding += fin.outstandingAmount;

        if (fin.isOverdue && fin.outstandingAmount > 0) {
          overdueAmount += fin.outstandingAmount;
        }

        if (p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED') {
          activeProjectsCount++;
        } else if (p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED') {
          returnedProjectsCount++;
        }
      });

      return {
        companyProjects,
        totalProjectsCount: companyProjects.length,
        activeProjectsCount,
        returnedProjectsCount,
        totalContractValue,
        totalReceived,
        totalOutstanding,
        overdueAmount,
        hasOverdue: overdueAmount > 0,
        collectionRate:
          totalContractValue > 0 ? Math.min(100, Math.round((totalReceived / totalContractValue) * 100)) : 100,
      };
    },
    [projects, getProjectFinancials]
  );

  // Directory List with Computed Stats
  const enrichedCompanies = useMemo(() => {
    return companies.map((comp) => {
      const stats = getCompanyStats(comp);
      return {
        ...comp,
        stats,
      };
    });
  }, [companies, getCompanyStats]);

  // Overall Portfolio Totals for Top Banner
  const portfolioSummary = useMemo(() => {
    let totalCompanies = enrichedCompanies.length;
    let totalActiveProjects = 0;
    let totalPortfolioContract = 0;
    let totalPortfolioReceived = 0;
    let totalPortfolioOutstanding = 0;
    let totalPortfolioOverdue = 0;

    enrichedCompanies.forEach((c) => {
      totalActiveProjects += c.stats.activeProjectsCount;
      totalPortfolioContract += c.stats.totalContractValue;
      totalPortfolioReceived += c.stats.totalReceived;
      totalPortfolioOutstanding += c.stats.totalOutstanding;
      totalPortfolioOverdue += c.stats.overdueAmount;
    });

    return {
      totalCompanies,
      totalActiveProjects,
      totalPortfolioContract,
      totalPortfolioReceived,
      totalPortfolioOutstanding,
      totalPortfolioOverdue,
    };
  }, [enrichedCompanies]);

  // Filtered Companies for Directory View
  const filteredCompanies = useMemo(() => {
    return enrichedCompanies.filter((comp) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = comp.companyName.toLowerCase().includes(q);
        const matchesContact = (comp.contactPerson || '').toLowerCase().includes(q);
        const matchesPhone = (comp.mobile || '').toLowerCase().includes(q);
        const matchesSalesperson = (comp.defaultSalespersonName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesContact && !matchesPhone && !matchesSalesperson) {
          return false;
        }
      }

      // Salesperson filter
      if (filterSalesperson !== 'ALL') {
        if (comp.defaultSalespersonId !== filterSalesperson) return false;
      }

      // Status filter
      if (filterStatus === 'ACTIVE_PROJECTS') {
        if (comp.stats.activeProjectsCount === 0) return false;
      } else if (filterStatus === 'OUTSTANDING') {
        if (comp.stats.totalOutstanding <= 0) return false;
      } else if (filterStatus === 'SETTLED') {
        if (comp.stats.totalOutstanding > 0 || comp.stats.totalProjectsCount === 0) return false;
      }

      return true;
    });
  }, [enrichedCompanies, searchQuery, filterSalesperson, filterStatus]);

  // Active Company Dossier Object
  const currentCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return enrichedCompanies.find((c) => c.id === selectedCompanyId) || null;
  }, [selectedCompanyId, enrichedCompanies]);

  // Company Projects (for Dossier view)
  const currentCompanyProjects = useMemo(() => {
    if (!currentCompany) return [];
    return currentCompany.stats.companyProjects.filter((p) => {
      if (projectStatusFilter === 'ACTIVE') {
        return p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED';
      }
      if (projectStatusFilter === 'RETURNED') {
        return p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED';
      }
      return true;
    });
  }, [currentCompany, projectStatusFilter]);

  // Company Payment Receipts Ledger (across all projects of this company)
  const currentCompanyReceipts: PaymentReceipt[] = useMemo(() => {
    if (!currentCompany) return [];
    const companyProjectIds = new Set(currentCompany.stats.companyProjects.map((p) => p.id));
    return payments
      .filter((rcpt: PaymentReceipt) => companyProjectIds.has(rcpt.projectId) || isCompanyMatch(rcpt.company, currentCompany.companyName))
      .sort((a: PaymentReceipt, b: PaymentReceipt) => new Date(b.paymentReceivedDate).getTime() - new Date(a.paymentReceivedDate).getTime());
  }, [currentCompany, payments]);

  // Handlers for Add/Edit Company Modal
  const handleOpenAddCompany = () => {
    setEditingCompany(null);
    setCompanyModalMode('add');
    setModalCompName('');
    setModalCompSalespersonId(activeSalespersons[0]?.id || '');
    setModalCompContact('');
    setModalCompMobile('');
    setModalCompEmail('');
    setModalCompRemarks('');
    setCompanyFormError(null);
    setCompanyModalOpen(true);
  };

  const handleOpenEditCompany = (comp: CompanyRecord) => {
    setEditingCompany(comp);
    setCompanyModalMode('edit');
    setModalCompName(comp.companyName);
    setModalCompSalespersonId(comp.defaultSalespersonId || '');
    setModalCompContact(comp.contactPerson || '');
    setModalCompMobile(comp.mobile || '');
    setModalCompEmail(comp.email || '');
    setModalCompRemarks(comp.remarks || '');
    setCompanyFormError(null);
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCompName.trim()) {
      setCompanyFormError('Company Name is required');
      return;
    }
    if (!modalCompSalespersonId) {
      setCompanyFormError('Please select a default salesperson');
      return;
    }

    const sp = salespersons.find((s) => s.id === modalCompSalespersonId);
    const spName = sp ? sp.name : 'Unassigned';

    setCompanySubmitting(true);
    setCompanyFormError(null);

    try {
      if (companyModalMode === 'add') {
        const created = await addCompany({
          companyName: modalCompName.trim(),
          defaultSalespersonId: modalCompSalespersonId,
          defaultSalespersonName: spName,
          contactPerson: modalCompContact.trim(),
          mobile: modalCompMobile.trim(),
          email: modalCompEmail.trim(),
          remarks: modalCompRemarks.trim(),
        });
        setCompanyModalOpen(false);
        setSelectedCompanyId(created.id);
      } else if (editingCompany) {
        await updateCompany(editingCompany.id, {
          companyName: modalCompName.trim(),
          defaultSalespersonId: modalCompSalespersonId,
          defaultSalespersonName: spName,
          contactPerson: modalCompContact.trim(),
          mobile: modalCompMobile.trim(),
          email: modalCompEmail.trim(),
          remarks: modalCompRemarks.trim(),
        });
        setCompanyModalOpen(false);
      }
    } catch (err: any) {
      setCompanyFormError(err.message || 'Failed to save company record');
    } finally {
      setCompanySubmitting(false);
    }
  };

  // Quick Payment Receipt Handler
  const handleOpenRecordPayment = (projectId?: string) => {
    if (!currentCompany) return;
    const defaultProj = projectId || currentCompany.stats.companyProjects[0]?.id || '';
    setTargetProjectIdForPayment(defaultProj);
    setPaymentAmountInput('');
    setPaymentDateInput(toInputDateFormat(new Date()));
    setPaymentMethodInput('Bank Transfer');
    setPaymentTypeInput('Rental');
    setPaymentRefInput('');
    setPaymentRemarksInput('');
    setPaymentError(null);
    setRecordPaymentModalOpen(true);
  };

  const handleSavePaymentReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    const amountNum = parseFloat(paymentAmountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid positive payment amount');
      return;
    }

    const targetProject = currentCompany.stats.companyProjects.find((p) => p.id === targetProjectIdForPayment);
    if (!targetProject) {
      setPaymentError('Please select a valid project');
      return;
    }

    setPaymentSubmitting(true);
    setPaymentError(null);

    try {
      await addPaymentReceipt({
        projectId: targetProject.id,
        projectCode: targetProject.projectCode,
        company: targetProject.company,
        paymentReceivedAmount: amountNum,
        paymentReceivedDate: paymentDateInput,
        paymentMethod: paymentMethodInput,
        paymentType: paymentTypeInput,
        paymentReference: paymentRefInput.trim() || undefined,
        remarks: paymentRemarksInput.trim() || undefined,
      });
      setRecordPaymentModalOpen(false);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Export Company Ledger to Excel
  const handleExportLedgerExcel = () => {
    if (!currentCompany) return;
    const dataToExport = currentCompanyReceipts.map((r: PaymentReceipt, index: number) => {
      const proj = projects.find((p) => p.id === r.projectId);
      return {
        'SL No': index + 1,
        'Date': formatDateDDMMYYYY(r.paymentReceivedDate),
        'Project Code': r.projectCode || proj?.projectCode || '-',
        'Project Reference': proj?.projectReference || '-',
        'Amount (AED)': r.paymentReceivedAmount,
        'Payment Method': r.paymentMethod || 'Bank Transfer',
        'Type': r.paymentType || 'Rental',
        'Reference / Cheque No': r.paymentReference || '-',
        'Month': r.installmentMonth || '-',
        'Remarks': r.remarks || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Ledger');
    const safeName = currentCompany.companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `${safeName}_payment_ledger_${toInputDateFormat(new Date())}.xlsx`);
  };

  // --------------------------------------------------------------------------
  // VIEW 1: DEDICATED FULL-PAGE COMPANY PROFILE DOSSIER
  // --------------------------------------------------------------------------
  if (currentCompany) {
    const stats = currentCompany.stats;
    const assignedSalesperson = salespersons.find((s) => s.id === currentCompany.defaultSalespersonId);

    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Back Navigation Breadcrumb Bar */}
        <div className="flex items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setSelectedCompanyId(null);
              if (onClearInitialCompany) onClearInitialCompany();
            }}
            className="flex items-center gap-2 text-xs font-bold text-[#2563EB] hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Companies Directory</span>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenEditCompany(currentCompany)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-[#CBD5E1] px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Company</span>
              </button>
            )}

            {onOpenAddModal && (
              <button
                type="button"
                onClick={() => onOpenAddModal()}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 px-3.5 py-1.5 rounded-lg transition cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Project for this Company</span>
              </button>
            )}
          </div>
        </div>

        {/* Unified Company Dossier Header Card (Dark Navy Matching Project Details) */}
        <div className="bg-[#0F172A] text-white p-5 sm:p-6 rounded-2xl border border-[#1E293B] shadow-sm relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Left: Company Identity, Salesperson, Contacts */}
            <div className="space-y-2.5 min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-2.5 rounded-xl bg-[#2563EB]/25 text-[#60A5FA] border border-blue-500/30 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight truncate">
                    {currentCompany.companyName}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                    <span>Client Code: <span className="font-mono text-slate-200 font-bold">{currentCompany.id}</span></span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span>Sales Lead: <strong className="text-slate-100 font-semibold">{currentCompany.defaultSalespersonName || 'Unassigned'}</strong></span>
                    </span>
                    {currentCompany.contactPerson && (
                      <>
                        <span>·</span>
                        <span>Contact: <strong className="text-slate-200">{currentCompany.contactPerson}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Direct Quick Actions: WhatsApp & Phone */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {currentCompany.mobile && (
                  <a
                    href={getWhatsAppUrl(currentCompany.mobile, `Hello ${currentCompany.contactPerson || currentCompany.companyName}, regarding your projects with AB TRACKER:`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 text-[#4ADE80] border border-[#16A34A]/40 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp ({currentCompany.mobile})</span>
                  </a>
                )}
                {currentCompany.email && (
                  <a
                    href={`mailto:${currentCompany.email}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentCompany.email}</span>
                  </a>
                )}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/40 text-blue-300 border border-blue-800/60 rounded-lg text-xs font-medium">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Terms: 30 Days Credit</span>
                </span>
              </div>
            </div>

            {/* Right: Quick Action: Record Payment */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenRecordPayment()}
                disabled={stats.totalProjectsCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                <DollarSign className="w-4 h-4" />
                <span>Record Payment Receipt</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 OPERATIONAL KPIS RIBBON (Clean single-elevation cards, high contrast) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Running Projects */}
          <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-bold uppercase tracking-wider text-[11px]">Running Sites</span>
              <div className="p-1 rounded-md bg-blue-50 text-[#2563EB]">
                <FolderKanban className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-[#0F172A] font-mono tabular-nums">
                {stats.activeProjectsCount}
              </span>
              <span className="text-xs text-[#64748B] font-medium">
                of {stats.totalProjectsCount} total sites
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {stats.returnedProjectsCount} returned / closed
            </div>
          </div>

          {/* Card 2: Total Contract / LPO Value */}
          <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-bold uppercase tracking-wider text-[11px]">Contract / LPO Value</span>
              <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-slate-500">AED</span>
              <AnimatedNumber
                value={stats.totalContractValue}
                duration={350}
                format={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                className="text-lg sm:text-xl font-black text-[#0F172A] font-mono tabular-nums tracking-tight"
              />
            </div>
            <div className="text-[11px] text-indigo-600 font-semibold">
              Gross contracted volume across all projects
            </div>
          </div>

          {/* Card 3: Total Received */}
          <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-bold uppercase tracking-wider text-[11px]">Total Received</span>
              <div className="p-1 rounded-md bg-emerald-50 text-[#16A34A]">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-emerald-600">AED</span>
              <AnimatedNumber
                value={stats.totalReceived}
                duration={350}
                format={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                className="text-lg sm:text-xl font-black text-[#16A34A] font-mono tabular-nums tracking-tight"
              />
            </div>
            <div className="text-[11px] text-emerald-600 font-medium">
              Collection rate: {stats.collectionRate}% of contracts
            </div>
          </div>

          {/* Card 4: Total Outstanding / Overdue */}
          <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-bold uppercase tracking-wider text-[11px]">Outstanding Balance</span>
              <div className={`p-1 rounded-md ${stats.hasOverdue ? 'bg-red-50 text-[#DC2626]' : 'bg-amber-50 text-amber-600'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xs font-bold ${stats.hasOverdue ? 'text-red-500' : 'text-amber-500'}`}>AED</span>
              <AnimatedNumber
                value={stats.totalOutstanding}
                duration={350}
                format={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                className={`text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight ${
                  stats.hasOverdue ? 'text-[#DC2626]' : stats.totalOutstanding === 0 ? 'text-emerald-600' : 'text-[#D97706]'
                }`}
              />
            </div>
            <div className="text-[11px] font-semibold">
              {stats.overdueAmount > 0 ? (
                <span className="text-red-600 font-bold">⚠️ AED {formatAED(stats.overdueAmount)} Overdue</span>
              ) : stats.totalOutstanding === 0 ? (
                <span className="text-emerald-600 font-semibold">All accounts settled</span>
              ) : (
                <span className="text-amber-600 font-medium">Within credit terms</span>
              )}
            </div>
          </div>
        </div>

        {/* SEGMENTED SUB-TABS NAVIGATION */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDossierTab('projects')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                dossierTab === 'projects'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Running & Historical Projects ({stats.totalProjectsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setDossierTab('ledger')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                dossierTab === 'ledger'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Payment Ledger ({currentCompanyReceipts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setDossierTab('contacts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                dossierTab === 'contacts'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Contacts & Ownership</span>
            </button>

            <button
              type="button"
              onClick={() => setDossierTab('commercial')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                dossierTab === 'commercial'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Commercial Statement</span>
            </button>
          </div>

          {dossierTab === 'ledger' && currentCompanyReceipts.length > 0 && (
            <button
              type="button"
              onClick={handleExportLedgerExcel}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-[#CBD5E1] px-3 py-1 rounded-lg transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Ledger (.xlsx)</span>
            </button>
          )}
        </div>

        {/* TAB 1: RUNNING & HISTORICAL PROJECTS */}
        {dossierTab === 'projects' && (
          <div className="space-y-3">
            {/* Filter Pill Tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setProjectStatusFilter('ALL')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                    projectStatusFilter === 'ALL' ? 'bg-white text-[#0F172A] shadow-2xs' : 'text-[#64748B]'
                  }`}
                >
                  All Contracts ({stats.totalProjectsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectStatusFilter('ACTIVE')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                    projectStatusFilter === 'ACTIVE' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-[#64748B]'
                  }`}
                >
                  Running Sites ({stats.activeProjectsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectStatusFilter('RETURNED')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                    projectStatusFilter === 'RETURNED' ? 'bg-white text-slate-700 shadow-2xs' : 'text-[#64748B]'
                  }`}
                >
                  Returned / Closed ({stats.returnedProjectsCount})
                </button>
              </div>

              <span className="text-xs text-[#64748B]">
                Showing {currentCompanyProjects.length} of {stats.totalProjectsCount} projects
              </span>
            </div>

            {/* Projects Table */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              {currentCompanyProjects.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-[#334155]">No projects found in this filter</p>
                  <p className="text-xs text-[#64748B]">Click "+ New Project for this Company" to register a contract.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475467] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Project Code</th>
                        <th className="py-2.5 px-3">Reference / LPO</th>
                        <th className="py-2.5 px-3">Hire Timeline</th>
                        <th className="py-2.5 px-3">Service</th>
                        <th className="py-2.5 px-3 text-right">Contract (AED)</th>
                        <th className="py-2.5 px-3 text-right">Received (AED)</th>
                        <th className="py-2.5 px-3 text-right">Balance (AED)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentCompanyProjects.map((p) => {
                        const fin = getProjectFinancials(p.id);
                        const isReturned = p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED';
                        return (
                          <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {p.projectCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#0F172A] max-w-[200px] truncate">
                              {p.projectReference || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                              <div>Del: {formatDateDDMMYYYY(p.deliveryDate)}</div>
                              <div className="text-slate-400">Due: {formatDateDDMMYYYY(p.dueDate)} ({p.hirePeriodMonths || 1} mo)</div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              {p.scaffoldingType || 'RENTAL'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0F172A]">
                              {formatAED(fin.totalContractValue)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#16A34A]">
                              {formatAED(fin.totalReceived)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              <span className={fin.outstandingAmount === 0 ? 'text-[#16A34A]' : fin.isOverdue ? 'text-[#DC2626]' : 'text-[#D97706]'}>
                                {formatAED(fin.outstandingAmount)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                  p.projectStatus === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : p.projectStatus === 'EXTENDED'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {p.projectStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onViewProject(p)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 rounded border border-blue-200 transition cursor-pointer"
                                >
                                  View
                                </button>
                                {onEditProject && (
                                  <button
                                    type="button"
                                    onClick={() => onEditProject(p)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENT LEDGER */}
        {dossierTab === 'ledger' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span>Consolidated receipts recorded for {currentCompany.companyName} across all project contracts</span>
              <button
                type="button"
                onClick={() => handleOpenRecordPayment()}
                className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                + Record New Receipt
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              {currentCompanyReceipts.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-[#334155]">No payment receipts recorded yet</p>
                  <p className="text-xs text-[#64748B]">Click "Record Payment Receipt" above to record client remittances.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475467] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Project</th>
                        <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                        <th className="py-2.5 px-3">Payment Method</th>
                        <th className="py-2.5 px-3">Reference / Cheque</th>
                        <th className="py-2.5 px-3">Target Month</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {currentCompanyReceipts.map((rcpt: PaymentReceipt) => (
                        <tr key={rcpt.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#0F172A]">
                            {formatDateDDMMYYYY(rcpt.paymentReceivedDate)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {rcpt.projectCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-[#16A34A] text-xs">
                            {formatAED(rcpt.paymentReceivedAmount)}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-700">
                            {rcpt.paymentMethod || 'Bank Transfer'} ({rcpt.paymentType || 'Rental'})
                          </td>
                          <td className="py-2.5 px-3 text-[#2563EB] font-bold">
                            {rcpt.paymentReference || '-'}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600">
                            {rcpt.installmentMonth || '-'}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-500 italic max-w-xs truncate">
                            {rcpt.remarks || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CONTACTS & OWNERSHIP */}
        {dossierTab === 'contacts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Primary Company Profile */}
            <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB]">
                    <Building className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Company Profile & Details</h3>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditCompany(currentCompany)}
                    className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    Edit Info
                  </button>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Official Registered Name:</span>
                  <span className="font-bold text-[#0F172A] text-sm">{currentCompany.companyName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                    <span className="font-semibold text-slate-800">{currentCompany.contactPerson || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone / Mobile:</span>
                    <span className="font-mono font-semibold text-slate-800">{currentCompany.mobile || 'Not Specified'}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-400 block text-[11px]">Email Address:</span>
                  <span className="font-medium text-slate-800">{currentCompany.email || 'Not Specified'}</span>
                </div>

                {currentCompany.remarks && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Commercial Remarks & Site Instructions:</span>
                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs leading-relaxed">
                      {currentCompany.remarks}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Salesperson Ownership & Commercial Terms */}
            <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#16A34A]">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0F172A]">Salesperson Ownership & Credit</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Default Assigned Sales Engineer:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-[#0F172A] text-sm">
                      {currentCompany.defaultSalespersonName || 'Unassigned'}
                    </span>
                    {assignedSalesperson && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {assignedSalesperson.mobile}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    All new projects created for this company automatically assign to this salesperson.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Standard Billing & Credit Terms:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-slate-800">30 Days Credit</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                      Standard Terms
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Direct WhatsApp Communication:</span>
                  {currentCompany.mobile ? (
                    <div className="mt-1">
                      <a
                        href={getWhatsAppUrl(currentCompany.mobile, `Hello ${currentCompany.contactPerson || currentCompany.companyName}, this is AB TRACKER Regarding your active projects:`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#16A34A] hover:bg-emerald-700 text-white font-bold rounded-lg transition text-xs shadow-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send WhatsApp Message to {currentCompany.mobile}</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs italic mt-1">No mobile number registered for WhatsApp</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COMMERCIAL STATEMENT */}
        {dossierTab === 'commercial' && (
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">Commercial Account Statement</h3>
                <p className="text-xs text-[#64748B]">Summary of total business volume and collection reliability</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Account Health:</span>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-black ${
                    stats.hasOverdue
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : stats.totalOutstanding === 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {stats.hasOverdue ? 'ACTION REQUIRED' : stats.totalOutstanding === 0 ? 'SETTLED' : 'ACTIVE / CURRENT'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 font-semibold block text-[11px]">Total Invoiced Contracts</span>
                <span className="text-base font-black font-mono text-[#0F172A] block">
                  AED {formatAED(stats.totalContractValue)}
                </span>
                <span className="text-[10px] text-slate-400">Sum of all signed LPOs & contracts</span>
              </div>

              <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-emerald-700 font-semibold block text-[11px]">Total Paid & Cleared</span>
                <span className="text-base font-black font-mono text-[#16A34A] block">
                  AED {formatAED(stats.totalReceived)}
                </span>
                <span className="text-[10px] text-emerald-600">Total verified collections received</span>
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1">
                <span className="text-amber-800 font-semibold block text-[11px]">Net Outstanding Balance</span>
                <span className={`text-base font-black font-mono block ${stats.hasOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                  AED {formatAED(stats.totalOutstanding)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {stats.overdueAmount > 0 ? `Includes AED ${formatAED(stats.overdueAmount)} overdue` : 'Within approved credit period'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Record Payment Receipt */}
        {recordPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B1526]/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-[#CBD5E1] max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-[#16A34A]">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0F172A]">Record Payment Receipt</h3>
                    <p className="text-[11px] text-[#64748B]">{currentCompany.companyName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRecordPaymentModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {paymentError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <form onSubmit={handleSavePaymentReceipt} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">
                    Select Target Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetProjectIdForPayment}
                    onChange={(e) => setTargetProjectIdForPayment(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    {currentCompany.stats.companyProjects.map((p) => {
                      const fin = getProjectFinancials(p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.projectCode} - {p.projectReference || 'Project'} (Bal: AED {formatAED(fin.outstandingAmount)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      Received Amount (AED) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={paymentAmountInput}
                      onChange={(e) => setPaymentAmountInput(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl font-mono font-bold text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDateInput}
                      onChange={(e) => setPaymentDateInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl font-mono text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">Payment Method</label>
                    <select
                      value={paymentMethodInput}
                      onChange={(e) => setPaymentMethodInput(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">Payment Type</label>
                    <select
                      value={paymentTypeInput}
                      onChange={(e) => setPaymentTypeInput(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="Rental">Rental</option>
                      <option value="Advance">Advance</option>
                      <option value="Monthly Payment">Monthly Payment</option>
                      <option value="Final Payment">Final Payment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">Cheque No / Transaction Reference</label>
                  <input
                    type="text"
                    value={paymentRefInput}
                    onChange={(e) => setPaymentRefInput(e.target.value)}
                    placeholder="e.g. CHQ-9912 or FT-2026-04"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl font-mono text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">Remarks</label>
                  <input
                    type="text"
                    value={paymentRemarksInput}
                    onChange={(e) => setPaymentRemarksInput(e.target.value)}
                    placeholder="e.g. Cleared via Emirates NBD"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    disabled={paymentSubmitting}
                    onClick={() => setRecordPaymentModalOpen(false)}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentSubmitting}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {paymentSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{paymentSubmitting ? 'Recording...' : 'Record Payment'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 2: DEDICATED COMPANIES DIRECTORY LISTING
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header Card (Unified Clean Structure) */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                Client Companies & Accounts
              </h1>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Centralized portfolio of all client companies, active project counts, contract volumes, and collections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddCompany}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Company</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Balanced Portfolio Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Registered Clients</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#0F172A] font-mono tabular-nums">
                {portfolioSummary.totalCompanies}
              </span>
              <span className="text-[11px] text-slate-500">accounts</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Fleet Sites</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#2563EB] font-mono tabular-nums">
                {portfolioSummary.totalActiveProjects}
              </span>
              <span className="text-[11px] text-blue-600 font-semibold">running</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Contract Volume</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-slate-500">AED</span>
              <span className="text-lg sm:text-xl font-black text-[#0F172A] font-mono tabular-nums">
                {formatAED(portfolioSummary.totalPortfolioContract)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Outstanding</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-amber-600">AED</span>
              <span className="text-lg sm:text-xl font-black text-[#D97706] font-mono tabular-nums">
                {formatAED(portfolioSummary.totalPortfolioOutstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies by name, contact, mobile, or salesperson..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Salesperson filter */}
            <select
              value={filterSalesperson}
              onChange={(e) => setFilterSalesperson(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="ALL">All Sales Engineers</option>
              {salespersons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  filterStatus === 'ALL' ? 'bg-white text-[#0F172A] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                All ({enrichedCompanies.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ACTIVE_PROJECTS')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  filterStatus === 'ACTIVE_PROJECTS' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                With Active Sites
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('OUTSTANDING')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  filterStatus === 'OUTSTANDING' ? 'bg-white text-[#D97706] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                With Outstanding
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Companies Directory Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        {filteredCompanies.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-[#0F172A]">No client companies found</p>
            <p className="text-xs text-[#64748B]">Try clearing your search query or filter settings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475467] uppercase tracking-wider">
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Sales Engineer</th>
                  <th className="py-3 px-4">Contact & Mobile</th>
                  <th className="py-3 px-4 text-center">Running Sites</th>
                  <th className="py-3 px-4 text-right">Contract Volume (AED)</th>
                  <th className="py-3 px-4 text-right">Received (AED)</th>
                  <th className="py-3 px-4 text-right">Outstanding (AED)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map((comp) => {
                  const s = comp.stats;
                  return (
                    <tr
                      key={comp.id}
                      onClick={() => setSelectedCompanyId(comp.id)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                            <Building className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-[#0F172A] text-xs block group-hover:text-[#2563EB] transition-colors">
                              {comp.companyName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {comp.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700 block">
                          {comp.defaultSalespersonName || 'Unassigned'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <span className="font-semibold text-slate-800 block text-[11px]">
                            {comp.contactPerson || '-'}
                          </span>
                          {comp.mobile && (
                            <span className="font-mono text-[10px] text-slate-400">
                              {comp.mobile}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            s.activeProjectsCount > 0
                              ? 'bg-blue-50 text-[#2563EB] border border-blue-200'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {s.activeProjectsCount} active ({s.totalProjectsCount} total)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A]">
                        {formatAED(s.totalContractValue)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#16A34A]">
                        {formatAED(s.totalReceived)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={s.totalOutstanding === 0 ? 'text-[#16A34A]' : s.hasOverdue ? 'text-[#DC2626]' : 'text-[#D97706]'}>
                          {formatAED(s.totalOutstanding)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCompanyId(comp.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-blue-50 border border-[#CBD5E1] hover:border-blue-300 text-[#2563EB] font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
                          >
                            <span>Open Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Company */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B1526]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#CBD5E1] max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">
                    {companyModalMode === 'add' ? 'Register New Client Company' : 'Edit Company Details'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Manage company credentials and default sales rep</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {companyFormError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{companyFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCompany} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalCompName}
                  onChange={(e) => setModalCompName(e.target.value)}
                  placeholder="e.g. Al Habtoor Engineering LLC"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Default Assigned Sales Engineer <span className="text-red-500">*</span>
                </label>
                <select
                  value={modalCompSalespersonId}
                  onChange={(e) => setModalCompSalespersonId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="">Select Salesperson...</option>
                  {salespersons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={modalCompContact}
                    onChange={(e) => setModalCompContact(e.target.value)}
                    placeholder="e.g. Eng. Tariq"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">Mobile (WhatsApp)</label>
                  <input
                    type="text"
                    value={modalCompMobile}
                    onChange={(e) => setModalCompMobile(e.target.value)}
                    placeholder="e.g. 050-1234567"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl font-mono text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Email Address</label>
                <input
                  type="email"
                  value={modalCompEmail}
                  onChange={(e) => setModalCompEmail(e.target.value)}
                  placeholder="e.g. info@alhabtoor.ae"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Remarks & Billing Notes</label>
                <textarea
                  rows={2}
                  value={modalCompRemarks}
                  onChange={(e) => setModalCompRemarks(e.target.value)}
                  placeholder="Special payment terms, site delivery instructions..."
                  className="w-full p-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  disabled={companySubmitting}
                  onClick={() => setCompanyModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={companySubmitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {companySubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{companySubmitting ? 'Saving...' : companyModalMode === 'add' ? 'Register Company' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
