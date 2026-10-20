import { Project } from '../types';

/**
 * Checks if a candidate project code already exists in all projects (including trashed).
 * Comparison is case-insensitive and trimmed.
 * If excludeProjectId is given, that project's own code is ignored (used for edit mode).
 */
export function isProjectCodeUnique(
  code: string,
  allProjects: Project[],
  excludeProjectId?: string
): boolean {
  if (!code || !code.trim()) return false;
  const cleanCode = code.trim().toUpperCase();
  return !allProjects.some(
    (p) =>
      p.id !== excludeProjectId &&
      p.projectCode?.trim().toUpperCase() === cleanCode
  );
}

/**
 * Finds any existing project that has the specified project code.
 * Useful for user-friendly collision messages (e.g. "Code already used by XYZ").
 */
export function findProjectByCode(
  code: string,
  allProjects: Project[],
  excludeProjectId?: string
): Project | undefined {
  if (!code || !code.trim()) return undefined;
  const cleanCode = code.trim().toUpperCase();
  return allProjects.find(
    (p) =>
      p.id !== excludeProjectId &&
      p.projectCode?.trim().toUpperCase() === cleanCode
  );
}

/**
 * Generates the next sequential Project Code, e.g. "PRJ-0001", "PRJ-0002".
 * Checks ALL projects ever recorded (including soft-deleted) to ensure codes are never reused.
 * Guarantees that the returned code is strictly unique across the entire database.
 */
export function generateNextProjectCode(
  allProjects: Project[],
  prefix: string = 'PRJ-'
): string {
  let maxIndex = 0;

  for (const p of allProjects) {
    if (!p.projectCode) continue;
    // Match "PRJ-XXXX" or any digits at end
    const match = p.projectCode.match(/PRJ-(\d+)/i) || p.projectCode.match(/(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxIndex) {
        maxIndex = num;
      }
    }
  }

  let nextIndex = maxIndex + 1;
  let candidate = `${prefix}${String(nextIndex).padStart(4, '0')}`;

  // Ensure absolute uniqueness even if irregular or manual codes were previously assigned
  const existingSet = new Set(
    allProjects
      .filter((p) => Boolean(p.projectCode))
      .map((p) => p.projectCode.trim().toUpperCase())
  );

  while (existingSet.has(candidate.toUpperCase())) {
    nextIndex++;
    candidate = `${prefix}${String(nextIndex).padStart(4, '0')}`;
  }

  return candidate;
}
