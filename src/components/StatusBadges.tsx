import React from 'react';
import { ProjectStatus, PaymentStatus } from '../types';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md';
}

export const ProjectStatusBadge: React.FC<ProjectStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || 'ACTIVE').toUpperCase();

  // Color mapping strictly adhering to Section 5:
  // ACTIVE: Green
  // EXTENDED: Blue
  // DUE SOON: Orange
  // OVERDUE: Red
  // RETURNED: Grey / neutral
  // CLOSED: Dark grey / muted
  // ON HOLD: Yellow / amber
  // CANCELLED: Muted red / grey
  let dotColor = 'bg-emerald-500';
  let badgeClasses = 'text-emerald-800 bg-emerald-50 border-emerald-200';
  let label = 'ACTIVE';

  switch (normalized) {
    case 'ACTIVE':
      dotColor = 'bg-emerald-600';
      badgeClasses = 'text-emerald-800 bg-emerald-50/90 border-emerald-200';
      label = 'ACTIVE';
      break;
    case 'EXTENDED':
      dotColor = 'bg-blue-600';
      badgeClasses = 'text-blue-800 bg-blue-50/90 border-blue-200';
      label = 'EXTENDED';
      break;
    case 'RETURNED':
      dotColor = 'bg-slate-500';
      badgeClasses = 'text-slate-700 bg-slate-100 border-slate-200';
      label = 'RETURNED';
      break;
    case 'CLOSED':
      dotColor = 'bg-slate-600';
      badgeClasses = 'text-slate-700 bg-slate-200/80 border-slate-300';
      label = 'CLOSED';
      break;
    case 'ON_HOLD':
    case 'ON HOLD':
      dotColor = 'bg-amber-500';
      badgeClasses = 'text-amber-800 bg-amber-50 border-amber-200';
      label = 'ON HOLD';
      break;
    case 'CANCELLED':
      dotColor = 'bg-rose-400';
      badgeClasses = 'text-rose-800 bg-rose-50/70 border-rose-200';
      label = 'CANCELLED';
      break;
    default:
      dotColor = 'bg-slate-500';
      badgeClasses = 'text-slate-700 bg-slate-100 border-slate-200';
      label = normalized;
      break;
  }

  const paddingClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border tracking-tight shrink-0 select-none ${paddingClass} ${badgeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
};

interface DaysRemainingBadgeProps {
  diffDays: number;
  projectStatus: ProjectStatus;
  returnedDate?: string | null;
  paymentStatus?: PaymentStatus;
}

export const DaysRemainingBadge: React.FC<DaysRemainingBadgeProps> = ({
  diffDays,
  projectStatus,
  returnedDate,
  paymentStatus,
}) => {
  // If project is RETURNED or CLOSED, materials have been returned
  if (projectStatus === 'RETURNED' || projectStatus === 'CLOSED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#475467] font-semibold text-[11px] tracking-tight whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#64748B] shrink-0" />
        <span>{projectStatus === 'RETURNED' ? 'Returned' : 'Closed'}</span>
      </span>
    );
  }

  // Section 22:
  // Overdue: Red
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] tracking-tight whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0 animate-pulse" />
        <span>{overdueDays} {overdueDays === 1 ? 'Day' : 'Days'} Overdue</span>
      </span>
    );
  }

  // Due Today: Orange/Amber
  if (diffDays === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-bold text-[11px] tracking-tight whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
        <span>Due Today</span>
      </span>
    );
  }

  // Approaching: 1 to 7 Days (Due Soon)
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50/80 border border-amber-200 text-amber-800 font-semibold text-[11px] tracking-tight whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>{diffDays} {diffDays === 1 ? 'Day' : 'Days'} Remaining</span>
      </span>
    );
  }

  // Healthy: > 7 Days
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50/70 border border-emerald-200 text-emerald-800 font-semibold text-[11px] tracking-tight whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>{diffDays} Days Remaining</span>
    </span>
  );
};
