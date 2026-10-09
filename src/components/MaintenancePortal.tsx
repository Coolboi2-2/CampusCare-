import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  Upload,
  Sparkles,
  AlertCircle,
  Eye,
  Camera,
  Play,
  ArrowRight,
} from 'lucide-react';
import { Ticket, Department } from '../types';

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

  return (
    <div className="space-y-6">
      {/* Maintenance Header Strip */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/30 text-amber-100 text-xs font-semibold mb-2 border border-amber-300/30">
            <Wrench className="w-3.5 h-3.5 text-amber-200" />
            <span>Facilities & Maintenance Work Queues</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Maintenance Dispatch & Field Service
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-amber-100 leading-relaxed">
            Accept department-assigned work orders, log repair activities, and submit after-repair photographic evidence for automated AI verification and student sign-off.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-amber-900/40 p-4 rounded-2xl border border-amber-400/20 text-center shrink-0">
          <div>
            <span className="text-[11px] text-amber-200 uppercase font-semibold">Active In Queue</span>
            <div className="text-2xl font-bold text-white">
              {tickets.filter((t) => t.status !== 'resolved').length}
            </div>
          </div>
          <div className="w-px h-8 bg-amber-400/30" />
          <div>
            <span className="text-[11px] text-amber-200 uppercase font-semibold">Ready for Review</span>
            <div className="text-2xl font-bold text-white">
              {tickets.filter((t) => t.status === 'awaiting_verification').length}
            </div>
          </div>
        </div>
      </div>

      {/* Department Tabs */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Queue:
          </span>
          {DEPARTMENTS.map((dept) => {
            const count = tickets.filter(
              (t) => (dept === 'All' || t.department === dept) && t.status !== 'resolved'
            ).length;

            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  selectedDept === dept
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>{dept}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    selectedDept === dept ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              statusFilter === 'active' ? 'bg-amber-100 text-amber-800' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Open & In Progress
          </button>
          <button
            onClick={() => setStatusFilter('awaiting')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              statusFilter === 'awaiting' ? 'bg-purple-100 text-purple-800' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Awaiting Verification ({tickets.filter((t) => t.status === 'awaiting_verification').length})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              statusFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Tickets
          </button>
        </div>
      </div>

      {/* Department Work Queue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredTickets.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
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
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Header Strip */}
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {ticket.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          ticket.aiAssessment.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-700'
                            : ticket.aiAssessment.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Priority: {ticket.aiAssessment.priority}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {ticket.aiAssessment.title}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border shrink-0 ${
                      ticket.status === 'in_progress'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : ticket.status === 'awaiting_verification'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : ticket.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <img
                        src={ticket.beforePhotoUrl}
                        alt="Defect"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs space-y-1 flex-1">
                      <p className="text-slate-700 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {ticket.location.building} • {ticket.location.room}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visible Observations from Gemini 3.8 Flash */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>AI Observations:</span>
                    </span>
                    <ul className="text-[11px] text-slate-700 list-disc list-inside space-y-0.5">
                      {ticket.aiAssessment.observations.slice(0, 2).map((obs, i) => (
                        <li key={i}>{obs}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Technician work notes if present */}
                  {ticket.workNotes && (
                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block mb-0.5">
                        Technician Work Log:
                      </span>
                      <p className="text-[11px] text-slate-700">{ticket.workNotes}</p>
                    </div>
                  )}

                  {/* AI Verification Results if awaiting verification */}
                  {ticket.latestVerification && (
                    <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-900 text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Verdict: {ticket.latestVerification.assessment.visualOutcome.toUpperCase()}</span>
                        </span>
                        <span className="text-[10px] font-bold text-purple-700 uppercase">
                          Evidence: {ticket.latestVerification.assessment.evidenceQuality}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-800">
                        Action: {ticket.latestVerification.assessment.recommendedAction}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectTicket(ticket)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Details
                  </button>

                  <div className="flex items-center gap-2">
                    {isReportedOrAssigned && (
                      <button
                        onClick={() => onStartWork(ticket.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Work</span>
                      </button>
                    )}

                    {isInProgress && (
                      <button
                        onClick={() => onOpenRepairModal(ticket)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload After-Photo & Verify</span>
                      </button>
                    )}

                    {isAwaitingVerification && (
                      <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Awaiting Student Sign-Off</span>
                      </span>
                    )}

                    {isResolved && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Closed & Verified</span>
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
