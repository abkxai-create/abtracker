import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { NavigationTab, Project } from '../types';
import { UniversalSearch } from './UniversalSearch';
import {
  Menu,
  Plus,
  Download,
  PanelLeft,
  PanelLeftClose,
  LayoutDashboard,
  FolderKanban,
  UserCheck,
  DollarSign,
  Archive,
  CreditCard,
  Activity,
  Trash2,
  Users,
  Building,
  ShieldCheck,
  LogOut,
  Eye,
  EyeOff,
} from 'lucide-react';

interface NavbarProps {
  currentTab: NavigationTab;
  onOpenMobileSidebar: () => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onSelectProject: (project: Project) => void;
  onSelectCompany?: (companyName: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenAddModal,
  onOpenImportModal,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  onSelectProject,
  onSelectCompany,
}) => {
  const {
    currentUser,
    userProfile,
    logout,
    previewSalespersonId,
    previewSalespersonName,
    setPreviewSalesperson,
  } = useAuth();
  const { projects, trashedProjects, companies } = useProjects();
  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isAdmin = isRootAdmin || (userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED');

  const isSalesperson = userProfile?.role === 'SALESPERSON';

  // Active Tab configuration for Hubs
  const getTabConfig = (tab: NavigationTab) => {
    if (isSalesperson) {
      return {
        title: 'Sales Dashboard',
        subtitle: 'Assigned contracts, LPO balances & collection follow-ups',
        icon: FolderKanban,
        counter: projects.length,
        counterLabel: 'Projects',
      };
    }

    switch (tab) {
      case 'dashboard':
      case 'projects':
      case 'all_projects':
      case 'returned':
      case 'returned_projects':
        return {
          title: 'Projects Hub',
          subtitle: 'Scaffold rentals, active sites & equipment fleet',
          icon: FolderKanban,
          counter: projects.length,
          counterLabel: 'Projects',
        };
      case 'collections':
      case 'payments_collections':
      case 'payment_followup':
        return {
          title: 'Collections Hub',
          subtitle: 'Receivables ledger, schedules & payment follow-ups',
          icon: DollarSign,
        };
      case 'companies':
        return {
          title: 'Companies Hub',
          subtitle: 'Client portfolio, running projects, commercial contracts & ledger',
          icon: Building,
          counter: companies.length,
          counterLabel: 'Companies',
        };
      case 'sales_customers':
      case 'administration':
      case 'recent_activity':
      case 'trash':
      case 'users':
      case 'settings':
        return {
          title: 'Settings & CRM',
          subtitle: 'Client companies, sales engineers, user permissions & audit logs',
          icon: ShieldCheck,
          counter: trashedProjects.length > 0 ? trashedProjects.length : undefined,
          counterLabel: 'Trash',
        };
      default:
        return {
          title: 'Projects Hub',
          subtitle: 'Scaffold Rental System',
          icon: FolderKanban,
        };
    }
  };

  const currentConfig = getTabConfig(currentTab);
  const TabIcon = currentConfig.icon;

  // Generate clean initials for user avatar
  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'AB';
  };

  const initials = getInitials(userProfile?.name, userProfile?.email);
  const displayName = userProfile?.name || userProfile?.email?.split('@')[0] || 'User';

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] transition-all">
      {/* Left: Sidebar Toggle & Dominant Tab Title */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile Toggle Button */}
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-[#475467] hover:text-[#172033] hover:bg-[#F2F4F7] rounded-lg md:hidden cursor-pointer transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Collapse Toggle Button */}
        <button
          onClick={onToggleSidebarCollapse}
          title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          className="hidden md:flex items-center justify-center w-8 h-8 text-[#475467] hover:text-[#172033] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg transition-all cursor-pointer shadow-2xs hover:border-[#CBD5E1]"
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="w-4 h-4 text-[#2563EB]" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-[#475467]" />
          )}
        </button>

        {/* Vertical Hairline Divider */}
        <div className="h-6 w-px bg-[#E2E8F0] hidden md:block" />

        {/* Active Module Icon Badge & Hierarchy */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shadow-2xs shrink-0">
            <TabIcon className="w-4.5 h-4.5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight leading-none truncate">
                {currentConfig.title}
              </h1>
              {currentConfig.counter !== undefined && (
                <span className="hidden sm:inline-flex px-1.5 py-0.5 bg-[#F1F5F9] text-[#475467] border border-[#E2E8F0] rounded text-[11px] font-mono font-bold leading-none">
                  {currentConfig.counter}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium mt-1 leading-none truncate">
              <span className="truncate">{currentConfig.subtitle}</span>
              <span className="text-[#CBD5E1] hidden sm:inline">•</span>
              <span className="text-[#94A3B8] font-bold text-[10px] uppercase tracking-wider hidden sm:inline">
                AB TRACKER
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Global Universal Search (Available across all screens) */}
      <div className="flex-1 max-w-md lg:max-w-xl mx-2 sm:mx-4 hidden sm:flex justify-center min-w-0">
        <UniversalSearch
          onSelectProject={onSelectProject}
          onSelectCompany={onSelectCompany}
        />
      </div>

      {/* Right: Strong Primary Action & Authoritative User Identity */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {isAdmin && (
          <>
            {(currentTab === 'projects' || currentTab === 'all_projects') && (
              <button
                onClick={onOpenImportModal}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#344054] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#D0D5DD] hover:border-[#98A2B3] rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Import Projects from Excel or CSV"
              >
                <Download className="w-3.5 h-3.5 rotate-180 text-[#667085]" />
                <span>Import Data</span>
              </button>
            )}

            {/* Prominent, Bold Primary Button */}
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer active:scale-95 group"
            >
              <Plus className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-200" />
              <span>New Project</span>
            </button>
          </>
        )}

        {/* Admin Preview Mode Indicator */}
        {isAdmin && previewSalespersonId && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold shadow-2xs animate-pulse">
            <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">Preview:</span>
            <span className="truncate max-w-[120px]">{previewSalespersonName || 'Salesperson'}</span>
            <button
              onClick={() => setPreviewSalesperson(null)}
              title="Exit Preview (View All Projects)"
              className="ml-1 p-0.5 hover:bg-amber-200 text-amber-800 rounded transition cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hairline Divider */}
        <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block" />

        {/* Corporate User Profile Badge */}
        <div className="flex items-center gap-2 pl-0.5">
          {userProfile?.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover ring-1 ring-[#2563EB]/30 shrink-0 shadow-2xs"
            />
          ) : (
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-2xs shrink-0 select-none ${
                isAdmin
                  ? 'bg-gradient-to-br from-[#172B4D] to-[#0F1D38] text-white border border-[#20365B] ring-2 ring-slate-100'
                  : 'bg-[#2563EB] text-white'
              }`}
              title={`${displayName} (${userProfile?.role || 'STAFF'})`}
            >
              {initials}
            </div>
          )}

          <div className="hidden lg:flex flex-col text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#0F172A] truncate max-w-[120px]">
                {displayName}
              </span>
              <span
                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider leading-none ${
                  isAdmin
                    ? 'bg-[#172B4D] text-white'
                    : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                }`}
              >
                {userProfile?.role || 'STAFF'}
              </span>
            </div>
            <span className="text-[10px] text-[#64748B] font-medium truncate max-w-[150px] mt-0.5">
              {userProfile?.email || 'Logged In'}
            </span>
          </div>

          {/* Compact Role Tag for Medium screens */}
          <span
            className={`lg:hidden text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
              isAdmin
                ? 'bg-[#172B4D] text-white'
                : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
            }`}
          >
            {userProfile?.role || 'STAFF'}
          </span>

          {/* Sign Out Button */}
          <button
            onClick={() => logout()}
            title="Sign Out of AB TRACKER"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
