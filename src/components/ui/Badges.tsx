import React from 'react';
import { Tag, AlertOctagon, Cpu, ClipboardCheck } from 'lucide-react';
import { Department, Priority, TicketStatus } from '../../types';
import { STATUS_META } from '../../lib/status';

/**
 * Single source of truth for status / category / urgency colour semantics.
 * Every portal renders tickets, so these stay identical everywhere.
 * Plain language only — no pipeline jargon, no monospace.
 */

export const StatusBadge: React.FC<{
  status: TicketStatus;
  label?: string;
  pulse?: boolean;
  className?: string;
}> = ({ status, label, pulse, className = '' }) => {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.pill} ${
        pulse ? 'animate-pulse' : ''
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {label ?? meta.label}
    </span>
  );
};

/** Department / category chip. Exactly one category chip per card. */
export const CategoryPill: React.FC<{ department: Department; className?: string }> = ({
  department,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-semibold text-slate-600 ${className}`}
  >
    <Tag className="h-3 w-3 text-slate-400" aria-hidden="true" />
    {department}
  </span>
);

/** Shown only for safety-critical tickets. */
export const UrgentBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-critical-600 px-2.5 py-1 text-xs font-semibold text-white ${className}`}
    title="Safety-critical issue"
  >
    <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
    Urgent
  </span>
);

/** Backwards-compatible alias: safety-critical tickets read as "Urgent". */
export const SafetyBadge = UrgentBadge;

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: 'bg-critical-50 text-critical-700 border-critical-200',
  High: 'bg-warning-50 text-warning-700 border-warning-200',
  Medium: 'bg-slate-100 text-slate-600 border-slate-200',
  Low: 'bg-slate-50 text-slate-500 border-slate-200',
};

/** Internal priority — reserved for staff/admin detail views, never card faces. */
export const PriorityBadge: React.FC<{ priority: Priority; className?: string }> = ({
  priority,
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority]} ${className}`}
  >
    {priority} priority
  </span>
);

/**
 * Distinguishes live model output from deterministic fallback, in plain words.
 * Only surfaced inside admin/staff detail panels.
 */
export const ModeBadge: React.FC<{ provider?: string; className?: string }> = ({
  provider,
  className = '',
}) =>
  provider === 'gemma' ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 ${className}`}
    >
      <Cpu className="h-3 w-3" aria-hidden="true" />
      AI analysis
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-semibold text-slate-600 ${className}`}
    >
      <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
      Standard review
    </span>
  );

/** Ticket identifier chip. Reads cleanly, never monospace. */
export const TicketIdChip: React.FC<{ id: string; className?: string }> = ({
  id,
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-md border border-line bg-surface-muted px-2 py-0.5 text-xs font-semibold text-slate-500 ${className}`}
  >
    {id}
  </span>
);
