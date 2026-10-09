import { GoogleGenAI } from '@google/genai';
import {
  RepairAssessment,
  AssessmentMetadata,
  RepairAssessmentSchema,
} from './schemas';
import { fallbackVerifyRepair } from './fallback';

export interface VerificationDecision {
  assessment: RepairAssessment;
  requiresHumanReview: boolean;
  allowedToRequestConfirmation: boolean;
}

/**
 * Deterministic Safety Gate
 * Validates the model output against institutional safety policy.
 * Gemma recommends; deterministic application rules govern permissions.
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
}

export async function verifyRepair(
  input: VerifyRepairInput,
  aiClient?: GoogleGenAI | null
): Promise<{
  assessment: RepairAssessment;
  decision: VerificationDecision;
  metadata: AssessmentMetadata;
}> {
  const {
    ticketId,
    originalDescription,
    department,
    beforePhotoUrl,
    afterPhotoUrl,
    technicianNotes,
    isSafetyCritical = false,
  } = input;

  if (!beforePhotoUrl || !afterPhotoUrl) {
    throw new Error('Both original before-photo and repair after-photo are required for verification');
  }

  // Adversarial Check: Duplicate / Identical image
  if (beforePhotoUrl.trim() === afterPhotoUrl.trim()) {
    const { assessment, metadata } = fallbackVerifyRepair(
      beforePhotoUrl,
      afterPhotoUrl,
      originalDescription,
      technicianNotes,
      department,
      isSafetyCritical,
      'Identical before and after photo detected'
    );
    const decision = applyVerificationRules(assessment, isSafetyCritical);
    return { assessment, decision, metadata };
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
      'No GEMINI_API_KEY environment variable configured'
    );
    const decision = applyVerificationRules(assessment, isSafetyCritical);
    return { assessment, decision, metadata };
  }

  const modelId = 'gemini-3.8-flash';
  const promptVersion = '2.0-visual-comparison';
  const schemaVersion = '1.0';

  const systemPrompt = `You are CampusCare AI (Gemma 4 model).
You are evaluating photographic evidence of a completed campus maintenance repair.

Critical instructions:
1. Compare the exact same area between Before and After photos.
2. Note visible differences (e.g. pipe joint seated, fresh paint, debris cleared).
3. Check for camera angle discrepancies, poor lighting, or obscured view.
4. Avoid assuming the repair succeeded just because the after-photo looks tidier.
5. If the photos are unrelated, incomparable, or unclear, mark evidenceQuality as "limited" or "unusable" and visualOutcome as "inconclusive".
6. Return strictly valid JSON conforming to this schema:
{
  "visibleChanges": string[] (max 8 items, max 240 chars each),
  "remainingConcerns": string[] (max 8 items, max 240 chars each),
  "evidenceQuality": "clear" | "limited" | "unusable",
  "visualOutcome": "improved" | "unchanged" | "worsened" | "inconclusive",
  "needsHumanReview": boolean,
  "recommendedAction": "request_confirmation" | "request_repair" | "manual_review"
}`;

  const userContent = `Ticket ID: ${ticketId}
Department: ${department}
Original Defect: "${originalDescription}"
Technician Work Notes: "${technicianNotes}"
Original Before Photo: ${beforePhotoUrl}
After-Repair Photo: ${afterPhotoUrl}`;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Visual verification timed out after 10000ms')), 10000)
    );

    const generatePromise = aiClient.models.generateContent({
      model: modelId,
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] },
      ],
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
        `Verification schema validation failed: ${validation.error.issues[0]?.message || 'invalid schema'}`
      );
      const decision = applyVerificationRules(fallbackResult.assessment, isSafetyCritical);
      return { assessment: fallbackResult.assessment, decision, metadata: fallbackResult.metadata };
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
    return { assessment, decision, metadata };
  } catch (err: any) {
    console.warn('[CampusCare AI] Model verification failed, applying rule fallback:', err?.message || err);
    const fallbackResult = fallbackVerifyRepair(
      beforePhotoUrl,
      afterPhotoUrl,
      originalDescription,
      technicianNotes,
      department,
      isSafetyCritical,
      `API error: ${err?.message || 'Verification exception'}`
    );
    const decision = applyVerificationRules(fallbackResult.assessment, isSafetyCritical);
    return { assessment: fallbackResult.assessment, decision, metadata: fallbackResult.metadata };
  }
}
