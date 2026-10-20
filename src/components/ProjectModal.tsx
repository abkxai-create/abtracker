import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Project,
  CompanyRecord,
  ScaffoldingType,
  ProjectStatus,
  PaymentStatus,
  SalespersonAssignmentType,
} from '../types';
import {
  calculateDueDate,
  calculateExtendedDueDate,
  calculateTotalHireDays,
  addDaysToDate,
  toInputDateFormat,
  formatDateDDMMYYYY,
} from '../utils/dateUtils';
import { generateNextProjectCode, isProjectCodeUnique, findProjectByCode } from '../utils/codeGenerator';
import { useProjects } from '../context/ProjectContext';
import { ProjectHeaderSummary } from './ProjectHeaderSummary';
import { CommercialPaymentSummary } from './CommercialPaymentSummary';
import { formatAED } from '../utils/commercialUtils';
import { toCompanyCanonicalKey, isCompanyMatch } from '../utils/companyUtils';
import {
  X,
  Calendar,
  Building,
  Phone,
  Hash,
  Clock,
  CheckCircle,
  Sparkles,
  UserCheck,
  Receipt,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: any) => Promise<void>;
  initialData?: Project | null;
  mode: 'add' | 'edit';
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}) => {
  const {
    allProjectsEver,
    salespersons,
    activeSalespersons,
    companies,
    findCompanyByName,
    checkDuplicateCompany,
    addCompany,
    getOrCreateCanonicalCompany,
    getProjectFinancials,
  } = useProjects();

  // Basic Operational Fields
  const [projectCode, setProjectCode] = useState('');
  const [company, setCompany] = useState('');
  const [mobile, setMobile] = useState('');
  const [projectReference, setProjectReference] = useState(''); // Main Reference / LPO No.
  const [scaffoldingType, setScaffoldingType] = useState<ScaffoldingType>('RENTAL');
  const [hirePeriodDays, setHirePeriodDays] = useState<number>(30);
  const [hirePeriodMonths, setHirePeriodMonths] = useState<number>(1);
  const [deliveryDate, setDeliveryDate] = useState<string>(toInputDateFormat(new Date()));
  const [dueDate, setDueDate] = useState<string>('');
  const [isDueDateOverridden, setIsDueDateOverridden] = useState<boolean>(false);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('ACTIVE');
  const [returnedDate, setReturnedDate] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('NOT_PAID');
  const [remarks, setRemarks] = useState('');

  // Salesperson Assignment
  const [salespersonId, setSalespersonId] = useState<string>('');
  const [salespersonName, setSalespersonName] = useState<string>('');
  const [salespersonAssignmentType, setSalespersonAssignmentType] =
    useState<SalespersonAssignmentType>('AUTO_ASSIGNED');

  // Commercial Values (Simplified)
  // 1. Total Contract / LPO Amount
  const [contractAmount, setContractAmount] = useState<string>('');
  // 2. Optional Monthly Payment Amount
  const [monthlyPaymentAmount, setMonthlyPaymentAmount] = useState<string>('');
  // 3. Optional Next Payment Due
  const [nextPaymentDueDate, setNextPaymentDueDate] = useState<string>('');

  // 4. Extension Breakdown (CRITICAL: Distinguish Extension Rental from Next Month Rental)
  const [hasExtension, setHasExtension] = useState<boolean>(false);
  const [originalHirePeriodDays, setOriginalHirePeriodDays] = useState<number>(30);
  const [originalRentalAmount, setOriginalRentalAmount] = useState<string>('');
  const [originalDueDate, setOriginalDueDate] = useState<string>('');
  const [extensionDays, setExtensionDays] = useState<number>(0);
  const [extensionRentalAmount, setExtensionRentalAmount] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest state for Company
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoFilledNotice, setAutoFilledNotice] = useState(false);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // Extract unique companies directory with their latest known mobile number and default salesperson
  const companyDirectory = useMemo(() => {
    const map = new Map<
      string,
      { company: string; companyId?: string; mobile: string; spId?: string; spName?: string }
    >();

    // 1. Authoritative Company Master records first
    companies.forEach((c) => {
      const key = toCompanyCanonicalKey(c.companyName) || c.companyName.trim().toLowerCase();
      map.set(key, {
        company: c.companyName.trim(),
        companyId: c.id,
        mobile: c.mobile || '',
        spId: c.defaultSalespersonId,
        spName: c.defaultSalespersonName,
      });
    });

    // 2. Historical projects (only if not already registered)
    for (let i = allProjectsEver.length - 1; i >= 0; i--) {
      const p = allProjectsEver[i];
      const trimmed = p.company?.trim();
      if (trimmed) {
        const key = toCompanyCanonicalKey(trimmed);
        if (key && !map.has(key)) {
          map.set(key, {
            company: trimmed,
            companyId: p.companyId,
            mobile: p.mobile ? String(p.mobile).trim() : '',
            spId: p.salespersonId,
            spName: p.salespersonName,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [allProjectsEver, companies]);

  // Filter matching suggestions
  const matchingSuggestions = useMemo(() => {
    if (!company.trim()) return companyDirectory.slice(0, 8);
    const term = company.trim().toLowerCase();
    return companyDirectory
      .filter((c) => c.company.toLowerCase().includes(term))
      .slice(0, 8);
  }, [companyDirectory, company]);

  // Duplicate company check
  const duplicateCompanyWarning = useMemo(() => {
    if (!company.trim()) return null;
    const exact = findCompanyByName(company.trim());
    if (exact) return null;

    const check = checkDuplicateCompany(company.trim());
    if (check.isDuplicate && check.match) {
      return check.match;
    }
    return null;
  }, [company, findCompanyByName, checkDuplicateCompany]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize form state
  useEffect(() => {
    if (initialData && mode === 'edit') {
      setProjectCode(initialData.projectCode || '');
      setCompany(initialData.company || '');
      setMobile(initialData.mobile || '');
      // Main Reference / LPO No.
      setProjectReference(initialData.projectReference || initialData.lpoNumber || '');
      setScaffoldingType(initialData.scaffoldingType || 'RENTAL');
      setHirePeriodDays(initialData.hirePeriodDays || 30);
      setDeliveryDate(initialData.deliveryDate || toInputDateFormat(new Date()));
      setDueDate(initialData.dueDate || '');
      setIsDueDateOverridden(!!initialData.isDueDateOverridden);
      setProjectStatus(initialData.projectStatus || 'ACTIVE');
      setReturnedDate(initialData.returnedDate || '');
      setPaymentStatus(initialData.paymentStatus || 'NOT_PAID');
      setRemarks(initialData.remarks || '');

      // Salesperson
      setSalespersonId(initialData.salespersonId || '');
      setSalespersonName(initialData.salespersonName || '');
      setSalespersonAssignmentType(
        initialData.salespersonAssignmentType || 'AUTO_ASSIGNED'
      );

      // Commercial & Extension breakdown
      const isStoneCroft =
        initialData.projectCode === 'PRJ-0076' ||
        (initialData.company && initialData.company.toUpperCase().includes('STONE CROFT'));

      const isExt = Boolean(
        isStoneCroft ||
        (initialData.extensionDays && Number(initialData.extensionDays) > 0) ||
        (initialData.extensionRentalAmount && Number(initialData.extensionRentalAmount) > 0) ||
        initialData.projectStatus === 'EXTENDED'
      );

      setHasExtension(isExt);

      const totalAmt =
        initialData.contractAmount ??
        initialData.lpoAmount ??
        initialData.qtnAmount ??
        0;

      if (isExt) {
        const origDays = isStoneCroft
          ? 20
          : Number(
              initialData.originalHirePeriodDays ||
                (initialData.hirePeriodDays ? Math.max(1, initialData.hirePeriodDays - (initialData.extensionDays || 7)) : 20)
            );
        const extDays = isStoneCroft
          ? 7
          : Number(
              initialData.extensionDays ||
                (initialData.hirePeriodDays && initialData.hirePeriodDays > origDays ? initialData.hirePeriodDays - origDays : 7)
            );
        const origRental = isStoneCroft
          ? 2940
          : Number(
              initialData.originalRentalAmount !== undefined
                ? initialData.originalRentalAmount
                : totalAmt > 0
                ? Math.max(0, totalAmt - (initialData.extensionRentalAmount || 441))
                : 2940
            );
        const extRental = isStoneCroft
          ? 441
          : Number(
              initialData.extensionRentalAmount !== undefined
                ? initialData.extensionRentalAmount
                : initialData.nextMonthRental || initialData.monthlyPaymentAmount || 0
            );

        const todayStr = toInputDateFormat(new Date());
        const origDue =
          initialData.originalDueDate ||
          (initialData.dueDate && extDays > 0
            ? addDaysToDate(initialData.dueDate, -extDays)
            : calculateDueDate(initialData.deliveryDate || todayStr, origDays));

        setOriginalDueDate(origDue);
        setOriginalHirePeriodDays(origDays);
        setOriginalRentalAmount(String(origRental));
        setExtensionDays(extDays);
        setExtensionRentalAmount(String(extRental));
        setHirePeriodDays(origDays + extDays);
        setContractAmount(String(origRental + extRental));
        setMonthlyPaymentAmount(''); // Extensions are NOT monthly recurring!
        const computedDueDate = initialData.dueDate || calculateExtendedDueDate(origDue, extDays);
        setDueDate(computedDueDate);
      } else {
        const todayStr = toInputDateFormat(new Date());
        const origDue =
          initialData.originalDueDate ||
          initialData.dueDate ||
          calculateDueDate(initialData.deliveryDate || todayStr, initialData.hirePeriodDays || 30);
        setOriginalDueDate(origDue);
        setDueDate(origDue);
        setOriginalHirePeriodDays(initialData.hirePeriodDays || 30);
        setOriginalRentalAmount(totalAmt > 0 ? String(totalAmt) : '');
        setExtensionDays(0);
        setExtensionRentalAmount('');
        setContractAmount(totalAmt > 0 ? String(totalAmt) : '');
        const monthlyRate = initialData.nextMonthRental ?? initialData.monthlyPaymentAmount;
        setMonthlyPaymentAmount(monthlyRate ? String(monthlyRate) : '');
        const days = initialData.hirePeriodDays || 30;
        const mos =
          initialData.hirePeriodMonths || Math.max(1, Math.round(days / 30));
        setHirePeriodDays(days);
        setHirePeriodMonths(mos);
      }

      setNextPaymentDueDate(initialData.nextPaymentDueDate || '');
    } else {
      // Add mode defaults
      setProjectCode(generateNextProjectCode(allProjectsEver));
      setCompany('');
      setMobile('');
      setProjectReference('');
      setScaffoldingType('RENTAL');
      setHirePeriodDays(30);
      setHirePeriodMonths(1);
      const todayStr = toInputDateFormat(new Date());
      setDeliveryDate(todayStr);
      const defaultDue = calculateDueDate(todayStr, 30);
      setDueDate(defaultDue);
      setOriginalDueDate(defaultDue);
      setIsDueDateOverridden(false);
      setProjectStatus('ACTIVE');
      setReturnedDate('');
      setPaymentStatus('NOT_PAID');
      setRemarks('');

      // Salesperson default
      const defaultSp = activeSalespersons[0] || salespersons[0];
      setSalespersonId(defaultSp?.id || '');
      setSalespersonName(defaultSp?.name || '');
      setSalespersonAssignmentType('AUTO_ASSIGNED');

      // Commercial & Extension defaults
      setHasExtension(false);
      setOriginalHirePeriodDays(30);
      setOriginalDueDate(defaultDue);
      setOriginalRentalAmount('');
      setExtensionDays(0);
      setExtensionRentalAmount('');
      setContractAmount('');
      setMonthlyPaymentAmount('');
      setNextPaymentDueDate('');
    }
    setError(null);
    setAutoFilledNotice(false);
    setShowSuggestions(false);
  }, [initialData, mode, isOpen, allProjectsEver, activeSalespersons, salespersons]);

  // Real-time project number uniqueness check
  const codeValidation = useMemo(() => {
    const trimmed = projectCode.trim();
    if (!trimmed) {
      return {
        isValid: false,
        message: 'Project Number is required.',
        conflict: null,
      };
    }
    const isUnique = isProjectCodeUnique(
      trimmed,
      allProjectsEver,
      mode === 'edit' ? initialData?.id : undefined
    );
    if (!isUnique) {
      const conflict = findProjectByCode(
        trimmed,
        allProjectsEver,
        mode === 'edit' ? initialData?.id : undefined
      );
      return {
        isValid: false,
        message: `Project Number "${trimmed}" is already assigned to "${conflict?.company || 'another project'}" (${conflict?.projectCode || trimmed}). Project numbers must be unique across all projects.`,
        conflict,
      };
    }
    return {
      isValid: true,
      message: 'Unique Project Number verified.',
      conflict: null,
    };
  }, [projectCode, allProjectsEver, mode, initialData]);

  // Generate next available sequential project code
  const handleGenerateNextCode = () => {
    const next = generateNextProjectCode(allProjectsEver);
    setProjectCode(next);
  };

  // Helper to apply Company and Auto-Assign its Sales Person
  const applyCompanyData = (compName: string, compMobile?: string, spId?: string, spName?: string) => {
    setCompany(compName);
    if (compMobile) {
      setMobile(compMobile);
      setAutoFilledNotice(true);
      setTimeout(() => setAutoFilledNotice(false), 3000);
    }

    if (spId && spName) {
      setSalespersonId(spId);
      setSalespersonName(spName);
      setSalespersonAssignmentType('AUTO_ASSIGNED');
    } else {
      const compRec = findCompanyByName(compName);
      if (compRec) {
        setSalespersonId(compRec.defaultSalespersonId);
        setSalespersonName(compRec.defaultSalespersonName);
        setSalespersonAssignmentType('AUTO_ASSIGNED');
      }
    }
  };

  const handleSelectCompany = (item: {
    company: string;
    mobile: string;
    spId?: string;
    spName?: string;
  }) => {
    applyCompanyData(item.company, item.mobile, item.spId, item.spName);
    setShowSuggestions(false);
  };

  const handleCompanyBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      if (company.trim()) {
        const found = companyDirectory.find(
          (c) => c.company.toLowerCase() === company.trim().toLowerCase()
        );
        if (found) {
          applyCompanyData(found.company, found.mobile, found.spId, found.spName);
        }
      }
    }, 200);
  };

  const handleSalespersonChange = (newSpId: string) => {
    setSalespersonId(newSpId);
    const sp = salespersons.find((s) => s.id === newSpId);
    setSalespersonName(sp ? sp.name : '');
    setSalespersonAssignmentType('MANUALLY_CHANGED');
  };

  const compMasterRecord = useMemo(() => {
    if (!company.trim()) return undefined;
    return findCompanyByName(company);
  }, [company, findCompanyByName]);

  const handleResetToCompanyDefault = () => {
    if (compMasterRecord && compMasterRecord.defaultSalespersonId) {
      setSalespersonId(compMasterRecord.defaultSalespersonId);
      setSalespersonName(compMasterRecord.defaultSalespersonName);
      setSalespersonAssignmentType('AUTO_ASSIGNED');
    }
  };

  // Auto-calculate Due Date
  // CRITICAL RULE:
  // If extension is active:
  // NEW DUE DATE = ORIGINAL DUE DATE + EXTENSION DAYS
  // TOTAL HIRE DAYS = ORIGINAL HIRE DAYS + EXTENSION DAYS
  // The extension MUST always be added to the EXISTING DUE DATE, never to the delivery date and never by adding calendar months.
  useEffect(() => {
    if (!isDueDateOverridden && deliveryDate) {
      if (hasExtension) {
        const baseDue =
          originalDueDate ||
          calculateDueDate(deliveryDate, Number(originalHirePeriodDays || 30));
        const newDue = calculateExtendedDueDate(baseDue, Number(extensionDays || 0));
        setDueDate(newDue);
      } else if (hirePeriodDays) {
        const calculated = calculateDueDate(deliveryDate, Number(hirePeriodDays));
        setDueDate(calculated);
        setOriginalDueDate(calculated);
      }
    }
  }, [
    deliveryDate,
    hirePeriodDays,
    isDueDateOverridden,
    hasExtension,
    originalHirePeriodDays,
    extensionDays,
    originalDueDate,
  ]);

  const handleDueDateChange = (newDate: string) => {
    setDueDate(newDate);
    setIsDueDateOverridden(true);
  };

  const handleHirePeriodMonthsChange = (months: number) => {
    const safeMonths = Math.max(0.5, months);
    setHirePeriodMonths(safeMonths);
    const days = Math.round(safeMonths * 30);
    setHirePeriodDays(days);
    if (!isDueDateOverridden && deliveryDate) {
      const [y, m, d] = deliveryDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1 + Math.round(safeMonths), d || 1);
      const computedDue = toInputDateFormat(targetDate);
      setDueDate(computedDue);
      if (!hasExtension) {
        setOriginalDueDate(computedDue);
      }
    }
    // If monthly payment amount is set, auto-update contract amount
    const monthlyRate = Number(monthlyPaymentAmount) || 0;
    if (monthlyRate > 0) {
      const fullContract = Math.round(safeMonths * monthlyRate * 100) / 100;
      if (
        !contractAmount ||
        Number(contractAmount) === 0 ||
        Math.abs(Number(contractAmount) - (Number(hirePeriodMonths || 1) * monthlyRate)) < 0.01
      ) {
        setContractAmount(String(fullContract));
      }
    }
  };

  const handleHirePeriodDaysChange = (days: number) => {
    const safeDays = Math.max(1, days);
    setHirePeriodDays(safeDays);
    setHirePeriodMonths(Math.max(0.5, Math.round((safeDays / 30) * 10) / 10));
    if (!isDueDateOverridden && deliveryDate) {
      const calculated = calculateDueDate(deliveryDate, safeDays);
      setDueDate(calculated);
      if (!hasExtension) {
        setOriginalDueDate(calculated);
      }
    }
  };

  const resetDueDateToAuto = () => {
    setIsDueDateOverridden(false);
    if (hasExtension) {
      const baseDue =
        originalDueDate ||
        calculateDueDate(deliveryDate, Number(originalHirePeriodDays || 30));
      const calculated = calculateExtendedDueDate(baseDue, Number(extensionDays || 0));
      setDueDate(calculated);
    } else {
      const calculated = calculateDueDate(deliveryDate, Number(hirePeriodDays));
      setDueDate(calculated);
      setOriginalDueDate(calculated);
    }
  };

  const handleStatusChange = (newStatus: ProjectStatus) => {
    setProjectStatus(newStatus);
    if (newStatus === 'RETURNED' && !returnedDate) {
      setReturnedDate(toInputDateFormat(new Date()));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCode.trim()) {
      setError('Project Number is required.');
      return;
    }
    if (!codeValidation.isValid) {
      setError(codeValidation.message);
      return;
    }
    if (!company.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!projectReference.trim()) {
      setError('Reference / LPO No. is required.');
      return;
    }
    if (!deliveryDate) {
      setError('Delivery date is required.');
      return;
    }
    if (!salespersonId) {
      setError('Please assign a Sales Person to this project.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Resolve canonical company
      const trimmedCompany = company.trim();
      let canonicalComp: CompanyRecord | undefined = undefined;
      try {
        canonicalComp = await getOrCreateCanonicalCompany(
          trimmedCompany,
          mobile.trim() || undefined,
          salespersonId,
          salespersonName
        );
      } catch {
        // fallback if lookup fails
      }

      const parsedContractAmount = contractAmount ? Number(contractAmount) : 0;
      const parsedMonthlyAmount = monthlyPaymentAmount ? Number(monthlyPaymentAmount) : undefined;

      await onSubmit({
        projectCode: projectCode.trim().toUpperCase(),
        company: canonicalComp ? canonicalComp.companyName : trimmedCompany,
        companyId: canonicalComp ? canonicalComp.id : undefined,
        mobile: mobile.trim() || (canonicalComp?.mobile || ''),
        projectReference: projectReference.trim(),
        lpoNumber: projectReference.trim() || initialData?.lpoNumber,
        scaffoldingType,
        hirePeriodDays: Number(hirePeriodDays),
        hirePeriodMonths:
          Number(hirePeriodMonths) ||
          Math.max(1, Math.round((Number(hirePeriodDays) || 30) / 30)),
        deliveryDate,
        dueDate,
        isDueDateOverridden,
        projectStatus,
        returnedDate:
          projectStatus === 'RETURNED' ? returnedDate || toInputDateFormat(new Date()) : null,
        paymentStatus,
        remarks: remarks.trim(),

        // MODULE 1: Salesperson Ownership
        salespersonId,
        salespersonName: salespersonName || 'Unassigned',
        salespersonAssignmentType,

        // MODULE 2: Simplified Commercial Values
        contractAmount: hasExtension ? (Number(originalRentalAmount || 0) + Number(extensionRentalAmount || 0)) : parsedContractAmount,
        originalHirePeriodDays: hasExtension ? originalHirePeriodDays : Number(hirePeriodDays),
        originalRentalAmount: hasExtension ? (Number(originalRentalAmount) || 0) : parsedContractAmount,
        originalDueDate: hasExtension ? (originalDueDate || calculateDueDate(deliveryDate, originalHirePeriodDays)) : undefined,
        extensionDays: hasExtension ? extensionDays : 0,
        extensionRentalAmount: hasExtension ? (Number(extensionRentalAmount) || 0) : 0,
        monthlyPaymentAmount: hasExtension ? undefined : parsedMonthlyAmount,
        nextMonthRental: hasExtension ? undefined : parsedMonthlyAmount,
        nextPaymentDueDate: nextPaymentDueDate || undefined,

        // Preserve all existing historical fields
        qtnNumber: initialData?.qtnNumber,
        qtnDate: initialData?.qtnDate,
        qtnAmount: initialData?.qtnAmount,
        qtnStatus: initialData?.qtnStatus,
        lpoDate: initialData?.lpoDate,
        lpoAmount: initialData?.lpoAmount,
        paymentTerms: initialData?.paymentTerms,
        creditDays: initialData?.creditDays,
        promisedPaymentDate: initialData?.promisedPaymentDate,
        promisedAmount: initialData?.promisedAmount,
        promiseStatus: initialData?.promiseStatus,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute live financials for header if editing
  const liveFinancials = initialData ? getProjectFinancials(initialData.id) : null;
  const currentTotalAmount = Number(contractAmount) || liveFinancials?.contractAmount || 0;
  const currentPaid = liveFinancials?.totalReceived || 0;
  const currentPending = Math.max(0, currentTotalAmount - currentPaid);

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
            {/* Modal Top Bar */}
            <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-semibold text-[#172033]">
              {mode === 'edit'
                ? `Edit Project: ${initialData?.projectCode}`
                : 'Add New Scaffolding Project'}
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              {mode === 'edit'
                ? 'Clean operational view with automated payment calculations.'
                : 'Create project with salesperson assignment and commercial contract value.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#667085] hover:text-[#172033] hover:bg-[#F2F4F7] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* REQUIREMENT 14: PROJECT HEADER SUMMARY (Top of screen)            */}
        {/* ---------------------------------------------------------------- */}
        {mode === 'edit' && initialData && (
          <div className="px-6 pt-3 pb-1 bg-[#F8FAFC] border-b border-[#E4E7EC]">
            <ProjectHeaderSummary
              projectCode={initialData.projectCode}
              company={initialData.company}
              salespersonName={salespersonName || initialData.salespersonName}
              projectReference={projectReference || initialData.projectReference}
              nextMonthRental={Number(monthlyPaymentAmount) || initialData.nextMonthRental || initialData.monthlyPaymentAmount}
              totalAmount={currentTotalAmount}
              totalPaid={currentPaid}
              totalPending={currentPending}
              isOverdue={liveFinancials?.isOverdue}
            />
          </div>
        )}

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626] text-xs font-medium">
              {error}
            </div>
          )}

          {/* Section 0: Project Number / Unique Identifier */}
          <div
            className={`p-4 rounded-xl border transition ${
              !codeValidation.isValid
                ? 'bg-[#FEF2F2]/60 border-[#FECACA]'
                : 'bg-[#F8FAFC] border-[#E4E7EC]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="font-semibold text-[#172033] flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-[#2563EB]" />
                <span>
                  Project Number / Code <span className="text-[#DC2626]">*</span>
                </span>
              </label>

              <div className="flex items-center gap-2">
                {projectCode.trim() && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      codeValidation.isValid
                        ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                        : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                    }`}
                  >
                    {codeValidation.isValid ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Unique</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Duplicate Conflict</span>
                      </>
                    )}
                  </span>
                )}

                {mode === 'add' && (
                  <button
                    type="button"
                    onClick={handleGenerateNextCode}
                    className="text-xs text-[#2563EB] hover:text-blue-800 font-medium underline cursor-pointer"
                  >
                    Next Available
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                required
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="e.g. PRJ-0001"
                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-1 transition text-xs sm:text-sm font-mono font-bold uppercase tracking-wider ${
                  !codeValidation.isValid
                    ? 'border-[#DC2626] text-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                    : 'border-[#D0D5DD] text-[#172033] focus:border-[#2563EB] focus:ring-[#2563EB]'
                }`}
              />
            </div>
            {!codeValidation.isValid && (
              <p className="text-xs text-[#DC2626] mt-1.5 font-medium">
                {codeValidation.message}
              </p>
            )}
          </div>

          {/* Section 1: Client & Salesperson Ownership */}
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] space-y-4">
            <div className="text-xs font-semibold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Customer & Sales Person Ownership</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Company with auto-suggest */}
              <div className="relative" ref={suggestionContainerRef}>
                <label className="block font-semibold text-[#344054] mb-1">
                  Company / Client Name <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5 z-10" />
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={handleCompanyBlur}
                    placeholder="Search or enter company..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm text-[#172033]"
                  />
                </div>

                {/* Duplicate Company Warning */}
                {duplicateCompanyWarning && (
                  <div className="mt-1.5 p-2 bg-[#FFFBEB] border border-[#FDE68A] rounded text-[11px] text-[#B45309] flex items-center justify-between">
                    <span>
                      Possible duplicate of: <strong>{duplicateCompanyWarning.companyName}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        applyCompanyData(
                          duplicateCompanyWarning.companyName,
                          duplicateCompanyWarning.mobile,
                          duplicateCompanyWarning.defaultSalespersonId,
                          duplicateCompanyWarning.defaultSalespersonName
                        )
                      }
                      className="text-[#2563EB] font-bold hover:underline ml-2 cursor-pointer"
                    >
                      Use Existing
                    </button>
                  </div>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && matchingSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D0D5DD] rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-[#F2F4F7]">
                    <div className="p-1.5 text-[10px] uppercase font-bold text-[#667085] bg-[#F8FAFC]">
                      Matching Companies
                    </div>
                    {matchingSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={() => handleSelectCompany(item)}
                        className="w-full px-3 py-2 text-left hover:bg-[#EFF6FF] flex items-center justify-between text-xs transition cursor-pointer"
                      >
                        <div>
                          <span className="font-semibold text-[#172033] block">
                            {item.company}
                          </span>
                          {item.spName && (
                            <span className="text-[10px] text-[#2563EB] font-medium">
                              Sales Person: {item.spName}
                            </span>
                          )}
                        </div>
                        {item.mobile && (
                          <span className="font-mono text-[11px] text-[#667085] bg-[#F2F4F7] px-2 py-0.5 rounded font-normal">
                            {item.mobile}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Sales Person */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#344054]">
                    Assigned Sales Person <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {salespersonAssignmentType === 'MANUALLY_CHANGED' && compMasterRecord?.defaultSalespersonName && (
                      <button
                        type="button"
                        onClick={handleResetToCompanyDefault}
                        className="text-[10px] text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-semibold cursor-pointer"
                        title={`Reset to company default: ${compMasterRecord.defaultSalespersonName}`}
                      >
                        Reset to Company Default ({compMasterRecord.defaultSalespersonName})
                      </button>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                        salespersonAssignmentType === 'AUTO_ASSIGNED'
                          ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                          : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                      }`}
                    >
                      {salespersonAssignmentType === 'AUTO_ASSIGNED'
                        ? 'Auto Assigned'
                        : 'Manually Changed'}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5 z-10" />
                  <select
                    required
                    value={salespersonId}
                    onChange={(e) => handleSalespersonChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm font-medium text-[#172033] cursor-pointer"
                  >
                    <option value="">Select Sales Person...</option>
                    {salespersons.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name} {sp.status === 'INACTIVE' ? '(Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Mobile / WhatsApp */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#344054]">Mobile / WhatsApp</label>
                  {autoFilledNotice && (
                    <span className="text-[10px] text-[#16A34A] font-medium flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                      Auto-filled!
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value);
                      setAutoFilledNotice(false);
                    }}
                    placeholder="e.g. 052-1234567"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm font-mono text-[#172033]"
                  />
                </div>
              </div>

              {/* REQUIREMENT 2: Single Clean Reference / LPO No. Field */}
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Reference / LPO No. <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={projectReference}
                    onChange={(e) => setProjectReference(e.target.value)}
                    placeholder="e.g. PO-00908 or Site Plot"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm text-[#172033] font-mono"
                  />
                </div>
              </div>

              {/* Scaffolding Type */}
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Scaffolding Type <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={scaffoldingType}
                  onChange={(e) => setScaffoldingType(e.target.value as ScaffoldingType)}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm font-medium text-[#172033] cursor-pointer"
                >
                  <option value="RENTAL">RENTAL (Materials Only)</option>
                  <option value="EREC/DISM">EREC/DISM (Erection & Dismantling)</option>
                </select>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* SECTION 2: SIMPLIFIED COMMERCIAL & PAYMENT SECTION             */}
          {/* -------------------------------------------------------------- */}
          {mode === 'edit' && initialData ? (
            /* Edit Mode: Live Commercial & Payment Summary + Payment History + Schedule */
            <CommercialPaymentSummary
              project={initialData}
              totalContractAmount={Number(contractAmount) || 0}
              onTotalAmountChange={(val) => setContractAmount(val > 0 ? String(val) : '')}
              monthlyPaymentAmount={Number(monthlyPaymentAmount) || undefined}
              onMonthlyPaymentChange={(val) => setMonthlyPaymentAmount(val > 0 ? String(val) : '')}
              isEditable={true}
            />
          ) : (
            /* Add Mode: Initial Commercial & Recurring Setup */
            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] space-y-3">
              <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                    Commercial & Payment Setup
                  </span>
                </div>
                <span className="text-[11px] text-[#667085]">
                  Track payments as transactions once project is created
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Total Contract / LPO Amount */}
                <div>
                  <label className="block font-semibold text-[#344054] mb-1">
                    Total Contract / LPO Amount (AED)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#667085]">
                      AED
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={contractAmount}
                      onChange={(e) => setContractAmount(e.target.value)}
                      placeholder="e.g. 75000"
                      className="w-full pl-12 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg font-bold text-[#2563EB] text-xs sm:text-sm focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <span className="text-[10px] text-[#667085] mt-0.5 block">
                    1st month rental + delivery / mobilization / transport charges
                  </span>
                </div>

                {/* Optional Monthly Recurring Rental Amount (for ongoing long-term monthly projects, NOT extensions) */}
                <div>
                  <label className="block font-semibold text-[#344054] mb-1">
                    {hasExtension
                      ? 'Monthly Recurring Rate (Inactive during extension)'
                      : 'Monthly Recurring Rental Rate (AED) — Option'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#667085]">
                      AED
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={hasExtension}
                      value={hasExtension ? '' : monthlyPaymentAmount}
                      onChange={(e) => setMonthlyPaymentAmount(e.target.value)}
                      placeholder={hasExtension ? 'Handled by Extension Rental below' : 'e.g. 5000 / Month'}
                      className={`w-full pl-12 pr-3 py-2 border rounded-lg text-xs sm:text-sm focus:outline-none ${
                        hasExtension
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-[#D0D5DD] focus:border-[#2563EB]'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-[#667085] mt-0.5 block font-medium">
                    {hasExtension
                      ? '⚡ Short-term extensions use explicit Extension Rental days and amounts below. Do not use monthly rates for extensions.'
                      : '⚡ For ongoing long-term monthly projects (materials on site, excluding delivery/pickup charges).'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Rental Dates & Period */}
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] space-y-4">
            <div className="text-xs font-semibold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Rental Period & Operational Timeline</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Delivery Date <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm text-[#172033]"
                />
                <span className="text-[10px] text-[#667085] font-normal mt-1 block">
                  Formatted: {formatDateDDMMYYYY(deliveryDate)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Duration (Months)
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={hirePeriodMonths}
                  onChange={(e) => handleHirePeriodMonthsChange(Number(e.target.value))}
                  placeholder="e.g. 13"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm font-bold text-[#2563EB] tabular-nums"
                />
                <span className="text-[10px] text-[#667085] font-normal mt-1 block">
                  e.g. 13 Contract Months
                </span>
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Hire Period (Days) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={hirePeriodDays}
                  onChange={(e) => handleHirePeriodDaysChange(Number(e.target.value))}
                  placeholder="e.g. 390"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm font-medium text-[#172033] tabular-nums"
                />
                <span className="text-[10px] text-[#667085] font-normal mt-1 block">
                  Auto-synced with months
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#344054]">
                    Due Date <span className="text-[#DC2626]">*</span>
                  </label>
                  {isDueDateOverridden ? (
                    <button
                      type="button"
                      onClick={resetDueDateToAuto}
                      className="text-[10px] text-[#2563EB] hover:underline font-medium"
                    >
                      Reset Auto
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#16A34A] font-medium">Auto-calc</span>
                  )}
                </div>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm ${
                    isDueDateOverridden
                      ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706] font-medium'
                      : 'bg-white border-[#D0D5DD] text-[#172033]'
                  }`}
                />
                <span className="text-[10px] text-[#667085] font-normal mt-1 block">
                  Formatted: {formatDateDDMMYYYY(dueDate)}{' '}
                  {isDueDateOverridden && '(Manual Override)'}
                </span>
              </div>
            </div>

            {/* Rental Extension (Additional Hire Period) Section */}
            <div className="pt-3 border-t border-[#E4E7EC]">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExtension}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setHasExtension(enabled);
                      if (enabled) {
                        const origDays = originalHirePeriodDays || Number(hirePeriodDays) || 30;
                        const extDays = extensionDays || 7;
                        setOriginalHirePeriodDays(origDays);
                        setExtensionDays(extDays);
                        const totalDays = calculateTotalHireDays(origDays, extDays);
                        setHirePeriodDays(totalDays);

                        // Authoritative existing due date is the original due date
                        const origDue = originalDueDate || dueDate || calculateDueDate(deliveryDate, origDays);
                        setOriginalDueDate(origDue);

                        // CRITICAL FORMULA: NEW DUE DATE = ORIGINAL DUE DATE + EXTENSION DAYS
                        // The extension MUST always be added to the EXISTING DUE DATE, never to the delivery date
                        if (!isDueDateOverridden) {
                          setDueDate(calculateExtendedDueDate(origDue, extDays));
                        }
                        const origR = originalRentalAmount ? Number(originalRentalAmount) : (Number(contractAmount) || 2940);
                        const extR = extensionRentalAmount ? Number(extensionRentalAmount) : 441;
                        setOriginalRentalAmount(String(origR));
                        setExtensionRentalAmount(String(extR));
                        setContractAmount(String(origR + extR));
                        setMonthlyPaymentAmount(''); // Extensions are NEVER monthly recurring!
                        setProjectStatus('EXTENDED');
                      } else {
                        setHirePeriodDays(originalHirePeriodDays || 30);
                        const origDue = originalDueDate || calculateDueDate(deliveryDate, originalHirePeriodDays || 30);
                        if (!isDueDateOverridden) {
                          setDueDate(origDue);
                        }
                        setExtensionDays(0);
                        setExtensionRentalAmount('');
                      }
                    }}
                    className="w-4 h-4 text-[#2563EB] border-[#D0D5DD] rounded focus:ring-[#2563EB]"
                  />
                  <span className="text-xs font-bold text-[#172033]">
                    Additional Hire Extension (e.g. +7 Days @ AED 441)
                  </span>
                </label>
                {hasExtension && (
                  <span className="text-[10px] font-semibold text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded">
                    Extension Active (+{extensionDays} Days)
                  </span>
                )}
              </div>

              {hasExtension && (
                <div className="mt-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#344054] mb-1">
                        Original Hire Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={originalHirePeriodDays}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setOriginalHirePeriodDays(val);
                          const total = calculateTotalHireDays(val, Number(extensionDays || 0));
                          setHirePeriodDays(total);
                          const baseDue = calculateDueDate(deliveryDate, val);
                          setOriginalDueDate(baseDue);
                          if (!isDueDateOverridden) {
                            setDueDate(calculateExtendedDueDate(baseDue, Number(extensionDays || 0)));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-md text-xs font-bold text-[#172033]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#344054] mb-1">
                        Original Rental (AED)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={originalRentalAmount}
                        onChange={(e) => {
                          setOriginalRentalAmount(e.target.value);
                          setContractAmount(String(Number(e.target.value || 0) + Number(extensionRentalAmount || 0)));
                        }}
                        placeholder="e.g. 2940"
                        className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-md text-xs font-bold text-[#172033]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#B45309] mb-1">
                        Extension Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={extensionDays}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setExtensionDays(val);
                          const total = calculateTotalHireDays(Number(originalHirePeriodDays || 0), val);
                          setHirePeriodDays(total);
                          const baseDue = originalDueDate || calculateDueDate(deliveryDate, Number(originalHirePeriodDays || 30));
                          if (!isDueDateOverridden) {
                            setDueDate(calculateExtendedDueDate(baseDue, val));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#F59E0B] rounded-md text-xs font-bold text-[#B45309]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#B45309] mb-1">
                        Extension Rental (AED)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={extensionRentalAmount}
                        onChange={(e) => {
                          setExtensionRentalAmount(e.target.value);
                          setContractAmount(String(Number(originalRentalAmount || 0) + Number(e.target.value || 0)));
                        }}
                        placeholder="e.g. 441"
                        className="w-full px-2.5 py-1.5 bg-white border border-[#F59E0B] rounded-md text-xs font-bold text-[#B45309]"
                      />
                    </div>
                  </div>

                  {/* Extension Date & Pricing Calculation Summary */}
                  <div className="p-2.5 bg-amber-100/70 rounded-md border border-amber-300 text-xs text-[#92400E] space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                      <span>
                        Original Due: <strong>{formatDateDDMMYYYY(originalDueDate || calculateDueDate(deliveryDate, originalHirePeriodDays))}</strong> ({originalHirePeriodDays}d)
                      </span>
                      <span>
                        Extension Start: <strong>{formatDateDDMMYYYY(addDaysToDate(originalDueDate || calculateDueDate(deliveryDate, originalHirePeriodDays), 1))}</strong>
                      </span>
                      <span>
                        New Due Date: <strong className="text-[#B45309]">{formatDateDDMMYYYY(dueDate)}</strong> ({hirePeriodDays} Total Days)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-amber-200">
                      <span>
                        Original Rental: {formatAED(Number(originalRentalAmount || 0))} + Extension Rental: {formatAED(Number(extensionRentalAmount || 0))}
                      </span>
                      <span className="font-bold">
                        Total Rental Value: {formatAED(Number(originalRentalAmount || 0) + Number(extensionRentalAmount || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Operational Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Project Operational Status <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={projectStatus}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm font-medium text-[#172033] cursor-pointer"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXTENDED">EXTENDED</option>
                <option value="RETURNED">RETURNED</option>
                <option value="CLOSED">CLOSED</option>
                <option value="ON_HOLD">ON_HOLD</option>
              </select>
            </div>

            {/* Returned Date if RETURNED */}
            {projectStatus === 'RETURNED' ? (
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Equipment Returned Date
                </label>
                <input
                  type="date"
                  value={returnedDate}
                  onChange={(e) => setReturnedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#172033]"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Payment Status (Automatic)
                </label>
                <div className="px-3 py-2 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg text-xs sm:text-sm font-bold text-[#172033]">
                  {currentPending === 0 && (currentTotalAmount > 0 || currentPaid > 0)
                    ? 'FULLY PAID'
                    : currentPaid > 0
                    ? 'PARTIAL PAID'
                    : 'NOT PAID'}
                </div>
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block font-semibold text-[#344054] mb-1">
              Remarks & Special Notes
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Scaffolding delivered to site via 3-ton crane truck..."
              className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition text-xs sm:text-sm text-[#172033] placeholder:text-[#98A2B3]"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-[#E4E7EC] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg transition text-xs sm:text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !codeValidation.isValid}
              className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Saving...'
                  : mode === 'edit'
                  ? 'Update Project'
                  : 'Create Project'}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )}
</AnimatePresence>
);
};
