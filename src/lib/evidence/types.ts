import type {
  ChallengeCodeStatus,
  SceneMatch,
  RepairOutcome,
  Likelihood,
} from '../ai/schemas';

export type EvidenceType = 'before' | 'after';
export type EvidenceStatus = 'stored' | 'flagged';

/**
 * Identity of an evidence file, derived from the trusted server's own view
 * of the bytes. Never populated from client-supplied values.
 */
export interface EvidenceFingerprint {
  sha256: string;
  dHash: string | null;
  dHashMirrored: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number;
}

/**
 * A preserved evidence asset. Bytes live in controlled storage (see store.ts);
 * this record is the stable, access-controlled reference to them.
 */
export interface EvidenceRecord extends EvidenceFingerprint {
  id: string;
  ticketId: string;
  type: EvidenceType;
  actor: string;
  actorRole: string;
  receivedAt: string;
  storageKey: string;
  status: EvidenceStatus;
}

/** Compact reference persisted onto a RepairAssessmentRecord. */
export interface EvidenceReference {
  id: string;
  sha256: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  dHash: string | null;
}

export interface MetadataSignals {
  hasCameraMetadata: boolean;
  software?: string;
  softwareSuspicious?: string;
  capturedAt?: string;
  gps?: { lat: number; lng: number };
  format: string | null;
  width: number | null;
  height: number | null;
}

export type ReuseMatchType = 'exact' | 'perceptual';

export interface ReuseMatch {
  type: ReuseMatchType;
  evidenceId: string;
  ticketId: string;
  evidenceType: EvidenceType;
  /** Hamming distance for perceptual matches; 0 for exact. */
  similarity: number;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskSignal {
  code: string;
  level: RiskLevel;
  reason: string;
  weight: number;
}

export interface RiskDecision {
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  requiresHumanReview: boolean;
  /** Normal (student) completion is blocked; an administrator must decide. */
  blocked: boolean;
}

export type { ChallengeCodeStatus, SceneMatch, RepairOutcome, Likelihood };

/** The deterministic challenge outcome plus its server-side validation state. */
export interface ChallengeOutcome {
  required: boolean;
  status: ChallengeCodeStatus;
  /** True when the server rejected the challenge id itself (expired/reused/unknown). */
  stateInvalid: boolean;
  stateReason?: string;
}
