import type {
  ChallengeOutcome,
  MetadataSignals,
  ReuseMatch,
  RiskDecision,
  RiskLevel,
  RiskSignal,
} from './types';
import type { RepairAssessment } from '../ai/schemas';

export interface RiskInput {
  ticketId: string;
  isSafetyCritical: boolean;
  /** Model asked for human review, or legacy decision already required it. */
  modelNeedsHumanReview: boolean;
  /** before and after hashes are identical (same bytes). */
  sameImage: boolean;
  reuseMatches: ReuseMatch[];
  challenge: ChallengeOutcome;
  metadata: MetadataSignals;
  assessment: RepairAssessment;
}

/**
 * Configurable weights/thresholds. Rationale: this is a review-routing policy,
 * not an automatic fraud verdict. Any single "high" signal is enough to block
 * normal (student) completion; weaker corroborating signals escalate to medium.
 */
export const RISK_WEIGHTS = {
  sameImage: 10,
  exactReuseDifferentTicket: 10,
  exactReuseSameTicket: 8,
  perceptualReuseDifferentTicket: 4,
  challengeMismatch: 6,
  challengeStateInvalid: 6,
  challengeAbsentRequired: 3,
  challengeUnreadable: 1,
  sceneMismatch: 5,
  sceneUncertain: 1,
  artifactSignals: 2,
  suspiciousSoftware: 3,
  screenshotHigh: 2,
  screenshotMedium: 1,
  syntheticHigh: 2,
  syntheticMedium: 1,
  missingCameraMetadata: 1,
  inadequateEvidence: 2,
  poorOutcome: 2,
  modelReview: 2,
  safetyCritical: 2,
} as const;

export const RISK_THRESHOLDS = {
  medium: 2,
  high: 6,
} as const;

function signal(code: string, level: RiskLevel, weight: number, reason: string): RiskSignal {
  return { code, level, weight, reason };
}

/**
 * Deterministic, testable risk policy. Combines integrity signals into a
 * review level. The model only contributes observations, which are weighted
 * here; it never emits a free numeric score that closes a ticket.
 */
