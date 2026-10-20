import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, ScaffoldingType, PaymentStatus } from '../types';
import { calculateDueDate, toInputDateFormat, formatDateDDMMYYYY } from '../utils/dateUtils';
import { generateNextProjectCode, isProjectCodeUnique, findProjectByCode } from '../utils/codeGenerator';
import { useProjects } from '../context/ProjectContext';
import {
  X,
  Copy,
  Calendar,
  Building,
  Phone,
  Hash,
  CheckCircle,
  Info,
  RefreshCw,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface CopyProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceProject: Project | null;
  onConfirmCopy: (sourceProject: Project, overrides: Partial<Project> & { projectCode?: string }) => Promise<void>;
}

export const CopyProjectModal: React.FC<CopyProjectModalProps> = ({
  isOpen,
  onClose,
  sourceProject,
  onConfirmCopy,
}) => {
  const { allProjectsEver } = useProjects();
  const [projectCode, setProjectCode] = useState('');
  const [company, setCompany] = useState('');
  const [mobile, setMobile] = useState('');
  const [projectReference, setProjectReference] = useState('');
  const [scaffoldingType, setScaffoldingType] = useState<ScaffoldingType>('RENTAL');
  const [hirePeriodDays, setHirePeriodDays] = useState<number>(30);
  const [deliveryDate, setDeliveryDate] = useState<string>(toInputDateFormat(new Date()));
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('NOT_PAID');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sourceProject && isOpen) {
      setProjectCode(generateNextProjectCode(allProjectsEver));
      setCompany(sourceProject.company || '');
      setMobile(sourceProject.mobile || '');
      setProjectReference(`${sourceProject.projectReference} (New Order)`);
      setScaffoldingType(sourceProject.scaffoldingType || 'RENTAL');
      setHirePeriodDays(sourceProject.hirePeriodDays || 30);
      setDeliveryDate(toInputDateFormat(new Date()));
      setPaymentStatus('NOT_PAID');
      setRemarks(sourceProject.remarks || '');
      setError(null);
    }
  }, [sourceProject, isOpen, allProjectsEver]);

  // Real-time project code uniqueness validation
  const codeValidation = useMemo(() => {
    const trimmed = projectCode.trim();
    if (!trimmed) {
      return {
        isValid: false,
        message: 'Project Number is required.',
        conflict: null,
      };
    }
    const isUnique = isProjectCodeUnique(trimmed, allProjectsEver);
    if (!isUnique) {
      const conflict = findProjectByCode(trimmed, allProjectsEver);
      return {
        isValid: false,
        message: `Project Number "${trimmed}" is already assigned to "${conflict?.company || 'another project'}". Project numbers must be unique.`,
        conflict,
      };
    }
    return {
      isValid: true,
      message: 'Unique Project Number verified.',
      conflict: null,
    };
  }, [projectCode, allProjectsEver]);

  const handleGenerateNextCode = () => {
    const next = generateNextProjectCode(allProjectsEver);
    setProjectCode(next);
  };

  const calculatedDueDate = calculateDueDate(deliveryDate, Number(hirePeriodDays));

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceProject) return;

    if (!projectCode.trim()) {
      setError('Project Number is required.');
      return;
    }

    if (!codeValidation.isValid) {
      setError(codeValidation.message);
      return;
    }

    if (!company.trim() || !projectReference.trim()) {
      setError('Company and Project Reference are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onConfirmCopy(sourceProject, {
        projectCode: projectCode.trim().toUpperCase(),
        company: company.trim(),
        mobile: mobile.trim(),
        projectReference: projectReference.trim(),
        scaffoldingType,
        hirePeriodDays: Number(hirePeriodDays),
        deliveryDate,
        paymentStatus,
        remarks: remarks.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to copy project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && sourceProject && (
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
            className="relative bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-xl w-full max-h-[90vh] flex flex-col my-auto z-10"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between bg-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-lg shadow-xs">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#172033]">Copy Project Workflow</h2>
              <p className="text-xs text-[#667085] font-normal">
                Duplicating from <span className="font-semibold text-[#2563EB] font-mono">{sourceProject.projectCode}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#667085] hover:text-[#172033] hover:bg-[#F2F4F7] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="px-6 py-2.5 bg-[#EFF6FF] border-b border-[#BFDBFE] flex items-center gap-2 text-xs text-[#1E40AF] font-medium">
          <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>
            Duplicating configuration. Each copy receives a strictly unique Project Number to prevent numbering collisions.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCopy} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#DC2626] font-medium text-xs">
              {error}
            </div>
          )}

          {/* Unique Project Number Section */}
          <div
            className={`p-3.5 rounded-xl border transition ${
              !codeValidation.isValid
                ? 'bg-[#FEF2F2] border-[#FECACA]'
                : 'bg-[#F8FAFC] border-[#E4E7EC]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-[#172033] flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-[#2563EB]" />
                <span>
                  New Project Number <span className="text-[#DC2626]">*</span>
                </span>
              </label>

              <div className="flex items-center gap-2">
                {projectCode.trim() && (
                  codeValidation.isValid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                      <Check className="w-3 h-3 text-[#16A34A]" />
                      <span>Unique</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-[#DC2626]" />
                      <span>In Use</span>
                    </span>
                  )
                )}

                <button
                  type="button"
                  onClick={handleGenerateNextCode}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-lg transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Generate Next</span>
                </button>
              </div>
            </div>

            <input
              type="text"
              required
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
              placeholder="e.g. PRJ-0005"
              className={`w-full px-3 py-2 border rounded-lg font-mono text-sm font-medium uppercase transition focus:outline-none focus:ring-1 ${
                !codeValidation.isValid
                  ? 'border-[#DC2626] bg-white text-[#DC2626] focus:ring-[#DC2626]'
                  : 'border-[#D0D5DD] bg-white text-[#172033] focus:border-[#2563EB] focus:ring-[#2563EB]'
              }`}
            />

            {!codeValidation.isValid && codeValidation.conflict && (
              <div className="mt-2 p-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626] shrink-0 mt-0.5" />
                <span>
                  <strong>{projectCode.trim()}</strong> is already taken by {codeValidation.conflict.company}. Project numbers must be unique.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Company Name <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-xs sm:text-sm text-[#172033]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Mobile (WhatsApp)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-xs sm:text-sm font-mono text-[#172033]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Project Reference <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={projectReference}
                  onChange={(e) => setProjectReference(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-xs sm:text-sm text-[#172033]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Scaffolding Type
              </label>
              <select
                value={scaffoldingType}
                onChange={(e) => setScaffoldingType(e.target.value as ScaffoldingType)}
                className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="RENTAL">RENTAL</option>
                <option value="EREC/DISM">EREC/DISM</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC]">
            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Duration (Months & Days)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={Math.max(0.5, Math.round((hirePeriodDays / 30) * 10) / 10)}
                  onChange={(e) => setHirePeriodDays(Math.round((parseFloat(e.target.value) || 1) * 30))}
                  placeholder="Months (e.g. 13)"
                  title="Duration in Months"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#2563EB] font-bold focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={hirePeriodDays}
                  onChange={(e) => setHirePeriodDays(Number(e.target.value))}
                  placeholder="Days (e.g. 390)"
                  title="Duration in Days"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                New Delivery Date
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
              <span className="text-[11px] font-normal text-[#667085] mt-1 block">
                Calculated Due: <span className="text-[#2563EB] font-medium">{formatDateDDMMYYYY(calculatedDueDate)}</span>
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#344054] mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
            >
              <option value="NOT_PAID">NOT_PAID</option>
              <option value="PARTIAL_PAID">PARTIAL_PAID</option>
              <option value="PAID">PAID</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#344054] mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs sm:text-sm text-[#172033] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] placeholder:text-[#98A2B3]"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#E4E7EC] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg text-xs sm:text-sm transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !codeValidation.isValid}
              className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{submitting ? 'Creating Copy...' : `Create Project ${projectCode.trim() || 'Copy'}`}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )}
</AnimatePresence>
);
};
