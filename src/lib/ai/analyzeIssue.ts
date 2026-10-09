import { GoogleGenAI } from '@google/genai';
import { IssueAnalysis, AssessmentMetadata, IssueAnalysisSchema } from './schemas';
import { fallbackAnalyzeIssue } from './fallback';

export interface AnalyzeIssueInput {
  description: string;
  locationText: string;
  photoUrl?: string;
}

export async function analyzeIssue(
  input: AnalyzeIssueInput,
  aiClient?: GoogleGenAI | null
): Promise<{ analysis: IssueAnalysis; metadata: AssessmentMetadata }> {
  const { description, locationText, photoUrl } = input;

  if (!description || description.trim().length < 5) {
    throw new Error('Description must be at least 5 characters long');
  }

  // If no AI client available or key missing, use transparent fallback
  if (!aiClient) {
    return fallbackAnalyzeIssue(
      description,
      locationText,
      photoUrl,
      'No GEMINI_API_KEY environment variable configured'
    );
  }

  const modelId = 'gemini-3.8-flash';
  const promptVersion = '2.0-gemma-audit';
  const schemaVersion = '1.0';

  const systemPrompt = `You are CampusCare AI (Gemma 4 model).
Analyze this campus maintenance problem report and return a strict JSON object.
Rules:
1. Separate visible evidence from student claims.
2. Describe uncertainty instead of inventing a technical diagnosis.
3. Suggest category and priority without claiming omniscience.
4. If there is exposed live wiring, sparks, smoke, gas smell, or major structural compromise, set needsHumanReview to true and add explicit reviewReasons.
5. Output ONLY valid JSON matching this schema:
{
  "title": string (5-120 chars),
  "category": "Plumbing" | "Electrical" | "Cleaning" | "Carpentry" | "HVAC" | "General",
  "priority": "Low" | "Medium" | "High" | "Critical",
  "observations": string[] (max 8 items, max 240 chars each),
  "recommendedDepartment": "Plumbing" | "Electrical" | "Cleaning" | "Carpentry" | "HVAC" | "General",
  "needsHumanReview": boolean,
  "reviewReasons": string[] (max 8 items)
}`;

  const userContent = `Description: "${description.trim()}"
Location: "${locationText.trim()}"
Photo Evidence: ${photoUrl || 'No photo provided'}`;

  try {
    // Add 10-second timeout guard
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI inference request timed out after 10000ms')), 10000)
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

    // Strip markdown formatting if present
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsedData = JSON.parse(cleanJson);

    // Validate with Zod schema contract
    const validation = IssueAnalysisSchema.safeParse(parsedData);
    if (!validation.success) {
      console.warn('[CampusCare AI] Schema validation failed:', validation.error.issues);
      return fallbackAnalyzeIssue(
        description,
        locationText,
        photoUrl,
        `Model response schema validation failed: ${validation.error.issues[0]?.message || 'invalid structure'}`
      );
    }

    const isSafety = validation.data.priority === 'Critical' || validation.data.needsHumanReview;

    const metadata: AssessmentMetadata = {
      provider: 'gemma',
      modelId,
      promptVersion,
      schemaVersion,
      createdAt: new Date().toISOString(),
      isSafetyCritical: isSafety,
    };

    return {
      analysis: validation.data,
      metadata,
    };
  } catch (err: any) {
    console.warn('[CampusCare AI] Model execution failed, engaging fallback:', err?.message || err);
    return fallbackAnalyzeIssue(
      description,
      locationText,
      photoUrl,
      `API error: ${err?.message || 'Inference exception'}`
    );
  }
}
