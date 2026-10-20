import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { NavigationTab, Project } from './types';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ProjectsView } from './components/ProjectsView';
import { PaymentsCollectionsView } from './components/PaymentsCollectionsView';
import { CompaniesView } from './components/CompaniesView';
import { AdministrationView, SettingsSubTab } from './components/AdministrationView';
import { SalespersonDashboard } from './components/SalespersonDashboard';
import { ProjectDrawer } from './components/ProjectDrawer';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ProjectDetailsModal } from './components/ProjectDetailsModal';
import { CopyProjectModal } from './components/CopyProjectModal';
import { ImportExportModal } from './components/ImportExportModal';
import { toInputDateFormat } from './utils/dateUtils';
import {
  Trash2,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const {
    projects,
    allProjectsEver,
    companies,
    addProject,
    copyProject,
    softDeleteProject,
    addPaymentFollowup,
  } = useProjects();

  // Navigation State (defaults to Projects Hub)
  const [currentTab, setCurrentTab] = useState<NavigationTab>('projects');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Unified Slide-Over Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('create');
  const [drawerProject, setDrawerProject] = useState<Project | null>(null);

  // Create Project Modal (Clean unified window matching edit & detail style)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [prefilledCompany, setPrefilledCompany] = useState<string | null>(null);

  // Full Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsProject, setDetailsProject] = useState<Project | null>(null);
  const [detailsInitialEdit, setDetailsInitialEdit] = useState(false);

  // Copy Project Modal
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceProject, setCopySourceProject] = useState<Project | null>(null);

  // CSV/Excel Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false);

  // In-app toast notification state
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toastNotice) return;
    const timer = setTimeout(() => {
      setToastNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  // Delete confirmation modal state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Quick follow-up modal state from table
  const [quickFollowupProject, setQuickFollowupProject] = useState<Project | null>(null);
  const [quickFollowupNotes, setQuickFollowupNotes] = useState('');
  const [quickFollowupDate, setQuickFollowupDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingQuickFollowup, setSubmittingQuickFollowup] = useState(false);
  const [quickFollowupError, setQuickFollowupError] = useState<string | null>(null);

  // Collapsible sidebar state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ab_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ab_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Keyboard shortcut: Cmd/Ctrl + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isAdmin = isRootAdmin || (userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED');
  const isApproved = isRootAdmin || userProfile?.approvalStatus === 'APPROVED';
  const isSalesperson = userProfile?.role === 'SALESPERSON';

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wider uppercase text-blue-200">
          Loading AB TRACKER...
        </p>
      </div>
    );
  }

  // Not authenticated or pending/disabled approval
  if (!currentUser || !isApproved) {
    return <AuthScreen />;
  }

  // Handler: Add New Project via Unified Modal (same style as Edit & Project Detail)
  const handleOpenAddModal = (companyName?: string) => {
    setPrefilledCompany(companyName || null);
    setCreateModalOpen(true);
  };

  // Handler: Edit Project via Single-Page Overview Modal
  const handleOpenEditModal = (project: Project) => {
    setDetailsProject(project);
    setDetailsInitialEdit(true);
    setDetailsModalOpen(true);
  };

  // Handler: View Project Details
  const handleOpenDetails = (project: Project) => {
    setDetailsProject(project);
    setDetailsInitialEdit(false);
    setDetailsModalOpen(true);
  };

  // Handler: Copy Project
  const handleOpenCopyModal = (project: Project) => {
    setCopySourceProject(project);
    setCopyModalOpen(true);
  };

  // Handler: Soft Delete
  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const code = deletingProject.projectCode;
      await softDeleteProject(deletingProject.id);
      setDeletingProject(null);
      if (drawerProject?.id === deletingProject.id) {
        setDrawerOpen(false);
      }
      if (detailsProject?.id === deletingProject.id) {
        setDetailsModalOpen(false);
      }
      setToastNotice({ type: 'success', message: `Project ${code} moved to Trash.` });
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  // Handler: Quick Followup
  const handleQuickFollowup = (project: Project) => {
    setQuickFollowupProject(project);
    setQuickFollowupNotes('');
    setQuickFollowupDate(new Date().toISOString().split('T')[0]);
    setQuickFollowupError(null);
  };

  const handleSaveQuickFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFollowupProject || !quickFollowupNotes.trim()) return;

    setSubmittingQuickFollowup(true);
    setQuickFollowupError(null);
    try {
      const code = quickFollowupProject.projectCode;
      await addPaymentFollowup(quickFollowupProject.id, quickFollowupNotes.trim(), quickFollowupDate);
      setQuickFollowupProject(null);
      setToastNotice({ type: 'success', message: `Follow-up saved for ${code}.` });
    } catch (err: any) {
      setQuickFollowupError(err.message || 'Failed to save follow-up');
    } finally {
      setSubmittingQuickFollowup(false);
    }
  };

  // Seed Initial Demo Data for brand new databases
  const handleSeedDemoData = async () => {
    if (!isAdmin) return;

    const today = new Date();
    const subtractDays = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return toInputDateFormat(d);
    };

    const demoProjects = [
      {
        company: 'Apex Construction LLC',
        mobile: '052-1234567',
        projectReference: 'Burj View Tower Plot 12',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(45), // 15 days overdue!
        dueDate: subtractDays(15),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'NOT_PAID' as const,
        contractAmount: 18500,
        remarks: 'Cuplok standards, ledgers, and steel hook-on boards.',
      },
      {
        company: 'Emaar Properties PJSC',
        mobile: '050-7654321',
        projectReference: 'Creek Marina Pier B',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 60,
        deliveryDate: subtractDays(90), // 30 days overdue!
        dueDate: subtractDays(30),
        isDueDateOverridden: false,
        projectStatus: 'EXTENDED' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 45000,
        remarks: 'Full facade erection with third-party safety certification.',
      },
      {
        company: 'Arabtec Engineering',
        mobile: '055-3344556',
        projectReference: 'Palm Jumeirah Villa 88',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(29), // 1 day remaining!
        dueDate: subtractDays(-1),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PAID' as const,
        contractAmount: 12000,
        remarks: 'Aluminum mobile towers with castor wheels.',
      },
      {
        company: 'Sobha Realty Group',
        mobile: '054-9988776',
        projectReference: 'Hartland Phase 3',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 45,
        deliveryDate: subtractDays(45), // Due today!
        dueDate: toInputDateFormat(today),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'NOT_PAID' as const,
        contractAmount: 28000,
        remarks: 'Internal shoring scaffolding for high ceiling slab.',
      },
      {
        company: 'Damac Developments',
        mobile: '056-2233445',
        projectReference: 'Lagoon Heights Tower 4',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 90,
        deliveryDate: subtractDays(15), // 75 days remaining!
        dueDate: subtractDays(-75),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PAID' as const,
        contractAmount: 32000,
        remarks: 'External access scaffolding for painting contractor.',
      },
      {
        company: 'Al Naboodah Contracting',
        mobile: '058-6677889',
        projectReference: 'Expo City Pavilion',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(60),
        dueDate: subtractDays(30),
        isDueDateOverridden: false,
        projectStatus: 'RETURNED' as const,
        returnedDate: subtractDays(28),
        paymentStatus: 'PAID' as const,
        contractAmount: 14000,
        remarks: 'All components inspected and returned to central yard.',
      },
    ];

    try {
      for (const p of demoProjects) {
        await addProject(p);
      }
      setToastNotice({
        type: 'success',
        message: 'Successfully seeded demonstration projects showcasing operational & collections statuses.',
      });
    } catch (err: any) {
      setToastNotice({
        type: 'error',
        message: 'Failed to seed demo data: ' + err.message,
      });
    }
  };

  // Helper for initial settings subtab
  const getSettingsSubTab = (): SettingsSubTab => {
    if (currentTab === 'companies' || currentTab === 'sales_customers') return 'companies';
    if (currentTab === 'trash') return 'trash';
    if (currentTab === 'recent_activity') return 'activity';
    if (currentTab === 'users') return 'users';
    return 'companies';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#0F172A] antialiased">
      {/* Primary Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (isSalesperson) {
            setCurrentTab('projects');
            return;
          }
          if (tab === 'companies') {
            setSelectedCompanyId(null);
          }
          setCurrentTab(tab);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarCollapsed ? 'md:pl-16' : 'md:pl-60'
        }`}
      >
        <Navbar
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenAddModal={handleOpenAddModal}
          onOpenImportModal={() => setImportModalOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={toggleSidebarCollapse}
          onSelectProject={handleOpenDetails}
          onSelectCompany={(companyName) => {
            if (isSalesperson) return;
            const comp = companies.find(
              (c) =>
                c.companyName.toLowerCase() === companyName.toLowerCase() ||
                c.id === companyName
            );
            if (comp) {
              setSelectedCompanyId(comp.id);
            }
            setCurrentTab('companies');
          }}
        />

        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto space-y-5">
          {/* Seed demo banner if brand new database */}
          {isAdmin && allProjectsEver.length === 0 && (
            <div className="p-4 bg-[#0F172A] text-white rounded-xl shadow-md border border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Welcome to AB TRACKER</h3>
                  <p className="text-xs text-[#94A3B8] font-normal">
                    Your database is currently empty. Would you like to load demonstration scaffolding records?
                  </p>
                </div>
              </div>
              <button
                onClick={handleSeedDemoData}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs transition whitespace-nowrap cursor-pointer active:scale-95"
              >
                Load Demo Scaffolding Records
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full space-y-5"
            >
              {/* DEDICATED SALESPERSON UNIFIED DASHBOARD */}
              {isSalesperson ? (
                <SalespersonDashboard
                  onViewProject={handleOpenDetails}
                  onEditProject={handleOpenEditModal}
                  onOpenAddModal={handleOpenAddModal}
                />
              ) : (
                <>
                  {/* HUB 1: PROJECTS (Operational fleet, running, due soon, overdue, returned) */}
                  {(currentTab === 'projects' ||
                    currentTab === 'dashboard' ||
                    currentTab === 'all_projects' ||
                    currentTab === 'returned' ||
                    currentTab === 'returned_projects') && (
                    <ProjectsView
                      onViewProject={handleOpenDetails}
                      onEditProject={handleOpenEditModal}
                      onCopyProject={handleOpenCopyModal}
                      onDeleteProject={(p) => setDeletingProject(p)}
                      onAddFollowup={handleQuickFollowup}
                      onOpenAddModal={handleOpenAddModal}
                      onOpenImport={() => setImportModalOpen(true)}
                      initialFilterTab={
                        currentTab === 'returned' || currentTab === 'returned_projects'
                          ? 'RETURNED'
                          : 'ALL'
                      }
                    />
                  )}

                  {/* HUB 2: COLLECTIONS & RECEIVABLES */}
                  {(currentTab === 'collections' ||
                    currentTab === 'payments_collections' ||
                    currentTab === 'payment_followup') && (
                    <PaymentsCollectionsView
                      onViewProject={handleOpenDetails}
                      onEditProject={handleOpenEditModal}
                    />
                  )}

                  {/* HUB 3: COMPANIES & CLIENT ACCOUNTS */}
                  {currentTab === 'companies' && (
                    <CompaniesView
                      onViewProject={handleOpenDetails}
                      onEditProject={handleOpenEditModal}
                      onOpenAddModal={handleOpenAddModal}
                      initialSelectedCompanyId={selectedCompanyId}
                      onClearInitialCompany={() => setSelectedCompanyId(null)}
                    />
                  )}

                  {/* HUB 4: SETTINGS & CRM (Companies CRM, Sales Reps, Users, Audit Trail, Trash) */}
                  {(currentTab === 'administration' ||
                    currentTab === 'settings' ||
                    currentTab === 'sales_customers' ||
                    currentTab === 'trash' ||
                    currentTab === 'users' ||
                    currentTab === 'recent_activity') && (
                    <AdministrationView
                      onViewProject={handleOpenDetails}
                      onEditProject={handleOpenEditModal}
                      onCopyProject={handleOpenCopyModal}
                      initialSubTab={getSettingsSubTab()}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Clean Unified New Project Modal matching Edit & Project Detail Style */}
      <CreateProjectModal
        isOpen={createModalOpen}
        prefilledCompanyName={prefilledCompany || undefined}
        onClose={() => {
          setCreateModalOpen(false);
          setPrefilledCompany(null);
        }}
        onProjectCreated={(newProject) => {
          handleOpenDetails(newProject);
        }}
      />

      {/* Unified Multi-Step Guided Slide-Over Drawer */}
      <ProjectDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        project={drawerProject}
        mode={drawerMode}
        onModeChange={(m) => setDrawerMode(m)}
        onCopyProject={handleOpenCopyModal}
        onDeleteProject={(p) => setDeletingProject(p)}
      />

      {/* Clean Unified Project Details Modal with In-Place Single-Page Edit */}
      <ProjectDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setDetailsProject(null);
          setDetailsInitialEdit(false);
        }}
        project={detailsProject}
        initialEditMode={detailsInitialEdit}
        onCopy={handleOpenCopyModal}
        onDelete={(p) => setDeletingProject(p)}
        onSelectCompany={(companyName) => {
          const comp = companies.find(
            (c) =>
              c.companyName.toLowerCase() === companyName.toLowerCase() ||
              c.id === companyName
          );
          if (comp) {
            setSelectedCompanyId(comp.id);
          }
          setCurrentTab('companies');
        }}
      />

      {/* Copy Project Modal */}
      <CopyProjectModal
        isOpen={copyModalOpen}
        onClose={() => {
          setCopyModalOpen(false);
          setCopySourceProject(null);
        }}
        sourceProject={copySourceProject}
        onConfirmCopy={async (source, overrides) => {
          await copyProject(source, overrides);
          setToastNotice({
            type: 'success',
            message: `Copied project as ${overrides.projectCode || 'new project'}.`,
          });
        }}
      />

      {/* CSV/XLSX Bulk Import Modal */}
      <ImportExportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      {/* Soft Delete Confirmation Dialog */}
      <AnimatePresence>
        {deletingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setDeletingProject(null)}
              className="fixed inset-0 bg-[#0B1526]/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white rounded-2xl shadow-xl border border-[#E2E8F0] max-w-md w-full p-6 space-y-4 z-10"
            >
              <div className="flex items-center justify-between text-[#DC2626]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                  <h3 className="font-semibold text-[#0F172A] text-base">Move Project to Trash</h3>
                </div>
                <button
                  onClick={() => setDeletingProject(null)}
                  className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[#475467] leading-relaxed font-normal">
                Are you sure you want to delete project{' '}
                <strong className="font-mono text-[#0F172A] font-semibold">{deletingProject.projectCode}</strong> (
                {deletingProject.company})?
                <br />
                It will be safely moved to the Trash Bin and can be restored anytime in Settings.
              </p>

              {deleteError && (
                <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded-lg text-xs">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setDeletingProject(null)}
                  className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F1F5F9] text-[#334155] rounded-lg text-xs font-medium transition active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="px-4 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Moving...' : 'Move to Trash'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Follow-Up Modal from Table */}
      <AnimatePresence>
        {quickFollowupProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setQuickFollowupProject(null)}
              className="fixed inset-0 bg-[#0B1526]/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white rounded-2xl shadow-xl border border-[#E2E8F0] max-w-md w-full p-6 space-y-4 z-10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#0F172A] text-base">Record Payment Follow-Up</h3>
                  <p className="text-xs text-[#64748B] font-normal">
                    <span className="font-mono text-[#2563EB] font-medium">{quickFollowupProject.projectCode}</span> — {quickFollowupProject.company}
                  </p>
                </div>
                <button
                  onClick={() => setQuickFollowupProject(null)}
                  className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuickFollowup} className="space-y-4 text-xs">
                {quickFollowupError && (
                  <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded-lg text-xs">
                    {quickFollowupError}
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Follow-Up Date <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={quickFollowupDate}
                    onChange={(e) => setQuickFollowupDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-xs text-[#0F172A] font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Notes & Communication Outcome <span className="text-[#DC2626]">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={quickFollowupNotes}
                    onChange={(e) => setQuickFollowupNotes(e.target.value)}
                    placeholder="e.g. Contacted accounts department. Promised payment transfer by Thursday..."
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-xs leading-relaxed text-[#0F172A] font-normal placeholder:text-[#94A3B8]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setQuickFollowupProject(null)}
                    className="px-3.5 py-1.5 bg-white border border-[#D0D5DD] hover:bg-[#F1F5F9] text-[#334155] rounded-lg font-medium transition active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingQuickFollowup || !quickFollowupNotes.trim()}
                    className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {submittingQuickFollowup ? 'Saving...' : 'Save Follow-Up'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastNotice && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 z-50 pointer-events-auto"
          >
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border ${
                toastNotice.type === 'success'
                  ? 'bg-[#15803D] text-white border-[#166534]'
                  : 'bg-[#DC2626] text-white border-[#B91C1C]'
              }`}
            >
              <span>{toastNotice.message}</span>
              <button
                type="button"
                onClick={() => setToastNotice(null)}
                className="text-white/80 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </AuthProvider>
  );
}
