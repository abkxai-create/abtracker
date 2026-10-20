import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Project, PaymentReceipt, PaymentType, PaymentMethod } from '../types';
import { formatAED } from '../utils/commercialUtils';
import { formatDateDDMMYYYY, toInputDateFormat } from '../utils/dateUtils';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  Plus,
  Receipt,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface CommercialPaymentSummaryProps {
  project: Project;
  totalContractAmount: number;
  onTotalAmountChange?: (newAmount: number) => void;
  monthlyPaymentAmount?: number;
  onMonthlyPaymentChange?: (newAmount: number) => void;
  isEditable?: boolean;
}

export const CommercialPaymentSummary: React.FC<CommercialPaymentSummaryProps> = ({
  project,
  totalContractAmount,
  onTotalAmountChange,
  monthlyPaymentAmount,
  onMonthlyPaymentChange,
  isEditable = true,
}) => {
  const { addPaymentReceipt, deletePaymentReceipt, getProjectFinancials } = useProjects();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // Compute live financials from context payments & projects
  const financials = getProjectFinancials(project.id);
  const effectiveTotalAmount =
    totalContractAmount > 0
      ? Math.max(totalContractAmount, financials.contractAmount)
      : financials.contractAmount;

  const projectPayments = financials.payments;
  const totalPaid = financials.totalReceived;
  // Formula: TOTAL AMOUNT - TOTAL PAYMENTS RECEIVED = AMOUNT PENDING
  const totalPending = Math.max(0, effectiveTotalAmount - totalPaid);
  const isOverdue = financials.isOverdue && totalPending > 0;

  // Next Month Rental Rate
  const currentMonthlyRate =
    monthlyPaymentAmount !== undefined && monthlyPaymentAmount > 0
      ? monthlyPaymentAmount
      : financials.nextMonthRental ?? project.nextMonthRental ?? project.monthlyPaymentAmount;

  // Add Payment Modal State
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState<string>(toInputDateFormat(new Date()));
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentType, setPaymentType] = useState<PaymentType>('Rental');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [installmentMonth, setInstallmentMonth] = useState<string>('');
  const [customMonthInput, setCustomMonthInput] = useState<string>('');
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Success flash notice
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Delete Payment Confirmation Modal State
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<PaymentReceipt | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  // Always permit authorized users to delete wrong payments and manage receipts
  const canManagePayments = true;

  const handleOpenAddPayment = (suggestedMonth?: string, suggestedAmount?: number) => {
    setPaymentDate(toInputDateFormat(new Date()));
    setPaymentAmount(suggestedAmount ? String(suggestedAmount) : '');
    setPaymentReference('');
    setPaymentType(suggestedMonth ? 'Monthly Payment' : 'Rental');
    setPaymentMethod('Bank Transfer');
    setInstallmentMonth(suggestedMonth || '');
    setCustomMonthInput('');
    setPaymentRemarks('');
    setPaymentError(null);
    setShowAddPaymentModal(true);
  };

  const handleSavePayment = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!project?.id) {
      setPaymentError('Project ID is missing. Please save the project first before recording payments.');
      return;
    }

    if (!paymentAmount) {
      setPaymentError('Please enter a payment amount.');
      return;
    }

    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid positive payment amount greater than 0.');
      return;
    }

    const targetMonth =
      installmentMonth === 'CUSTOM'
        ? customMonthInput.trim()
        : installmentMonth.trim();

    // Check payment against today's billing cutoff for scheduled periods
    if (financials.paymentSchedule && financials.paymentSchedule.length > 0) {
      const matchedItem = financials.paymentSchedule.find(
        (s) =>
          targetMonth &&
          (s.monthLabel.toLowerCase() === targetMonth.toLowerCase() ||
            targetMonth.toLowerCase().includes(s.monthLabel.toLowerCase()) ||
            s.monthLabel.toLowerCase().includes(targetMonth.toLowerCase()))
      );

      if (matchedItem) {
        if (matchedItem.canRecordPayment === false || matchedItem.status === 'UPCOMING') {
          setPaymentError(
            `Cannot record payment for ${matchedItem.monthLabel}. This period has not yet elapsed (Billing cutoff: Today). Future days cannot be recorded as payment.`
          );
          return;
        }

        const maxAllowed = Math.max(
          0,
          (matchedItem.accruedAmount ?? matchedItem.expectedAmount) - matchedItem.receivedAmount
        );
        if (amountNum > maxAllowed + 0.01) {
          setPaymentError(
            `Amount (${formatAED(amountNum)}) exceeds the accrued payable balance for ${matchedItem.monthLabel} (${formatAED(maxAllowed)}). Days that have not yet elapsed remain unaccrued and cannot be paid.`
          );
          return;
        }
      }
    }

    setSubmittingPayment(true);
    setPaymentError(null);

    try {
      const createdReceipt = await addPaymentReceipt({
        projectId: project.id,
        projectCode: project.projectCode || '',
        company: project.company || '',
        paymentReceivedDate: paymentDate || toInputDateFormat(new Date()),
        paymentReceivedAmount: amountNum,
        paymentMethod: paymentMethod || 'Bank Transfer',
        paymentType: paymentType || 'Rental',
        paymentReference: (paymentReference || '').trim(),
        installmentMonth: targetMonth,
        remarks: (paymentRemarks || '').trim(),
      });

      setShowAddPaymentModal(false);
      setSuccessNotice(`Payment of ${formatAED(amountNum)} recorded successfully! Pending balance updated.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      console.error('Error recording payment receipt:', err);
      setPaymentError(err.message || 'Failed to record payment receipt. Please check your connection.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleExecuteDeletePayment = async () => {
    if (!confirmDeletePayment) return;
    setDeletingPayment(true);
    try {
      const amount = confirmDeletePayment.paymentReceivedAmount;
      await deletePaymentReceipt(confirmDeletePayment.id);
      setConfirmDeletePayment(null);
      setSuccessNotice(`Payment record of ${formatAED(amount)} was deleted successfully! Outstanding balance has been updated.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      console.error('Failed to delete payment receipt:', err);
      setPaymentError(err.message || 'Failed to delete payment receipt.');
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleDeletePayment = (payment: PaymentReceipt) => {
    setConfirmDeletePayment(payment);
  };

  // Next payment due date display
  const nextDueDateDisplay = financials.nextPaymentDue
    ? formatDateDDMMYYYY(financials.nextPaymentDue)
    : project.dueDate
    ? formatDateDDMMYYYY(project.dueDate)
    : '—';

  // Schedule items for installment dropdown
  const scheduleMonthOptions =
    financials.paymentSchedule?.map((s, idx) => ({
      value: s.monthLabel,
      label: s.periodType === 'EXTENSION'
        ? `Extension (${s.durationDays || 7} Days): ${s.monthLabel}${s.periodLabel ? ` (${s.periodLabel})` : ''}`
        : s.periodType === 'ORIGINAL'
        ? `Original Hire (${s.durationDays || 20} Days): ${s.monthLabel}${s.periodLabel ? ` (${s.periodLabel})` : ''}`
        : `${s.periodNumber ? `Month ${s.periodNumber}: ` : `Month ${idx + 1}: `}${s.monthLabel}${s.periodLabel ? ` (${s.periodLabel})` : ''}`,
    })) || [];

  return (
    <div className="space-y-4">
      {/* Success Notification */}
      {successNotice && (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-[#15803D] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. COMMERCIAL & PAYMENT SUMMARY BOX                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4E7EC] pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#2563EB]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#172033]">
              Commercial & Payment Summary
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Pill */}
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                totalPending === 0
                  ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                  : isOverdue
                  ? 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]'
                  : 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
              }`}
            >
              {totalPending === 0 ? 'Fully Paid' : isOverdue ? 'Payment Overdue' : 'Payment Pending'}
            </span>

            {/* [+ ADD PAYMENT] BUTTON */}
            {project.id && (
              <button
                type="button"
                onClick={() => handleOpenAddPayment()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ADD PAYMENT</span>
              </button>
            )}
          </div>
        </div>

        {/* Auto-accruing Rental / Extension Highlight Banner */}
        {financials.hasExtension ? (
          <div className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 shrink-0 text-[#D97706]" />
              <div>
                <span className="font-bold block text-[#92400E]">
                  ⚡ Extension Rental Active ({financials.extensionDays || 7} Days)
                </span>
                <span className="text-[11px] opacity-90 block text-[#B45309]">
                  Original Hire: {financials.originalHirePeriodDays || 20} Days ({formatAED(financials.originalRentalAmount)}) • Extension: {financials.extensionDays || 7} Days ({formatAED(financials.extensionRentalAmount)}). Total contract value: {formatAED(financials.contractAmount)}.
                </span>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block text-[#92400E]">
                Extension Rental
              </span>
              <span className="font-bold text-sm text-[#92400E] tabular-nums">
                {formatAED(financials.extensionRentalAmount)}
              </span>
            </div>
          </div>
        ) : currentMonthlyRate && currentMonthlyRate > 0 ? (
          <div
            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
              financials.isRentalAutoAccruing
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#334155]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles
                className={`w-4 h-4 shrink-0 ${
                  financials.isRentalAutoAccruing ? 'text-[#16A34A]' : 'text-[#64748B]'
                }`}
              />
              <div>
                <span className="font-bold block">
                  {financials.isRentalAutoAccruing
                    ? '⚡ Monthly Rental Auto-Accrual Active'
                    : '🔒 Rental Accrual Stopped (Project Returned/Closed)'}
                </span>
                <span className="text-[11px] opacity-90 block">
                  {financials.isRentalAutoAccruing
                    ? `Started ${project.deliveryDate ? formatDateDDMMYYYY(project.deliveryDate) : 'on delivery'} • ${financials.accruedRentalMonths || 1} months accrued to date (${formatAED(financials.totalAccruedRental)} total accrued). Automatically accrues each month till returned or closed.`
                    : `${financials.accruedRentalMonths || 0} months accrued till equipment return date (${financials.rentalStoppedDate ? formatDateDDMMYYYY(financials.rentalStoppedDate) : 'Closed'}). Total rental locked at ${formatAED(financials.totalAccruedRental)}.`}
                </span>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                Monthly Rental Rate
              </span>
              {isEditable && onMonthlyPaymentChange ? (
                <div className="mt-1 relative flex items-center justify-end">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#667085]">
                      AED
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyPaymentAmount || ''}
                      onChange={(e) => onMonthlyPaymentChange(Number(e.target.value) || 0)}
                      placeholder="5000"
                      className="w-28 pl-8 pr-2 py-1 bg-white border border-[#D0D5DD] rounded-md text-xs font-bold text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <span className="ml-1 text-xs font-bold text-[#475467]">/ mo</span>
                </div>
              ) : (
                <span className="font-bold text-sm">
                  {formatAED(currentMonthlyRate)} / Month
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* 5-Card Commercial & Payment Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1 & 2: Dynamic for Extension vs Monthly Recurring vs Standard */}
          {financials.hasExtension ? (
            <>
              {/* Card 1: Original Rental */}
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E4E7EC]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Original Rental (AED)
                  </span>
                  <span className="text-[9px] text-[#2563EB] font-semibold bg-[#EFF6FF] px-1.5 py-0.2 rounded">
                    {financials.originalHirePeriodDays || 20} Days
                  </span>
                </div>
                <span className="font-bold text-sm text-[#172033] block mt-1 tabular-nums">
                  {formatAED(financials.originalRentalAmount)}
                </span>
                <span className="text-[10px] text-[#667085] block mt-0.5 truncate">
                  Original hire period
                </span>
              </div>

              {/* Card 2: Extension Rental */}
              <div className="p-3 bg-[#FFFBEB] rounded-lg border border-[#FDE68A]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#B45309] uppercase tracking-wider block">
                    Extension Rental (AED)
                  </span>
                  <span className="text-[9px] text-[#B45309] font-semibold bg-[#FEF3C7] px-1.5 py-0.2 rounded">
                    {financials.extensionDays || 7} Days
                  </span>
                </div>
                <span className="font-bold text-sm text-[#B45309] block mt-1 tabular-nums">
                  {formatAED(financials.extensionRentalAmount)}
                </span>
                <span className="text-[10px] text-[#B45309]/80 block mt-0.5 truncate">
                  Additional extension period
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Card 1: Total Contract / Initial Amount (AED) */}
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E4E7EC]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Total Contract (AED)
                  </span>
                  {isEditable && onTotalAmountChange ? (
                    <span className="text-[9px] text-[#2563EB] font-semibold bg-[#EFF6FF] px-1.5 py-0.2 rounded">
                      Editable
                    </span>
                  ) : currentMonthlyRate && currentMonthlyRate > 0 ? (
                    <span className="text-[9px] text-[#16A34A] font-semibold bg-[#DCFCE7] px-1.5 py-0.2 rounded">
                      {financials.contractMonthsCount || financials.paymentSchedule?.length || 1} mos
                    </span>
                  ) : null}
                </div>

                {isEditable && onTotalAmountChange ? (
                  <div className="mt-1 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                      AED
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalContractAmount || ''}
                      onChange={(e) => onTotalAmountChange(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-11 pr-3 py-1 bg-white border border-[#D0D5DD] rounded-md font-bold text-sm text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                ) : (
                  <span className="font-bold text-sm text-[#172033] block mt-1 tabular-nums">
                    {formatAED(effectiveTotalAmount)}
                  </span>
                )}
                <span className="text-[10px] text-[#667085] block mt-0.5 truncate" title="Total contract rental">
                  {currentMonthlyRate && currentMonthlyRate > 0
                    ? `${financials.contractMonthsCount || financials.paymentSchedule?.length || 1} mos × ${formatAED(currentMonthlyRate)}/mo`
                    : '1st mo + delivery charges'}
                </span>
              </div>

              {/* Card 2: Monthly Rental Rate (AED) — Optional Recurring for Ongoing Projects */}
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E4E7EC]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Monthly Rental Rate (AED)
                  </span>
                  {isEditable && onMonthlyPaymentChange ? (
                    <span className="text-[9px] text-[#2563EB] font-semibold bg-[#EFF6FF] px-1.5 py-0.2 rounded">
                      Recurring
                    </span>
                  ) : currentMonthlyRate && currentMonthlyRate > 0 ? (
                    <span className="text-[9px] text-[#16A34A] font-semibold bg-[#DCFCE7] px-1.5 py-0.2 rounded">
                      Active
                    </span>
                  ) : null}
                </div>

                {isEditable && onMonthlyPaymentChange ? (
                  <div className="mt-1 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                      AED
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyPaymentAmount || ''}
                      onChange={(e) => onMonthlyPaymentChange(Number(e.target.value) || 0)}
                      placeholder="e.g. 5000 / mo"
                      className="w-full pl-11 pr-3 py-1 bg-white border border-[#D0D5DD] rounded-md font-bold text-sm text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                ) : (
                  <span className="font-bold text-sm text-[#172033] block mt-1 tabular-nums">
                    {currentMonthlyRate ? `${formatAED(currentMonthlyRate)} / mo` : 'Not Set'}
                  </span>
                )}
                <span className="text-[10px] text-[#667085] block mt-0.5 truncate" title="Subsequent months rental without delivery/pickup charges">
                  Recurring rate (materials on site)
                </span>
              </div>
            </>
          )}

          {/* Card 3: Amount Paid (AED) - AUTOMATIC */}
          <div className="p-3 bg-[#F0FDF4] rounded-lg border border-[#BBF7D0]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#15803D] uppercase tracking-wider block">
                Amount Paid (AED)
              </span>
              <span className="text-[9px] text-[#15803D] bg-[#DCFCE7] px-1.5 py-0.2 rounded font-semibold">
                Automatic ({projectPayments.length} txns)
              </span>
            </div>
            <span className="font-black text-base text-[#15803D] block mt-1 tabular-nums">
              {formatAED(totalPaid)}
            </span>
            <span className="text-[10px] text-[#15803D]/80 block mt-0.5 truncate">
              Sum of recorded payments
            </span>
          </div>

          {/* Card 4: Amount Pending (AED) - AUTOMATIC (Formula) */}
          <div
            className={`p-3 rounded-lg border-2 ${
              totalPending === 0
                ? 'bg-[#F0FDF4] border-[#16A34A]'
                : isOverdue
                ? 'bg-[#FEF2F2] border-[#DC2626]'
                : 'bg-[#FFFBEB] border-[#D97706]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider block ${
                  totalPending === 0
                    ? 'text-[#15803D]'
                    : isOverdue
                    ? 'text-[#DC2626]'
                    : 'text-[#B45309]'
                }`}
              >
                ★ Amount Pending (AED)
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  totalPending === 0
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : isOverdue
                    ? 'bg-[#FEE2E2] text-[#DC2626]'
                    : 'bg-[#FEF3C7] text-[#B45309]'
                }`}
              >
                Formula
              </span>
            </div>
            <span
              className={`font-black text-base sm:text-lg block mt-0.5 tabular-nums ${
                totalPending === 0
                  ? 'text-[#15803D]'
                  : isOverdue
                  ? 'text-[#DC2626]'
                  : 'text-[#B45309]'
              }`}
            >
              {totalPending === 0 ? 'AED 0 (PAID)' : formatAED(totalPending)}
            </span>
            <span className="text-[10px] text-[#667085] block mt-0.5 truncate">
              Total - Paid Received
            </span>
          </div>

          {/* Card 5: Next Payment Due */}
          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E4E7EC]">
            <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Next Payment Due
            </span>
            <span
              className={`font-bold text-sm block mt-1 ${
                isOverdue ? 'text-[#DC2626]' : 'text-[#172033]'
              }`}
            >
              {nextDueDateDisplay}
            </span>
            <span
              className={`text-[10px] block mt-0.5 font-medium truncate ${
                isOverdue ? 'text-[#DC2626]' : 'text-[#667085]'
              }`}
            >
              {isOverdue ? 'Payment overdue' : 'Earliest uncollected'}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. PAYMENT HISTORY TABLE                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E4E7EC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Payment History ({projectPayments.length} Transactions)</span>
            </h4>
            <p className="text-[11px] text-[#667085]">
              Real-time ledger of all payment receipts recorded against this project.
            </p>
          </div>

          {/* Mini Top Banner in Payment History: TOTAL | PAID | PENDING */}
          <div className="flex items-center gap-3 text-xs bg-white px-3 py-1.5 rounded-lg border border-[#E4E7EC]">
            <div>
              <span className="text-[9px] uppercase font-bold text-[#667085] block">TOTAL</span>
              <span className="font-bold text-[#172033]">{formatAED(effectiveTotalAmount)}</span>
            </div>
            <div className="w-px h-5 bg-[#E4E7EC]" />
            <div>
              <span className="text-[9px] uppercase font-bold text-[#16A34A] block">PAID</span>
              <span className="font-bold text-[#16A34A]">{formatAED(totalPaid)}</span>
            </div>
            <div className="w-px h-5 bg-[#E4E7EC]" />
            <div>
              <span
                className={`text-[9px] uppercase font-bold block ${
                  totalPending === 0 ? 'text-[#16A34A]' : isOverdue ? 'text-[#DC2626]' : 'text-[#B45309]'
                }`}
              >
                PENDING
              </span>
              <span
                className={`font-black ${
                  totalPending === 0 ? 'text-[#16A34A]' : isOverdue ? 'text-[#DC2626]' : 'text-[#B45309]'
                }`}
              >
                {formatAED(totalPending)}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#475467] font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Payment Reference</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                <th className="py-2.5 px-3">Remarks</th>
                {canManagePayments && <th className="py-2.5 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {projectPayments.length === 0 ? (
                <tr>
                  <td colSpan={canManagePayments ? 7 : 6} className="py-6 text-center text-[#667085]">
                    <CreditCard className="w-6 h-6 mx-auto mb-1 text-[#98A2B3]" />
                    <p className="font-medium text-xs text-[#344054]">No payments recorded yet</p>
                    <p className="text-[11px] text-[#98A2B3]">
                      Click "+ ADD PAYMENT" above to record a new receipt.
                    </p>
                  </td>
                </tr>
              ) : (
                projectPayments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-[#F8FAFC] transition">
                    <td className="py-2.5 px-3 font-medium text-[#172033] whitespace-nowrap">
                      {formatDateDDMMYYYY(pmt.paymentReceivedDate)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-[#2563EB] whitespace-nowrap">
                      {pmt.paymentReference || '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] rounded text-[10px] font-semibold border border-[#BFDBFE]">
                        {pmt.paymentType || 'Rental'}
                        {pmt.installmentMonth ? ` (${pmt.installmentMonth})` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#475467] whitespace-nowrap">
                      {pmt.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#16A34A] tabular-nums whitespace-nowrap">
                      {formatAED(pmt.paymentReceivedAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-[#667085] truncate max-w-xs">
                      {pmt.remarks || '—'}
                    </td>
                    {canManagePayments && (
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePayment(pmt)}
                          title="Delete Payment Record"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-md transition cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. RENTAL PERIODS & EXTENSION / PAYMENT SCHEDULE                   */}
      {/* ------------------------------------------------------------------ */}
      {financials.paymentSchedule && financials.paymentSchedule.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E4E7EC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>
                  {financials.hasExtension
                    ? 'Rental Periods & Extension Schedule'
                    : 'Monthly Rental Schedule (Auto-Accrued till Return/Close)'}
                </span>
              </h4>
              <p className="text-[11px] text-[#667085]">
                {financials.hasExtension
                  ? `Distinct rental periods: Original Hire (${financials.originalHirePeriodDays || 20} Days) immediately followed by Extension (${financials.extensionDays || 7} Days).`
                  : financials.isRentalAutoAccruing
                  ? `Each monthly rental installment accrues automatically at ${formatAED(currentMonthlyRate)}/mo until equipment is returned or closed.`
                  : `Equipment returned/closed${financials.rentalStoppedDate ? ` on ${formatDateDDMMYYYY(financials.rentalStoppedDate)}` : ''}. Rental accrual locked for ${financials.accruedRentalMonths} months.`}
              </p>
            </div>

            <span className="text-[10px] text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded font-bold">
              {financials.hasExtension
                ? `Total Contract: ${formatAED(financials.contractAmount)} • ${financials.paymentSchedule.length} Periods`
                : `Total Contract: ${formatAED(effectiveTotalAmount)} (${financials.contractMonthsCount || financials.paymentSchedule.length} Mos) • Accrued: ${formatAED(financials.totalAccruedRental)} (${financials.accruedRentalMonths} Mos)`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#475467] font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Rental Period</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Expected Rental</th>
                  <th className="py-2.5 px-3 text-right">Received (AED)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {financials.paymentSchedule.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC] transition">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-[#172033]">
                        {item.periodType === 'EXTENSION' ? (
                          <span className="text-[#B45309]">⚡ Extension ({item.durationDays || 7} Days)</span>
                        ) : item.periodType === 'ORIGINAL' ? (
                          <span className="text-[#1E293B]">Original Hire ({item.durationDays || 20} Days)</span>
                        ) : (
                          `${item.periodNumber ? `Month ${item.periodNumber}: ` : ''}${item.monthLabel}`
                        )}
                      </div>
                      {item.periodLabel && (
                        <div className="text-[10px] text-[#2563EB] font-medium font-mono">
                          Period: {item.periodLabel}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#475467] whitespace-nowrap">
                      {formatDateDDMMYYYY(item.dueDate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[#172033] tabular-nums whitespace-nowrap">
                      {item.unaccruedAmount && item.unaccruedAmount > 0 ? (
                        <div>
                          <div className="font-bold text-[#172033]">
                            {formatAED(item.accruedAmount)} <span className="text-[10px] text-[#16A34A] font-semibold">(Accrued)</span>
                          </div>
                          <div className="text-[10px] text-[#64748B]">
                            {formatAED(item.expectedAmount)} total • {formatAED(item.unaccruedAmount)} unaccrued
                          </div>
                        </div>
                      ) : item.status === 'UPCOMING' ? (
                        <div>
                          <div className="font-bold text-[#64748B]">
                            {formatAED(item.expectedAmount)}
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">
                            Upcoming (0 accrued)
                          </div>
                        </div>
                      ) : (
                        formatAED(item.expectedAmount)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#16A34A] tabular-nums whitespace-nowrap">
                      {formatAED(item.receivedAmount)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'PAID'
                            ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                            : item.status === 'PARTIALLY_PAID'
                            ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                            : item.status === 'OVERDUE'
                            ? 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]'
                            : item.status === 'PENDING'
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                            : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {item.status !== 'PAID' && (
                          item.canRecordPayment === false ? (
                            <button
                              type="button"
                              disabled
                              className="px-2.5 py-1 bg-[#F1F5F9] text-[#94A3B8] border border-[#CBD5E1] rounded text-[11px] font-semibold cursor-not-allowed opacity-80"
                              title={
                                item.status === 'UPCOMING'
                                  ? `Cannot record payment for future period (starts ${formatDateDDMMYYYY(item.dueDate)}). Today is the billing cutoff.`
                                  : 'Rental accrued through today is already fully satisfied.'
                              }
                            >
                              {item.status === 'UPCOMING' ? 'Upcoming (Locked)' : 'Paid to Date'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = Math.max(
                                  0,
                                  (item.accruedAmount !== undefined ? item.accruedAmount : item.expectedAmount) - item.receivedAmount
                                );
                                handleOpenAddPayment(item.monthLabel, remaining);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-[#EFF6FF] text-[#2563EB] border border-[#D0D5DD] hover:border-[#2563EB] rounded text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                            >
                              Record Payment
                            </button>
                          )
                        )}

                        {canManagePayments && item.receivedAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetPayment =
                                projectPayments.find(
                                  (p) =>
                                    p.installmentMonth &&
                                    (p.installmentMonth.toLowerCase().includes(item.monthLabel.toLowerCase()) ||
                                      item.monthLabel.toLowerCase().includes(p.installmentMonth.toLowerCase()))
                                ) ||
                                projectPayments[projectPayments.length - 1];

                              if (targetPayment) {
                                setConfirmDeletePayment(targetPayment);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] rounded text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                            title={`Delete wrong payment recorded for ${item.monthLabel}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Payment</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#F8FAFC] border-t-2 border-[#CBD5E1] font-bold text-xs text-[#0F172A]">
                <tr>
                  <td className="py-2.5 px-3">
                    Total Contracted ({financials.paymentSchedule.length} Months)
                  </td>
                  <td className="py-2.5 px-3 text-[#64748B] font-mono text-[11px]">
                    Accrued: {formatAED(financials.totalAccruedRental)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#2563EB]">
                    {formatAED(financials.totalContractedRental || effectiveTotalAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#15803D]">
                    {formatAED(totalPaid)}
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] text-[#64748B]">
                    Pending: <strong className={totalPending > 0 ? 'text-[#B45309]' : 'text-[#15803D]'}>{formatAED(totalPending)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. MODAL: + ADD PAYMENT FORM (PORTALED TO BODY TO PREVENT NESTING) */}
      {/* ------------------------------------------------------------------ */}
      {showAddPaymentModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] bg-[#0B1526]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddPaymentModal(false);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-[#E4E7EC] max-w-lg w-full p-5 sm:p-6 my-auto animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#172033] flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#2563EB]" />
                    <span>Record Payment Transaction</span>
                  </h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    {project.projectCode} — {project.company}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="p-1.5 text-[#667085] hover:text-[#172033] hover:bg-[#F2F4F7] rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {paymentError && (
                <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626] text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSavePayment(e);
                }}
                className="space-y-3.5 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Payment Date */}
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Payment Date <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  {/* Payment Amount */}
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Payment Amount (AED) <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg font-bold text-[#16A34A] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Payment Reference */}
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Payment Reference (Cheque / Transfer #)
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. CHQ-482910 or TRF-ENBD"
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg font-mono text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  {/* Payment Type */}
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Payment Type <span className="text-[#DC2626]">*</span>
                    </label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="Rental">Rental</option>
                      <option value="Monthly Payment">Monthly Payment</option>
                      <option value="Advance">Advance</option>
                      <option value="Final Payment">Final Payment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Payment Method */}
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg font-medium text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Installment Month Selector */}
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      For Rental Period / Month (Optional)
                    </label>
                    <select
                      value={installmentMonth}
                      onChange={(e) => setInstallmentMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="">General Project Payment</option>
                      {scheduleMonthOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="CUSTOM">Custom / Other Month...</option>
                    </select>
                  </div>
                </div>

                {installmentMonth === 'CUSTOM' && (
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1">
                      Specify Custom Month / Period
                    </label>
                    <input
                      type="text"
                      value={customMonthInput}
                      onChange={(e) => setCustomMonthInput(e.target.value)}
                      placeholder="e.g. Mar 2026 or Extension Period"
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                )}

                {/* Remarks */}
                <div>
                  <label className="block font-semibold text-[#344054] mb-1">
                    Remarks / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={paymentRemarks}
                    onChange={(e) => setPaymentRemarks(e.target.value)}
                    placeholder="Optional remarks e.g. Client deposited via ENBD online transfer"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#172033] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                {/* Modal Actions */}
                <div className="pt-3 border-t border-[#E4E7EC] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddPaymentModal(false)}
                    className="px-4 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {submittingPayment ? 'Saving Receipt...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. MODAL: DELETE WRONG PAYMENT CONFIRMATION                        */}
      {/* ------------------------------------------------------------------ */}
      {confirmDeletePayment &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] bg-[#0B1526]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deletingPayment) setConfirmDeletePayment(null);
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
                    Are you sure you want to remove this payment? The project's outstanding balance, ledger, and rental schedule will be automatically reversed.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingPayment}
                  onClick={() => setConfirmDeletePayment(null)}
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
                    {formatAED(confirmDeletePayment.paymentReceivedAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#667085]">Received Date:</span>
                  <span className="font-semibold text-[#172033]">
                    {formatDateDDMMYYYY(confirmDeletePayment.paymentReceivedDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#667085]">Payment Method:</span>
                  <span className="font-medium text-[#172033]">
                    {confirmDeletePayment.paymentMethod || 'Bank Transfer'}
                  </span>
                </div>
                {confirmDeletePayment.paymentReference && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#667085]">Reference:</span>
                    <span className="font-mono text-[#2563EB] font-medium">
                      {confirmDeletePayment.paymentReference}
                    </span>
                  </div>
                )}
                {confirmDeletePayment.installmentMonth && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#667085]">Target Month:</span>
                    <span className="font-semibold text-[#16A34A]">
                      {confirmDeletePayment.installmentMonth}
                    </span>
                  </div>
                )}
                {confirmDeletePayment.remarks && (
                  <div className="pt-1 border-t border-[#E4E7EC] text-[#667085] italic text-[11px]">
                    "{confirmDeletePayment.remarks}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                <button
                  type="button"
                  disabled={deletingPayment}
                  onClick={() => setConfirmDeletePayment(null)}
                  className="px-3.5 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingPayment}
                  onClick={handleExecuteDeletePayment}
                  className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingPayment ? 'Deleting...' : 'Yes, Delete Payment'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
