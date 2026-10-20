/**
 * Date utilities adhering strictly to DD/MM/YYYY display format
 */

export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';

  try {
    if (typeof dateInput === 'string') {
      // If already in YYYY-MM-DD
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
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
 * Calculate DueDate = DeliveryDate + HirePeriodDays
 * Returns ISO "YYYY-MM-DD"
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
 * The extension MUST always be added to the EXISTING DUE DATE,
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
 * Overdue & Days Remaining calculation:
 * For ACTIVE or EXTENDED project:
 * diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
 * diffDays < 0: Overdue by |diffDays| days
 * diffDays == 0: "Due Today"
 * diffDays > 0: "diffDays days remaining"
 */
export function calculateDiffDays(dueDateStr: string): number {
  if (!dueDateStr) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = dueDateStr.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return 0;

  const due = new Date(y, m - 1, d);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export interface DueStatusInfo {
  diffDays: number;
  label: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean; // diffDays >= 0 && diffDays <= 7
  badgeColorClass: string;
}

export function getDueStatus(
  dueDateStr: string,
  projectStatus: string,
  _paymentStatus?: string
): DueStatusInfo {
  // RETURNED or CLOSED projects: materials are demobilized and returned to yard.
  // They are never counted as overdue hire period.
  if (projectStatus === 'RETURNED' || projectStatus === 'CLOSED') {
    return {
      diffDays: 0,
      label: projectStatus === 'RETURNED' ? 'Returned' : 'Closed',
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      badgeColorClass:
        projectStatus === 'RETURNED'
          ? 'bg-[#F8FAFC] text-[#475467] border border-[#CBD5E1] font-semibold text-[10.5px]'
          : 'bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] font-semibold text-[10.5px]',
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
      badgeColorClass: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] font-bold text-[10.5px]',
    };
  }

  if (diffDays === 0) {
    return {
      diffDays: 0,
      label: 'Due Today',
      isOverdue: false,
      isDueToday: true,
      isDueSoon: true,
      badgeColorClass: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-bold text-[10.5px]',
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
      ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-semibold text-[10.5px]'
      : 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] font-semibold text-[10.5px]',
  };
}
