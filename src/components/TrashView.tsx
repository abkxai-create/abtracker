import React, { useState, useRef, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  CheckCircle,
  ShieldAlert,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  RefreshCw,
} from 'lucide-react';

interface TrashViewProps {
  onViewProject: (project: Project) => void;
}

export const TrashView: React.FC<TrashViewProps> = ({ onViewProject }) => {
  const {
    trashedProjects,
    restoreProject,
    permanentlyDeleteProject,
    bulkRestoreProjects,
    bulkPermanentlyDeleteProjects,
  } = useProjects();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Single project purge modal state
  const [projectToPurge, setProjectToPurge] = useState<Project | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Bulk actions state
  const [bulkRestoring, setBulkRestoring] = useState(false);
  const [bulkPurgeModalOpen, setBulkPurgeModalOpen] = useState(false);
  const [bulkPurgeConfirmText, setBulkPurgeConfirmText] = useState('');
  const [bulkPurging, setBulkPurging] = useState(false);
  const [bulkPurgeError, setBulkPurgeError] = useState<string | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const filteredTrashed = trashedProjects.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.projectCode?.toLowerCase().includes(term) ||
      p.company?.toLowerCase().includes(term) ||
      p.projectReference?.toLowerCase().includes(term)
    );
  });

  const isAllSelected =
    filteredTrashed.length > 0 && filteredTrashed.every((p) => selectedIds.has(p.id));
  const isSomeSelected =
    filteredTrashed.some((p) => selectedIds.has(p.id)) && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  // Clean up selectedIds if projects no longer exist in filteredTrashed
  useEffect(() => {
    const existingIds = new Set(trashedProjects.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existingIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [trashedProjects]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTrashed.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Single project restore
  const handleRestore = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoringId(project.id);
    try {
      await restoreProject(project.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      setBulkFeedback({
        type: 'success',
        message: `Project ${project.projectCode} restored successfully.`,
      });
      setTimeout(() => setBulkFeedback(null), 4000);
    } catch (err: any) {
      setBulkFeedback({
        type: 'error',
        message: err.message || 'Failed to restore project',
      });
    } finally {
      setRestoringId(null);
    }
  };

  // Single project purge confirmation
  const handleConfirmPurge = async () => {
    if (!projectToPurge) return;
    if (purgeConfirmText.trim().toUpperCase() !== 'DELETE') {
      setPurgeError('Please type "DELETE" exactly to confirm permanent purge.');
      return;
    }

    setPurging(true);
    setPurgeError(null);
    try {
      await permanentlyDeleteProject(projectToPurge.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(projectToPurge.id);
        return next;
      });
      setBulkFeedback({
        type: 'success',
        message: `Project ${projectToPurge.projectCode} permanently purged.`,
      });
      setProjectToPurge(null);
      setPurgeConfirmText('');
      setTimeout(() => setBulkFeedback(null), 4000);
    } catch (err: any) {
      setPurgeError(err.message || 'Failed to permanently delete project');
    } finally {
      setPurging(false);
    }
  };

  // Bulk restore
  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkRestoring(true);
    setBulkFeedback(null);
    try {
      const count = await bulkRestoreProjects(ids);
      setSelectedIds(new Set());
      setBulkFeedback({
        type: 'success',
        message: `Successfully restored ${count} project${count > 1 ? 's' : ''} to active status.`,
      });
      setTimeout(() => setBulkFeedback(null), 4000);
    } catch (err: any) {
      setBulkFeedback({
        type: 'error',
        message: err.message || 'Failed to restore selected projects.',
      });
    } finally {
      setBulkRestoring(false);
    }
  };

  // Bulk purge confirmation
  const handleConfirmBulkPurge = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (bulkPurgeConfirmText.trim().toUpperCase() !== 'DELETE') {
      setBulkPurgeError('Please type "DELETE" exactly to confirm permanent purge.');
      return;
    }

    setBulkPurging(true);
    setBulkPurgeError(null);
    try {
      const count = await bulkPermanentlyDeleteProjects(ids);
      setSelectedIds(new Set());
      setBulkPurgeModalOpen(false);
      setBulkPurgeConfirmText('');
      setBulkFeedback({
        type: 'success',
        message: `Permanently purged ${count} project${count > 1 ? 's' : ''} from the database.`,
      });
      setTimeout(() => setBulkFeedback(null), 4000);
    } catch (err: any) {
      setBulkPurgeError(err.message || 'Failed to permanently purge projects.');
    } finally {
      setBulkPurging(false);
    }
  };

  // Selected projects list for bulk confirmation
  const selectedProjects = trashedProjects.filter((p) => selectedIds.has(p.id));

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E4E7EC]">
        <ShieldAlert className="w-12 h-12 text-[#DC2626] mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-[#172033]">Access Restricted</h2>
        <p className="text-xs text-[#667085] mt-1">
          The Trash recovery system is strictly restricted to System Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#DC2626]" />
            <span>Trash & Deleted Projects</span>
          </h1>
          <p className="text-xs text-[#667085] font-normal mt-0.5">
            Soft-deleted projects are excluded from dashboards. Select multiple to restore or permanently purge at once.
          </p>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search deleted projects..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-[#172033] placeholder:text-[#98A2B3]"
          />
        </div>
      </div>

      {/* Temporary Feedback Notification */}
      {bulkFeedback && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-medium animate-in fade-in duration-200 ${
            bulkFeedback.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
          }`}
        >
          <div className="flex items-center gap-2">
            {bulkFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>{bulkFeedback.message}</span>
          </div>
          <button
            onClick={() => setBulkFeedback(null)}
            className="text-[#667085] hover:text-[#172033] p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating / Sticky Bulk Action Bar for Trash */}
      {selectedIds.size > 0 && (
        <div className="bg-[#172B4D] text-white rounded-xl p-3 sm:p-3.5 shadow-lg border border-[#20365B] flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-[#2563EB] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-xs">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectedIds.size}</span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white">
              {selectedIds.size === 1 ? '1 item selected' : `${selectedIds.size} items selected in Trash`}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] text-[#94A3B8] hover:text-white underline cursor-pointer ml-1"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Restore Button */}
            <button
              onClick={handleBulkRestore}
              disabled={bulkRestoring}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#16A34A] hover:bg-green-700 text-white text-xs font-medium rounded-lg shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {bulkRestoring ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Restoring...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Selected ({selectedIds.size})</span>
                </>
              )}
            </button>

            {/* Bulk Permanent Purge Button */}
            <button
              onClick={() => {
                setBulkPurgeConfirmText('');
                setBulkPurgeError(null);
                setBulkPurgeModalOpen(true);
              }}
              disabled={bulkRestoring}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white text-xs font-medium rounded-lg shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-200" />
              <span>Purge Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Trashed Items Table */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#172B4D] font-bold uppercase tracking-wider text-[11px] sm:text-xs select-none">
                {/* Checkbox column */}
                <th className="py-2 px-2.5 w-9 text-center">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    title={isAllSelected ? 'Deselect all' : 'Select all'}
                    className="w-3.5 h-3.5 rounded text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                  />
                </th>
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Company</th>
                <th className="py-2 px-3">Reference</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Delivery</th>
                <th className="py-2 px-3">Due Date</th>
                <th className="py-2 px-3">Deleted At</th>
                <th className="py-2 px-3 text-right">Individual Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC] text-[#172033]">
              {filteredTrashed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[#475467]">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#059669]" />
                    <p className="text-sm font-semibold text-[#172033]">Trash is empty</p>
                    <p className="text-xs text-[#667085] mt-0.5">
                      No soft-deleted projects found matching your query.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTrashed.map((project) => {
                  const isSelected = selectedIds.has(project.id);

                  return (
                    <tr
                      key={project.id}
                      onClick={() => onViewProject(project)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#EFF6FF]/70 hover:bg-[#EFF6FF] border-l-4 border-l-[#2563EB]'
                          : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-2 px-2.5 w-9 text-center"
                        onClick={(e) => toggleSelect(project.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            // Handled by parent td onClick
                          }}
                          className="w-3.5 h-3.5 rounded text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                        />
                      </td>

                      <td className="py-2 px-3 font-mono font-bold text-xs sm:text-[13px] text-[#667085] line-through tabular-nums">
                        {project.projectCode}
                      </td>
                      <td className="py-2 px-3 font-bold text-xs sm:text-[13.5px] text-[#172033] tracking-tight">{project.company}</td>
                      <td className="py-2 px-3 text-xs sm:text-[13px] text-[#344054] font-medium">{project.projectReference}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F4F7] font-semibold text-[11px] text-[#344054] border border-[#E4E7EC]">
                          {project.scaffoldingType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#344054] font-mono text-xs sm:text-[12.5px] font-medium tabular-nums">
                        {formatDateDDMMYYYY(project.deliveryDate)}
                      </td>
                      <td className="py-2 px-3 text-[#344054] font-mono text-xs sm:text-[12.5px] font-medium tabular-nums">
                        {formatDateDDMMYYYY(project.dueDate)}
                      </td>
                      <td className="py-2 px-3 text-[#475467] whitespace-nowrap font-mono text-xs tabular-nums">
                        {formatDateTimeDDMMYYYY(project.deletedAt)}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Restore Button */}
                          <button
                            onClick={(e) => handleRestore(project, e)}
                            disabled={restoringId === project.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ECFDF5] text-[#059669] hover:bg-[#DCFCE7] border border-[#A7F3D0] rounded-md text-xs font-semibold transition cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-[#059669]" />
                            <span>{restoringId === project.id ? 'Restoring...' : 'Restore'}</span>
                          </button>

                          {/* Permanent Delete */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToPurge(project);
                              setPurgeConfirmText('');
                              setPurgeError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-md text-xs font-semibold transition cursor-pointer shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#B91C1C]" />
                            <span>Purge</span>
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

      {/* Single Project Purge Confirmation Modal */}
      {projectToPurge && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-[#DC2626]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                <h3 className="font-semibold text-[#172033] text-base">Permanent Deletion Confirmation</h3>
              </div>
              <button
                onClick={() => setProjectToPurge(null)}
                className="text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#475467] leading-relaxed font-normal">
              You are about to <strong className="text-[#DC2626] font-semibold">PERMANENTLY PURGE</strong> project{' '}
              <strong className="font-mono text-[#172033] font-semibold">{projectToPurge.projectCode}</strong> ({projectToPurge.company}) from Cloud Firestore.
              This action <strong className="text-[#DC2626] underline">CANNOT</strong> be undone.
            </p>

            {purgeError && (
              <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs rounded-lg font-medium">
                {purgeError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Type <span className="font-mono font-bold text-[#DC2626]">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] text-xs font-mono font-medium text-[#172033]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
              <button
                type="button"
                onClick={() => setProjectToPurge(null)}
                className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={purging || purgeConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{purging ? 'Purging...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Purge Confirmation Modal */}
      {bulkPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-[#DC2626]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#FEF2F2] rounded-xl border border-[#FECACA]">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3 className="font-semibold text-[#172033] text-base">
                  Purge {selectedIds.size} Projects Permanently
                </h3>
              </div>
              <button
                onClick={() => setBulkPurgeModalOpen(false)}
                className="text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#475467] leading-relaxed font-normal">
              You are about to <strong className="text-[#DC2626] font-semibold">PERMANENTLY PURGE</strong> {selectedIds.size} projects from Cloud Firestore.
              All associated project records, timelines, and contract data will be deleted forever.
              <span className="block text-[#DC2626] font-medium mt-1">This action cannot be undone.</span>
            </p>

            {/* Selected Projects List Preview */}
            <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl p-3 max-h-36 overflow-y-auto space-y-1 text-xs">
              <div className="font-semibold text-[#475467] text-[11px] uppercase tracking-wider mb-1">
                Projects to be purged:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedProjects.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-[#D0D5DD] text-[#172033] font-mono text-[11px]"
                  >
                    {p.projectCode} <span className="text-[#667085] font-sans ml-1 text-[10px]">({p.company})</span>
                  </span>
                ))}
              </div>
            </div>

            {bulkPurgeError && (
              <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs rounded-lg font-medium">
                {bulkPurgeError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Type <span className="font-mono font-bold text-[#DC2626]">DELETE</span> to confirm bulk purge:
              </label>
              <input
                type="text"
                value={bulkPurgeConfirmText}
                onChange={(e) => setBulkPurgeConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] text-xs font-mono font-medium text-[#172033]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
              <button
                type="button"
                onClick={() => setBulkPurgeModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkPurge}
                disabled={bulkPurging || bulkPurgeConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {bulkPurging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Purging {selectedIds.size} Projects...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Purge {selectedIds.size} Projects Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
