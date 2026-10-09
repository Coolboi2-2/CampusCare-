import { z } from 'zod';

export const DepartmentEnum = z.enum([
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Carpentry',
  'HVAC',
  'General',
]);

export const PriorityEnum = z.enum(['Low', 'Medium', 'High', 'Critical']);

export const EvidenceQualityEnum = z.enum(['clear', 'limited', 'unusable']);

export const VisualOutcomeEnum = z.enum([
  'improved',
  'unchanged',
  'worsened',
  'inconclusive',
]);

export const RecommendedActionEnum = z.enum([
  'request_confirmation',
  'request_repair',
  'manual_review',
]);

// ---- Phase 2.5 structured integrity signals (additive; existing fields kept) ----
export const ChallengeCodeStatusEnum = z.enum(['match', 'mismatch', 'unreadable', 'absent']);
export const SceneMatchEnum = z.enum(['match', 'mismatch', 'uncertain']);
export const RepairOutcomeEnum = z.enum(['improved', 'unchanged', 'worse', 'uncertain']);
export const LikelihoodEnum = z.enum(['low', 'medium', 'high']);

export const IssueAnalysisSchema = z.object({
  title: z.string().min(5).max(120),
  category: DepartmentEnum,
  priority: PriorityEnum,
  observations: z.array(z.string().max(240)).max(8),
  recommendedDepartment: DepartmentEnum,
  needsHumanReview: z.boolean(),
  reviewReasons: z.array(z.string().max(240)).max(8),
});

export const RepairAssessmentSchema = z.object({
  // Pre-existing contract (kept intact for existing consumers).
  visibleChanges: z.array(z.string().max(240)).max(8),
  remainingConcerns: z.array(z.string().max(240)).max(8),
  evidenceQuality: EvidenceQualityEnum,
  visualOutcome: VisualOutcomeEnum,
  needsHumanReview: z.boolean(),
  recommendedAction: RecommendedActionEnum,
  // Phase 2.5 structured signals. Optional so older/mocked payloads still parse.
  sceneMatch: SceneMatchEnum.optional(),
  repairOutcome: RepairOutcomeEnum.optional(),
  challengeCodeStatus: ChallengeCodeStatusEnum.optional(),
  screenshotLikelihood: LikelihoodEnum.optional(),
  syntheticLikelihood: LikelihoodEnum.optional(),
  artifactSignals: z.array(z.string().max(240)).max(8).optional(),
  reasons: z.array(z.string().max(240)).max(8).optional(),
});

export const AssessmentMetadataSchema = z.object({
  provider: z.enum(['gemma', 'fallback']),
  modelId: z.string().optional(),
  promptVersion: z.string(),
  schemaVersion: z.string(),
  createdAt: z.string(),
  fallbackReason: z.string().optional(),
  isSafetyCritical: z.boolean().optional(),
});

export type IssueAnalysis = z.infer<typeof IssueAnalysisSchema>;
export type RepairAssessment = z.infer<typeof RepairAssessmentSchema>;
export type AssessmentMetadata = z.infer<typeof AssessmentMetadataSchema>;
export type ChallengeCodeStatus = z.infer<typeof ChallengeCodeStatusEnum>;
export type SceneMatch = z.infer<typeof SceneMatchEnum>;
export type RepairOutcome = z.infer<typeof RepairOutcomeEnum>;
export type Likelihood = z.infer<typeof LikelihoodEnum>;
