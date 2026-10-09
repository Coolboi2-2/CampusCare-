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

// 5. Assign ticket to technician
app.put('/api/tickets/:id/assign', (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(AssignBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { technicianName, department, actorName, actorRole } = v.data;

  // Validate state transition policy (missing role defaults to least-privilege 'student')
  const validation = validateStateTransition(ticket, 'assigned', {
    actorName: actorName || 'Admin Dispatcher',
    actorRole: (actorRole as UserRole) || 'student',
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  if (department) ticket.department = department;
  if (technicianName) ticket.assignedTechnician = technicianName;

  ticket.status = 'assigned';
  ticket.updatedAt = new Date().toISOString();

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: actorName || 'Admin Dispatcher',
    role: (actorRole as UserRole) || 'student',
    action: `Assigned to ${ticket.assignedTechnician || 'Staff'} (${ticket.department})`,
  });

  return res.json(ticket);
});

// 6. Update ticket status (e.g. Technician starts work)
app.put('/api/tickets/:id/status', (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(StatusBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { status, actor, role, notes } = v.data;

  // Validate state transition policy
  const validation = validateStateTransition(ticket, status as TicketStatus, {
    actorName: actor || 'Staff',
    actorRole: (role as UserRole) || 'student',
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  ticket.status = status as TicketStatus;
  ticket.updatedAt = new Date().toISOString();

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: actor || 'Technician',
    role: role || 'technician',
    action: `Status updated to ${status.replace('_', ' ').toUpperCase()}`,
    notes,
  });

  return res.json(ticket);
});

// 7. Complete repair & trigger AI Before/After Verification
app.post('/api/tickets/:id/repair', async (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(RepairBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { workNotes, afterPhotoUrl, technicianName, role } = v.data;

  // Validate state transition (missing role defaults to least-privilege 'student')
  const validation = validateStateTransition(ticket, 'awaiting_verification', {
    actorName: technicianName || 'Technician',
    actorRole: (role as UserRole) || 'student',
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  const resolvedAfterPhoto = afterPhotoUrl || ticket.beforePhotoUrl;
  const resolvedNotes = workNotes || 'Repairs completed by technician.';

  // Run AI Before/After Verification with strict validation & safety gate
  let assessment: RepairAssessment;
  let decision: VerificationDecision;
  let metadata: AssessmentMetadata;
  try {
    ({ assessment, decision, metadata } = await verifyRepair(
      {
        ticketId: ticket.id,
        originalDescription: ticket.description,
        department: ticket.department,
        beforePhotoUrl: ticket.beforePhotoUrl,
        afterPhotoUrl: resolvedAfterPhoto,
        technicianNotes: resolvedNotes,
        isSafetyCritical: ticket.isSafetyCritical,
      },
      aiClient
    ));
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Repair verification failed' });
  }

  // Only mutate ticket state after verification succeeds.
  ticket.workNotes = resolvedNotes;
  ticket.afterPhotoUrl = resolvedAfterPhoto;
  ticket.status = 'awaiting_verification';
  ticket.updatedAt = new Date().toISOString();

  const attemptRecord: RepairAssessmentRecord = {
    id: `rep-${ticket.repairAttempts.length + 1}`,
    ticketId: ticket.id,
    attemptNumber: ticket.repairAttempts.length + 1,
    originalEvidenceUrl: ticket.beforePhotoUrl,
    afterEvidenceUrl: resolvedAfterPhoto,
    assessment,
    metadata,
    decision: 'pending',
    requiresHumanReview: decision.requiresHumanReview,
    allowedToRequestConfirmation: decision.allowedToRequestConfirmation,
    technicianNotes: resolvedNotes,
    createdAt: new Date().toISOString(),
  };

  // Preserve history
  ticket.repairAttempts.push(attemptRecord);
  ticket.latestVerification = attemptRecord;

  ticket.auditTrail.push({
    id: `evt-${Date.now()}-work`,
    timestamp: ticket.updatedAt,
    actor: technicianName || ticket.assignedTechnician || 'Technician',
    role: 'technician',
    action: `Completed Repair Attempt #${attemptRecord.attemptNumber}`,
    notes: resolvedNotes,
  });

  ticket.auditTrail.push({
    id: `evt-${Date.now()}-ai`,
    timestamp: new Date().toISOString(),
    actor: `CampusCare AI (${metadata.provider === 'gemma' ? 'Gemini 3.8 Flash Live' : 'Deterministic Rule'})`,
    role: 'admin',
    action: `Verification: Outcome=${assessment.visualOutcome}, Action=${assessment.recommendedAction}`,
    notes: `Evidence Quality: ${assessment.evidenceQuality}. ${decision.requiresHumanReview ? 'Requires Human Review.' : 'Eligible for student sign-off.'}`,
  });

  return res.json(ticket);
});

// 8. Confirm resolution (Student or Admin)
app.put('/api/tickets/:id/resolve', (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(ResolveBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { confirmedBy, role, rating, comment } = v.data;

  // Validate state transition policy
  const validation = validateStateTransition(ticket, 'resolved', {
    actorName: confirmedBy || ticket.reporterName,
    actorRole: (role as UserRole) || 'student',
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  ticket.status = 'resolved';
  ticket.updatedAt = new Date().toISOString();
  ticket.resolutionFeedback = {
    confirmedBy: confirmedBy || ticket.reporterName,
    confirmedAt: ticket.updatedAt,
    rating: rating || 5,
    comment: comment || 'Issue verified and confirmed.',
  };

  if (ticket.latestVerification) {
    ticket.latestVerification.decision = 'approved';
    ticket.latestVerification.reviewedBy = confirmedBy || ticket.reporterName;
    ticket.latestVerification.reviewedAt = ticket.updatedAt;
  }

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: confirmedBy || ticket.reporterName,
    role: (role as UserRole) || 'student',
    action: 'Resolution Confirmed & Signed Off',
    notes: comment ? `Rating: ${rating || 5}/5. Note: "${comment}"` : 'Physical repair confirmed in person.',
  });

  return res.json(ticket);
});

// 9. Reopen ticket (Student or Admin)
app.put('/api/tickets/:id/reopen', (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const ticket = tickets.get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const v = validateBody(ReopenBodySchema, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { reason, reopenedBy, role } = v.data;

  // Validate state transition
  const validation = validateStateTransition(ticket, 'reopened', {
    actorName: reopenedBy || ticket.reporterName,
    actorRole: (role as UserRole) || 'student',
  });

  if (!validation.allowed) {
    return res.status(403).json({ error: validation.reason });
  }

  ticket.status = 'reopened';
  ticket.reopenReason = reason;
  ticket.updatedAt = new Date().toISOString();

  if (ticket.latestVerification) {
    ticket.latestVerification.decision = 'rejected';
    ticket.latestVerification.reviewedBy = reopenedBy || ticket.reporterName;
    ticket.latestVerification.reviewedAt = ticket.updatedAt;
  }

  ticket.auditTrail.push({
    id: `evt-${Date.now()}`,
    timestamp: ticket.updatedAt,
    actor: reopenedBy || ticket.reporterName,
    role: (role as UserRole) || 'student',
    action: 'Ticket Reopened',
    notes: `Problem persists: "${reason}". Returned to ${ticket.department} queue (Previous evidence preserved).`,
  });

  return res.json(ticket);
});

// 10. Department Queues & Technician stats
app.get('/api/departments', (req: Request, res: Response) => {
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

// 11. Admin Metrics & Analytics
app.get('/api/analytics', (req: Request, res: Response) => {
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

// 12. Reset demo state to initial 90-second demo walkthrough
app.post('/api/demo/reset', (req: Request, res: Response) => {
  tickets = new Map(initialTickets.map((t) => [t.id, JSON.parse(JSON.stringify(t))]));
  ticketCounter = 1045;
  return res.json({ msg: 'Demo state reset successfully', total: tickets.size });
});

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
