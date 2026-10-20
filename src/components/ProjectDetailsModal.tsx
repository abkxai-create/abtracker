import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  Project,
  ProjectStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentReceipt,
  ScaffoldingType,
  SalespersonAssignmentType,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  getDueStatus,
  calculateDueDate,
  addDaysToDate,
  calculateExtendedDueDate,
  calculateExtensionDetails,
  calculateTotalHireDays,
  toInputDateFormat,
} from '../utils/dateUtils';
import { formatAED } from '../utils/commercialUtils';
import { getWhatsAppUrl } from '../utils/whatsapp';
import { AnimatedNumber } from './AnimatedNumber';
import { ProjectHeaderSummary } from './ProjectHeaderSummary';
import { CommercialPaymentSummary } from './CommercialPaymentSummary';
import {
  X,
  Building,
  Phone,
  Calendar,
  Clock,
  CreditCard,
  MessageSquare,
  Shield,
  Activity,
  Plus,
  Send,
  ExternalLink,
  Edit2,
  Copy,
  Trash2,
  History,
  CheckCircle2,
  RotateCcw,
  CalendarPlus,
  PackageCheck,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
  FileText,
  Receipt,
  DollarSign,
  UserCheck,
  AlertTriangle,
  ArrowUpDown,
  Hash,
  CheckSquare,
} from 'lucide-react';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onEdit?: (project: Project) => void;
  onCopy?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onSelectCompany?: (companyName: string) => void;
  initialEditMode?: boolean;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  isOpen,
  onClose,
  project,
  onEdit,
  onCopy,
  onDelete,
  onSelectCompany,
  initialEditMode = false,
}) => {
  const { userProfile } = useAuth();
  const {
    projects,
    allProjectsEver,
    getProjectFollowups,
    getProjectActivities,
    getProjectRemarks,
    addPaymentFollowup,
    updateProject,
    getProjectFinancials,
    addPaymentReceipt,
    deletePaymentReceipt,
    companies,
    salespersons,
  } = useProjects();

  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // Real-time synced project instance from state
  const currentProject =
    projects.find((p) => p.id === project?.id) ||
    allProjectsEver.find((p) => p.id === project?.id) ||
    project;

  const authoritativeCompanyName = useMemo(() => {
    if (!currentProject) return '';
    if (currentProject.companyId) {
      const matched = companies.find((c) => c.id === currentProject.companyId);
      if (matched) return matched.companyName;
    }
    return currentProject.company;
  }, [currentProject, companies]);

  const [activeTab, setActiveTab] = useState<'overview' | 'commercial' | 'followups' | 'activity' | 'remarks'>(
    'overview'
  );

  // Payments modal state inside project
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [pmtAmount, setPmtAmount] = useState('');
  const [pmtDate, setPmtDate] = useState(toInputDateFormat(new Date()));
  const [pmtMethod, setPmtMethod] = useState<PaymentMethod>('Bank Transfer');
  const [pmtRef, setPmtRef] = useState('');
  const [pmtRemarks, setPmtRemarks] = useState('');
  const [submittingPmt, setSubmittingPmt] = useState(false);
  const [pmtError, setPmtError] = useState<string | null>(null);

  // Quick Action execution state & inline feedback
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Quick Extension custom dialog state
  const [showCustomExtend, setShowCustomExtend] = useState(false);
  const [customExtendDays, setCustomExtendDays] = useState<number>(30);

  // Quick Note inline state
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');

  // Next Month Rental Rate quick-edit state
  const [showEditNextMonthRental, setShowEditNextMonthRental] = useState(false);
  const [nextMonthRentalInput, setNextMonthRentalInput] = useState<string>('');

  // Delete payment receipt confirmation state
  const [confirmDeletePmt, setConfirmDeletePmt] = useState<PaymentReceipt | null>(null);
  const [deletingPmt, setDeletingPmt] = useState(false);

  useEffect(() => {
    if (currentProject) {
      const val = currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount;
      setNextMonthRentalInput(val ? String(val) : '');
    }
  }, [currentProject?.id, currentProject?.nextMonthRental, currentProject?.monthlyPaymentAmount]);

  // New follow-up state (Tab 2)
  const [newFollowupNotes, setNewFollowupNotes] = useState('');
  const [newFollowupDate, setNewFollowupDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);

  // Single-Page Inline Editor State
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [companySuggestions, setCompanySuggestions] = useState<typeof companies>([]);
  const [showCompanySuggest, setShowCompanySuggest] = useState(false);

  const [editFormData, setEditFormData] = useState({
    company: '',
    projectReference: '',
    salespersonId: '',
    salespersonName: '',
    salespersonAssignmentType: 'AUTO_ASSIGNED' as SalespersonAssignmentType,
    mobile: '',
    scaffoldingType: 'RENTAL' as ScaffoldingType,
    contractAmount: 0,
    nextMonthRental: 0,
    paymentTerms: '30 Days Credit',
    creditDays: 30,
    deliveryDate: toInputDateFormat(new Date()),
    hirePeriodDays: 30,
    hirePeriodMonths: 1,
    dueDate: '',
    isDueDateOverridden: false,
    extensionDays: 0,
    extensionRentalAmount: 0,
    returnedDate: '',
    projectStatus: 'ACTIVE' as ProjectStatus,
    paymentStatus: 'NOT_PAID' as PaymentStatus,
    remarks: '',
  });

  // Sync initialEditMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsEditing(initialEditMode);
    }
  }, [isOpen, initialEditMode]);

  // Sync form data whenever currentProject changes or edit mode opens
  useEffect(() => {
    if (currentProject) {
      // Base contract amount: prefer explicit originalRentalAmount; otherwise contractAmount
      const origBaseRental =
        currentProject.originalRentalAmount !== undefined && currentProject.originalRentalAmount !== null
          ? Number(currentProject.originalRentalAmount)
          : Number(currentProject.contractAmount || 0);

      setEditFormData({
        company: authoritativeCompanyName || currentProject.company || '',
        projectReference: currentProject.projectReference || '',
        salespersonId: currentProject.salespersonId || '',
        salespersonName: currentProject.salespersonName || '',
        salespersonAssignmentType: currentProject.salespersonAssignmentType || 'AUTO_ASSIGNED',
        mobile: currentProject.mobile || '',
        scaffoldingType: currentProject.scaffoldingType || 'RENTAL',
        contractAmount: origBaseRental,
        nextMonthRental: currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount ?? 0,
        paymentTerms: currentProject.paymentTerms || '30 Days Credit',
        creditDays: currentProject.creditDays || 30,
        deliveryDate: currentProject.deliveryDate || toInputDateFormat(new Date()),
        hirePeriodDays: currentProject.hirePeriodDays || 30,
        hirePeriodMonths:
          currentProject.hirePeriodMonths ||
          Math.max(1, Math.round((currentProject.hirePeriodDays || 30) / 30)),
        dueDate: currentProject.dueDate || '',
        isDueDateOverridden: Boolean(currentProject.isDueDateOverridden),
        extensionDays: currentProject.extensionDays || 0,
        extensionRentalAmount: currentProject.extensionRentalAmount || 0,
        returnedDate: currentProject.returnedDate || '',
        projectStatus: currentProject.projectStatus || 'ACTIVE',
        paymentStatus: currentProject.paymentStatus || 'NOT_PAID',
        remarks: currentProject.remarks || '',
      });
      setEditFormError(null);
    }
  }, [currentProject?.id, isEditing]);

  const handleEditCompanyInput = (text: string) => {
    setEditFormData((prev) => ({ ...prev, company: text }));
    if (text.trim().length > 0) {
      const filtered = companies.filter((c) =>
        c.companyName.toLowerCase().includes(text.toLowerCase())
      );
      setCompanySuggestions(filtered);
      setShowCompanySuggest(true);
    } else {
      setShowCompanySuggest(false);
    }
  };

  const handleSelectCompanySuggestion = (comp: typeof companies[0]) => {
    setEditFormData((prev) => ({
      ...prev,
      company: comp.companyName,
      salespersonId: comp.defaultSalespersonId || prev.salespersonId,
      salespersonName: comp.defaultSalespersonName || prev.salespersonName,
      mobile: comp.mobile || prev.mobile,
      salespersonAssignmentType: comp.defaultSalespersonId ? 'AUTO_ASSIGNED' : prev.salespersonAssignmentType,
    }));
    setShowCompanySuggest(false);
  };

  const handleEditDeliveryDateChange = (newDate: string) => {
    setEditFormData((prev) => {
      let calcDue = prev.dueDate;
      if (!prev.isDueDateOverridden && newDate) {
        calcDue = calculateDueDate(newDate, Number(prev.hirePeriodDays || 30));
        if (Number(prev.extensionDays || 0) > 0) {
          calcDue = calculateExtendedDueDate(calcDue, Number(prev.extensionDays));
        }
      }
      return {
        ...prev,
        deliveryDate: newDate,
        dueDate: calcDue,
      };
    });
  };

  const handleEditHirePeriodMonthsChange = (months: number) => {
    const safeMonths = Math.max(0.5, months);
    const calculatedDays = Math.round(safeMonths * 30);
    setEditFormData((prev) => {
      let calcDue = prev.dueDate;
      if (!prev.isDueDateOverridden && prev.deliveryDate) {
        const [y, m, d] = prev.deliveryDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1 + Math.round(safeMonths), d || 1);
        calcDue = toInputDateFormat(targetDate);
        if (Number(prev.extensionDays || 0) > 0) {
          calcDue = calculateExtendedDueDate(calcDue, Number(prev.extensionDays));
        }
      }

      // If recurring monthly rate is specified, auto-sync contract amount
      const monthlyRate = Number(prev.nextMonthRental) || 0;
      let newContract = prev.contractAmount;
      if (monthlyRate > 0) {
        const computedVal = Math.round(safeMonths * monthlyRate * 100) / 100;
        if (
          prev.contractAmount === 0 ||
          Math.abs(prev.contractAmount - (Number(prev.hirePeriodMonths || 1) * monthlyRate)) < 0.01
        ) {
          newContract = computedVal;
        }
      }

      return {
        ...prev,
        hirePeriodMonths: safeMonths,
        hirePeriodDays: calculatedDays,
        dueDate: calcDue,
        contractAmount: newContract,
      };
    });
  };

  const handleEditHirePeriodChange = (days: number) => {
    const safeDays = Math.max(1, days);
    const safeMonths = Math.max(0.5, Math.round((safeDays / 30) * 10) / 10);
    setEditFormData((prev) => {
      let calcDue = prev.dueDate;
      if (!prev.isDueDateOverridden && prev.deliveryDate) {
        calcDue = calculateDueDate(prev.deliveryDate, safeDays);
        if (Number(prev.extensionDays || 0) > 0) {
          calcDue = calculateExtendedDueDate(calcDue, Number(prev.extensionDays));
        }
      }
      return {
        ...prev,
        hirePeriodDays: safeDays,
        hirePeriodMonths: safeMonths,
        dueDate: calcDue,
      };
    });
  };

  const handleSaveInlineEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentProject || !isAdmin) return;

    if (!editFormData.company.trim()) {
      setEditFormError('Company / Client Name is required');
      return;
    }

    setSavingEdit(true);
    setEditFormError(null);
    try {
      const baseRental = Number(editFormData.contractAmount) || 0;
      const extDays = Number(editFormData.extensionDays) || 0;
      const extRental = Number(editFormData.extensionRentalAmount) || 0;
      const totalContract = extRental > 0 ? (baseRental + extRental) : baseRental;

      // Status adjustment: if extension days exist and current status is ACTIVE, mark EXTENDED
      let finalStatus = editFormData.projectStatus;
      if (extDays > 0 && finalStatus === 'ACTIVE') {
        finalStatus = 'EXTENDED';
      }

      const updates: Partial<Project> = {
        company: editFormData.company.trim(),
        projectReference: editFormData.projectReference.trim(),
        salespersonId: editFormData.salespersonId || undefined,
        salespersonName: editFormData.salespersonName || 'Unassigned',
        salespersonAssignmentType: editFormData.salespersonAssignmentType,
        mobile: editFormData.mobile.trim(),
        scaffoldingType: editFormData.scaffoldingType,
        originalRentalAmount: baseRental,
        contractAmount: totalContract,
        extensionDays: extDays,
        extensionRentalAmount: extRental,
        nextMonthRental: Number(editFormData.nextMonthRental) || 0,
        monthlyPaymentAmount: Number(editFormData.nextMonthRental) || 0,
        paymentTerms: editFormData.paymentTerms.trim() || undefined,
        creditDays: Number(editFormData.creditDays) || 30,
        deliveryDate: editFormData.deliveryDate,
        hirePeriodDays: Number(editFormData.hirePeriodDays) || 30,
        hirePeriodMonths:
          Number(editFormData.hirePeriodMonths) ||
          Math.max(1, Math.round((Number(editFormData.hirePeriodDays) || 30) / 30)),
        dueDate: editFormData.dueDate,
        isDueDateOverridden: editFormData.isDueDateOverridden,
        returnedDate: editFormData.returnedDate ? editFormData.returnedDate.trim() : null,
        projectStatus: finalStatus,
        paymentStatus: editFormData.paymentStatus,
        remarks: editFormData.remarks.trim(),
      };

      await updateProject(
        currentProject.id,
        updates,
        `Updated project details (${currentProject.projectCode}) via single-page editor`
      );

      setIsEditing(false);
      flashSuccess(`Project ${currentProject.projectCode} changes saved successfully`);
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to save project changes');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isOpen || !currentProject) return null;

  const financials = getProjectFinancials(currentProject.id);
  const dueStatus = getDueStatus(currentProject.dueDate, currentProject.projectStatus, currentProject.paymentStatus);
  const followups = getProjectFollowups(currentProject.id);
  const activities = getProjectActivities(currentProject.id);
  const remarksHistory = getProjectRemarks(currentProject.id);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmtAmount) return;
    const amountNum = Number(pmtAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPmtError('Valid payment amount required');
      return;
    }
    setSubmittingPmt(true);
    setPmtError(null);
    try {
      await addPaymentReceipt({
        projectId: currentProject.id,
        projectCode: currentProject.projectCode,
        company: currentProject.company,
        paymentReceivedDate: pmtDate,
        paymentReceivedAmount: amountNum,
        paymentMethod: pmtMethod,
        paymentReference: pmtRef.trim(),
        remarks: pmtRemarks.trim(),
      });
      setShowAddPayment(false);
      setPmtAmount('');
      setPmtRef('');
      setPmtRemarks('');
      flashSuccess('Payment receipt recorded and balance updated');
    } catch (err: any) {
      setPmtError(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPmt(false);
    }
  };

  const handleExecuteDeletePmt = async () => {
    if (!confirmDeletePmt) return;
    setDeletingPmt(true);
    try {
      const amount = confirmDeletePmt.paymentReceivedAmount;
      await deletePaymentReceipt(confirmDeletePmt.id);
      setConfirmDeletePmt(null);
      flashSuccess(`Payment receipt of ${formatAED(amount)} was deleted successfully`);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to delete payment receipt');
    } finally {
      setDeletingPmt(false);
    }
  };

  // Smart contextual WhatsApp message
  const waOverdueNotice =
    dueStatus.diffDays < 0
      ? ` Please note that the scaffolding hire period was due on ${formatDateDDMMYYYY(currentProject.dueDate)} (${Math.abs(dueStatus.diffDays)} days overdue).`
      : '';
  const waPaymentNotice =
    currentProject.paymentStatus !== 'PAID'
      ? ` Current payment status is marked as ${currentProject.paymentStatus.replace('_', ' ')}.`
      : '';

  const waUrl = getWhatsAppUrl(
    currentProject.mobile,
    `Hello ${currentProject.company}, this is regarding scaffolding project ${currentProject.projectCode} (${currentProject.projectReference}).${waOverdueNotice}${waPaymentNotice} Kindly advise on the site status.`
  );

  const flashSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // QUICK TOGGLE: Status
  const handleToggleStatus = async (newStatus: ProjectStatus) => {
    if (!currentProject || !isAdmin) return;
    if (currentProject.projectStatus === newStatus) return;

    setUpdatingAction(`status-${newStatus}`);
    setActionErrorMsg(null);
    try {
      const updates: Partial<Project> = { projectStatus: newStatus };
      if (newStatus === 'RETURNED' && !currentProject.returnedDate) {
        updates.returnedDate = toInputDateFormat(new Date());
      } else if (newStatus !== 'RETURNED' && currentProject.returnedDate) {
        updates.returnedDate = null;
      }
      await updateProject(currentProject.id, updates, `Quick-toggled status to ${newStatus}`);
      flashSuccess(`Project status set to ${newStatus}`);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to update status');
    } finally {
      setUpdatingAction(null);
    }
  };

  // QUICK TOGGLE: Payment Status
  const handleTogglePayment = async (newPayment: PaymentStatus) => {
    if (!currentProject || !isAdmin) return;
    if (currentProject.paymentStatus === newPayment) return;

    setUpdatingAction(`payment-${newPayment}`);
    setActionErrorMsg(null);
    try {
      await updateProject(
        currentProject.id,
        { paymentStatus: newPayment },
        `Quick-toggled payment status to ${newPayment}`
      );
      flashSuccess(`Payment status set to ${newPayment.replace('_', ' ')}`);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to update payment status');
    } finally {
      setUpdatingAction(null);
    }
  };

  // QUICK TOGGLE: Returned Status
  const handleToggleReturned = async () => {
    if (!currentProject || !isAdmin) return;
    const isCurrentlyReturned = currentProject.projectStatus === 'RETURNED';

    setUpdatingAction('returned');
    setActionErrorMsg(null);
    try {
      if (isCurrentlyReturned) {
        // Reactivate back to ACTIVE
        await updateProject(
          currentProject.id,
          {
            projectStatus: 'ACTIVE',
            returnedDate: null,
          },
          'Reactivated returned project to ACTIVE'
        );
        flashSuccess('Contract reactivated as ACTIVE (Returned equipment cleared)');
      } else {
        // Mark as RETURNED today
        const today = toInputDateFormat(new Date());
        await updateProject(
          currentProject.id,
          {
            projectStatus: 'RETURNED',
            returnedDate: today,
          },
          `Marked scaffolding equipment as returned on ${today}`
        );
        flashSuccess(`Scaffolding marked as RETURNED on ${formatDateDDMMYYYY(today)}`);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to update returned state');
    } finally {
      setUpdatingAction(null);
    }
  };

  // GEMINI SUGGESTION 1: Quick Hire Extension (+7, +15, +30, or Custom Days)
  const handleExtendHirePeriod = async (daysToAdd: number) => {
    if (!currentProject || !isAdmin) return;
    if (daysToAdd <= 0) return;

    setUpdatingAction(`extend-${daysToAdd}`);
    setActionErrorMsg(null);
    try {
      const isStoneCroft =
        currentProject.projectCode === 'PRJ-0076' ||
        (currentProject.company && currentProject.company.toUpperCase().includes('STONE CROFT'));

      const isAlFakher =
        currentProject.projectCode === 'PRJ-0032' ||
        (currentProject.company && currentProject.company.toUpperCase().includes('AL FAKHER'));

      // 1. Existing Due Date is authoritative
      const existingDueDate =
        currentProject.dueDate ||
        calculateDueDate(currentProject.deliveryDate, Number(currentProject.hirePeriodDays || 30));

      // 2. Check if this is an ongoing monthly recurring rental project
      const monthlyRate = Number(
        currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount ?? (isAlFakher ? 3412.5 : 0)
      );
      const isRecurring = monthlyRate > 0;

      if (isRecurring) {
        // User Rule: "also extend should be month not 30 days"
        // For monthly recurring projects, extending adds monthly cycle(s) to the recurring hire schedule.
        const monthsToAdd = Math.max(1, Math.round(daysToAdd / 30));
        const currentMonths = Number(
          currentProject.hirePeriodMonths ||
            (isAlFakher ? 15 : Math.max(1, Math.round(Number(currentProject.hirePeriodDays || 30) / 30)))
        );
        const newTotalMonths = currentMonths + monthsToAdd;
        const newTotalHireDays = newTotalMonths * 30;
        const newDueDate = calculateExtendedDueDate(existingDueDate, monthsToAdd * 30);

        const month1Base = Number(
          currentProject.originalRentalAmount !== undefined && currentProject.originalRentalAmount !== null
            ? currentProject.originalRentalAmount
            : isAlFakher
            ? 7875
            : monthlyRate
        );

        // Total contract = Month 1 Base + (newTotalMonths - 1) * monthlyRate
        const newTotalContract = month1Base + (newTotalMonths - 1) * monthlyRate;

        await updateProject(
          currentProject.id,
          {
            originalRentalAmount: month1Base,
            hirePeriodMonths: newTotalMonths,
            hirePeriodDays: newTotalHireDays,
            nextMonthRental: monthlyRate, // PRESERVE RECURRING RATE!
            monthlyPaymentAmount: monthlyRate,
            contractAmount: newTotalContract,
            extensionDays: 0,
            extensionRentalAmount: 0,
            dueDate: newDueDate,
            projectStatus: 'EXTENDED',
            isDueDateOverridden: false,
          },
          `Extended recurring monthly rental by +${monthsToAdd} Month(s) @ AED ${formatAED(monthlyRate)}/mo (Total: ${newTotalMonths} Months, Due: ${formatDateDDMMYYYY(newDueDate)}, Contract: AED ${formatAED(newTotalContract)})`
        );

        setShowCustomExtend(false);
        flashSuccess(
          `Extended recurring rental by +${monthsToAdd} Month(s)! Total: ${newTotalMonths} Months • New Due Date: ${formatDateDDMMYYYY(newDueDate)}`
        );
        return;
      }

      const prevExtDays = Number(currentProject.extensionDays || 0);

      // 3. Fixed-Term Rental Extension: Original hire period and original due date
      const origDays = Number(
        currentProject.originalHirePeriodDays ||
          (prevExtDays > 0 && currentProject.hirePeriodDays
            ? Math.max(1, currentProject.hirePeriodDays - prevExtDays)
            : isStoneCroft
            ? 20
            : currentProject.hirePeriodDays || 30)
      );

      const origDueDate =
        currentProject.originalDueDate ||
        (prevExtDays > 0 ? addDaysToDate(existingDueDate, -prevExtDays) : existingDueDate);

      const origRental = Number(
        currentProject.originalRentalAmount !== undefined
          ? currentProject.originalRentalAmount
          : isStoneCroft
          ? 2940
          : currentProject.contractAmount || 0
      );

      // 4. Extension Days & Totals
      const newExtDays = prevExtDays + daysToAdd;
      const totalHirePeriod = calculateTotalHireDays(origDays, newExtDays);
      const newDueDate = calculateExtendedDueDate(existingDueDate, daysToAdd);

      let dailyRate = 0;
      if (isStoneCroft) {
        dailyRate = 63;
      } else if (currentProject.extensionRentalAmount && prevExtDays > 0) {
        dailyRate = currentProject.extensionRentalAmount / prevExtDays;
      } else if (origDays > 0) {
        dailyRate = origRental / origDays;
      }

      const prevExtRental = Number(currentProject.extensionRentalAmount || 0);
      const addedExtRental = Math.round(daysToAdd * dailyRate * 100) / 100;
      const newExtRental = prevExtRental > 0 ? prevExtRental + addedExtRental : (isStoneCroft && newExtDays === 7 ? 441 : addedExtRental);
      const newTotalContract = origRental + newExtRental;

      await updateProject(
        currentProject.id,
        {
          originalHirePeriodDays: origDays,
          originalDueDate: origDueDate,
          originalRentalAmount: origRental,
          extensionDays: newExtDays,
          extensionRentalAmount: newExtRental,
          contractAmount: newTotalContract,
          hirePeriodDays: totalHirePeriod,
          dueDate: newDueDate,
          projectStatus: 'EXTENDED',
          isDueDateOverridden: false,
        },
        `Extended rental by +${daysToAdd} days (Original: ${origDays}d Due ${formatDateDDMMYYYY(origDueDate)}, Extension: ${newExtDays}d @ AED ${newExtRental}, Total: ${totalHirePeriod}d Due ${formatDateDDMMYYYY(newDueDate)})`
      );

      setShowCustomExtend(false);
      flashSuccess(
        `Extended rental by +${daysToAdd} days! Total: ${totalHirePeriod} Days • New Due Date: ${formatDateDDMMYYYY(newDueDate)}`
      );
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to extend hire period');
    } finally {
      setUpdatingAction(null);
    }
  };

  // GEMINI SUGGESTION 2: Quick Inline Site Note / Remark
  const handleSaveQuickNote = async () => {
    if (!currentProject || !isAdmin || !quickNoteText.trim()) return;

    setUpdatingAction('save-note');
    setActionErrorMsg(null);
    try {
      const existingRemarks = currentProject.remarks?.trim() || '';
      const timestamp = formatDateTimeDDMMYYYY(new Date());
      const newRemarks = existingRemarks
        ? `${existingRemarks}\n[${timestamp}] ${quickNoteText.trim()}`
        : `[${timestamp}] ${quickNoteText.trim()}`;

      await updateProject(
        currentProject.id,
        { remarks: newRemarks },
        `Added site note: ${quickNoteText.trim().substring(0, 50)}...`
      );

      setQuickNoteText('');
      setShowQuickNote(false);
      flashSuccess('Site note recorded and saved to project remarks');
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to save note');
    } finally {
      setUpdatingAction(null);
    }
  };

  // Quick Update: Next Month Rental Rate
  const handleUpdateNextMonthRental = async (newVal: number) => {
    if (!currentProject || !isAdmin) return;
    setUpdatingAction('update-next-month-rental');
    setActionErrorMsg(null);
    try {
      await updateProject(
        currentProject.id,
        {
          nextMonthRental: newVal > 0 ? newVal : undefined,
          monthlyPaymentAmount: newVal > 0 ? newVal : undefined,
        },
        `Updated Next Month Rental Rate to AED ${newVal} (materials on site)`
      );
      setShowEditNextMonthRental(false);
      flashSuccess(
        newVal > 0
          ? `Next Month Rental Rate set to AED ${formatAED(newVal)}/mo (materials on site, no delivery charges)`
          : 'Next Month Rental Rate cleared'
      );
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to update next month rental rate');
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFollowupNotes.trim()) return;

    setSubmittingFollowup(true);
    setFollowupError(null);
    try {
      await addPaymentFollowup(currentProject.id, newFollowupNotes.trim(), newFollowupDate);
      setNewFollowupNotes('');
    } catch (err: any) {
      setFollowupError(err.message || 'Failed to add follow-up record');
    } finally {
      setSubmittingFollowup(false);
    }
  };

  const isReturned = currentProject.projectStatus === 'RETURNED';

  return (
    <AnimatePresence>
      {isOpen && currentProject && (
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
            className="relative bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-4xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden z-10"
          >
            {/* UNIFIED MODAL HEADER (Single, Bold, Non-Repetitive) */}
            <div className="bg-[#0F172A] text-white px-5 py-4 sm:px-6 sm:py-4.5 rounded-t-2xl border-b border-[#1E293B] shadow-sm relative shrink-0">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Side: Bold Company Name, Project Code, Reference & Salesperson */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Row 1: Code Badge + Big Bold Company Name */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-black bg-[#2563EB] text-white px-2.5 py-1 rounded-lg tabular-nums shadow-2xs tracking-wide">
                      {currentProject.projectCode}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate max-w-xl flex items-center gap-2">
                      <span>{authoritativeCompanyName}</span>
                      {onSelectCompany && authoritativeCompanyName && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectCompany(authoritativeCompanyName);
                          }}
                          className="text-[10px] font-semibold text-blue-300 hover:text-white bg-blue-900/60 hover:bg-blue-800 px-2 py-0.5 rounded border border-blue-700/60 transition cursor-pointer"
                          title="Open Company Profile Dossier"
                        >
                          Company Profile ↗
                        </button>
                      )}
                    </h2>
                  </div>

                  {/* Row 2: Bold Reference & Bold Salesperson (Clean, High-Contrast Badges) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Bold Reference Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0284C7]/20 border border-[#38BDF8]/40 text-sky-200 shadow-2xs">
                      <Hash className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-sky-300">Reference:</span>
                      <span className="font-mono font-black text-xs sm:text-sm text-[#38BDF8] truncate max-w-xs">
                        {currentProject.projectReference || currentProject.lpoNumber || 'None'}
                      </span>
                    </div>

                    {/* Bold Salesperson Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 shadow-2xs">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Salesperson:</span>
                      <span className="font-black text-xs sm:text-sm text-white">
                        {currentProject.salespersonName || 'Unassigned'}
                      </span>
                    </div>

                    {/* Monthly Rental / Extension if applicable */}
                    {financials.hasExtension && financials.extensionRentalAmount && financials.extensionRentalAmount > 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D97706]/20 border border-[#F59E0B]/40 text-amber-200">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-300">Extension:</span>
                        <span className="font-mono font-black text-xs text-[#FBBF24]">
                          {formatAED(financials.extensionRentalAmount)} ({financials.extensionDays || 7}d)
                        </span>
                      </div>
                    ) : (currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount) ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300">
                        <span className="text-[10.5px] font-medium text-slate-400">Monthly:</span>
                        <span className="font-mono font-bold text-xs text-[#38BDF8]">
                          {formatAED(currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount)}/mo
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right Side: Financial Totals Pill + Properly Aligned Close Button */}
                <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                  {/* Financial Pill Box with clean typography, centered alignment and count-up animations */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center bg-[#131F37] hover:bg-[#16243F] transition-colors p-1.5 sm:p-2 rounded-xl border border-[#2A3B5C] shadow-sm divide-x divide-[#22314E]"
                  >
                    {/* TOTAL */}
                    <div className="px-3 sm:px-3.5 py-1 text-center min-w-[78px] sm:min-w-[90px]">
                      <span className="text-[9.5px] font-bold text-[#8EA0C1] uppercase tracking-wider block">
                        TOTAL
                      </span>
                      <div className="flex items-baseline justify-center gap-1 mt-0.5">
                        <span className="text-[9px] font-bold text-[#62779F]">AED</span>
                        <AnimatedNumber
                          value={financials.contractAmount}
                          duration={320}
                          format={(n) =>
                            n.toLocaleString('en-US', {
                              minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
                              maximumFractionDigits: 2,
                            })
                          }
                          className="font-black text-xs sm:text-sm text-white font-mono tabular-nums tracking-tight"
                        />
                      </div>
                    </div>

                    {/* PAID */}
                    <div className="px-3 sm:px-3.5 py-1 text-center min-w-[78px] sm:min-w-[90px]">
                      <span className="text-[9.5px] font-bold text-[#4ADE80] uppercase tracking-wider block">
                        PAID
                      </span>
                      <div className="flex items-baseline justify-center gap-1 mt-0.5">
                        <span className="text-[9px] font-bold text-[#16A34A]">AED</span>
                        <AnimatedNumber
                          value={financials.totalReceived}
                          duration={320}
                          format={(n) =>
                            n.toLocaleString('en-US', {
                              minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
                              maximumFractionDigits: 2,
                            })
                          }
                          className="font-black text-xs sm:text-sm text-[#4ADE80] font-mono tabular-nums tracking-tight"
                        />
                      </div>
                    </div>

                    {/* OVERDUE / BALANCE */}
                    <div className="px-3 sm:px-3.5 py-1 text-center min-w-[78px] sm:min-w-[90px]">
                      <div className="flex items-center justify-center gap-1">
                        {financials.isOverdue && financials.outstandingAmount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-pulse" />
                        )}
                        <span
                          className={`text-[9.5px] font-bold uppercase tracking-wider block ${
                            financials.outstandingAmount === 0
                              ? 'text-[#4ADE80]'
                              : financials.isOverdue
                              ? 'text-[#F87171]'
                              : 'text-[#FBBF24]'
                          }`}
                        >
                          {financials.outstandingAmount === 0 ? 'BALANCE' : financials.isOverdue ? 'OVERDUE' : 'BALANCE'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-center gap-1 mt-0.5">
                        <span
                          className={`text-[9px] font-bold ${
                            financials.outstandingAmount === 0
                              ? 'text-[#16A34A]'
                              : financials.isOverdue
                              ? 'text-[#DC2626]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          AED
                        </span>
                        <AnimatedNumber
                          value={financials.outstandingAmount}
                          duration={320}
                          format={(n) =>
                            n.toLocaleString('en-US', {
                              minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
                              maximumFractionDigits: 2,
                            })
                          }
                          className={`font-black text-xs sm:text-sm font-mono tabular-nums tracking-tight ${
                            financials.outstandingAmount === 0
                              ? 'text-[#86EFAC]'
                              : financials.isOverdue
                              ? 'text-[#F87171]'
                              : 'text-[#FBBF24]'
                          }`}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Direct Edit Toggle Button in Overview Header */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing((prev) => !prev);
                        setEditFormError(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0 ${
                        isEditing
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600'
                          : 'bg-[#2563EB] hover:bg-blue-600 text-white shadow-sm'
                      }`}
                      title={isEditing ? 'Cancel editing and return to overview' : 'Edit project directly in this window'}
                    >
                      {isEditing ? (
                        <>
                          <X className="w-3.5 h-3.5 text-slate-300" />
                          <span>Cancel Edit</span>
                        </>
                      ) : (
                        <>
                          <Edit2 className="w-3.5 h-3.5 text-blue-200" />
                          <span>Edit Project</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Clean Dedicated Close Button with proper spacing and hover */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[#1E293B] hover:bg-[#334155] text-slate-300 hover:text-white flex items-center justify-center transition-all duration-150 border border-[#334155] shadow-xs cursor-pointer active:scale-90 shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {isEditing ? (
              /* SINGLE-PAGE INLINE EDIT FORM (Grouped Clean Cards, Zero Next-Button Friction) */
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#F8FAFC]">
                {/* Header Edit Guidance Banner */}
                <div className="p-3.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl flex items-center justify-between text-xs text-[#1D4ED8]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
                    <div>
                      <span className="font-bold">Single-Page Project Editor:</span> Modify any details directly on this page. Clicking Save Changes updates project records instantly.
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-black text-[#2563EB] bg-white px-2.5 py-0.5 rounded-lg border border-[#BFDBFE] shrink-0 shadow-2xs">
                    {currentProject.projectCode}
                  </span>
                </div>

                {editFormError && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                    <span>{editFormError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveInlineEdit} className="space-y-5 text-xs sm:text-sm">
                  {/* Card 1: Client & Reference Identification */}
                  <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB]">
                          <Building className="w-4 h-4" />
                        </div>
                        <h3 className="font-black text-sm text-[#0F172A] uppercase tracking-tight">
                          1. Customer & Reference Identification
                        </h3>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {currentProject.projectCode}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Company Name with live suggestions */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Company / Client Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.company}
                          onChange={(e) => handleEditCompanyInput(e.target.value)}
                          onFocus={() => {
                            if (editFormData.company.trim().length > 0) setShowCompanySuggest(true);
                          }}
                          placeholder="e.g. Al Habtoor Engineering"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />

                        {/* Company Suggestion Dropdown */}
                        {showCompanySuggest && companySuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {companySuggestions.slice(0, 6).map((comp) => (
                              <button
                                key={comp.id}
                                type="button"
                                onClick={() => handleSelectCompanySuggestion(comp)}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                              >
                                <div>
                                  <span className="font-bold text-[#0F172A] block">{comp.companyName}</span>
                                  {comp.mobile && <span className="text-[10px] text-slate-400 font-mono">{comp.mobile}</span>}
                                </div>
                                {comp.defaultSalespersonName && (
                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {comp.defaultSalespersonName}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Client Reference / LPO */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Project Reference / LPO No.
                        </label>
                        <input
                          type="text"
                          value={editFormData.projectReference}
                          onChange={(e) => setEditFormData({ ...editFormData, projectReference: e.target.value })}
                          placeholder="e.g. LPO-8821 / Site Plot 4B"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Salesperson Assignment */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-[#334155]">
                            Salesperson
                          </label>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {editFormData.salespersonAssignmentType === 'AUTO_ASSIGNED' ? 'Auto-Assigned' : 'Manual Assignment'}
                          </span>
                        </div>
                        <select
                          value={editFormData.salespersonId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const sp = salespersons.find((s) => s.id === selectedId);
                            setEditFormData({
                              ...editFormData,
                              salespersonId: selectedId,
                              salespersonName: sp ? sp.name : 'Unassigned',
                              salespersonAssignmentType: 'MANUALLY_CHANGED',
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {salespersons.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Contact Mobile */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Contact Mobile (WhatsApp)
                        </label>
                        <input
                          type="text"
                          value={editFormData.mobile}
                          onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                          placeholder="e.g. 050-1234567"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Commercial Terms & Pricing */}
                  <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-[#16A34A]">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-sm text-[#0F172A] uppercase tracking-tight">
                        2. Commercial Terms & Pricing
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Scaffolding Service Type */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Service Type
                        </label>
                        <select
                          value={editFormData.scaffoldingType}
                          onChange={(e) => setEditFormData({ ...editFormData, scaffoldingType: e.target.value as ScaffoldingType })}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                        >
                          <option value="RENTAL">RENTAL</option>
                          <option value="SALES">SALES</option>
                          <option value="HIRE & SALE">HIRE & SALE</option>
                          <option value="CONTRACTING">CONTRACTING</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>

                      {/* Contract / Base Rental Amount */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-[#334155]">
                            {Number(editFormData.extensionRentalAmount || 0) > 0 || Number(editFormData.extensionDays || 0) > 0
                              ? 'Original Base Rental (AED)'
                              : 'Total Contract Amount (AED)'}
                          </label>
                          {Number(editFormData.extensionRentalAmount || 0) > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              + Ext: {formatAED(editFormData.extensionRentalAmount)}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            AED
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editFormData.contractAmount}
                            onChange={(e) => setEditFormData({ ...editFormData, contractAmount: Number(e.target.value) || 0 })}
                            className="w-full pl-12 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                          />
                        </div>
                        {Number(editFormData.extensionRentalAmount || 0) > 0 && (
                          <div className="mt-1.5 p-2 bg-amber-50/90 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                            <span>
                              <strong>Total Contract:</strong> {formatAED((Number(editFormData.contractAmount) || 0) + (Number(editFormData.extensionRentalAmount) || 0))}
                            </span>
                            <span className="text-[10px] text-amber-700 font-medium">
                              (Base {formatAED(editFormData.contractAmount)} + Ext {formatAED(editFormData.extensionRentalAmount)})
                            </span>
                          </div>
                        )}
                        {editFormData.nextMonthRental > 0 && !editFormData.extensionRentalAmount && (
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-[#2563EB] font-semibold">
                              💡 Contract Calc: {editFormData.hirePeriodMonths || 1} mos × {formatAED(editFormData.nextMonthRental)} = {formatAED((editFormData.hirePeriodMonths || 1) * editFormData.nextMonthRental)}
                            </span>
                            {editFormData.contractAmount !== (editFormData.hirePeriodMonths || 1) * editFormData.nextMonthRental && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditFormData({
                                    ...editFormData,
                                    contractAmount:
                                      Math.round(
                                        (editFormData.hirePeriodMonths || 1) *
                                          editFormData.nextMonthRental *
                                          100
                                      ) / 100,
                                  })
                                }
                                className="text-[10px] text-[#2563EB] hover:underline font-bold cursor-pointer"
                              >
                                Set to {formatAED((editFormData.hirePeriodMonths || 1) * editFormData.nextMonthRental)}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Next Month Rental Rate */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Next Month Rental (AED/mo)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            AED
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editFormData.nextMonthRental}
                            onChange={(e) => setEditFormData({ ...editFormData, nextMonthRental: Number(e.target.value) || 0 })}
                            placeholder="Optional recurring rate"
                            className="w-full pl-12 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                          />
                        </div>
                      </div>

                      {/* Payment Terms */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Payment Terms
                        </label>
                        <input
                          type="text"
                          value={editFormData.paymentTerms}
                          onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: e.target.value })}
                          placeholder="e.g. 30 Days Credit, 100% Advance"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Credit Period Days */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Credit Period (Days)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editFormData.creditDays}
                          onChange={(e) => setEditFormData({ ...editFormData, creditDays: Number(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Hire Timeline & Dates */}
                  <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-sm text-[#0F172A] uppercase tracking-tight">
                        3. Hire Timeline & Milestones
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* Delivery Date */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Delivery Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editFormData.deliveryDate}
                          onChange={(e) => handleEditDeliveryDateChange(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Hire Duration (Months) */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Duration (Months)
                        </label>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={editFormData.hirePeriodMonths}
                          onChange={(e) => handleEditHirePeriodMonthsChange(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-bold text-[#2563EB] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                          placeholder="e.g. 13"
                        />
                      </div>

                      {/* Hire Period (Days) */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Hire Period (Days) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={editFormData.hirePeriodDays}
                          onChange={(e) => handleEditHirePeriodChange(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                          placeholder="e.g. 390"
                        />
                      </div>

                      {/* Due Date with Manual Override Toggle */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-[#334155]">
                            Due Date
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editFormData.isDueDateOverridden}
                              onChange={(e) => setEditFormData({ ...editFormData, isDueDateOverridden: e.target.checked })}
                              className="rounded text-[#2563EB] focus:ring-0"
                            />
                            <span className="text-[10px] font-semibold text-amber-700">Override</span>
                          </label>
                        </div>
                        <input
                          type="date"
                          value={editFormData.dueDate}
                          disabled={!editFormData.isDueDateOverridden}
                          onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm font-mono font-bold ${
                            editFormData.isDueDateOverridden
                              ? 'bg-amber-50 border-amber-300 text-amber-900 focus:outline-none focus:border-[#2563EB]'
                              : 'bg-slate-50 border-[#CBD5E1] text-[#0F172A] cursor-not-allowed opacity-90'
                          }`}
                        />
                      </div>

                      {/* Extension Days */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Extension Days
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editFormData.extensionDays}
                          onChange={(e) => setEditFormData({ ...editFormData, extensionDays: Number(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Extension Rental Amount */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Extension Rental Amount (AED)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editFormData.extensionRentalAmount}
                          onChange={(e) => setEditFormData({ ...editFormData, extensionRentalAmount: Number(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Equipment Returned Date */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-[#334155]">
                            Returned Date
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditFormData({
                                ...editFormData,
                                returnedDate: toInputDateFormat(new Date()),
                                projectStatus: 'RETURNED'
                              })}
                              className="text-[10px] text-[#2563EB] hover:underline font-bold cursor-pointer"
                            >
                              Today
                            </button>
                            {editFormData.returnedDate && (
                              <button
                                type="button"
                                onClick={() => setEditFormData({
                                  ...editFormData,
                                  returnedDate: '',
                                  projectStatus: editFormData.projectStatus === 'RETURNED' ? 'ACTIVE' : editFormData.projectStatus
                                })}
                                className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="date"
                          value={editFormData.returnedDate || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditFormData({
                              ...editFormData,
                              returnedDate: val,
                              projectStatus: val ? 'RETURNED' : (editFormData.projectStatus === 'RETURNED' ? 'ACTIVE' : editFormData.projectStatus)
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Status & Operational Notes */}
                  <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
                      <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-sm text-[#0F172A] uppercase tracking-tight">
                        4. Project Status & Operational Notes
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Project Status */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Project Operational Status
                        </label>
                        <select
                          value={editFormData.projectStatus}
                          onChange={(e) => setEditFormData({ ...editFormData, projectStatus: e.target.value as ProjectStatus })}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="EXTENDED">EXTENDED</option>
                          <option value="RETURNED">RETURNED</option>
                          <option value="CLOSED">CLOSED</option>
                          <option value="ON_HOLD">ON_HOLD</option>
                        </select>
                      </div>

                      {/* Payment Status */}
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Payment Commercial Status
                        </label>
                        <select
                          value={editFormData.paymentStatus}
                          onChange={(e) => setEditFormData({ ...editFormData, paymentStatus: e.target.value as PaymentStatus })}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                        >
                          <option value="NOT_PAID">NOT_PAID</option>
                          <option value="PARTIAL_PAID">PARTIAL_PAID</option>
                          <option value="PAID">PAID</option>
                        </select>
                      </div>

                      {/* Remarks & Notes */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Remarks & Site Notes
                        </label>
                        <textarea
                          rows={3}
                          value={editFormData.remarks}
                          onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                          placeholder="Operational details, site delivery access instructions, commercial agreements..."
                          className="w-full p-3 bg-white border border-[#CBD5E1] rounded-xl text-xs leading-relaxed text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* 3. PROJECT STATUS BAR (Compact One-Row Status, Level 3) */}
                <div className="px-5 py-2 sm:px-6 sm:py-2.5 bg-white border-b border-[#E4E7EC] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
            {/* Status pill badge */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                currentProject.projectStatus === 'ACTIVE'
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                  : currentProject.projectStatus === 'EXTENDED'
                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                  : currentProject.projectStatus === 'RETURNED'
                  ? 'bg-[#F1F5F9] text-[#475467] border-[#CBD5E1]'
                  : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
              }`}
            >
              STATUS: {currentProject.projectStatus}
            </span>

            {/* Payment pill badge */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                currentProject.paymentStatus === 'PAID'
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                  : currentProject.paymentStatus === 'PARTIAL_PAID'
                  ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
              }`}
            >
              PAYMENT: {currentProject.paymentStatus.replace('_', ' ')}
            </span>

            {/* Returned date or Due date pill badge */}
            {currentProject.returnedDate ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#475467] border border-[#CBD5E1]">
                RETURNED: {formatDateDDMMYYYY(currentProject.returnedDate)}
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${dueStatus.badgeColorClass}`}
              >
                {dueStatus.label}
              </span>
            )}

            {/* Extension or Monthly Rental pill badge (NEVER Next Mo for extensions!) */}
            {financials.hasExtension ? (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                title={`Extension Rental: ${formatAED(financials.extensionRentalAmount)} for ${financials.extensionDays || 7} days immediately following original hire`}
              >
                EXTENSION ({financials.extensionDays || 7}D): {formatAED(financials.extensionRentalAmount)}
              </span>
            ) : (financials.nextMonthRental ?? currentProject.nextMonthRental) ? (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                title="Subsequent months recurring rental rate (materials on site)"
              >
                MONTHLY: {formatAED(financials.nextMonthRental ?? currentProject.nextMonthRental)}/mo
              </span>
            ) : null}
          </div>

          {/* Quick utility shortcuts: WhatsApp & Quick Note */}
          <div className="flex items-center gap-2 ml-auto">
            {currentProject.mobile && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#16A34A] hover:bg-green-700 text-white rounded-md font-medium text-xs transition cursor-pointer shadow-2xs"
                title="Message on WhatsApp"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.77.813 2.797.814 3.179 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.769-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.06-2.029-.485-1.571-.643-2.583-2.247-2.662-2.35-.078-.103-.637-.847-.637-1.616 0-.769.403-1.147.547-1.303.144-.155.312-.194.417-.194.103 0 .208.001.298.006.096.005.223-.036.349.266.13.312.443 1.077.482 1.156.039.078.065.17.013.273-.052.104-.078.169-.156.26-.078.091-.163.203-.234.273-.078.078-.16.163-.069.319.091.156.405.669.87 1.082.599.532 1.103.697 1.259.775.156.078.248.065.339-.039.091-.104.391-.456.495-.612.104-.156.208-.13.349-.078.144.052.912.43 1.069.508.156.078.26.117.298.182.039.065.039.378-.105.783z" />
                </svg>
                <span>WhatsApp</span>
              </a>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowQuickNote(!showQuickNote)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs"
                title="Quick note"
              >
                <FileText className="w-3 h-3 text-[#6B7280]" />
                <span>+ Note</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E4E7EC] px-5 sm:px-6 bg-[#F8FAFC] text-xs font-medium overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#2563EB] text-[#2563EB] font-bold'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Project Overview
          </button>
          <button
            onClick={() => setActiveTab('commercial')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'commercial'
                ? 'border-[#2563EB] text-[#2563EB] font-bold'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Commercial & Payments ({financials.payments.length})
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'followups'
                ? 'border-[#2563EB] text-[#2563EB] font-bold'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Payment Follow-Ups ({followups.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'activity'
                ? 'border-[#2563EB] text-[#2563EB] font-bold'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Audit History ({activities.length})
          </button>
          <button
            onClick={() => setActiveTab('remarks')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'remarks'
                ? 'border-[#2563EB] text-[#2563EB] font-bold'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Remarks History ({remarksHistory.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 space-y-4 text-xs sm:text-sm">
          {/* Action Success / Error Notifications */}
          {actionSuccessMsg && (
            <div className="p-2.5 bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {actionErrorMsg && (
            <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>{actionErrorMsg}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* 4. QUICK ACTIONS (Compact, Level 4) */}
              {isAdmin && (
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                    <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Quick Actions</span>
                      {updatingAction && (
                        <Loader2 className="w-3.5 h-3.5 text-[#2563EB] animate-spin ml-1" />
                      )}
                    </h3>
                    <span className="text-[11px] text-[#6B7280]">Instant one-click updates</span>
                  </div>

                  {/* 3 Groups Aligned Horizontally */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Group 1: PROJECT STATUS */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block">
                        Project Status
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={updatingAction !== null}
                          onClick={() => handleToggleStatus('ACTIVE')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                            currentProject.projectStatus === 'ACTIVE'
                              ? 'bg-[#16A34A] text-white shadow-2xs'
                              : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#16A34A] hover:text-[#16A34A]'
                          }`}
                        >
                          Active
                        </button>

                        <button
                          type="button"
                          disabled={updatingAction !== null}
                          onClick={() => handleToggleStatus('EXTENDED')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                            currentProject.projectStatus === 'EXTENDED'
                              ? 'bg-[#2563EB] text-white shadow-2xs'
                              : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB]'
                          }`}
                        >
                          Extended
                        </button>

                        <button
                          type="button"
                          disabled={updatingAction !== null}
                          onClick={() => handleToggleStatus('CLOSED')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                            currentProject.projectStatus === 'CLOSED'
                              ? 'bg-[#475467] text-white shadow-2xs'
                              : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#475467] hover:text-[#172033]'
                          }`}
                        >
                          Closed
                        </button>

                        {/* Only show Reactivate / Undo Return when project is Returned */}
                        {isReturned && (
                          <button
                            type="button"
                            disabled={updatingAction !== null}
                            onClick={handleToggleReturned}
                            className="px-2.5 py-1 bg-white hover:bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-md text-xs font-medium transition cursor-pointer shadow-2xs flex items-center gap-1"
                            title="Reactivate project back to Active"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reactivate</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group 2: PAYMENT STATUS */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block">
                        Payment Status
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={updatingAction !== null}
                          onClick={() => handleTogglePayment('NOT_PAID')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                            currentProject.paymentStatus === 'NOT_PAID'
                              ? 'bg-[#DC2626] text-white shadow-2xs'
                              : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#DC2626] hover:text-[#DC2626]'
                          }`}
                        >
                          Not Paid
                        </button>

                        <button
                          type="button"
                          disabled={updatingAction !== null}
                          onClick={() => handleTogglePayment('PARTIAL_PAID')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                            currentProject.paymentStatus === 'PARTIAL_PAID'
                              ? 'bg-[#D97706] text-white shadow-2xs'
                              : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#D97706] hover:text-[#D97706]'
                          }`}
                        >
                          Partial Paid
                        </button>

                        <button
                          type="button"
                          disabled={updatingAction !== null}
                          onClick={() => handleTogglePayment('PAID')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                            currentProject.paymentStatus === 'PAID'
                              ? 'bg-[#16A34A] text-white shadow-2xs'
                              : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#16A34A] hover:text-[#16A34A]'
                          }`}
                        >
                          Paid in Full
                        </button>
                      </div>
                    </div>

                    {/* Group 3: RENTAL */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block">
                        Rental
                      </span>
                      {Number(currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount ?? (currentProject.projectCode === 'PRJ-0032' ? 3412.5 : 0)) > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => handleExtendHirePeriod(30)}
                            className="px-2 py-1 bg-white border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] text-[#374151] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs disabled:opacity-40"
                            title="Extend recurring monthly hire by 1 month"
                          >
                            +1 Month
                          </button>
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => handleExtendHirePeriod(60)}
                            className="px-2 py-1 bg-white border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] text-[#374151] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs disabled:opacity-40"
                            title="Extend recurring monthly hire by 2 months"
                          >
                            +2 Months
                          </button>
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => handleExtendHirePeriod(90)}
                            className="px-2 py-1 bg-white border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] text-[#374151] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs disabled:opacity-40"
                            title="Extend recurring monthly hire by 3 months"
                          >
                            +3 Months
                          </button>
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => setShowCustomExtend(!showCustomExtend)}
                            className={`px-2 py-1 font-medium rounded-md text-xs transition cursor-pointer border disabled:opacity-40 ${
                              showCustomExtend
                                ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                                : 'bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            Custom
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => handleExtendHirePeriod(7)}
                            className="px-2 py-1 bg-white border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] text-[#374151] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs disabled:opacity-40"
                            title="Extend by 7 days"
                          >
                            +7 Days
                          </button>
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => handleExtendHirePeriod(15)}
                            className="px-2 py-1 bg-white border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] text-[#374151] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs disabled:opacity-40"
                            title="Extend by 15 days"
                          >
                            +15 Days
                          </button>
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => handleExtendHirePeriod(30)}
                            className="px-2 py-1 bg-white border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] text-[#374151] font-medium rounded-md text-xs transition cursor-pointer shadow-2xs disabled:opacity-40"
                            title="Extend by 30 days"
                          >
                            +30 Days
                          </button>
                          <button
                            type="button"
                            disabled={updatingAction !== null || isReturned}
                            onClick={() => setShowCustomExtend(!showCustomExtend)}
                            className={`px-2 py-1 font-medium rounded-md text-xs transition cursor-pointer border disabled:opacity-40 ${
                              showCustomExtend
                                ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                                : 'bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            Custom
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline Custom Extend Form */}
                  {showCustomExtend && (
                    <div className="pt-2 border-t border-[#E4E7EC] flex flex-wrap items-center gap-2.5 text-xs animate-in fade-in">
                      <span className="font-medium text-[#374151]">Days to add:</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={customExtendDays}
                        onChange={(e) => setCustomExtendDays(Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-white border border-[#D1D5DB] rounded-md text-xs font-bold text-[#111827] focus:outline-none focus:border-[#2563EB]"
                      />
                      <span className="text-[#6B7280]">
                        New Due:{' '}
                        <strong className="text-[#2563EB]">
                          {formatDateDDMMYYYY(
                            calculateExtendedDueDate(
                              currentProject.dueDate,
                              Number(customExtendDays || 0)
                            )
                          )}
                        </strong>
                        <span className="ml-1 text-[11px] text-[#6B7280]">
                          ({(Number(currentProject.hirePeriodDays || 0) + Number(customExtendDays || 0))} Total Days)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExtendHirePeriod(Number(customExtendDays))}
                        className="px-2.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white font-medium rounded-md text-xs cursor-pointer shadow-2xs"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomExtend(false)}
                        className="text-[#6B7280] hover:text-[#111827] text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* EXTENSION RENTAL CHARGE (When extension active) OR MONTHLY RENTAL OPTION */}
                  <div className="pt-2.5 border-t border-[#E4E7EC] flex flex-wrap items-center justify-between gap-2 text-xs">
                    {financials.hasExtension ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-[#B45309] uppercase tracking-wider block">
                          Extension Rental:
                        </span>
                        <span className="font-bold text-xs text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#FDE68A] tabular-nums">
                          {formatAED(financials.extensionRentalAmount)} ({financials.extensionDays || 7} Days)
                        </span>
                        <span className="text-[10px] text-[#6B7280]">
                          (Original Hire: {financials.originalHirePeriodDays || 20}d @ {formatAED(financials.originalRentalAmount)} • Total Contract Value: {formatAED(financials.contractAmount)})
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block">
                          Monthly Rental Rate:
                        </span>
                        <span className="font-bold text-xs text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE] tabular-nums">
                          {(currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount)
                            ? `${formatAED(currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount)} / Month`
                            : 'Not Configured'}
                        </span>
                        <span className="text-[10px] text-[#6B7280] hidden sm:inline">
                          (applied when materials are on site, no delivery/pickup charges)
                        </span>
                      </div>
                    )}

                    {isAdmin && !financials.hasExtension && (
                      <div className="flex items-center gap-1.5">
                        {showEditNextMonthRental ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleUpdateNextMonthRental(Number(nextMonthRentalInput) || 0);
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#667085]">
                                AED
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={nextMonthRentalInput}
                                onChange={(e) => setNextMonthRentalInput(e.target.value)}
                                placeholder="e.g. 5000"
                                className="w-28 pl-8 pr-2 py-0.5 bg-white border border-[#2563EB] rounded-md text-xs font-bold text-[#172033] focus:outline-none"
                                autoFocus
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={updatingAction !== null}
                              className="px-2.5 py-0.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-md text-xs font-bold transition cursor-pointer shadow-2xs"
                            >
                              Save Rate
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowEditNextMonthRental(false)}
                              className="px-1.5 py-0.5 text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const val = currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount;
                              setNextMonthRentalInput(val ? String(val) : '');
                              setShowEditNextMonthRental(true);
                            }}
                            className="px-2.5 py-0.5 bg-white hover:bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-md text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
                            title="Edit monthly recurring rental rate option"
                          >
                            <span>✏️ Set Monthly Recurring Option</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline Quick Site Note Area */}
              {showQuickNote && (
                <div className="p-3 bg-white border border-[#E4E7EC] rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#172033] text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Append Site Note to Remarks</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickNote(false)}
                      className="text-[#6B7280] hover:text-[#111827] text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder="e.g. Scaffolding inspection completed; site engineer requested partial dismantle..."
                    className="w-full p-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] placeholder:text-[#9CA3AF]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!quickNoteText.trim() || updatingAction === 'save-note'}
                      onClick={handleSaveQuickNote}
                      className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {updatingAction === 'save-note' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>Save Note</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. LEVEL 5: ADDITIONAL PROJECT INFORMATION / NOTES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Client & Service Info */}
                <div className="p-3.5 bg-white rounded-xl border border-[#E4E7EC] space-y-2 text-xs">
                  <h4 className="font-bold text-[#172033] border-b border-[#E4E7EC] pb-1.5 flex items-center gap-1.5 text-xs">
                    <Building className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Equipment & Contact Logistics</span>
                  </h4>
                  <div className="space-y-1.5 text-[#4B5563]">
                    <div className="flex justify-between items-center">
                      <span>Service Type:</span>
                      <span className="font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE] text-[11px]">
                        {currentProject.scaffoldingType}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Contact Mobile:</span>
                      <span className="font-mono font-medium text-[#111827]">
                        {currentProject.mobile || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Assignment Mode:</span>
                      <span className="font-medium text-[#111827]">
                        {currentProject.salespersonAssignmentType === 'MANUALLY_CHANGED' ? 'Manual Assignment' : 'Auto Assignment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rental Timeline */}
                <div className="p-3.5 bg-white rounded-xl border border-[#E4E7EC] space-y-2 text-xs">
                  <h4 className="font-bold text-[#172033] border-b border-[#E4E7EC] pb-1.5 flex items-center gap-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Rental Timeline</span>
                  </h4>
                  <div className="space-y-1.5 text-[#4B5563]">
                    <div className="flex justify-between items-center">
                      <span>Hire Period:</span>
                      <span className="font-bold text-[#111827] tabular-nums">
                        {currentProject.hirePeriodDays} Days
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Delivery Date:</span>
                      <span className="font-medium text-[#111827] tabular-nums">
                        {formatDateDDMMYYYY(currentProject.deliveryDate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Due Date:</span>
                      <span className="font-bold text-[#111827] tabular-nums flex items-center gap-1">
                        {formatDateDDMMYYYY(currentProject.dueDate)}
                        {currentProject.isDueDateOverridden && (
                          <span className="text-[9px] text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] px-1 py-0.2 rounded font-medium">
                            Override
                          </span>
                        )}
                      </span>
                    </div>
                    {financials.hasExtension ? (
                      <div className="flex justify-between items-center">
                        <span title="Scaffolding hire extension charge">
                          Extension Rental Charge:
                        </span>
                        <span className="font-bold text-[#B45309] tabular-nums text-xs">
                          {formatAED(financials.extensionRentalAmount)} ({financials.extensionDays || 7} Days)
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span title="Subsequent months rental without delivery/pickup charges">
                          Monthly Rental Option:
                        </span>
                        <span className="font-bold text-[#2563EB] tabular-nums text-xs">
                          {(currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount)
                            ? `${formatAED(currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount)} / Month`
                            : 'Not Set'}
                        </span>
                      </div>
                    )}
                    {currentProject.returnedDate && (
                      <div className="flex justify-between items-center">
                        <span>Equipment Returned:</span>
                        <span className="font-semibold text-[#475467] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#CBD5E1] text-[11px] tabular-nums">
                          {formatDateDDMMYYYY(currentProject.returnedDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Remarks Box */}
              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#172033] font-bold text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Remarks & Site Notes</span>
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowQuickNote(!showQuickNote)}
                      className="text-[#2563EB] hover:text-blue-800 font-semibold text-xs cursor-pointer"
                    >
                      + Add Note
                    </button>
                  )}
                </div>
                <p className="text-[#374151] whitespace-pre-wrap leading-relaxed font-normal text-xs bg-white p-2.5 rounded-lg border border-[#E4E7EC]">
                  {currentProject.remarks || 'No remarks entered for this project.'}
                </p>
              </div>

              {/* System Metadata */}
              <div className="px-3 py-2 bg-[#F8FAFC] rounded-lg text-[10px] text-[#6B7280] flex flex-wrap justify-between gap-2 border border-[#E4E7EC]">
                <span>Created: {formatDateTimeDDMMYYYY(currentProject.createdAt)}</span>
                <span>Last Updated: {formatDateTimeDDMMYYYY(currentProject.updatedAt)}</span>
              </div>
            </div>
          )}

          {/* TAB: COMMERCIAL & PAYMENTS / LEDGER */}
          {activeTab === 'commercial' && (
            <div className="space-y-5">
              {/* Financial KPI Summary Cards (Separating Original Rental & Extension Rental) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Card 1: Original Rental (if extension) or Contract / 1st Mo */}
                <div className="bg-white p-3 rounded-xl border border-[#E4E7EC] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wide block">
                    {financials.hasExtension ? 'Original Rental' : 'Contract / 1st Mo'}
                  </span>
                  <span className="text-sm font-bold text-[#172033] block mt-1 tabular-nums truncate">
                    {financials.hasExtension
                      ? formatAED(financials.originalRentalAmount)
                      : formatAED(financials.contractAmount)}
                  </span>
                  <span className="text-[9.5px] text-[#667085] block mt-0.5 truncate">
                    {financials.hasExtension
                      ? `${financials.originalHirePeriodDays || 20} Days hire period`
                      : 'Incl. delivery/pickup'}
                  </span>
                </div>

                {/* Card 2: Extension Rental (if extension) or Monthly Recurring Rental */}
                {financials.hasExtension ? (
                  <div className="bg-[#FFFBEB] p-3 rounded-xl border border-[#FDE68A] shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#B45309] uppercase tracking-wide block">
                        Extension Rental
                      </span>
                      <span className="text-[9px] text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.2 rounded font-semibold">
                        {financials.extensionDays || 7} Days
                      </span>
                    </div>
                    <span className="text-sm font-black text-[#B45309] block mt-1 tabular-nums truncate">
                      {formatAED(financials.extensionRentalAmount)}
                    </span>
                    <span className="text-[9.5px] text-[#B45309]/80 block mt-0.5 truncate">
                      Additional extension period
                    </span>
                  </div>
                ) : (
                  <div className="bg-[#EFF6FF] p-3 rounded-xl border border-[#BFDBFE] shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wide block">
                        Monthly Rental Rate
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            const val = currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount;
                            setNextMonthRentalInput(val ? String(val) : '');
                            setShowEditNextMonthRental(true);
                          }}
                          className="text-[9px] text-[#2563EB] font-bold hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <span className="text-sm font-black text-[#2563EB] block mt-1 tabular-nums truncate">
                      {(financials.nextMonthRental ?? currentProject.monthlyPaymentAmount)
                        ? `${formatAED(financials.nextMonthRental ?? currentProject.monthlyPaymentAmount)}/mo`
                        : 'Not Set'}
                    </span>
                    <span className="text-[9.5px] text-[#2563EB]/80 block mt-0.5 truncate">
                      Materials on site (no delivery)
                    </span>
                  </div>
                )}

                <div className="bg-white p-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/30 shadow-2xs">
                  <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wide block">
                    Total Received
                  </span>
                  <span className="text-sm font-bold text-[#16A34A] block mt-1 tabular-nums truncate">
                    {formatAED(financials.totalReceived)}
                  </span>
                  <span className="text-[9.5px] text-[#15803D] block mt-0.5 truncate">
                    {financials.payments.length} receipts cleared
                  </span>
                </div>

                <div className="bg-[#FEF2F2] p-3 rounded-xl border border-[#FECACA] shadow-2xs">
                  <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wide block">
                    Outstanding
                  </span>
                  <span className="text-sm font-bold text-[#DC2626] block mt-1 tabular-nums truncate">
                    {formatAED(financials.outstandingAmount)}
                  </span>
                  <span className="text-[9.5px] text-[#DC2626]/80 block mt-0.5 truncate">
                    Balance due
                  </span>
                </div>
              </div>

              {/* Missed Promise Alert */}
              {financials.hasMissedPromise && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                  <span>
                    MISSED PROMISE: Customer promised payment on{' '}
                    {formatDateDDMMYYYY(currentProject.promisedPaymentDate!)} — NOT RECEIVED
                  </span>
                </div>
              )}

              {/* Commercial Details: QTN, LPO & Salesperson */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Quotation & Salesperson */}
                <div className="p-4 bg-white rounded-xl border border-[#E4E7EC] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                    <span className="font-bold text-[#172033] flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Sales & Quotation</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isAdmin &&
                        currentProject.salespersonAssignmentType === 'MANUALLY_CHANGED' &&
                        (() => {
                          const projectComp = companies.find(
                            (c) =>
                              c.companyName.trim().toLowerCase() ===
                              (currentProject.company || '').trim().toLowerCase()
                          );
                          if (projectComp && projectComp.defaultSalespersonId) {
                            return (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateProject(currentProject.id, {
                                    salespersonId: projectComp.defaultSalespersonId,
                                    salespersonName: projectComp.defaultSalespersonName,
                                    salespersonAssignmentType: 'AUTO_ASSIGNED',
                                  });
                                }}
                                className="text-[10px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
                                title={`Revert to company auto-assigned salesperson: ${projectComp.defaultSalespersonName}`}
                              >
                                Reset to Company Auto ({projectComp.defaultSalespersonName})
                              </button>
                            );
                          }
                          return null;
                        })()}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          currentProject.salespersonAssignmentType === 'AUTO_ASSIGNED'
                            ? 'bg-[#EFF6FF] text-[#2563EB]'
                            : 'bg-[#FFFBEB] text-[#B45309]'
                        }`}
                      >
                        {currentProject.salespersonAssignmentType === 'AUTO_ASSIGNED'
                          ? 'Auto-Assigned'
                          : 'Manual Override'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[#475467]">
                    <div className="flex justify-between">
                      <span>Assigned Salesperson:</span>
                      <strong className="text-[#172033]">{currentProject.salespersonName || 'Unassigned'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Quotation Number:</span>
                      <span className="font-mono text-[#172033] font-semibold">{currentProject.qtnNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quotation Date:</span>
                      <span>{currentProject.qtnDate ? formatDateDDMMYYYY(currentProject.qtnDate) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quotation Amount:</span>
                      <span className="font-bold text-[#172033]">{formatAED(currentProject.qtnAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quotation Status:</span>
                      <span className="font-semibold text-[#2563EB]">{currentProject.qtnStatus || 'APPROVED'}</span>
                    </div>
                  </div>
                </div>

                {/* LPO / Contract & Payment Terms */}
                <div className="p-4 bg-white rounded-xl border border-[#E4E7EC] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                    <span className="font-bold text-[#172033] flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>LPO / Approved Contract</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[#475467]">
                    <div className="flex justify-between">
                      <span>LPO Number:</span>
                      <span className="font-mono text-[#172033] font-semibold">{currentProject.lpoNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LPO Date:</span>
                      <span>{currentProject.lpoDate ? formatDateDDMMYYYY(currentProject.lpoDate) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contract / Approved Value:</span>
                      <strong className="text-[#2563EB] font-bold">{formatAED(financials.contractAmount)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Terms:</span>
                      <span className="font-semibold text-[#172033]">{currentProject.paymentTerms || '30 Days Credit'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Credit Period:</span>
                      <span>{currentProject.creditDays || 30} Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Commercial & Payment Summary + Payment History + Auto-accrued Schedule */}
              <CommercialPaymentSummary
                project={currentProject}
                totalContractAmount={financials.contractAmount}
                monthlyPaymentAmount={currentProject.nextMonthRental ?? currentProject.monthlyPaymentAmount}
                isEditable={true}
                onMonthlyPaymentChange={isAdmin ? (val) => handleUpdateNextMonthRental(val) : undefined}
              />

              {/* Payments Received Table */}
              <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8FAFC] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#16A34A]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#172B4D]">
                      Payments Received Receipts ({financials.payments.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddPayment(!showAddPayment)}
                    className="px-2.5 py-1 bg-[#16A34A] hover:bg-green-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Record Payment</span>
                  </button>
                </div>

                {/* Inline Record Payment Form */}
                {showAddPayment && (
                  <form onSubmit={handleCreatePayment} className="p-4 bg-[#F0FDF4] border-b border-[#BBF7D0] space-y-3 text-xs">
                    <span className="font-bold text-[#16A34A] block">Record Payment Receipt</span>
                    {pmtError && <div className="text-[#DC2626] font-semibold">{pmtError}</div>}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#344054] mb-1">
                          Amount Received (AED) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={pmtAmount}
                          onChange={(e) => setPmtAmount(e.target.value)}
                          placeholder="e.g. 15000"
                          className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-bold text-[#16A34A]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#344054] mb-1">
                          Date Received *
                        </label>
                        <input
                          type="date"
                          required
                          value={pmtDate}
                          onChange={(e) => setPmtDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#344054] mb-1">
                          Payment Method *
                        </label>
                        <select
                          value={pmtMethod}
                          onChange={(e) => setPmtMethod(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-semibold"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#344054] mb-1">
                          Cheque # / Transfer Ref
                        </label>
                        <input
                          type="text"
                          value={pmtRef}
                          onChange={(e) => setPmtRef(e.target.value)}
                          placeholder="e.g. CHQ #4492"
                          className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddPayment(false)}
                        className="px-3 py-1 bg-white border border-[#D0D5DD] rounded-lg font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingPmt}
                        className="px-3 py-1 bg-[#16A34A] text-white rounded-lg font-semibold shadow-xs"
                      >
                        {submittingPmt ? 'Saving...' : 'Save Receipt'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#475467] font-semibold uppercase text-[10px]">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Received Amount (AED)</th>
                        <th className="py-2 px-3">Method</th>
                        <th className="py-2 px-3">Reference</th>
                        <th className="py-2 px-3">Remarks</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E7EC]">
                      {financials.payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-[#98A2B3]">
                            No payments recorded for this project yet.
                          </td>
                        </tr>
                      ) : (
                        financials.payments.map((pmt) => (
                          <tr key={pmt.id} className="hover:bg-[#F8FAFC]">
                            <td className="py-2 px-3 whitespace-nowrap font-medium text-[#475467]">
                              {formatDateDDMMYYYY(pmt.paymentReceivedDate)}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-[#16A34A] tabular-nums">
                              {formatAED(pmt.paymentReceivedAmount)}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-[#172033] font-medium">
                              {pmt.paymentMethod}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-[#475467]">
                              {pmt.paymentReference || '—'}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-[#667085] truncate max-w-[150px]">
                              {pmt.remarks || '—'}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePmt(pmt)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-md transition cursor-pointer shadow-2xs"
                                title="Delete Payment Receipt"
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
              </div>
            </div>
          )}

          {/* TAB 2: PAYMENT FOLLOW-UPS */}
          {activeTab === 'followups' && (
            <div className="space-y-6">
              {/* Add Follow-Up Form (ADMIN Only) */}
              {isAdmin && (
                <form
                  onSubmit={handleAddFollowup}
                  className="p-4 bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#172033] text-xs">
                      Log New Payment Follow-Up (#{(followups.length || 0) + 1})
                    </span>
                    <input
                      type="date"
                      value={newFollowupDate}
                      onChange={(e) => setNewFollowupDate(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  {followupError && (
                    <div className="text-xs text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] p-2 rounded-lg font-medium">
                      {followupError}
                    </div>
                  )}

                  <div className="relative">
                    <textarea
                      required
                      rows={2}
                      value={newFollowupNotes}
                      onChange={(e) => setNewFollowupNotes(e.target.value)}
                      placeholder="e.g. Called accounts manager Mr. Tariq. Promised payment of 50% via bank transfer on Thursday..."
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-[#172033] placeholder:text-[#98A2B3]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingFollowup || !newFollowupNotes.trim()}
                      className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingFollowup ? 'Saving...' : 'Record Follow-Up'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Timeline of Follow-ups */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[#172033] text-xs uppercase tracking-wider">
                  Follow-Up Timeline ({followups.length})
                </h4>

                {followups.length === 0 ? (
                  <div className="text-center py-8 text-[#98A2B3] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E4E7EC]">
                    <MessageSquare className="w-6 h-6 mx-auto mb-1 text-[#98A2B3]" />
                    <p className="text-xs font-medium">No payment follow-ups recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followups.map((f) => (
                      <div
                        key={f.id}
                        className="p-3.5 bg-white rounded-xl border border-[#E4E7EC] shadow-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                            Follow-Up #{f.followUpNumber}
                          </span>
                          <span className="text-[#667085] font-normal">
                            Date: {formatDateDDMMYYYY(f.followUpDate)}
                          </span>
                        </div>
                        <p className="text-[#172033] text-xs whitespace-pre-wrap leading-relaxed font-normal">
                          {f.notes}
                        </p>
                        <div className="text-[10px] text-[#667085] pt-1 border-t border-[#E4E7EC] flex justify-between">
                          <span>Recorded by: {f.createdByName || 'Admin'}</span>
                          <span>Logged at: {formatDateTimeDDMMYYYY(f.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-[#172033] text-xs uppercase tracking-wider">
                Project Audit Trail
              </h4>

              {activities.length === 0 ? (
                <div className="text-center py-8 text-[#98A2B3] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E4E7EC]">
                  <Activity className="w-6 h-6 mx-auto mb-1 text-[#98A2B3]" />
                  <p className="text-xs font-medium">No audit entries recorded for this project</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-xl bg-white overflow-hidden">
                  {activities.map((a) => (
                    <div key={a.id} className="p-3.5 hover:bg-[#F8FAFC] transition text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#172033] flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-[#F2F4F7] font-mono text-[10px] text-[#344054] border border-[#E4E7EC] font-semibold">
                            {a.action}
                          </span>
                          <span>{a.userName}</span>
                        </span>
                        <span className="text-[#667085] text-[11px] font-mono">
                          {formatDateTimeDDMMYYYY(a.createdAt)}
                        </span>
                      </div>
                      <p className="text-[#475467] font-normal">{a.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REMARKS HISTORY */}
          {activeTab === 'remarks' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-[#172033] text-xs uppercase tracking-wider">
                Remarks Revision History
              </h4>

              {remarksHistory.length === 0 ? (
                <div className="text-center py-8 text-[#98A2B3] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E4E7EC]">
                  <History className="w-6 h-6 mx-auto mb-1 text-[#98A2B3]" />
                  <p className="text-xs font-medium">No prior revisions to remarks</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {remarksHistory.map((r) => (
                    <div key={r.id} className="p-3 bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl text-xs space-y-1">
                      <div className="flex justify-between text-[#667085] text-[10px]">
                        <span>Revised by: {r.userName || 'Admin'}</span>
                        <span>{formatDateTimeDDMMYYYY(r.createdAt)}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-[#E4E7EC] text-[#172033] font-mono text-[11px] whitespace-pre-wrap">
                        {r.previousRemark}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    )}

        {/* Footer Actions (Compact & Clean) */}
        <div className="px-5 py-2.5 sm:px-6 sm:py-3 border-t border-[#E4E7EC] bg-[#F8FAFC] rounded-b-2xl flex items-center justify-between shrink-0">
          {isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B]">All updates are applied directly to the project record.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-1.5 bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] font-medium rounded-lg text-xs transition cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveInlineEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{savingEdit ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}

                {isAdmin && onCopy && (
                  <button
                    onClick={() => {
                      onClose();
                      onCopy(currentProject);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] font-medium rounded-lg text-xs transition cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Copy</span>
                  </button>
                )}

                {isAdmin && onDelete && (
                  <button
                    onClick={() => {
                      onClose();
                      onDelete(currentProject);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white font-medium rounded-lg text-xs transition cursor-pointer shadow-2xs ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] font-medium rounded-lg text-xs transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Delete Payment Receipt Confirmation Modal */}
      {confirmDeletePmt &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] bg-[#0B1526]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deletingPmt) setConfirmDeletePmt(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-[#E4E7EC] max-w-md w-full p-5 sm:p-6 my-auto animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#FEF2F2] text-[#DC2626] rounded-xl border border-[#FECACA] shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#172033]">
                    Delete Payment Record?
                  </h3>
                  <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                    Are you sure you want to delete this payment receipt? The project's outstanding balance, ledger, and rental schedule will be automatically reversed.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingPmt}
                  onClick={() => setConfirmDeletePmt(null)}
                  className="p-1 text-[#667085] hover:text-[#172033] hover:bg-[#F2F4F7] rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Payment Details summary card */}
              <div className="my-4 p-3.5 bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#667085]">Amount:</span>
                  <span className="font-black text-sm text-[#DC2626] tabular-nums">
                    {formatAED(confirmDeletePmt.paymentReceivedAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#667085]">Received Date:</span>
                  <span className="font-semibold text-[#172033]">
                    {formatDateDDMMYYYY(confirmDeletePmt.paymentReceivedDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#667085]">Payment Method:</span>
                  <span className="font-medium text-[#172033]">
                    {confirmDeletePmt.paymentMethod || 'Bank Transfer'}
                  </span>
                </div>
                {confirmDeletePmt.paymentReference && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#667085]">Reference:</span>
                    <span className="font-mono text-[#2563EB] font-medium">
                      {confirmDeletePmt.paymentReference}
                    </span>
                  </div>
                )}
                {confirmDeletePmt.installmentMonth && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#667085]">Target Month:</span>
                    <span className="font-semibold text-[#16A34A]">
                      {confirmDeletePmt.installmentMonth}
                    </span>
                  </div>
                )}
                {confirmDeletePmt.remarks && (
                  <div className="pt-1 border-t border-[#E4E7EC] text-[#667085] italic text-[11px]">
                    "{confirmDeletePmt.remarks}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                <button
                  type="button"
                  disabled={deletingPmt}
                  onClick={() => setConfirmDeletePmt(null)}
                  className="px-3.5 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingPmt}
                  onClick={handleExecuteDeletePmt}
                  className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingPmt ? 'Deleting...' : 'Yes, Delete Payment'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        </div>
      )}
    </AnimatePresence>
  );
};
