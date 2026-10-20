export type UserRole = 'ADMIN' | 'SALESPERSON' | 'STAFF';

export type UserApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';

export type AuthMethod = 'GOOGLE' | 'EMAIL_PASSWORD' | 'EMAIL_OTP' | 'USERNAME_PASSWORD';

export interface UserProfile {
  uid: string;
  username?: string;
  name: string;
  email: string;
  authMethod: AuthMethod;
  role: UserRole;
  salespersonId?: string;
  salespersonName?: string;
  approvalStatus: UserApprovalStatus;
  isFirstUser: boolean;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalespersonAccount {
  userId: string;
  username: string;
  passwordHash?: string;
  salespersonId: string;
  salespersonName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type ScaffoldingType = 'RENTAL' | 'EREC/DISM';

export type ProjectStatus =
  | 'ACTIVE'
  | 'EXTENDED'
  | 'RETURNED'
  | 'CLOSED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type PaymentStatus = 'PAID' | 'PARTIAL_PAID' | 'NOT_PAID';

export type SalespersonAssignmentType = 'AUTO_ASSIGNED' | 'MANUALLY_CHANGED';

export type FollowUpStatus =
  | 'Not Contacted'
  | 'Reminder Sent'
  | 'Called'
  | 'Promise to Pay'
  | 'Payment Awaited'
  | 'Escalated'
  | 'Paid';

export type PromiseStatus = 'PENDING' | 'HONORED' | 'MISSED';

export interface Salesperson {
  id: string;
  name: string;
  mobile: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyRecord {
  id: string;
  companyName: string;
  normalizedName: string;
  normalizedMobile?: string;
  defaultSalespersonId: string;
  defaultSalespersonName: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInvoice {
  id: string;
  projectId: string;
  projectCode: string;
  company: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  invoiceAmount: number; // AED
  paymentDueDate: string; // YYYY-MM-DD
  remarks?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type PaymentMethod = 'Bank Transfer' | 'Cheque' | 'Cash' | 'Other';

export type PaymentType = 'Advance' | 'Rental' | 'Monthly Payment' | 'Final Payment' | 'Other';

export interface PaymentReceipt {
  id: string;
  projectId: string;
  projectCode: string;
  invoiceId?: string;
  invoiceNumber?: string;
  company: string;
  paymentReceivedDate: string; // YYYY-MM-DD
  paymentReceivedAmount: number; // AED
  paymentMethod: PaymentMethod;
  paymentType?: PaymentType;
  installmentMonth?: string; // e.g. "Apr 2026"
  paymentReference?: string; // Cheque No, Bank Ref, etc.
  remarks?: string;
  createdAt: string;
  createdBy: string;
}

export interface RentalPeriod {
  id: string;
  periodType: 'ORIGINAL' | 'EXTENSION' | 'MONTHLY';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  amount: number; // AED
  accruedAmount?: number; // AED accrued up to today's date
  unaccruedAmount?: number; // AED remaining in this period that has not yet elapsed
  receivedAmount?: number; // AED paid towards this period
  status: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE' | 'UPCOMING';
  label: string;
  isAccrued?: boolean;
  canRecordPayment?: boolean;
}

export interface PaymentScheduleItem {
  monthLabel: string; // e.g. "Original Hire (20 Days)", "Extension (7 Days)", "Mar 2026"
  periodLabel?: string; // e.g. "23/03/2026 – 23/04/2026"
  periodNumber?: number; // e.g. 1, 2, 3...
  periodType?: 'ORIGINAL' | 'EXTENSION' | 'MONTHLY';
  durationDays?: number;
  dueDate: string; // "YYYY-MM-DD"
  expectedAmount: number; // AED
  accruedAmount?: number; // AED accrued up to today
  unaccruedAmount?: number; // AED unelapsed future
  receivedAmount: number; // AED
  status: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE' | 'UPCOMING';
  canRecordPayment?: boolean;
  isUpcoming?: boolean;
}

export interface Project {
  id: string;
  projectCode: string; // e.g. "PRJ-0001"
  company: string;
  companyId?: string; // Stable canonical company identifier
  mobile: string; // formatted text e.g. "052-1234567"
  projectReference: string; // Main commercial reference / LPO number
  scaffoldingType: ScaffoldingType;
  hirePeriodDays: number;
  hirePeriodMonths?: number; // Optional duration in months (e.g. 13 Months)
  deliveryDate: string; // ISO string "YYYY-MM-DD"
  dueDate: string; // ISO string "YYYY-MM-DD"
  isDueDateOverridden: boolean;
  projectStatus: ProjectStatus;
  returnedDate?: string | null; // ISO string "YYYY-MM-DD"
  paymentStatus: PaymentStatus;
  remarks: string;

  // MODULE 1: Salesperson Ownership
  salespersonId?: string;
  salespersonName?: string;
  salespersonAssignmentType?: SalespersonAssignmentType;

  // MODULE 2: Commercial Values & Recurring Payments
  contractAmount?: number; // Total Contract / LPO Amount (AED)
  originalHirePeriodDays?: number; // Original period hire duration in days (e.g. 20 Days)
  originalRentalAmount?: number; // Original hire rental amount (e.g. AED 2,940)
  originalDueDate?: string; // Original due date before extension (YYYY-MM-DD)
  extensionDays?: number; // Total additional extension days (e.g. 7 Days)
  extensionRentalAmount?: number; // Total extension rental amount (e.g. AED 441)
  rentalPeriods?: RentalPeriod[];
  monthlyPaymentAmount?: number; // Optional monthly recurring amount (AED) - strictly for long-term recurring contracts
  nextMonthRental?: number; // Alias for recurring monthly option (AED)
  paymentCommencementDate?: string; // Optional start date for recurring installments
  nextPaymentDueDate?: string; // Next expected payment due date (YYYY-MM-DD)

  // Preserved historical fields
  qtnNumber?: string;
  qtnDate?: string;
  qtnAmount?: number;
  qtnStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

  lpoNumber?: string;
  lpoDate?: string;
  lpoAmount?: number;
  paymentTerms?: string; // e.g. "30 Days PDC", "Advance 50%", etc.
  creditDays?: number; // Credit period in days

  // Follow-Up & Promise to Pay Tracking
  lastFollowUpDate?: string;
  nextFollowUpDate?: string;
  followUpStatus?: FollowUpStatus;
  followUpRemarks?: string;
  followUpCount?: number;
  promisedPaymentDate?: string;
  promisedAmount?: number;
  promiseStatus?: PromiseStatus;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface PaymentFollowup {
  id: string;
  projectId: string;
  followUpNumber: number; // e.g. 1, 2, 3
  followUpDate: string; // "YYYY-MM-DD"
  notes: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  followUpStatus?: string;
  promiseDate?: string;
  promiseAmount?: number;
}

export type ActivityAction =
  | 'CREATED'
  | 'UPDATED'
  | 'STATUS_CHANGE'
  | 'PAYMENT_CHANGE'
  | 'DUE_DATE_OVERRIDE'
  | 'SOFT_DELETED'
  | 'RESTORED'
  | 'PERMANENTLY_DELETED'
  | 'FOLLOW_UP_ADDED'
  | 'REMARKS_UPDATED'
  | 'INVOICE_ADDED'
  | 'PAYMENT_RECORDED'
  | 'SALESPERSON_ASSIGNED'
  | 'COPIED';

export interface ProjectActivity {
  id: string;
  projectId: string;
  projectCode?: string;
  userId: string;
  userName: string;
  action: ActivityAction;
  previousValue?: string | null;
  newValue?: string | null;
  details: string;
  createdAt: string;
}

export interface RemarksHistory {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  createdByName?: string;
  previousRemark: string;
  remarkText?: string;
  createdAt: string;
}

export type NavigationTab =
  | 'dashboard'
  | 'projects'
  | 'collections'
  | 'returned'
  | 'companies'
  | 'administration'
  // Legacy aliases supported for backward compatibility:
  | 'all_projects'
  | 'returned_projects'
  | 'sales_customers'
  | 'payments_collections'
  | 'payment_followup'
  | 'recent_activity'
  | 'search'
  | 'trash'
  | 'users'
  | 'settings';

export type DashboardCardFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'EXTENDED'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'RETURNED'
  | 'CLOSED'
  | 'ON_HOLD'
  | 'NOT_PAID'
  | 'PAYMENT_FOLLOWUP';

export type CollectionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'UPCOMING' | 'CLEAR';

export interface ProjectFinancialSummary {
  projectId: string;
  contractAmount: number;
  totalContractValue: number;
  totalInvoiced: number;
  totalReceived: number;
  outstandingAmount: number;
  totalOutstanding: number;
  unbilledAmount: number;
  remainingContractBalance: number;
  // Extension & Period Breakdown
  originalHirePeriodDays?: number;
  originalRentalAmount?: number;
  originalDueDate?: string;
  extensionDays?: number;
  extensionRentalAmount?: number;
  totalRentalAmount?: number;
  hasExtension?: boolean;
  rentalPeriods?: RentalPeriod[];
  // Today's Billing Cutoff Accrual Fields
  accruedToDateAmount?: number;
  unaccruedFutureAmount?: number;
  payableOutstandingAmount?: number;
  monthlyPaymentAmount?: number;
  nextMonthRental?: number;
  accruedRentalMonths?: number;
  contractMonthsCount?: number;
  totalAccruedRental?: number;
  totalContractedRental?: number;
  isRentalAutoAccruing?: boolean;
  rentalAccrualStatus?: string;
  rentalStoppedDate?: string | null;
  paymentSchedule?: PaymentScheduleItem[];
  invoices: ProjectInvoice[];
  payments: PaymentReceipt[];
  paymentStatus: PaymentStatus;
  calculatedPaymentStatus: string;
  isOverdue: boolean;
  daysOverdue: number;
  priority: CollectionPriority;
  nextPaymentDue?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  hasMissedPromise: boolean;
}
