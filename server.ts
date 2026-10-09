import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import {
  Ticket,
  Department,
  Priority,
  TicketStatus,
  RepairAssessmentRecord,
  UserRole,
} from './src/types.js';
import { analyzeIssue } from './src/lib/ai/analyzeIssue.js';
import { verifyRepair } from './src/lib/ai/verifyRepair.js';
import type { VerificationDecision } from './src/lib/ai/verifyRepair.js';
import { validateStateTransition } from './src/lib/workflow/ticketTransitions.js';
import type {
  IssueAnalysis,
  RepairAssessment,
  AssessmentMetadata,
} from './src/lib/ai/schemas.js';
import { EvidenceStore } from './src/lib/evidence/store.js';
import { ChallengeStore } from './src/lib/evidence/challenge.js';
import type { ChallengeState } from './src/lib/evidence/challenge.js';
import { extractMetadata } from './src/lib/evidence/metadata.js';
import { assessRisk, canRequestConfirmation } from './src/lib/evidence/riskPolicy.js';
import type {
  EvidenceRecord,
  EvidenceReference,
  MetadataSignals,
} from './src/lib/evidence/types.js';
import type { InlineImagePart } from './src/lib/ai/image.js';
import { SessionStore } from './src/lib/auth/sessions.js';
import type { Session } from './src/lib/auth/sessions.js';
import { UserStore, toPublicUser, toSessionUser } from './src/lib/auth/users.js';
import { can } from './src/lib/auth/rbac.js';
import type { Permission } from './src/lib/auth/rbac.js';
import { RateLimiter } from './src/lib/auth/rateLimit.js';
import { SecurityAuditLog } from './src/lib/auth/securityLog.js';
import { parseCookieHeader } from './src/lib/auth/cookies.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: Session | null;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// =================== REQUEST VALIDATION ===================
const DepartmentSchema = z.enum(['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'HVAC', 'General']);
const RoleSchema = z.enum(['student', 'technician', 'admin']);
const LocationSchema = z.object({
  zone: z.string().min(1),
  building: z.string().min(1),
  floor: z.string().min(1),
  room: z.string().min(1),
});
const LocationInputSchema = z.union([LocationSchema, z.string().min(1)]);
// Empty string is tolerated (treated as "no photo") so clearing the URL field doesn't 400.
const OptionalUrl = z.union([z.url(), z.literal('')]).optional();

const AnalyzeBodySchema = z.object({
  description: z.string().min(5),
  location: LocationInputSchema.optional(),
  photoUrl: OptionalUrl,
});
const CreateTicketBodySchema = z.object({
  reporterName: z.string().min(1).optional(),
  reporterEmail: z.email().optional(),
  reporterPhone: z.string().optional(),
  description: z.string().min(5),
  location: LocationInputSchema,
  beforePhotoUrl: OptionalUrl,
  customDepartment: DepartmentSchema.optional(),
});
const AssignBodySchema = z.object({
  technicianName: z.string().min(1).optional(),
  department: DepartmentSchema.optional(),
  actorName: z.string().min(1).optional(),
  actorRole: RoleSchema.optional(),
});
const StatusBodySchema = z.object({
  status: z.enum([
    'reported',
    'assigned',
    'in_progress',
    'awaiting_verification',
    'resolved',
    'reopened',
    'escalated',
  ]),
  actor: z.string().min(1).optional(),
  role: RoleSchema.optional(),
  notes: z.string().optional(),
});
const RepairBodySchema = z.object({
  workNotes: z.string().optional(),
  afterPhotoUrl: OptionalUrl,
  // Phase 2.5: in-app capture sends preserved bytes; a URL remains supported.
  afterPhotoBase64: z.string().optional(),
  challengeId: z.string().optional(),
  technicianName: z.string().min(1).optional(),
  role: RoleSchema.optional(),
});
const ResolveBodySchema = z.object({
  confirmedBy: z.string().min(1).optional(),
  role: RoleSchema.optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});
const ReopenBodySchema = z.object({
  reason: z.string().min(1),
  reopenedBy: z.string().min(1).optional(),
  role: RoleSchema.optional(),
});
const LoginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
const RoleUpdateBodySchema = z.object({
  role: z.enum(['admin', 'technician']),
});

function validateBody(schema: z.ZodType, body: unknown): { data?: any; error?: string } {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid request body' };
  }
  return { data: parsed.data };
}

// Initialize Google Gemini Client if API key is present
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// =================== PHASE 2.5: EVIDENCE INTEGRITY ===================
// Preserved evidence assets (bytes addressed by a stable key) and one-time
// repair-session challenges. In a production deployment these back onto the
// app's database/storage provider; the interfaces here stay the same.
const evidenceStore = new EvidenceStore();
const challengeStore = new ChallengeStore();

// =================== AUTHENTICATION & RBAC ===================
// Server-side sessions + scrypt password hashing + an explicit permission matrix.
// Staff accounts are seeded from environment variables; no credentials are
// hardcoded and no client-supplied role flag unlocks a privileged action.
const COOKIE_NAME = 'cc_session';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const users = new UserStore();
const sessions = new SessionStore();
const securityLog = new SecurityAuditLog();
const loginIpLimiter = new RateLimiter(100, 15 * 60 * 1000);
const loginAccountLimiter = new RateLimiter(5, 15 * 60 * 1000);

function seedStaffUsers(): void {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (adminEmail && (process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH)) {
    users.addFromEnv({
      id: 'staff-admin-1',
      name: process.env.ADMIN_NAME?.trim() || 'Campus Warden',
      email: adminEmail,
      role: 'admin',
      password: process.env.ADMIN_PASSWORD,
      passwordHash: process.env.ADMIN_PASSWORD_HASH,
    });
  } else {
    console.warn(
      '[CampusCare] Admin authentication is NOT configured. Set ADMIN_EMAIL plus ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) to enable the Admin / Warden sign-in.'
    );
  }

  const techEmail = process.env.TECHNICIAN_EMAIL?.trim();
  if (techEmail && (process.env.TECHNICIAN_PASSWORD || process.env.TECHNICIAN_PASSWORD_HASH)) {
    users.addFromEnv({
      id: 'staff-tech-1',
      name: process.env.TECHNICIAN_NAME?.trim() || 'Maintenance Technician',
      email: techEmail,
      role: 'technician',
      department: process.env.TECHNICIAN_DEPARTMENT?.trim() || undefined,
      password: process.env.TECHNICIAN_PASSWORD,
      passwordHash: process.env.TECHNICIAN_PASSWORD_HASH,
    });
  }
}
seedStaffUsers();

function clientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.ip || req.socket.remoteAddress || 'unknown';
  return String(ip).trim();
}

