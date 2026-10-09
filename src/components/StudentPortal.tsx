import React, { useState } from 'react';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  MapPin,
  RotateCcw,
  User,
  Wrench,
  Inbox,
  Check,
} from 'lucide-react';
import { Ticket } from '../types';
import { StatusBadge, CategoryPill, UrgentBadge } from './ui/Badges';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { ProgressTracker } from './ui/ProgressTracker';
import { formatRelative, handlerName, estimateFixTime, locationLabel } from '../lib/status';

interface StudentPortalProps {
  tickets: Ticket[];
  onOpenReport: () => void;
  onSelectTicket: (ticket: Ticket) => void;
  onOpenConfirmModal: (ticket: Ticket) => void;
  onOpenReopenModal: (ticket: Ticket) => void;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80';

export const StudentPortal: React.FC<StudentPortalProps> = ({
  tickets,
  onOpenReport,
  onSelectTicket,
  onOpenConfirmModal,
  onOpenReopenModal,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'resolved'>('all');

  const filteredTickets = tickets.filter((t) => {
    if (filterTab === 'active') return t.status !== 'resolved';
    if (filterTab === 'resolved') return t.status === 'resolved';
    return true;
  });

  const tabs: { key: typeof filterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Open' },
    { key: 'resolved', label: 'Fixed' },
  ];

  const openCount = tickets.filter((t) => t.status !== 'resolved').length;
  const waitingCount = tickets.filter((t) => t.status === 'awaiting_verification').length;
  const fixedCount = tickets.filter((t) => t.status === 'resolved').length;

  const recentResolved = tickets
    .filter((t) => t.status === 'resolved')
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My issues</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Report anything that needs fixing around campus — a leak, a broken light, a wobbly desk —
            and follow it here from report to repair.
          </p>
        </div>
        <div className="hidden shrink-0 sm:flex">
          <Button onClick={onOpenReport}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Report an issue
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Open</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{openCount}</p>
        </Card>
        <Card className={`p-4 ${waitingCount > 0 ? 'bg-brand-50 border-brand-200' : ''}`}>
          <p className="text-xs font-medium text-slate-500">Waiting on you</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{waitingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Fixed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{fixedCount}</p>
        </Card>
      </div>

      {/* Filter segmented control */}
      <div className="inline-flex items-center gap-1 rounded-control border border-line bg-surface-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterTab(tab.key)}
            aria-pressed={filterTab === tab.key}
            className={`rounded-control px-4 py-2 text-sm font-semibold transition-colors ${
              filterTab === tab.key
                ? 'bg-surface text-brand-700 shadow-card'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {filteredTickets.length === 0 ? (
        tickets.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
            title="No open issues. Everything's in order."
            description="If something needs fixing, report it and we'll keep you posted from report to repair."
          />
        ) : (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" aria-hidden="true" />}
            title="Nothing here yet."
            description="Nothing matches this filter right now. Try another view."
          />
        )
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const isAwaiting = ticket.status === 'awaiting_verification';
            const canConfirm =
              isAwaiting &&
              !ticket.isSafetyCritical &&
              (ticket.latestVerification
                ? ticket.latestVerification.allowedToRequestConfirmation
                : false);

            return (
              <article
                key={ticket.id}
                className={`rounded-card border shadow-card p-4 transition-shadow hover:shadow-card-hover sm:p-5 ${
                  isAwaiting ? 'border-confirm-200 bg-confirm-50' : 'border-line bg-surface'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border border-line bg-slate-100">
                    <img
                      src={ticket.beforePhotoUrl}
                      alt={`Reported issue photo: ${ticket.aiAssessment.title}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                      }}
                    />
                    <span className="absolute bottom-1 left-1 rounded-sm bg-slate-900/70 px-1.5 py-0.5 text-xs font-medium text-white">
                      Before
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      <CategoryPill department={ticket.department} />
                      {ticket.isSafetyCritical && <UrgentBadge />}
                    </div>

                    <h2 className="text-base font-semibold leading-snug text-slate-900">
                      {ticket.aiAssessment.title}
                    </h2>
                    <p className="line-clamp-2 text-sm text-slate-600">{ticket.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {locationLabel(ticket)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {formatRelative(ticket.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {handlerName(ticket)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {estimateFixTime(ticket)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Awaiting your confirmation */}
                {isAwaiting && (
                  <div className="mt-4 flex flex-col gap-3 rounded-control border border-confirm-200 bg-surface/70 p-3 sm:flex-row sm:items-center">
                    <p className="flex-1 text-sm font-medium text-slate-700">
                      {canConfirm
                        ? 'The crew says this is fixed. Did it work?'
                        : 'This one needs a staff review before it can be confirmed.'}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {canConfirm && (
                        <Button onClick={() => onOpenConfirmModal(ticket)}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Confirm it's fixed
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => onOpenReopenModal(ticket)}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Not fixed yet
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end border-t border-line pt-3">
                  <Button variant="ghost" size="sm" onClick={() => onSelectTicket(ticket)}>
                    View details
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                <ProgressTracker ticket={ticket} className="mt-4" />
              </article>
            );
          })}
        </div>
      )}

      {/* Recently resolved */}
      {filterTab === 'all' && recentResolved.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recently resolved</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Fixed and confirmed by students this week.
            </p>
          </div>
          <div className="space-y-2">
            {recentResolved.map((ticket) => (
              <Card key={ticket.id} className="flex items-center gap-3 p-4">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600"
                  aria-hidden="true"
                >
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {ticket.aiAssessment.title}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {locationLabel(ticket)} · {formatRelative(ticket.createdAt)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
