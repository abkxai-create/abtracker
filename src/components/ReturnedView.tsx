import React, { useState, useMemo } from 'react';
import { Project, PaymentStatus, ScaffoldingType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { formatAED } from '../utils/commercialUtils';
import * as XLSX from 'xlsx';
import {
  Archive,
  Search,
  Filter,
  Eye,
  Edit2,
  Copy,
  Trash2,
  FileSpreadsheet,
  X,
  MoreVertical,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Building,
} from 'lucide-react';

interface ReturnedViewProps {
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onCopyProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export const ReturnedView: React.FC<ReturnedViewProps> = ({
  onViewProject,
  onEditProject,
  onCopyProject,
  onDeleteProject,
}) => {
  const { userProfile } = useAuth();
  const { projects, salespersons, loading, getProjectFinancials } = useProjects();
  const isAdmin = userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ScaffoldingType>('ALL');
  const [sortBy, setSortBy] = useState<'returnedDate' | 'code' | 'outstanding'>('returnedDate');

  // Popover action menu
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Authoritative returned projects list (derived from projectStatus === 'RETURNED')
  const returnedProjects = useMemo(() => {
    return projects.filter((p) => p.projectStatus === 'RETURNED');
  }, [projects]);

  // Financial summary for returned projects
  const returnedMetrics = useMemo(() => {
    let totalOutstanding = 0;
    let fullyPaidCount = 0;
    let pendingPaymentCount = 0;

    returnedProjects.forEach((p) => {
      const fin = getProjectFinancials(p.id);
      if (fin.outstandingAmount > 0) {
        totalOutstanding += fin.outstandingAmount;
        pendingPaymentCount++;
      } else {
        fullyPaidCount++;
      }
    });

    return {
      totalCount: returnedProjects.length,
      totalOutstanding,
      fullyPaidCount,
      pendingPaymentCount,
    };
  }, [returnedProjects, getProjectFinancials]);

  // Filtered & sorted returned projects
  const filteredReturned = useMemo(() => {
    let list = returnedProjects.filter((p) => {
      // Payment status filter
      if (paymentFilter !== 'ALL' && p.paymentStatus !== paymentFilter) return false;

      // Salesperson filter
      if (salespersonFilter !== 'ALL' && p.salespersonId !== salespersonFilter) return false;

      // Type filter
      if (typeFilter !== 'ALL' && p.scaffoldingType !== typeFilter) return false;

      // Local search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const codeMatch = p.projectCode?.toLowerCase().includes(term);
        const compMatch = p.company?.toLowerCase().includes(term);
        const refMatch = p.projectReference?.toLowerCase().includes(term);
        const spMatch = p.salespersonName?.toLowerCase().includes(term);
        const remMatch = p.remarks?.toLowerCase().includes(term);
        if (!codeMatch && !compMatch && !refMatch && !spMatch && !remMatch) {
          return false;
        }
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'returnedDate') {
        const dateA = new Date(a.returnedDate || a.dueDate || 0).getTime();
        const dateB = new Date(b.returnedDate || b.dueDate || 0).getTime();
        if (dateB !== dateA) return dateB - dateA; // newest returned first
        return b.projectCode.localeCompare(a.projectCode, undefined, { numeric: true });
      }

      if (sortBy === 'code') {
        return a.projectCode.localeCompare(b.projectCode, undefined, { numeric: true });
      }

      if (sortBy === 'outstanding') {
        const outA = getProjectFinancials(a.id).outstandingAmount;
        const outB = getProjectFinancials(b.id).outstandingAmount;
        return outB - outA;
      }

      return 0;
    });
  }, [returnedProjects, paymentFilter, salespersonFilter, typeFilter, searchTerm, sortBy, getProjectFinancials]);

  const hasActiveFilters =
    searchTerm !== '' || paymentFilter !== 'ALL' || salespersonFilter !== 'ALL' || typeFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setPaymentFilter('ALL');
    setSalespersonFilter('ALL');
    setTypeFilter('ALL');
  };

  const handleExportXLSX = () => {
    const rows = filteredReturned.map((p) => {
      const fin = getProjectFinancials(p.id);
      return {
        'Project Code': p.projectCode,
        Company: p.company,
        Salesperson: p.salespersonName || 'Unassigned',
        Reference: p.projectReference || '',
        Type: p.scaffoldingType,
        'Delivery Date': p.deliveryDate,
        'Returned Date': p.returnedDate || '',
        'Payment Status': p.paymentStatus,
        'Contract Value (AED)': fin.contractAmount,
        'Received (AED)': fin.totalReceived,
        'Outstanding (AED)': fin.outstandingAmount,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returned_Projects');
    XLSX.writeFile(wb, `AB_Tracker_Returned_Projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-3">
          <div className="h-6 w-48 bg-[#F1F5F9] rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-[#F1F5F9] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-[#F8FAFC] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Header & Summary Bar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#2563EB]" />
              <span>Returned Projects Archive</span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                {returnedProjects.length}
              </span>
            </h1>
            <p className="text-xs text-[#64748B] font-normal mt-0.5">
              Demobilized scaffolding rental contracts where all materials have been safely returned to yard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportXLSX}
              disabled={filteredReturned.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#334155] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-40"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#F1F5F9] text-xs">
          <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] block">Total Returned</span>
            <span className="text-base font-black text-[#0F172A] tabular-nums">{returnedMetrics.totalCount}</span>
          </div>

          <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
            <span className="text-[10px] uppercase font-bold text-[#16A34A] block">Fully Settled</span>
            <span className="text-base font-black text-[#16A34A] tabular-nums">{returnedMetrics.fullyPaidCount}</span>
          </div>

          <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
            <span className="text-[10px] uppercase font-bold text-[#DC2626] block">Unsettled Balance</span>
            <span className="text-base font-black text-[#DC2626] tabular-nums">{returnedMetrics.pendingPaymentCount}</span>
          </div>

          <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] block">Outstanding AED</span>
            <span className="text-base font-black text-[#DC2626] tabular-nums truncate block">
              {formatAED(returnedMetrics.totalOutstanding)}
            </span>
          </div>
        </div>

        {/* 2. Compact Search & Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1 text-xs">
          {/* Search */}
          <div className="relative col-span-2 sm:col-span-1 lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, company, reference..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* Payment Status */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Payments</option>
              <option value="NOT_PAID">Unpaid (Not Paid)</option>
              <option value="PARTIAL_PAID">Partial Paid</option>
              <option value="PAID">Fully Paid</option>
            </select>
          </div>

          {/* Salesperson */}
          <div>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Salespersons</option>
              {salespersons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="returnedDate">Sort: Returned Date</option>
              <option value="code">Sort: Project Code</option>
              <option value="outstanding">Sort: Highest Outstanding</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Reset filters"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Returned Projects Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <span>
            Showing <strong className="text-[#0F172A]">{filteredReturned.length}</strong> of{' '}
            <strong className="text-[#0F172A]">{returnedProjects.length}</strong> returned projects
          </span>

          <span className="text-[11px] text-[#94A3B8]">
            Click any row to view full project file & payment ledger
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475467] font-bold uppercase text-[10px] tracking-wider select-none">
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Delivery</th>
                <th className="py-2.5 px-3">Returned Date</th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th className="py-2.5 px-3 text-right">Outstanding</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredReturned.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B]">
                    <Archive className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    {returnedProjects.length === 0 ? (
                      <>
                        <p className="font-semibold text-sm text-[#334155]">No returned projects found</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          When projects are returned from site and closed, they will appear in this archive.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-sm text-[#334155]">
                          No projects match the current filters.
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          Try adjusting your search query or payment status filter.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-3 px-3 py-1.5 bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold rounded-lg hover:bg-[#DBEAFE] transition-colors cursor-pointer"
                          >
                            Clear Filters
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredReturned.map((p) => {
                  const fin = getProjectFinancials(p.id);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onViewProject(p)}
                      className="hover:bg-[#F8FAFC] transition-colors duration-150 cursor-pointer group"
                    >
                      {/* Project Code */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#2563EB] text-xs">
                            {p.projectCode}
                          </span>
                        </div>
                        {p.salespersonName && (
                          <span className="block text-[10px] text-[#94A3B8] truncate max-w-[120px]">
                            {p.salespersonName}
                          </span>
                        )}
                      </td>

                      {/* Company */}
                      <td className="py-2.5 px-3 font-semibold text-[#0F172A] max-w-[160px] truncate">
                        {p.company}
                      </td>

                      {/* Reference */}
                      <td className="py-2.5 px-3 text-[#475467] max-w-[150px] truncate">
                        <span>{p.projectReference || '—'}</span>
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            p.scaffoldingType === 'RENTAL'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                              : 'bg-[#F0FDF4] text-[#15803D]'
                          }`}
                        >
                          {p.scaffoldingType}
                        </span>
                      </td>

                      {/* Delivery Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#64748B]">
                        {formatDateDDMMYYYY(p.deliveryDate)}
                      </td>

                      {/* Returned Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[#0F172A]">
                        {p.returnedDate ? formatDateDDMMYYYY(p.returnedDate) : formatDateDDMMYYYY(p.dueDate)}
                      </td>

                      {/* Payment Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            p.paymentStatus === 'PAID'
                              ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                              : p.paymentStatus === 'PARTIAL_PAID'
                              ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                              : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                          }`}
                        >
                          {p.paymentStatus === 'PAID'
                            ? 'PAID'
                            : p.paymentStatus === 'PARTIAL_PAID'
                            ? 'PARTIAL PAID'
                            : 'NOT PAID'}
                        </span>
                      </td>

                      {/* Outstanding */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-bold tabular-nums ${
                            fin.outstandingAmount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                          }`}
                        >
                          {formatAED(fin.outstandingAmount)}
                        </span>
                      </td>

                      {/* Action */}
                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewProject(p)}
                            className="px-2 py-1 text-[11px] font-bold text-[#2563EB] hover:bg-[#EFF6FF] rounded transition-colors cursor-pointer flex items-center gap-1"
                            title="Open Project Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {isAdmin && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuOpenId(actionMenuOpenId === p.id ? null : p.id);
                                }}
                                className="p-1 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded transition-colors cursor-pointer"
                                title="Actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {actionMenuOpenId === p.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 z-30 text-left">
                                  {onEditProject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuOpenId(null);
                                        onEditProject(p);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer text-left"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-[#64748B]" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                  {onCopyProject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuOpenId(null);
                                        onCopyProject(p);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer text-left"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                                      <span>Duplicate</span>
                                    </button>
                                  )}
                                  {onDeleteProject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuOpenId(null);
                                        onDeleteProject(p);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-1.5 cursor-pointer text-left"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Move to Trash</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
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
    </div>
  );
};
