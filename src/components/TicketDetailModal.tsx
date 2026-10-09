import React, { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Camera,
  Shield,
  Layers,
  Wrench,
  ThumbsUp,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  currentRole: UserRole;
  onConfirmResolution: (ticket: Ticket) => void;
  onReopenTicket: (ticket: Ticket) => void;
  onOpenRepairModal: (ticket: Ticket) => void;
  onStartWork: (ticketId: string) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  isOpen,
  onClose,
  ticket,
  currentRole,
  onConfirmResolution,
  onReopenTicket,
  onOpenRepairModal,
  onStartWork,
}) => {
  const [photoViewMode, setPhotoViewMode] = useState<'both' | 'before' | 'after'>('both');

  if (!isOpen || !ticket) return null;

  const isAwaitingVerification = ticket.status === 'awaiting_verification';
  const isInProgress = ticket.status === 'in_progress';
  const isReportedOrAssigned = ticket.status === 'reported' || ticket.status === 'assigned';
  const isResolved = ticket.status === 'resolved';

  const latestVerif = ticket.latestVerification;
  const isStudent = currentRole === 'student';
  const isAdmin = currentRole === 'admin';

  // Can student confirm resolution?
  // Blocked if safety critical or if verification decision requires human review!
  const canStudentConfirm =
    isAwaitingVerification &&
    !ticket.isSafetyCritical &&
    (latestVerif ? latestVerif.allowedToRequestConfirmation : false);

  const canAdminConfirm = isAwaitingVerification && isAdmin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {ticket.id}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
                Dept: {ticket.department}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  ticket.status === 'resolved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : ticket.status === 'awaiting_verification'
                    ? 'bg-purple-100 text-purple-800'
                    : ticket.status === 'in_progress'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {ticket.status.replace('_', ' ')}
              </span>

              {ticket.isSafetyCritical && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1 shadow-2xs">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Safety-Critical Hazard</span>
                </span>
              )}

              {ticket.issueAnalysisMetadata && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                    ticket.issueAnalysisMetadata.provider === 'gemma'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {ticket.issueAnalysisMetadata.provider === 'gemma' ? 'AI: Gemini 3.8 Flash Live' : 'AI: Fallback Rules'}
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900">{ticket.aiAssessment.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {ticket.location.zone} &gt; {ticket.location.building} &gt; {ticket.location.room}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Reported by {ticket.reporterName} on{' '}
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Gate Alert Banner if Safety-Critical */}
        {ticket.isSafetyCritical && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Deterministic Safety Gate Active: </span>
              This ticket involves high-voltage electrical, fire, or structural risk. Per CampusCare policy,
              certified campus administration sign-off is mandatory. Student unilateral resolution is disabled.
            </div>
          </div>
        )}

        {/* Photographic Evidence: Before vs After Side-by-Side */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Photographic Evidence</span>
            </span>

            {ticket.afterPhotoUrl && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
                <button
                  onClick={() => setPhotoViewMode('both')}
                  className={`px-2 py-0.5 rounded ${photoViewMode === 'both' ? 'bg-white shadow-2xs text-slate-900 font-bold' : 'text-slate-600'}`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setPhotoViewMode('before')}
                  className={`px-2 py-0.5 rounded ${photoViewMode === 'before' ? 'bg-white shadow-2xs text-slate-900 font-bold' : 'text-slate-600'}`}
                >
                  Before
                </button>
                <button
                  onClick={() => setPhotoViewMode('after')}
                  className={`px-2 py-0.5 rounded ${photoViewMode === 'after' ? 'bg-white shadow-2xs text-slate-900 font-bold' : 'text-slate-600'}`}
                >
                  After
                </button>
              </div>
            )}
          </div>

          <div
            className={`grid gap-3 ${
              ticket.afterPhotoUrl && photoViewMode === 'both' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {/* Before Photo */}
            {(photoViewMode === 'both' || photoViewMode === 'before') && (
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 h-56 sm:h-64 shadow-2xs">
                <img
                  src={ticket.beforePhotoUrl}
                  alt="Original Incident"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-xs">
                  Initial Defect (Before)
                </div>
              </div>
            )}

            {/* After Photo */}
            {ticket.afterPhotoUrl && (photoViewMode === 'both' || photoViewMode === 'after') && (
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 h-56 sm:h-64 shadow-2xs">
                <img
                  src={ticket.afterPhotoUrl}
                  alt="Post Repair"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-xs">
                  Repair Evidence (After)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Latest AI Repair Verification Breakdown */}
        {latestVerif && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 to-indigo-50/80 border border-purple-200/90 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-purple-950 uppercase tracking-wider">
                    Gemini 3.8 Flash Verification Verdict (Attempt #{latestVerif.attemptNumber})
                  </h4>
                  <span className="text-[11px] text-purple-700">
                    Mode:{' '}
                    <strong>{latestVerif.metadata.provider === 'gemma' ? 'Live Gemini 3.8 Flash' : 'Deterministic Rules'}</strong>
                  </span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] border ${
                    latestVerif.assessment.visualOutcome === 'improved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : latestVerif.assessment.visualOutcome === 'inconclusive'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}
                >
                  Outcome: {latestVerif.assessment.visualOutcome}
                </span>

                <span
                  className={`px-2 py-1 rounded-lg font-semibold text-[10px] border ${
                    latestVerif.assessment.evidenceQuality === 'clear'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Quality: {latestVerif.assessment.evidenceQuality}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-white/90 p-3 rounded-xl border border-purple-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                  ✓ Visible Changes Evaluated:
                </span>
                <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                  {latestVerif.assessment.visibleChanges.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-purple-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Remaining Concerns & Action:
                </span>
                {latestVerif.assessment.remainingConcerns.length > 0 ? (
                  <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside">
                    {latestVerif.assessment.remainingConcerns.map((rc, i) => (
                      <li key={i}>{rc}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-700 font-medium">
                    No residual physical defects identified in post-repair frame.
                  </p>
                )}
                <span className="block text-[11px] text-slate-500 font-medium mt-2 pt-1 border-t border-slate-100">
                  Recommended Action: <strong>{latestVerif.assessment.recommendedAction}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Technician Work Notes */}
        {ticket.workNotes && (
          <div className="mt-4 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 text-xs">
            <span className="font-bold text-amber-900 uppercase text-[10px] block mb-1">
              Technician Field Notes ({ticket.assignedTechnician || 'Staff'}):
            </span>
            <p className="text-slate-800 leading-relaxed">{ticket.workNotes}</p>
          </div>
        )}

        {/* Immutable Audit Trail Timeline */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Traceable Workflow Audit Log
          </h4>
          <div className="space-y-3">
            {ticket.auditTrail.map((event) => (
              <div key={event.id} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{event.action}</span>
                    <span className="text-slate-400 text-[10px]">•</span>
                    <span className="text-slate-500 text-[11px] font-medium">{event.actor}</span>
                    <span className="text-slate-400 text-[10px] ml-auto">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {event.notes && <p className="text-slate-600 text-[11px] mt-0.5">{event.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions with Policy Gates */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Technician Start Work */}
            {isReportedOrAssigned && (currentRole === 'technician' || currentRole === 'admin') && (
              <button
                onClick={() => {
                  onStartWork(ticket.id);
                  onClose();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Accept & Start Work
              </button>
            )}

            {/* Technician Upload After-Photo */}
            {isInProgress && (currentRole === 'technician' || currentRole === 'admin') && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRepairModal(ticket);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Upload After-Photo & Complete Work
              </button>
            )}

            {/* Resolution Actions */}
            {isAwaitingVerification && (
              <>
                {canStudentConfirm || canAdminConfirm ? (
                  <button
                    onClick={() => {
                      onClose();
                      onConfirmResolution(ticket);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Resolution</span>
                  </button>
                ) : isStudent ? (
                  <div className="text-xs text-rose-700 font-semibold flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Admin sign-off required (safety policy)</span>
                  </div>
                ) : null}

                <button
                  onClick={() => {
                    onClose();
                    onReopenTicket(ticket);
                  }}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Ticket</span>
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
