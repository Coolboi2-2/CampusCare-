import { describe, it, expect, vi } from 'vitest';
import { verifyRepair } from '../verifyRepair';
import { assessRisk } from '../../evidence/riskPolicy';

vi.mock('../image', () => ({
  fetchImagePart: vi.fn(async () => ({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })),
}));

const base = {
  ticketId: 'T-1',
  originalDescription: 'leaking pipe under sink',
  department: 'Plumbing',
  beforePhotoUrl: 'https://example.com/before.jpg',
  afterPhotoUrl: 'https://example.com/after.jpg',
  technicianNotes: 'Replaced the slip joint washer and tested under line pressure.',
};

describe('verifyRepair: evidence integrity', () => {
  it('SC-01: identical before/after URL short-circuits to the duplicate path', async () => {
    const result = await verifyRepair({ ...base, afterPhotoUrl: base.beforePhotoUrl }, null);

    expect(result.integrity.sameImage).toBe(true);
    expect(result.assessment.evidenceQuality).toBe('unusable');
    expect(result.decision.requiresHumanReview).toBe(true);
  });

  it('SC-02: identical content hashes (different URLs) are detected as the same image', async () => {
    const result = await verifyRepair(
      { ...base, beforeEvidence: { sha256: 'deadbeef' }, afterEvidence: { sha256: 'deadbeef' } },
      null
    );

    expect(result.integrity.sameImage).toBe(true);
    expect(result.decision.requiresHumanReview).toBe(true);
  });

  it('does not flag sameImage when content hashes differ, even if URLs match', async () => {
    const result = await verifyRepair(
      {
        ...base,
        afterPhotoUrl: base.beforePhotoUrl,
        beforeEvidence: { sha256: 'aaa' },
        afterEvidence: { sha256: 'bbb' },
      },
      null
    );
    expect(result.integrity.sameImage).toBe(false);
  });

  it('does not claim duplication when only the after evidence is available', async () => {
    const result = await verifyRepair(
      { ...base, afterPhotoUrl: base.beforePhotoUrl, afterEvidence: { sha256: 'bbb' } },
      null
    );
    expect(result.integrity.sameImage).toBe(false);
  });

  it('SC-13: a required challenge is never assumed correct when the model is unavailable', async () => {
    const result = await verifyRepair({ ...base, challengeRequired: true }, null);

    expect(result.assessment.challengeCodeStatus).toBe('absent');

    const risk = assessRisk({
      ticketId: 'T-1',
      isSafetyCritical: false,
      modelNeedsHumanReview: result.decision.requiresHumanReview,
      sameImage: result.integrity.sameImage,
      reuseMatches: [],
      challenge: { required: true, status: 'absent', stateInvalid: false },
      metadata: { hasCameraMetadata: false, format: 'jpeg', width: 1, height: 1 },
      assessment: result.assessment,
    });
    expect(risk.requiresHumanReview).toBe(true);
  });

  it('SC-09: a model-readable challenge code flows through the assessment', async () => {
    const assessment = {
      visibleChanges: ['joint reseated'],
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
      reasons: ['Code ABC123 visible on the paper tag.'],
    };
    const client = {
      models: { generateContent: vi.fn(async () => ({ text: JSON.stringify(assessment) })) },
    } as any;

    const result = await verifyRepair({ ...base, challengeRequired: true, challengeCode: 'ABC123' }, client);
    expect(result.assessment.challengeCodeStatus).toBe('match');
  });

  it('SC-13: malformed model output fails safely into the deterministic fallback', async () => {
    const client = {
      models: { generateContent: vi.fn(async () => ({ text: JSON.stringify({ visibleChanges: [] }) })) },
    } as any;

    const result = await verifyRepair(base, client);
    expect(result.assessment.visibleChanges.length).toBeGreaterThan(0);
    expect(result.assessment.recommendedAction).toBeTruthy();
  });
});