export function assessRisk(input: RiskInput): RiskDecision {
  const signals: RiskSignal[] = [];
  const {
    ticketId,
    isSafetyCritical,
    modelNeedsHumanReview,
    sameImage,
    reuseMatches,
    challenge,
    metadata,
    assessment,
  } = input;
  const w = RISK_WEIGHTS;

  if (sameImage) {
    signals.push(
      signal('same_image', 'high', w.sameImage, 'Before and after evidence are byte-identical.')
    );
  }

  for (const match of reuseMatches) {
    if (match.type === 'exact') {
      const crossTicket = match.ticketId !== ticketId;
      signals.push(
        signal(
          'exact_reuse',
          'high',
          crossTicket ? w.exactReuseDifferentTicket : w.exactReuseSameTicket,
          crossTicket
            ? `Identical evidence bytes were submitted on another ticket (${match.ticketId}).`
            : `Identical evidence bytes were submitted earlier on this ticket (evidence ${match.evidenceId}).`
        )
      );
    }
  }

  // Perceptual matches only matter across tickets: two views of the same repair
  // (same ticket) are expected to look similar and must not be penalized.
  const crossTicketPerceptual = reuseMatches.filter(
    (m) => m.type === 'perceptual' && m.ticketId !== ticketId
  );
  if (crossTicketPerceptual.length > 0) {
    signals.push(
      signal(
        'perceptual_reuse',
        'medium',
        w.perceptualReuseDifferentTicket,
        `After-photo is perceptually near-identical to ${crossTicketPerceptual.length} evidence item(s) on other tickets.`
      )
    );
  }

  if (challenge.stateInvalid) {
    signals.push(
      signal(
        'challenge_invalid',
        'high',
        w.challengeStateInvalid,
        `Repair challenge rejected (${challenge.stateReason || 'expired, reused, or unknown'}).`
      )
    );
  } else if (challenge.required) {
    if (challenge.status === 'mismatch') {
      signals.push(
        signal('challenge_mismatch', 'high', w.challengeMismatch, 'The displayed challenge code does not match the photo.')
      );
    } else if (challenge.status === 'absent') {
      signals.push(
        signal('challenge_absent', 'medium', w.challengeAbsentRequired, 'Required challenge code was not visible in the evidence photo.')
      );
    } else if (challenge.status === 'unreadable') {
      signals.push(
        signal('challenge_unreadable', 'medium', w.challengeUnreadable, 'Challenge code was present but unreadable (blur/lighting).')
      );
    }
  }

  if (assessment.sceneMatch === 'mismatch') {
    signals.push(signal('scene_mismatch', 'high', w.sceneMismatch, 'Before and after do not appear to show the same physical location.'));
  } else if (assessment.sceneMatch === 'uncertain') {
    signals.push(signal('scene_uncertain', 'low', w.sceneUncertain, 'Scene consistency between before and after is uncertain.'));
  }

  if (assessment.screenshotLikelihood === 'high') {
    signals.push(signal('screenshot_high', 'medium', w.screenshotHigh, 'Evidence looks like a screenshot/re-photograph of a screen.'));
  } else if (assessment.screenshotLikelihood === 'medium') {
    signals.push(signal('screenshot_medium', 'low', w.screenshotMedium, 'Possible screenshot characteristics detected.'));
  }

  if (assessment.syntheticLikelihood === 'high') {
    signals.push(signal('synthetic_high', 'medium', w.syntheticHigh, 'Visual indicators suggest a possibly synthetic image.'));
  } else if (assessment.syntheticLikelihood === 'medium') {
    signals.push(signal('synthetic_medium', 'low', w.syntheticMedium, 'Minor synthetic-image indicators detected.'));
  }

  if ((assessment.artifactSignals?.length || 0) >= 2) {
    signals.push(
      signal(
        'artifact_signals',
        'medium',
        w.artifactSignals,
        `Multiple suspicious visual artifacts: ${assessment.artifactSignals!.slice(0, 3).join('; ')}.`
      )
    );
  }

  if (metadata.softwareSuspicious) {
    signals.push(
      signal('software_tag', 'medium', w.suspiciousSoftware, `Image metadata names editing/generation software: "${metadata.softwareSuspicious}".`)
    );
  }
  if (!metadata.hasCameraMetadata) {
    signals.push(signal('no_camera_metadata', 'low', w.missingCameraMetadata, 'No camera capture metadata present (weak signal only).'));
  }

  if (assessment.evidenceQuality === 'limited' || assessment.evidenceQuality === 'unusable') {
    signals.push(signal('inadequate_evidence', 'medium', w.inadequateEvidence, `Evidence quality is ${assessment.evidenceQuality}.`));
  }
  if (assessment.visualOutcome === 'inconclusive' || assessment.visualOutcome === 'worsened') {
    signals.push(signal('poor_outcome', 'medium', w.poorOutcome, `Visual outcome is ${assessment.visualOutcome}.`));
  }
  if (modelNeedsHumanReview) {
    signals.push(signal('model_review', 'medium', w.modelReview, 'The visual assessment requested human review.'));
  }
  if (isSafetyCritical) {
    signals.push(signal('safety_critical', 'medium', w.safetyCritical, 'Safety-critical ticket requires authorized sign-off.'));
  }

  const score = signals.reduce((sum, s) => sum + s.weight, 0);
  let level: RiskLevel = 'low';
  if (signals.some((s) => s.level === 'high')) level = 'high';
  else if (signals.some((s) => s.level === 'medium') || score >= RISK_THRESHOLDS.medium) level = 'medium';

  const requiresHumanReview = level !== 'low' || modelNeedsHumanReview || isSafetyCritical;
  const blocked = level === 'high';

  return { level, score, signals, requiresHumanReview, blocked };
}

/**
 * Backend enforcement helper: whether this verification record permits a
 * non-admin (student) to confirm resolution. Used by the resolve endpoint so
 * the guarantee does not depend on hiding a button in the UI.
 */
export function canRequestConfirmation(
  risk: { level: RiskLevel } | undefined,
  record: { allowedToRequestConfirmation: boolean } | undefined,
  isSafetyCritical: boolean,
  isAdmin: boolean
): { allowed: boolean; reason?: string } {
  if (isAdmin) return { allowed: true };
  if (isSafetyCritical) {
    return { allowed: false, reason: 'Safety-critical ticket requires administrator sign-off.' };
  }
  if (risk && risk.level !== 'low') {
    return { allowed: false, reason: `Integrity review required (risk: ${risk.level}).` };
  }
  if (record && !record.allowedToRequestConfirmation) {
    return { allowed: false, reason: 'Verification requires administrative review before closure.' };
  }
  return { allowed: true };
}
