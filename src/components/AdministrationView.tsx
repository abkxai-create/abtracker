import React, { useState } from 'react';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { UsersView } from './UsersView';
import { RecentActivityView } from './RecentActivityView';
import { TrashView } from './TrashView';
import { SalesCustomersView } from './SalesCustomersView';
import {
  ShieldCheck,
  Users,
  Activity,
  Trash2,
  Building,
  UserCheck,
  AlertTriangle,
  Sliders,
} from 'lucide-react';

export type SettingsSubTab = 'companies' | 'salespersons' | 'users' | 'activity' | 'trash';

interface AdministrationViewProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onCopyProject?: (project: Project) => void;
  initialSubTab?: SettingsSubTab;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  onViewProject,
  onEditProject,
  onCopyProject,
  initialSubTab = 'companies',
}) => {
  const { userProfile, pendingUsersCount, currentUser } = useAuth();
  const { trashedProjects, companies, salespersons } = useProjects();
  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isAdmin = isRootAdmin || (userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED');

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(initialSubTab);

  return (
    <div className="space-y-4">
      {/* Settings Navigation Header */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#2563EB]" />
              <span>Settings & CRM Hub</span>
            </h1>
            <p className="text-xs text-[#64748B] font-normal mt-0.5">
              Client directories, sales engineer assignments, user permissions, and recovery audit
            </p>
          </div>
        </div>

        {/* 5 Clean Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E2E8F0] pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSubTab('companies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'companies'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Companies Directory</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'companies' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {companies.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('salespersons')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'salespersons'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Sales Representatives</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'salespersons' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {salespersons.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'users'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Approvals & Access</span>
            {pendingUsersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white">
                {pendingUsersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('activity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'activity'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('trash')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'trash'
                ? 'bg-[#DC2626] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash Bin</span>
            {trashedProjects.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeSubTab === 'trash' ? 'bg-white/20 text-white' : 'bg-[#FEE2E2] text-[#DC2626]'
                }`}
              >
                {trashedProjects.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeSubTab === 'companies' && (
          <SalesCustomersView
            onViewProject={onViewProject}
            onEditProject={onEditProject}
            onCopyProject={onCopyProject}
          />
        )}
        {activeSubTab === 'salespersons' && (
          <SalesCustomersView
            onViewProject={onViewProject}
            onEditProject={onEditProject}
            onCopyProject={onCopyProject}
          />
        )}
        {activeSubTab === 'users' && <UsersView />}
        {activeSubTab === 'activity' && <RecentActivityView />}
        {activeSubTab === 'trash' && <TrashView onViewProject={onViewProject} />}
      </div>
    </div>
  );
};
