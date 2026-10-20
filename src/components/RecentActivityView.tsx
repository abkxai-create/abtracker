import React, { useState, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import { ActivityAction } from '../types';
import {
  Activity,
  Search,
  Filter,
  ArrowRight,
  Clock,
  User,
  Shield,
  Layers,
} from 'lucide-react';

export const RecentActivityView: React.FC = () => {
  const { projectActivities } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const filteredActivities = useMemo(() => {
    return projectActivities.filter((item) => {
      if (actionFilter !== 'ALL' && item.action !== actionFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          item.projectCode?.toLowerCase().includes(term) ||
          item.userName?.toLowerCase().includes(term) ||
          item.details?.toLowerCase().includes(term) ||
          item.action?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [projectActivities, actionFilter, searchTerm]);

  const getActionBadge = (action: ActivityAction) => {
    switch (action) {
      case 'CREATED':
        return 'bg-emerald-50 text-[#16A34A] border-emerald-200 font-semibold';
      case 'UPDATED':
        return 'bg-blue-50 text-[#2563EB] border-blue-200 font-semibold';
      case 'STATUS_CHANGE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold';
      case 'PAYMENT_CHANGE':
        return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
      case 'DUE_DATE_OVERRIDE':
        return 'bg-amber-50 text-[#D97706] border-amber-200 font-semibold';
      case 'SOFT_DELETED':
        return 'bg-rose-50 text-[#DC2626] border-rose-200 font-semibold';
      case 'RESTORED':
        return 'bg-emerald-50 text-[#16A34A] border-emerald-200 font-semibold';
      case 'PERMANENTLY_DELETED':
        return 'bg-red-100 text-[#B42318] border-red-200 font-bold';
      case 'FOLLOW_UP_ADDED':
        return 'bg-sky-50 text-sky-800 border-sky-200 font-semibold';
      case 'COPIED':
        return 'bg-blue-50 text-[#3B82F6] border-blue-200 font-semibold';
      default:
        return 'bg-[#F2F4F7] text-[#475467] border-[#E4E7EC] font-medium';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#2563EB]" />
            <span>Recent Activity & Audit Trail</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] font-normal mt-1">
            Immutable log of all scaffolding project modifications, status changes, and administrative actions.
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
              placeholder="Search user, project, action..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-[#172033] placeholder:text-[#98A2B3]"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-lg text-[#172033] font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATED">CREATED</option>
            <option value="UPDATED">UPDATED</option>
            <option value="STATUS_CHANGE">STATUS_CHANGE</option>
            <option value="PAYMENT_CHANGE">PAYMENT_CHANGE</option>
            <option value="DUE_DATE_OVERRIDE">DUE_DATE_OVERRIDE</option>
            <option value="FOLLOW_UP_ADDED">FOLLOW_UP_ADDED</option>
            <option value="SOFT_DELETED">SOFT_DELETED</option>
            <option value="RESTORED">RESTORED</option>
            <option value="PERMANENTLY_DELETED">PERMANENTLY_DELETED</option>
            <option value="COPIED">COPIED</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[#172033] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date & Time (DD/MM/YYYY)</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Details & Transition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC] text-[#172033]">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#667085]">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-[#98A2B3]" />
                    <p className="text-sm font-medium text-[#172033]">No activity records found</p>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Activities are automatically logged as operations occur.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredActivities.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC] transition">
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-[#667085] font-mono text-[11px] tabular-nums">
                      {formatDateTimeDDMMYYYY(item.createdAt)}
                    </td>

                    {/* User */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-[#172033] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#667085]" />
                        <span>{item.userName}</span>
                      </span>
                    </td>

                    {/* Action Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${getActionBadge(
                          item.action
                        )}`}
                      >
                        {item.action}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[#2563EB] tabular-nums">
                      {item.projectCode || '-'}
                    </td>

                    {/* Details and State Diff */}
                    <td className="py-3 px-4 text-[#172033]">
                      <div className="flex flex-col gap-1">
                        <span>{item.details}</span>
                        {(item.previousValue || item.newValue) && (
                          <div className="flex items-center gap-2 text-[10px] text-[#667085] font-mono">
                            <span className="bg-[#F2F4F7] text-[#475467] px-1.5 py-0.5 rounded border border-[#E4E7EC] font-medium">
                              {item.previousValue || 'none'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-[#98A2B3]" />
                            <span className="bg-blue-50 text-[#2563EB] px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                              {item.newValue || 'none'}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
