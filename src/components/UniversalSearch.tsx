import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, CompanyRecord } from '../types';
import { useProjects } from '../context/ProjectContext';
import { formatAED } from '../utils/commercialUtils';
import { isCompanyMatch } from '../utils/companyUtils';
import {
  Search,
  X,
  FolderKanban,
  Building,
  Receipt,
  ArrowRight,
  Clock,
  ChevronRight,
  Hash,
} from 'lucide-react';

interface UniversalSearchProps {
  onSelectProject: (project: Project) => void;
  onSelectCompany?: (companyName: string) => void;
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({
  onSelectProject,
  onSelectCompany,
}) => {
  const { projects, companies, invoices, getProjectFinancials } = useProjects();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut to focus search: Cmd+K / Ctrl+K or "/"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered & grouped search results
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) {
      return { projects: [], companies: [], invoices: [], totalCount: 0 };
    }

    // 1. Projects match
    const matchedProjects = projects.filter((p) => {
      const codeMatch = p.projectCode?.toLowerCase().includes(q);
      const compMatch = p.company?.toLowerCase().includes(q);
      const refMatch = p.projectReference?.toLowerCase().includes(q);
      const mobMatch = p.mobile?.includes(q);
      const remMatch = p.remarks?.toLowerCase().includes(q);
      const qtnMatch = (p as any).quotationNumber?.toLowerCase().includes(q);
      const lpoMatch = (p as any).lpoNumber?.toLowerCase().includes(q);
      return codeMatch || compMatch || refMatch || mobMatch || remMatch || qtnMatch || lpoMatch;
    });

    // 2. Companies match
    const matchedCompanies = companies.filter((c) => {
      const nameMatch = c.companyName?.toLowerCase().includes(q);
      const contactMatch = c.contactPerson?.toLowerCase().includes(q);
      const mobMatch = c.mobile?.includes(q);
      return nameMatch || contactMatch || mobMatch;
    });

    // 3. Invoices match (if any)
    const matchedInvoices = (invoices || []).filter((inv) => {
      const invNum = inv.invoiceNumber?.toLowerCase().includes(q);
      const prjCode = inv.projectId?.toLowerCase().includes(q);
      return invNum || prjCode;
    });

