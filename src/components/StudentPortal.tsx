import React, { useState } from 'react';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  MapPin,
  Calendar,
  Sparkles,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Ticket } from '../types';

interface StudentPortalProps {
  tickets: Ticket[];
  onOpenReport: () => void;
  onSelectTicket: (ticket: Ticket) => void;
  onOpenConfirmModal: (ticket: Ticket) => void;
  onOpenReopenModal: (ticket: Ticket) => void;
}

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

  const getStatusBadge = (ticket: Ticket) => {
    switch (ticket.status) {
      case 'reported':
        return { label: 'Reported / Triaged', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'assigned':
        return { label: 'Assigned to Staff', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'in_progress':
        return { label: 'Work In Progress', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'awaiting_verification':
        return {
          label: ticket.isSafetyCritical ? 'Awaiting Safety Review' : 'Awaiting Your Verification',
          color: 'bg-purple-100 text-purple-800 border-purple-200 animate-pulse',
        };
      case 'resolved':
        return { label: 'Resolved & Verified', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'reopened':
        return { label: 'Reopened by Student', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'escalated':
        return { label: 'Escalated / Review Required', color: 'bg-red-100 text-red-800 border-red-200' };
      default:
        return { label: ticket.status, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Header Strip */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/30 text-blue-100 text-xs font-semibold mb-2 border border-blue-300/30">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Student Maintenance Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            CampusCare Student Self-Service
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-blue-100 leading-relaxed">
            Report maintenance issues with photos & natural descriptions. Review before-and-after photographic evidence, and confirm verified repairs with institutional accountability.
          </p>
        </div>

        <button
          onClick={onOpenReport}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-blue-700 font-bold text-xs shadow-lg hover:bg-blue-50 active:scale-95 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4 text-blue-600" />
          <span>Report Maintenance Issue</span>
        </button>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            All Reports ({tickets.length})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'active' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Active In Progress ({tickets.filter((t) => t.status !== 'resolved').length})
          </button>
          <button
            onClick={() => setFilterTab('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'resolved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Resolved ({tickets.filter((t) => t.status === 'resolved').length})
          </button>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredTickets.length} campus incidents
        </span>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">No unresolved tickets in this view!</h3>
            <p className="text-xs text-slate-500 mt-1">
              All reported campus facilities are operating normally or have been resolved.
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const statusInfo = getStatusBadge(ticket);
            const isAwaitingVerification = ticket.status === 'awaiting_verification';
            const latestVerif = ticket.latestVerification;
            const canConfirm =
              isAwaitingVerification &&
              !ticket.isSafetyCritical &&
              (latestVerif ? latestVerif.allowedToRequestConfirmation : false);

            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 ${
                  isAwaitingVerification
                    ? 'border-purple-300 ring-2 ring-purple-100 bg-purple-50/20'
                    : 'border-slate-200/90'
                }`}
              >
                {/* Left: Core Details */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <img
                      src={ticket.beforePhotoUrl}
                      alt={ticket.aiAssessment.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80';
                      }}
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded-sm uppercase font-mono">
                      Before
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {ticket.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        Dept: {ticket.department}
                      </span>

                      {ticket.isSafetyCritical && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Safety Critical</span>
                        </span>
                      )}

                      {ticket.issueAnalysisMetadata && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            ticket.issueAnalysisMetadata.provider === 'gemma'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {ticket.issueAnalysisMetadata.provider === 'gemma' ? 'Gemma 4' : 'Fallback'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {ticket.aiAssessment.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-1">{ticket.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {ticket.location.building} • {ticket.location.room}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(ticket.createdAt).toLocaleDateString()} at{' '}
                        {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                  {isAwaitingVerification ? (
                    <>
                      {canConfirm ? (
                        <button
                          onClick={() => onOpenConfirmModal(ticket)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Resolved</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Admin Review Required</span>
                        </span>
                      )}

                      <button
                        onClick={() => onOpenReopenModal(ticket)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen</span>
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={() => onSelectTicket(ticket)}
                    className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    <span>Audit & Evidence</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
