import { GoogleGenAI } from '@google/genai';
import {
  RepairAssessment,
  AssessmentMetadata,
  RepairAssessmentSchema,
} from './schemas';
import { fallbackVerifyRepair } from './fallback';
import { fetchImagePart, InlineImagePart } from './image';
import type { MetadataSignals } from '../evidence/types';

export interface VerificationDecision {
  assessment: RepairAssessment;
  requiresHumanReview: boolean;
  allowedToRequestConfirmation: boolean;
}

export interface VerificationIntegrity {
  /** before and after are the same bytes (shared hash or identical URL). */
  sameImage: boolean;
}

/**
 * Deterministic Safety Gate
 * Validates the model output against institutional safety policy.
 * Gemini recommends; deterministic application rules govern permissions.
 */
export function applyVerificationRules(
  assessment: RepairAssessment,
  isSafetyCritical: boolean
): VerificationDecision {
  const requiresHumanReview =
    isSafetyCritical ||
    assessment.needsHumanReview ||
    assessment.evidenceQuality !== 'clear' ||
    assessment.visualOutcome === 'worsened' ||
    assessment.visualOutcome === 'inconclusive' ||
    assessment.recommendedAction !== 'request_confirmation';

  const allowedToRequestConfirmation =
    !requiresHumanReview &&
    assessment.visualOutcome === 'improved' &&
    assessment.recommendedAction === 'request_confirmation';

  return {
    assessment,
    requiresHumanReview,
    allowedToRequestConfirmation,
  };
}

export interface VerifyRepairInput {
  ticketId: string;
  originalDescription: string;
  department: string;
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  technicianNotes: string;
  isSafetyCritical?: boolean;
  // ---- Phase 2.5 integrity inputs (all optional; absent = legacy behavior) ----
  beforeEvidence?: { sha256: string };
  afterEvidence?: { sha256: string };
  beforeInline?: InlineImagePart;
  afterInline?: InlineImagePart;
  metadataSignals?: MetadataSignals;
  challengeRequired?: boolean;
  challengeCode?: string;
}

