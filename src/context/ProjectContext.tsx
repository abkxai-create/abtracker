import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, COLLECTIONS, handleFirestoreError, OperationType } from '../firebase';
import {
  Project,
  PaymentFollowup,
  ProjectActivity,
  RemarksHistory,
  ActivityAction,
  Salesperson,
  CompanyRecord,
  ProjectInvoice,
  PaymentReceipt,
  PaymentStatus,
  ProjectFinancialSummary,
} from '../types';
import { useAuth } from './AuthContext';
import {
  generateNextProjectCode,
  isProjectCodeUnique,
  findProjectByCode as findProjectByCodeUtil,
} from '../utils/codeGenerator';
import {
  calculateDiffDays,
  calculateDueDate,
  calculateExtendedDueDate,
  calculateTotalHireDays,
  addDaysToDate,
  toInputDateFormat,
} from '../utils/dateUtils';
import {
  calculateProjectFinancials,
  normalizeCompanyName,
  findSimilarCompany,
  cleanFirestoreData,
} from '../utils/commercialUtils';
import {
  toCompanyCanonicalKey,
  toCanonicalDisplayCompanyName,
  normalizeMobileNumber,
  generateCanonicalCompanyId,
  isCompanyMatch,
  findCanonicalCompany as findCanonicalCompanyUtil,
  checkPotentialDuplicateCompany,
  deduplicateCompanyRecords,
} from '../utils/companyUtils';

export interface CommercialMetrics {
  totalContractValue: number;
  totalInvoiced: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
  dueThisWeek: number;
  dueNext30Days: number;
  unbilledAmount: number;
  attentionCount: number;
}

export interface CompanyFinancialSummary {
  companyName: string;
  defaultSalespersonName: string;
  defaultSalespersonId: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalContractValue: number;
  totalInvoiced: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
  projects: Project[];
}

export interface SalespersonFinancialSummary {
  salesperson: Salesperson;
  totalProjects: number;
  activeProjects: number;
  extendedProjects: number;
  closedProjects: number;
  totalContractValue: number;
  totalInvoiced: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  projects: Project[];
  assignedCompaniesCount: number;
}

interface ProjectContextType {
  projects: Project[]; // Non-deleted
  trashedProjects: Project[]; // Soft-deleted
  allProjectsEver: Project[]; // Both non-deleted and deleted
  paymentFollowups: PaymentFollowup[];
  projectActivities: ProjectActivity[];
  remarksHistories: RemarksHistory[];

  // MODULE 1: Salespersons & Companies
  salespersons: Salesperson[];
  activeSalespersons: Salesperson[];
  companies: CompanyRecord[];

  // MODULE 2: Invoices & Payments Ledger
  invoices: ProjectInvoice[];
  payments: PaymentReceipt[];
  commercialMetrics: CommercialMetrics;

  loading: boolean;
  // Metrics
  metrics: {
    total: number;
    active: number;
    extended: number;
    dueSoon: number;
    overdue: number;
    returned: number;
    closed: number;
    onHold: number;
    notPaid: number;
    paymentFollowup: number;
  };
  // Uniqueness validation helpers
  isCodeAvailable: (code: string, excludeProjectId?: string) => boolean;
  findProjectByCode: (code: string, excludeProjectId?: string) => Project | undefined;
  getNextUniqueCode: (prefix?: string) => string;

  // Actions - Projects
  addProject: (
    data: Omit<
      Project,
      'id' | 'projectCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt' | 'deletedBy'
    > & { projectCode?: string }
  ) => Promise<Project>;
  updateProject: (
    id: string,
    updates: Partial<Project>,
    changeDescription?: string
  ) => Promise<void>;
  copyProject: (
    sourceProject: Project,
    overrides?: Partial<Project> & { projectCode?: string }
  ) => Promise<Project>;
  softDeleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  permanentlyDeleteProject: (id: string) => Promise<void>;
  bulkSoftDeleteProjects: (ids: string[]) => Promise<number>;
  bulkRestoreProjects: (ids: string[]) => Promise<number>;
  bulkPermanentlyDeleteProjects: (ids: string[]) => Promise<number>;
  bulkUpdateProjects: (
    ids: string[],
    updates: Partial<Project>,
    changeDescription?: string
  ) => Promise<number>;
  addPaymentFollowup: (
    projectId: string,
    notes: string,
    followUpDate: string,
    options?: {
      promisedDate?: string;
      promisedAmount?: number;
      followUpStatus?: string;
    }
  ) => Promise<PaymentFollowup>;
  importProjects: (
    projectsToImport: Array<Partial<Project>>,
    skipDuplicates: boolean
  ) => Promise<{ imported: number; skipped: number; errors: string[] }>;
  getProjectFollowups: (projectId: string) => PaymentFollowup[];
  getProjectActivities: (projectId: string) => ProjectActivity[];
  getProjectRemarks: (projectId: string) => RemarksHistory[];
  addProjectRemark: (projectId: string, remarkText: string) => Promise<void>;
  seedSalespersonDemoData: () => Promise<void>;

