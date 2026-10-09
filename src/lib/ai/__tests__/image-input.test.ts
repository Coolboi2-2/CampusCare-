import { describe, expect, it, vi } from 'vitest';
import { analyzeIssue } from '../analyzeIssue';
import { verifyRepair } from '../verifyRepair';

vi.mock('../image', () => ({
  fetchImagePart: vi.fn(async () => ({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })),
}));

const analysis = {
  title: 'Leaking pipe under sink',
  category: 'Plumbing' as const,
  priority: 'Medium' as const,
  observations: ['moisture noted at the joint'],
  recommendedDepartment: 'Plumbing' as const,
  needsHumanReview: false,
  reviewReasons: [],
};

const repair = {
  visibleChanges: ['joint is dry'],
  remainingConcerns: [],
  evidenceQuality: 'clear' as const,
  visualOutcome: 'improved' as const,
  needsHumanReview: false,
  recommendedAction: 'request_confirmation' as const,
};

function mockClient(payload: unknown) {
  return {
    models: { generateContent: vi.fn(async () => ({ text: JSON.stringify(payload) })) },
  } as any;
}

describe('CampusCare AI: multimodal request wiring', () => {
  it('MM-01: analyzeIssue sends the before photo as inlineData, not just a URL', async () => {
    const client = mockClient(analysis);

    await analyzeIssue(
      {
        description: 'Water leaking under the sink pipe',
        locationText: 'Oak Hall 308',
        photoUrl: 'https://example.com/before.jpg',
      },
      client
    );

    const parts = client.models.generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts.some((p: any) => p.inlineData?.data === 'QUJD')).toBe(true);
  });

  it('MM-02: verifyRepair sends both before and after photos as inlineData', async () => {
    const client = mockClient(repair);

    await verifyRepair(
      {
        ticketId: 'CC-2026-1042',
        originalDescription: 'leak',
        department: 'Plumbing',
        beforePhotoUrl: 'https://example.com/before.jpg',
        afterPhotoUrl: 'https://example.com/after.jpg',
        technicianNotes: 'fixed',
        isSafetyCritical: false,
      },
      client
    );

    const parts = client.models.generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts.filter((p: any) => p.inlineData).length).toBe(2);
  });
});
