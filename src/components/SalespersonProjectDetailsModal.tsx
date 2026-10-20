import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, PaymentFollowup, RemarksHistory } from '../types';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  getDueStatus,
  calculateExtensionDetails,
  calculateTotalHireDays,
} from '../business/dateRules';
import {
  formatAED,
  calculateProjectFinancials,
} from '../utils/commercialUtils';
import {
  X,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  User,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  History,
  Send,
  PlusCircle,
  Receipt,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
} from 'lucide-react';

interface SalespersonProjectDetailsModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onAddFollowup?: (project: Project) => void;
}

export const SalespersonProjectDetailsModal: React.FC<SalespersonProjectDetailsModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  const { userProfile } = useAuth();
  const {
    paymentFollowups,
    remarksHistories,
    payments,
    addPaymentFollowup,
    addProjectRemark,
  } = useProjects();

  const [activeTab, setActiveTab] = useState<'overview' | 'rental' | 'payments' | 'followups' | 'remarks'>('overview');

  // Follow-up form state
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupDate, setFollowupDate] = useState(new Date().toISOString().split('T')[0]);
  const [followupStatus, setFollowupStatus] = useState<string>('Called');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [followupSuccess, setFollowupSuccess] = useState(false);

  // New Remark state
  const [newRemarkText, setNewRemarkText] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);
  const [remarkSuccess, setRemarkSuccess] = useState(false);

  // Error state
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  // Commercial calculations
  const financials = calculateProjectFinancials(project);
  const dueStatus = getDueStatus(project.dueDate, project.projectStatus);

  // Filtered records for this project only
  const projectFollowups = paymentFollowups.filter((f) => f.projectId === project.id);
  const projectRemarks = remarksHistories.filter((r) => r.projectId === project.id);
  const projectPayments = payments.filter((p) => p.projectId === project.id);

  // Extension details
  const hasExtension = !!(project.extensionDays && project.extensionDays > 0);
  const extensionDetails = hasExtension
    ? calculateExtensionDetails(
        project.originalDueDate || project.dueDate,
        project.originalHirePeriodDays || 30,
        project.extensionDays || 0
      )
    : null;

  // Handle Record Follow-up
  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupNotes.trim()) return;

    setSubmittingFollowup(true);
    setActionError(null);
    try {
      await addPaymentFollowup(
        project.id,
        followupNotes.trim(),
        followupDate,
        {
          followUpStatus: followupStatus as any,
          promisedDate: promiseDate || undefined,
          promisedAmount: promiseAmount ? Number(promiseAmount) : undefined,
        }
      );
      setFollowupNotes('');
      setPromiseDate('');
      setPromiseAmount('');
      setFollowupSuccess(true);
      setTimeout(() => setFollowupSuccess(false), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save follow-up');
    } finally {
      setSubmittingFollowup(false);
    }
  };

  // Handle Add Remark
  const handleSaveRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemarkText.trim()) return;

    setSubmittingRemark(true);
    setActionError(null);
    try {
      await addProjectRemark(project.id, newRemarkText.trim());
      setNewRemarkText('');
      setRemarkSuccess(true);
      setTimeout(() => setRemarkSuccess(false), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save remark');
    } finally {
      setSubmittingRemark(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-blue-600/90 text-white font-mono font-bold text-xs rounded-md tracking-wider">
                {project.projectCode}
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{project.company}</span>
                  <span className="text-xs font-normal text-slate-400">
                    ({project.scaffoldingType})
                  </span>
                </h2>
                <p className="text-xs text-slate-300 font-normal">
                  Ref: <span className="text-slate-100 font-medium">{project.projectReference || '-'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                  project.projectStatus === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : project.projectStatus === 'EXTENDED'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                {project.projectStatus}
              </span>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 border-b border-slate-200 text-xs">
            <div className="bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Contract Value</span>
              <span className="font-bold text-slate-900 text-sm">{formatAED(financials.totalContractValue)}</span>
            </div>
            <div className="bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Total Received</span>
              <span className="font-bold text-emerald-700 text-sm">{formatAED(financials.totalReceived)}</span>
            </div>
            <div className="bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Total Pending</span>
              <span className={`font-bold text-sm ${financials.totalOutstanding > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                {formatAED(financials.totalOutstanding)}
              </span>
            </div>
            <div className="bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Due Date & Status</span>
              <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5 mt-0.5">
                <span>{formatDateDDMMYYYY(project.dueDate)}</span>
                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${dueStatus.badgeColorClass}`}>
                  {dueStatus.label}
                </span>
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 bg-white">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Project Overview
            </button>
            <button
              onClick={() => setActiveTab('rental')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rental'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Rental & Extensions {hasExtension && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Payments ({projectPayments.length})
            </button>
            <button
              onClick={() => setActiveTab('followups')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'followups'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Follow-ups ({projectFollowups.length})
            </button>
            <button
              onClick={() => setActiveTab('remarks')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'remarks'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Remarks ({projectRemarks.length})
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-[#F8FAFC]">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Client & Project Info */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Client & Reference Details
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Company Name</span>
                        <span className="font-semibold text-slate-900">{project.company}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Contact Mobile</span>
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {project.mobile || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Project Reference / LPO</span>
                        <span className="font-semibold text-slate-900">{project.projectReference || '-'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Assigned Salesperson</span>
                        <span className="font-semibold text-blue-700 flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-500" />
                          {project.salespersonName || userProfile?.name || 'Assigned to You'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Scaffolding Scope</span>
                        <span className="font-semibold text-slate-900">{project.scaffoldingType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Hire Dates & Status */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Timeline & Status
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Delivery Date</span>
                        <span className="font-semibold text-slate-900">{formatDateDDMMYYYY(project.deliveryDate)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Hire Period</span>
                        <span className="font-semibold text-slate-900">
                          {project.hirePeriodDays} Days
                          {hasExtension && (
                            <span className="text-[11px] text-amber-600 ml-1 font-normal">
                              ({project.originalHirePeriodDays || 30} Orig + {project.extensionDays} Ext)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Due Date</span>
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          {formatDateDDMMYYYY(project.dueDate)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">Operational Due Status</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${dueStatus.badgeColorClass}`}>
                          {dueStatus.label}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Payment Status</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            project.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : project.paymentStatus === 'PARTIAL_PAID'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {project.paymentStatus === 'PAID'
                            ? 'PAID'
                            : project.paymentStatus === 'PARTIAL_PAID'
                            ? 'PARTIAL PAID'
                            : 'NOT PAID'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarks Section */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Commercial Remarks & Job Scope
                  </h3>
                  <p className="text-xs text-slate-700 font-normal leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                    {project.remarks || 'No remarks recorded for this project.'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: RENTAL & EXTENSIONS */}
            {activeTab === 'rental' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Rental Calculation & Extension Schedule
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Formula: New Due Date = Original Due Date + Extension Days
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                      <span className="text-[11px] font-semibold text-blue-700 block">Original Hire Period</span>
                      <p className="text-base font-bold text-blue-950">
                        {project.originalHirePeriodDays || project.hirePeriodDays || 30} Days
                      </p>
                      <p className="text-xs text-blue-800">
                        Original Due:{' '}
                        <strong>
                          {formatDateDDMMYYYY(
                            project.originalDueDate ||
                              (hasExtension && project.extensionDays
                                ? extensionDetails?.newDueDate
                                : project.dueDate)
                          )}
                        </strong>
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                      <span className="text-[11px] font-semibold text-amber-700 block">Extension Days</span>
                      <p className="text-base font-bold text-amber-950">
                        {hasExtension ? `+${project.extensionDays} Days` : 'No Extension'}
                      </p>
                      {hasExtension && extensionDetails && (
                        <p className="text-xs text-amber-800">
                          {formatDateDDMMYYYY(extensionDetails.extensionStartDate)} to{' '}
                          <strong>{formatDateDDMMYYYY(extensionDetails.extensionEndDate)}</strong>
                        </p>
                      )}
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-700 block">Total Active Duration</span>
                      <p className="text-base font-bold text-emerald-950">
                        {calculateTotalHireDays(
                          project.originalHirePeriodDays || project.hirePeriodDays || 30,
                          project.extensionDays || 0
                        )}{' '}
                        Total Days
                      </p>
                      <p className="text-xs text-emerald-800">
                        Final Due Date: <strong>{formatDateDDMMYYYY(project.dueDate)}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Rental Breakdown Table */}
                  <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Period Description</th>
                          <th className="py-2.5 px-3">Start Date</th>
                          <th className="py-2.5 px-3">End Date</th>
                          <th className="py-2.5 px-3">Duration</th>
                          <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            Original Hire Contract
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{formatDateDDMMYYYY(project.deliveryDate)}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {formatDateDDMMYYYY(project.originalDueDate || project.dueDate)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {project.originalHirePeriodDays || project.hirePeriodDays} Days
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 text-right">
                            {formatAED(
                              project.originalRentalAmount ||
                                (hasExtension && project.extensionRentalAmount
                                  ? (project.contractAmount || 0) - project.extensionRentalAmount
                                  : project.contractAmount || 0)
                            )}
                          </td>
                        </tr>

                        {hasExtension && (
                          <tr className="bg-amber-50/40">
                            <td className="py-2.5 px-3 font-semibold text-amber-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Extension Period
                            </td>
                            <td className="py-2.5 px-3 text-amber-800">
                              {formatDateDDMMYYYY(extensionDetails?.extensionStartDate)}
                            </td>
                            <td className="py-2.5 px-3 text-amber-800 font-semibold">
                              {formatDateDDMMYYYY(extensionDetails?.extensionEndDate)}
                            </td>
                            <td className="py-2.5 px-3 text-amber-900 font-medium">
                              +{project.extensionDays} Days
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-900 text-right">
                              {formatAED(project.extensionRentalAmount || 0)}
                            </td>
                          </tr>
                        )}

                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                          <td className="py-2.5 px-3 text-slate-900" colSpan={3}>
                            Total Hire Duration & Contract Amount
                          </td>
                          <td className="py-2.5 px-3 text-blue-700">
                            {project.hirePeriodDays} Days
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 text-right">
                            {formatAED(financials.totalContractValue)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    Payment Ledger for {project.projectCode}
                  </h3>

                  {projectPayments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No payment receipts logged yet</p>
                      <p className="text-slate-400 mt-0.5">
                        Total Pending: {formatAED(financials.totalOutstanding)}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Method</th>
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3">Remarks</th>
                            <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projectPayments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {formatDateDDMMYYYY(p.paymentReceivedDate)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{p.paymentMethod}</td>
                              <td className="py-2.5 px-3 text-slate-600">{p.paymentReference || '-'}</td>
                              <td className="py-2.5 px-3 text-slate-500">{p.remarks || '-'}</td>
                              <td className="py-2.5 px-3 font-bold text-emerald-700 text-right">
                                {formatAED(p.paymentReceivedAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan={4} className="py-2.5 px-3 text-slate-700">
                              Total Received To Date
                            </td>
                            <td className="py-2.5 px-3 text-emerald-800 text-right">
                              {formatAED(financials.totalReceived)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: FOLLOW-UPS */}
            {activeTab === 'followups' && (
              <div className="space-y-4">
                {/* Record Follow-up Form */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                    Record Sales Follow-Up
                  </h3>

                  {followupSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Follow-up entry recorded successfully.
                    </div>
                  )}

                  <form onSubmit={handleSaveFollowup} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Follow-up Date</label>
                        <input
                          type="date"
                          value={followupDate}
                          onChange={(e) => setFollowupDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Interaction Method</label>
                        <select
                          value={followupStatus}
                          onChange={(e) => setFollowupStatus(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                        >
                          <option value="Called">Phone Call</option>
                          <option value="Reminder Sent">WhatsApp / Email Reminder</option>
                          <option value="Promise to Pay">Promise to Pay</option>
                          <option value="Payment Awaited">Payment Awaited</option>
                          <option value="Not Contacted">Site Visit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Promise Date (Optional)</label>
                        <input
                          type="date"
                          value={promiseDate}
                          onChange={(e) => setPromiseDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Notes & Conversation Summary</label>
                      <textarea
                        rows={2}
                        value={followupNotes}
                        onChange={(e) => setFollowupNotes(e.target.value)}
                        placeholder="Detail client response, commitments, next steps..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingFollowup || !followupNotes.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {submittingFollowup ? 'Saving...' : 'Save Follow-Up'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Follow-up Timeline */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    Interaction History ({projectFollowups.length})
                  </h3>

                  {projectFollowups.length === 0 ? (
                    <p className="text-slate-400 text-xs italic py-4 text-center">
                      No follow-up logs recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {projectFollowups.map((f) => (
                        <div
                          key={f.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                {f.followUpStatus}
                              </span>
                              <span>{f.createdByName}</span>
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatDateDDMMYYYY(f.followUpDate)}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap">{f.notes}</p>
                          {f.promiseDate && (
                            <div className="pt-1 text-[11px] text-amber-700 font-medium">
                              Promise to pay date: {formatDateDDMMYYYY(f.promiseDate)}
                              {f.promiseAmount && ` (AED ${f.promiseAmount.toLocaleString()})`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: REMARKS */}
            {activeTab === 'remarks' && (
              <div className="space-y-4">
                {/* Add Remark Form */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                    Add Project Remark
                  </h3>

                  {remarkSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Remark saved to project audit trail.
                    </div>
                  )}

                  <form onSubmit={handleSaveRemark} className="space-y-3 text-xs">
                    <div>
                      <textarea
                        rows={2}
                        value={newRemarkText}
                        onChange={(e) => setNewRemarkText(e.target.value)}
                        placeholder="Add internal operational or commercial note..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingRemark || !newRemarkText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {submittingRemark ? 'Adding...' : 'Post Remark'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Remarks History */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Remarks Archive ({projectRemarks.length})
                  </h3>

                  {projectRemarks.length === 0 ? (
                    <p className="text-slate-400 text-xs italic py-4 text-center">
                      No additional remarks recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {projectRemarks.map((r) => (
                        <div
                          key={r.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{r.createdByName}</span>
                            <span className="text-[11px] text-slate-400">
                              {formatDateTimeDDMMYYYY(r.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap">{r.remarkText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5 font-normal">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              Salesperson Portal — Restricted Project Access
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
