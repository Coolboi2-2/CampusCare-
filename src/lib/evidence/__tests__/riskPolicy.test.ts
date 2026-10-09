import { describe, it, expect } from 'vitest';
import { assessRisk, canRequestConfirmation, type RiskInput } from '../riskPolicy';
import { RepairAssessmentSchema } from '../../ai/schemas';
import type { MetadataSignals } from '../types';

const cameraMeta: MetadataSignals = { hasCameraMetadata: true, format: 'jpeg', width: 100, height: 80 };

function assessment(overrides: Record<string, unknown> = {}) {
  return RepairAssessmentSchema.parse({
    visibleChanges: ['pipe joint is dry'],
    remainingConcerns: [],
    evidenceQuality: 'clear',
    visualOutcome: 'improved',
    needsHumanReview: false,
    recommendedAction: 'request_confirmation',
    sceneMatch: 'match',
    repairOutcome: 'improved',
    challengeCodeStatus: 'match',
    screenshotLikelihood: 'low',
    syntheticLikelihood: 'low',
    artifactSignals: [],
    reasons: [],
    ...overrides,
  });
}

function input(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    ticketId: 'T-1',
    isSafetyCritical: false,
    modelNeedsHumanReview: false,
    sameImage: false,
    reuseMatches: [],
    challenge: { required: true, status: 'match', stateInvalid: false },
    metadata: cameraMeta,
    assessment: assessment(),
    ...overrides,
  };
}

const exact = (ticketId: string) => [
  { type: 'exact' as const, evidenceId: 'e-x', ticketId, evidenceType: 'after' as const, similarity: 0 },
];
const perceptual = (ticketId: string) => [
  { type: 'perceptual' as const, evidenceId: 'e-p', ticketId, evidenceType: 'after' as const, similarity: 3 },
];

describe('Risk policy: levels and review routing', () => {
  it('a clean, challenged, camera-metadata repair is low risk', () => {
    const risk = assessRisk(input());
    expect(risk.level).toBe('low');
    expect(risk.requiresHumanReview).toBe(false);
    expect(risk.blocked).toBe(false);
  });

  it('SC-01/02: identical before/after is high risk and blocks normal completion', () => {
    const risk = assessRisk(input({ sameImage: true }));
    expect(risk.level).toBe('high');
    expect(risk.blocked).toBe(true);
    expect(risk.signals.map((s) => s.code)).toContain('same_image');
  });

  it('SC-03: exact cross-ticket reuse is high risk', () => {
    const risk = assessRisk(input({ reuseMatches: exact('T-OTHER') }));
    expect(risk.level).toBe('high');
    expect(risk.blocked).toBe(true);
  });

  it('SC-03: a perceptual cross-ticket match is medium risk (review, not block)', () => {
    const risk = assessRisk(input({ reuseMatches: perceptual('T-OTHER') }));
    expect(risk.level).toBe('medium');
    expect(risk.requiresHumanReview).toBe(true);
    expect(risk.blocked).toBe(false);
  });

  it('SC-06/20: perceptual similarity within the same ticket is not penalised', () => {
    const risk = assessRisk(input({ reuseMatches: perceptual('T-1') }));
    expect(risk.level).toBe('low');
  });

  it('SC-09/10: challenge mismatch or invalid state is high risk', () => {
    expect(assessRisk(input({ challenge: { required: true, status: 'mismatch', stateInvalid: false } })).level).toBe('high');
    expect(
      assessRisk(input({ challenge: { required: true, status: 'absent', stateInvalid: true, stateReason: 'expired' } })).level
    ).toBe('high');
  });

  it('SC-10: an absent required code escalates to review; unreadable is review-only, never fraud', () => {
    const absent = assessRisk(input({ challenge: { required: true, status: 'absent', stateInvalid: false } }));
    const unreadable = assessRisk(input({ challenge: { required: true, status: 'unreadable', stateInvalid: false } }));
    expect(absent.level).toBe('medium');
    expect(unreadable.level).toBe('medium');
    expect(unreadable.blocked).toBe(false);
  });

  it('SC-11: an unreadable code is not treated as fraud', () => {
    const risk = assessRisk(input({ challenge: { required: true, status: 'unreadable', stateInvalid: false } }));
    expect(risk.signals.find((s) => s.code === 'challenge_unreadable')?.level).toBe('medium');
    expect(risk.level).not.toBe('high');
  });

  it('SC-12: screenshot/synthetic indicators are supporting signals only', () => {
    expect(assessRisk(input({ assessment: assessment({ screenshotLikelihood: 'high' }) })).level).toBe('medium');
    expect(assessRisk(input({ assessment: assessment({ syntheticLikelihood: 'high' }) })).level).toBe('medium');
  });

  it('scene mismatch is high risk', () => {
    expect(assessRisk(input({ assessment: assessment({ sceneMatch: 'mismatch' }) })).level).toBe('high');
  });

  it('SC-07/08: weak signals alone never condemn a technician', () => {
    const noMeta = assessRisk(input({ metadata: { hasCameraMetadata: false, format: 'jpeg', width: 1, height: 1 } }));
    expect(noMeta.level).toBe('low');

    const software = assessRisk(
      input({ metadata: { ...cameraMeta, software: 'Adobe Photoshop', softwareSuspicious: 'photoshop' } })
    );
    expect(software.level).toBe('medium');
    expect(software.blocked).toBe(false);
  });

  it('safety-critical alone requires human review but does not hard-block here', () => {
    const risk = assessRisk(input({ isSafetyCritical: true }));
    expect(risk.requiresHumanReview).toBe(true);
  });
});

describe('canRequestConfirmation: backend closure guard', () => {
  const ok = { allowedToRequestConfirmation: true };
  const needsReview = { allowedToRequestConfirmation: false };

  it('SC-17/18: a student cannot confirm a safety-critical ticket', () => {
    expect(canRequestConfirmation(undefined, ok, true, false).allowed).toBe(false);
  });

  it('SC-17: a student cannot confirm when integrity review is required', () => {
    expect(canRequestConfirmation({ level: 'medium' }, ok, false, false).allowed).toBe(false);
    expect(canRequestConfirmation({ level: 'high' }, ok, false, false).allowed).toBe(false);
  });

  it('a student cannot confirm when the verifier requires review', () => {
    expect(canRequestConfirmation(undefined, needsReview, false, false).allowed).toBe(false);
  });

  it('a clean low-risk verified ticket can be confirmed', () => {
    expect(canRequestConfirmation({ level: 'low' }, ok, false, false).allowed).toBe(true);
  });

  it('an admin can always confirm', () => {
    expect(canRequestConfirmation({ level: 'high' }, needsReview, true, true).allowed).toBe(true);
  });
});
