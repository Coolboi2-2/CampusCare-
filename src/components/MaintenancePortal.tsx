import React, { useState } from 'react';
import { Wrench, CheckCircle2, Clock, MapPin, Sparkles, Camera, Play } from 'lucide-react';
import { Ticket, Department } from '../types';
import {
  StatusBadge,
  PriorityBadge,
  ModeBadge,
  SafetyBadge,
  TicketIdChip,
} from './ui/Badges';

interface MaintenancePortalProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  onStartWork: (ticketId: string) => void;
  onOpenRepairModal: (ticket: Ticket) => void;
}

const DEPARTMENTS: (Department | 'All')[] = [
  'All',
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Carpentry',
  'HVAC',
  'General',
];

export const MaintenancePortal: React.FC<MaintenancePortalProps> = ({
  tickets,
  onSelectTicket,
  onStartWork,
  onOpenRepairModal,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department | 'All'>('Plumbing');
  const [statusFilter, setStatusFilter] = useState<'active' | 'awaiting' | 'all'>('active');

  const filteredTickets = tickets.filter((t) => {
    if (selectedDept !== 'All' && t.department !== selectedDept) return false;
    if (statusFilter === 'active') return t.status === 'reported' || t.status === 'assigned' || t.status === 'in_progress' || t.status === 'reopened';
    if (statusFilter === 'awaiting') return t.status === 'awaiting_verification';
    return true;
  });

  const activeCount = tickets.filter((t) => t.status !== 'resolved').length;
  const readyForReviewCount = tickets.filter((t) => t.status === 'awaiting_verification').length;

  return (
    <div className="space-y-6">
      {/* Compact Page Header */}
      <header className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-card bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <Wrench className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Maintenance Dispatch &amp; Field Service
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
              Accept department-assigned work orders, log repair activities, and submit after-repair
              photographic evidence for automated verification and student sign-off.
            </p>
          </div>
        </div>

        {/* Queue Stats Strip */}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="bg-surface rounded-card border border-line shadow-card p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active In Queue
            </span>
            <div className="mt-1 text-2xl font-bold text-slate-900">{activeCount}</div>
          </div>
          <div className="bg-surface rounded-card border border-line shadow-card p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ready for Review
            </span>
            <div className="mt-1 text-2xl font-bold text-accent-700">{readyForReviewCount}</div>
          </div>
        </div>
      </header>

      {/* Department Tabs */}
      <div className="space-y-3">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="Department queues"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Queue:
          </span>
          {DEPARTMENTS.map((dept) => {
            const count = tickets.filter(
              (t) => (dept === 'All' || t.department === dept) && t.status !== 'resolved'
            ).length;
            const isSelected = selectedDept === dept;

            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-control text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-card'
                    : 'bg-surface border border-line text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{dept}</span>
                <span
                  className={`px-1.5 rounded text-[10px] ${
                    isSelected ? 'bg-brand-700 text-brand-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            aria-pressed={statusFilter === 'active'}
            className={`px-3 py-1.5 rounded-control font-semibold transition-colors ${
              statusFilter === 'active'
                ? 'bg-amber-100 text-amber-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Open &amp; In Progress
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('awaiting')}
            aria-pressed={statusFilter === 'awaiting'}
            className={`px-3 py-1.5 rounded-control font-semibold transition-colors ${
              statusFilter === 'awaiting'
                ? 'bg-accent-100 text-accent-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Awaiting Verification ({readyForReviewCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            aria-pressed={statusFilter === 'all'}
            className={`px-3 py-1.5 rounded-control font-semibold transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Tickets
          </button>
        </div>
      </div>

      {/* Department Work Queue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredTickets.length === 0 ? (
          <div className="md:col-span-2 bg-surface rounded-card border border-line shadow-card p-12 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" aria-hidden="true" />
            <h3 className="font-bold text-slate-800 text-sm">No work orders in this queue</h3>
            <p className="text-xs text-slate-500 mt-1">
              Select a different department or switch the filter tab above.
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isReportedOrAssigned = ticket.status === 'reported' || ticket.status === 'assigned';
            const isInProgress = ticket.status === 'in_progress';
            const isAwaitingVerification = ticket.status === 'awaiting_verification';
            const isResolved = ticket.status === 'resolved';

            return (
              <div
                key={ticket.id}
                className="bg-surface rounded-card border border-line shadow-card hover:shadow-card-hover transition-shadow overflow-hidden flex flex-col"
              >
                {/* Header Strip */}
                <div className="p-5 border-b border-line space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <TicketIdChip id={ticket.id} />
                      <PriorityBadge priority={ticket.aiAssessment.priority} />
                      {ticket.isSafetyCritical && <SafetyBadge />}
                    </div>
                    <StatusBadge status={ticket.status} className="shrink-0" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">
                    {ticket.aiAssessment.title}
                  </h3>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-3 flex-1">
                  <div className="flex items-start gap-3">
                    <img
                      src={ticket.beforePhotoUrl}
                      alt={`Reported issue for ${ticket.id}`}
                      className="w-16 h-16 rounded-control object-cover bg-surface-muted border border-line shrink-0"
                    />
                    <div className="text-xs space-y-1.5 flex-1 min-w-0">
                      <p className="text-slate-700 line-clamp-2">{ticket.description}</p>
                      <p className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {ticket.location.building} • {ticket.location.room}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* AI Observations */}
                  <div className="rounded-control bg-surface-muted border border-line p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-accent-500" aria-hidden="true" />
                        AI Observations
                      </span>
                      <ModeBadge provider={ticket.issueAnalysisMetadata.provider} />
                    </div>
                    <ul className="text-[11px] text-slate-700 list-disc list-inside space-y-0.5">
                      {ticket.aiAssessment.observations.slice(0, 2).map((obs, i) => (
                        <li key={i}>{obs}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Technician work notes if present */}
                  {ticket.workNotes && (
                    <div className="rounded-control bg-amber-50 border border-amber-200 p-2.5 text-xs">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block mb-0.5">
                        Technician Work Log
                      </span>
                      <p className="text-[11px] text-slate-700">{ticket.workNotes}</p>
                    </div>
                  )}

                  {/* AI Verification Results if present */}
                  {ticket.latestVerification && (
                    <div className="rounded-control bg-accent-50 border border-accent-200 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-accent-700 text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-accent-500" aria-hidden="true" />
                          Verdict: {ticket.latestVerification.assessment.visualOutcome.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-accent-700 uppercase">
                            Evidence: {ticket.latestVerification.assessment.evidenceQuality}
                          </span>
                          <ModeBadge provider={ticket.latestVerification.metadata.provider} />
                        </div>
                      </div>
                      <p className="text-[11px] text-accent-700">
                        Action: {ticket.latestVerification.assessment.recommendedAction}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-surface-muted border-t border-line flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTicket(ticket)}
                    className="inline-flex items-center px-3 py-2 rounded-control bg-surface border border-line text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                  >
                    Details
                  </button>

                  <div className="flex items-center gap-2">
                    {isReportedOrAssigned && (
                      <button
                        type="button"
                        onClick={() => onStartWork(ticket.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Start Work</span>
                      </button>
                    )}

                    {isInProgress && (
                      <button
                        type="button"
                        onClick={() => onOpenRepairModal(ticket)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Upload After-Photo &amp; Verify</span>
                      </button>
                    )}

                    {isAwaitingVerification && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Awaiting sign-off</span>
                      </span>
                    )}

                    {isResolved && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Closed</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