function setSessionCookie(res: Response, session: Session): void {
  res.cookie(COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    maxAge: sessions.idleTtlMs,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: IS_PRODUCTION, path: '/' });
}

// Resolve the session (if any) on every request and renew the idle window.
app.use((req: Request, res: Response, next: NextFunction) => {
  const token = parseCookieHeader(req.headers.cookie)[COOKIE_NAME];
  const session = token ? sessions.get(token) : null;
  req.auth = session;
  if (session) setSessionCookie(res, session);
  next();
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
  return next();
}

/** Authenticated + permission check, with optional CSRF enforcement for mutations. */
function requirePermission(permission: Permission, opts: { csrf?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
    if (!can(req.auth.user.role, permission)) {
      securityLog.record({
        actor: req.auth.user.email,
        role: req.auth.user.role,
        action: 'access_denied',
        detail: `${req.method} ${req.originalUrl} (missing ${permission})`,
        ip: clientIp(req),
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (opts.csrf && !sessions.csrfMatches(req.auth, req.header('x-csrf-token'))) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }
    return next();
  };
}

/** Enforce CSRF only for authenticated (cookie-bearing) state changes. */
function csrfGuardIfAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.auth && !sessions.csrfMatches(req.auth, req.header('x-csrf-token'))) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  return next();
}

/**
 * Resolve the effective actor. A real session is authoritative and can never be
 * downgraded by client input. Without a session the client may only claim the
 * low-privilege demo roles (student/technician) — `admin` always requires a
 * valid session, so privileged actions cannot be unlocked from the browser.
 */
function resolveActor(
  req: Request,
  fallbackName?: string,
  fallbackRole?: string
): { name: string; role: UserRole } {
  if (req.auth) {
    return { name: req.auth.user.name, role: req.auth.user.role };
  }
  const headerRole = req.header('x-actor-role');
  const headerName = req.header('x-actor-name');
  const requested = headerRole || fallbackRole || 'student';
  const role: UserRole = requested === 'technician' ? 'technician' : 'student';
  return { name: headerName || fallbackName || 'Unknown Actor', role };
}

/** Evidence reads require a session or an explicit low-privilege demo actor. */
function requireActor(req: Request, res: Response, next: NextFunction) {
  const demoRole = req.header('x-actor-role') || (req.query.role as string | undefined);
  const allowed = Boolean(req.auth) || demoRole === 'student' || demoRole === 'technician';
  if (!allowed) {
    return res.status(401).json({ error: 'Actor role required to access evidence' });
  }
  return next();
}

function mimeForFormat(format: string | null): string {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'tiff':
      return 'image/tiff';
    case 'avif':
      return 'image/avif';
    case 'heif':
      return 'image/heif';
    default:
      return 'application/octet-stream';
  }
}

/** Decode a data URL or raw base64 body into bytes. Size is enforced by the store. */
function decodeBase64Image(input: string): Buffer {
  const commaIndex = input.indexOf(',');
  const payload = input.startsWith('data:') && commaIndex >= 0 ? input.slice(commaIndex + 1) : input;
  const cleaned = payload.replace(/\s/g, '');
  if (!cleaned) throw new Error('No image data provided');
  return Buffer.from(cleaned, 'base64');
}

function toEvidenceReference(record: EvidenceRecord): EvidenceReference {
  return {
    id: record.id,
    sha256: record.sha256,
    format: record.format,
    width: record.width,
    height: record.height,
    bytes: record.bytes,
    dHash: record.dHash,
  };
}

function toInlinePart(record: EvidenceRecord, bytes: Buffer): InlineImagePart {
  return { inlineData: { mimeType: mimeForFormat(record.format), data: bytes.toString('base64') } };
}

// In-Memory Seed Tickets conforming to CampusCare AI Reliability v1
let ticketCounter = 1045;

