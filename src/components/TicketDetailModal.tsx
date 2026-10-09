import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Camera,
  Wrench,
  ShieldAlert,
  Info,
  Layers,
  History,
  FileText,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';
import {
  StatusBadge,
  PriorityBadge,
  ModeBadge,
  SafetyBadge,
  TicketIdChip,
} from './ui/Badges';

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

type TabId = 'overview' | 'evidence' | 'ai' | 'history';
type PhotoView = 'both' | 'before' | 'after';

const formatAction = (action: string) => action.replace(/_/g, ' ');

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
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [photoViewMode, setPhotoViewMode] = useState<PhotoView>('both');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Escape closes the lightbox first, then the dialog. Body scroll is locked while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxSrc) setLightboxSrc(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, lightboxSrc, onClose]);

  if (!isOpen || !ticket) return null;

  const isAwaitingVerification = ticket.status === 'awaiting_verification';
  const isInProgress = ticket.status === 'in_progress';
  const isReportedOrAssigned = ticket.status === 'reported' || ticket.status === 'assigned';
  const latestVerif = ticket.latestVerification;
  const isStudent = currentRole === 'student';
  const isAdmin = currentRole === 'admin';

  // Policy gate: safety-critical repairs and inconclusive assessments require admin sign-off.
  const canStudentConfirm =
    isAwaitingVerification &&
    !ticket.isSafetyCritical &&
    (latestVerif ? latestVerif.allowedToRequestConfirmation : false);
  const canAdminConfirm = isAwaitingVerification && isAdmin;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'ai', label: 'AI Analysis' },
    { id: 'history', label: 'History' },
  ];

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === activeTab);
    if (e.key === 'ArrowRight') setActiveTab(tabs[(i + 1) % tabs.length].id);
    if (e.key === 'ArrowLeft') setActiveTab(tabs[(i - 1 + tabs.length) % tabs.length].id);
  };

  const openLightbox = (src?: string) => {
    if (src) setLightboxSrc(src);
  };

  const sectionCard = 'bg-surface rounded-card border border-line shadow-card';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={() => setLightboxSrc(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        className="bg-surface rounded-card max-w-4xl w-full shadow-2xl border border-line relative my-4 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-line">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <TicketIdChip id={ticket.id} />
                <StatusBadge status={ticket.status} pulse={isAwaitingVerification} />
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-line">
                  Dept: {ticket.department}
                </span>
                {ticket.isSafetyCritical && <SafetyBadge />}
                <ModeBadge provider={ticket.issueAnalysisMetadata?.provider} />
              </div>
              <h2 id="ticket-detail-title" className="text-lg sm:text-xl font-bold text-slate-900">
                {ticket.aiAssessment.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {ticket.location.zone} &gt; {ticket.location.building} &gt; {ticket.location.room}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Reported by {ticket.reporterName} on {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close ticket details"
              className="p-1.5 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section tabs */}
          <div
            role="tablist"
            aria-label="Ticket sections"
            onKeyDown={onTabKeyDown}
            className="mt-4 flex items-center gap-1 bg-slate-100 p-1 rounded-card overflow-x-auto"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={activeTab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={activeTab === t.id ? 0 : -1}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-control text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'bg-surface text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto"
        >
          {ticket.isSafetyCritical && (
            <div className="p-3 bg-critical-50 border border-critical-200 rounded-card text-xs text-critical-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-critical-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Safety gate active: </span>
                This ticket involves high-voltage, fire, or structural risk. Certified administration sign-off is
                mandatory; student unilateral resolution is disabled. A photo cannot prove functional safety.
              </div>
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className={sectionCard}>
                <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Reported Issue
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{ticket.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <Fact label="Priority">
                      <PriorityBadge priority={ticket.aiAssessment.priority} />
                    </Fact>
                    <Fact label="Department">
                      <span className="text-xs font-semibold text-slate-800">{ticket.department}</span>
                    </Fact>
                    <Fact label="Assigned technician">
                      <span className="text-xs font-semibold text-slate-800">
                        {ticket.assignedTechnician || 'Unassigned'}
                      </span>
                    </Fact>
                    <Fact label="Reported">
                      <span className="text-xs font-semibold text-slate-800">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </Fact>
                  </div>
                </div>
              </div>

              {ticket.workNotes && (
                <div className="p-3.5 bg-warning-50/60 rounded-card border border-warning-200">
                  <span className="font-bold text-warning-800 uppercase text-[10px] block mb-1">
                    Technician field notes ({ticket.assignedTechnician || 'Staff'})
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed">{ticket.workNotes}</p>
                </div>
              )}

              {latestVerif && (
                <div className={`${sectionCard} p-4`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Latest verification
                    </h3>
                    <ModeBadge provider={latestVerif.metadata.provider} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OutcomeBadge outcome={latestVerif.assessment.visualOutcome} />
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-line bg-slate-50 text-slate-600">
                      Evidence: {latestVerif.assessment.evidenceQuality}
                    </span>
                    {latestVerif.requiresHumanReview && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-critical-100 text-critical-700 border border-critical-200">
                        <AlertTriangle className="w-3 h-3" />
                        Human review required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Recommended action:{' '}
                    <strong className="text-slate-800">{formatAction(latestVerif.assessment.recommendedAction)}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Before &amp; after evidence
                </span>
                {ticket.afterPhotoUrl && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-control text-[11px]">
                    {(['both', 'before', 'after'] as PhotoView[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPhotoViewMode(mode)}
                        aria-pressed={photoViewMode === mode}
                        className={`px-2 py-0.5 rounded ${
                          photoViewMode === mode
                            ? 'bg-surface shadow-2xs text-slate-900 font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        {mode === 'both' ? 'Side-by-side' : mode[0].toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={`grid gap-3 ${
                  ticket.afterPhotoUrl && photoViewMode === 'both' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {(photoViewMode === 'both' || photoViewMode === 'before') && (
                  <EvidenceImage
                    label="Before · original defect"
                    tone="rose"
                    src={ticket.beforePhotoUrl}
                    subtitle={`Submitted ${new Date(ticket.createdAt).toLocaleString()}`}
                    onOpen={() => openLightbox(ticket.beforePhotoUrl)}
                  />
                )}
                {ticket.afterPhotoUrl && (photoViewMode === 'both' || photoViewMode === 'after') && (
                  <EvidenceImage
                    label="After · repair evidence"
                    tone="emerald"
                    src={ticket.afterPhotoUrl}
                    subtitle={`Uploaded ${
                      latestVerif ? new Date(latestVerif.createdAt).toLocaleString() : new Date(ticket.updatedAt).toLocaleString()
                    }`}
                    onOpen={() => openLightbox(ticket.afterPhotoUrl)}
                  />
                )}
              </div>

              <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Photographic evidence supports visual comparison only. It does not by itself prove functional or
                electrical safety.
              </p>

              {latestVerif && (latestVerif.riskSignals?.length || latestVerif.challengeState) && (
                <div className={`${sectionCard} p-4 space-y-2`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Evidence integrity signals
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {latestVerif.riskLevel && (
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          latestVerif.riskLevel === 'high'
                            ? 'bg-critical-100 text-critical-700 border-critical-200'
                            : latestVerif.riskLevel === 'medium'
                            ? 'bg-warning-100 text-warning-800 border-warning-200'
                            : 'bg-success-100 text-success-700 border-success-200'
                        }`}
                      >
                        Risk: {latestVerif.riskLevel}
                      </span>
                    )}
                    {latestVerif.challengeState && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-line bg-slate-50 text-slate-600">
                        Live challenge: {latestVerif.challengeState.status}
                      </span>
                    )}
                  </div>
                  {latestVerif.riskSignals && latestVerif.riskSignals.length > 0 && (
                    <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5">
                      {latestVerif.riskSignals.map((s, i) => (
                        <li key={`${s.code}-${i}`}>
                          <span className="font-semibold text-slate-700">{s.code}</span>: {s.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI ANALYSIS */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className={`${sectionCard} overflow-hidden`}>
                <div className="px-4 py-2.5 border-b border-line flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Sparkles className="w-4 h-4 text-accent-600" />
                    Reported-issue analysis
                  </span>
                  <ModeBadge provider={ticket.issueAnalysisMetadata?.provider} />
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={ticket.aiAssessment.priority} />
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-line">
                      Suggested dept: {ticket.aiAssessment.recommendedDepartment}
                    </span>
                    {ticket.aiAssessment.needsHumanReview && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-critical-100 text-critical-700 border border-critical-200">
                        <AlertTriangle className="w-3 h-3" />
                        Human review flagged
                      </span>
                    )}
                  </div>

                  <div>
                    <SubHeading>Visible image observations</SubHeading>
                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                      {ticket.aiAssessment.observations.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>

                  {ticket.aiAssessment.reviewReasons.length > 0 && (
                    <div>
                      <SubHeading>Why review is recommended</SubHeading>
                      <ul className="text-xs text-critical-700 space-y-1 list-disc list-inside">
                        {ticket.aiAssessment.reviewReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 border-t border-line pt-2">
                    These are AI recommendations over the submitted description and image, not verified facts. The
                    original description is preserved unchanged.
                  </p>
                </div>
              </div>

              {latestVerif ? (
                <div className={`${sectionCard} overflow-hidden`}>
                  <div className="px-4 py-2.5 border-b border-line flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Sparkles className="w-4 h-4 text-accent-600" />
                      Repair verification (attempt #{latestVerif.attemptNumber})
                    </span>
                    <ModeBadge provider={latestVerif.metadata.provider} />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <OutcomeBadge outcome={latestVerif.assessment.visualOutcome} />
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-line bg-slate-50 text-slate-600">
                        Evidence quality: {latestVerif.assessment.evidenceQuality}
                      </span>
                      {latestVerif.requiresHumanReview && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-critical-100 text-critical-700 border border-critical-200">
                          <AlertTriangle className="w-3 h-3" />
                          Human review required
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-surface-muted p-3 rounded-control border border-line">
                        <SubHeading>Visible changes</SubHeading>
                        <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                          {latestVerif.assessment.visibleChanges.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-surface-muted p-3 rounded-control border border-line">
                        <SubHeading>Remaining concerns</SubHeading>
                        {latestVerif.assessment.remainingConcerns.length > 0 ? (
                          <ul className="text-xs text-critical-700 space-y-1 list-disc list-inside">
                            {latestVerif.assessment.remainingConcerns.map((rc, i) => (
                              <li key={i}>{rc}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-success-700 font-medium">
                            No residual defects identified in the post-repair frame.
                          </p>
                        )}
                      </div>
                    </div>

                    {latestVerif.assessment.artifactSignals && latestVerif.assessment.artifactSignals.length > 0 && (
                      <div>
                        <SubHeading>Manipulation / artifact signals</SubHeading>
                        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                          {latestVerif.assessment.artifactSignals.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-slate-600 border-t border-line pt-2">
                      Recommended action:{' '}
                      <strong className="text-slate-800">{formatAction(latestVerif.assessment.recommendedAction)}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyNote text="No repair verification has been recorded for this ticket yet." />
              )}
            </div>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <div className={sectionCard}>
              <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
                <History className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Audit trail
                </h3>
              </div>
              <ol className="p-4 space-y-4">
                {ticket.auditTrail.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-bold text-slate-900">{event.action}</span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-500 font-medium">{event.actor}</span>
                        <time className="text-slate-400 ml-auto" dateTime={event.timestamp}>
                          {new Date(event.timestamp).toLocaleString()}
                        </time>
                      </div>
                      {event.notes && <p className="text-slate-600 mt-0.5">{event.notes}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer actions with policy gates */}
        <div className="p-5 sm:p-6 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isReportedOrAssigned && (currentRole === 'technician' || currentRole === 'admin') && (
              <button
                onClick={() => {
                  onStartWork(ticket.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-control text-xs font-bold shadow-xs transition-colors"
              >
                <Wrench className="w-3.5 h-3.5" />
                Accept &amp; start work
              </button>
            )}

            {isInProgress && (currentRole === 'technician' || currentRole === 'admin') && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRepairModal(ticket);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-control text-xs font-bold shadow-xs transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Upload after-photo &amp; complete work
              </button>
            )}

            {isAwaitingVerification && (
              <>
                {canStudentConfirm || canAdminConfirm ? (
                  <button
                    onClick={() => {
                      onClose();
                      onConfirmResolution(ticket);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-control text-xs font-bold shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirm resolution
                  </button>
                ) : isStudent ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-critical-700 font-semibold bg-critical-50 px-3 py-1.5 rounded-control border border-critical-200">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    Admin sign-off required (safety policy)
                  </span>
                ) : null}

                <button
                  onClick={() => {
                    onClose();
                    onReopenTicket(ticket);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-critical-50 hover:bg-critical-100 text-critical-700 border border-critical-200 rounded-control text-xs font-bold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reopen ticket
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-control text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-size evidence preview"
          className="fixed inset-0 z-[60] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            aria-label="Close image preview"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded-control bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Full-size evidence"
            className="max-h-[90vh] max-w-full object-contain rounded-card"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    {children}
  </div>
);

const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{children}</span>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-card border border-dashed border-line bg-surface-muted p-6 text-center text-xs text-slate-500">
    {text}
  </div>
);

const OutcomeBadge: React.FC<{ outcome: string }> = ({ outcome }) => {
  const tone =
    outcome === 'improved'
      ? 'bg-success-100 text-success-800 border-success-200'
      : outcome === 'inconclusive'
      ? 'bg-warning-100 text-warning-800 border-warning-200'
      : outcome === 'unchanged'
      ? 'bg-slate-100 text-slate-700 border-line'
      : 'bg-critical-100 text-critical-800 border-critical-200';
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${tone}`}>
      Outcome: {outcome}
    </span>
  );
};

const EvidenceImage: React.FC<{
  label: string;
  subtitle: string;
  tone: 'rose' | 'emerald';
  src?: string;
  onOpen: () => void;
}> = ({ label, subtitle, tone, src, onOpen }) => (
  <div className="relative rounded-card overflow-hidden bg-slate-100 border border-line h-56 sm:h-64">
    {src ? (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${label} at full size`}
        className="block w-full h-full cursor-zoom-in"
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
      </button>
    ) : (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        No image available
      </div>
    )}
    <span
      className={`absolute top-3 left-3 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full text-white ${
        tone === 'rose' ? 'bg-critical-600/90' : 'bg-success-600/90'
      }`}
    >
      {label}
    </span>
    <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 text-white text-[10px] px-2.5 py-1">
      {subtitle}
    </span>
  </div>
);
