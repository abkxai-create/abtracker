import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Project,
  ScaffoldingType,
  ProjectStatus,
  PaymentStatus,
  SalespersonAssignmentType,
  PaymentMethod,
  PaymentType,
} from '../types';
import {
  calculateDueDate,
  calculateExtendedDueDate,
  calculateTotalHireDays,
  toInputDateFormat,
  formatDateDDMMYYYY,
  calculateDiffDays,
} from '../utils/dateUtils';
import { formatAED } from '../utils/commercialUtils';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { getWhatsAppUrl } from '../utils/whatsapp';
import { AnimatedNumber } from './AnimatedNumber';
import {
  X,
  Building,
  Phone,
  Calendar,
  Clock,
  DollarSign,
  UserCheck,
  FileText,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  MessageSquare,
  Copy,
  Trash2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Plus,
  Send,
  ExternalLink,
  ShieldCheck,
  Check,
  Hash,
} from 'lucide-react';
import { CreateProjectModal } from './CreateProjectModal';

export interface ProjectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  mode: 'view' | 'edit' | 'create';
  onModeChange?: (mode: 'view' | 'edit') => void;
  onCopyProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export const ProjectDrawer: React.FC<ProjectDrawerProps> = ({
  isOpen,
  onClose,
  project,
  mode: initialMode,
  onModeChange,
  onCopyProject,
  onDeleteProject,
}) => {
  const {
    salespersons,
    activeSalespersons,
    companies,
    findCompanyByName,
    addProject,
    updateProject,
    addPaymentReceipt,
    addPaymentFollowup,
    getProjectFinancials,
  } = useProjects();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  const [currentMode, setCurrentMode] = useState<'view' | 'edit' | 'create'>(initialMode);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Action in view mode: Inline Payment Receipt
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toInputDateFormat(new Date()));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer');
  const [payType, setPayType] = useState<PaymentType>('Rental');
  const [payRef, setPayRef] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Quick Action in view mode: Inline Follow-Up
  const [recordingFollowup, setRecordingFollowup] = useState(false);
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupDate, setFollowupDate] = useState(toInputDateFormat(new Date()));
  const [followupSubmitting, setFollowupSubmitting] = useState(false);

  // Form State for create / edit
  const [formData, setFormData] = useState({
    company: '',
    mobile: '',
    projectReference: '',
    scaffoldingType: 'RENTAL' as ScaffoldingType,
    deliveryDate: toInputDateFormat(new Date()),
    hirePeriodDays: 30,
    dueDate: '',
    isDueDateOverridden: false,
    projectStatus: 'ACTIVE' as ProjectStatus,
    returnedDate: '',
    extensionDays: 0,
    extensionRentalAmount: 0,
    contractAmount: 0,
    originalRentalAmount: 0,
    monthlyPaymentAmount: 0,
    isRecurringMonthly: false,
    paymentStatus: 'NOT_PAID' as PaymentStatus,
    salespersonId: '',
    salespersonName: '',
    salespersonAssignmentType: 'AUTO_ASSIGNED' as SalespersonAssignmentType,
    remarks: '',
  });

  // Sync mode and form state whenever drawer opens or target project changes
  useEffect(() => {
    setCurrentMode(initialMode);
    setActiveStep(1);
    setFormError(null);
    setRecordingPayment(false);
    setRecordingFollowup(false);

    if (initialMode === 'create' || !project) {
      const todayStr = toInputDateFormat(new Date());
      const defaultDue = calculateDueDate(todayStr, 30);
      setFormData({
        company: '',
        mobile: '',
        projectReference: '',
        scaffoldingType: 'RENTAL',
        deliveryDate: todayStr,
        hirePeriodDays: 30,
        dueDate: defaultDue,
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE',
        returnedDate: '',
        extensionDays: 0,
        extensionRentalAmount: 0,
        contractAmount: 0,
        originalRentalAmount: 0,
        monthlyPaymentAmount: 0,
        isRecurringMonthly: false,
        paymentStatus: 'NOT_PAID',
        salespersonId: '',
        salespersonName: '',
        salespersonAssignmentType: 'AUTO_ASSIGNED',
        remarks: '',
      });
    } else {
      setFormData({
        company: project.company || '',
        mobile: project.mobile || '',
        projectReference: project.projectReference || '',
        scaffoldingType: project.scaffoldingType || 'RENTAL',
        deliveryDate: project.deliveryDate || toInputDateFormat(new Date()),
        hirePeriodDays: project.hirePeriodDays || 30,
        dueDate: project.dueDate || '',
        isDueDateOverridden: project.isDueDateOverridden || false,
        projectStatus: project.projectStatus || 'ACTIVE',
        returnedDate: project.returnedDate || '',
        extensionDays: project.extensionDays || 0,
        extensionRentalAmount: project.extensionRentalAmount || 0,
        contractAmount: project.contractAmount || 0,
        originalRentalAmount: project.originalRentalAmount || 0,
        monthlyPaymentAmount: project.monthlyPaymentAmount || 0,
        isRecurringMonthly: Boolean(project.monthlyPaymentAmount && project.monthlyPaymentAmount > 0),
        paymentStatus: project.paymentStatus || 'NOT_PAID',
        salespersonId: project.salespersonId || '',
        salespersonName: project.salespersonName || '',
        salespersonAssignmentType: project.salespersonAssignmentType || 'AUTO_ASSIGNED',
        remarks: project.remarks || '',
      });
    }
  }, [isOpen, project, initialMode]);

  // Keyboard shortcut: Escape to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto calculate due date when deliveryDate or hirePeriodDays change and not overridden
  const handleDateOrPeriodChange = (newDeliveryDate: string, newDays: number) => {
    setFormData((prev) => {
      const calculated = calculateDueDate(newDeliveryDate, newDays);
      return {
        ...prev,
        deliveryDate: newDeliveryDate,
        hirePeriodDays: newDays,
        dueDate: prev.isDueDateOverridden ? prev.dueDate : calculated,
      };
    });
  };

  // Company autocomplete & smart auto-fill
  const handleCompanyChange = (companyName: string) => {
    const matched = findCompanyByName(companyName);
    setFormData((prev) => {
      const next = { ...prev, company: companyName };
      if (matched) {
        if (!prev.mobile && matched.mobile) next.mobile = matched.mobile;
        if (!prev.salespersonId && matched.defaultSalespersonId) {
          next.salespersonId = matched.defaultSalespersonId;
          next.salespersonName = matched.defaultSalespersonName;
          next.salespersonAssignmentType = 'AUTO_ASSIGNED';
        }
      }
      return next;
    });
  };

  // Financial summary for view mode
  const financials = useMemo(() => {
    if (!project) return null;
    return getProjectFinancials(project.id);
  }, [project, getProjectFinancials]);

  // Form Submission
  const handleSaveForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.company.trim()) {
      setFormError('Company name is required.');
      setActiveStep(1);
      return;
    }
    if (!formData.projectReference.trim()) {
      setFormError('Project / LPO reference is required.');
      setActiveStep(1);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        company: formData.company.trim(),
        mobile: formData.mobile.trim(),
        projectReference: formData.projectReference.trim(),
        scaffoldingType: formData.scaffoldingType,
        deliveryDate: formData.deliveryDate,
        hirePeriodDays: Number(formData.hirePeriodDays) || 30,
        dueDate: formData.dueDate,
        isDueDateOverridden: formData.isDueDateOverridden,
        projectStatus: formData.projectStatus,
        returnedDate: formData.projectStatus === 'RETURNED' ? formData.returnedDate || toInputDateFormat(new Date()) : null,
        extensionDays: Number(formData.extensionDays) || 0,
        extensionRentalAmount: Number(formData.extensionRentalAmount) || 0,
        originalRentalAmount: Number(formData.originalRentalAmount || formData.contractAmount) || 0,
        contractAmount: (Number(formData.extensionRentalAmount) || 0) > 0
          ? (Number(formData.originalRentalAmount || formData.contractAmount) || 0) + (Number(formData.extensionRentalAmount) || 0)
          : Number(formData.contractAmount) || 0,
        monthlyPaymentAmount: formData.isRecurringMonthly ? Number(formData.monthlyPaymentAmount) || 0 : 0,
        paymentStatus: formData.paymentStatus,
        salespersonId: formData.salespersonId || undefined,
        salespersonName: formData.salespersonName || undefined,
        salespersonAssignmentType: formData.salespersonAssignmentType,
        remarks: formData.remarks.trim(),
      };

      if (currentMode === 'create' || !project) {
        await addProject(payload);
        onClose();
      } else {
        await updateProject(project.id, payload, 'Updated via Project Drawer');
        setCurrentMode('view');
        if (onModeChange) onModeChange('view');
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  // Record Payment Receipt
  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !payAmount || Number(payAmount) <= 0) return;
    setPaySubmitting(true);
    try {
      await addPaymentReceipt({
        projectId: project.id,
        projectCode: project.projectCode,
        company: project.company,
        paymentReceivedDate: payDate,
        paymentReceivedAmount: Number(payAmount),
        paymentMethod: payMethod,
        paymentType: payType,
        paymentReference: payRef.trim() || undefined,
      });
      setRecordingPayment(false);
      setPayAmount('');
      setPayRef('');
    } catch (err: any) {
      alert('Error recording payment: ' + err.message);
    } finally {
      setPaySubmitting(false);
    }
  };

  // Record Follow-Up
  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !followupNotes.trim()) return;
    setFollowupSubmitting(true);
    try {
      await addPaymentFollowup(project.id, followupNotes.trim(), followupDate);
      setRecordingFollowup(false);
      setFollowupNotes('');
    } catch (err: any) {
      alert('Error saving follow-up: ' + err.message);
    } finally {
      setFollowupSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if ((currentMode as string) === 'create' || (initialMode as string) === 'create') {
    return (
      <CreateProjectModal
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-[#0B1526]/60 backdrop-blur-xs"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-screen max-w-2xl bg-white shadow-2xl border-l border-[#E2E8F0] flex flex-col z-10"
        >
          {/* Top Bar Header (Clean, Bold, High-Contrast) */}
          <div className="min-h-16 px-6 py-3 bg-[#0F172A] text-white flex items-center justify-between shrink-0 border-b border-[#1E293B] gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-[#2563EB] rounded-lg text-white shrink-0">
                <Building className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                {currentMode === 'create' ? (
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-white">
                      New Project Registration
                    </h2>
                    <p className="text-xs text-slate-400">
                      Guided multi-step equipment hire registration
                    </p>
                  </div>
                ) : project ? (
                  <div>
                    {/* Row 1: Code Badge + Big Bold Company Name */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black bg-[#2563EB] text-white px-2 py-0.5 rounded tabular-nums shadow-xs">
                        {project.projectCode}
                      </span>
                      <h2 className="text-base font-black tracking-tight text-white uppercase truncate max-w-sm">
                        {project.company}
                      </h2>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          project.projectStatus === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : project.projectStatus === 'EXTENDED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : project.projectStatus === 'RETURNED'
                            ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {project.projectStatus}
                      </span>
                    </div>

                    {/* Row 2: Bold Reference & Bold Salesperson (Clean Badges) */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs">
                      {project.projectReference && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-200">
                          <Hash className="w-3 h-3 text-sky-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">Ref:</span>
                          <span className="font-mono font-bold text-xs text-sky-300">
                            {project.projectReference}
                          </span>
                        </div>
                      )}
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Salesperson:</span>
                        <span className="font-bold text-xs text-white">
                          {project.salespersonName || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-base font-bold text-white">Project Details</h2>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentMode === 'view' && project && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMode('edit');
                    if (onModeChange) onModeChange('edit');
                  }}
                  className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              {currentMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMode('view');
                    if (onModeChange) onModeChange('view');
                  }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* VIEW MODE */}
            {currentMode === 'view' && project && (
              <div className="space-y-6">
                {/* Operational Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Contract Total
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-[11px] font-bold text-slate-400">AED</span>
                      <AnimatedNumber
                        value={project.contractAmount || 0}
                        duration={320}
                        format={(n) => n.toLocaleString('en-US')}
                        className="text-base font-black font-mono text-slate-900 tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Outstanding
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className={`text-[11px] font-bold ${(financials?.outstandingAmount || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>AED</span>
                      <AnimatedNumber
                        value={financials?.outstandingAmount || 0}
                        duration={320}
                        format={(n) => n.toLocaleString('en-US')}
                        className={`text-base font-black font-mono tabular-nums ${
                          (financials?.outstandingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Hire Days
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <AnimatedNumber
                        value={calculateTotalHireDays(project.hirePeriodDays, project.extensionDays || 0)}
                        duration={320}
                        className="text-base font-black font-mono text-slate-900 tabular-nums"
                      />
                      <span className="text-xs font-semibold text-slate-500">Days</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Due Date
                    </span>
                    <span
                      className={`text-base font-black font-mono mt-1 block ${
                        financials?.isOverdue ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {formatDateDDMMYYYY(project.dueDate)}
                    </span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-200 pb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingPayment((prev) => !prev);
                      setRecordingFollowup(false);
                    }}
                    className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRecordingFollowup((prev) => !prev);
                      setRecordingPayment(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                    <span>Quick Follow-Up</span>
                  </button>

                  {project.mobile && (
                    <a
                      href={getWhatsAppUrl(
                        project.mobile,
                        `Hello ${project.company}, reminder regarding Scaffold Project ${project.projectCode}. Outstanding balance: ${formatAED(
                          financials?.outstandingAmount || 0
                        )}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {onCopyProject && (
                    <button
                      type="button"
                      onClick={() => onCopyProject(project)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  )}

                  {isAdmin && onDeleteProject && (
                    <button
                      type="button"
                      onClick={() => onDeleteProject(project)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Trash</span>
                    </button>
                  )}
                </div>

                {/* Inline Record Payment Form */}
                {recordingPayment && (
                  <form
                    onSubmit={handleSaveReceipt}
                    className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-blue-600" />
                        <span>Record Payment Receipt</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setRecordingPayment(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Amount (AED) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Payment Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Method
                        </label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <input
                        type="text"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder="Reference / Cheque No / Notes (optional)"
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={paySubmitting || !payAmount}
                        className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                      >
                        {paySubmitting ? 'Saving...' : 'Save Receipt'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Inline Follow-Up Form */}
                {recordingFollowup && (
                  <form
                    onSubmit={handleSaveFollowup}
                    className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-amber-600" />
                        <span>Log Follow-Up & Outcome</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setRecordingFollowup(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    <textarea
                      required
                      rows={2}
                      value={followupNotes}
                      onChange={(e) => setFollowupNotes(e.target.value)}
                      placeholder="Notes on communication, promised payment date, or client feedback..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        disabled={followupSubmitting || !followupNotes.trim()}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                      >
                        {followupSubmitting ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Detailed Information Tabs */}
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white shadow-2xs">
                  {/* General Info (Clean, Non-Repetitive) */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      <span>Service & Contact Logistics</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Contact Phone</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {project.mobile || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Scaffolding Service</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] inline-block mt-0.5">
                          {project.scaffoldingType}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Salesperson Assignment</span>
                        <span className="font-medium text-slate-800">
                          {project.salespersonAssignmentType === 'MANUALLY_CHANGED' ? 'Manual Assignment' : 'Auto Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Payment State</span>
                        <span className="font-semibold text-slate-900">{project.paymentStatus.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hire Timeline */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Hire Timeline & Extensions
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Delivery Date</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {formatDateDDMMYYYY(project.deliveryDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Initial Hire Period</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {project.hirePeriodDays} Days
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Extension Days</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {project.extensionDays ? `${project.extensionDays} Days` : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Effective Due Date</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {formatDateDDMMYYYY(project.dueDate)}
                        </span>
                      </div>
                      {project.returnedDate && (
                        <div>
                          <span className="text-slate-500 block">Returned On</span>
                          <span className="font-semibold text-slate-900 font-mono">
                            {formatDateDDMMYYYY(project.returnedDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remarks */}
                  {project.remarks && (
                    <div className="p-4 space-y-1.5">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Remarks & Equipment Notes
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
                        {project.remarks}
                      </p>
                    </div>
                  )}

                  {/* Payment History */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Payment Receipts ({financials?.payments?.length || 0})
                      </h3>
                      <span className="text-xs font-bold font-mono text-emerald-600">
                        Total: {formatAED(financials?.totalReceived || 0)}
                      </span>
                    </div>

                    {!financials?.payments || financials.payments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No payments recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {financials.payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold text-slate-900">
                                {formatAED(p.paymentReceivedAmount)}
                              </span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span className="text-slate-600">{p.paymentMethod}</span>
                              {p.paymentReference && (
                                <span className="text-slate-400 font-mono ml-1.5">
                                  ({p.paymentReference})
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500 font-mono">
                              {formatDateDDMMYYYY(p.paymentReceivedDate)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CREATE / EDIT GUIDED WIZARD */}
            {(currentMode === 'create' || currentMode === 'edit') && (
              <form onSubmit={handleSaveForm} className="space-y-6">
                {/* 4-Step Progress Indicator */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { num: 1, label: 'Client' },
                    { num: 2, label: 'Timeline' },
                    { num: 3, label: 'Commercials' },
                    { num: 4, label: 'Assignment' },
                  ].map((s) => (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => setActiveStep(s.num)}
                      className={`p-2.5 rounded-lg text-left transition-all cursor-pointer border ${
                        activeStep === s.num
                          ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                          : activeStep > s.num
                          ? 'bg-blue-50 text-blue-900 border-blue-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold opacity-80">Step 0{s.num}</div>
                      <div className="text-xs font-bold truncate">{s.label}</div>
                    </button>
                  ))}
                </div>

                {/* STEP 1: CLIENT & REFERENCE */}
                {activeStep === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        list="company-list"
                        value={formData.company}
                        onChange={(e) => handleCompanyChange(e.target.value)}
                        placeholder="e.g. Apex Construction LLC"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                      />
                      <datalist id="company-list">
                        {companies.map((c) => (
                          <option key={c.id} value={c.companyName} />
                        ))}
                      </datalist>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Auto-completes contact number and default sales rep for known clients.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Contact Phone / Mobile
                        </label>
                        <input
                          type="text"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          placeholder="e.g. 052-1234567"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Project / LPO Reference <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.projectReference}
                          onChange={(e) =>
                            setFormData({ ...formData, projectReference: e.target.value })
                          }
                          placeholder="e.g. Burj View Tower Plot 12"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        Scaffolding Operation Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, scaffoldingType: 'RENTAL' })}
                          className={`p-3 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                            formData.scaffoldingType === 'RENTAL'
                              ? 'bg-blue-50/80 border-[#2563EB] text-[#2563EB] ring-1 ring-[#2563EB]'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold">RENTAL</div>
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                            Scaffold material hire only
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, scaffoldingType: 'EREC/DISM' })}
                          className={`p-3 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                            formData.scaffoldingType === 'EREC/DISM'
                              ? 'bg-blue-50/80 border-[#2563EB] text-[#2563EB] ring-1 ring-[#2563EB]'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold">EREC / DISM</div>
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                            Erection & dismantling service
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: TIMELINE & HIRE TERMS */}
                {activeStep === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Delivery Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.deliveryDate}
                          onChange={(e) =>
                            handleDateOrPeriodChange(e.target.value, formData.hirePeriodDays)
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Duration (Months)
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={Math.max(0.5, Math.round((formData.hirePeriodDays / 30) * 10) / 10)}
                          onChange={(e) => {
                            const safeMos = Math.max(0.5, parseFloat(e.target.value) || 1);
                            handleDateOrPeriodChange(formData.deliveryDate, Math.round(safeMos * 30));
                          }}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#2563EB] focus:outline-none focus:border-[#2563EB]"
                          placeholder="e.g. 13"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Hire Period (Days) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.hirePeriodDays}
                          onChange={(e) =>
                            handleDateOrPeriodChange(
                              formData.deliveryDate,
                              parseInt(e.target.value, 10) || 30
                            )
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold text-slate-800">
                            Calculated Due Date
                          </label>
                          <p className="text-[11px] text-slate-500">
                            Auto-computed: Delivery Date + Hire Days
                          </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={formData.isDueDateOverridden}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                isDueDateOverridden: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span>Manual Override</span>
                        </label>
                      </div>

                      <input
                        type="date"
                        required
                        disabled={!formData.isDueDateOverridden}
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono font-bold ${
                          formData.isDueDateOverridden
                            ? 'bg-white border-blue-400 text-blue-900'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Project Status
                        </label>
                        <select
                          value={formData.projectStatus}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              projectStatus: e.target.value as ProjectStatus,
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        >
                          <option value="ACTIVE">ACTIVE (Running On Site)</option>
                          <option value="EXTENDED">EXTENDED (Period Prolonged)</option>
                          <option value="RETURNED">RETURNED (Material in Yard)</option>
                          <option value="ON_HOLD">ON HOLD</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </div>

                      {formData.projectStatus === 'RETURNED' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            Returned Date
                          </label>
                          <input
                            type="date"
                            value={formData.returnedDate}
                            onChange={(e) =>
                              setFormData({ ...formData, returnedDate: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>
                      )}

                      {formData.projectStatus === 'EXTENDED' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            Extension Days
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.extensionDays}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                extensionDays: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: FINANCIALS & COMMERCIALS */}
                {activeStep === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Total Contract / LPO Amount (AED)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.contractAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              contractAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g. 15000"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Original Hire Amount (AED)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.originalRentalAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              originalRentalAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g. 5000"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={formData.isRecurringMonthly}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              isRecurringMonthly: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                        />
                        <span>Enable Recurring Monthly Hire (Long-Term Contracts)</span>
                      </label>

                      {formData.isRecurringMonthly && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Monthly Rate (AED/Month)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.monthlyPaymentAmount}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                monthlyPaymentAmount: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="e.g. 3000"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Initial Payment Status
                      </label>
                      <select
                        value={formData.paymentStatus}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentStatus: e.target.value as PaymentStatus,
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      >
                        <option value="NOT_PAID">NOT PAID (Full balance outstanding)</option>
                        <option value="PARTIAL_PAID">PARTIAL PAID</option>
                        <option value="PAID">PAID (Settled in Full)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* STEP 4: ASSIGNMENT & REMARKS */}
                {activeStep === 4 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Assigned Sales Engineer / Rep
                      </label>
                      <select
                        value={formData.salespersonId}
                        onChange={(e) => {
                          const rep = salespersons.find((s) => s.id === e.target.value);
                          setFormData({
                            ...formData,
                            salespersonId: e.target.value,
                            salespersonName: rep?.name || '',
                            salespersonAssignmentType: 'MANUALLY_CHANGED',
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      >
                        <option value="">— Unassigned —</option>
                        {activeSalespersons.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.mobile})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Remarks & Scaffold Equipment Notes
                      </label>
                      <textarea
                        rows={4}
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        placeholder="e.g. 50Cuplok standards, 120 ledgers, 40 steel hook-on boards, delivered with third-party tag."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs leading-relaxed text-slate-900 font-mono focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>
                )}

                {/* Wizard Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  {activeStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setActiveStep((prev) => prev - 1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {activeStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeStep === 1) {
                          if (!formData.company.trim() || !formData.projectReference.trim()) {
                            setFormError('Please enter company and project reference first.');
                            return;
                          }
                          setFormError(null);
                        }
                        setActiveStep((prev) => prev + 1);
                      }}
                      className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <span>Next Step</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Saving Project...' : currentMode === 'create' ? 'Create Project' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
