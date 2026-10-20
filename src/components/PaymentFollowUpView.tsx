import React, { useState, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import { getWhatsAppUrl } from '../utils/whatsapp';
import {
  CreditCard,
  Plus,
  Send,
  MessageSquare,
  Search,
  CheckCircle,
  Clock,
  Phone,
  Filter,
  X,
} from 'lucide-react';

interface PaymentFollowUpViewProps {
  onViewProject: (project: Project) => void;
}

export const PaymentFollowUpView: React.FC<PaymentFollowUpViewProps> = ({ onViewProject }) => {
  const { projects, paymentFollowups, addPaymentFollowup } = useProjects();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState<'ALL' | 'NOT_PAID' | 'PARTIAL_PAID'>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Modal / Form state for logging a new follow-up
  const [followupModalProject, setFollowupModalProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group follow-ups by projectId
  const followupsByProject = useMemo(() => {
    const map = new Map<string, typeof paymentFollowups>();
    for (const f of paymentFollowups) {
      if (!map.has(f.projectId)) {
        map.set(f.projectId, []);
      }
      map.get(f.projectId)!.push(f);
    }
    return map;
  }, [paymentFollowups]);

  // Projects that require payment attention: NOT_PAID, PARTIAL_PAID, or have recorded follow-ups
  const targetProjects = useMemo(() => {
    return projects.filter((p) => {
      const hasFollowups = followupsByProject.has(p.id);
      const isUnpaid = p.paymentStatus === 'NOT_PAID' || p.paymentStatus === 'PARTIAL_PAID';
      if (!hasFollowups && !isUnpaid) return false;

      if (filterPayment === 'NOT_PAID' && p.paymentStatus !== 'NOT_PAID') return false;
      if (filterPayment === 'PARTIAL_PAID' && p.paymentStatus !== 'PARTIAL_PAID') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          p.projectCode?.toLowerCase().includes(term) ||
          p.company?.toLowerCase().includes(term) ||
          p.projectReference?.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [projects, followupsByProject, filterPayment, searchTerm]);

  const handleOpenFollowupModal = (project: Project) => {
    setFollowupModalProject(project);
    setNotes('');
    setFollowUpDate(new Date().toISOString().split('T')[0]);
    setError(null);
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupModalProject || !notes.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await addPaymentFollowup(followupModalProject.id, notes.trim(), followUpDate);
      setFollowupModalProject(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB]" />
            <span>Payment Follow-Up Log</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] font-normal mt-0.5">
            Track communications and collection timelines for unpaid and partially paid scaffolding projects.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search project or client..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-[#172033] placeholder:text-[#98A2B3]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F2F4F7] p-0.5 rounded-lg border border-[#E4E7EC] text-xs">
            <button
              onClick={() => setFilterPayment('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterPayment === 'ALL'
                  ? 'bg-[#172B4D] text-white shadow-xs'
                  : 'text-[#475467] hover:text-[#172033]'
              }`}
            >
              All Attention
            </button>
            <button
              onClick={() => setFilterPayment('NOT_PAID')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterPayment === 'NOT_PAID'
                  ? 'bg-[#DC2626] text-white shadow-xs'
                  : 'text-[#475467] hover:text-[#172033]'
              }`}
            >
              Not Paid
            </button>
            <button
              onClick={() => setFilterPayment('PARTIAL_PAID')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterPayment === 'PARTIAL_PAID'
                  ? 'bg-[#D97706] text-white shadow-xs'
                  : 'text-[#475467] hover:text-[#172033]'
              }`}
            >
              Partial
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Projects List + Follow-up History Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Projects Column */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E4E7EC] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E4E7EC] bg-[#F8FAFC] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#475467] uppercase tracking-wider">
              Projects Requiring Follow-Up ({targetProjects.length})
            </h2>
          </div>

          <div className="divide-y divide-[#E4E7EC] max-h-[650px] overflow-y-auto">
            {targetProjects.length === 0 ? (
              <div className="text-center py-12 text-[#667085]">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#16A34A]" />
                <p className="text-sm font-medium text-[#172033]">All payments are settled</p>
                <p className="text-xs text-[#98A2B3] mt-0.5">No pending payment follow-ups found</p>
              </div>
            ) : (
              targetProjects.map((project) => {
                const projectFollowups = followupsByProject.get(project.id) || [];
                const latestFollowup = projectFollowups[0];
                const isSelected = selectedProjectId === project.id;
                const waUrl = getWhatsAppUrl(
                  project.mobile,
                  `Hello ${project.company}, following up regarding payment for project ${project.projectCode}`
                );

                return (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`p-4 transition cursor-pointer hover:bg-[#F8FAFC] ${
                      isSelected ? 'bg-[#EFF6FF]/60 border-l-4 border-l-[#2563EB]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="font-mono text-xs font-semibold text-[#2563EB] mr-2">
                          {project.projectCode}
                        </span>
                        <span className="font-semibold text-[#172033] text-sm">{project.company}</span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                          project.paymentStatus === 'PAID'
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                            : project.paymentStatus === 'PARTIAL_PAID'
                            ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                            : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                        }`}
                      >
                        {project.paymentStatus}
                      </span>
                    </div>

                    <div className="text-xs text-[#667085] mb-2 flex items-center gap-3">
                      <span>Ref: {project.projectReference}</span>
                      <span>Delivery: {formatDateDDMMYYYY(project.deliveryDate)}</span>
                      <span>Due: {formatDateDDMMYYYY(project.dueDate)}</span>
                    </div>

                    {/* Latest Follow-up note preview */}
                    {latestFollowup ? (
                      <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E4E7EC] text-xs text-[#172033] mb-2">
                        <div className="flex items-center justify-between text-[10px] text-[#667085] mb-0.5">
                          <span className="font-medium text-[#2563EB]">
                            Latest Follow-Up #{latestFollowup.followUpNumber}
                          </span>
                          <span className="font-normal">{formatDateDDMMYYYY(latestFollowup.followUpDate)}</span>
                        </div>
                        <p className="line-clamp-2 italic text-[#475467] font-normal">{latestFollowup.notes}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#98A2B3] italic mb-2">No follow-ups recorded yet</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-medium text-[#667085]">
                        {projectFollowups.length} follow-up record{projectFollowups.length === 1 ? '' : 's'}
                      </span>

                      <div className="flex items-center gap-2">
                        {project.mobile && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7] rounded text-xs font-medium border border-[#BBF7D0] transition cursor-pointer"
                          >
                            <Phone className="w-3 h-3 text-[#16A34A]" />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFollowupModal(project);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white rounded text-xs font-medium shadow-xs transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Log Follow-Up</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Project Timeline Column */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E4E7EC] shadow-xs p-5 flex flex-col">
          {selectedProjectId ? (
            (() => {
              const selProject = projects.find((p) => p.id === selectedProjectId);
              const selFollowups = followupsByProject.get(selectedProjectId) || [];

              if (!selProject) return <div className="text-[#98A2B3]">Project not found</div>;

              return (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="border-b border-[#E4E7EC] pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-[#2563EB]">
                        {selProject.projectCode}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenFollowupModal(selProject)}
                          className="px-2.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-xs transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Follow-Up</span>
                        </button>
                      )}
                    </div>
                    <h3 className="font-semibold text-[#172033] text-base mt-1">{selProject.company}</h3>
                    <p className="text-xs text-[#667085] font-normal">{selProject.projectReference}</p>
                  </div>

                  <h4 className="text-xs font-semibold text-[#475467] uppercase tracking-wider">
                    Follow-Up History Timeline ({selFollowups.length})
                  </h4>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                    {selFollowups.length === 0 ? (
                      <div className="text-center py-10 text-[#98A2B3] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E4E7EC]">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#98A2B3]" />
                        <p className="text-xs font-medium">No follow-ups recorded yet</p>
                      </div>
                    ) : (
                      selFollowups.map((f) => (
                        <div
                          key={f.id}
                          className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E4E7EC] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                              Follow-Up #{f.followUpNumber}
                            </span>
                            <span className="text-[#667085] font-normal">
                              Date: {formatDateDDMMYYYY(f.followUpDate)}
                            </span>
                          </div>
                          <p className="text-[#172033] leading-relaxed whitespace-pre-wrap font-normal">
                            {f.notes}
                          </p>
                          <div className="text-[10px] text-[#667085] pt-1 border-t border-[#E4E7EC] flex justify-between">
                            <span>Logged by: {f.createdByName || 'Admin'}</span>
                            <span>{formatDateTimeDDMMYYYY(f.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#98A2B3]">
              <CreditCard className="w-10 h-10 text-[#98A2B3] mb-3" />
              <p className="text-sm font-semibold text-[#172033]">Select a project</p>
              <p className="text-xs text-[#667085] mt-1">
                Click on any project on the left to inspect its complete follow-up timeline and notes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Follow-Up Modal */}
      {followupModalProject && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#E4E7EC] pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#172033] text-base">Record Payment Follow-Up</h3>
                <p className="text-xs text-[#667085] font-normal">
                  <span className="font-mono text-[#2563EB] font-medium">{followupModalProject.projectCode}</span> — {followupModalProject.company}
                </p>
              </div>
              <button
                onClick={() => setFollowupModalProject(null)}
                className="text-[#667085] hover:text-[#172033] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveFollowup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Follow-Up Date <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-xs text-[#172033]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Follow-Up Notes & Customer Remarks <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Spoke to site finance officer. Promised payment clearance by next Tuesday..."
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-xs text-[#172033] leading-relaxed placeholder:text-[#98A2B3]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                <button
                  type="button"
                  onClick={() => setFollowupModalProject(null)}
                  className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] rounded-lg font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !notes.trim()}
                  className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Saving...' : 'Save Follow-Up'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
