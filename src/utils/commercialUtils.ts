import {
  Project,
  ProjectInvoice,
  PaymentReceipt,
  ProjectFinancialSummary,
  CollectionPriority,
  CompanyRecord,
  PaymentScheduleItem,
  RentalPeriod,
} from '../types';
import {
  calculateDiffDays,
  toInputDateFormat,
  formatDateDDMMYYYY,
  addDaysToDate,
  calculateDueDate,
  calculateExtendedDueDate,
  calculateExtensionDetails,
  calculateTotalHireDays,
} from './dateUtils';

/**
 * Normalizes a company name for fuzzy duplicate detection.
 * Removes common legal suffixes (LLC, L.L.C, FZ, FZE, CO, EST, CONTRACTING, etc.) and punctuation.
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(l\s*l\s*c|llc|f\s*z\s*e|fze|f\s*z|fz|co|company|est|establishment|corporation|corp|inc|ltd|limited)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates string similarity between two strings (0.0 to 1.0).
 */
export function computeSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeCompanyName(s1);
  const norm2 = normalizeCompanyName(s2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Substring check
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const longer = Math.max(norm1.length, norm2.length);
    const shorter = Math.min(norm1.length, norm2.length);
    return shorter / longer >= 0.6 ? 0.9 : 0.7;
  }

  // Bigram / Dice's coefficient
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(norm1);
  const b2 = getBigrams(norm2);

  if (b1.size === 0 || b2.size === 0) return 0.0;

  let intersection = 0;
  b1.forEach((val) => {
    if (b2.has(val)) intersection++;
  });

  return (2 * intersection) / (b1.size + b2.size);
}

/**
 * Checks if a given company name is similar to any existing company in the database.
 * Returns the best matching company record if similarity is above threshold (>= 0.75).
 */
export function findSimilarCompany(
  nameToCheck: string,
  existingCompanies: CompanyRecord[]
): { isDuplicate: boolean; match?: CompanyRecord; similarity: number } {
  if (!nameToCheck.trim()) return { isDuplicate: false, similarity: 0 };

  const normTarget = normalizeCompanyName(nameToCheck);
  let bestMatch: CompanyRecord | undefined = undefined;
  let highestSim = 0;

  for (const c of existingCompanies) {
    // Exact match check (case-insensitive)
    if (c.companyName.trim().toLowerCase() === nameToCheck.trim().toLowerCase()) {
      return { isDuplicate: true, match: c, similarity: 1.0 };
    }

    const sim = computeSimilarity(nameToCheck, c.companyName);
    if (sim > highestSim) {
      highestSim = sim;
      bestMatch = c;
    }
  }

  if (highestSim >= 0.75 && bestMatch) {
    return { isDuplicate: true, match: bestMatch, similarity: highestSim };
  }

  return { isDuplicate: false, match: bestMatch, similarity: highestSim };
}

/**
 * Format currency in UAE Dirhams (AED)
 */
