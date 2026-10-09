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
  visibleChanges: z.array(z.string().max(240)).max(8),
  remainingConcerns: z.array(z.string().max(240)).max(8),
  evidenceQuality: EvidenceQualityEnum,
  visualOutcome: VisualOutcomeEnum,
  needsHumanReview: z.boolean(),
  recommendedAction: RecommendedActionEnum,
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
