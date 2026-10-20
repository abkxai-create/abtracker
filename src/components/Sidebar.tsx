import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { NavigationTab } from '../types';
import {
  LayoutDashboard,
  FolderKanban,
  Archive,
  CreditCard,
  Activity,
  Trash2,
  Users,
  ShieldCheck,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeft,
  UserCheck,
  DollarSign,
  Building,
} from 'lucide-react';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { userProfile, logout, pendingUsersCount, currentUser } = useAuth();
  const { trashedProjects, commercialMetrics, projects, companies } = useProjects();

  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isAdmin = isRootAdmin || (userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED');

  const returnedCount = useMemo(
    () => projects.filter((p) => p.projectStatus === 'RETURNED').length,
    [projects]
  );

  // Helper to map active state across hubs & legacy routes
  const isItemActive = (itemId: NavigationTab, activeTab: NavigationTab) => {
    if (itemId === activeTab) return true;
    if (itemId === 'projects' && (activeTab === 'dashboard' || activeTab === 'all_projects' || activeTab === 'returned' || activeTab === 'returned_projects')) return true;
    if (itemId === 'collections' && (activeTab === 'payments_collections' || activeTab === 'payment_followup')) return true;
    if (itemId === 'companies' && activeTab === 'companies') return true;
    if (itemId === 'administration' && (activeTab === 'settings' || activeTab === 'sales_customers' || activeTab === 'recent_activity' || activeTab === 'trash' || activeTab === 'users')) return true;
    return false;
  };

  const isSalesperson = userProfile?.role === 'SALESPERSON';

  // Primary Navigation Hubs: Single unified dashboard for salespersons, full suite for admins/staff
  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
    badge?: number;
    badgeColor?: string;
  }> = isSalesperson
    ? [
        {
          id: 'projects',
          label: 'My Dashboard',
          icon: FolderKanban,
          badge: projects.length > 0 ? projects.length : undefined,
          badgeColor: 'bg-[#2563EB]/40 text-blue-100',
        },
      ]
    : [
        {
          id: 'projects',
          label: 'Projects',
          icon: FolderKanban,
          badge: projects.length > 0 ? projects.length : undefined,
          badgeColor: 'bg-[#2563EB]/40 text-blue-100',
        },
        {
          id: 'collections',
          label: 'Collections',
          icon: DollarSign,
          badge: commercialMetrics.attentionCount > 0 ? commercialMetrics.attentionCount : undefined,
          badgeColor: 'bg-[#DC2626] text-white',
        },
        {
          id: 'companies',
          label: 'Companies',
          icon: Building,
          badge: companies.length > 0 ? companies.length : undefined,
          badgeColor: 'bg-[#2563EB]/40 text-blue-100',
        },
        {
          id: 'administration',
          label: 'Settings & CRM',
          icon: ShieldCheck,
          adminOnly: true,
          badge: pendingUsersCount > 0 ? pendingUsersCount : (trashedProjects.length > 0 ? trashedProjects.length : undefined),
          badgeColor: 'bg-rose-500 text-white',
        },
      ];

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpenMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-[#0B1526]/60 backdrop-blur-xs md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Deep Navy Corporate Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#172B4D] border-r border-[#20365B] flex flex-col transition-[width,transform] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 w-60 shadow-2xl' : '-translate-x-full'
        } ${isCollapsed ? 'md:w-16' : 'md:w-60'}`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3 border-b border-[#20365B] bg-[#13233F] flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo Icon with Professional Blue */}
            <div className="relative w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shrink-0 shadow-xs transition-transform duration-150 hover:scale-105">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#DC2626] ring-2 ring-[#172B4D]" />
            </div>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="min-w-0"
                >
                  <span className="font-semibold text-xs text-white tracking-tight block truncate">
                    AB TRACKER
                  </span>
                  <span className="text-[10px] text-[#8993A4] font-medium tracking-wide block truncate">
                    Scaffold Logistics
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              className="hidden md:flex p-1.5 text-[#8993A4] hover:text-white hover:bg-[#1F365D] rounded-lg transition-colors cursor-pointer"
            >
              {isCollapsed ? (
                <PanelLeft className="w-4 h-4 text-[#3B82F6]" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-[#8993A4]" />
              )}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-[#8993A4] hover:text-white rounded-lg md:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;

            const Icon = item.icon;
            const isActive = isItemActive(item.id, currentTab);

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full group relative flex items-center rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ${
                  isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1F365D]/60'
                }`}
              >
                {/* Sliding active indicator using layoutId */}
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 rounded-lg bg-[#2563EB] shadow-xs"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}

                <div className={`relative z-10 flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <Icon
                      className={`w-4 h-4 transition-transform duration-150 group-hover:scale-105 ${
                        isActive ? 'text-white' : 'text-[#8993A4] group-hover:text-white'
                      }`}
                    />
                  </div>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="truncate tracking-normal text-left"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Badge / Counts */}
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="relative z-10 shrink-0">
                    {!isCollapsed ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors duration-150 ${
                          isActive
                            ? 'bg-white text-[#2563EB]'
                            : 'bg-[#DC2626] text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626] ring-2 ring-[#172B4D]" />
                    )}
                  </div>
                )}

                {/* Hover Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="fixed left-16 ml-2 px-2.5 py-1 bg-[#172033] text-white text-[11px] font-medium rounded-md shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap border border-[#20365B]">
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && ` (${item.badge})`}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Logout Footer */}
        <div className="p-2 border-t border-[#20365B] bg-[#13233F] overflow-hidden">
          <div
            className={`flex items-center rounded-lg p-1.5 transition-colors ${
              isCollapsed ? 'justify-center' : 'justify-between gap-2'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.name}
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-[#3B82F6]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white font-medium flex items-center justify-center text-[11px] shrink-0">
                  {userProfile?.name ? userProfile.name[0].toUpperCase() : 'U'}
                </div>
              )}

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="min-w-0 text-left"
                  >
                    <span className="text-xs font-semibold text-white block truncate">
                      {userProfile?.name}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-medium uppercase tracking-wider ${
                          isAdmin
                            ? 'bg-[#3B1D25] text-[#FCA5A5] border border-[#7F1D1D]/60'
                            : 'bg-[#1F365D] text-[#BFDBFE] border border-[#2B4C80]'
                        }`}
                      >
                        {userProfile?.role}
                      </span>
                      {userProfile?.role === 'SALESPERSON' && userProfile?.salespersonName && (
                        <span
                          className="text-[9px] text-[#93C5FD] truncate max-w-[80px]"
                          title={`Assigned to ${userProfile.salespersonName}`}
                        >
                          ({userProfile.salespersonName})
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-[#8993A4] hover:text-[#DC2626] hover:bg-[#1F365D] rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
