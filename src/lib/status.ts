import { Ticket, TicketStatus } from '../types';

/**
 * Single source of truth for how a ticket state is described and coloured.
 * Plain-language labels — no internal pipeline jargon — used by every portal.
 */
export interface StatusMeta {
  label: string;
  /** Pill classes: background, text, border. */
  pill: string;
  /** Solid dot colour. */
  dot: string;
  /** 0..3 position on the Reported → Assigned → Fixed → Confirmed tracker. */
  step: 0 | 1 | 2 | 3;
}

export const STATUS_META: Record<TicketStatus, StatusMeta> = {
  reported: {
    label: 'Received',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    step: 0,
  },
  assigned: {
    label: 'Assigned',
    pill: 'bg-info-50 text-info-700 border-info-200',
    dot: 'bg-info-600',
    step: 1,
  },
  in_progress: {
    label: 'In progress',
    pill: 'bg-warning-50 text-warning-700 border-warning-200',
    dot: 'bg-warning-500',
    step: 1,
  },
  awaiting_verification: {
    label: 'Please confirm',
    pill: 'bg-confirm-50 text-confirm-700 border-confirm-200',
    dot: 'bg-confirm-600',
    step: 2,
  },
  resolved: {
    label: 'Fixed',
    pill: 'bg-success-50 text-success-700 border-success-200',
    dot: 'bg-success-600',
    step: 3,
  },
  reopened: {
    label: 'Reopened',
    pill: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-600',
    step: 1,
  },
  escalated: {
    label: 'Needs review',
    pill: 'bg-critical-50 text-critical-700 border-critical-200',
    dot: 'bg-critical-600',
    step: 1,
  },
};

export const statusLabel = (status: TicketStatus): string => STATUS_META[status].label;

export interface ProgressStep {
  key: 'reported' | 'assigned' | 'fixed' | 'confirmed';
  label: string;
  at?: string;
  done: boolean;
  current: boolean;
}

const findEventTime = (ticket: Ticket, pattern: RegExp): string | undefined =>
  ticket.auditTrail.find((e) => pattern.test(e.action))?.timestamp;

/** The 4-step journey shown on every ticket, with timestamps where known. */
export function progressSteps(ticket: Ticket): ProgressStep[] {
  const assignedAt =
    findEventTime(ticket, /assign/i) ??
    (ticket.assignedTechnician ? ticket.updatedAt : undefined);
  const fixedAt =
    findEventTime(ticket, /completed repair|uploaded after|status updated to resolved/i) ??
    (ticket.afterPhotoUrl ? ticket.updatedAt : undefined);
  const confirmedAt = ticket.resolutionFeedback?.confirmedAt;

  const raw: Omit<ProgressStep, 'done' | 'current'>[] = [
    { key: 'reported', label: 'Reported', at: ticket.createdAt },
    { key: 'assigned', label: 'Assigned', at: assignedAt },
    { key: 'fixed', label: 'Fixed', at: fixedAt },
    { key: 'confirmed', label: 'Confirmed', at: confirmedAt },
  ];

  const currentIndex = raw.findIndex((s) => !s.at);
  return raw.map((s, i) => ({
    ...s,
    done: Boolean(s.at),
    current: currentIndex === -1 ? i === raw.length - 1 : i === currentIndex,
  }));
}

/** Display-only estimate derived from the assessed priority (no server field). */
export function estimateFixTime(ticket: Ticket): string {
  switch (ticket.aiAssessment?.priority) {
    case 'Critical':
      return 'Usually fixed within 4 hours';
    case 'High':
      return 'Usually fixed within 12 hours';
    case 'Low':
      return 'Usually fixed within 2 days';
    default:
      return 'Usually fixed within 24 hours';
  }
}

/** Who is handling the ticket, as a plain name. */
export function handlerName(ticket: Ticket): string {
  return ticket.assignedTechnician || 'Awaiting assignment';
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** A short, human location string. */
export function locationLabel(ticket: Ticket): string {
  const { building, room } = ticket.location;
  return room ? `${building} · ${room}` : building;
}
