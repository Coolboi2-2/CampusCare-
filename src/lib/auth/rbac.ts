import type { UserRole } from '../../types';

/**
 * Explicit permission matrix. Least privilege: a technician cannot perform any
 * administrative operation, and a student holds no staff permission at all.
 */
export type Permission =
  | 'view:admin' // protected admin data / command centre
  | 'view:audit' // sensitive security & admin audit history
  | 'assign:workorder' // assign or reassign work orders
  | 'change:role' // change staff roles
  | 'resolve:override' // approve restricted resolutions
  | 'review:human' // override human-review decisions
  | 'reset:demo'
  | 'start:work'
  | 'submit:repair';

const ADMIN_PERMISSIONS: Permission[] = [
  'view:admin',
  'view:audit',
  'assign:workorder',
  'change:role',
  'resolve:override',
  'review:human',
  'reset:demo',
  'start:work',
  'submit:repair',
];

const TECHNICIAN_PERMISSIONS: Permission[] = ['start:work', 'submit:repair'];

const STUDENT_PERMISSIONS: Permission[] = [];

const MATRIX: Record<UserRole, Permission[]> = {
  admin: ADMIN_PERMISSIONS,
  technician: TECHNICIAN_PERMISSIONS,
  student: STUDENT_PERMISSIONS,
};

export function can(role: UserRole, permission: Permission): boolean {
  return (MATRIX[role] ?? []).includes(permission);
}

export function permissionsFor(role: UserRole): Permission[] {
  return [...(MATRIX[role] ?? [])];
}
