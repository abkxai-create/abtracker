import { CompanyRecord, Project } from '../types';

/**
 * Normalizes phone numbers to standard UAE local format (e.g. '0552585480') or standard digits.
 * Removes all formatting artifacts: dashes, spaces, slashes, periods, parentheses.
 * Normalizes +971 or 00971 country code to local '05...' prefix.
 */
export function normalizeMobileNumber(mobile?: string | null): string {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  if (!digits) return '';

  // UAE country code: 9715XXXXXXXX -> 05XXXXXXXX
  if (digits.startsWith('9715') && digits.length >= 11) {
    return '05' + digits.substring(4);
  }
  // UAE country code with leading 00: 009715XXXXXXXX -> 05XXXXXXXX
  if (digits.startsWith('009715') && digits.length >= 13) {
    return '05' + digits.substring(6);
  }
  // UAE mobile without leading 0 (e.g. 50XXXXXXX, 55XXXXXXX - 9 digits) -> 05XXXXXXX
  if (digits.length === 9 && digits.startsWith('5')) {
    return '0' + digits;
  }
  // Already UAE local format e.g. 05XXXXXXXX
  if (digits.startsWith('05') && digits.length === 10) {
    return digits;
  }

  return digits;
}

/**
 * Normalizes company name into a canonical search & deduplication key.
 * 1. Converts to lowercase.
 * 2. Replaces punctuation and special symbols with space.
 * 3. Normalizes '&' to 'and'.
 * 4. Normalizes legal entity variations (L.L.C., LLC, FZE, FZCO, EST, CO, LTD, WLL, etc.)
 *    WITHOUT stripping essential corporate identifiers like 'CONTRACTING', 'ENGINEERING', 'TRADING'.
 * 5. Collapses repeated whitespace.
 */
export function toCompanyCanonicalKey(name: string): string {
  if (!name) return '';

  let cleaned = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,\/#!$%\^*;:{}=\-_`~()\[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common legal suffix patterns at the end of the name or surrounded by word boundaries
  cleaned = cleaned
    .replace(/\b(l\s*l\s*c|llc|f\s*z\s*e|fze|f\s*z\s*c\s*o|fzco|f\s*z|fz|p\s*j\s*s\s*c|pjsc|l\s*t\s*d|ltd|limited|corp|corporation|inc|incorporated|est|establishment|w\s*l\s*l|wll|s\s*p\s*c|spc|co|company)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Cleans and capitalizes a company name for authoritative display.
 * Strips duplicate spaces and cleans punctuation formatting.
 */
export function toCanonicalDisplayCompanyName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Generates a deterministic document ID for a company.
 * E.g., 'comp_sanvee_building_contracting'
 * Because this is deterministic, two users creating the same company simultaneously
 * or importing files will write to the SAME doc ID rather than creating duplicate docs.
 */
export function generateCanonicalCompanyId(name: string): string {
  const key = toCompanyCanonicalKey(name);
  if (!key) {
    return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }
  const slug = key
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 48);

  return `comp_${slug}`;
}

/**
 * Calculates string similarity using Dice's coefficient on bigrams.
 */
export function computeStringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  if (b1.size === 0 || b2.size === 0) return 0.0;

  let intersection = 0;
  b1.forEach((val) => {
    if (b2.has(val)) intersection++;
  });

  return (2 * intersection) / (b1.size + b2.size);
}

/**
 * Checks whether two company records/names represent the SAME real company.
 * Enforces safety: never merges different companies (e.g. 'ABC CONTRACTING' and 'ABC CONTRACTING & ENGINEERING').
 */
