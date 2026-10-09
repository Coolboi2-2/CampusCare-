import React, { useState } from 'react';
import { Wrench, CheckCircle2, MapPin, Clock, Camera, Play, Inbox } from 'lucide-react';
import { Ticket, Department } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { StatusBadge, CategoryPill, UrgentBadge } from './ui/Badges';
import { EmptyState } from './ui/EmptyState';
import { estimateFixTime, handlerName, locationLabel } from '../lib/status';

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
      {/* Page header */}
      <header className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card border border-brand-200 bg-brand-50 text-brand-700">
            <Wrench className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Maintenance operations
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
              Pick up work orders for your team, update progress as you go, and upload an
              after-photo when the repair is done.
            </p>
          </div>
        </div>

        {/* Queue stats */}
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Card className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active in queue
            </span>
            <div className="mt-1 text-2xl font-bold text-slate-900">{activeCount}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ready for review
            </span>
            <div className="mt-1 text-2xl font-bold text-confirm-700">{readyForReviewCount}</div>
          </Card>
        </div>
      </header>

      {/* Department queues + status filter */}
      <div className="space-y-3">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="Department queues"
        >
          <span className="mr-1 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-700">
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
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-card'
                    : 'border border-line bg-surface text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{dept}</span>
                <span
                  className={`rounded px-1.5 text-xs ${
                    isSelected ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-sm">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            aria-pressed={statusFilter === 'active'}
            className={`rounded-control px-3 py-1.5 font-semibold transition-colors ${
              statusFilter === 'active'
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('awaiting')}
            aria-pressed={statusFilter === 'awaiting'}
            className={`rounded-control px-3 py-1.5 font-semibold transition-colors ${
              statusFilter === 'awaiting'
                ? 'bg-confirm-50 text-confirm-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Ready to confirm ({readyForReviewCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            aria-pressed={statusFilter === 'all'}
            className={`rounded-control px-3 py-1.5 font-semibold transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Work queue */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {filteredTickets.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState
              icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
              title="No open work orders"
              description="Nothing needs attention right now."
            />
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isReportedOrAssigned = ticket.status === 'reported' || ticket.status === 'assigned';
            const isInProgress = ticket.status === 'in_progress';
            const isAwaitingVerification = ticket.status === 'awaiting_verification';
            const isResolved = ticket.status === 'resolved';

            const outcomeText = ticket.latestVerification
              ? ticket.latestVerification.assessment.visualOutcome === 'improved'
                ? 'Repair looks complete'
                : 'Needs another look'
              : null;

            return (
              <Card
                key={ticket.id}
                className="flex flex-col overflow-hidden transition-shadow hover:shadow-card-hover"
              >
                {/* Card face: status + category (+ urgent only when safety-critical) */}
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <CategoryPill department={ticket.department} />
                    {ticket.isSafetyCritical && <UrgentBadge />}
                  </div>

                  <h3 className="text-base font-semibold leading-snug text-slate-900">
                    {ticket.aiAssessment.title}
                  </h3>

                  <div className="flex items-start gap-3">
                    <img
                      src={ticket.beforePhotoUrl}
                      alt={`Reported issue for ${ticket.id}`}
                      className="h-16 w-16 shrink-0 rounded-control border border-line bg-surface-muted object-cover"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                      <p className="line-clamp-2 text-slate-700">{ticket.description}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{locationLabel(ticket)}</span>
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-slate-500">Handler</dt>
                      <dd className="truncate font-medium text-slate-700">{handlerName(ticket)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-slate-500">Typical fix time</dt>
                      <dd className="truncate font-medium text-slate-700">{estimateFixTime(ticket)}</dd>
                    </div>
                  </dl>

                  {ticket.workNotes && (
                    <p className="rounded-control border border-line bg-surface-muted p-2.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Work log: </span>
                      {ticket.workNotes}
                    </p>
                  )}

                  {outcomeText && (
                    <p
                      className={`text-xs font-medium ${
                        outcomeText === 'Repair looks complete' ? 'text-success-700' : 'text-warning-700'
                      }`}
                    >
                      {outcomeText}
                    </p>
                  )}
                </div>

                {/* Footer actions */}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-muted p-4">
                  <Button variant="secondary" size="md" onClick={() => onSelectTicket(ticket)}>
                    Details
                  </Button>

                  <div className="flex items-center gap-2">
                    {isReportedOrAssigned && (
                      <Button variant="primary" size="md" onClick={() => onStartWork(ticket.id)}>
                        <Play className="h-4 w-4" aria-hidden="true" />
                        Start work
                      </Button>
                    )}

                    {isInProgress && (
                      <Button variant="primary" size="md" onClick={() => onOpenRepairModal(ticket)}>
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        Upload after-photo &amp; verify
                      </Button>
                    )}

                    {isAwaitingVerification && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-confirm-700">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span>Awaiting sign-off</span>
                      </span>
                    )}

                    {isResolved && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-700">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Closed</span>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