export async function verifyRepair(
  input: VerifyRepairInput,
  aiClient?: GoogleGenAI | null
): Promise<{
  assessment: RepairAssessment;
  decision: VerificationDecision;
  metadata: AssessmentMetadata;
  integrity: VerificationIntegrity;
}> {
  const {
    ticketId,
    originalDescription,
    department,
    beforePhotoUrl,
    afterPhotoUrl,
    technicianNotes,
    isSafetyCritical = false,
    beforeEvidence,
    afterEvidence,
    beforeInline,
    afterInline,
    metadataSignals,
    challengeRequired = false,
    challengeCode,
  } = input;

  if (!beforePhotoUrl || !afterPhotoUrl) {
    throw new Error('Both original before-photo and repair after-photo are required for verification');
  }

  // Content-based duplicate detection. URL equality is kept only as a cheap
  // early warning for legacy callers that submit URLs without preserved
  // evidence; once evidence hashes are available they are authoritative.
  const hasContentIdentity = Boolean(beforeEvidence || afterEvidence);
  const sameImage = hasContentIdentity
    ? Boolean(beforeEvidence && afterEvidence && beforeEvidence.sha256 === afterEvidence.sha256)
    : beforePhotoUrl.trim() === afterPhotoUrl.trim();

  const integrity: VerificationIntegrity = { sameImage };

  // Adversarial Check: Duplicate / Identical image
  if (sameImage) {
    const { assessment, metadata } = fallbackVerifyRepair(
      beforePhotoUrl,
      afterPhotoUrl,
      originalDescription,
      technicianNotes,
      department,
      isSafetyCritical,
      'Identical before and after evidence detected',
      { challengeRequired, sameImage: true, forceDuplicate: true }
    );
    const decision = applyVerificationRules(assessment, isSafetyCritical);
    return { assessment, decision, metadata, integrity };
  }

  // If no AI client available, use transparent rule fallback
  if (!aiClient) {
    const { assessment, metadata } = fallbackVerifyRepair(
      beforePhotoUrl,
      afterPhotoUrl,
      originalDescription,
      technicianNotes,
      department,
      isSafetyCritical,
      'No GEMINI_API_KEY environment variable configured',
      { challengeRequired }
    );
    const decision = applyVerificationRules(assessment, isSafetyCritical);
    return { assessment, decision, metadata, integrity };
  }

  const modelId = 'gemini-3.8-flash';
  const promptVersion = '2.0-visual-comparison';
  const schemaVersion = '1.0';

  const systemPrompt = `You are CampusCare AI (Gemini 3.8 Flash model).
You are evaluating photographic evidence of a completed campus maintenance repair.

Critical instructions:
1. Compare the exact same area between Before and After photos.
2. Note visible differences (e.g. pipe joint seated, fresh paint, debris cleared).
3. Check for camera angle discrepancies, poor lighting, or obscured view.
4. Avoid assuming the repair succeeded just because the after-photo looks tidier.
5. If the photos are unrelated, incomparable, or unclear, mark evidenceQuality as "limited" or "unusable" and visualOutcome as "inconclusive".
6. Report OBSERVATIONS, not conclusions. "Visible screen glare" is an observation; "this photo is fake" is a conclusion you must not assert.
7. Separate optimistic appearance from verified repair: if the scene is not plausibly the same physical location, set sceneMatch to "mismatch".

${
  challengeRequired && challengeCode
    ? `8. The technician was issued the challenge code "${challengeCode}" and must have written it physically on paper beside the repaired item. Inspect the actual photo and set challengeCodeStatus to "match" (code clearly visible and correct), "mismatch" (a code is visible but wrong), "unreadable" (present but illegible), or "absent" (no code visible).`
    : `8. No challenge code was required for this submission; set challengeCodeStatus to "absent".`
}

Return strictly valid JSON conforming to this schema:
{
  "visibleChanges": string[] (max 8 items, max 240 chars each),
  "remainingConcerns": string[] (max 8 items, max 240 chars each),
  "evidenceQuality": "clear" | "limited" | "unusable",
  "visualOutcome": "improved" | "unchanged" | "worsened" | "inconclusive",
  "needsHumanReview": boolean,
  "recommendedAction": "request_confirmation" | "request_repair" | "manual_review",
  "sceneMatch": "match" | "mismatch" | "uncertain",
  "repairOutcome": "improved" | "unchanged" | "worse" | "uncertain",
  "challengeCodeStatus": "match" | "mismatch" | "unreadable" | "absent",
  "screenshotLikelihood": "low" | "medium" | "high",
  "syntheticLikelihood": "low" | "medium" | "high",
  "artifactSignals": string[] (max 8, observed suspicious features e.g. "mismatched shadows", "warped text"),
  "reasons": string[] (max 8, short evidence-grounded explanations)
}`;

  const metadataNote = metadataSignals
    ? `Image format: ${metadataSignals.format || 'unknown'} (${metadataSignals.width || '?'}x${metadataSignals.height || '?'})
Camera metadata present: ${metadataSignals.hasCameraMetadata ? 'yes' : 'no'}
Software tag: ${metadataSignals.software || 'none'}`
    : 'Image metadata: not available';

  const userContent = `Ticket ID: ${ticketId}
Department: ${department}
Original Defect: "${originalDescription}"
Technician Work Notes: "${technicianNotes}"
${metadataNote}
Original Before Photo: ${beforePhotoUrl}
After-Repair Photo: ${afterPhotoUrl}`;

  try {
    // Attach both photos so the model performs a real before/after visual
    // comparison. Preserved evidence bytes are preferred over re-downloading
    // mutable external URLs.
    const parts: Array<InlineImagePart | { text: string }> = [];
    parts.push(beforeInline || (await fetchImagePart(beforePhotoUrl)));
    parts.push(afterInline || (await fetchImagePart(afterPhotoUrl)));
    parts.push({ text: `${systemPrompt}\n\n${userContent}` });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Visual verification timed out after 10000ms')), 10000)
    );

    const generatePromise = aiClient.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const rawText = response.text?.trim() || '';

    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsedData = JSON.parse(cleanJson);

    const validation = RepairAssessmentSchema.safeParse(parsedData);
    if (!validation.success) {
      console.warn('[CampusCare AI] Verification schema validation failed:', validation.error.issues);
      const fallbackResult = fallbackVerifyRepair(
        beforePhotoUrl,
        afterPhotoUrl,
        originalDescription,
        technicianNotes,
        department,
        isSafetyCritical,
        `Verification schema validation failed: ${validation.error.issues[0]?.message || 'invalid schema'}`,
        { challengeRequired }
      );
      const decision = applyVerificationRules(fallbackResult.assessment, isSafetyCritical);
      return { assessment: fallbackResult.assessment, decision, metadata: fallbackResult.metadata, integrity };
    }

    const assessment = validation.data;
    const metadata: AssessmentMetadata = {
      provider: 'gemma',
      modelId,
      promptVersion,
      schemaVersion,
      createdAt: new Date().toISOString(),
      isSafetyCritical,
    };

    const decision = applyVerificationRules(assessment, isSafetyCritical);
    return { assessment, decision, metadata, integrity };
  } catch (err: any) {
    console.warn('[CampusCare AI] Model verification failed, applying rule fallback:', err?.message || err);
    const fallbackResult = fallbackVerifyRepair(
      beforePhotoUrl,
      afterPhotoUrl,
      originalDescription,
      technicianNotes,
      department,
      isSafetyCritical,
      `API error: ${err?.message || 'Verification exception'}`,
      { challengeRequired }
    );
    const decision = applyVerificationRules(fallbackResult.assessment, isSafetyCritical);
    return { assessment: fallbackResult.assessment, decision, metadata: fallbackResult.metadata, integrity };
  }
}
