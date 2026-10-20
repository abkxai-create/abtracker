# Dedicated Salesperson Unified Dashboard & Company Access Isolation

A focused single-screen operational dashboard for salespersons in AB TRACKER with financial metrics, overdue project alerts, due-date sorted active and closed project views, and strict isolation of company records to assigned clients only.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product design choices were clarified and confirmed in Phase 1:
>
> - **Navigation Structure**: Single unified dashboard with no extra tabs. Salesperson accounts will not see sidebar hubs for Collections, Companies directory, or System Settings.
> - **Company Access Restriction**: Salesperson access is strictly constrained to companies that have projects assigned to their salesperson ID. Unassigned companies will not be visible anywhere.
> - **Primary Metrics**: Total LPO value, Received payments, Outstanding receivables, Overdue amount, and an Overdue Projects Attention Card highlighting urgent contracts.
> - **Project Organization**: Active projects listed with strict sorting from most days overdue / due to least days due, with a dedicated tab/segmented switch for Closed/Returned projects.

---

## 1. Overview & Core Concept

### What It Does
Provides every logged-in salesperson with an executive, distraction-free cockpit tailored directly to their accounts. When a user with the `SALESPERSON` role logs in, AB TRACKER replaces multi-tab administrative navigation with a single unified workspace showing high-impact commercial figures at the top and an actionable, due-date-ranked project fleet below. 

### Target Audience & Persona
- **Field & Account Sales Executives**: Sales professionals who manage client relationships, track LPO fulfillment, follow up on pending scaffolding rentals, and ensure timely cheque collections without needing access to global company databases or administrative settings.

### Key Value Delivered
- **Zero Company Data Leakage**: Salespersons only see client companies with active or closed projects assigned to them.
- **Immediate Urgency Prioritization**: Projects requiring commercial attention (overdue or nearing deadline) appear at the very top of the list.
- **Simplicity**: No navigating between separate tabs—everything a salesperson needs is in one unified view.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Salesperson Login & Landing**:
   - The user signs in via Google OAuth.
   - Upon authentication, if their role is `SALESPERSON`, the sidebar collapses secondary hubs and displays a single active navigation target: **"My Dashboard"**.
   - The top banner shows their linked salesperson name and contact assignment status.

2. **Commercial Header & Alert Metrics**:
   - A grid of five clean metric cards rendered using tabular figures (`tabular-nums`) and subtle hairline borders:
     1. **Total LPO Value**: Sum of contract amounts for all assigned projects.
     2. **Received (AED)**: Total verified payments collected to date.
     3. **Outstanding Balance**: Remaining contract receivables awaiting collection.
     4. **Overdue Amount**: Outstanding funds past the due date.
     5. **Attention Alert (Overdue Projects)**: An amber/crimson highlighted card showing the count of projects currently overdue, with instant 1-click filtering.

3. **Due-Date Prioritized Project Fleet**:
   - Clean segmented control: **"Active Projects"** vs **"Closed Projects"** (Returned / Completed).
   - Search bar to filter by project reference, site location, or company name.
   - Projects are ordered strictly:
     - Overdue projects (sorted by greatest days overdue first: e.g. -45 days before -10 days).
     - Due soon projects (sorted by soonest upcoming due date: e.g. 2 days before 30 days).
   - Each project card/row displays:
     - Canonical project code & company name (restricted to their clients).
     - Financial breakdown: LPO Value, Received, and Outstanding Balance.
     - Due Date indicator with human-readable days overdue / days remaining badge.
     - Direct WhatsApp & Phone call action buttons.
     - Click-through to view project milestones, payment receipts, and delivery details.

4. **Closed Projects View**:
   - Seamlessly toggle to the "Closed Projects" tab to review returned equipment, historical rental durations, and settled payment records without cluttering the active workflow.

### Visual Identity & Theme
- **Canvas & Surface**: Dark corporate slate sidebar (`#172B4D` / `#13233F`) paired with clean neutral canvas (`#F8FAFC`) and white cards (`#FFFFFF`) with 1px borders (`border-slate-200`).
- **Typography & Hierarchy**: `Plus Jakarta Sans` for clean titles, paired with monospace tabular numerals (`tabular-nums`) for currency (AED) and project codes.
- **Zero-Pill Restraint**: Metadata (dates, contract lengths) styled with unboxed typographic separators (`·`).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Single Unified Dashboard vs. Retaining Multiple Tabs
- **Chosen Approach**: Hide Collections, Companies, and Administration tabs in the Sidebar and Navbar for salesperson accounts, presenting a single cohesive dashboard.
- **Why**: Eliminates cognitive overload, avoids accidental navigation to unauthorized views, and matches the confirmed user preference.
- **Alternatives Considered**: Keeping a restricted Companies tab was rejected because the user explicitly requested a single dashboard with no extra tabs and strict company confinement.

### Decision 2: Company Data Isolation Model
- **Chosen Approach**: Derive `companies` in `ProjectContext.tsx` to automatically filter the company directory based on the salesperson's assigned projects.
- **Why**: Ensures that even if any modal, selector, or sub-component queries `companies`, it will never leak companies belonging to other sales representatives.

### Decision 3: Project Sorting Algorithm
- **Chosen Approach**: Two-tiered sorting:
  1. Projects where `diffDays < 0` (overdue) sorted ascending by `diffDays` (e.g. -60 days is shown before -5 days).
  2. Followed by projects where `diffDays >= 0` sorted ascending by `diffDays` (soonest due dates first).
- **Why**: Maximizes urgency—the salesperson immediately sees the most critically overdue projects at the top of their screen.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Google OAuth User                    │
│             Role: SALESPERSON, Approved: TRUE          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 src/context/AuthContext                │
│    Provides userProfile, salespersonId, isSalesperson  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               src/context/ProjectContext               │
│  • effectiveSpId = userProfile.salespersonId           │
│  • accessibleProjects: only projects matching spId     │
│  • companies: STRICTLY filtered to companies with      │
│    assigned projects                                   │
│  • commercialMetrics: calculated only for salesperson  │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────┐ ┌───────────────────────┐
│     src/components/Sidebar   │ │ src/components/Navbar │
│ • Shows ONLY "My Dashboard"  │ │ • Global search scoped│
│ • No Companies or Admin hubs │ │ • No external tab links│
└──────────────┬───────────────┘ └───────────┬───────────┘
               │                             │
               └──────────────┬──────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────┐
│         src/components/SalespersonDashboard.tsx        │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 5 Metric Cards: Total LPO | Received |           │  │
│  │ Outstanding | Overdue AED | Overdue Count Alert  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [ Active Projects (N) ]  [ Closed Projects (M) ] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Due-Date Prioritized Project Fleet List          │  │
│  │ (Sorted: Greatest days overdue → Least days due) │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Component & State Changes:
1. **`src/context/ProjectContext.tsx`**:
   - Update `companies` memo: When `isSalespersonRole` is active, filter `rawCompanies` to only include companies that match `companyId` or canonical company name of the salesperson's `accessibleProjects`.
2. **`src/components/Sidebar.tsx`**:
   - When user is a salesperson, render a single navigation item: `"My Dashboard"` (icon: `FolderKanban` or `LayoutDashboard`). Hide `collections`, `companies`, and `administration`.
3. **`src/components/SalespersonDashboard.tsx`**:
   - New dedicated component containing the 5 KPI metric cards, active vs. closed segmented filter, search bar, overdue urgency sorting, and responsive project cards with quick contact actions.
4. **`src/App.tsx`**:
   - Route salesperson accounts directly to `SalespersonDashboard` regardless of initial URL or tab state, and prevent access to administrative routes.
