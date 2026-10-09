import { IssueAnalysis, RepairAssessment, AssessmentMetadata } from './lib/ai/schemas';

export type Department =
  | 'Plumbing'
  | 'Electrical'
  | 'Cleaning'
  | 'Carpentry'
  | 'HVAC'
  | 'General';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type TicketStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_verification'
  | 'resolved'
  | 'reopened'
  | 'escalated';

export type UserRole = 'student' | 'technician' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: Department;
  campusLocation?: string;
}

export interface LocationDetail {
  zone: string;
  building: string;
  floor: string;
  room: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  notes?: string;
}

export interface RepairAssessmentRecord {
  id: string;
  ticketId: string;
  attemptNumber: number;
  originalEvidenceUrl: string;
  afterEvidenceUrl: string;
  assessment: RepairAssessment;
  metadata: AssessmentMetadata;
  decision: 'pending' | 'approved' | 'rejected';
  requiresHumanReview: boolean;
  allowedToRequestConfirmation: boolean;
  technicianNotes: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface Ticket {
  id: string; // e.g. 'CC-2026-1042'
  createdAt: string;
  updatedAt: string;
  reporterName: string;
  reporterEmail: string;
  reporterPhone?: string;
  description: string;
  location: LocationDetail;
  beforePhotoUrl: string;
  department: Department;
  assignedTechnician?: string;
  status: TicketStatus;
  isSafetyCritical: boolean;

  // AI Issue Analysis
  aiAssessment: IssueAnalysis;
  issueAnalysisMetadata: AssessmentMetadata;

  // Field Repairs & Evidence History
  workNotes?: string;
  afterPhotoUrl?: string;
  repairAttempts: RepairAssessmentRecord[];
  latestVerification?: RepairAssessmentRecord;

  // Resolution & Reopen Feedback
  resolutionFeedback?: {
    confirmedBy: string;
    confirmedAt: string;
    rating?: number;
    comment?: string;
  };
  reopenReason?: string;

  // Immutable Audit Trail
  auditTrail: AuditEvent[];
}

export type { IssueAnalysis, RepairAssessment, AssessmentMetadata };