    return {
      projects: matchedProjects.slice(0, 6),
      companies: matchedCompanies.slice(0, 4),
      invoices: matchedInvoices.slice(0, 4),
      totalCount: matchedProjects.length + matchedCompanies.length + matchedInvoices.length,
    };
  }, [query, projects, companies, invoices]);

  // Flattened items for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<{ type: 'project' | 'company' | 'invoice'; data: any }> = [];
    searchResults.projects.forEach((p) => items.push({ type: 'project', data: p }));
    searchResults.companies.forEach((c) => items.push({ type: 'company', data: c }));
    searchResults.invoices.forEach((inv) => items.push({ type: 'invoice', data: inv }));
    return items;
  }, [searchResults]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (!isOpen || flatItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = flatItems[selectedIndex];
      if (current) {
        handleSelectItem(current);
      }
    }
  };

  const handleSelectItem = (item: { type: 'project' | 'company' | 'invoice'; data: any }) => {
    if (item.type === 'project') {
      onSelectProject(item.data as Project);
    } else if (item.type === 'company') {
      if (onSelectCompany) {
        onSelectCompany((item.data as CompanyRecord).companyName);
      } else {
        // Fallback: find first project of company and open
        const compPrj = projects.find(
          (p) => p.company?.toLowerCase() === item.data.companyName?.toLowerCase()
        );
        if (compPrj) onSelectProject(compPrj);
      }
    } else if (item.type === 'invoice') {
      const invPrj = projects.find((p) => p.id === item.data.projectId);
      if (invPrj) onSelectProject(invPrj);
    }
    setIsOpen(false);
    setQuery('');
  };

  let globalIndexTracker = 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md lg:max-w-lg">
      {/* Search Input Box */}
      <div
        className={`relative flex items-center bg-[#F8FAFC] border rounded-xl transition-all duration-150 ${
          isOpen
            ? 'border-[#2563EB] bg-white ring-2 ring-[#2563EB]/15 shadow-sm'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white'
        }`}
      >
        <Search className="w-4 h-4 text-[#64748B] ml-3 shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDownInput}
          placeholder="Search projects, companies, LPO, QTN, invoice..."
          className="w-full py-1.5 pl-2.5 pr-16 bg-transparent text-xs text-[#0F172A] placeholder:text-[#94A3B8] font-medium focus:outline-none"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 text-[#94A3B8] hover:text-[#475467] p-1 rounded-md transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#94A3B8] bg-white border border-[#E2E8F0] rounded shadow-2xs">
              ⌘K
            </kbd>
          </div>
        )}
      </div>

      {/* Dropdown Results Overlay */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-[#E2E8F0] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[480px] flex flex-col">
          {/* Header count summary */}
          <div className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
            <span>
              Matches found: <strong className="text-[#0F172A]">{searchResults.totalCount}</strong>
            </span>
            <span className="text-[10px] text-[#94A3B8]">
              ↑↓ navigate • Enter to view • Esc to close
            </span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-[#F1F5F9]">
            {searchResults.totalCount === 0 ? (
              <div className="p-6 text-center text-[#64748B]">
                <Search className="w-6 h-6 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#334155]">No matching records found</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  Check the project code, company name, or reference for spelling errors.
                </p>
              </div>
            ) : (
              <>
                {/* 1. PROJECTS GROUP */}
                {searchResults.projects.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase flex items-center gap-1">
                      <FolderKanban className="w-3 h-3 text-[#2563EB]" />
                      <span>Projects ({searchResults.projects.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {searchResults.projects.map((p) => {
                        const itemIdx = globalIndexTracker++;
                        const isSelected = selectedIndex === itemIdx;
                        const fin = getProjectFinancials(p.id);

                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectItem({ type: 'project', data: p })}
                            onMouseEnter={() => setSelectedIndex(itemIdx)}
                            className={`px-2.5 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs ${
                              isSelected
                                ? 'bg-[#EFF6FF] border border-[#BFDBFE]'
                                : 'hover:bg-[#F8FAFC] border border-transparent'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#2563EB] text-xs">
                                  {p.projectCode}
                                </span>
                                <span className="font-semibold text-[#0F172A] truncate">
                                  {p.company}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5 truncate">
                                <span className="truncate">{p.projectReference}</span>
                                {p.salespersonName && (
                                  <>
                                    <span>•</span>
                                    <span>{p.salespersonName}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  p.projectStatus === 'ACTIVE'
                                    ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                                    : p.projectStatus === 'EXTENDED'
                                    ? 'bg-[#F0FDF4] text-[#15803D]'
                                    : p.projectStatus === 'RETURNED'
                                    ? 'bg-[#F1F5F9] text-[#475467]'
                                    : 'bg-[#FFFBEB] text-[#B45309]'
                                }`}
                              >
                                {p.projectStatus}
                              </span>
                              {fin.outstandingAmount > 0 && (
                                <span className="block text-[10px] font-bold text-[#DC2626] mt-0.5 tabular-nums">
                                  {formatAED(fin.outstandingAmount)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. COMPANIES GROUP */}
                {searchResults.companies.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase flex items-center gap-1">
                      <Building className="w-3 h-3 text-[#16A34A]" />
                      <span>Companies ({searchResults.companies.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {searchResults.companies.map((c) => {
                        const itemIdx = globalIndexTracker++;
                        const isSelected = selectedIndex === itemIdx;
                        const compProjects = projects.filter(
                          (p) =>
                            (p.companyId && p.companyId === c.id) ||
                            isCompanyMatch(p.company, c.companyName, p.mobile, c.mobile)
                        );

                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectItem({ type: 'company', data: c })}
                            onMouseEnter={() => setSelectedIndex(itemIdx)}
                            className={`px-2.5 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs ${
                              isSelected
                                ? 'bg-[#F0FDF4] border border-[#BBF7D0]'
                                : 'hover:bg-[#F8FAFC] border border-transparent'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-[#0F172A] block truncate">
                                {c.companyName}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5 truncate">
                                {c.contactPerson && <span>{c.contactPerson}</span>}
                                {c.mobile && (
                                  <>
                                    <span>•</span>
                                    <span>{c.mobile}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <span className="text-[11px] font-semibold text-[#16A34A]">
                                {compProjects.length} Projects
                              </span>
                              {c.defaultSalespersonName && (
                                <span className="block text-[10px] text-[#94A3B8]">
                                  {c.defaultSalespersonName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. INVOICES / COMMERCIAL GROUP */}
                {searchResults.invoices.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase flex items-center gap-1">
                      <Receipt className="w-3 h-3 text-[#D97706]" />
                      <span>Invoices & Receipts ({searchResults.invoices.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {searchResults.invoices.map((inv) => {
                        const itemIdx = globalIndexTracker++;
                        const isSelected = selectedIndex === itemIdx;

                        return (
                          <div
                            key={inv.id}
                            onClick={() => handleSelectItem({ type: 'invoice', data: inv })}
                            onMouseEnter={() => setSelectedIndex(itemIdx)}
                            className={`px-2.5 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs ${
                              isSelected
                                ? 'bg-[#FFFBEB] border border-[#FDE68A]'
                                : 'hover:bg-[#F8FAFC] border border-transparent'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-[#D97706]">
                                #{inv.invoiceNumber}
                              </span>
                              <span className="text-[11px] text-[#64748B] ml-2">
                                Project: {inv.projectId}
                              </span>
                            </div>
                            <div className="shrink-0 font-bold text-[#0F172A] tabular-nums">
                              {formatAED(inv.invoiceAmount || 0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
