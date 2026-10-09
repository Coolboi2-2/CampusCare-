import React, { useState } from 'react';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  MapPin,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Ticket } from '../types';
import { StatusBadge, ModeBadge, SafetyBadge, TicketIdChip } from './ui/Badges';

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

  const tabs: { key: typeof filterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All Reports', count: tickets.length },
    { key: 'active', label: 'Active In Progress', count: tickets.filter((t) => t.status !== 'resolved').length },
    { key: 'resolved', label: 'Resolved', count: tickets.filter((t) => t.status === 'resolved').length },
  ];

  return (
    <div className="space-y-6">
      {/* Compact page header */}
      <div className="bg-surface rounded-card border border-line shadow-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
            Student Maintenance Portal
          </span>
          <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            CampusCare Student Self-Service
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Report maintenance issues with photos &amp; natural descriptions. Review before-and-after
            photographic evidence, and confirm verified repairs with institutional accountability.
          </p>
        </div>

        <button
          onClick={onOpenReport}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-card transition-colors active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report Issue</span>
        </button>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-control border border-line">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              aria-pressed={filterTab === tab.key}
              className={`px-3 py-1.5 rounded-control text-xs font-semibold transition-colors ${
                filterTab === tab.key
                  ? 'bg-surface text-brand-700 shadow-xs border border-line'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredTickets.length} campus incidents
        </span>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="bg-surface rounded-card border border-line shadow-card p-12 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-success-500 mb-2" />
            <h2 className="font-bold text-slate-800 text-sm">No unresolved tickets in this view</h2>
            <p className="text-xs text-slate-500 mt-1">
              All reported campus facilities are operating normally or have been resolved.
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const statusLabel =
              ticket.status === 'awaiting_verification'
                ? ticket.isSafetyCritical
                  ? 'Awaiting Safety Review'
                  : 'Awaiting Your Verification'
                : undefined;
            const isAwaitingVerification = ticket.status === 'awaiting_verification';
            const latestVerif = ticket.latestVerification;
            const canConfirm =
              isAwaitingVerification &&
              !ticket.isSafetyCritical &&
              (latestVerif ? latestVerif.allowedToRequestConfirmation : false);

            return (
              <article
                key={ticket.id}
                className={`rounded-card border shadow-card transition-shadow hover:shadow-card-hover p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isAwaitingVerification
                    ? 'bg-accent-50/40 border-accent-200 ring-2 ring-accent-100'
                    : 'bg-surface border-line'
                }`}
              >
                {/* Left: Core Details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="relative w-20 h-20 rounded-control overflow-hidden bg-slate-100 border border-line shrink-0">
                    <img
                      src={ticket.beforePhotoUrl}
                      alt={`Reported issue photo: ${ticket.aiAssessment.title}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                      }}
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded-sm uppercase font-mono">
                      Before
                    </span>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TicketIdChip id={ticket.id} />
                      <StatusBadge
                        status={ticket.status}
                        label={statusLabel}
                        pulse={isAwaitingVerification && !ticket.isSafetyCritical}
                      />
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-line bg-surface-muted text-slate-600">
                        {ticket.department}
                      </span>

                      {ticket.isSafetyCritical && <SafetyBadge />}

                      {ticket.issueAnalysisMetadata && (
                        <ModeBadge provider={ticket.issueAnalysisMetadata.provider} />
                      )}
                    </div>

                    <h2 className="font-bold text-slate-900 text-sm leading-snug">
                      {ticket.aiAssessment.title}
                    </h2>
                    <p className="text-xs text-slate-600 line-clamp-1">{ticket.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {ticket.location.building} &bull; {ticket.location.room}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(ticket.createdAt).toLocaleDateString()} at{' '}
                        {new Date(ticket.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {ticket.assignedTechnician && (
                        <span className="text-slate-700 font-medium">
                          Assigned: {ticket.assignedTechnician}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-line shrink-0">
                  {isAwaitingVerification ? (
                    <>
                      {canConfirm ? (
                        <button
                          onClick={() => onOpenConfirmModal(ticket)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-control bg-success-600 hover:bg-success-700 text-white text-xs font-bold transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Resolved</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-critical-700 bg-critical-50 px-2.5 py-1.5 rounded-control border border-critical-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-critical-600 shrink-0" />
                          <span>Admin Review Required</span>
                        </span>
                      )}

                      <button
                        onClick={() => onOpenReopenModal(ticket)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-control bg-surface border border-critical-200 text-critical-700 hover:bg-critical-50 text-xs font-semibold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen</span>
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={() => onSelectTicket(ticket)}
                    className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-control bg-surface border border-line text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                  >
                    <span>Audit &amp; Evidence</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
