import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { UserProfile, UserRole, UserApprovalStatus } from '../types';
import { formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertTriangle,
  Search,
  CheckCircle,
  Briefcase,
  Trash2,
  X,
  RefreshCw,
  Clock,
  Info,
  Check,
  Ban,
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const {
    allUsers,
    userProfile,
    currentUser,
    updateUserRole,
    updateUserSalesperson,
    updateUserStatus,
    approveUser,
    rejectUser,
    removeUser,
  } = useAuth();

  const { salespersons } = useProjects();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Per-pending-user role & salesperson selection drafts in the queue
  const [pendingRoleDrafts, setPendingRoleDrafts] = useState<Record<string, UserRole>>({});
  const [pendingSpDrafts, setPendingSpDrafts] = useState<Record<string, string>>({});

  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isAdmin = isRootAdmin || (userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED');

  const pendingUsers = allUsers.filter((u) => u.approvalStatus === 'PENDING');
  const approvedUsers = allUsers.filter((u) => u.approvalStatus === 'APPROVED');

  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && u.approvalStatus !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term) ||
        u.salespersonName?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const handleRoleChange = async (user: UserProfile, newRole: UserRole) => {
    if (user.uid === currentUser?.uid && newRole !== 'ADMIN') {
      const confirmSelf = window.confirm(
        'Warning: You are changing your own role from Administrator. You will lose access to system settings. Do you wish to continue?'
      );
      if (!confirmSelf) return;
    }

    setProcessingUid(user.uid);
    setActionError(null);
    setSuccessMessage(null);
    try {
      await updateUserRole(user.uid, newRole);
      setSuccessMessage(`Updated ${user.name}'s role to ${newRole}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user role');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleSalespersonLinkChange = async (user: UserProfile, selectedSpId: string) => {
    setProcessingUid(user.uid);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const matched = salespersons.find((s) => s.id === selectedSpId);
      const spId = matched ? matched.id : '';
      const spName = matched ? matched.name : '';
      await updateUserSalesperson(user.uid, spId, spName);
      setSuccessMessage(
        matched
          ? `Linked ${user.name} to salesperson profile: ${spName}`
          : `Unlinked salesperson profile from ${user.name}`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to link salesperson');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleApprovePending = async (user: UserProfile) => {
    setProcessingUid(user.uid);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const targetRole: UserRole = pendingRoleDrafts[user.uid] || user.role || 'SALESPERSON';
      const selectedSpId = pendingSpDrafts[user.uid] ?? user.salespersonId ?? '';
      const matchedSp = salespersons.find((s) => s.id === selectedSpId);
      const spId = matchedSp ? matchedSp.id : '';
      const spName = matchedSp ? matchedSp.name : '';

      await approveUser(user.uid, targetRole, spId, spName);
      setSuccessMessage(
        `Successfully approved ${user.name} (${user.email}) with role ${targetRole}${
          spName ? ` linked to ${spName}` : ''
        }`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve user');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleRejectPending = async (user: UserProfile) => {
    setProcessingUid(user.uid);
    setActionError(null);
    setSuccessMessage(null);
    try {
      await rejectUser(user.uid);
      setSuccessMessage(`Rejected access request for ${user.name} (${user.email})`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject user');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleStatusChange = async (user: UserProfile, newStatus: UserApprovalStatus) => {
    setProcessingUid(user.uid);
    setActionError(null);
    setSuccessMessage(null);
    try {
      await updateUserStatus(user.uid, newStatus);
      setSuccessMessage(`Account for ${user.name} status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user status');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removingUser) return;
    setDeleting(true);
    setActionError(null);
    try {
      await removeUser(removingUser.uid);
      setRemovingUser(null);
      setSuccessMessage(`Removed user ${removingUser.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove user account');
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E4E7EC]">
        <AlertTriangle className="w-12 h-12 text-[#DC2626] mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-[#172033]">Access Restricted</h2>
        <p className="text-xs text-[#667085] mt-1">
          User administration and approval workflows are restricted to System Administrators.
        </p>
      </div>
    );
  }

  const totalUsers = allUsers.length;
  const adminCount = allUsers.filter((u) => u.role === 'ADMIN').length;
  const salespersonCount = allUsers.filter((u) => u.role === 'SALESPERSON').length;
  const pendingCount = pendingUsers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight flex items-center gap-2.5">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB]" />
            <span>User Approvals & Access Control</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] font-normal mt-0.5">
            Strict user approval system: only approved users can access the application. Manage roles and linked salespersons.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or role..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-[#172033] placeholder:text-[#98A2B3]"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg text-[#172033] font-medium focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Administrators</option>
            <option value="SALESPERSON">Salespersons</option>
            <option value="STAFF">Staff</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg text-[#172033] font-medium focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Approval ({pendingCount})</option>
            <option value="APPROVED">Active (Approved)</option>
            <option value="DISABLED">Deactivated</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        {/* Pending Approvals Card */}
        <div
          className={`border rounded-xl p-4 shadow-xs flex items-center gap-3.5 transition ${
            pendingCount > 0
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-200'
              : 'bg-white border-[#E4E7EC]'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              pendingCount > 0
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            <Clock className={`w-5 h-5 ${pendingCount > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pending Approvals
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{pendingCount}</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold uppercase">
                  Action Required
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Approved Active
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {approvedUsers.length}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Salesperson Accounts
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {salespersonCount}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Administrators
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {adminCount}
            </div>
          </div>
        </div>
      </div>

      {/* PROMINENT PENDING APPROVALS QUEUE (Shown when pending users are waiting) */}
      {pendingUsers.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-950 flex items-center gap-2">
                  <span>Pending Approval Queue</span>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-xs font-mono font-bold">
                    {pendingUsers.length} waiting
                  </span>
                </h2>
                <p className="text-xs text-amber-800 font-normal">
                  These Google users cannot access AB TRACKER until you approve them and assign their role.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {pendingUsers.map((user) => {
              const currentRoleDraft = pendingRoleDrafts[user.uid] || user.role || 'SALESPERSON';
              const currentSpDraft = pendingSpDrafts[user.uid] ?? user.salespersonId ?? '';
              const isBusy = processingUid === user.uid;

              return (
                <div
                  key={user.uid}
                  className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* User Profile Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-2xs">
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                        <span>{user.name}</span>
                        <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.2 rounded-full font-semibold border border-amber-300">
                          Pending
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">
                        {user.email}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Registered {formatDateTimeDDMMYYYY(user.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Role & Salesperson Link Configuration */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Role Picker */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Assign Role
                      </label>
                      <select
                        value={currentRoleDraft}
                        onChange={(e) =>
                          setPendingRoleDrafts((prev) => ({
                            ...prev,
                            [user.uid]: e.target.value as UserRole,
                          }))
                        }
                        className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-900"
                      >
                        <option value="SALESPERSON">SALESPERSON (Own Projects Only)</option>
                        <option value="ADMIN">ADMIN (Full Access)</option>
                        <option value="STAFF">STAFF (Operational View)</option>
                      </select>
                    </div>

                    {/* Salesperson Picker (if role is SALESPERSON) */}
                    {currentRoleDraft === 'SALESPERSON' && (
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                          Link Salesperson Profile
                        </label>
                        <select
                          value={currentSpDraft}
                          onChange={(e) =>
                            setPendingSpDrafts((prev) => ({
                              ...prev,
                              [user.uid]: e.target.value,
                            }))
                          }
                          className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-900 min-w-[170px]"
                        >
                          <option value="">-- Select Salesperson --</option>
                          {salespersons.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 md:pt-4">
                      <button
                        type="button"
                        onClick={() => handleApprovePending(user)}
                        disabled={isBusy}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Approve Access</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectPending(user)}
                        disabled={isBusy}
                        className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 rounded-lg text-xs font-medium transition cursor-pointer"
                        title="Reject Access"
                      >
                        <X className="w-3.5 h-3.5 inline mr-1" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Policy Guidance Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">
            User Approval Security Policy:
          </p>
          <p className="text-blue-800 leading-relaxed font-normal">
            New Google logins start in <strong className="font-semibold">PENDING</strong> status and are blocked until approved by an Administrator. Once approved as <strong className="font-semibold">SALESPERSON</strong>, they can only view their own assigned projects. Deactivating or rejecting a user immediately revokes access.
          </p>
        </div>
      </div>

      {/* Feedback Messages */}
      {actionError && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* All Users Directory Table */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8FAFC] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Registered Users Directory ({filteredUsers.length})
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            Real-time synchronization active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#475467] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">User & Google Profile</th>
                <th className="py-3 px-4">Google Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Linked Salesperson (CRM)</th>
                <th className="py-3 px-4">Access Status</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC] text-[#172033]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#667085]">
                    <Users className="w-8 h-8 mx-auto mb-2 text-[#98A2B3]" />
                    <p className="text-sm font-medium">No users found matching filter criteria</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.uid === currentUser?.uid;
                  const isBusy = processingUid === user.uid;

                  return (
                    <tr key={user.uid} className="hover:bg-[#F8FAFC] transition">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 font-semibold text-[#172033]">
                        <div className="flex items-center gap-2.5">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                              {user.name ? user.name[0].toUpperCase() : 'U'}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isSelf && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-medium">
                                  You
                                </span>
                              )}
                              {user.isFirstUser && (
                                <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 font-medium">
                                  Root Admin
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Google OAuth
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-[#475467] font-mono text-[11px]">
                        {user.email}
                      </td>

                      {/* Interactive Role Dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          disabled={isBusy}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              : user.role === 'SALESPERSON'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <option value="ADMIN">ADMIN (Full Access)</option>
                          <option value="SALESPERSON">SALESPERSON (Own Projects Only)</option>
                          <option value="STAFF">STAFF (Operational View)</option>
                        </select>
                      </td>

                      {/* Linked Salesperson Selector */}
                      <td className="py-3.5 px-4">
                        {user.role === 'SALESPERSON' ? (
                          <div className="space-y-1">
                            <select
                              value={user.salespersonId || ''}
                              onChange={(e) => handleSalespersonLinkChange(user, e.target.value)}
                              disabled={isBusy}
                              className={`w-full max-w-[200px] text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                user.salespersonId
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="">-- Select Salesperson --</option>
                              {salespersons.map((sp) => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.name}
                                </option>
                              ))}
                            </select>
                            {user.salespersonId ? (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Projects filtered to {user.salespersonName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Please link a salesperson profile</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Not applicable ({user.role})
                          </span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            user.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : user.approvalStatus === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                              : user.approvalStatus === 'DISABLED'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.approvalStatus === 'APPROVED'
                                ? 'bg-emerald-500'
                                : user.approvalStatus === 'PENDING'
                                ? 'bg-amber-600'
                                : user.approvalStatus === 'DISABLED'
                                ? 'bg-slate-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          {user.approvalStatus === 'APPROVED'
                            ? 'Approved'
                            : user.approvalStatus === 'PENDING'
                            ? 'Pending Approval'
                            : user.approvalStatus === 'DISABLED'
                            ? 'Deactivated'
                            : 'Rejected'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-[#667085] font-mono text-[11px] whitespace-nowrap tabular-nums">
                        {formatDateTimeDDMMYYYY(user.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* If Pending: Quick Approve and Reject */}
                          {user.approvalStatus === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprovePending(user)}
                                disabled={isBusy}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition cursor-pointer shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectPending(user)}
                                disabled={isBusy}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 rounded text-[11px] font-medium transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* If Approved: Deactivate Button */}
                          {user.approvalStatus === 'APPROVED' && !isSelf && (
                            <button
                              onClick={() => handleStatusChange(user, 'DISABLED')}
                              disabled={isBusy}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded text-[11px] font-medium transition cursor-pointer"
                            >
                              Deactivate
                            </button>
                          )}

                          {/* If Disabled: Re-Activate */}
                          {user.approvalStatus === 'DISABLED' && (
                            <button
                              onClick={() => handleStatusChange(user, 'APPROVED')}
                              disabled={isBusy}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-[11px] font-semibold transition cursor-pointer"
                            >
                              Re-Activate
                            </button>
                          )}

                          {/* If Rejected: Re-Approve option */}
                          {user.approvalStatus === 'REJECTED' && (
                            <button
                              onClick={() => handleApprovePending(user)}
                              disabled={isBusy}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded text-[11px] font-semibold transition cursor-pointer"
                            >
                              Reconsider & Approve
                            </button>
                          )}

                          {/* Delete Account */}
                          {!isSelf && !user.isFirstUser && (
                            <button
                              onClick={() => setRemovingUser(user)}
                              disabled={isBusy}
                              title={`Remove ${user.name}`}
                              className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
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

      {/* Remove Confirmation Modal */}
      {removingUser && (
        <div className="fixed inset-0 z-50 bg-[#0B1526]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E7EC] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-[#DC2626]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl">
                  <UserX className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3 className="font-semibold text-[#172033] text-base">Remove User Account</h3>
              </div>
              <button
                onClick={() => setRemovingUser(null)}
                className="text-[#667085] hover:text-[#172033] p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#475467] leading-relaxed font-normal">
              Are you sure you want to remove <strong className="text-[#172033] font-semibold">{removingUser.name}</strong> (<span className="font-mono text-[#172033]">{removingUser.email}</span>)?
              <br />
              <span className="text-[#DC2626] mt-2 block font-medium">
                Their access profile will be permanently deleted from AB TRACKER.
              </span>
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E7EC]">
              <button
                type="button"
                onClick={() => setRemovingUser(null)}
                className="px-4 py-2 bg-white border border-[#D0D5DD] hover:bg-[#F2F4F7] text-[#344054] font-medium rounded-lg text-xs sm:text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmRemove}
                className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white font-medium rounded-lg text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Remove</span>
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