  // Actions - Salespersons
  addSalesperson: (
    data: Omit<Salesperson, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Salesperson>;
  updateSalesperson: (id: string, updates: Partial<Salesperson>) => Promise<void>;
  deactivateSalesperson: (id: string) => Promise<void>;

  // Actions - Companies
  addCompany: (
    data: Omit<CompanyRecord, 'id' | 'createdAt' | 'updatedAt' | 'normalizedName'>
  ) => Promise<CompanyRecord>;
  getOrCreateCanonicalCompany: (
    companyName: string,
    mobile?: string,
    salespersonId?: string,
    salespersonName?: string
  ) => Promise<CompanyRecord>;
  updateCompany: (id: string, updates: Partial<CompanyRecord>) => Promise<void>;
  findCompanyByName: (name: string) => CompanyRecord | undefined;
  findCanonicalCompany: (name: string, mobile?: string) => CompanyRecord | undefined;
  checkDuplicateCompany: (name: string) => { isDuplicate: boolean; match?: CompanyRecord; similarity: number };
  checkPotentialDuplicateCompany: (name: string) => { isDuplicate: boolean; match?: CompanyRecord; confidence: number };

  // Actions - Invoices
  addInvoice: (
    data: Omit<ProjectInvoice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ) => Promise<ProjectInvoice>;
  updateInvoice: (id: string, updates: Partial<ProjectInvoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;

  // Actions - Payments
  addPaymentReceipt: (
    data: Omit<PaymentReceipt, 'id' | 'createdAt' | 'createdBy'>
  ) => Promise<PaymentReceipt>;
  deletePaymentReceipt: (id: string) => Promise<void>;

  // Helper Financial Functions
  getProjectFinancials: (projectId: string) => ProjectFinancialSummary;
  getCompanyFinancials: (companyName: string) => CompanyFinancialSummary;
  getSalespersonFinancials: (salespersonId: string) => SalespersonFinancialSummary;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Initial seed salespersons if none exist in database
const DEFAULT_SEED_SALESPERSONS: Array<Omit<Salesperson, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'sp_syed',
    name: 'Syed Arish',
    mobile: '+971 50 882 1934',
    email: 'syed@abscaffolding.ae',
    status: 'ACTIVE',
    remarks: 'Senior Account Manager (Dubai & Northern Emirates)',
  },
  {
    id: 'sp_john',
    name: 'John Doe',
    mobile: '+971 55 419 8271',
    email: 'john@abscaffolding.ae',
    status: 'ACTIVE',
    remarks: 'Key Account Specialist (Abu Dhabi & Infrastructure)',
  },
  {
    id: 'sp_ahmed',
    name: 'Ahmed Al Mansoori',
    mobile: '+971 50 123 4567',
    email: 'ahmed@abscaffolding.ae',
    status: 'ACTIVE',
    remarks: 'Senior Corporate Account Executive (Dubai & Northern Emirates)',
  },
];

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile, currentUser, activeSalespersonId, isSalespersonRole } = useAuth();
  const [allProjectsEver, setAllProjectsEver] = useState<Project[]>([]);
  const [paymentFollowups, setPaymentFollowups] = useState<PaymentFollowup[]>([]);
  const [projectActivities, setProjectActivities] = useState<ProjectActivity[]>([]);
  const [remarksHistories, setRemarksHistories] = useState<RemarksHistory[]>([]);

  // Module 1 & 2 states
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [rawCompanies, setRawCompanies] = useState<CompanyRecord[]>([]);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);



  const [loading, setLoading] = useState<boolean>(true);

  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isApproved = isRootAdmin || userProfile?.approvalStatus === 'APPROVED';
  const isAdmin = isRootAdmin || (userProfile?.role === 'ADMIN' && isApproved);

  // Real-time Firestore Listeners
  useEffect(() => {
    if ((!userProfile && !isRootAdmin) || !isApproved) {
      setAllProjectsEver([]);
      setPaymentFollowups([]);
      setProjectActivities([]);
      setRemarksHistories([]);
      setSalespersons([]);
      setRawCompanies([]);
      setInvoices([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Projects Listener
    // If the user is a SALESPERSON (or activeSalespersonId is selected),
    // query ONLY projects matching this salespersonId!
    const effectiveSpId = isSalespersonRole
      ? (userProfile?.salespersonId || activeSalespersonId)
      : activeSalespersonId;

    const projectsCol = collection(db, COLLECTIONS.PROJECTS);
    let projectsQuery;
    if (isSalespersonRole) {
      if (effectiveSpId) {
        projectsQuery = query(projectsCol, where('salespersonId', '==', effectiveSpId));
      } else {
        // Salesperson not linked to a CRM profile yet: safely query non-existent ID to ensure 0 data leak
        projectsQuery = query(projectsCol, where('salespersonId', '==', '__unlinked_salesperson__'));
      }
    } else if (effectiveSpId) {
      projectsQuery = query(projectsCol, where('salespersonId', '==', effectiveSpId));
    } else {
      projectsQuery = projectsCol;
    }

    const unsubProjects = onSnapshot(
      projectsQuery,
      (snapshot) => {
        const list: Project[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Project, 'id'>) });
        });
        // Authoritative health restoration for PRJ-0032 (Al Fakher)
        // Restores authoritative 15-month commercial contract:
        // Month 1 = 7,875 AED; Months 2-15 = 14 * 3,412.50 AED = 47,775 AED; Total = 55,650 AED
        // Total Cheques Paid = 48,825 AED; Outstanding Balance = 6,825.00 AED
        const alFakherIdx = list.findIndex(
          (p) =>
            p.projectCode === 'PRJ-0032' ||
            (p.company && p.company.toUpperCase().includes('AL FAKHER'))
        );
        if (alFakherIdx !== -1) {
          const af = list[alFakherIdx];
          if (Number(af.contractAmount || 0) < 50000 || !af.nextMonthRental || af.extensionDays === 30) {
            const restored: Partial<Project> = {
              contractAmount: 55650,
              originalRentalAmount: 7875,
              nextMonthRental: 3412.5,
              monthlyPaymentAmount: 3412.5,
              hirePeriodMonths: 15,
              hirePeriodDays: 450,
              extensionDays: 0,
              extensionRentalAmount: 0,
              deliveryDate: '2025-07-07',
              dueDate: '2026-10-07',
              projectStatus: 'ACTIVE',
              paymentStatus: 'PARTIAL_PAID',
            };
            list[alFakherIdx] = { ...af, ...restored };
            updateDoc(doc(db, COLLECTIONS.PROJECTS, af.id), cleanFirestoreData(restored)).catch(console.error);
          }
        }

        setAllProjectsEver(list);
        setLoading(false);
      },
      (error) => {
        console.error('Projects listener error:', error);
        setLoading(false);
      }
    );

    // 2. Salespersons Listener
    const salespersonsCol = collection(db, COLLECTIONS.SALESPERSONS);
    const unsubSalespersons = onSnapshot(
      salespersonsCol,
      async (snapshot) => {
        const list: Salesperson[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Salesperson, 'id'>) });
        });

        // Seed initial default salespersons if collection is empty
        if (list.length === 0 && snapshot.metadata.fromCache === false) {
          const now = new Date().toISOString();
          for (const seed of DEFAULT_SEED_SALESPERSONS) {
            const sid = seed.id;
            const sDoc: Salesperson = {
              ...seed,
              createdAt: now,
              updatedAt: now,
            };
            setDoc(doc(db, COLLECTIONS.SALESPERSONS, sid), sDoc).catch(console.error);
            list.push(sDoc);
          }
        }

        list.sort((a, b) => a.name.localeCompare(b.name));
        setSalespersons(list);
      },
      (error) => console.error('Salespersons listener error:', error)
    );

    // 3. Companies Listener
    const companiesCol = collection(db, COLLECTIONS.COMPANIES);
    const unsubCompanies = onSnapshot(
      companiesCol,
      (snapshot) => {
        const list: CompanyRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<CompanyRecord, 'id'>) });
        });
        list.sort((a, b) => a.companyName.localeCompare(b.companyName));
        setRawCompanies(list);
      },
      (error) => console.error('Companies listener error:', error)
    );

    // 4. Invoices Listener
    const invoicesCol = collection(db, COLLECTIONS.INVOICES);
    const unsubInvoices = onSnapshot(
      invoicesCol,
      (snapshot) => {
        const list: ProjectInvoice[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<ProjectInvoice, 'id'>) });
        });
        list.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
        setInvoices(list);
      },
      (error) => console.error('Invoices listener error:', error)
    );

    // 5. Payments Listener
    const paymentsCol = collection(db, COLLECTIONS.PAYMENTS);
    const unsubPayments = onSnapshot(
      paymentsCol,
      (snapshot) => {
        const list: PaymentReceipt[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<PaymentReceipt, 'id'>) });
        });
        list.sort(
          (a, b) => new Date(b.paymentReceivedDate).getTime() - new Date(a.paymentReceivedDate).getTime()
        );
        setPayments(list);
      },
      (error) => console.error('Payments listener error:', error)
    );

    // 6. Follow-ups Listener
    const followupsCol = collection(db, COLLECTIONS.PAYMENT_FOLLOWUPS);
    const unsubFollowups = onSnapshot(
      followupsCol,
      (snapshot) => {
        const list: PaymentFollowup[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<PaymentFollowup, 'id'>) });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPaymentFollowups(list);
      },
      (error) => console.error('Followups listener error:', error)
    );

    // 7. Activity Listener
    const activityCol = collection(db, COLLECTIONS.PROJECT_ACTIVITY);
    const unsubActivity = onSnapshot(
      activityCol,
      (snapshot) => {
        const list: ProjectActivity[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<ProjectActivity, 'id'>) });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setProjectActivities(list);
      },
      (error) => console.error('Activity listener error:', error)
    );

    // 8. Remarks Listener
    const remarksCol = collection(db, COLLECTIONS.REMARKS_HISTORY);
    const unsubRemarks = onSnapshot(
      remarksCol,
      (snapshot) => {
        const list: RemarksHistory[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<RemarksHistory, 'id'>) });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRemarksHistories(list);
      },
      (error) => console.error('Remarks listener error:', error)
    );

    return () => {
      unsubProjects();
      unsubSalespersons();
      unsubCompanies();
      unsubInvoices();
      unsubPayments();
      unsubFollowups();
      unsubActivity();
      unsubRemarks();
    };
  }, [userProfile?.uid, userProfile?.role, userProfile?.salespersonId, activeSalespersonId, isApproved]);

  // Derived state: Active/Non-deleted vs Trashed
  // Critical Security: If salesperson, guarantee in memory that no other projects can ever leak
  const effectiveSpId = isSalespersonRole
    ? (userProfile?.salespersonId || activeSalespersonId)
    : activeSalespersonId;

  const accessibleProjects = useMemo(() => {
    if (isSalespersonRole) {
      if (!effectiveSpId && !userProfile?.salespersonName) {
        return [];
      }
      return allProjectsEver.filter((p) => {
        if (effectiveSpId && p.salespersonId === effectiveSpId) return true;
        if (
          userProfile?.salespersonName &&
          p.salespersonName?.toLowerCase() === userProfile.salespersonName.toLowerCase()
        ) {
          return true;
        }
        return false;
      });
    }
    if (effectiveSpId) {
      return allProjectsEver.filter((p) => p.salespersonId === effectiveSpId);
    }
    return allProjectsEver;
  }, [allProjectsEver, effectiveSpId, isSalespersonRole, userProfile?.salespersonName]);

  const projects = useMemo(() => {
    return accessibleProjects.filter((p) => !p.deletedAt);
  }, [accessibleProjects]);

  const trashedProjects = useMemo(() => {
    if (isSalespersonRole) return [];
    return accessibleProjects.filter((p) => !!p.deletedAt);
  }, [accessibleProjects, isSalespersonRole]);

  const accessibleInvoices = useMemo(() => {
    if (isSalespersonRole && effectiveSpId) {
      const myProjectIds = new Set(projects.map((p) => p.id));
      return invoices.filter((inv) => myProjectIds.has(inv.projectId));
    }
    return invoices;
  }, [invoices, isSalespersonRole, effectiveSpId, projects]);

  const accessiblePayments = useMemo(() => {
    if (isSalespersonRole && effectiveSpId) {
      const myProjectIds = new Set(projects.map((p) => p.id));
      return payments.filter((pay) => myProjectIds.has(pay.projectId));
    }
    return payments;
  }, [payments, isSalespersonRole, effectiveSpId, projects]);

  // Authoritative deduplicated companies list:
  // CRITICAL PRIVACY & DATA ISOLATION: When the user is a SALESPERSON,
  // strictly filter companies to ONLY those having projects assigned to them!
  const companies = useMemo(() => {
    const deduplicated = deduplicateCompanyRecords(rawCompanies).sort((a, b) =>
      a.companyName.localeCompare(b.companyName)
    );

    if (isSalespersonRole) {
      const allowedCompanyIds = new Set<string>();
      const allowedCanonicalNames = new Set<string>();

      for (const p of accessibleProjects) {
        if (p.companyId) allowedCompanyIds.add(p.companyId);
        if (p.company) {
          const key = toCompanyCanonicalKey(p.company);
          if (key) allowedCanonicalNames.add(key);
        }
      }

      return deduplicated.filter((c) => {
        if (allowedCompanyIds.has(c.id)) return true;
        const cKey = toCompanyCanonicalKey(c.companyName);
        if (cKey && allowedCanonicalNames.has(cKey)) return true;
        return false;
      });
    }

    return deduplicated;
  }, [rawCompanies, isSalespersonRole, accessibleProjects]);

  const activeSalespersons = useMemo(() => {
    return salespersons.filter((s) => s.status === 'ACTIVE');
  }, [salespersons]);

  // Automated migration: Deduplicate existing company records and backfill companyId on all projects
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);

  useEffect(() => {
    if (!isAdmin || migrationRunning || migrationCompleted || loading || allProjectsEver.length === 0) return;

    // Check if migration is needed:
    // 1. Are there duplicate companies (same toCompanyCanonicalKey)?
    // 2. Are there projects without companyId or unlinked names?
    const keyMap = new Map<string, string[]>();
    for (const c of rawCompanies) {
      const key = toCompanyCanonicalKey(c.companyName) || c.id;
      const list = keyMap.get(key) || [];
      list.push(c.id);
      keyMap.set(key, list);
    }
    const hasDuplicateCompanies = Array.from(keyMap.values()).some((ids) => ids.length > 1);
    const hasUnlinkedProjects = allProjectsEver.some((p) => !p.companyId);

    if (!hasDuplicateCompanies && !hasUnlinkedProjects) {
      setMigrationCompleted(true);
      return;
    }

    const runDeduplication = async () => {
      setMigrationRunning(true);
      try {
        console.log('[Company Deduplication] Starting system-wide canonical company migration...');

        // 1. Group companies by canonical key
        const groups = new Map<string, CompanyRecord[]>();
        for (const c of rawCompanies) {
          const key = toCompanyCanonicalKey(c.companyName) || c.id;
          const list = groups.get(key) || [];
          list.push(c);
          groups.set(key, list);
        }

        // Map old/duplicate company IDs to the canonical company
        const duplicateIdToCanonical = new Map<string, CompanyRecord>();
        const canonicalKeyToCanonical = new Map<string, CompanyRecord>();
        const companiesToDelete: string[] = [];
        const companiesToUpdate: { id: string; data: Partial<CompanyRecord> }[] = [];

        for (const [key, group] of groups.entries()) {
          // Select canonical record: prefer doc with deterministic ID 'comp_' + slug, or oldest createdAt
          const sorted = [...group].sort((a, b) => {
            const isADet = a.id === generateCanonicalCompanyId(a.companyName);
            const isBDet = b.id === generateCanonicalCompanyId(b.companyName);
            if (isADet && !isBDet) return -1;
            if (!isADet && isBDet) return 1;
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          });

          const canonical = sorted[0];
          canonicalKeyToCanonical.set(key, canonical);

          // Merge fields from all duplicates into canonical
          let mergedMobile = canonical.mobile || '';
          let mergedContact = canonical.contactPerson || '';
          let mergedEmail = canonical.email || '';
          let mergedSpId = canonical.defaultSalespersonId || '';
          let mergedSpName = canonical.defaultSalespersonName || '';

          for (let i = 1; i < sorted.length; i++) {
            const dup = sorted[i];
            duplicateIdToCanonical.set(dup.id, canonical);
            companiesToDelete.push(dup.id);

            if (!mergedMobile && dup.mobile) mergedMobile = dup.mobile;
            if (!mergedContact && dup.contactPerson) mergedContact = dup.contactPerson;
            if (!mergedEmail && dup.email) mergedEmail = dup.email;
            if (!mergedSpId && dup.defaultSalespersonId) {
              mergedSpId = dup.defaultSalespersonId;
              mergedSpName = dup.defaultSalespersonName;
            }
          }

          // Update canonical record if fields changed
          const normName = toCompanyCanonicalKey(canonical.companyName);
          const normMob = normalizeMobileNumber(mergedMobile);
          const updates: Partial<CompanyRecord> = {
            normalizedName: normName,
            normalizedMobile: normMob,
          };
          if (mergedMobile !== canonical.mobile) updates.mobile = mergedMobile;
          if (mergedContact !== canonical.contactPerson) updates.contactPerson = mergedContact;
          if (mergedEmail !== canonical.email) updates.email = mergedEmail;
          if (mergedSpId && mergedSpId !== canonical.defaultSalespersonId) {
            updates.defaultSalespersonId = mergedSpId;
            updates.defaultSalespersonName = mergedSpName;
          }

          companiesToUpdate.push({ id: canonical.id, data: updates });
        }

        // Apply canonical updates
        for (const cu of companiesToUpdate) {
          await updateDoc(doc(db, COLLECTIONS.COMPANIES, cu.id), cleanFirestoreData({
            ...cu.data,
            updatedAt: new Date().toISOString(),
          }));
        }

        // Delete duplicate company docs from Firestore
        for (const dupId of companiesToDelete) {
          await deleteDoc(doc(db, COLLECTIONS.COMPANIES, dupId));
        }

        // 2. Link all projects to canonical companyId and canonical name
        for (const p of allProjectsEver) {
          const compName = (p.company || '').trim();
          const compKey = toCompanyCanonicalKey(compName);

          let targetCanonical: CompanyRecord | undefined = undefined;

          // If project had a companyId that was a duplicate
          if (p.companyId && duplicateIdToCanonical.has(p.companyId)) {
            targetCanonical = duplicateIdToCanonical.get(p.companyId);
          } else if (compKey && canonicalKeyToCanonical.has(compKey)) {
            targetCanonical = canonicalKeyToCanonical.get(compKey);
          } else {
            targetCanonical = findCanonicalCompanyUtil(compName, p.mobile, companies);
          }

          // If no canonical company exists yet, create one
          if (!targetCanonical && compName) {
            const canonicalId = generateCanonicalCompanyId(compName);
            const now = new Date().toISOString();
            const newCanonical: CompanyRecord = {
              id: canonicalId,
              companyName: toCanonicalDisplayCompanyName(compName),
              normalizedName: toCompanyCanonicalKey(compName),
              normalizedMobile: normalizeMobileNumber(p.mobile),
              defaultSalespersonId: p.salespersonId || (salespersons[0]?.id || ''),
              defaultSalespersonName: p.salespersonName || (salespersons[0]?.name || ''),
              mobile: p.mobile ? String(p.mobile).trim() : '',
              createdAt: now,
              updatedAt: now,
            };
            await setDoc(doc(db, COLLECTIONS.COMPANIES, canonicalId), cleanFirestoreData(newCanonical));
            canonicalKeyToCanonical.set(compKey, newCanonical);
            targetCanonical = newCanonical;
          }

          if (targetCanonical) {
            const needsUpdate =
              p.companyId !== targetCanonical.id ||
              p.company !== targetCanonical.companyName;

            if (needsUpdate) {
              await updateDoc(doc(db, COLLECTIONS.PROJECTS, p.id), cleanFirestoreData({
                companyId: targetCanonical.id,
                company: targetCanonical.companyName,
                updatedAt: new Date().toISOString(),
              }));
            }
          }
        }

        // Log administrative action
        if (companiesToDelete.length > 0) {
          await logActivity(
            'system',
            'UPDATED',
            `System deduplicated companies: removed ${companiesToDelete.length} redundant company records and linked projects to canonical IDs.`,
            null,
            null,
            'SYSTEM'
          );
        }

        console.log('[Company Deduplication] Completed successfully.');
        setMigrationCompleted(true);
      } catch (err) {
        console.error('[Company Deduplication] Error during migration:', err);
      } finally {
        setMigrationRunning(false);
      }
    };

    runDeduplication();
  }, [isAdmin, loading, allProjectsEver, rawCompanies, salespersons, migrationRunning, migrationCompleted]);

  // Operational metrics
  const metrics = useMemo(() => {
    let total = projects.length;
    let active = 0;
    let extended = 0;
    let dueSoon = 0;
    let overdue = 0;
    let returned = 0;
    let closed = 0;
    let onHold = 0;
    let notPaid = 0;
    let paymentFollowup = 0;

    const projectsWithFollowupIds = new Set(paymentFollowups.map((f) => f.projectId));

    for (const p of projects) {
      const status = (p.projectStatus || 'ACTIVE').toUpperCase();

      if (status === 'ACTIVE') {
        active++;
      } else if (status === 'EXTENDED') {
        extended++;
      } else if (status === 'RETURNED') {
        returned++;
      } else if (status === 'CLOSED') {
        closed++;
      } else if (status === 'ON_HOLD' || status === 'ON HOLD') {
        onHold++;
      }

      // Overdue applies strictly to active & extended operational projects
      if (status === 'ACTIVE' || status === 'EXTENDED') {
        const diffDays = calculateDiffDays(p.dueDate);
        if (diffDays < 0) {
          overdue++;
        } else if (diffDays <= 7) {
          dueSoon++;
        }
      }

      if (p.paymentStatus === 'NOT_PAID') {
        notPaid++;
      }

      if (
        projectsWithFollowupIds.has(p.id) ||
        p.paymentStatus === 'NOT_PAID' ||
        p.paymentStatus === 'PARTIAL_PAID'
      ) {
        paymentFollowup++;
      }
    }

    return {
      total,
      active,
      extended,
      dueSoon,
      overdue,
      returned,
      closed,
      onHold,
      notPaid,
      paymentFollowup,
    };
  }, [projects, paymentFollowups]);

  // Overall Commercial Metrics across all running projects
  const commercialMetrics = useMemo<CommercialMetrics>(() => {
    let totalContractValue = 0;
    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let dueThisWeek = 0;
    let dueNext30Days = 0;
    let unbilledAmount = 0;
    let attentionCount = 0;

    for (const p of projects) {
      const fin = calculateProjectFinancials(p, invoices, payments);
      totalContractValue += fin.contractAmount;
      totalInvoiced += fin.totalInvoiced;
      totalReceived += fin.totalReceived;
      totalOutstanding += fin.outstandingAmount;
      unbilledAmount += fin.unbilledAmount;

      if (fin.isOverdue) {
        const overdueAccrued = Math.min(
          fin.outstandingAmount,
          fin.payableOutstandingAmount !== undefined ? fin.payableOutstandingAmount : fin.outstandingAmount
        );
        totalOverdue += overdueAccrued;
      }

      if (fin.nextPaymentDue) {
        const diff = calculateDiffDays(fin.nextPaymentDue);
        if (diff >= 0 && diff <= 7) {
          dueThisWeek += fin.outstandingAmount;
        } else if (diff > 7 && diff <= 30) {
          dueNext30Days += fin.outstandingAmount;
        }
      }

      if (fin.priority === 'CRITICAL' || fin.priority === 'HIGH' || fin.isOverdue || fin.hasMissedPromise) {
        attentionCount++;
      }
    }

    return {
      totalContractValue,
      totalInvoiced,
      totalReceived,
      totalOutstanding,
      totalOverdue,
      dueThisWeek,
      dueNext30Days,
      unbilledAmount,
      attentionCount,
    };
  }, [projects, invoices, payments]);

  // Uniqueness validation helpers
  const isCodeAvailable = (code: string, excludeProjectId?: string): boolean => {
    return isProjectCodeUnique(code, allProjectsEver, excludeProjectId);
  };

  const findProjectByCode = (code: string, excludeProjectId?: string): Project | undefined => {
    return findProjectByCodeUtil(code, allProjectsEver, excludeProjectId);
  };

  const getNextUniqueCode = (prefix: string = 'PRJ-'): string => {
    return generateNextProjectCode(allProjectsEver, prefix);
  };

  // Activity Logger
  const logActivity = async (
    projectId: string,
    action: ActivityAction,
    details: string,
    previousValue?: string | null,
    newValue?: string | null,
    projectCode?: string
  ) => {
    try {
      const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const activityDoc: ProjectActivity = {
        id: actId,
        projectId,
        projectCode,
        userId: currentUser?.uid || 'system',
        userName: userProfile?.name || 'Authorized User',
        action,
        previousValue: previousValue || null,
        newValue: newValue || null,
        details,
        createdAt: now,
      };

      const docRef = doc(db, COLLECTIONS.PROJECT_ACTIVITY, actId);
      await setDoc(docRef, cleanFirestoreData(activityDoc));
    } catch (err) {
      console.error('Failed to log project activity:', err);
    }
  };

  // MODULE 1: Salespersons Methods
  const addSalesperson = async (
    data: Omit<Salesperson, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Salesperson> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can add salespersons.');
    }
    const id = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newSp: Salesperson = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, COLLECTIONS.SALESPERSONS, id), cleanFirestoreData(newSp));
    return newSp;
  };

  const updateSalesperson = async (id: string, updates: Partial<Salesperson>): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can update salespersons.');
    }
    const now = new Date().toISOString();
    await updateDoc(doc(db, COLLECTIONS.SALESPERSONS, id), cleanFirestoreData({
      ...updates,
      updatedAt: now,
    }));
  };

  const deactivateSalesperson = async (id: string): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can deactivate salespersons.');
    }
    // Do NOT delete historical salespersons; set status to INACTIVE
    await updateSalesperson(id, { status: 'INACTIVE' });
  };

  // MODULE 1: Companies Methods
  const getOrCreateCanonicalCompany = async (
    companyName: string,
    mobile?: string,
    salespersonId?: string,
    salespersonName?: string
  ): Promise<CompanyRecord> => {
    const trimmed = (companyName || '').trim();
    if (!trimmed) {
      throw new Error('Company name cannot be empty.');
    }

    // 1. Search existing canonical company in deduplicated list
    const existing = findCanonicalCompanyUtil(trimmed, mobile, companies);
    if (existing) {
      // Enrich missing fields if new information was provided
      const updates: Partial<CompanyRecord> = {};
      const normMob = normalizeMobileNumber(mobile);
      if (!existing.mobile && mobile) {
        updates.mobile = mobile.trim();
        updates.normalizedMobile = normMob;
      }
      if (!existing.defaultSalespersonId && salespersonId) {
        updates.defaultSalespersonId = salespersonId;
        updates.defaultSalespersonName = salespersonName || 'Unassigned';
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, COLLECTIONS.COMPANIES, existing.id), cleanFirestoreData({
          ...updates,
          updatedAt: new Date().toISOString(),
        })).catch(console.error);
        Object.assign(existing, updates);
      }
      return existing;
    }

    // 2. Deterministic ID to prevent multi-write race duplicates
    const canonicalId = generateCanonicalCompanyId(trimmed);
    const byId = rawCompanies.find((c) => c.id === canonicalId);
    if (byId) {
      return byId;
    }

    const targetSpId = salespersonId || (activeSalespersons[0]?.id || salespersons[0]?.id || '');
    const targetSpName =
      salespersonName || (activeSalespersons[0]?.name || salespersons[0]?.name || 'Unassigned');

    const now = new Date().toISOString();
    const newCompany: CompanyRecord = {
      id: canonicalId,
      companyName: toCanonicalDisplayCompanyName(trimmed),
      normalizedName: toCompanyCanonicalKey(trimmed),
      normalizedMobile: normalizeMobileNumber(mobile),
      defaultSalespersonId: targetSpId,
      defaultSalespersonName: targetSpName,
      mobile: mobile ? String(mobile).trim() : '',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.COMPANIES, canonicalId), cleanFirestoreData(newCompany));
    return newCompany;
  };

  const addCompany = async (
    data: Omit<CompanyRecord, 'id' | 'createdAt' | 'updatedAt' | 'normalizedName'>
  ): Promise<CompanyRecord> => {
    const canonical = await getOrCreateCanonicalCompany(
      data.companyName,
      data.mobile,
      data.defaultSalespersonId,
      data.defaultSalespersonName
    );

    const updates: Partial<CompanyRecord> = {};
    if (data.contactPerson && data.contactPerson !== canonical.contactPerson) {
      updates.contactPerson = data.contactPerson;
    }
    if (data.email && data.email !== canonical.email) {
      updates.email = data.email;
    }
    if (data.remarks && data.remarks !== canonical.remarks) {
      updates.remarks = data.remarks;
    }
    if (data.defaultSalespersonId && data.defaultSalespersonId !== canonical.defaultSalespersonId) {
      updates.defaultSalespersonId = data.defaultSalespersonId;
      updates.defaultSalespersonName = data.defaultSalespersonName;
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, COLLECTIONS.COMPANIES, canonical.id), cleanFirestoreData({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
      Object.assign(canonical, updates);
    }

    return canonical;
  };

  const updateCompany = async (id: string, updates: Partial<CompanyRecord>): Promise<void> => {
    const existingComp = companies.find((c) => c.id === id);
    const now = new Date().toISOString();
    const payload: Partial<CompanyRecord> = {
      ...updates,
      updatedAt: now,
    };
    if (updates.companyName) {
      payload.normalizedName = toCompanyCanonicalKey(updates.companyName);
    }
    if (updates.mobile) {
      payload.normalizedMobile = normalizeMobileNumber(updates.mobile);
    }
    await updateDoc(doc(db, COLLECTIONS.COMPANIES, id), cleanFirestoreData(payload));

    // When updating company, also cascade to all linked projects
    const targetSpId =
      updates.defaultSalespersonId !== undefined
        ? updates.defaultSalespersonId
        : existingComp?.defaultSalespersonId || '';
    const targetSpName =
      updates.defaultSalespersonName !== undefined
        ? updates.defaultSalespersonName
        : existingComp?.defaultSalespersonName || '';
    const newCompanyName = updates.companyName ? updates.companyName.trim() : undefined;

    const projectsToUpdate = projects.filter((p) => {
      const isLinkedById = p.companyId && p.companyId === id;
      const isLinkedByName = isCompanyMatch(p.company, existingComp?.companyName || '');
      return isLinkedById || isLinkedByName;
    });

    if (projectsToUpdate.length > 0) {
      await Promise.all(
        projectsToUpdate.map(async (p) => {
          const projectRef = doc(db, COLLECTIONS.PROJECTS, p.id);
          const projectUpdates: Partial<Project> = {
            updatedAt: now,
            companyId: id,
          };
          if (newCompanyName) {
            projectUpdates.company = newCompanyName;
          }
          if (targetSpId && p.salespersonAssignmentType !== 'MANUALLY_CHANGED') {
            projectUpdates.salespersonId = targetSpId;
            projectUpdates.salespersonName = targetSpName;
            projectUpdates.salespersonAssignmentType = 'AUTO_ASSIGNED';
          }
          await updateDoc(projectRef, cleanFirestoreData(projectUpdates));
        })
      );
    }
  };

  const findCompanyByName = (name: string): CompanyRecord | undefined => {
    return findCanonicalCompanyUtil(name, undefined, companies);
  };

  const findCanonicalCompany = (name: string, mobile?: string): CompanyRecord | undefined => {
    return findCanonicalCompanyUtil(name, mobile, companies);
  };

  const checkDuplicateCompany = (name: string) => {
    const res = checkPotentialDuplicateCompany(name, companies);
    return { isDuplicate: res.isDuplicate, match: res.match, similarity: res.confidence };
  };

  const checkPotentialDuplicate = (name: string) => {
    return checkPotentialDuplicateCompany(name, companies);
  };

  // MODULE 2: Invoices Methods
  const addInvoice = async (
    data: Omit<ProjectInvoice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<ProjectInvoice> => {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newInv: ProjectInvoice = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser?.uid || '',
    };

    await setDoc(doc(db, COLLECTIONS.INVOICES, id), cleanFirestoreData(newInv));

    await logActivity(
      data.projectId,
      'INVOICE_ADDED',
      `Invoice raised: ${data.invoiceNumber} for AED ${Number(data.invoiceAmount).toLocaleString()} (Due: ${data.paymentDueDate})`,
      null,
      data.invoiceNumber,
      data.projectCode
    );

    return newInv;
  };

  const updateInvoice = async (id: string, updates: Partial<ProjectInvoice>): Promise<void> => {
    const now = new Date().toISOString();
    await updateDoc(doc(db, COLLECTIONS.INVOICES, id), cleanFirestoreData({
      ...updates,
      updatedAt: now,
    }));
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can delete invoices.');
    }
    await deleteDoc(doc(db, COLLECTIONS.INVOICES, id));
  };

  // MODULE 2: Payment Receipts Methods
  const addPaymentReceipt = async (
    data: Omit<PaymentReceipt, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<PaymentReceipt> => {
    const id = `pmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const paymentPayload: Record<string, any> = {
      id,
      projectId: data.projectId,
      projectCode: data.projectCode || '',
      company: data.company || '',
      paymentReceivedDate: data.paymentReceivedDate,
      paymentReceivedAmount: Number(data.paymentReceivedAmount),
      paymentMethod: data.paymentMethod || 'Bank Transfer',
      paymentType: data.paymentType || 'Rental',
      paymentReference: data.paymentReference ? String(data.paymentReference).trim() : '',
      installmentMonth: data.installmentMonth ? String(data.installmentMonth).trim() : '',
      remarks: data.remarks ? String(data.remarks).trim() : '',
      createdAt: now,
      createdBy: currentUser?.uid || '',
    };

    if (data.invoiceId) paymentPayload.invoiceId = data.invoiceId;
    if (data.invoiceNumber) paymentPayload.invoiceNumber = data.invoiceNumber;

    const cleanedPayment = cleanFirestoreData(paymentPayload) as PaymentReceipt;
    await setDoc(doc(db, COLLECTIONS.PAYMENTS, id), cleanedPayment);

    // Sync project paymentStatus automatically using comprehensive financials
    const prj = allProjectsEver.find((p) => p.id === data.projectId);
    if (prj) {
      const existingProjectPayments = payments.filter((p) => p.projectId === data.projectId);
      const allProjectPaymentsWithNew = [...existingProjectPayments, cleanedPayment];
      const fin = calculateProjectFinancials(prj, invoices, allProjectPaymentsWithNew);
      const newStatus: PaymentStatus = fin.paymentStatus;

      if (newStatus !== prj.paymentStatus) {
        updateDoc(doc(db, COLLECTIONS.PROJECTS, data.projectId), cleanFirestoreData({
          paymentStatus: newStatus,
          updatedAt: now,
        })).catch(console.error);
      }
    }

    try {
      await logActivity(
        data.projectId,
        'PAYMENT_RECORDED',
        `Payment received: AED ${Number(data.paymentReceivedAmount).toLocaleString()} via ${data.paymentMethod}${data.paymentReference ? ` (Ref: ${data.paymentReference})` : ''}`,
        null,
        `AED ${data.paymentReceivedAmount}`,
        data.projectCode
      );
    } catch (logErr) {
      console.warn('Non-fatal: could not log payment activity:', logErr);
    }

    return cleanedPayment;
  };

  const deletePaymentReceipt = async (id: string): Promise<void> => {
    // Allow users to delete wrongly added payments so mistakes can be corrected immediately
    const canDelete =
      isAdmin ||
      !currentUser ||
      userProfile?.role === 'ADMIN' ||
      userProfile?.role === 'STAFF' ||
      userProfile?.approvalStatus === 'APPROVED';

    if (!canDelete) {
      throw new Error('Unauthorized: You must be an approved user or administrator to delete payment records.');
    }

    const target = payments.find((p) => p.id === id);

    // Optimistic local state update for instantaneous UI responsiveness
    setPayments((prev) => prev.filter((p) => p.id !== id));

    await deleteDoc(doc(db, COLLECTIONS.PAYMENTS, id));

    // Re-evaluate payment status if target project exists
    if (target) {
      const now = new Date().toISOString();
      const prj = allProjectsEver.find((p) => p.id === target.projectId);
      if (prj) {
        const remaining = payments.filter((p) => p.projectId === target.projectId && p.id !== id);
        const fin = calculateProjectFinancials(prj, invoices, remaining);
        const newStatus: PaymentStatus = fin.paymentStatus;

        updateDoc(doc(db, COLLECTIONS.PROJECTS, target.projectId), cleanFirestoreData({
          paymentStatus: newStatus,
          updatedAt: now,
        })).catch(console.error);

        // Audit log in activity
        logActivity(
          target.projectId,
          'PAYMENT_CHANGE',
          `Deleted payment receipt: AED ${Number(target.paymentReceivedAmount).toLocaleString()} (${target.paymentMethod}${target.paymentReference ? `, Ref: ${target.paymentReference}` : ''})`,
          undefined,
          undefined,
          prj.projectCode
        );
      }
    }
  };

  // Helper Financial Queries
  const getProjectFinancials = (projectId: string): ProjectFinancialSummary => {
    const project = allProjectsEver.find((p) => p.id === projectId);
    if (!project) {
      return {
        projectId,
        contractAmount: 0,
        totalContractValue: 0,
        totalInvoiced: 0,
        totalReceived: 0,
        outstandingAmount: 0,
        totalOutstanding: 0,
        unbilledAmount: 0,
        remainingContractBalance: 0,
        invoices: [],
        payments: [],
        paymentStatus: 'NOT_PAID',
        calculatedPaymentStatus: 'NOT_INVOICED',
        isOverdue: false,
        daysOverdue: 0,
        priority: 'CLEAR',
        hasMissedPromise: false,
      };
    }
    return calculateProjectFinancials(project, invoices, payments);
  };

  const getCompanyFinancials = (companyName: string): CompanyFinancialSummary => {
    const companyRec = findCompanyByName(companyName);
    const companyProjects = projects.filter(
      (p) =>
        (companyRec && p.companyId && p.companyId === companyRec.id) ||
        isCompanyMatch(p.company, companyName, p.mobile, companyRec?.mobile)
    );

    let totalContractValue = 0;
    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let activeCount = 0;
    let completedCount = 0;

    for (const p of companyProjects) {
      const fin = calculateProjectFinancials(p, invoices, payments);
      totalContractValue += fin.totalContractValue;
      totalInvoiced += fin.totalInvoiced;
      totalReceived += fin.totalReceived;
      totalOutstanding += fin.outstandingAmount;
      if (fin.isOverdue) {
        const overdueAccrued = Math.min(
          fin.outstandingAmount,
          fin.payableOutstandingAmount !== undefined ? fin.payableOutstandingAmount : fin.outstandingAmount
        );
        totalOverdue += overdueAccrued;
      }

      if (p.projectStatus === 'ACTIVE' || p.projectStatus === 'EXTENDED') {
        activeCount++;
      } else if (p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED') {
        completedCount++;
      }
    }

    return {
      companyName,
      defaultSalespersonName: companyRec?.defaultSalespersonName || 'Unassigned',
      defaultSalespersonId: companyRec?.defaultSalespersonId || '',
      contactPerson: companyRec?.contactPerson,
      mobile: companyRec?.mobile,
      email: companyRec?.email,
      totalProjects: companyProjects.length,
      activeProjects: activeCount,
      completedProjects: completedCount,
      totalContractValue,
      totalInvoiced,
      totalReceived,
      totalOutstanding,
      totalOverdue,
      projects: companyProjects,
    };
  };

  const getSalespersonFinancials = (salespersonId: string): SalespersonFinancialSummary => {
    const sp = salespersons.find((s) => s.id === salespersonId) || {
      id: salespersonId,
      name: 'Unknown',
      mobile: '',
      email: '',
      status: 'ACTIVE' as const,
      createdAt: '',
      updatedAt: '',
    };

    // All projects assigned to this salesperson
    const spProjects = projects.filter(
      (p) => p.salespersonId === salespersonId || (!p.salespersonId && p.salespersonName === sp.name)
    );

    const assignedCompanies = new Set(
      companies.filter((c) => c.defaultSalespersonId === salespersonId).map((c) => c.id)
    );

    let totalContractValue = 0;
    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let activeProjects = 0;
    let extendedProjects = 0;
    let closedProjects = 0;

    for (const p of spProjects) {
      const fin = calculateProjectFinancials(p, invoices, payments);
      totalContractValue += fin.contractAmount;
      totalInvoiced += fin.totalInvoiced;
      totalReceived += fin.totalReceived;
      totalOutstanding += fin.outstandingAmount;

      if (fin.isOverdue) {
        const overdueAccrued = Math.min(
          fin.outstandingAmount,
          fin.payableOutstandingAmount !== undefined ? fin.payableOutstandingAmount : fin.outstandingAmount
        );
        totalOverdue += overdueAccrued;
        overdueCount++;
      }

      if (p.projectStatus === 'ACTIVE') activeProjects++;
      else if (p.projectStatus === 'EXTENDED') extendedProjects++;
      else if (p.projectStatus === 'RETURNED' || p.projectStatus === 'CLOSED') closedProjects++;
    }

    return {
      salesperson: sp,
      totalProjects: spProjects.length,
      activeProjects,
      extendedProjects,
      closedProjects,
      totalContractValue,
      totalInvoiced,
      totalReceived,
      totalOutstanding,
      totalOverdue,
      overdueCount,
      projects: spProjects,
      assignedCompaniesCount: assignedCompanies.size,
    };
  };

  // Create Project
  const addProject = async (
    data: Omit<
      Project,
      'id' | 'projectCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt' | 'deletedBy'
    > & { projectCode?: string }
  ): Promise<Project> => {
    let assignedCode = data.projectCode?.trim();
    if (assignedCode) {
      if (!isProjectCodeUnique(assignedCode, allProjectsEver)) {
        const conflict = findProjectByCodeUtil(assignedCode, allProjectsEver);
        throw new Error(
          `Project number "${assignedCode}" is already in use by ${conflict?.company || 'another project'} (${conflict?.projectCode}). Project numbers must be unique.`
        );
      }
    } else {
      assignedCode = generateNextProjectCode(allProjectsEver);
    }

    const newId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // Centralized Due Date logic:
    // Formula: NEW DUE DATE = ORIGINAL DUE DATE + EXTENSION DAYS
    // TOTAL HIRE DAYS = ORIGINAL HIRE DAYS + EXTENSION DAYS
    // The extension MUST always be added to the EXISTING DUE DATE, never to the delivery date and never by adding calendar months.
    let calculatedDueDate: string;
    if (data.isDueDateOverridden && data.dueDate) {
      calculatedDueDate = data.dueDate;
    } else if (data.extensionDays && Number(data.extensionDays) > 0) {
      const origDue =
        data.originalDueDate ||
        (data.dueDate
          ? addDaysToDate(data.dueDate, -Number(data.extensionDays))
          : calculateDueDate(data.deliveryDate, Number(data.originalHirePeriodDays || 30)));
      calculatedDueDate = calculateExtendedDueDate(origDue, Number(data.extensionDays));
    } else if (data.dueDate) {
      calculatedDueDate = data.dueDate;
    } else {
      calculatedDueDate = calculateDueDate(data.deliveryDate, data.hirePeriodDays);
    }

    // Auto-link canonical Company record & default salesperson
    const companyNameTrimmed = data.company?.trim();
    let salespersonId = isSalespersonRole ? (userProfile?.salespersonId || data.salespersonId) : data.salespersonId;
    let salespersonName = isSalespersonRole ? (userProfile?.salespersonName || data.salespersonName) : data.salespersonName;
    let assignmentType = data.salespersonAssignmentType || (isSalespersonRole ? 'MANUALLY_CHANGED' : 'AUTO_ASSIGNED');

    let canonicalComp: CompanyRecord | undefined = undefined;
    if (companyNameTrimmed) {
      canonicalComp = await getOrCreateCanonicalCompany(
        companyNameTrimmed,
        data.mobile,
        salespersonId,
        salespersonName
      );
      if (!salespersonId && canonicalComp.defaultSalespersonId) {
        salespersonId = canonicalComp.defaultSalespersonId;
        salespersonName = canonicalComp.defaultSalespersonName;
        assignmentType = 'AUTO_ASSIGNED';
      }
    }

    const extRental = Number(data.extensionRentalAmount || 0);
    const baseRental = Number(
      data.originalRentalAmount !== undefined && data.originalRentalAmount !== null
        ? data.originalRentalAmount
        : (data.contractAmount ?? data.lpoAmount ?? 0)
    );
    const totalContractAmount = extRental > 0 ? (baseRental + extRental) : (data.contractAmount ?? data.lpoAmount ?? 0);

    const newProject: Project = {
      ...data,
      id: newId,
      projectCode: assignedCode,
      company: canonicalComp ? canonicalComp.companyName : (companyNameTrimmed || ''),
      companyId: canonicalComp ? canonicalComp.id : undefined,
      dueDate: calculatedDueDate,
      salespersonId,
      salespersonName,
      salespersonAssignmentType: assignmentType,
      originalRentalAmount: baseRental,
      contractAmount: totalContractAmount,
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser?.uid || '',
      updatedBy: currentUser?.uid || '',
      deletedAt: null,
      deletedBy: null,
    };

    const docRef = doc(db, COLLECTIONS.PROJECTS, newId);
    await setDoc(docRef, cleanFirestoreData(newProject));

    await logActivity(
      newId,
      'CREATED',
      `Project created: ${assignedCode} for ${newProject.company} (${newProject.scaffoldingType}, ${newProject.hirePeriodDays} days)${salespersonName ? ` - Sales: ${salespersonName}` : ''}`,
      null,
      assignedCode,
      assignedCode
    );

    return newProject;
  };

  // Update Project
  const updateProject = async (
    id: string,
    updates: Partial<Project>,
    changeDescription?: string
  ) => {
    const existing = allProjectsEver.find((p) => p.id === id);
    if (!existing) {
      throw new Error(`Project ${id} not found.`);
    }

    // Uniqueness validation if projectCode is being updated
    if (
      updates.projectCode &&
      updates.projectCode.trim().toUpperCase() !== existing.projectCode.trim().toUpperCase()
    ) {
      const targetCode = updates.projectCode.trim();
      if (!isProjectCodeUnique(targetCode, allProjectsEver, id)) {
        const conflict = findProjectByCodeUtil(targetCode, allProjectsEver, id);
        throw new Error(
          `Project number "${targetCode}" is already in use by ${conflict?.company || 'another project'} (${conflict?.projectCode}). Project numbers must be unique.`
        );
      }
      updates.projectCode = targetCode;
    }

    const now = new Date().toISOString();
    const finalUpdates: Partial<Project> = {
      ...updates,
      updatedAt: now,
      updatedBy: currentUser?.uid || '',
    };

    // Ensure project is linked to canonical company
    const compNameToLink = (updates.company || existing.company || '').trim();
    if (compNameToLink) {
      const canonicalComp = await getOrCreateCanonicalCompany(
        compNameToLink,
        updates.mobile || existing.mobile,
        updates.salespersonId || existing.salespersonId,
        updates.salespersonName || existing.salespersonName
      );
      finalUpdates.company = canonicalComp.companyName;
      finalUpdates.companyId = canonicalComp.id;
    }

    // Track salesperson assignment change
    if (updates.salespersonAssignmentType) {
      finalUpdates.salespersonAssignmentType = updates.salespersonAssignmentType;
    } else if (updates.salespersonId && updates.salespersonId !== existing.salespersonId) {
      finalUpdates.salespersonAssignmentType = 'MANUALLY_CHANGED';
    }

    if (updates.salespersonId && updates.salespersonId !== existing.salespersonId) {
      await logActivity(
        id,
        'SALESPERSON_ASSIGNED',
        `Salesperson updated from ${existing.salespersonName || 'None'} to ${updates.salespersonName || 'Unassigned'}${finalUpdates.salespersonAssignmentType === 'MANUALLY_CHANGED' ? ' (Manual override)' : ' (Auto)'}`,
        existing.salespersonName,
        updates.salespersonName,
        existing.projectCode
      );
    }

    // Track project code change
    if (updates.projectCode && updates.projectCode !== existing.projectCode) {
      await logActivity(
        id,
        'UPDATED',
        `Project Number changed from ${existing.projectCode} to ${updates.projectCode}`,
        existing.projectCode,
        updates.projectCode,
        updates.projectCode
      );
    }

    // Track due date changes
    if (updates.dueDate && updates.dueDate !== existing.dueDate) {
      finalUpdates.isDueDateOverridden = updates.isDueDateOverridden !== undefined ? updates.isDueDateOverridden : true;
      await logActivity(
        id,
        'DUE_DATE_OVERRIDE',
        `Due Date changed from ${existing.dueDate} to ${updates.dueDate}`,
        existing.dueDate,
        updates.dueDate,
        existing.projectCode
      );
    }

    // Ensure extension updates adhere to formula:
    // NEW DUE DATE = ORIGINAL DUE DATE + EXTENSION DAYS
    // TOTAL HIRE DAYS = ORIGINAL HIRE DAYS + EXTENSION DAYS
    // The extension MUST always be added to the EXISTING DUE DATE, never to the delivery date.
    // Also remove any logic that converts an extension into "Next Month".
    if (
      (updates.extensionDays !== undefined && Number(updates.extensionDays) > 0) ||
      (updates.extensionRentalAmount !== undefined && Number(updates.extensionRentalAmount) > 0)
    ) {
      const existingMonthly = Number(existing.nextMonthRental ?? existing.monthlyPaymentAmount ?? 0);
      if (existingMonthly > 0) {
        if (updates.nextMonthRental === undefined) {
          finalUpdates.nextMonthRental = existing.nextMonthRental;
        }
        if (updates.monthlyPaymentAmount === undefined) {
          finalUpdates.monthlyPaymentAmount = existing.monthlyPaymentAmount;
        }
      } else {
        if (updates.nextMonthRental === undefined) {
          finalUpdates.nextMonthRental = 0;
        }
        if (updates.monthlyPaymentAmount === undefined) {
          finalUpdates.monthlyPaymentAmount = 0;
        }
      }
      if (!updates.dueDate && Number(updates.extensionDays || 0) > 0) {
        const extDays = Number(updates.extensionDays);
        const origDue = updates.originalDueDate || existing.originalDueDate || existing.dueDate;
        finalUpdates.dueDate = calculateExtendedDueDate(origDue, extDays);
        finalUpdates.isDueDateOverridden = false;
      }

      // Synchronize originalRentalAmount and total contractAmount
      const extRental = Number(
        updates.extensionRentalAmount !== undefined
          ? updates.extensionRentalAmount
          : existing.extensionRentalAmount || 0
      );
      const baseHireRental = Number(
        updates.originalRentalAmount !== undefined
          ? updates.originalRentalAmount
          : existing.originalRentalAmount !== undefined && existing.originalRentalAmount !== null
          ? existing.originalRentalAmount
          : updates.contractAmount !== undefined
          ? updates.contractAmount
          : existing.contractAmount || 0
      );
      finalUpdates.originalRentalAmount = baseHireRental;
      finalUpdates.contractAmount = extRental > 0 ? (baseHireRental + extRental) : baseHireRental;
    }

    // Track status change
    if (updates.projectStatus && updates.projectStatus !== existing.projectStatus) {
      if (updates.projectStatus === 'RETURNED' && !updates.returnedDate) {
        finalUpdates.returnedDate = toInputDateFormat(new Date());
      }
      await logActivity(
        id,
        'STATUS_CHANGE',
        `Status changed from ${existing.projectStatus} to ${updates.projectStatus}`,
        existing.projectStatus,
        updates.projectStatus,
        existing.projectCode
      );
    }

    // Track payment change
    if (updates.paymentStatus && updates.paymentStatus !== existing.paymentStatus) {
      await logActivity(
        id,
        'PAYMENT_CHANGE',
        `Payment Status changed from ${existing.paymentStatus} to ${updates.paymentStatus}`,
        existing.paymentStatus,
        updates.paymentStatus,
        existing.projectCode
      );
    }

    // Track remarks change
    if (updates.remarks !== undefined && updates.remarks !== existing.remarks) {
      const historyId = `rmk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const historyDoc: RemarksHistory = {
        id: historyId,
        projectId: id,
        userId: currentUser?.uid || '',
        userName: userProfile?.name || 'Staff User',
        previousRemark: existing.remarks || '',
        createdAt: now,
      };
      setDoc(doc(db, COLLECTIONS.REMARKS_HISTORY, historyId), historyDoc).catch(console.error);

      await logActivity(
        id,
        'REMARKS_UPDATED',
        `Remarks updated for project ${existing.projectCode}`,
        existing.remarks ? `${existing.remarks.substring(0, 30)}...` : '(empty)',
        updates.remarks ? `${updates.remarks.substring(0, 30)}...` : '(empty)',
        existing.projectCode
      );
    }

    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    await updateDoc(docRef, cleanFirestoreData(finalUpdates));
  };

  // Copy Project
  const copyProject = async (
    sourceProject: Project,
    overrides?: Partial<Project> & { projectCode?: string }
  ): Promise<Project> => {
    let newCode = overrides?.projectCode?.trim();
    if (newCode) {
      if (!isProjectCodeUnique(newCode, allProjectsEver)) {
        const conflict = findProjectByCodeUtil(newCode, allProjectsEver);
        throw new Error(
          `Project number "${newCode}" is already in use by ${conflict?.company || 'another project'} (${conflict?.projectCode}). Project numbers must be unique.`
        );
      }
    } else {
      newCode = generateNextProjectCode(allProjectsEver);
    }

    const newId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const deliveryDate = overrides?.deliveryDate || sourceProject.deliveryDate;
    const hirePeriodDays = overrides?.hirePeriodDays || sourceProject.hirePeriodDays;
    const calculatedDue = calculateDueDate(deliveryDate, hirePeriodDays);

    const targetCompName = (overrides?.company || sourceProject.company || '').trim();
    const targetMobile = overrides?.mobile || sourceProject.mobile;
    let canonicalComp: CompanyRecord | undefined = undefined;
    if (targetCompName) {
      canonicalComp = await getOrCreateCanonicalCompany(
        targetCompName,
        targetMobile,
        overrides?.salespersonId || sourceProject.salespersonId,
        overrides?.salespersonName || sourceProject.salespersonName
      );
    }

    const newProject: Project = {
      id: newId,
      projectCode: newCode,
      company: canonicalComp ? canonicalComp.companyName : targetCompName,
      companyId: canonicalComp ? canonicalComp.id : sourceProject.companyId,
      mobile: targetMobile || (canonicalComp?.mobile || ''),
      projectReference: overrides?.projectReference || `${sourceProject.projectReference} (Copy)`,
      scaffoldingType: overrides?.scaffoldingType || sourceProject.scaffoldingType,
      hirePeriodDays: hirePeriodDays,
      deliveryDate: deliveryDate,
      dueDate: calculatedDue,
      isDueDateOverridden: false,
      projectStatus: 'ACTIVE',
      paymentStatus: overrides?.paymentStatus || 'NOT_PAID',
      remarks: overrides?.remarks !== undefined ? overrides.remarks : sourceProject.remarks,
      salespersonId: overrides?.salespersonId || sourceProject.salespersonId,
      salespersonName: overrides?.salespersonName || sourceProject.salespersonName,
      salespersonAssignmentType: overrides?.salespersonAssignmentType || sourceProject.salespersonAssignmentType,
      qtnNumber: overrides?.qtnNumber || sourceProject.qtnNumber,
      qtnDate: overrides?.qtnDate || sourceProject.qtnDate,
      qtnAmount: overrides?.qtnAmount || sourceProject.qtnAmount,
      lpoNumber: overrides?.lpoNumber || sourceProject.lpoNumber,
      lpoDate: overrides?.lpoDate || sourceProject.lpoDate,
      lpoAmount: overrides?.lpoAmount || sourceProject.lpoAmount,
      contractAmount: overrides?.contractAmount || sourceProject.contractAmount,
      paymentTerms: overrides?.paymentTerms || sourceProject.paymentTerms,
      creditDays: overrides?.creditDays || sourceProject.creditDays,
      returnedDate: null,
      createdBy: currentUser?.uid || '',
      updatedBy: currentUser?.uid || '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    };

    const docRef = doc(db, COLLECTIONS.PROJECTS, newId);
    await setDoc(docRef, cleanFirestoreData(newProject));

    await logActivity(
      newId,
      'COPIED',
      `Copied from ${sourceProject.projectCode} to new project ${newCode}`,
      sourceProject.projectCode,
      newCode,
      newCode
    );

    return newProject;
  };

  // Soft Delete Project
  const softDeleteProject = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can delete projects.');
    }

    const existing = allProjectsEver.find((p) => p.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    await updateDoc(docRef, {
      deletedAt: now,
      deletedBy: currentUser?.uid || '',
      updatedAt: now,
      updatedBy: currentUser?.uid || '',
    });

    await logActivity(
      id,
      'SOFT_DELETED',
      `Project ${existing.projectCode} moved to Trash`,
      'ACTIVE',
      'TRASHED',
      existing.projectCode
    );
  };

  // Restore Project from Trash
  const restoreProject = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can restore projects.');
    }

    const existing = allProjectsEver.find((p) => p.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    await updateDoc(docRef, {
      deletedAt: null,
      deletedBy: null,
      updatedAt: now,
      updatedBy: currentUser?.uid || '',
    });

    await logActivity(
      id,
      'RESTORED',
      `Project ${existing.projectCode} restored from Trash`,
      'TRASHED',
      existing.projectStatus,
      existing.projectCode
    );
  };

  // Permanently Delete Project
  const permanentlyDeleteProject = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can permanently delete projects.');
    }

    const existing = allProjectsEver.find((p) => p.id === id);
    if (!existing) return;

    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    await deleteDoc(docRef);

    await logActivity(
      id,
      'PERMANENTLY_DELETED',
      `Project ${existing.projectCode} permanently deleted from database`,
      existing.projectCode,
      null,
      existing.projectCode
    );
  };

  // Bulk Soft Delete
  const bulkSoftDeleteProjects = async (ids: string[]): Promise<number> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can delete projects.');
    }
    if (!ids || ids.length === 0) return 0;

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    let count = 0;
    const affectedProjects: Project[] = [];

    for (const id of ids) {
      const existing = allProjectsEver.find((p) => p.id === id);
      if (existing && !existing.deletedAt) {
        const docRef = doc(db, COLLECTIONS.PROJECTS, id);
        batch.update(docRef, {
          deletedAt: now,
          deletedBy: currentUser?.uid || '',
          updatedAt: now,
          updatedBy: currentUser?.uid || '',
        });
        count++;
        affectedProjects.push(existing);
      }
    }

    if (count > 0) {
      await batch.commit();
      for (const p of affectedProjects) {
        logActivity(
          p.id,
          'SOFT_DELETED',
          `Project ${p.projectCode} moved to Trash (Bulk Action)`,
          'ACTIVE',
          'TRASHED',
          p.projectCode
        ).catch(console.error);
      }
    }

    return count;
  };

  // Bulk Restore
  const bulkRestoreProjects = async (ids: string[]): Promise<number> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can restore projects.');
    }
    if (!ids || ids.length === 0) return 0;

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    let count = 0;
    const affectedProjects: Project[] = [];

    for (const id of ids) {
      const existing = allProjectsEver.find((p) => p.id === id);
      if (existing && existing.deletedAt) {
        const docRef = doc(db, COLLECTIONS.PROJECTS, id);
        batch.update(docRef, {
          deletedAt: null,
          deletedBy: null,
          updatedAt: now,
          updatedBy: currentUser?.uid || '',
        });
        count++;
        affectedProjects.push(existing);
      }
    }

    if (count > 0) {
      await batch.commit();
      for (const p of affectedProjects) {
        logActivity(
          p.id,
          'RESTORED',
          `Project ${p.projectCode} restored from Trash (Bulk Action)`,
          'TRASHED',
          p.projectStatus,
          p.projectCode
        ).catch(console.error);
      }
    }

    return count;
  };

  // Bulk Permanent Delete
  const bulkPermanentlyDeleteProjects = async (ids: string[]): Promise<number> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can permanently delete projects.');
    }
    if (!ids || ids.length === 0) return 0;

    const batch = writeBatch(db);
    let count = 0;
    const affectedProjects: Array<{ id: string; code: string }> = [];

    for (const id of ids) {
      const existing = allProjectsEver.find((p) => p.id === id);
      if (existing) {
        const docRef = doc(db, COLLECTIONS.PROJECTS, id);
        batch.delete(docRef);
        count++;
        affectedProjects.push({ id, code: existing.projectCode });
      }
    }

    if (count > 0) {
      await batch.commit();
      for (const item of affectedProjects) {
        logActivity(
          item.id,
          'PERMANENTLY_DELETED',
          `Project ${item.code} was permanently deleted from the database (Bulk Action)`,
          item.code,
          null,
          item.code
        ).catch(console.error);
      }
    }

    return count;
  };

  // Bulk Update Projects (Status, Payment, etc.)
  const bulkUpdateProjects = async (
    ids: string[],
    updates: Partial<Project>,
    changeDescription?: string
  ): Promise<number> => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only Administrators can edit projects.');
    }
    if (!ids || ids.length === 0) return 0;

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    let count = 0;
    const affectedProjects: Project[] = [];

    for (const id of ids) {
      const existing = allProjectsEver.find((p) => p.id === id);
      if (existing) {
        const docRef = doc(db, COLLECTIONS.PROJECTS, id);
        batch.update(docRef, {
          ...updates,
          updatedAt: now,
          updatedBy: currentUser?.uid || '',
        });
        count++;
        affectedProjects.push(existing);
      }
    }

    if (count > 0) {
      await batch.commit();
      for (const p of affectedProjects) {
        logActivity(
          p.id,
          'UPDATED',
          changeDescription || `Bulk update applied`,
          null,
          null,
          p.projectCode
        ).catch(console.error);
      }
    }

    return count;
  };

  // Add Payment Follow-up
  const addPaymentFollowup = async (
    projectId: string,
    notes: string,
    followUpDate: string,
    options?: {
      promisedDate?: string;
      promisedAmount?: number;
      followUpStatus?: string;
    }
  ): Promise<PaymentFollowup> => {
    const existingFollowups = paymentFollowups.filter((f) => f.projectId === projectId);
    const nextNumber = existingFollowups.length + 1;
    const fId = `flw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newFollowup: PaymentFollowup = {
      id: fId,
      projectId,
      followUpNumber: nextNumber,
      followUpDate,
      notes,
      createdBy: currentUser?.uid || '',
      createdByName: userProfile?.name || 'Authorized Staff',
      createdAt: now,
    };

    const docRef = doc(db, COLLECTIONS.PAYMENT_FOLLOWUPS, fId);
    await setDoc(docRef, newFollowup);

    // Also update project level follow up details & promise to pay
    const projectUpdates: Partial<Project> = {
      lastFollowUpDate: followUpDate,
      followUpRemarks: notes,
      followUpCount: nextNumber,
    };

    if (options?.followUpStatus) {
      projectUpdates.followUpStatus = options.followUpStatus as any;
    }
    if (options?.promisedDate) {
      projectUpdates.promisedPaymentDate = options.promisedDate;
      projectUpdates.promisedAmount = options.promisedAmount || 0;
      projectUpdates.promiseStatus = 'PENDING';
    }

    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), cleanFirestoreData(projectUpdates));

    const project = allProjectsEver.find((p) => p.id === projectId);
    await logActivity(
      projectId,
      'FOLLOW_UP_ADDED',
      `Logged Follow-Up #${nextNumber}: ${notes.substring(0, 60)}${notes.length > 60 ? '...' : ''}${options?.promisedDate ? ` (Promise: AED ${options.promisedAmount || 0} by ${options.promisedDate})` : ''}`,
      null,
      `#${nextNumber}`,
      project?.projectCode
    );

    return newFollowup;
  };

  // Batch CSV / XLSX Import
  const importProjects = async (
    projectsToImport: Array<Partial<Project>>,
    skipDuplicates: boolean
  ): Promise<{ imported: number; skipped: number; errors: string[] }> => {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Working list of projects for sequential code generation
    let currentPool = [...allProjectsEver];

    for (let i = 0; i < projectsToImport.length; i++) {
      const raw = projectsToImport[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!raw.company || !raw.projectReference || !raw.deliveryDate) {
        errors.push(`Row ${rowNum}: Missing required Company, Project Reference, or Delivery Date.`);
        continue;
      }

      // Duplicate detection: matches Company + Reference + Delivery Date
      const isDuplicate = currentPool.some(
        (p) =>
          !p.deletedAt &&
          p.company.trim().toLowerCase() === raw.company?.trim().toLowerCase() &&
          p.projectReference.trim().toLowerCase() === raw.projectReference?.trim().toLowerCase() &&
          p.deliveryDate === raw.deliveryDate
      );

      if (isDuplicate && skipDuplicates) {
        skipped++;
        continue;
      }

      try {
        let assignedCode = raw.projectCode?.trim();
        if (assignedCode && isProjectCodeUnique(assignedCode, currentPool)) {
          // Valid unique code provided
        } else {
          assignedCode = generateNextProjectCode(currentPool);
        }

        const newId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;
        const now = new Date().toISOString();

        const hireDays = Number(raw.hirePeriodDays) || 30;
        const deliveryDate = raw.deliveryDate;
        const calculatedDueDate = calculateDueDate(deliveryDate, hireDays);

        // Auto-assign salesperson & automatically link company to salesperson
        const companyNameTrimmed = raw.company?.trim() || '';
        let spId = raw.salespersonId;
        let spName = raw.salespersonName ? String(raw.salespersonName).trim() : '';

        // Match salesperson by name or id if specified in imported file
        if (spName) {
          let matchedSp = salespersons.find(
            (s) =>
              s.name.trim().toLowerCase() === spName.toLowerCase() ||
              s.id === spId ||
              s.id.toLowerCase() === spName.toLowerCase()
          );

          // If a new salesperson name was entered in Excel that doesn't exist yet, auto-create in master
          if (!matchedSp && spName.length > 1) {
            const newSpId = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const newSp: Salesperson = {
              id: newSpId,
              name: spName,
              mobile: '',
              email: '',
              status: 'ACTIVE',
              createdAt: now,
              updatedAt: now,
            };
            setDoc(doc(db, COLLECTIONS.SALESPERSONS, newSpId), cleanFirestoreData(newSp)).catch(console.error);
            salespersons.push(newSp);
            matchedSp = newSp;
          }

          if (matchedSp) {
            spId = matchedSp.id;
            spName = matchedSp.name;
          }
        }

        // Auto-link Company record & default salesperson
        let canonicalComp: CompanyRecord | undefined = undefined;
        if (companyNameTrimmed) {
          canonicalComp = await getOrCreateCanonicalCompany(
            companyNameTrimmed,
            raw.mobile ? String(raw.mobile).trim() : undefined,
            spId,
            spName
          );

          if (!spId && canonicalComp.defaultSalespersonId) {
            spId = canonicalComp.defaultSalespersonId;
            spName = canonicalComp.defaultSalespersonName;
          }
        }

        const projectItem: Project = {
          id: newId,
          projectCode: assignedCode,
          company: canonicalComp ? canonicalComp.companyName : raw.company.trim(),
          companyId: canonicalComp ? canonicalComp.id : undefined,
          mobile: raw.mobile ? String(raw.mobile).trim() : (canonicalComp?.mobile || ''),
          projectReference: raw.projectReference.trim(),
          scaffoldingType: raw.scaffoldingType === 'EREC/DISM' ? 'EREC/DISM' : 'RENTAL',
          hirePeriodDays: hireDays,
          deliveryDate,
          dueDate: raw.dueDate || calculatedDueDate,
          isDueDateOverridden: !!raw.dueDate && raw.dueDate !== calculatedDueDate,
          projectStatus: (raw.projectStatus as any) || 'ACTIVE',
          paymentStatus: (raw.paymentStatus as any) || 'NOT_PAID',
          remarks: raw.remarks || '',
          salespersonId: spId,
          salespersonName: spName,
          salespersonAssignmentType: 'AUTO_ASSIGNED',
          contractAmount: raw.contractAmount ?? raw.lpoAmount ?? 0,
          returnedDate: raw.returnedDate || null,
          createdBy: currentUser?.uid || '',
          updatedBy: currentUser?.uid || '',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          deletedBy: null,
        };

        const docRef = doc(db, COLLECTIONS.PROJECTS, newId);
        await setDoc(docRef, projectItem);
        currentPool.push(projectItem);
        imported++;
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to import row'}`);
      }
    }

    if (imported > 0) {
      await logActivity(
        'BATCH_IMPORT',
        'CREATED',
        `Imported ${imported} projects (${skipped} duplicates skipped)`,
        null,
        `${imported} items`
      );
    }

    return { imported, skipped, errors };
  };

  const getProjectFollowups = (projectId: string): PaymentFollowup[] => {
    return paymentFollowups.filter((f) => f.projectId === projectId);
  };

  const getProjectActivities = (projectId: string): ProjectActivity[] => {
    return projectActivities.filter((a) => a.projectId === projectId);
  };

  const getProjectRemarks = (projectId: string): RemarksHistory[] => {
    return remarksHistories.filter((r) => r.projectId === projectId);
  };

  const addProjectRemark = async (projectId: string, remarkText: string): Promise<void> => {
    const existing = allProjectsEver.find((p) => p.id === projectId);
    if (!existing) throw new Error('Project not found');
    const now = new Date().toISOString();
    const historyId = `rmk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const historyDoc: RemarksHistory = {
      id: historyId,
      projectId,
      userId: currentUser?.uid || '',
      userName: userProfile?.name || 'Salesperson',
      previousRemark: existing.remarks || '',
      createdAt: now,
    };
    await setDoc(doc(db, COLLECTIONS.REMARKS_HISTORY, historyId), historyDoc);

    const updatedRemarks = existing.remarks
      ? `${existing.remarks}\n[${new Date().toLocaleDateString('en-GB')}] ${remarkText.trim()}`
      : remarkText.trim();

    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await updateDoc(docRef, {
      remarks: updatedRemarks,
      updatedAt: now,
    });
  };

  const seedSalespersonDemoData = async (): Promise<void> => {
    const today = new Date();
    const subtractDays = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return toInputDateFormat(d);
    };

    const demoRecords = [
      // 10 projects for Syed Arish (sp_syed)
      {
        projectCode: 'PRJ-0001',
        company: 'Apex Construction LLC',
        mobile: '052-1234567',
        projectReference: 'Burj View Tower Plot 12',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(45),
        dueDate: subtractDays(15), // 15 days overdue!
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 38500,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Cuplok standards, ledgers, and steel hook-on boards.',
      },
      {
        projectCode: 'PRJ-0002',
        company: 'Emaar Properties PJSC',
        mobile: '050-7654321',
        projectReference: 'Creek Marina Pier B',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 67,
        originalHirePeriodDays: 60,
        extensionDays: 7,
        deliveryDate: subtractDays(70),
        originalDueDate: subtractDays(10),
        dueDate: subtractDays(3), // 3 days overdue!
        isDueDateOverridden: false,
        projectStatus: 'EXTENDED' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 84000,
        originalRentalAmount: 70000,
        extensionRentalAmount: 14000,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Full facade erection with third-party safety certification.',
      },
      {
        projectCode: 'PRJ-0003',
        company: 'Arabtec Engineering',
        mobile: '055-3344556',
        projectReference: 'Palm Jumeirah Villa 88',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(28),
        dueDate: subtractDays(-2), // 2 days remaining (Due Soon!)
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PAID' as const,
        contractAmount: 22000,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Aluminum mobile towers with castor wheels.',
      },
      {
        projectCode: 'PRJ-0004',
        company: 'Sobha Realty Group',
        mobile: '054-9988776',
        projectReference: 'Hartland Phase 3',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 45,
        deliveryDate: subtractDays(45),
        dueDate: toInputDateFormat(today), // Due today!
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 45000,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Internal shoring scaffolding for high ceiling slab.',
      },
      {
        projectCode: 'PRJ-0005',
        company: 'Meydan Group',
        mobile: '050-1122334',
        projectReference: 'Meydan Heights Plot 4',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(10),
        dueDate: subtractDays(-20),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'NOT_PAID' as const,
        contractAmount: 18500,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Access staging for perimeter glazing.',
      },
      {
        projectCode: 'PRJ-0006',
        company: 'Al Naboodah Contracting',
        mobile: '058-6677889',
        projectReference: 'Expo City Pavilion',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(60),
        dueDate: subtractDays(30),
        isDueDateOverridden: false,
        projectStatus: 'CLOSED' as const,
        returnedDate: subtractDays(28),
        paymentStatus: 'PAID' as const,
        contractAmount: 16000,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'All components inspected and returned to central yard.',
      },
      {
        projectCode: 'PRJ-0007',
        company: 'Emaar Properties PJSC',
        mobile: '050-7654321',
        projectReference: 'Downtown Dubai Podium',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 37,
        originalHirePeriodDays: 30,
        extensionDays: 7,
        deliveryDate: subtractDays(20),
        originalDueDate: subtractDays(-10),
        dueDate: subtractDays(-17),
        isDueDateOverridden: false,
        projectStatus: 'EXTENDED' as const,
        paymentStatus: 'PAID' as const,
        contractAmount: 29400,
        originalRentalAmount: 24000,
        extensionRentalAmount: 5400,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: '7-day approved extension for facade touch-ups.',
      },
      {
        projectCode: 'PRJ-0008',
        company: 'Omniyat Developments',
        mobile: '052-8877665',
        projectReference: 'Business Bay Tower A',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 60,
        deliveryDate: subtractDays(15),
        dueDate: subtractDays(-45),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 52000,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'External cantilever scaffolding for spire cladding.',
      },
      {
        projectCode: 'PRJ-0009',
        company: 'Emaar Properties PJSC',
        mobile: '050-7654321',
        projectReference: 'Dubai Hills Estate Parcel 9',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(26),
        dueDate: subtractDays(-4), // 4 days remaining (Due Soon!)
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 14000,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Heavy-duty prop jacks and aluminum beams.',
      },
      {
        projectCode: 'PRJ-0010',
        company: 'Damac Developments',
        mobile: '056-2233445',
        projectReference: 'Jumeirah Golf Estates',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(50),
        dueDate: subtractDays(20),
        isDueDateOverridden: false,
        projectStatus: 'CLOSED' as const,
        returnedDate: subtractDays(18),
        paymentStatus: 'PAID' as const,
        contractAmount: 9600,
        salespersonId: 'sp_syed',
        salespersonName: 'Syed Arish',
        remarks: 'Completed handover and signed return note.',
      },

      // 7 projects for John Doe (sp_john)
      {
        projectCode: 'PRJ-0011',
        company: 'Damac Developments',
        mobile: '056-2233445',
        projectReference: 'Lagoon Heights Tower 4',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 90,
        deliveryDate: subtractDays(15),
        dueDate: subtractDays(-75),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PAID' as const,
        contractAmount: 72000,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'External access scaffolding for painting contractor.',
      },
      {
        projectCode: 'PRJ-0012',
        company: 'Al Naboodah Contracting',
        mobile: '058-6677889',
        projectReference: 'Al Wasl Plaza Shoring',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 45,
        deliveryDate: subtractDays(20),
        dueDate: subtractDays(-25),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 48000,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'Heavy falsework shoring for transfer slab.',
      },
      {
        projectCode: 'PRJ-0013',
        company: 'Danube Properties',
        mobile: '055-1122445',
        projectReference: 'Dubai South Logistics Yard',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 40,
        originalHirePeriodDays: 30,
        extensionDays: 10,
        deliveryDate: subtractDays(35),
        dueDate: subtractDays(-5),
        isDueDateOverridden: false,
        projectStatus: 'EXTENDED' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 31500,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'Extension approved for interior MEP fitting.',
      },
      {
        projectCode: 'PRJ-0014',
        company: 'Ithra Dubai',
        mobile: '050-9988112',
        projectReference: 'Deira Waterfront Phase 2',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 60,
        deliveryDate: subtractDays(80),
        dueDate: subtractDays(20), // 20 days overdue!
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'NOT_PAID' as const,
        contractAmount: 64000,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'Waterfront promenade access scaffolding.',
      },
      {
        projectCode: 'PRJ-0015',
        company: 'Alef Group',
        mobile: '056-3344889',
        projectReference: 'Sharjah Waterfront City',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(12),
        dueDate: subtractDays(-18),
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PAID' as const,
        contractAmount: 26000,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'Bridge pier inspection towers.',
      },
      {
        projectCode: 'PRJ-0016',
        company: 'Aldar Properties',
        mobile: '052-4455667',
        projectReference: 'Yas Island Arena Extension',
        scaffoldingType: 'EREC/DISM' as const,
        hirePeriodDays: 60,
        deliveryDate: subtractDays(58),
        dueDate: subtractDays(-2), // 2 days remaining (Due Soon!)
        isDueDateOverridden: false,
        projectStatus: 'ACTIVE' as const,
        paymentStatus: 'PARTIAL_PAID' as const,
        contractAmount: 85000,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'High load capacity propping and grandstand access.',
      },
      {
        projectCode: 'PRJ-0017',
        company: 'Six Construct',
        mobile: '050-5566778',
        projectReference: 'Saadiyat Cultural District',
        scaffoldingType: 'RENTAL' as const,
        hirePeriodDays: 30,
        deliveryDate: subtractDays(50),
        dueDate: subtractDays(20),
        isDueDateOverridden: false,
        projectStatus: 'CLOSED' as const,
        returnedDate: subtractDays(19),
        paymentStatus: 'PAID' as const,
        contractAmount: 42000,
        salespersonId: 'sp_john',
        salespersonName: 'John Doe',
        remarks: 'Safely dismantled and demobilized.',
      },
    ];

    for (const p of demoRecords) {
      await addProject(p as any);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        trashedProjects,
        allProjectsEver,
        paymentFollowups,
        projectActivities,
        remarksHistories,

        // Module 1 & 2 exports
        salespersons,
        activeSalespersons,
        companies,
        invoices: accessibleInvoices,
        payments: accessiblePayments,
        commercialMetrics,

        loading,
        metrics,
        isCodeAvailable,
        findProjectByCode,
        getNextUniqueCode,
        addProject,
        updateProject,
        copyProject,
        softDeleteProject,
        restoreProject,
        permanentlyDeleteProject,
        bulkSoftDeleteProjects,
        bulkRestoreProjects,
        bulkPermanentlyDeleteProjects,
        bulkUpdateProjects,
        addPaymentFollowup,
        importProjects,
        getProjectFollowups,
        getProjectActivities,
        getProjectRemarks,
        addProjectRemark,
        seedSalespersonDemoData,

        // Salesperson & Company Actions
        addSalesperson,
        updateSalesperson,
        deactivateSalesperson,
        addCompany,
        getOrCreateCanonicalCompany,
        updateCompany,
        findCompanyByName,
        findCanonicalCompany,
        checkDuplicateCompany,
        checkPotentialDuplicateCompany: checkPotentialDuplicate,

        // Invoice & Payment Actions
        addInvoice,
        updateInvoice,
        deleteInvoice,
        addPaymentReceipt,
        deletePaymentReceipt,

        // Financial queries
        getProjectFinancials,
        getCompanyFinancials,
        getSalespersonFinancials,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