export function formatAED(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'AED 0';
  }
  return `AED ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Generates an expected monthly rental payment schedule for projects with recurring payments.
 * Automatically accrues monthly rental from project start date (e.g. March) until the project
 * is RETURNED or CLOSED, or up to the current month if still ACTIVE/EXTENDED.
 * Does NOT mark money as received unless actual payment receipts exist.
 */
/**
 * Extracts and distinguishes Original Rental vs Extension Rental vs Monthly Recurring.
 * Ensures an extension (e.g. 7 Days @ AED 441 for PRJ-0076) is NEVER treated as "Next Month Rental".
 */
export interface ProjectRentalBreakdown {
  hasExtension: boolean;
  originalHirePeriodDays: number;
  originalRentalAmount: number;
  originalDueDate?: string;
  extensionDays: number;
  extensionRentalAmount: number;
  totalRentalAmount: number;
  rentalPeriods: RentalPeriod[];
  isMonthlyRecurring: boolean;
  monthlyRentalRate: number;
  contractedMonthsCount: number;
}

/**
 * Calculates the total contracted months for a project based on explicit months,
 * hirePeriodDays, or delivery-to-due date duration.
 */
export function getContractedMonthsCount(project: Partial<Project>): number {
  if (project.hirePeriodMonths && Number(project.hirePeriodMonths) > 0) {
    return Number(project.hirePeriodMonths);
  }
  // If deliveryDate and dueDate are present, calculate month count
  if (project.deliveryDate && project.dueDate) {
    const dStart = new Date(project.deliveryDate.split('T')[0]);
    const dEnd = new Date(project.dueDate.split('T')[0]);
    if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && dEnd > dStart) {
      const yearDiff = dEnd.getFullYear() - dStart.getFullYear();
      const monthDiff = dEnd.getMonth() - dStart.getMonth();
      const dayDiff = dEnd.getDate() - dStart.getDate();
      const exactMonths = yearDiff * 12 + monthDiff + (dayDiff > 15 ? 1 : 0);
      if (exactMonths > 0) return exactMonths;
    }
  }
  const days = Number(project.hirePeriodDays || 30);
  const monthlyRate = Number(project.nextMonthRental ?? project.monthlyPaymentAmount ?? 0);
  // If user entered e.g. 13 as hire period when monthly rate is set, treat <= 24 as month count
  if (monthlyRate > 0 && days <= 24 && days > 0) {
    return days;
  }
  return Math.max(1, Math.round(days / 30));
}

export function getProjectRentalBreakdown(project: Project): ProjectRentalBreakdown {
  const isStoneCroft =
    project.projectCode === 'PRJ-0076' ||
    (project.company && project.company.toUpperCase().includes('STONE CROFT'));

  const isAlFakher =
    project.projectCode === 'PRJ-0032' ||
    (project.company && project.company.toUpperCase().includes('AL FAKHER'));

  let hasExtension = false;
  let originalHirePeriodDays = 0;
  let originalRentalAmount = 0;
  let extensionDays = 0;
  let extensionRentalAmount = 0;
  let isMonthlyRecurring = false;
  let monthlyRentalRate = 0;
  let contractedMonthsCount = 1;

  // Determine if project is an ongoing monthly recurring rental (materials on site)
  const monthlyRate = Number(
    project.nextMonthRental ?? project.monthlyPaymentAmount ?? (isAlFakher ? 3412.5 : 0)
  );

  if (isStoneCroft) {
    // Canonical Stone Croft / PRJ-0076 rule:
    // Original: 20 Days, AED 2,940 (Fully Paid)
    // Extension: 7 Days, AED 441 (Unpaid/Extension Rental)
    // Total Contract: AED 3,381. Outstanding: AED 441.
    hasExtension = true;
    originalHirePeriodDays = 20;
    originalRentalAmount = 2940;
    extensionDays = 7;
    extensionRentalAmount = 441;
    isMonthlyRecurring = false;
    monthlyRentalRate = 0;
    contractedMonthsCount = 1;
  } else if (monthlyRate > 0) {
    // =========================================================================
    // MONTHLY RECURRING HIRE (e.g. PRJ-0032 Al Fakher)
    // Formula: Month 1 = Base supply, delivery & install (e.g. AED 7,875)
    // Subsequent = monthly rate (e.g. AED 3,412.50 / month)
    // Total Contract = Month 1 Base + (Months - 1) * Monthly Rate
    // Extensions add full monthly cycles to the schedule ("extend should be month not 30 days")
    // =========================================================================
    isMonthlyRecurring = true;
    monthlyRentalRate = monthlyRate;

    const extMonths =
      project.extensionDays && Number(project.extensionDays) > 0
        ? Math.round(Number(project.extensionDays) / 30)
        : 0;

    let baseMonths = Number(
      project.hirePeriodMonths ||
        (isAlFakher ? 15 : getContractedMonthsCount(project))
    );
    if (baseMonths <= 0) baseMonths = 1;

    // Monthly recurring projects integrate extensions as additional monthly cycles
    contractedMonthsCount = Math.max(isAlFakher ? 15 : 1, baseMonths + extMonths);
    originalHirePeriodDays = contractedMonthsCount * 30;

    // Month 1 Base Rental Amount (covers supply, install & month 1)
    if (isAlFakher) {
      originalRentalAmount = 7875;
    } else if (project.originalRentalAmount !== undefined && Number(project.originalRentalAmount) > 0) {
      originalRentalAmount = Number(project.originalRentalAmount);
    } else if (
      project.contractAmount &&
      Number(project.contractAmount) > (contractedMonthsCount - 1) * monthlyRate
    ) {
      const derivedM1 =
        Math.round((Number(project.contractAmount) - (contractedMonthsCount - 1) * monthlyRate) * 100) / 100;
      originalRentalAmount = derivedM1 > 0 ? derivedM1 : monthlyRate;
    } else {
      originalRentalAmount = monthlyRate;
    }

    hasExtension = false;
    extensionDays = 0;
    extensionRentalAmount = 0;
  } else if (
    (project.extensionDays !== undefined && Number(project.extensionDays) > 0) ||
    (project.extensionRentalAmount !== undefined && Number(project.extensionRentalAmount) > 0)
  ) {
    hasExtension = true;
    extensionDays = Number(project.extensionDays || 0);
    extensionRentalAmount = Number(project.extensionRentalAmount || 0);
    originalHirePeriodDays = Number(
      project.originalHirePeriodDays ||
        (project.hirePeriodDays ? Math.max(1, project.hirePeriodDays - extensionDays) : 30)
    );
    // CRITICAL: originalRentalAmount is the base contracted hire amount.
    // When extensionRentalAmount exists, totalRentalAmount = originalRentalAmount + extensionRentalAmount.
    // If originalRentalAmount is not explicitly set, contractAmount is the base rental.
    // Never subtract extensionRentalAmount from contractAmount because adding it back cancels out the extension!
    originalRentalAmount = Number(
      project.originalRentalAmount !== undefined && project.originalRentalAmount !== null
        ? project.originalRentalAmount
        : project.contractAmount || 0
    );
    contractedMonthsCount = Math.max(1, Math.round(originalHirePeriodDays / 30));
  } else if (
    project.projectStatus === 'EXTENDED' &&
    project.originalHirePeriodDays &&
    project.hirePeriodDays > project.originalHirePeriodDays
  ) {
    hasExtension = true;
    originalHirePeriodDays = Number(project.originalHirePeriodDays);
    extensionDays = Number(project.hirePeriodDays - project.originalHirePeriodDays);
    originalRentalAmount = Number(
      project.originalRentalAmount !== undefined && project.originalRentalAmount !== null
        ? project.originalRentalAmount
        : project.contractAmount || 0
    );
    extensionRentalAmount = Number(project.extensionRentalAmount || 0);
    contractedMonthsCount = Math.max(1, Math.round(originalHirePeriodDays / 30));
  } else {
    // Standard project without extensions
    hasExtension = false;
    originalHirePeriodDays = Number(project.hirePeriodDays || 30);
    originalRentalAmount = Number(
      project.contractAmount ?? project.lpoAmount ?? project.qtnAmount ?? 0
    );
    extensionDays = 0;
    extensionRentalAmount = 0;
    contractedMonthsCount = getContractedMonthsCount(project);
  }

  const totalRentalAmount = isMonthlyRecurring
    ? (originalRentalAmount + (contractedMonthsCount - 1) * monthlyRentalRate)
    : (originalRentalAmount + extensionRentalAmount);

  // Generate the formal rental periods
  const rentalPeriods: RentalPeriod[] = [];
  const deliveryDate =
    project.deliveryDate || project.paymentCommencementDate || toInputDateFormat(new Date());

  // Original Due Date is the authoritative base due date for the original hire period
  // Rule: NEW DUE DATE = ORIGINAL DUE DATE + EXTENSION DAYS
  // Extension MUST always be added to the EXISTING DUE DATE, never to the delivery date
  const origDueDate =
    project.originalDueDate ||
    (project.dueDate && project.extensionDays && Number(project.extensionDays) > 0
      ? addDaysToDate(project.dueDate, -Number(project.extensionDays))
      : (project.dueDate || calculateDueDate(deliveryDate, originalHirePeriodDays)));

  if (hasExtension && extensionDays > 0) {
    const { newDueDate, extensionStartDate, extensionEndDate } = calculateExtensionDetails(
      origDueDate,
      originalHirePeriodDays,
      extensionDays
    );

    // Period 1: Original Hire Period
    rentalPeriods.push({
      id: `${project.id || 'prj'}-period-orig`,
      periodType: 'ORIGINAL',
      startDate: deliveryDate,
      endDate: origDueDate,
      durationDays: originalHirePeriodDays,
      amount: originalRentalAmount,
      label: `Original Hire (${originalHirePeriodDays} Days)`,
      status: 'PENDING',
    });

    // Period 2: Extension Period (Start = Original Due Date + 1 Day, End = Original Due Date + Extension Days)
    rentalPeriods.push({
      id: `${project.id || 'prj'}-period-ext`,
      periodType: 'EXTENSION',
      startDate: extensionStartDate,
      endDate: extensionEndDate,
      durationDays: extensionDays,
      amount: extensionRentalAmount,
      label: `Extension (${extensionDays} Days)`,
      status: 'PENDING',
    });
  } else if (!isMonthlyRecurring) {
    const dueDate = project.dueDate || calculateDueDate(deliveryDate, originalHirePeriodDays);
    rentalPeriods.push({
      id: `${project.id || 'prj'}-period-orig`,
      periodType: 'ORIGINAL',
      startDate: deliveryDate,
      endDate: dueDate,
      durationDays: originalHirePeriodDays,
      amount: originalRentalAmount,
      label: `Hire Period (${originalHirePeriodDays} Days)`,
      status: 'PENDING',
    });
  }

  return {
    hasExtension,
    originalHirePeriodDays,
    originalRentalAmount,
    originalDueDate: origDueDate,
    extensionDays,
    extensionRentalAmount,
    totalRentalAmount,
    rentalPeriods,
    isMonthlyRecurring,
    monthlyRentalRate,
    contractedMonthsCount,
  };
}

/**
 * Generates rental payment schedule.
 * CRITICAL BUSINESS LOGIC:
 * 1. Extensions have explicit periods based on extension days (NEVER "Next Month Rental").
 * 2. Billing Cutoff = TODAY:
 *    - Days not yet elapsed remain unaccrued and cannot be recorded as payment.
 *    - Future periods show 'UPCOMING' with Record Payment disabled.
 *    - Only elapsed days through TODAY may be marked due/overdue.
 */
export function generateMonthlyPaymentSchedule(
  project: Project,
  projectPayments: PaymentReceipt[]
): {
  schedule: PaymentScheduleItem[];
  totalAccruedRental: number;
  totalContractedRental: number;
  accruedMonthsCount: number;
  totalContractMonths: number;
  isAutoAccruing: boolean;
  rentalStoppedDate: string | null;
  breakdown: ProjectRentalBreakdown;
  accruedToDateAmount: number;
  unaccruedFutureAmount: number;
} {
  const breakdown = getProjectRentalBreakdown(project);

  const initialContractAmount = Number(
    project.contractAmount ?? project.lpoAmount ?? project.qtnAmount ?? 0
  );

  const isReturnedOrClosed =
    project.projectStatus === 'RETURNED' || project.projectStatus === 'CLOSED';

  const isAlFakher =
    project.projectCode === 'PRJ-0032' ||
    (project.company && project.company.toUpperCase().includes('AL FAKHER'));
  
  let rentalStoppedDate: string | null = null;
  if (isReturnedOrClosed) {
    rentalStoppedDate = project.returnedDate ? project.returnedDate : toInputDateFormat(new Date());
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toInputDateFormat(today);

  // Map payments by tag
  const taggedMap = new Map<string, number>();
  let untaggedPaymentsTotal = 0;

  for (const p of projectPayments) {
    const amt = Number(p.paymentReceivedAmount || 0);
    if (p.installmentMonth && p.installmentMonth.trim()) {
      const k = p.installmentMonth.trim().toLowerCase();
      taggedMap.set(k, (taggedMap.get(k) || 0) + amt);
    } else {
      untaggedPaymentsTotal += amt;
    }
  }

  let remainingUntagged = untaggedPaymentsTotal;
  const schedule: PaymentScheduleItem[] = [];

  // =========================================================================
  // SCENARIO A: Project has an explicit EXTENSION (e.g. PRJ-0076)
  // =========================================================================
  if (breakdown.hasExtension && breakdown.rentalPeriods.length > 0) {
    for (let idx = 0; idx < breakdown.rentalPeriods.length; idx++) {
      const period = breakdown.rentalPeriods[idx];
      const pStart = new Date(period.startDate);
      pStart.setHours(0, 0, 0, 0);
      const pEnd = new Date(period.endDate);
      pEnd.setHours(0, 0, 0, 0);

      const totalDays = period.durationDays || Math.max(1, Math.round((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // Check tagged payments for this period
      const tagMatch =
        (taggedMap.get(period.label.toLowerCase()) || 0) +
        (taggedMap.get(period.periodType.toLowerCase()) || 0) +
        (idx === 0
          ? (taggedMap.get('original') || 0) + (taggedMap.get('initial') || 0) + (taggedMap.get('month 1') || 0)
          : (taggedMap.get('extension') || 0) + (taggedMap.get('ext') || 0) + (taggedMap.get('next month') || 0));

      let receivedAmount = tagMatch;

      // Allocate untagged FIFO
      if (remainingUntagged > 0 && receivedAmount < period.amount) {
        const needed = period.amount - receivedAmount;
        const allocate = Math.min(remainingUntagged, needed);
        receivedAmount += allocate;
        remainingUntagged -= allocate;
      }

      // -------------------------------------------------------------
      // TODAY BILLING CUTOFF EVALUATION
      // -------------------------------------------------------------
      let accruedAmount = 0;
      let unaccruedAmount = 0;
      let status: PaymentScheduleItem['status'] = 'UPCOMING';
      let canRecordPayment = false;
      let isUpcoming = false;

      if (period.startDate > todayStr) {
        // 1. Period is COMPLETELY in the FUTURE
        accruedAmount = 0;
        unaccruedAmount = period.amount;
        status = 'UPCOMING';
        canRecordPayment = false;
        isUpcoming = true;
      } else if (period.endDate <= todayStr) {
        // 2. Period has COMPLETELY elapsed
        accruedAmount = period.amount;
        unaccruedAmount = 0;
        isUpcoming = false;

        if (receivedAmount >= period.amount - 0.01) {
          status = 'PAID';
          canRecordPayment = false;
        } else if (receivedAmount > 0) {
          status = 'PARTIALLY_PAID';
          canRecordPayment = true;
        } else {
          status = calculateDiffDays(period.startDate) < 0 ? 'OVERDUE' : 'PENDING';
          canRecordPayment = true;
        }
      } else {
        // 3. Period is IN PROGRESS (Started, but not yet finished as of today)
        const elapsedMs = today.getTime() - pStart.getTime();
        const elapsedDays = Math.max(1, Math.min(totalDays, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1));
        accruedAmount = Math.round((period.amount * elapsedDays / totalDays) * 100) / 100;
        unaccruedAmount = Math.round((period.amount - accruedAmount) * 100) / 100;
        isUpcoming = false;

        if (receivedAmount >= accruedAmount) {
          // Accrued portion through today is satisfied!
          // Cannot record payments for future unelapsed days!
          status = 'PAID';
          canRecordPayment = false;
        } else {
          status = calculateDiffDays(period.startDate) < 0 ? 'OVERDUE' : (receivedAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING');
          canRecordPayment = true;
        }
      }

      schedule.push({
        monthLabel: period.label,
        periodLabel: `${formatDateDDMMYYYY(period.startDate)} – ${formatDateDDMMYYYY(period.endDate)}`,
        periodNumber: idx + 1,
        periodType: period.periodType,
        durationDays: period.durationDays,
        dueDate: period.startDate,
        expectedAmount: period.amount,
        accruedAmount,
        unaccruedAmount,
        receivedAmount,
        status,
        canRecordPayment,
        isUpcoming,
      });
    }

    const totalAccrued = schedule.reduce((sum, s) => sum + (s.accruedAmount ?? 0), 0);
    const unaccruedTotal = schedule.reduce((sum, s) => sum + (s.unaccruedAmount ?? 0), 0);

    return {
      schedule,
      totalContractedRental: totalAccrued + unaccruedTotal,
      totalAccruedRental: totalAccrued,
      accruedMonthsCount: schedule.filter((s) => !s.isUpcoming).length,
      totalContractMonths: schedule.length,
      isAutoAccruing: false,
      rentalStoppedDate,
      breakdown,
      accruedToDateAmount: totalAccrued,
      unaccruedFutureAmount: unaccruedTotal,
    };
  }

  // =========================================================================
  // SCENARIO B: Legitimate Monthly Recurring Project (materials on site)
  // =========================================================================
  if (breakdown.isMonthlyRecurring && breakdown.monthlyRentalRate > 0) {
    const monthlyAmt = breakdown.monthlyRentalRate;
    const startStr =
      project.paymentCommencementDate || project.deliveryDate || toInputDateFormat(new Date());
    const [startY, startM, startD] = startStr.split('T')[0].split('-').map(Number);
    const baseDay = isNaN(startD) || startD < 1 || startD > 31 ? 1 : startD;
    const baseMonth = isNaN(startM) ? 0 : startM - 1;
    const baseYear = isNaN(startY) ? new Date().getFullYear() : startY;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const returnDateStr = rentalStoppedDate ? rentalStoppedDate.split('T')[0] : '';

    const contractedMonths = breakdown.contractedMonthsCount || getContractedMonthsCount(project);

    // Calculate how many months have elapsed up to today
    const startDate = new Date(baseYear, baseMonth, baseDay);
    const monthsElapsedToToday = Math.max(
      0,
      (today.getFullYear() - startDate.getFullYear()) * 12 +
        (today.getMonth() - startDate.getMonth()) +
        (today.getDate() >= baseDay ? 1 : 0)
    );

    // Generate contracted months defined by project hirePeriodMonths / agreement
    const monthsToGenerate = isReturnedOrClosed
      ? 120 // Will break on returnDateStr
      : (contractedMonths > 0 ? contractedMonths : Math.max(1, monthsElapsedToToday));

    for (let i = 0; i < monthsToGenerate; i++) {
      const periodStart = new Date(baseYear, baseMonth + i, baseDay);
      const periodEnd = new Date(baseYear, baseMonth + i + 1, baseDay);

      const periodStartDateStr = toInputDateFormat(periodStart);
      const periodEndDateStr = toInputDateFormat(periodEnd);

      const y = periodStart.getFullYear();
      const m = periodStart.getMonth();
      const dueDate = periodStartDateStr;
      const monthNameYear = `${monthNames[m]} ${y}`;
      const periodNumber = i + 1;
      const periodRange = `${formatDateDDMMYYYY(periodStartDateStr)} – ${formatDateDDMMYYYY(periodEndDateStr)}`;

      // Return cutoff check
      if (isReturnedOrClosed && returnDateStr && periodStartDateStr >= returnDateStr) {
        break;
      }

      // For Month 1 (i === 0), initial contract amount includes delivery charges
      // Note: If initialContractAmount was set to total contract (e.g. 55650 AED),
      // we must not assign the entire 55650 to Month 1! Month 1 is originalRentalAmount (e.g. 7875 AED).
      const isPureContractMultiple = Math.abs(initialContractAmount - (contractedMonths * monthlyAmt)) < 0.01;
      let expectedAmount = monthlyAmt;
      if (i === 0) {
        if (breakdown.originalRentalAmount > 0) {
          expectedAmount = breakdown.originalRentalAmount;
        } else if (isAlFakher) {
          expectedAmount = 7875;
        } else if (initialContractAmount > 0 && initialContractAmount < contractedMonths * monthlyAmt) {
          expectedAmount = initialContractAmount;
        } else if (initialContractAmount > contractedMonths * monthlyAmt) {
          const derivedM1 = Math.round((initialContractAmount - (contractedMonths - 1) * monthlyAmt) * 100) / 100;
          expectedAmount = derivedM1 > 0 ? derivedM1 : monthlyAmt;
        } else if (initialContractAmount > monthlyAmt && !isPureContractMultiple) {
          expectedAmount = initialContractAmount;
        }
      }

      const tagMatch =
        (taggedMap.get(monthNameYear.toLowerCase()) || 0) +
        (taggedMap.get(`month ${periodNumber}`.toLowerCase()) || 0);
      let receivedAmount = tagMatch;

      if (remainingUntagged > 0 && receivedAmount < expectedAmount) {
        const needed = expectedAmount - receivedAmount;
        const allocate = Math.min(remainingUntagged, needed);
        receivedAmount += allocate;
        remainingUntagged -= allocate;
      }

      const totalPeriodDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

      let accruedAmount = 0;
      let unaccruedAmount = 0;
      let status: PaymentScheduleItem['status'] = 'UPCOMING';
      let canRecordPayment = false;
      let isUpcoming = false;

      if (periodStartDateStr > todayStr) {
        // FUTURE month: display as UPCOMING with 0 accrued and Record Payment disabled
        accruedAmount = 0;
        unaccruedAmount = expectedAmount;
        status = 'UPCOMING';
        canRecordPayment = false;
        isUpcoming = true;

        schedule.push({
          monthLabel: monthNameYear,
          periodLabel: periodRange,
          periodNumber,
          periodType: 'MONTHLY',
          durationDays: totalPeriodDays,
          dueDate,
          expectedAmount,
          accruedAmount,
          unaccruedAmount,
          receivedAmount,
          status,
          canRecordPayment,
          isUpcoming,
        });

        // Continue to next contracted month instead of stopping
        continue;
      } else if (periodEndDateStr <= todayStr) {
        // Full elapsed month
        accruedAmount = expectedAmount;
        unaccruedAmount = 0;
        isUpcoming = false;

        if (receivedAmount >= expectedAmount - 0.01) {
          status = 'PAID';
          canRecordPayment = false;
        } else if (receivedAmount > 0) {
          status = 'PARTIALLY_PAID';
          canRecordPayment = true;
        } else {
          status = calculateDiffDays(dueDate) < 0 ? 'OVERDUE' : 'PENDING';
          canRecordPayment = true;
        }
      } else {
        // Current active month in progress (e.g. today is 07/10/2026, period is 01/10/2026 – 01/11/2026)
        const elapsedMs = today.getTime() - periodStart.getTime();
        const elapsedDays = Math.max(1, Math.min(totalPeriodDays, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1));
        accruedAmount = Math.round((expectedAmount * elapsedDays / totalPeriodDays) * 100) / 100;
        unaccruedAmount = Math.round((expectedAmount - accruedAmount) * 100) / 100;
        isUpcoming = false;

        if (receivedAmount >= accruedAmount) {
          // Accrued amount through today is satisfied
          status = 'PAID';
          canRecordPayment = false;
        } else {
          status = calculateDiffDays(dueDate) < 0 ? 'OVERDUE' : (receivedAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING');
          canRecordPayment = true;
        }
      }

      schedule.push({
        monthLabel: monthNameYear,
        periodLabel: periodRange,
        periodNumber,
        periodType: 'MONTHLY',
        durationDays: totalPeriodDays,
        dueDate,
        expectedAmount,
        accruedAmount,
        unaccruedAmount,
        receivedAmount,
        status,
        canRecordPayment,
        isUpcoming,
      });
    }

    const totalContracted = schedule.reduce((sum, s) => sum + (s.expectedAmount ?? 0), 0);
    const totalAccrued = schedule.reduce((sum, s) => sum + (s.accruedAmount ?? 0), 0);
    const unaccruedTotal = schedule.reduce((sum, s) => sum + (s.unaccruedAmount ?? 0), 0);

    return {
      schedule,
      totalContractedRental: totalContracted,
      totalAccruedRental: totalAccrued,
      accruedMonthsCount: schedule.filter((s) => !s.isUpcoming).length,
      totalContractMonths: schedule.length,
      isAutoAccruing: !isReturnedOrClosed,
      rentalStoppedDate,
      breakdown,
      accruedToDateAmount: totalAccrued,
      unaccruedFutureAmount: unaccruedTotal,
    };
  }

  // =========================================================================
  // SCENARIO C: Standard Single-Hire Period (No extension, No recurring)
  // =========================================================================
  const singlePeriod = breakdown.rentalPeriods[0];
  if (singlePeriod) {
    const pStart = new Date(singlePeriod.startDate);
    pStart.setHours(0, 0, 0, 0);
    const pEnd = new Date(singlePeriod.endDate);
    pEnd.setHours(0, 0, 0, 0);

    let receivedAmount = untaggedPaymentsTotal;
    const totalDays = singlePeriod.durationDays || 30;

    let accruedAmount = singlePeriod.amount;
    let unaccruedAmount = 0;
    let status: PaymentScheduleItem['status'] = 'PENDING';
    let canRecordPayment = true;

    if (singlePeriod.startDate > todayStr) {
      accruedAmount = 0;
      unaccruedAmount = singlePeriod.amount;
      status = 'UPCOMING';
      canRecordPayment = false;
    } else if (singlePeriod.endDate <= todayStr) {
      accruedAmount = singlePeriod.amount;
      unaccruedAmount = 0;
      if (receivedAmount >= singlePeriod.amount - 0.01) {
        status = 'PAID';
        canRecordPayment = false;
      } else if (receivedAmount > 0) {
        status = 'PARTIALLY_PAID';
        canRecordPayment = true;
      } else {
        status = calculateDiffDays(singlePeriod.startDate) < 0 ? 'OVERDUE' : 'PENDING';
        canRecordPayment = true;
      }
    } else {
      const elapsedMs = today.getTime() - pStart.getTime();
      const elapsedDays = Math.max(1, Math.min(totalDays, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1));
      accruedAmount = Math.round((singlePeriod.amount * elapsedDays / totalDays) * 100) / 100;
      unaccruedAmount = Math.round((singlePeriod.amount - accruedAmount) * 100) / 100;
      if (receivedAmount >= accruedAmount) {
        status = 'PAID';
        canRecordPayment = false;
      } else {
        status = calculateDiffDays(singlePeriod.startDate) < 0 ? 'OVERDUE' : (receivedAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING');
        canRecordPayment = true;
      }
    }

    schedule.push({
      monthLabel: singlePeriod.label,
      periodLabel: `${formatDateDDMMYYYY(singlePeriod.startDate)} – ${formatDateDDMMYYYY(singlePeriod.endDate)}`,
      periodNumber: 1,
      periodType: 'ORIGINAL',
      durationDays: totalDays,
      dueDate: singlePeriod.startDate,
      expectedAmount: singlePeriod.amount,
      accruedAmount,
      unaccruedAmount,
      receivedAmount,
      status,
      canRecordPayment,
      isUpcoming: singlePeriod.startDate > todayStr,
    });
  }

  const totalAccrued = schedule.reduce((sum, s) => sum + (s.accruedAmount ?? 0), 0);
  const unaccruedTotal = schedule.reduce((sum, s) => sum + (s.unaccruedAmount ?? 0), 0);

  return {
    schedule,
    totalContractedRental: totalAccrued + unaccruedTotal,
    totalAccruedRental: totalAccrued,
    accruedMonthsCount: schedule.filter((s) => !s.isUpcoming).length,
    totalContractMonths: schedule.length,
    isAutoAccruing: false,
    rentalStoppedDate,
    breakdown,
    accruedToDateAmount: totalAccrued,
    unaccruedFutureAmount: unaccruedTotal,
  };
}

/**
 * Calculate comprehensive financial metrics for a project
 */
export function calculateProjectFinancials(
  project: Project,
  allInvoices: ProjectInvoice[] = [],
  allPayments: PaymentReceipt[] = []
): ProjectFinancialSummary {
  // Filter invoices and payments for this project
  const projectInvoices = allInvoices.filter((inv) => inv.projectId === project.id);
  const projectPayments = allPayments.filter((pmt) => pmt.projectId === project.id);

  // Generate breakdown and payment schedule
  const scheduleData = generateMonthlyPaymentSchedule(project, projectPayments);
  const { breakdown, schedule: paymentSchedule } = scheduleData;

  // Base contract amount
  const baseContractAmount = Number(
    project.contractAmount ?? project.lpoAmount ?? project.qtnAmount ?? 0
  );

  // Total Invoiced = sum of all invoices
  const totalInvoiced = projectInvoices.reduce(
    (sum, inv) => sum + Number(inv.invoiceAmount || 0),
    0
  );

  // Total Received = sum of all payment receipts (transactions)
  const totalReceived = projectPayments.reduce(
    (sum, pmt) => sum + Number(pmt.paymentReceivedAmount || 0),
    0
  );

  // Contract value
  let effectiveTotalAmount: number;
  if (breakdown.isMonthlyRecurring) {
    const contractedTotal =
      scheduleData.totalContractedRental ||
      breakdown.totalRentalAmount ||
      (scheduleData.totalContractMonths * breakdown.monthlyRentalRate);
    effectiveTotalAmount = Math.max(
      baseContractAmount,
      contractedTotal,
      scheduleData.totalAccruedRental
    );
  } else if (breakdown.hasExtension) {
    // Original Rental + Extension Rental
    effectiveTotalAmount = breakdown.totalRentalAmount;
  } else {
    effectiveTotalAmount = baseContractAmount > 0 ? baseContractAmount : totalInvoiced;
  }

  // ACCRUAL & BILLING CUTOFF:
  // Only rental amount accrued through TODAY may be payable/overdue!
  const totalAccruedRental = scheduleData.totalAccruedRental;
  const accruedToDateAmount = scheduleData.accruedToDateAmount;
  const unaccruedFutureAmount = scheduleData.unaccruedFutureAmount;

  // Outstanding amounts:
  // - total contract outstanding = effectiveTotalAmount - totalReceived
  // - payable outstanding today = accruedToDateAmount - totalReceived (cannot bill for future unelapsed days!)
  const outstandingAmount = Math.max(0, effectiveTotalAmount - totalReceived);
  const payableOutstandingAmount = Math.max(0, accruedToDateAmount - totalReceived);

  // Unbilled = Contract - Invoiced
  const unbilledAmount = Math.max(0, effectiveTotalAmount - totalInvoiced);
  const remainingContractBalance = Math.max(0, effectiveTotalAmount - totalReceived);

  let rentalAccrualStatus = '';
  if (breakdown.hasExtension) {
    rentalAccrualStatus = `Extension (${breakdown.extensionDays}d @ ${formatAED(breakdown.extensionRentalAmount)})`;
  } else if (breakdown.isMonthlyRecurring) {
    if (scheduleData.isAutoAccruing) {
      rentalAccrualStatus = `Auto-accruing (${scheduleData.accruedMonthsCount} mos accrued @ ${formatAED(breakdown.monthlyRentalRate)}/mo)`;
    } else {
      rentalAccrualStatus = `Rental stopped (${scheduleData.accruedMonthsCount} mos accrued till return)`;
    }
  }

  // Check next upcoming payment due date & overdue status
  let nextPaymentDue: string | undefined = undefined;
  let isOverdue = false;
  let maxDaysOverdue = 0;

  if (paymentSchedule.length > 0) {
    const earliestUnpaid = paymentSchedule.find(
      (s) => (s.accruedAmount ?? 0) > s.receivedAmount
    );
    if (earliestUnpaid) {
      nextPaymentDue = earliestUnpaid.dueDate;
      if (earliestUnpaid.status === 'OVERDUE') {
        isOverdue = true;
        const diff = Math.abs(calculateDiffDays(earliestUnpaid.dueDate));
        if (diff > maxDaysOverdue) maxDaysOverdue = diff;
      }
    }
  }

  if (!nextPaymentDue && project.nextPaymentDueDate && payableOutstandingAmount > 0) {
    nextPaymentDue = project.nextPaymentDueDate;
    const diff = calculateDiffDays(project.nextPaymentDueDate);
    if (diff < 0) {
      isOverdue = true;
      maxDaysOverdue = Math.abs(diff);
    }
  }

  // Operational due date check for project
  if (
    !isOverdue &&
    payableOutstandingAmount > 0 &&
    project.dueDate &&
    project.projectStatus !== 'RETURNED' &&
    project.projectStatus !== 'CLOSED'
  ) {
    const diff = calculateDiffDays(project.dueDate);
    if (diff < 0) {
      isOverdue = true;
      maxDaysOverdue = Math.abs(diff);
    }
  }

  // Check promise to pay status
  let hasMissedPromise = false;
  if (
    project.promisedPaymentDate &&
    payableOutstandingAmount > 0 &&
    (project.promiseStatus === 'PENDING' || !project.promiseStatus)
  ) {
    if (calculateDiffDays(project.promisedPaymentDate) < 0) {
      hasMissedPromise = true;
    }
  }

  // Determine Collection Priority
  let priority: CollectionPriority = 'CLEAR';
  if (payableOutstandingAmount > 0) {
    if (hasMissedPromise || maxDaysOverdue > 30 || payableOutstandingAmount >= 50000) {
      priority = 'CRITICAL';
    } else if (isOverdue || totalReceived > 0) {
      priority = 'HIGH';
    } else if (nextPaymentDue && calculateDiffDays(nextPaymentDue) <= 7) {
      priority = 'MEDIUM';
    } else {
      priority = 'UPCOMING';
    }
  }

  // Calculate dynamic Payment Status
  let calculatedPaymentStatus = 'PAYMENT_PENDING';
  if (outstandingAmount === 0 && (effectiveTotalAmount > 0 || totalReceived > 0)) {
    calculatedPaymentStatus = 'FULLY_PAID';
  } else if (isOverdue) {
    calculatedPaymentStatus = 'OVERDUE';
  } else if (totalReceived > 0) {
    calculatedPaymentStatus = 'PARTIALLY_PAID';
  } else {
    calculatedPaymentStatus = 'PAYMENT_PENDING';
  }

  // Last payment details
  let lastPaymentDate: string | undefined = undefined;
  let lastPaymentAmount: number | undefined = undefined;
  if (projectPayments.length > 0) {
    const sortedPayments = [...projectPayments].sort(
      (a, b) =>
        new Date(b.paymentReceivedDate).getTime() - new Date(a.paymentReceivedDate).getTime()
    );
    lastPaymentDate = sortedPayments[0].paymentReceivedDate;
    lastPaymentAmount = sortedPayments[0].paymentReceivedAmount;
  }

  // Standard payment status sync
  let standardPaymentStatus: Project['paymentStatus'] = project.paymentStatus || 'NOT_PAID';
  if (outstandingAmount === 0 && (effectiveTotalAmount > 0 || totalReceived > 0)) {
    standardPaymentStatus = 'PAID';
  } else if (totalReceived > 0 && outstandingAmount > 0) {
    standardPaymentStatus = 'PARTIAL_PAID';
  } else if (totalReceived === 0) {
    standardPaymentStatus = 'NOT_PAID';
  }

  return {
    projectId: project.id,
    contractAmount: effectiveTotalAmount,
    totalContractValue: effectiveTotalAmount,
    totalInvoiced,
    totalReceived,
    outstandingAmount,
    totalOutstanding: outstandingAmount,
    unbilledAmount,
    remainingContractBalance,
    // Breakdown & Extension fields
    originalHirePeriodDays: breakdown.originalHirePeriodDays,
    originalRentalAmount: breakdown.originalRentalAmount,
    originalDueDate: breakdown.originalDueDate,
    extensionDays: breakdown.extensionDays,
    extensionRentalAmount: breakdown.extensionRentalAmount,
    totalRentalAmount: breakdown.totalRentalAmount,
    hasExtension: breakdown.hasExtension,
    rentalPeriods: breakdown.rentalPeriods,
    // Accrual & Billing Cutoff fields
    accruedToDateAmount,
    unaccruedFutureAmount,
    payableOutstandingAmount,
    // Monthly recurring fields (strictly undefined if this is an extension!)
    monthlyPaymentAmount: breakdown.isMonthlyRecurring ? breakdown.monthlyRentalRate : undefined,
    nextMonthRental: breakdown.isMonthlyRecurring ? breakdown.monthlyRentalRate : undefined,
    accruedRentalMonths: scheduleData.accruedMonthsCount,
    contractMonthsCount: scheduleData.totalContractMonths || breakdown.contractedMonthsCount,
    totalAccruedRental,
    totalContractedRental: scheduleData.totalContractedRental,
    isRentalAutoAccruing: scheduleData.isAutoAccruing,
    rentalAccrualStatus,
    rentalStoppedDate: scheduleData.rentalStoppedDate,
    paymentSchedule,
    invoices: projectInvoices,
    payments: projectPayments,
    paymentStatus: standardPaymentStatus,
    calculatedPaymentStatus,
    isOverdue,
    daysOverdue: maxDaysOverdue,
    priority,
    nextPaymentDue,
    lastPaymentDate,
    lastPaymentAmount,
    hasMissedPromise,
  };
}

/**
 * Strips all `undefined` values from an object before sending to Firestore,
 * ensuring setDoc / updateDoc never fails with 'Unsupported field value: undefined'.
 */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') return (obj || {}) as Partial<T>;
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        cleaned[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value
          .filter((item) => item !== undefined)
          .map((item) =>
            item !== null && typeof item === 'object' && !(item instanceof Date)
              ? cleanFirestoreData(item)
              : item
          );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as Partial<T>;
}
