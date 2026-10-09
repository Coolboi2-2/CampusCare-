import { describe, expect, it } from 'vitest';
import { applyVerificationRules } from '../verifyRepair';
import { fallbackAnalyzeIssue, fallbackVerifyRepair } from '../fallback';
import { IssueAnalysisSchema, RepairAssessmentSchema } from '../schemas';
import { validateStateTransition } from '../../workflow/ticketTransitions';
import { Ticket } from '../../../types';

const baseAssessment = {
  visibleChanges: ['Water staining appears reduced and pipe is dry.'],
  remainingConcerns: [],
  evidenceQuality: 'clear' as const,
  visualOutcome: 'improved' as const,
  needsHumanReview: false,
  recommendedAction: 'request_confirmation' as const,
};

describe('CampusCare AI Reliability: Verification Rules Policy', () => {
  it('VR-01: allows confirmation for a clear improvement', () => {
    const result = applyVerificationRules(baseAssessment, false);

    expect(result.requiresHumanReview).toBe(false);
    expect(result.allowedToRequestConfirmation).toBe(true);
  });

  it('VR-04: requires review for safety-critical issues regardless of optimistic output', () => {
    const result = applyVerificationRules(baseAssessment, true);

    expect(result.requiresHumanReview).toBe(true);
    expect(result.allowedToRequestConfirmation).toBe(false);
  });

  it('VR-03: does not allow confirmation for inconclusive evidence', () => {
    const result = applyVerificationRules(
      {
        ...baseAssessment,
        evidenceQuality: 'limited',
        visualOutcome: 'inconclusive',
        recommendedAction: 'manual_review',
        needsHumanReview: true,
      },
      false
    );

    expect(result.requiresHumanReview).toBe(true);
    expect(result.allowedToRequestConfirmation).toBe(false);
  });

  it('Adversarial: identical photo uploaded flags unusable evidence and manual review', () => {
    const { assessment, metadata } = fallbackVerifyRepair(
      'https://example.com/photo.jpg',
      'https://example.com/photo.jpg',
      'Washbasin leak',
      'Replaced gasket',
      'Plumbing',
      false
    );

    expect(assessment.evidenceQuality).toBe('unusable');
    expect(assessment.visualOutcome).toBe('unchanged');
    expect(assessment.recommendedAction).toBe('request_repair');
    expect(metadata.provider).toBe('fallback');
  });
});

describe('CampusCare AI Reliability: Issue Understanding & Schemas', () => {
  it('AI-01: Analyzes plumbing issue with strict schema validation', () => {
    const { analysis, metadata } = fallbackAnalyzeIssue(
      'Water is leaking under the washbasin pipe in room 308',
      'Oak Hall 3rd floor',
      'https://example.com/leak.jpg'
    );

    expect(analysis.category).toBe('Plumbing');
    expect(analysis.recommendedDepartment).toBe('Plumbing');
    expect(analysis.observations.length).toBeGreaterThan(0);
    expect(metadata.provider).toBe('fallback');
    expect(metadata.schemaVersion).toBe('1.0');

    // Validates against Zod schema
    const parsed = IssueAnalysisSchema.safeParse(analysis);
    expect(parsed.success).toBe(true);
  });

  it('AI-02: Flags critical electrical issues with safety review reasons', () => {
    const { analysis, metadata } = fallbackAnalyzeIssue(
      'Smoke and sparks coming from exposed bare wire in electrical panel',
      'Science Building Room 101'
    );

    expect(analysis.category).toBe('Electrical');
    expect(analysis.priority).toBe('Critical');
    expect(analysis.needsHumanReview).toBe(true);
    expect(analysis.reviewReasons.length).toBeGreaterThan(0);
    expect(metadata.isSafetyCritical).toBe(true);
  });

  it('AI-03: Rejects malformed schema structures', () => {
    const malformed = {
      title: 'Short', // fails min(5)
      category: 'NuclearPlant', // not in enum
      priority: 'Extreme', // not in enum
    };

    const parsed = IssueAnalysisSchema.safeParse(malformed);
    expect(parsed.success).toBe(false);
  });
});

describe('CampusCare Workflow Engine: State Transitions & Role Authorization', () => {
  const mockTicket: Ticket = {
    id: 'CC-2026-1042',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reporterName: 'Aarav Patel',
    reporterEmail: 'aarav@campus.edu',
    description: 'Water leak',
    location: { zone: 'Hostel', building: 'Oak Hall', floor: '3', room: '308' },
    beforePhotoUrl: 'https://example.com/before.jpg',
    department: 'Plumbing',
    status: 'reported',
    isSafetyCritical: false,
    aiAssessment: {
      title: 'Water leakage',
      category: 'Plumbing',
      priority: 'Medium',
      observations: ['Leak detected'],
      recommendedDepartment: 'Plumbing',
      needsHumanReview: false,
      reviewReasons: [],
    },
    issueAnalysisMetadata: {
      provider: 'fallback',
      promptVersion: '1.0',
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
    },
    repairAttempts: [],
    auditTrail: [],
  };

  it('WF-01: Unauthorized student cannot assign a technician', () => {
    const check = validateStateTransition(mockTicket, 'assigned', {
      actorName: 'Student',
      actorRole: 'student',
    });

    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('administration');
  });

  it('WF-02: Administrator can assign a work order', () => {
    const check = validateStateTransition(mockTicket, 'assigned', {
      actorName: 'Admin',
      actorRole: 'admin',
    });

    expect(check.allowed).toBe(true);
  });

  it('WF-03: Safety-critical ticket cannot be closed unilaterally by student', () => {
    const criticalTicket: Ticket = {
      ...mockTicket,
      status: 'awaiting_verification',
      isSafetyCritical: true,
    };

    const check = validateStateTransition(criticalTicket, 'resolved', {
      actorName: 'Aarav Patel',
      actorRole: 'student',
    });

    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('safety-critical');
  });

  it('WF-04: Idempotent state transitions return allowed: true without side-effects', () => {
    const check = validateStateTransition(mockTicket, 'reported', {
      actorName: 'Aarav Patel',
      actorRole: 'student',
    });

    expect(check.allowed).toBe(true);
  });

  it('WF-05: Rejects transitions that skip workflow stages', () => {
    const check = validateStateTransition(mockTicket, 'awaiting_verification', {
      actorName: 'Devon Lee',
      actorRole: 'technician',
    });

    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Disallowed transition');
  });

  it('WF-06: Rejects backwards transitions from resolved', () => {
    const resolvedTicket: Ticket = { ...mockTicket, status: 'resolved' };

    const check = validateStateTransition(resolvedTicket, 'in_progress', {
      actorName: 'Devon Lee',
      actorRole: 'technician',
    });

    expect(check.allowed).toBe(false);
  });
});
