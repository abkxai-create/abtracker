import React, { useState, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { Project, ScaffoldingType, ProjectStatus, PaymentStatus } from '../types';
import { calculateDiffDays, formatDateDDMMYYYY } from '../utils/dateUtils';
import { ProjectsTable } from './ProjectsTable';
import { Search, Filter, RotateCcw, Calendar, CheckSquare, Layers } from 'lucide-react';

interface SearchViewProps {
  onViewProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onCopyProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onAddFollowup: (project: Project) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onViewProject,
  onEditProject,
  onCopyProject,
  onDeleteProject,
  onAddFollowup,
}) => {
  const { projects } = useProjects();

  // Search filter states
  const [keyword, setKeyword] = useState('');
  const [scaffoldingType, setScaffoldingType] = useState<string>('ALL');
  const [projectStatus, setProjectStatus] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [deliveryStart, setDeliveryStart] = useState('');
  const [deliveryEnd, setDeliveryEnd] = useState('');
  const [dueStart, setDueStart] = useState('');
  const [dueEnd, setDueEnd] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Multi-criteria filtering
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Keyword match (Code, Company, Reference, Mobile, Remarks)
      if (keyword.trim()) {
        const term = keyword.toLowerCase();
        const matchesKey =
          p.projectCode?.toLowerCase().includes(term) ||
          p.company?.toLowerCase().includes(term) ||
          p.projectReference?.toLowerCase().includes(term) ||
          p.mobile?.toLowerCase().includes(term) ||
          p.remarks?.toLowerCase().includes(term);
        if (!matchesKey) return false;
      }

      // Scaffolding type
      if (scaffoldingType !== 'ALL' && p.scaffoldingType !== scaffoldingType) return false;

      // Project status
      if (projectStatus !== 'ALL' && p.projectStatus !== projectStatus) return false;

      // Payment status
      if (paymentStatus !== 'ALL' && p.paymentStatus !== paymentStatus) return false;

      // Delivery date range
      if (deliveryStart && p.deliveryDate < deliveryStart) return false;
      if (deliveryEnd && p.deliveryDate > deliveryEnd) return false;

      // Due date range
      if (dueStart && p.dueDate < dueStart) return false;
      if (dueEnd && p.dueDate > dueEnd) return false;

      // Overdue only: active/extended past due (materials not yet returned)
      if (overdueOnly) {
        if (p.projectStatus !== 'ACTIVE' && p.projectStatus !== 'EXTENDED') return false;
        if (calculateDiffDays(p.dueDate) >= 0) return false;
      }

      return true;
    });
  }, [
    projects,
    keyword,
    scaffoldingType,
    projectStatus,
    paymentStatus,
    deliveryStart,
    deliveryEnd,
    dueStart,
    dueEnd,
    overdueOnly,
  ]);

  const handleResetFilters = () => {
    setKeyword('');
    setScaffoldingType('ALL');
    setProjectStatus('ALL');
    setPaymentStatus('ALL');
    setDeliveryStart('');
    setDeliveryEnd('');
    setDueStart('');
    setDueEnd('');
    setOverdueOnly(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight flex items-center gap-2.5">
            <Search className="w-6 h-6 text-[#2563EB]" />
            <span>Search & Multi-Criteria Filtering</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] font-normal mt-1">
            Query across client company, reference, dates, scaffolding rental types, and overdue states.
          </p>
        </div>

        <button
          onClick={handleResetFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#172033] hover:text-[#172033] bg-white border border-[#D0D5DD] rounded-lg hover:bg-[#F2F4F7] transition w-fit shadow-2xs cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#667085]" />
          <span>Reset All Filters</span>
        </button>
      </div>

      {/* Filter Control Panel */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-xs p-5 space-y-4">
        {/* Main Search Bar */}
        <div>
          <label className="block text-xs font-semibold text-[#172033] uppercase tracking-wider mb-1.5">
            Primary Search
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-3" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by project code (e.g. PRJ-0001), company name, mobile, reference, or remarks..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition text-[#172033] placeholder:text-[#98A2B3]"
            />
          </div>
        </div>

        {/* Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-[#172033] mb-1">Scaffolding Type</label>
            <select
              value={scaffoldingType}
              onChange={(e) => setScaffoldingType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-[#172033] text-xs font-medium cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="RENTAL">RENTAL (Material Only)</option>
              <option value="EREC/DISM">EREC/DISM (Erection/Dismantling)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Project Status</label>
            <select
              value={projectStatus}
              onChange={(e) => setProjectStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-[#172033] text-xs font-medium cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="EXTENDED">EXTENDED</option>
              <option value="RETURNED">RETURNED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-[#172033] text-xs font-medium cursor-pointer"
            >
              <option value="ALL">All Payments</option>
              <option value="NOT_PAID">NOT_PAID</option>
              <option value="PARTIAL_PAID">PARTIAL_PAID</option>
              <option value="PAID">PAID</option>
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#DC2626] select-none bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 w-full hover:bg-rose-100 transition shadow-2xs">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[#DC2626] focus:ring-[#DC2626] cursor-pointer"
              />
              <span>Show Overdue Only</span>
            </label>
          </div>
        </div>

        {/* Date Ranges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E4E7EC] text-xs">
          <div>
            <span className="font-semibold text-[#172033] block mb-1">Delivery Date Range</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deliveryStart}
                onChange={(e) => setDeliveryStart(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              />
              <span className="text-[#667085] font-normal">to</span>
              <input
                type="date"
                value={deliveryEnd}
                onChange={(e) => setDeliveryEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>
          </div>

          <div>
            <span className="font-semibold text-[#172033] block mb-1">Due Date Range</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueStart}
                onChange={(e) => setDueStart(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              />
              <span className="text-[#667085] font-normal">to</span>
              <input
                type="date"
                value={dueEnd}
                onChange={(e) => setDueEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <ProjectsTable
        projects={filteredProjects}
        title={`Search Results (${filteredProjects.length} Projects Found)`}
        subtitle="Matching current filter criteria across the active database"
        onViewProject={onViewProject}
        onEditProject={onEditProject}
        onCopyProject={onCopyProject}
        onDeleteProject={onDeleteProject}
        onAddFollowup={onAddFollowup}
      />
    </div>
  );
};
