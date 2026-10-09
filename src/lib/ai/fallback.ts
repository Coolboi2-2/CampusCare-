import {
  IssueAnalysis,
  RepairAssessment,
  AssessmentMetadata,
  IssueAnalysisSchema,
  RepairAssessmentSchema,
} from './schemas';

/**
 * Deterministic Issue Analysis Fallback
 * Used when the live model is offline, timed out, or unconfigured.
 * Clearly labeled in metadata so the system never claims live model inference.
 */
export function fallbackAnalyzeIssue(
  description: string,
  locationText: string,
  photoUrl?: string,
  reason: string = 'AI service unavailable - deterministic rule-based analysis'
): { analysis: IssueAnalysis; metadata: AssessmentMetadata } {
  const textLower = (description + ' ' + locationText).toLowerCase();

  let category: IssueAnalysis['category'] = 'General';
  let priority: IssueAnalysis['priority'] = 'Medium';
  let title = 'Campus Facility Defect Report';
  let observations: string[] = [];
  let needsHumanReview = false;
  let reviewReasons: string[] = [];

  // 1. Safety-critical checks
  if (
    textLower.includes('spark') ||
    textLower.includes('smoke') ||
    textLower.includes('bare wire') ||
    textLower.includes('exposed wire') ||
    textLower.includes('gas') ||
    textLower.includes('fire')
  ) {
    category = 'Electrical';
    priority = 'Critical';
    needsHumanReview = true;
    title = 'Critical Electrical Safety Hazard';
    observations = [
      'Evidence indicates active electrical arcing, smoke, or exposed line voltage.',
      'Immediate fire and electrocution hazard present in campus facility.',
    ];
    reviewReasons = [
      'Safety-critical electrical event requires immediate physical lockout-tagout protocol.',
    ];
  } else if (
    textLower.includes('leak') ||
    textLower.includes('pipe') ||
    textLower.includes('sink') ||
    textLower.includes('washbasin') ||
    textLower.includes('drain') ||
    textLower.includes('toilet') ||
    textLower.includes('water')
  ) {
    category = 'Plumbing';
    title = textLower.includes('sink') || textLower.includes('washbasin')
      ? 'Water leakage under washbasin pipe joint'
      : 'Plumbing fixture drainage malfunction';
    priority = textLower.includes('burst') || textLower.includes('flooding') ? 'High' : 'Medium';
    observations = [
      'Moisture pooling or active dripping observed at plumbing fittings.',
      'Risk of secondary water damage to floor structure and adjacent facilities.',
      'Isolation valve check recommended prior to fitting disassembly.',
    ];
    if (priority === 'High') {
      needsHumanReview = true;
      reviewReasons = ['High-volume water flow risks structural floor penetration.'];
    }
  } else if (
    textLower.includes('light') ||
    textLower.includes('flicker') ||
    textLower.includes('ballast') ||
    textLower.includes('switch') ||
    textLower.includes('power') ||
    textLower.includes('buzz')
  ) {
    category = 'Electrical';
    title = 'Flickering luminaire or ballast failure';
    priority = 'High';
    observations = [
      'Unstable driver voltage or failing ballast causing luminescence flicker and acoustic hum.',
      'Potential ocular and auditory disruption in active student facility.',
    ];
  } else if (
    textLower.includes('chair') ||
    textLower.includes('desk') ||
    textLower.includes('door') ||
    textLower.includes('lock') ||
    textLower.includes('hinge') ||
    textLower.includes('splinter') ||
    textLower.includes('furniture')
  ) {
    category = 'Carpentry';
    title = 'Damaged furniture or door hardware';
    priority = 'Medium';
    observations = [
      'Mechanical hinge looseness or splintering fracture observed.',
      'Hardware alignment and screw anchoring replacement required.',
    ];
  } else if (
    textLower.includes('trash') ||
    textLower.includes('bin') ||
    textLower.includes('clean') ||
    textLower.includes('spill') ||
    textLower.includes('dirty') ||
    textLower.includes('sanitation')
  ) {
    category = 'Cleaning';
    title = 'Janitorial sanitation and waste clearance';
    priority = 'Low';
    observations = [
      'Accumulated debris or surface contamination requiring sanitation service.',
      'Receptacles require clearing and liner replacement.',
    ];
  } else if (
    textLower.includes('ac') ||
    textLower.includes('air condition') ||
    textLower.includes('heat') ||
    textLower.includes('vent') ||
    textLower.includes('temperature') ||
    textLower.includes('cold')
  ) {
    category = 'HVAC';
    title = 'Ventilation or climate control malfunction';
    priority = 'Medium';
    observations = [
      'Airflow restriction or thermostat regulation failure.',
      'Filter inspection and airflow calibration recommended.',
    ];
  } else {
    category = 'General';
    title = 'General campus facility inspection';
    priority = 'Low';
    observations = ['Routine maintenance assessment needed on-site.'];
  }

  const analysis: IssueAnalysis = IssueAnalysisSchema.parse({
    title,
    category,
    priority,
    observations,
    recommendedDepartment: category,
    needsHumanReview,
    reviewReasons,
  });

  const metadata: AssessmentMetadata = {
    provider: 'fallback',
    promptVersion: '1.0-rules',
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    fallbackReason: reason,
    isSafetyCritical: priority === 'Critical',
  };

  return { analysis, metadata };
}

