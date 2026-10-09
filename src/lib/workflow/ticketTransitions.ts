import { Ticket, TicketStatus, UserRole } from '../../types';

export interface TransitionContext {
  actorName: string;
  actorRole: UserRole;
  actionReason?: string;
  idempotencyKey?: string;
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  ticket?: Ticket;
}

/**
 * Legal state-machine edges. A transition not listed here is rejected,
 * regardless of role, so tickets cannot skip workflow stages.
 */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  reported: ['assigned', 'in_progress', 'escalated'],
  assigned: ['in_progress', 'escalated'],
  in_progress: ['awaiting_verification', 'escalated'],
  awaiting_verification: ['resolved', 'reopened', 'escalated'],
  resolved: ['reopened'],
  reopened: ['assigned', 'in_progress', 'escalated'],
  escalated: ['assigned', 'in_progress', 'resolved', 'reopened'],
};

/**
 * Validates whether a state transition is permitted for a given user role.
 */
export function validateStateTransition(
  ticket: Ticket,
  targetStatus: TicketStatus,
  context: TransitionContext
): { allowed: boolean; reason?: string } {
  const { actorRole } = context;
  const currentStatus = ticket.status;

  // Idempotency: if already in target status, allow without side-effects
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  // 0. Workflow sequencing: only allow edges defined by the state machine.
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(targetStatus)) {
    return { allowed: false, reason: `Disallowed transition from ${currentStatus} to ${targetStatus}` };
  }

  // 1. Reported -> Assigned
  if (targetStatus === 'assigned') {
    if (actorRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Only campus administration or dispatchers can assign department work orders.',
      };
    }
    return { allowed: true };
  }

  // 2. Assigned -> In Progress
  if (targetStatus === 'in_progress') {
    if (actorRole !== 'technician' && actorRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Only assigned maintenance technicians or administrators can start field repairs.',
      };
    }
    return { allowed: true };
  }

  // 3. In Progress -> Awaiting Verification
  if (targetStatus === 'awaiting_verification') {
    if (actorRole !== 'technician' && actorRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Only technicians who performed the repair can submit work for verification.',
      };
    }
    return { allowed: true };
  }

  // 4. Awaiting Verification -> Resolved
  if (targetStatus === 'resolved') {
    // Safety critical guard:
    if (ticket.isSafetyCritical && actorRole !== 'admin') {
      return {
        allowed: false,
        reason:
          'This incident is flagged as safety-critical (e.g. electrical/structural hazard). It requires administrator sign-off and cannot be auto-closed by students.',
      };
    }

    // AI uncertainty check:
    if (ticket.latestVerification && !ticket.latestVerification.allowedToRequestConfirmation && actorRole !== 'admin') {
      return {
        allowed: false,
        reason:
          'AI assessment detected inconclusive evidence or residual concerns. Administrative review is required before closure.',
      };
    }

    if (actorRole !== 'student' && actorRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Technicians cannot unilaterally resolve tickets without student or admin verification.',
      };
    }

    return { allowed: true };
  }

  // 5. Any -> Reopened
  if (targetStatus === 'reopened') {
    if (actorRole !== 'student' && actorRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Only reporting students or administrators can reopen maintenance tickets.',
      };
    }
    return { allowed: true };
  }

  // 6. Escalated
  if (targetStatus === 'escalated') {
    return { allowed: true };
  }

  return { allowed: false, reason: `Disallowed transition from ${currentStatus} to ${targetStatus}` };
}
