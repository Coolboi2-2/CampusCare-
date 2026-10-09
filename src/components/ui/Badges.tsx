import React from 'react';
import { Cpu, FlaskConical, ShieldAlert } from 'lucide-react';
import { Priority, TicketStatus } from '../../types';

/**
 * Single source of truth for status/priority/mode colour semantics.
 * Every portal renders tickets, so these stay identical everywhere.
 */

const STATUS_STYLES: Record<TicketStatus, string> = {
  reported: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-brand-100 text-brand-800 border-brand-200',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-200',
  awaiting_verification: 'bg-accent-100 text-accent-700 border-accent-200',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  reopened: 'bg-rose-100 text-rose-800 border-rose-200',
  escalated: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  reported: 'Reported / Triaged',
  assigned: 'Assigned to Staff',
  in_progress: 'Work In Progress',
  awaiting_verification: 'Awaiting Verification',
  resolved: 'Resolved & Verified',
  reopened: 'Reopened by Student',
  escalated: 'Escalated / Review Required',
};

export const StatusBadge: React.FC<{
  status: TicketStatus;
  label?: string;
  pulse?: boolean;
  className?: string;
}> = ({ status, label, pulse, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]} ${
      pulse ? 'animate-pulse' : ''
    } ${className}`}
  >
    {label ?? STATUS_LABELS[status]}
  </span>
);

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: 'bg-rose-100 text-rose-700 border-rose-200',
  High: 'bg-amber-100 text-amber-800 border-amber-200',
  Medium: 'bg-brand-50 text-brand-700 border-brand-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const PriorityBadge: React.FC<{ priority: Priority; className?: string }> = ({
  priority,
  className = '',
}) => (
  <span
    className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[priority]} ${className}`}
  >
    Priority: {priority}
  </span>
);

/**
 * Distinguishes live model output from deterministic fallback. Never implies a
 * live model ran when it did not.
 */
export const ModeBadge: React.FC<{ provider?: string; className?: string }> = ({
  provider,
  className = '',
}) =>
  provider === 'gemma' ? (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200 ${className}`}
    >
      <Cpu className="w-3 h-3" />
      Gemini Live
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 ${className}`}
    >
      <FlaskConical className="w-3 h-3" />
      Fallback Rules
    </span>
  );

/** Safety-critical flag, identical across portals. */
export const SafetyBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white ${className}`}
  >
    <ShieldAlert className="w-3 h-3" />
    Safety Critical
  </span>
);

/** Monospace ticket identifier chip. */
export const TicketIdChip: React.FC<{ id: string; className?: string }> = ({ id, className = '' }) => (
  <span
    className={`font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200 ${className}`}
  >
    {id}
  </span>
);
