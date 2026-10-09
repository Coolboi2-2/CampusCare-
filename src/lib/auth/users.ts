import { hashPassword, verifyPassword } from './passwords.js';
import type { StaffRole, SessionUser } from './sessions.js';

/**
 * In-memory staff directory. In a production deployment this backs onto the
 * app's database; the surface stays the same. Only administrators and
 * technicians are staff accounts — students are not authenticated here.
 */
export interface StaffUser extends SessionUser {
  passwordHash: string;
}

export interface PublicStaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  department?: string;
}

/** Shape-safe projection: never expose the password hash. */
export function toPublicUser(user: StaffUser | SessionUser): PublicStaffUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.department ? { department: user.department } : {}),
  };
}

export function toSessionUser(user: StaffUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.department ? { department: user.department } : {}),
  };
}

export class UserStore {
  private users = new Map<string, StaffUser>();

  add(user: StaffUser): StaffUser {
    this.users.set(user.id, user);
    return user;
  }

  /** Seed from env without hardcoding credentials; hashes the plaintext at boot. */
  addFromEnv(opts: {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
    department?: string;
    password?: string;
    passwordHash?: string;
  }): StaffUser {
    const passwordHash = opts.passwordHash?.trim() || hashPassword(opts.password as string);
    return this.add({
      id: opts.id,
      name: opts.name,
      email: opts.email,
      role: opts.role,
      department: opts.department,
      passwordHash,
    });
  }

  findByEmail(email: string): StaffUser | undefined {
    const needle = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === needle) return user;
    }
    return undefined;
  }

  findById(id: string): StaffUser | undefined {
    return this.users.get(id);
  }

  list(): StaffUser[] {
    return Array.from(this.users.values());
  }

  setRole(id: string, role: StaffRole): StaffUser | null {
    const user = this.users.get(id);
    if (!user) return null;
    user.role = role;
    return user;
  }

  /**
   * Constant-work credential check: when the account does not exist we still
   * run scrypt against a dummy hash so timing does not reveal valid accounts.
   */
  verifyCredentials(email: string, password: string): StaffUser | null {
    const user = this.findByEmail(email);
    if (!user) {
      verifyPassword(password, 'scrypt$0000000000000000000000000000000000$00');
      return null;
    }
    return verifyPassword(password, user.passwordHash) ? user : null;
  }
}