export function isCompanyMatch(
  nameA: string,
  nameB: string,
  mobileA?: string,
  mobileB?: string
): boolean {
  if (!nameA || !nameB) return false;

  const rawA = nameA.trim().toLowerCase();
  const rawB = nameB.trim().toLowerCase();
  if (rawA === rawB) return true;

  const keyA = toCompanyCanonicalKey(nameA);
  const keyB = toCompanyCanonicalKey(nameB);
  if (keyA && keyB && keyA === keyB) return true;

  // If canonical keys differ, check if phone numbers are both present and identical
  const phoneA = normalizeMobileNumber(mobileA);
  const phoneB = normalizeMobileNumber(mobileB);

  if (phoneA && phoneB && phoneA === phoneB && phoneA.length >= 8) {
    // Only match if the names are also very close (similarity >= 0.82)
    // to avoid merging different companies that share a general office landline.
    const sim = computeStringSimilarity(keyA, keyB);
    if (sim >= 0.82) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the canonical company record from a list of existing companies.
 * Returns the matched company or undefined.
 */
export function findCanonicalCompany(
  nameToCheck: string,
  mobileToCheck: string | undefined,
  companies: CompanyRecord[]
): CompanyRecord | undefined {
  if (!nameToCheck || !nameToCheck.trim()) return undefined;

  const targetName = nameToCheck.trim();
  const targetKey = toCompanyCanonicalKey(targetName);
  const targetPhone = normalizeMobileNumber(mobileToCheck);

  // 1. Direct ID match
  const byId = companies.find((c) => c.id === targetName);
  if (byId) return byId;

  // 2. Exact case-insensitive name match
  const exactName = companies.find(
    (c) => c.companyName.trim().toLowerCase() === targetName.toLowerCase()
  );
  if (exactName) return exactName;

  // 3. Exact canonical key match (e.g. 'SANVEE BUILDING CONTRACTING LLC' === 'Sanvee Building Contracting L.L.C.')
  const exactKey = companies.find((c) => toCompanyCanonicalKey(c.companyName) === targetKey);
  if (exactKey) return exactKey;

  // 4. Same canonical phone + high name similarity
  if (targetPhone && targetPhone.length >= 8) {
    const byPhone = companies.find((c) => {
      const cPhone = normalizeMobileNumber(c.mobile);
      if (cPhone && cPhone === targetPhone) {
        const cKey = toCompanyCanonicalKey(c.companyName);
        return computeStringSimilarity(targetKey, cKey) >= 0.82;
      }
      return false;
    });
    if (byPhone) return byPhone;
  }

  return undefined;
}

/**
 * Fuzzy search to suggest potential duplicates when a user is typing a new company.
 */
export function checkPotentialDuplicateCompany(
  nameToCheck: string,
  companies: CompanyRecord[]
): { isDuplicate: boolean; match?: CompanyRecord; confidence: number } {
  if (!nameToCheck || !nameToCheck.trim()) {
    return { isDuplicate: false, confidence: 0 };
  }

  const targetKey = toCompanyCanonicalKey(nameToCheck);
  let bestMatch: CompanyRecord | undefined = undefined;
  let highestSim = 0;

  for (const c of companies) {
    if (isCompanyMatch(nameToCheck, c.companyName)) {
      return { isDuplicate: true, match: c, confidence: 1.0 };
    }

    const cKey = toCompanyCanonicalKey(c.companyName);
    const sim = computeStringSimilarity(targetKey, cKey);
    if (sim > highestSim) {
      highestSim = sim;
      bestMatch = c;
    }
  }

  if (highestSim >= 0.85 && bestMatch) {
    return { isDuplicate: true, match: bestMatch, confidence: highestSim };
  }

  return { isDuplicate: false, match: bestMatch, confidence: highestSim };
}

/**
 * Deduplicates a list of CompanyRecords into a unique list of canonical companies.
 * Ensures exactly ONE company record per real entity.
 */
export function deduplicateCompanyRecords(companies: CompanyRecord[]): CompanyRecord[] {
  // 1. Group records by canonical key or ID
  const groups = new Map<string, CompanyRecord[]>();

  for (const comp of companies) {
    if (!comp || !comp.companyName) continue;
    const key = toCompanyCanonicalKey(comp.companyName) || comp.id;
    const list = groups.get(key) || [];
    list.push(comp);
    groups.set(key, list);
  }

  const result: CompanyRecord[] = [];

  for (const [key, group] of groups.entries()) {
    if (group.length === 1) {
      const single = { ...group[0] };
      single.normalizedName = toCompanyCanonicalKey(single.companyName);
      single.normalizedMobile = normalizeMobileNumber(single.mobile);
      result.push(single);
      continue;
    }

    // Sort to choose the authoritative canonical record:
    // Prefer deterministic id `comp_` + slug or oldest createdAt
    const sorted = [...group].sort((a, b) => {
      const isADet = a.id === generateCanonicalCompanyId(a.companyName);
      const isBDet = b.id === generateCanonicalCompanyId(b.companyName);
      if (isADet && !isBDet) return -1;
      if (!isADet && isBDet) return 1;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    const canonical: CompanyRecord = { ...sorted[0] };
    canonical.normalizedName = toCompanyCanonicalKey(canonical.companyName);

    // Merge best fields from duplicates
    for (let i = 1; i < sorted.length; i++) {
      const other = sorted[i];
      if (!canonical.mobile && other.mobile) canonical.mobile = other.mobile;
      if (!canonical.contactPerson && other.contactPerson) canonical.contactPerson = other.contactPerson;
      if (!canonical.email && other.email) canonical.email = other.email;
      if (!canonical.remarks && other.remarks) canonical.remarks = other.remarks;
      if (!canonical.defaultSalespersonId && other.defaultSalespersonId) {
        canonical.defaultSalespersonId = other.defaultSalespersonId;
        canonical.defaultSalespersonName = other.defaultSalespersonName;
      }
    }

    canonical.normalizedMobile = normalizeMobileNumber(canonical.mobile);
    result.push(canonical);
  }

  return result;
}