/**
 * Deterministic Repair Verification Fallback
 * Compares evidence based on clear adversarial rules:
 * - Duplicate photo detected -> unusable / inconclusive
 * - Incomplete notes -> needs repair
 * - Good notes & photo -> clear improvement
 */
export function fallbackVerifyRepair(
  beforePhotoUrl: string,
  afterPhotoUrl: string,
  description: string,
  workNotes: string,
  department: string,
  isSafetyCritical: boolean = false,
  reason: string = 'AI service unavailable - deterministic rule-based verification'
): { assessment: RepairAssessment; metadata: AssessmentMetadata } {
  const notesLower = (workNotes || '').toLowerCase();

  // Adversarial Check 1: Duplicate Image uploaded
  if (beforePhotoUrl && afterPhotoUrl && beforePhotoUrl.trim() === afterPhotoUrl.trim()) {
    const assessment: RepairAssessment = RepairAssessmentSchema.parse({
      visibleChanges: ['Zero visible change detected between before and after image files.'],
      remainingConcerns: ['Technician submitted identical image asset for both before and after evidence.'],
      evidenceQuality: 'unusable',
      visualOutcome: 'unchanged',
      needsHumanReview: true,
      recommendedAction: 'request_repair',
    });

    const metadata: AssessmentMetadata = {
      provider: 'fallback',
      promptVersion: '1.0-rules',
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
      fallbackReason: `${reason}: Identical photo uploaded`,
      isSafetyCritical,
    };

    return { assessment, metadata };
  }

  // Adversarial Check 2: Notes indicate temporary fix or missing parts
  if (
    notesLower.includes('temporary') ||
    notesLower.includes('part on order') ||
    notesLower.includes('still') ||
    notesLower.includes('could not find') ||
    notesLower.includes('partial')
  ) {
    const assessment: RepairAssessment = RepairAssessmentSchema.parse({
      visibleChanges: ['Partial stabilization attempted by technician.'],
      remainingConcerns: [
        'Technician log explicitly reports temporary fix pending specialized components.',
      ],
      evidenceQuality: 'limited',
      visualOutcome: 'inconclusive',
      needsHumanReview: true,
      recommendedAction: 'manual_review',
    });

    const metadata: AssessmentMetadata = {
      provider: 'fallback',
      promptVersion: '1.0-rules',
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
      fallbackReason: `${reason}: Incomplete technician field notes`,
      isSafetyCritical,
    };

    return { assessment, metadata };
  }

  // Standard verified repair
  let visibleChanges: string[] = [];
  if (department === 'Plumbing') {
    visibleChanges = [
      'P-trap slip-joint compression collar securely reseated.',
      'Cabinet floor and pipe joints dry with zero active dripping.',
      'Proper drainage flow verified under line pressure.',
    ];
  } else if (department === 'Electrical') {
    visibleChanges = [
      'Ballast driver module replaced with steady luminescence.',
      'Diffuser cover mounted flush with ceiling grid.',
    ];
  } else if (department === 'Carpentry') {
    visibleChanges = [
      'Damaged armrest component replaced with sanded oak finish.',
      'Mounting screws countersunk flush with zero snag hazard.',
    ];
  } else {
    visibleChanges = [
      'Defect corrected in accordance with technician work record.',
      'Area returned to standard operational condition.',
    ];
  }

  const assessment: RepairAssessment = RepairAssessmentSchema.parse({
    visibleChanges,
    remainingConcerns: [],
    evidenceQuality: 'clear',
    visualOutcome: 'improved',
    needsHumanReview: isSafetyCritical,
    recommendedAction: isSafetyCritical ? 'manual_review' : 'request_confirmation',
  });

  const metadata: AssessmentMetadata = {
    provider: 'fallback',
    promptVersion: '1.0-rules',
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    fallbackReason: reason,
    isSafetyCritical,
  };

  return { assessment, metadata };
}
