import React from 'react';
import { motion } from 'motion/react';
import { formatAED } from '../utils/commercialUtils';
import { AnimatedNumber } from './AnimatedNumber';
import { User, Hash, Clock, Building2 } from 'lucide-react';

interface ProjectHeaderSummaryProps {
  projectCode: string;
  company: string;
  salespersonName?: string;
  projectReference?: string;
  nextMonthRental?: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  isOverdue?: boolean;
  hasExtension?: boolean;
  extensionDays?: number;
  extensionRentalAmount?: number;
  originalRentalAmount?: number;
  originalHirePeriodDays?: number;
}

export const ProjectHeaderSummary: React.FC<ProjectHeaderSummaryProps> = ({
  projectCode,
  company,
  salespersonName,
  projectReference,
  nextMonthRental,
  totalAmount,
  totalPaid,
  totalPending,
  isOverdue,
  hasExtension,
  extensionDays,
  extensionRentalAmount,
  originalRentalAmount,
  originalHirePeriodDays,
}) => {
  const isFullyPaid = totalPending === 0;
  const isExtensionActive = Boolean(hasExtension && extensionRentalAmount && extensionRentalAmount > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="bg-[#0F172A] text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-[#1E293B] shadow-md relative overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        {/* Left Side: Bold Project Identity (Clear, Bold, Zero Repetition) */}
        <div className="space-y-2 min-w-0 flex-1">
          {/* Row 1: Code Badge + Big Bold Company Name */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-xs font-black bg-[#2563EB] text-white px-2.5 py-1 rounded-lg tabular-nums tracking-wider shadow-xs shrink-0 ring-1 ring-white/10">
              {projectCode || '—'}
            </span>
            <h3 className="font-black text-base sm:text-xl text-white uppercase tracking-tight truncate max-w-xl drop-shadow-xs">
              {company || '—'}
            </h3>
          </div>

          {/* Row 2: Bold Reference & Bold Salesperson (Clean, High-Contrast Badges) */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Bold Reference Badge */}
            {projectReference ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-950/70 border border-sky-400/40 text-sky-200 shadow-2xs">
                <Hash className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/90">Ref:</span>
                <span className="font-mono font-black text-xs text-sky-300 truncate max-w-xs">
                  {projectReference}
                </span>
              </div>
            ) : null}

            {/* Bold Salesperson Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 shadow-2xs">
              <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Salesperson:</span>
              <span className="font-black text-xs text-white">
                {salespersonName || 'Unassigned'}
              </span>
            </div>

            {/* Extension or Monthly Rental (Clean secondary badge) */}
            {isExtensionActive ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-200 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Extension:</span>
                <span className="font-mono font-black text-xs text-amber-300 tabular-nums">
                  {formatAED(extensionRentalAmount)} ({extensionDays || 7}d)
                </span>
                {originalRentalAmount ? (
                  <span className="text-[10px] text-amber-300/80 hidden sm:inline">
                    (Orig: {formatAED(originalRentalAmount)}/{originalHirePeriodDays || 20}d)
                  </span>
                ) : null}
              </div>
            ) : nextMonthRental && nextMonthRental > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/70 text-slate-300">
                <span className="text-[10px] font-medium text-slate-400">Monthly:</span>
                <span className="font-mono font-bold text-xs text-sky-300 tabular-nums">
                  {formatAED(nextMonthRental)}/mo
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Side: Financial Summary Totals (TOTAL | PAID | BALANCE / OVERDUE) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 bg-[#131F37] p-1.5 sm:p-2 rounded-xl border border-[#2A3B5C] shadow-sm divide-x divide-[#22314E] self-start lg:self-center">
          {/* TOTAL */}
          <div className="px-2.5 sm:px-3.5 py-1 text-center min-w-[74px] sm:min-w-[88px]">
            <span className="text-[9.5px] uppercase font-bold text-[#8EA0C1] tracking-wider block" title="Total Hire / Contract Amount">
              TOTAL
            </span>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="text-[9px] font-bold text-[#62779F]">AED</span>
              <AnimatedNumber
                value={totalAmount}
                duration={320}
                format={(n) => n.toLocaleString('en-US')}
                className="font-black text-xs sm:text-sm text-white font-mono tabular-nums tracking-tight"
              />
            </div>
          </div>

          {/* EXTENSION (if active) */}
          {isExtensionActive && (
            <div className="px-2.5 sm:px-3.5 py-1 text-center min-w-[74px] sm:min-w-[88px]">
              <span className="text-[9.5px] uppercase font-bold text-[#F59E0B] tracking-wider block" title="Rental charge for extension period">
                EXT ({extensionDays || 7}D)
              </span>
              <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                <span className="text-[9px] font-bold text-[#B45309]">AED</span>
                <AnimatedNumber
                  value={extensionRentalAmount || 0}
                  duration={320}
                  format={(n) => n.toLocaleString('en-US')}
                  className="font-black text-xs sm:text-sm text-[#FBBF24] font-mono tabular-nums tracking-tight"
                />
              </div>
            </div>
          )}

          {/* MONTHLY (if active & not extension) */}
          {!isExtensionActive && nextMonthRental !== undefined && nextMonthRental > 0 && (
            <div className="px-2.5 sm:px-3.5 py-1 text-center min-w-[74px] sm:min-w-[88px]">
              <span className="text-[9.5px] uppercase font-bold text-[#38BDF8] tracking-wider block" title="Monthly recurring rental rate">
                MONTHLY
              </span>
              <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                <span className="text-[9px] font-bold text-[#0284C7]">AED</span>
                <AnimatedNumber
                  value={nextMonthRental}
                  duration={320}
                  format={(n) => n.toLocaleString('en-US')}
                  className="font-black text-xs sm:text-sm text-[#38BDF8] font-mono tabular-nums tracking-tight"
                />
              </div>
            </div>
          )}

          {/* PAID */}
          <div className="px-2.5 sm:px-3.5 py-1 text-center min-w-[74px] sm:min-w-[88px]">
            <span className="text-[9.5px] uppercase font-bold text-[#4ADE80] tracking-wider block">
              PAID
            </span>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="text-[9px] font-bold text-[#16A34A]">AED</span>
              <AnimatedNumber
                value={totalPaid}
                duration={320}
                format={(n) => n.toLocaleString('en-US')}
                className="font-black text-xs sm:text-sm text-[#4ADE80] font-mono tabular-nums tracking-tight"
              />
            </div>
          </div>

          {/* BALANCE / OVERDUE */}
          <div className="px-2.5 sm:px-3.5 py-1 text-center min-w-[74px] sm:min-w-[88px]">
            <div className="flex items-center justify-center gap-1">
              {!isFullyPaid && isOverdue && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-pulse" />
              )}
              <span
                className={`text-[9.5px] uppercase font-bold tracking-wider block ${
                  isFullyPaid ? 'text-[#4ADE80]' : isOverdue ? 'text-[#F87171]' : 'text-[#FBBF24]'
                }`}
              >
                {isFullyPaid ? 'BALANCE' : isOverdue ? 'OVERDUE' : 'BALANCE'}
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span
                className={`text-[9px] font-bold ${
                  isFullyPaid
                    ? 'text-[#16A34A]'
                    : isOverdue
                    ? 'text-[#DC2626]'
                    : 'text-[#D97706]'
                }`}
              >
                AED
              </span>
              <AnimatedNumber
                value={totalPending}
                duration={320}
                format={(n) => n.toLocaleString('en-US')}
                className={`font-black text-xs sm:text-sm font-mono tabular-nums tracking-tight ${
                  isFullyPaid
                    ? 'text-[#86EFAC]'
                    : isOverdue
                    ? 'text-[#F87171]'
                    : 'text-[#FBBF24]'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
