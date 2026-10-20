import { ProjectStatus } from '../types';

/**
 * Valid operational states for scaffolding rental projects:
 * - ACTIVE: Equipment on site, rental period running
 * - EXTENDED: Rental extended past original due date
 * - RETURNED: Equipment returned to yard (demobilized)
 * - CLOSED: Financially and operationally settled
 * - ON_HOLD: Project paused by customer or office
 * - CANCELLED: Order cancelled before mobilization
 */
export const PROJECT_LIFECYCLE_STATES: ProjectStatus[] = [
  'ACTIVE',
  'EXTENDED',
  'RETURNED',
  'CLOSED',
  'ON_HOLD',
  'CANCELLED',
];

/**
 * Allowed lifecycle transitions matrix to prevent invalid operations
 */
export const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  ACTIVE: ['EXTENDED', 'RETURNED', 'ON_HOLD', 'CANCELLED', 'CLOSED'],
  EXTENDED: ['RETURNED', 'ON_HOLD', 'CLOSED', 'ACTIVE'],
  ON_HOLD: ['ACTIVE', 'EXTENDED', 'RETURNED', 'CANCELLED'],
  RETURNED: ['CLOSED', 'ACTIVE'], // Can reopen to ACTIVE if returned in error
  CLOSED: ['RETURNED', 'ACTIVE'],  // Admin can reopen if needed
  CANCELLED: ['ACTIVE'],
};

export function canTransitionProject(current: ProjectStatus, target: ProjectStatus): boolean {
  if (current === target) return true;
  const allowed = ALLOWED_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

/**
 * Validates if the project is considered active in the yard / on-site
 */
export function isProjectActiveOnSite(status: ProjectStatus): boolean {
  return status === 'ACTIVE' || status === 'EXTENDED' || status === 'ON_HOLD';
}

/**
 * Validates if equipment is returned or closed
 */
export function isProjectReturnedOrClosed(status: ProjectStatus): boolean {
  return status === 'RETURNED' || status === 'CLOSED';
}
