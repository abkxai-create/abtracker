/**
 * Centralized business date rules and calculations.
 * Strict standard:
 * - Storage: ISO string 'YYYY-MM-DD'
 * - Display: 'DD/MM/YYYY'
 * - Audit Timestamps: ISO strings with time
 */

export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';

  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.split('T')[0].trim();
      const parts = trimmed.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const [year, month, day] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
      // If already DD/MM/YYYY
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        return trimmed;
      }
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

export function formatDateTimeDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';

  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

export function toInputDateFormat(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates project Due Date from Delivery Date and Hire Period Days.
 * Rule: DueDate = DeliveryDate + HirePeriodDays
 */
export function calculateDueDate(deliveryDateStr: string, hirePeriodDays: number): string {
  if (!deliveryDateStr || !hirePeriodDays || isNaN(hirePeriodDays)) return deliveryDateStr;

  const [y, m, d] = deliveryDateStr.split('-').map(Number);
  if (!y || !m || !d) return deliveryDateStr;

  const delivery = new Date(y, m - 1, d);
  delivery.setDate(delivery.getDate() + Number(hirePeriodDays));

  return toInputDateFormat(delivery);
}

/**
 * Add days to an ISO YYYY-MM-DD date string
 */
export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return toInputDateFormat(new Date());
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + Number(days));
  return toInputDateFormat(date);
}

/**
 * CRITICAL EXTENSION BUSINESS LOGIC:
 * Formula: NEW DUE DATE = ORIGINAL DUE DATE + EXTENSION DAYS
 * Rule: The extension MUST always be added to the EXISTING DUE DATE,
 * never to the delivery date and never by adding calendar months.
 *
 * Example:
 * Original Delivery Date = 25/09/2026
 * Original Hire Period = 30 Days
 * Original Due Date = 25/10/2026
 * Extension = 7 Days
 * Extension Start = 26/10/2026 (Original Due Date + 1 Day)
 * Extension End / New Due Date = 01/11/2026 (Original Due Date + 7 Days)
 * Total Hire Days = 30 + 7 = 37 Days
 */
export function calculateExtendedDueDate(
  existingDueDateStr: string,
  extensionDays: number
): string {
  if (!existingDueDateStr) return toInputDateFormat(new Date());
  if (!extensionDays || isNaN(extensionDays) || extensionDays <= 0) return existingDueDateStr;
  return addDaysToDate(existingDueDateStr, Number(extensionDays));
}

/**
 * Calculates total hire duration in days.
 * Formula: TOTAL HIRE DAYS = ORIGINAL HIRE DAYS + EXTENSION DAYS
 */
export function calculateTotalHireDays(
  originalHireDays: number,
  extensionDays: number
): number {
  return (Number(originalHireDays) || 0) + (Number(extensionDays) || 0);
}

/**
 * Calculates explicit extension period date range and new due date:
 * - Extension Start = Original Due Date + 1 Day
 * - Extension End / New Due Date = Original Due Date + Extension Days
 * - Total Hire Days = Original Hire Days + Extension Days
 */
export function calculateExtensionDetails(
  originalDueDateStr: string,
  originalHireDays: number,
  extensionDays: number
): {
  newDueDate: string;
  extensionStartDate: string;
  extensionEndDate: string;
  totalHireDays: number;
} {
  const safeExtDays = Number(extensionDays) || 0;
  const safeOrigDays = Number(originalHireDays) || 0;
  const newDueDate = calculateExtendedDueDate(originalDueDateStr, safeExtDays);
  const extensionStartDate = addDaysToDate(originalDueDateStr, 1);
  const extensionEndDate = newDueDate;
  const totalHireDays = calculateTotalHireDays(safeOrigDays, safeExtDays);

  return {
    newDueDate,
    extensionStartDate,
    extensionEndDate,
    totalHireDays,
  };
}

/**
 * Calculates day difference between target date and today.
 * Returns negative if target date is in the past (overdue).
 */
export function calculateDiffDays(targetDateStr: string): number {
  if (!targetDateStr) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = targetDateStr.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return 0;

  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export interface DueStatusInfo {
  diffDays: number;
  label: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  badgeColorClass: string;
}

/**
 * Evaluates operational due status for a project based on lifecycle.
 * Invariant: If equipment is RETURNED or CLOSED, it is demobilized and NOT overdue.
 */
export function getDueStatus(dueDateStr: string, projectStatus: string): DueStatusInfo {
  if (projectStatus === 'RETURNED' || projectStatus === 'CLOSED') {
    return {
      diffDays: 0,
      label: projectStatus === 'RETURNED' ? 'Returned' : 'Closed',
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      badgeColorClass: 'bg-slate-100 text-slate-700 border border-slate-300 font-medium text-xs',
    };
  }

  const diffDays = calculateDiffDays(dueDateStr);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      diffDays,
      label: `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`,
      isOverdue: true,
      isDueToday: false,
      isDueSoon: false,
      badgeColorClass: 'bg-red-50 text-red-700 border border-red-200 font-semibold text-xs',
    };
  }

  if (diffDays === 0) {
    return {
      diffDays: 0,
      label: 'Due Today',
      isOverdue: false,
      isDueToday: true,
      isDueSoon: true,
      badgeColorClass: 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-xs',
    };
  }

  const isDueSoon = diffDays <= 7;
  return {
    diffDays,
    label: `${diffDays} ${diffDays === 1 ? 'day' : 'days'} remaining`,
    isOverdue: false,
    isDueToday: false,
    isDueSoon,
    badgeColorClass: isDueSoon
      ? 'bg-amber-50 text-amber-700 border border-amber-200 font-medium text-xs'
      : 'bg-blue-50 text-blue-700 border border-blue-200 font-medium text-xs',
  };
}