const initialTickets: Ticket[] = [
  {
    id: 'CC-2026-1042',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    reporterName: 'Aarav Patel',
    reporterEmail: 'aarav.patel@campus.edu',
    reporterPhone: '+1 (555) 482-1920',
    description: 'Water is leaking heavily under the sink washbasin whenever the tap runs. The cabinet base is soaked.',
    location: {
      zone: 'Hostel Village',
      building: 'Block B - Oak Hall',
      floor: '3rd Floor',
      room: 'Room 308 (Washroom)',
    },
    beforePhotoUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    department: 'Plumbing',
    status: 'reported',
    isSafetyCritical: false,
    aiAssessment: {
      title: 'Water leakage under washbasin pipe joint',
      category: 'Plumbing',
      priority: 'Medium',
      observations: [
        'Visible moisture pooling around the P-trap drainage slip-joint.',
        'Continuous slow drip when water pressure is applied to the faucet.',
        'Cabinet base floor exhibits swelling risk if left unaddressed.',
      ],
      recommendedDepartment: 'Plumbing',
      needsHumanReview: false,
      reviewReasons: [],
    },
    issueAnalysisMetadata: {
      provider: geminiApiKey ? 'gemma' : 'fallback',
      modelId: geminiApiKey ? 'gemini-3.8-flash' : undefined,
      promptVersion: '2.0-gemma-audit',
      schemaVersion: '1.0',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      fallbackReason: geminiApiKey ? undefined : 'Live API unattached - deterministic fallback active',
      isSafetyCritical: false,
    },
    repairAttempts: [],
    auditTrail: [
      {
        id: 'evt-1',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        actor: 'Aarav Patel',
        role: 'student',
        action: 'Reported issue with photo & natural description',
        notes: 'Submitted via CampusCare Student Portal',
      },
      {
        id: 'evt-2',
        timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
        actor: 'CampusCare AI Orchestrator',
        role: 'admin',
        action: 'Validated Schema & Triage Routing',
        notes: 'Classified as Plumbing (Priority: Medium). Dispatched to Plumbing queue.',
      },
    ],
  },
  {
    id: 'CC-2026-1039',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    reporterName: 'Sarah Jenkins',
    reporterEmail: 's.jenkins@campus.edu',
    reporterPhone: '+1 (555) 301-9943',
    description: 'The overhead recessed light panel above row 4 is violently flickering and emits an electrical buzzing hum with occasional spark odor.',
    location: {
      zone: 'Academic Complex',
      building: 'Engineering Hall',
      floor: '2nd Floor',
      room: 'Lecture Hall 201',
    },
    beforePhotoUrl: 'https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=800&q=80',
    department: 'Electrical',
    assignedTechnician: 'Marcus Vance (Senior Electrician)',
    status: 'in_progress',
    isSafetyCritical: true,
    aiAssessment: {
      title: 'Flickering LED ballast & electrical hazard',
      category: 'Electrical',
      priority: 'Critical',
      observations: [
        'Flickering luminaire with audible acoustic hum and reported thermal/spark odor.',
        'High-capacity student facility with potential short-circuit hazard.',
      ],
      recommendedDepartment: 'Electrical',
      needsHumanReview: true,
      reviewReasons: ['High voltage lighting component reported with spark odor requires certified electrician lockout.'],
    },
    issueAnalysisMetadata: {
      provider: geminiApiKey ? 'gemma' : 'fallback',
      promptVersion: '2.0-gemma-audit',
      schemaVersion: '1.0',
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      isSafetyCritical: true,
    },
    workNotes: 'Arrived at site. Isolated circuit breaker panel CB-4B. Replacement ballast unit staged.',
    repairAttempts: [],
    auditTrail: [
      {
        id: 'evt-3',
        timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        actor: 'Sarah Jenkins',
        role: 'student',
        action: 'Reported issue',
      },
      {
        id: 'evt-4',
        timestamp: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
        actor: 'Admin Dispatcher',
        role: 'admin',
        action: 'Safety Flagged & Assigned to Electrical',
        notes: 'Flagged as Safety-Critical. Assigned to Marcus Vance.',
      },
      {
        id: 'evt-5',
        timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        actor: 'Marcus Vance',
        role: 'technician',
        action: 'Started Work',
        notes: 'Technician accepted ticket and verified circuit lockout.',
      },
    ],
  },
  {
    id: 'CC-2026-1031',
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    reporterName: 'Carlos Rivera',
    reporterEmail: 'c.rivera@campus.edu',
    description: 'Study carrel chair armrest was splintered and loose metal bracket was exposed.',
    location: {
      zone: 'Central Library',
      building: 'Main Library Tower',
      floor: '4th Floor',
      room: 'Silent Study Pod #14',
    },
    beforePhotoUrl: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=800&q=80',
    afterPhotoUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    department: 'Carpentry',
    assignedTechnician: 'Devon Lee (Carpentry Lead)',
    status: 'awaiting_verification',
    isSafetyCritical: false,
    aiAssessment: {
      title: 'Splintered wooden armrest and exposed bracket',
      category: 'Carpentry',
      priority: 'Medium',
      observations: [
        'Rough wooden fracture along primary arm support.',
        'Protruding metal mounting screw poses tear/scratch hazard.',
      ],
      recommendedDepartment: 'Carpentry',
      needsHumanReview: false,
      reviewReasons: [],
    },
    issueAnalysisMetadata: {
      provider: 'fallback',
      promptVersion: '1.0',
      schemaVersion: '1.0',
      createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      isSafetyCritical: false,
    },
    workNotes: 'Replaced wooden armrest with smooth ergonomic oak finish and countersunk stainless screws.',
    repairAttempts: [
      {
        id: 'rep-1',
        ticketId: 'CC-2026-1031',
        attemptNumber: 1,
        originalEvidenceUrl: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=800&q=80',
        afterEvidenceUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
        technicianNotes: 'Replaced wooden armrest with smooth ergonomic oak finish and countersunk stainless screws.',
        assessment: {
          visibleChanges: [
            'New sanded oak armrest installed with uniform surface finish.',
            'Fastener bracket securely recessed with zero protruding hardware.',
          ],
          remainingConcerns: [],
          evidenceQuality: 'clear',
          visualOutcome: 'improved',
          needsHumanReview: false,
          recommendedAction: 'request_confirmation',
        },
        metadata: {
          provider: 'fallback',
          promptVersion: '2.0-visual-comparison',
          schemaVersion: '1.0',
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          fallbackReason: 'Deterministic visual verification rule',
          isSafetyCritical: false,
        },
        decision: 'pending',
        requiresHumanReview: false,
        allowedToRequestConfirmation: true,
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ],
    latestVerification: {
      id: 'rep-1',
      ticketId: 'CC-2026-1031',
      attemptNumber: 1,
      originalEvidenceUrl: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=800&q=80',
      afterEvidenceUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
      technicianNotes: 'Replaced wooden armrest with smooth ergonomic oak finish and countersunk stainless screws.',
      assessment: {
        visibleChanges: [
          'New sanded oak armrest installed with uniform surface finish.',
          'Fastener bracket securely recessed with zero protruding hardware.',
        ],
        remainingConcerns: [],
        evidenceQuality: 'clear',
        visualOutcome: 'improved',
        needsHumanReview: false,
        recommendedAction: 'request_confirmation',
      },
      metadata: {
        provider: 'fallback',
        promptVersion: '2.0-visual-comparison',
        schemaVersion: '1.0',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        fallbackReason: 'Deterministic visual verification rule',
        isSafetyCritical: false,
      },
      decision: 'pending',
      requiresHumanReview: false,
      allowedToRequestConfirmation: true,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    auditTrail: [
      {
        id: 'evt-6',
        timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
        actor: 'Carlos Rivera',
        role: 'student',
        action: 'Reported issue',
      },
      {
        id: 'evt-7',
        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        actor: 'Devon Lee',
        role: 'technician',
        action: 'Completed Repairs & Uploaded After-Photo',
      },
      {
        id: 'evt-8',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        actor: 'CampusCare Verification Engine',
        role: 'admin',
        action: 'Visual Outcome: Improved (Clear Evidence)',
        notes: 'Verification rules passed. Awaiting final student sign-off.',
      },
    ],
  },
];

// Deep-copy the seeds so live mutations never corrupt the pristine demo state.
let tickets: Map<string, Ticket> = new Map(
  initialTickets.map((t) => [t.id, JSON.parse(JSON.stringify(t)) as Ticket])
);

// =================== API ROUTES ===================

// 1. Analyze issue prior to submission
app.post('/api/tickets/analyze', async (req: Request, res: Response) => {
  const v = validateBody(AnalyzeBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { description, location, photoUrl } = v.data;

  const locationString = typeof location === 'object'
    ? `${location.zone || ''} > ${location.building || ''} > ${location.room || ''}`
    : String(location || 'Campus');

  try {
    const result = await analyzeIssue(
      {
        description,
        locationText: locationString,
        photoUrl,
      },
      aiClient
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Analysis error' });
  }
});

// 2. List all tickets with optional filtering
app.get('/api/tickets', (req: Request, res: Response) => {
  const { department, status, priority, reporterEmail, search } = req.query;
  let result = Array.from(tickets.values());

  if (department && department !== 'All') {
    result = result.filter((t) => t.department.toLowerCase() === String(department).toLowerCase());
  }
  if (status && status !== 'All') {
    result = result.filter((t) => t.status === status);
  }
  if (priority && priority !== 'All') {
    result = result.filter((t) => t.aiAssessment.priority.toLowerCase() === String(priority).toLowerCase());
  }
  if (reporterEmail) {
    result = result.filter((t) => t.reporterEmail.toLowerCase() === String(reporterEmail).toLowerCase());
  }
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.aiAssessment.title.toLowerCase().includes(q) ||
        (t.location.building || '').toLowerCase().includes(q) ||
        (t.location.room || '').toLowerCase().includes(q)
    );
  }

  // Sort latest first
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(result);
});

// 3. Get single ticket by ID
app.get('/api/tickets/:id', (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  return res.json(ticket);
});

// 4. Create new ticket
app.post('/api/tickets', async (req: Request, res: Response) => {
  const v = validateBody(CreateTicketBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const {
    reporterName,
    reporterEmail,
    reporterPhone,
    description,
    location,
    beforePhotoUrl,
    customDepartment,
  } = v.data;

  const locationString = typeof location === 'object'
    ? `${location.zone || ''} > ${location.building || ''} > ${location.room || ''}`
    : String(location);

  // Run structured AI analysis
  let analysis: IssueAnalysis;
  let metadata: AssessmentMetadata;
  try {
    ({ analysis, metadata } = await analyzeIssue(
      {
        description,
        locationText: locationString,
        photoUrl: beforePhotoUrl,
      },
      aiClient
    ));
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Issue analysis failed' });
  }

  const newTicketId = `CC-2026-${++ticketCounter}`;
  const now = new Date().toISOString();

  const assignedDepartment: Department = customDepartment || analysis.recommendedDepartment;
  const isSafetyCritical = analysis.priority === 'Critical' || analysis.needsHumanReview;

  const newTicket: Ticket = {
    id: newTicketId,
    createdAt: now,
    updatedAt: now,
    reporterName: reporterName || 'Campus Student',
    reporterEmail: reporterEmail || 'student@campus.edu',
    reporterPhone,
    description: description.trim(),
    location: typeof location === 'object' ? location : {
      zone: 'Campus Facility',
      building: location,
      floor: 'Floor 1',
      room: 'Main Area',
    },
    beforePhotoUrl: beforePhotoUrl || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    department: assignedDepartment,
    status: 'reported',
    isSafetyCritical,
    aiAssessment: analysis,
    issueAnalysisMetadata: metadata,
    repairAttempts: [],
    auditTrail: [
      {
        id: `evt-${Date.now()}-1`,
        timestamp: now,
        actor: reporterName || 'Student',
        role: 'student',
        action: 'Reported issue',
        notes: `Submitted with photo & natural description`,
      },
      {
        id: `evt-${Date.now()}-2`,
        timestamp: now,
        actor: `CampusCare (${metadata.provider === 'gemma' ? 'Live Gemini 3.8 Flash' : 'Deterministic Engine'})`,
        role: 'admin',
        action: `Routed to ${assignedDepartment}`,
        notes: `Priority: ${analysis.priority}. Mode: ${metadata.provider.toUpperCase()}.${isSafetyCritical ? ' Flagged for Safety Review.' : ''}`,
      },
    ],
  };

  tickets.set(newTicket.id, newTicket);
  return res.status(201).json(newTicket);
});

// 5. Assign / reassign a work order (admin only; real session required).
app.put(
  '/api/tickets/:id/assign',
  requirePermission('assign:workorder', { csrf: true }),
  (req: Request, res: Response) => {
    const ticketId = String(req.params.id);
    const ticket = tickets.get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const v = validateBody(AssignBodySchema, req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const { technicianName, department } = v.data;

    // The acting identity always comes from the server-side session.
    const actor = req.auth!.user;
    const validation = validateStateTransition(ticket, 'assigned', {
      actorName: actor.name,
      actorRole: actor.role,
    });

    if (!validation.allowed) {
      return res.status(403).json({ error: validation.reason });
    }

    const previousTechnician = ticket.assignedTechnician;
    if (department) ticket.department = department;
    if (technicianName) ticket.assignedTechnician = technicianName;

    ticket.status = 'assigned';
    ticket.updatedAt = new Date().toISOString();

    ticket.auditTrail.push({
      id: `evt-${Date.now()}`,
      timestamp: ticket.updatedAt,
      actor: actor.name,
      role: actor.role,
      action: `${previousTechnician ? 'Reassigned' : 'Assigned'} to ${ticket.assignedTechnician || 'Staff'} (${ticket.department})`,
    });

    securityLog.record({
      actor: actor.email,
      role: actor.role,
      action: previousTechnician ? 'work_order_reassigned' : 'work_order_assigned',
      detail: `${ticket.id} → ${ticket.department}${ticket.assignedTechnician ? ` / ${ticket.assignedTechnician}` : ''}`,
      ip: clientIp(req),
    });

    return res.json(ticket);
  }
);

// 6. Update ticket status (e.g. Technician starts work)
app.put('/api/tickets/:id/status', csrfGuardIfAuthenticated, (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(StatusBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { status, actor, role, notes } = v.data;
  const effective = resolveActor(req, actor, role);

  // Validate state transition policy (a client-asserted role is capped below admin).
  const validation = validateStateTransition(ticket, status as TicketStatus, {
    actorName: effective.name,
    actorRole: effective.role,
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  ticket.status = status as TicketStatus;
  ticket.updatedAt = new Date().toISOString();

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: effective.name,
    role: effective.role,
    action: `Status updated to ${status.replace('_', ' ').toUpperCase()}`,
    notes,
  });

  return res.json(ticket);
});

// 7. Complete repair & trigger AI Before/After Verification
app.post('/api/tickets/:id/repair', csrfGuardIfAuthenticated, async (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(RepairBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { workNotes, afterPhotoUrl, afterPhotoBase64, challengeId, technicianName, role } = v.data;

  const actor = resolveActor(req, technicianName, role);

  // Validate state transition (missing role defaults to least-privilege 'student')
  const validation = validateStateTransition(ticket, 'awaiting_verification', {
    actorName: actor.name,
    actorRole: actor.role,
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  const resolvedNotes = workNotes || 'Repairs completed by technician.';
  const resolvedAfterPhoto = afterPhotoUrl || ticket.beforePhotoUrl;

  // --- Challenge state: the server owns the code; the client only holds an id. ---
  // Any authorized evidence submission requires a session challenge. Omitting
  // it is not a way to avoid the check: absence routes to review, and an
  // unknown/expired/reused id is treated as an invalid challenge state.
  const challengeRequired = actor.role === 'technician' || actor.role === 'admin';
  const challengeValidation = challengeId
    ? challengeStore.validate(String(challengeId), ticketId)
    : undefined;
  const expectedCode = challengeValidation?.record?.code;

  // --- Preserve evidence bytes now; verification never re-fetches mutable URLs. ---
  let afterEvidence: EvidenceRecord;
  try {
    afterEvidence = afterPhotoBase64
      ? await evidenceStore.ingestBytes(ticketId, 'after', decodeBase64Image(afterPhotoBase64), actor)
      : await evidenceStore.ingestFromUrl(ticketId, 'after', resolvedAfterPhoto, actor);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: `After-repair evidence rejected: ${err?.message || 'unreadable image'}` });
  }

  let beforeEvidence: EvidenceRecord | undefined;
  try {
    beforeEvidence = await evidenceStore.ingestFromUrl(ticketId, 'before', ticket.beforePhotoUrl, actor);
  } catch {
    // Original evidence unavailable; verification still proceeds via the URL.
  }

  const sameImage = Boolean(beforeEvidence && beforeEvidence.sha256 === afterEvidence.sha256);
  const reuseMatches = evidenceStore
    .findReuse(afterEvidence)
    .filter((m) => !(sameImage && m.type === 'exact' && m.evidenceId === beforeEvidence?.id));

  const afterBytes = evidenceStore.getBytes(afterEvidence.id)!;
  let metadataSignals: MetadataSignals;
  try {
    metadataSignals = await extractMetadata(afterBytes, {
      format: afterEvidence.format!,
      width: afterEvidence.width!,
      height: afterEvidence.height!,
    });
  } catch {
    metadataSignals = {
      hasCameraMetadata: false,
      format: afterEvidence.format,
      width: afterEvidence.width,
      height: afterEvidence.height,
    };
  }

  const beforeBytes = beforeEvidence ? evidenceStore.getBytes(beforeEvidence.id) : undefined;

  // Stable, authorized viewing URL to the preserved asset. Used for the
  // verification input and stored on the ticket so base64 captures still
  // display and are never confused with the before-photo URL.
  const preservedAfterUrl = afterPhotoUrl || `/api/evidence/${afterEvidence.id}/raw?role=technician`;

  // Run AI Before/After Verification with strict validation & safety gate
  let assessment: RepairAssessment;
  let decision: VerificationDecision;
  let metadata: AssessmentMetadata;
  let integrity: { sameImage: boolean };
  try {
    ({ assessment, decision, metadata, integrity } = await verifyRepair(
      {
        ticketId: ticket.id,
        originalDescription: ticket.description,
        department: ticket.department,
        beforePhotoUrl: ticket.beforePhotoUrl,
        afterPhotoUrl: preservedAfterUrl,
        technicianNotes: resolvedNotes,
        isSafetyCritical: ticket.isSafetyCritical,
        beforeEvidence: beforeEvidence ? toEvidenceReference(beforeEvidence) : undefined,
        afterEvidence: toEvidenceReference(afterEvidence),
        beforeInline:
          beforeEvidence && beforeBytes ? toInlinePart(beforeEvidence, beforeBytes) : undefined,
        afterInline: toInlinePart(afterEvidence, afterBytes),
        metadataSignals,
        challengeRequired,
        challengeCode: expectedCode,
      },
      aiClient
    ));
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Repair verification failed' });
  }

  // --- Challenge outcome: server validates its own state; the model only reads. ---
  let challengeStatus: 'match' | 'mismatch' | 'unreadable' | 'absent' =
    assessment.challengeCodeStatus || 'absent';
  let challengeStateInvalid = false;
  let challengeStateReason: string | undefined;
  if (challengeId && challengeValidation?.state !== 'valid') {
    challengeStateInvalid = true;
    challengeStateReason = challengeValidation?.state || 'unknown';
    challengeStatus = 'absent';
  }

  // --- Deterministic risk policy (never a model-supplied numeric score) ---
  const risk = assessRisk({
    ticketId: ticket.id,
    isSafetyCritical: ticket.isSafetyCritical,
    modelNeedsHumanReview: decision.requiresHumanReview,
    sameImage: integrity.sameImage,
    reuseMatches,
    challenge: {
      required: challengeRequired,
      status: challengeStatus,
      stateInvalid: challengeStateInvalid,
      stateReason: challengeStateReason,
    },
    metadata: metadataSignals,
    assessment,
  });

  const requiresHumanReview = risk.requiresHumanReview || decision.requiresHumanReview;
  const allowedToRequestConfirmation =
    risk.level === 'low' && !requiresHumanReview && decision.allowedToRequestConfirmation;

  // Only mutate ticket state after verification succeeds.
  ticket.workNotes = resolvedNotes;
  ticket.afterPhotoUrl = preservedAfterUrl;
  ticket.status = risk.blocked ? 'escalated' : 'awaiting_verification';
  ticket.updatedAt = new Date().toISOString();

  const attemptRecord: RepairAssessmentRecord = {
    id: `rep-${ticket.repairAttempts.length + 1}`,
    ticketId: ticket.id,
    attemptNumber: ticket.repairAttempts.length + 1,
    originalEvidenceUrl: ticket.beforePhotoUrl,
    afterEvidenceUrl: preservedAfterUrl,
    assessment,
    metadata,
    decision: 'pending',
    requiresHumanReview,
    allowedToRequestConfirmation,
    technicianNotes: resolvedNotes,
    createdAt: new Date().toISOString(),
    beforeEvidence: beforeEvidence ? toEvidenceReference(beforeEvidence) : undefined,
    afterEvidence: toEvidenceReference(afterEvidence),
    riskLevel: risk.level,
    riskSignals: risk.signals,
    challengeState: {
      id: challengeId ? String(challengeId) : undefined,
      status: challengeStatus,
      required: challengeRequired,
      state: challengeValidation?.state,
    },
  };

  // Preserve history
  ticket.repairAttempts.push(attemptRecord);
  ticket.latestVerification = attemptRecord;

  if (challengeRequired && challengeValidation?.state === 'valid') {
    challengeStore.markUsed(String(challengeId));
  }
  if (risk.level !== 'low') evidenceStore.markFlagged(afterEvidence.id);

  ticket.auditTrail.push({
    id: `evt-${Date.now()}-work`,
    timestamp: ticket.updatedAt,
    actor: actor.name,
    role: actor.role,
    action: `Completed Repair Attempt #${attemptRecord.attemptNumber}`,
    notes: resolvedNotes,
  });

  ticket.auditTrail.push({
    id: `evt-${Date.now()}-ai`,
    timestamp: new Date().toISOString(),
    actor: `CampusCare AI (${metadata.provider === 'gemma' ? 'Gemini 3.8 Flash Live' : 'Deterministic Rule'})`,
    role: 'admin',
    action: `Verification: Outcome=${assessment.visualOutcome}, Action=${assessment.recommendedAction}, Risk=${risk.level}`,
    notes: `Evidence sha256(a)=${afterEvidence.sha256.slice(0, 12)}…, ${afterEvidence.format} ${afterEvidence.width}x${afterEvidence.height}. ${requiresHumanReview ? 'Requires Human Review.' : 'Eligible for student sign-off.'}${risk.signals.length ? ' Signals: ' + risk.signals.map((s) => s.code).join(', ') : ''}`,
  });

  return res.json(ticket);
});

// 7b. Issue a one-time repair-session challenge (technician/admin only)
app.post('/api/tickets/:id/repair/challenge', csrfGuardIfAuthenticated, (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const actor = resolveActor(req, req.body?.technicianName, req.body?.role);
  if (actor.role !== 'technician' && actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only technicians or admins may request a repair challenge' });
  }
  if (ticket.status === 'resolved') {
    return res.status(409).json({ error: 'Cannot start repair evidence for a resolved ticket' });
  }

  const record = challengeStore.issue({ ticketId, actor: actor.name, actorRole: actor.role });
  return res.json({ challengeId: record.id, code: record.code, expiresAt: record.expiresAt, ticketId });
});

// 7c. Access-controlled evidence metadata and preserved bytes
app.get('/api/evidence/:id', requireActor, (req: Request, res: Response) => {
  const record = evidenceStore.get(String(req.params.id));
  if (!record) return res.status(404).json({ error: 'Evidence not found' });
  const { storageKey, ...safe } = record;
  void storageKey;
  return res.json(safe);
});

app.get('/api/evidence/:id/raw', requireActor, (req: Request, res: Response) => {
  const record = evidenceStore.get(String(req.params.id));
  if (!record) return res.status(404).json({ error: 'Evidence not found' });
  const bytes = evidenceStore.getBytes(record.id);
  if (!bytes) return res.status(410).json({ error: 'Evidence bytes unavailable' });
  res.setHeader('Content-Type', mimeForFormat(record.format));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.send(bytes);
});


// 8. Confirm resolution (Student or Admin)
app.put('/api/tickets/:id/resolve', csrfGuardIfAuthenticated, (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(ResolveBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { confirmedBy, rating, comment } = v.data;

  // Identity is session-derived; a client cannot assert the admin role here.
  const effective = resolveActor(req, confirmedBy || ticket.reporterName);
  const isAdmin = req.auth?.user.role === 'admin';

  // Validate state transition policy
  const validation = validateStateTransition(ticket, 'resolved', {
    actorName: effective.name,
    actorRole: effective.role,
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  // Belt-and-suspenders backend enforcement: even if the state machine allowed
  // it, an integrity-review or safety-critical ticket cannot be confirmed by a
  // non-admin. Confirmation UI is not the security boundary.
  const gate = canRequestConfirmation(
    ticket.latestVerification?.riskLevel ? { level: ticket.latestVerification.riskLevel } : undefined,
    ticket.latestVerification,
    ticket.isSafetyCritical,
    isAdmin
  );
  if (!gate.allowed) {
    return res.status(403).json({ error: gate.reason });
  }

  ticket.status = 'resolved';
  ticket.updatedAt = new Date().toISOString();
  ticket.resolutionFeedback = {
    confirmedBy: effective.name,
    confirmedAt: ticket.updatedAt,
    rating: rating || 5,
    comment: comment || 'Issue verified and confirmed.',
  };

  if (ticket.latestVerification) {
    ticket.latestVerification.decision = 'approved';
    ticket.latestVerification.reviewedBy = effective.name;
    ticket.latestVerification.reviewedAt = ticket.updatedAt;
  }

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: effective.name,
    role: effective.role,
    action: isAdmin ? 'Resolution Confirmed by Administrator' : 'Resolution Confirmed & Signed Off',
    notes: comment ? `Rating: ${rating || 5}/5. Note: "${comment}"` : 'Physical repair confirmed in person.',
  });

  if (isAdmin && (ticket.isSafetyCritical || ticket.aiAssessment.needsHumanReview || ticket.latestVerification?.riskLevel === 'high')) {
    securityLog.record({
      actor: req.auth!.user.email,
      role: req.auth!.user.role,
      action: 'resolution_admin_override',
      detail: `${ticket.id} (${[
        ticket.isSafetyCritical ? 'safety-critical' : '',
        ticket.aiAssessment.needsHumanReview ? 'human-review' : '',
      ].filter(Boolean).join(', ') || 'restricted resolution'})`,
      ip: clientIp(req),
    });
  }

  return res.json(ticket);
});

// 9. Reopen ticket (Student or Admin)
app.put('/api/tickets/:id/reopen', csrfGuardIfAuthenticated, (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(ReopenBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { reason, reopenedBy } = v.data;

  const effective = resolveActor(req, reopenedBy || ticket.reporterName);

  // Validate state transition
  const validation = validateStateTransition(ticket, 'reopened', {
    actorName: effective.name,
    actorRole: effective.role,
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  ticket.status = 'reopened';
  ticket.reopenReason = reason;
  ticket.updatedAt = new Date().toISOString();

  if (ticket.latestVerification) {
    ticket.latestVerification.decision = 'rejected';
    ticket.latestVerification.reviewedBy = effective.name;
    ticket.latestVerification.reviewedAt = ticket.updatedAt;
  }

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: effective.name,
    role: effective.role,
    action: 'Ticket Reopened',
    notes: `Problem persists: "${reason}". Returned to ${ticket.department} queue (Previous evidence preserved).`,
  });

  return res.json(ticket);
});

// 10. Department Queues & Technician stats (staff only)
app.get('/api/departments', (req: Request, res: Response) => {
  if (!can(resolveActor(req).role, 'start:work')) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  const departments: Department[] = ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'HVAC', 'General'];
  const allTickets = Array.from(tickets.values());

  const departmentData = departments.map((dept) => {
    const deptTickets = allTickets.filter((t) => t.department === dept);
    const active = deptTickets.filter((t) => t.status !== 'resolved').length;
    const critical = deptTickets.filter((t) => t.isSafetyCritical && t.status !== 'resolved').length;
    const awaitingVerif = deptTickets.filter((t) => t.status === 'awaiting_verification').length;

    return {
      department: dept,
      totalTickets: deptTickets.length,
      activeTickets: active,
      criticalTickets: critical,
      awaitingVerification: awaitingVerif,
      techniciansOnDuty: dept === 'Plumbing' ? 3 : dept === 'Electrical' ? 4 : dept === 'Cleaning' ? 6 : 2,
    };
  });

  return res.json(departmentData);
});

// 11. Admin Metrics & Analytics (admin only)
app.get('/api/analytics', requirePermission('view:admin'), (req: Request, res: Response) => {
  const allTickets = Array.from(tickets.values());
  const total = allTickets.length;
  const active = allTickets.filter((t) => t.status !== 'resolved').length;
  const resolved = allTickets.filter((t) => t.status === 'resolved').length;
  const awaitingVerification = allTickets.filter((t) => t.status === 'awaiting_verification').length;
  const escalated = allTickets.filter(
    (t) => t.status === 'escalated' || t.isSafetyCritical || t.aiAssessment.needsHumanReview
  ).length;

  return res.json({
    total,
    active,
    resolved,
    awaitingVerification,
    escalated,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    aiProvider: geminiApiKey ? 'Live Gemini 3.8 Flash (@google/genai)' : 'Deterministic Rules (Offline Fallback)',
  });
});

// 12. Reset demo state to initial 90-second demo walkthrough (admin only)
app.post('/api/demo/reset', requirePermission('reset:demo', { csrf: true }), (req: Request, res: Response) => {
  tickets = new Map(initialTickets.map((t) => [t.id, JSON.parse(JSON.stringify(t))]));
  ticketCounter = 1045;
  evidenceStore.reset();
  challengeStore.reset();
  securityLog.record({
    actor: req.auth!.user.email,
    role: req.auth!.user.role,
    action: 'demo_state_reset',
    ip: clientIp(req),
  });
  return res.json({ msg: 'Demo state reset successfully', total: tickets.size });
});

// =================== AUTH ROUTES ===================

// Sign in with institutional email + password. Generic errors avoid account enumeration.
app.post('/api/auth/login', (req: Request, res: Response) => {
  const v = validateBody(LoginBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { email, password } = v.data;
  const ip = clientIp(req);

  const ipCheck = loginIpLimiter.check(`ip:${ip}`);
  const accountCheck = loginAccountLimiter.check(`acct:${email.toLowerCase()}`);
  if (!ipCheck.allowed || !accountCheck.allowed) {
    res.setHeader('Retry-After', String(Math.max(ipCheck.retryAfterSec, accountCheck.retryAfterSec)));
    securityLog.record({ actor: email.toLowerCase(), role: 'anonymous', action: 'login_rate_limited', ip });
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
  }

  const user = users.verifyCredentials(email, password);
  if (!user) {
    securityLog.record({ actor: email.toLowerCase(), role: 'anonymous', action: 'login_failed', ip });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Clear the per-account counter on success; the per-IP counter stays as a coarse bound.
  loginAccountLimiter.reset(`acct:${email.toLowerCase()}`);
  const session = sessions.create(toSessionUser(user));
  setSessionCookie(res, session);
  securityLog.record({ actor: user.email, role: user.role, action: 'login_success', ip });
  return res.json({
    user: toPublicUser(user),
    csrfToken: session.csrfToken,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
});

// Current session — the client uses this to gate protected portals on load.
app.get('/api/auth/session', (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json({ error: 'No active session' });
  return res.json({
    user: toPublicUser(req.auth.user),
    csrfToken: req.auth.csrfToken,
    expiresAt: new Date(req.auth.expiresAt).toISOString(),
  });
});

// Logout invalidates the server-side session and clears the cookie.
app.post('/api/auth/logout', requireAuth, csrfGuardIfAuthenticated, (req: Request, res: Response) => {
  const { user, id } = req.auth!;
  sessions.destroy(id);
  clearSessionCookie(res);
  securityLog.record({ actor: user.email, role: user.role, action: 'logout', ip: clientIp(req) });
  return res.status(204).end();
});

// =================== ADMIN ROUTES (admin only) ===================

// Sensitive security / administrative audit history.
app.get('/api/admin/audit', requirePermission('view:audit'), (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  return res.json(securityLog.list(limit));
});

// Staff directory. Password hashes never leave the server.
app.get('/api/admin/users', requirePermission('change:role'), (_req: Request, res: Response) => {
  return res.json(users.list().map(toPublicUser));
});

// Change a staff member's role. Least privilege; cannot demote your own account.
app.put(
  '/api/admin/users/:id/role',
  requirePermission('change:role', { csrf: true }),
  (req: Request, res: Response) => {
    const v = validateBody(RoleUpdateBodySchema, req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const target = users.findById(String(req.params.id));
    if (!target) return res.status(404).json({ error: 'Staff account not found' });
    if (target.id === req.auth!.user.id && v.data.role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own administrator access' });
    }
    const before = target.role;
    if (before === v.data.role) return res.json(toPublicUser(target));
    users.setRole(target.id, v.data.role);
    // A demotion takes effect immediately: drop the target's live sessions.
    if (v.data.role !== 'admin') sessions.destroyAllForUser(target.id);
    securityLog.record({
      actor: req.auth!.user.email,
      role: req.auth!.user.role,
      action: 'staff_role_changed',
      detail: `${target.email}: ${before} → ${v.data.role}`,
      ip: clientIp(req),
    });
    return res.json(toPublicUser(target));
  }
);

// Vite Middleware for Development / Static file serving for Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // JSON error handler so API clients never receive Express HTML error pages.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[CampusCare] Unhandled request error:', err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CampusCare] Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[CampusCare] Failed to start server:', err);
  process.exit(1);
});
