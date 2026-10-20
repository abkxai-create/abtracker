import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import {
  formatDateDDMMYYYY,
  getDueStatus,
  calculateDiffDays,
} from '../business/dateRules';
import {
  formatAED,
  calculateProjectFinancials,
} from '../utils/commercialUtils';
import { SalespersonProjectDetailsModal } from './SalespersonProjectDetailsModal';
import {
  ShieldCheck,
  LogOut,
  Building2,
  Calendar,
  Layers,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Briefcase,
  AlertCircle,
  Phone,
  Filter,
  ArrowUpDown,
  User,
  Shield,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export type SalespersonFilterToggle =
  | 'ALL'
  | 'ACTIVE'
  | 'EXTENDED'
  | 'OVERDUE'
  | 'PAYMENT_PENDING'
  | 'DUE_SOON'
  | 'CLOSED';

export const SalespersonPortalView: React.FC = () => {
  const {
    userProfile,
    logout,
    previewSalespersonId,
    previewSalespersonName,
    setPreviewSalesperson,
    isAdminRole,
  } = useAuth();

  const { projects, loading: projectsLoading } = useProjects();

  // Active filter toggle
  const [activeToggle, setActiveToggle] = useState<SalespersonFilterToggle>('ALL');

  // Search input: strictly searches the salesperson's projects
  const [searchQuery, setSearchQuery] = useState('');

  // Selected project for details modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'dueDate' | 'contractValue' | 'projectCode'>('dueDate');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Salesperson's own projects
  // Invariant: projects in ProjectContext are already strictly scoped to this salesperson
  const myProjects = useMemo(() => {
    return projects;
  }, [projects]);

  // Top KPI calculations calculated ONLY from that salesperson's projects
  const kpis = useMemo(() => {
    let totalContractValue = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let activeCount = 0;
    let extendedCount = 0;
    let closedCount = 0;
    let overdueCount = 0;
    let paymentPendingCount = 0;
    let dueSoonCount = 0;

    for (const p of myProjects) {
      const fin = calculateProjectFinancials(p);
      totalContractValue += fin.totalContractValue;
      totalReceived += fin.totalReceived;
      totalPending += fin.totalOutstanding;

      const isClosed = p.projectStatus === 'CLOSED' || p.projectStatus === 'RETURNED';

      if (p.projectStatus === 'ACTIVE') {
        activeCount++;
      } else if (p.projectStatus === 'EXTENDED' || (p.extensionDays && p.extensionDays > 0)) {
        extendedCount++;
      }

      if (isClosed) {
        closedCount++;
      }

      const diffDays = calculateDiffDays(p.dueDate);
      if (!isClosed) {
        if (diffDays < 0) {
          overdueCount++;
        } else if (diffDays <= 7) {
          dueSoonCount++;
        }
      }

      if (p.paymentStatus === 'NOT_PAID' || p.paymentStatus === 'PARTIAL_PAID' || fin.totalOutstanding > 0) {
        paymentPendingCount++;
      }
    }

    return {
      totalProjects: myProjects.length,
      totalContractValue,
      totalReceived,
      totalPending,
      activeCount,
      extendedCount,
      closedCount,
      overdueCount,
      paymentPendingCount,
      dueSoonCount,
    };
  }, [myProjects]);

  // Filtered projects based on active toggle and search query
  const filteredProjects = useMemo(() => {
    let result = myProjects;

    // Apply Attention / Action toggle
    if (activeToggle === 'ACTIVE') {
      result = result.filter((p) => p.projectStatus === 'ACTIVE');
    } else if (activeToggle === 'EXTENDED') {
      result = result.filter(
        (p) => p.projectStatus === 'EXTENDED' || (p.extensionDays && p.extensionDays > 0)
      );
    } else if (activeToggle === 'OVERDUE') {
      result = result.filter((p) => {
        const isClosed = p.projectStatus === 'CLOSED' || p.projectStatus === 'RETURNED';
        return !isClosed && calculateDiffDays(p.dueDate) < 0;
      });
    } else if (activeToggle === 'PAYMENT_PENDING') {
      result = result.filter((p) => {
        const fin = calculateProjectFinancials(p);
        return (
          p.paymentStatus === 'NOT_PAID' ||
          p.paymentStatus === 'PARTIAL_PAID' ||
          fin.totalOutstanding > 0
        );
      });
    } else if (activeToggle === 'DUE_SOON') {
      result = result.filter((p) => {
        const isClosed = p.projectStatus === 'CLOSED' || p.projectStatus === 'RETURNED';
        const diff = calculateDiffDays(p.dueDate);
        return !isClosed && diff >= 0 && diff <= 7;
      });
    } else if (activeToggle === 'CLOSED') {
      result = result.filter(
        (p) => p.projectStatus === 'CLOSED' || p.projectStatus === 'RETURNED'
      );
    }

    // Apply Search Query: strictly searches the salesperson's projects
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.projectCode.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          (p.projectReference && p.projectReference.toLowerCase().includes(q)) ||
          (p.mobile && p.mobile.includes(q)) ||
          (p.remarks && p.remarks.toLowerCase().includes(q))
      );
    }

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortField === 'dueDate') {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return sortAsc ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'contractValue') {
        const valA = calculateProjectFinancials(a).totalContractValue;
        const valB = calculateProjectFinancials(b).totalContractValue;
        return sortAsc ? valA - valB : valB - valA;
      }
      if (sortField === 'projectCode') {
        return sortAsc
          ? a.projectCode.localeCompare(b.projectCode)
          : b.projectCode.localeCompare(a.projectCode);
      }
      return 0;
    });

    return result;
  }, [myProjects, activeToggle, searchQuery, sortField, sortAsc]);

  const toggleSort = (field: 'dueDate' | 'contractValue' | 'projectCode') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const displayName = previewSalespersonName || userProfile?.salespersonName || userProfile?.name || 'Salesperson';
  const displaySalespersonId = previewSalespersonId || userProfile?.salespersonId || 'sp_user';

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#172033] flex flex-col font-sans antialiased selection:bg-blue-100">
      {/* Admin Preview Mode Banner (if viewed by Administrator) */}
      {previewSalespersonId && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-amber-600 shadow-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-950" />
            <span>
              Preview Mode: Currently simulating Salesperson Portal for{' '}
              <strong>{displayName}</strong> ({displaySalespersonId}). Only projects assigned to this salesperson are visible.
            </span>
          </div>
          <button
            onClick={() => setPreviewSalesperson(null)}
            className="px-2.5 py-1 bg-slate-950 text-white rounded text-[11px] font-bold hover:bg-slate-850 transition cursor-pointer"
          >
            Exit Preview
          </button>
        </div>
      )}

      {/* Top Header: AB TRACKER & MY DASHBOARD & Logout */}
      <header className="sticky top-0 z-30 bg-[#0F172A] text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Portal Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-black">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                AB TRACKER
              </span>
              <span className="text-slate-600 font-light hidden sm:inline">|</span>
              <span className="text-xs sm:text-sm font-semibold text-blue-400 uppercase tracking-wider hidden sm:inline">
                MY DASHBOARD
              </span>
            </div>
          </div>

          {/* Dedicated Salesperson Search Bar */}
          <div className="flex-1 max-w-md mx-2 sm:mx-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search my projects (code, company, reference)..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5 bg-slate-800/70 py-1.5 px-3 rounded-lg border border-slate-700/60">
              <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center text-xs font-bold">
                {displayName.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-slate-100 leading-none">
                  {displayName}
                </div>
                <div className="text-[10px] text-blue-400 font-mono mt-0.5 leading-none">
                  SALESPERSON
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Logout from AB TRACKER"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition border border-transparent hover:border-slate-700 cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              My Assigned Projects
            </h1>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Live commercial tracking, overdue monitoring, and hire period extensions for{' '}
              <strong className="text-slate-800">{displayName}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold">
              Restricted Sales View
            </span>
          </div>
        </div>

        {/* 1. TOP 4 KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL PROJECTS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:border-blue-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">My Projects</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.totalProjects}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Projects assigned to {displayName}
            </p>
          </div>

          {/* Card 2: TOTAL CONTRACT VALUE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:border-blue-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Contract Value</span>
              <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatAED(kpis.totalContractValue)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Total active LPO / contract value
            </p>
          </div>

          {/* Card 3: TOTAL RECEIVED */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:border-emerald-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Received</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
              {formatAED(kpis.totalReceived)}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">
              Cleared collections to date
            </p>
          </div>

          {/* Card 4: TOTAL PENDING */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:border-rose-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Pending</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                kpis.totalPending > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatAED(kpis.totalPending)}
            </div>
            <p className="text-[11px] text-rose-600 font-medium">
              Outstanding receivable balance
            </p>
          </div>
        </div>

        {/* 2. SECONDARY STATUS COUNTERS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div
            onClick={() => setActiveToggle('ACTIVE')}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeToggle === 'ACTIVE'
                ? 'bg-blue-50/70 border-blue-400'
                : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Active
              </span>
              <span className="text-lg font-bold text-slate-900">{kpis.activeCount}</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>

          <div
            onClick={() => setActiveToggle('EXTENDED')}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeToggle === 'EXTENDED'
                ? 'bg-amber-50/70 border-amber-400'
                : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                Extended
              </span>
              <span className="text-lg font-bold text-amber-900">{kpis.extendedCount}</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>

          <div
            onClick={() => setActiveToggle('CLOSED')}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeToggle === 'CLOSED'
                ? 'bg-slate-100 border-slate-400'
                : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Closed
              </span>
              <span className="text-lg font-bold text-slate-800">{kpis.closedCount}</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          </div>

          <div
            onClick={() => setActiveToggle('OVERDUE')}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeToggle === 'OVERDUE'
                ? 'bg-rose-50/70 border-rose-400'
                : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
                Overdue
              </span>
              <span className="text-lg font-bold text-rose-800">{kpis.overdueCount}</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
        </div>

        {/* 3. ATTENTION / ACTION AREA TOGGLES */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Action Area — Filter by Attention Status
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-normal">
              Showing {filteredProjects.length} of {myProjects.length} projects
            </span>
          </div>

          {/* Toggle Buttons Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setActiveToggle('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>ALL</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {myProjects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveToggle('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'ACTIVE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              <span>ACTIVE</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'ACTIVE' ? 'bg-blue-700 text-blue-100' : 'bg-blue-200/80 text-blue-900'
                }`}
              >
                {kpis.activeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveToggle('EXTENDED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'EXTENDED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <span>EXTENDED</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'EXTENDED' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200/80 text-amber-900'
                }`}
              >
                {kpis.extendedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveToggle('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>OVERDUE</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'OVERDUE' ? 'bg-rose-700 text-rose-100' : 'bg-rose-200/80 text-rose-900'
                }`}
              >
                {kpis.overdueCount}
              </span>
            </button>

            <button
              onClick={() => setActiveToggle('PAYMENT_PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'PAYMENT_PENDING'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200/60'
              }`}
            >
              <span>PAYMENT PENDING</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'PAYMENT_PENDING'
                    ? 'bg-violet-700 text-violet-100'
                    : 'bg-violet-200/80 text-violet-900'
                }`}
              >
                {kpis.paymentPendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveToggle('DUE_SOON')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'DUE_SOON'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/60'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>DUE SOON</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'DUE_SOON' ? 'bg-teal-700 text-teal-100' : 'bg-teal-200/80 text-teal-900'
                }`}
              >
                {kpis.dueSoonCount}
              </span>
            </button>

            <button
              onClick={() => setActiveToggle('CLOSED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeToggle === 'CLOSED'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>CLOSED</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeToggle === 'CLOSED' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {kpis.closedCount}
              </span>
            </button>
          </div>
        </div>

        {/* 4. MY PROJECTS TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                My Projects Table
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Click <strong>VIEW</strong> on any row to open complete details, payments, and follow-up timeline.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Sort by:</span>
              <button
                onClick={() => toggleSort('dueDate')}
                className={`px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1 ${
                  sortField === 'dueDate'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Due Date {sortField === 'dueDate' && (sortAsc ? '↑' : '↓')}
              </button>
              <button
                onClick={() => toggleSort('contractValue')}
                className={`px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1 ${
                  sortField === 'contractValue'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Value {sortField === 'contractValue' && (sortAsc ? '↑' : '↓')}
              </button>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="py-16 text-center text-slate-500 bg-white">
              <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No Projects Found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No projects matched "${searchQuery}" under this filter.`
                  : activeToggle !== 'ALL'
                  ? `No projects found in the ${activeToggle.replace('_', ' ')} status.`
                  : 'You do not have any projects assigned currently.'}
              </p>
              {(searchQuery || activeToggle !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveToggle('ALL');
                  }}
                  className="mt-4 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">PROJECT</th>
                    <th className="py-3 px-4">COMPANY</th>
                    <th className="py-3 px-4">REFERENCE</th>
                    <th className="py-3 px-4 text-right">CONTRACT VALUE</th>
                    <th className="py-3 px-4 text-right">RECEIVED</th>
                    <th className="py-3 px-4 text-right">PENDING</th>
                    <th className="py-3 px-4">DUE DATE</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                    <th className="py-3 px-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProjects.map((p) => {
                    const fin = calculateProjectFinancials(p);
                    const dueStatus = getDueStatus(p.dueDate, p.projectStatus);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProject(p)}
                        className="hover:bg-blue-50/40 transition cursor-pointer group"
                      >
                        {/* 1. PROJECT */}
                        <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 text-xs">
                              {p.projectCode}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                p.scaffoldingType === 'EREC/DISM'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {p.scaffoldingType}
                            </span>
                          </div>
                        </td>

                        {/* 2. COMPANY */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {p.company}
                          </div>
                          {p.mobile && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              {p.mobile}
                            </div>
                          )}
                        </td>

                        {/* 3. REFERENCE */}
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {p.projectReference || '-'}
                        </td>

                        {/* 4. CONTRACT VALUE */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-right tabular-nums whitespace-nowrap">
                          {formatAED(fin.totalContractValue)}
                        </td>

                        {/* 5. RECEIVED */}
                        <td className="py-3.5 px-4 font-bold text-emerald-700 text-right tabular-nums whitespace-nowrap">
                          {formatAED(fin.totalReceived)}
                        </td>

                        {/* 6. PENDING */}
                        <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              fin.totalOutstanding > 0 ? 'text-rose-700' : 'text-slate-700'
                            }`}
                          >
                            {formatAED(fin.totalOutstanding)}
                          </span>
                        </td>

                        {/* 7. DUE DATE */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900 text-xs">
                            {formatDateDDMMYYYY(p.dueDate)}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold mt-0.5 ${dueStatus.badgeColorClass}`}
                          >
                            {dueStatus.label}
                          </span>
                        </td>

                        {/* 8. STATUS */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.projectStatus === 'ACTIVE'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : p.projectStatus === 'EXTENDED'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              {p.projectStatus}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                p.paymentStatus === 'PAID'
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : p.paymentStatus === 'PARTIAL_PAID'
                                  ? 'text-amber-700 bg-amber-50'
                                  : 'text-rose-700 bg-rose-50'
                              }`}
                            >
                              {p.paymentStatus.replace('_', ' ')}
                            </span>
                          </div>
                        </td>

                        {/* 9. ACTION */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedProject(p)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>VIEW</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Project Details Modal */}
      {selectedProject && (
        <SalespersonProjectDetailsModal
          project={selectedProject}
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
};
