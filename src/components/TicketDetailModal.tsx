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
  CategoryPill,
  UrgentBadge,
  ModeBadge,
  TicketIdChip,
} from './ui/Badges';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ProgressTracker } from './ui/ProgressTracker';
import {
  handlerName,
  estimateFixTime,
  formatDateTime,
  locationLabel,
} from '../lib/status';

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
    { id: 'evidence', label: 'Photos' },
    ...(!isStudent ? [{ id: 'ai' as TabId, label: 'Repair details' }] : []),
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={() => setLightboxSrc(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        className="relative my-4 w-full max-w-4xl rounded-card border border-line bg-surface shadow-2xl sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-line p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} pulse={isAwaitingVerification} />
                <CategoryPill department={ticket.department} />
                {ticket.isSafetyCritical && <UrgentBadge />}
              </div>
              <h2 id="ticket-detail-title" className="text-lg font-bold text-slate-900 sm:text-xl">
                {ticket.aiAssessment.title}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {locationLabel(ticket)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  Reported by {ticket.reporterName} on {formatDateTime(ticket.createdAt)}
                </span>
                <span className="text-slate-400">{ticket.id}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close ticket details"
              className="shrink-0 rounded-control p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Section tabs */}
          <div
            role="tablist"
            aria-label="Ticket sections"
            onKeyDown={onTabKeyDown}
            className="mt-4 flex items-center gap-1 overflow-x-auto rounded-card bg-slate-100 p-1"
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
                className={`whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-semibold transition-colors ${
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
          className="max-h-[60vh] space-y-4 overflow-y-auto p-5 sm:p-6"
        >
          {ticket.isSafetyCritical && (
            <div className="flex items-start gap-2 rounded-card border border-critical-200 bg-critical-50 p-3 text-sm text-critical-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical-600" aria-hidden="true" />
              <div>
                <span className="font-semibold">This ticket is safety-critical. </span>
                It involves high-voltage, fire, or structural risk. Only a certified administrator can
                confirm it is fixed — a photo alone cannot prove functional safety.
              </div>
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-slate-800">Progress</h3>
                <ProgressTracker ticket={ticket} className="mt-3" />
              </Card>

              <Card>
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <FileText className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-slate-800">Reported issue</h3>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-sm leading-relaxed text-slate-700">{ticket.description}</p>
                  <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                    <Fact label="Department">
                      <span className="text-sm font-semibold text-slate-800">{ticket.department}</span>
                    </Fact>
                    <Fact label="Reported">
                      <span className="text-sm font-semibold text-slate-800">
                        {formatDateTime(ticket.createdAt)}
                      </span>
                    </Fact>
                    <Fact label="Handled by">
                      <span className="text-sm font-semibold text-slate-800">{handlerName(ticket)}</span>
                    </Fact>
                    <Fact label="Estimated fix">
                      <span className="text-sm font-semibold text-slate-800">
                        {estimateFixTime(ticket)}
                      </span>
                    </Fact>
                  </div>
                </div>
              </Card>

              {ticket.workNotes && (
                <div className="rounded-card border border-warning-200 bg-warning-50/60 p-4">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warning-800">
                    Technician field notes ({ticket.assignedTechnician || 'Staff'})
                  </span>
                  <p className="text-sm leading-relaxed text-slate-800">{ticket.workNotes}</p>
                </div>
              )}

              {/* Staff/admin-only internal assessment labels. */}
              {!isStudent && (
                <Card className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Internal assessment
                    </span>
                    <PriorityBadge priority={ticket.aiAssessment.priority} />
                    <ModeBadge provider={ticket.issueAnalysisMetadata?.provider} />
                  </div>
                </Card>
              )}

              {!isStudent && latestVerif && (
                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">Latest repair check</h3>
                    <ModeBadge provider={latestVerif.metadata.provider} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OutcomeBadge outcome={latestVerif.assessment.visualOutcome} />
                    <span className="rounded-full border border-line bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      Evidence: {latestVerif.assessment.evidenceQuality}
                    </span>
                    {latestVerif.requiresHumanReview && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-critical-200 bg-critical-100 px-2.5 py-1 text-xs font-semibold text-critical-700">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Human review required
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Recommended action:{' '}
                    <strong className="text-slate-800">
                      {formatAction(latestVerif.assessment.recommendedAction)}
                    </strong>
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* PHOTOS */}
          {activeTab === 'evidence' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Layers className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  Before &amp; after photos
                </span>
                {ticket.afterPhotoUrl && (
                  <div className="flex items-center gap-1 rounded-control bg-slate-100 p-1 text-xs">
                    {(['both', 'before', 'after'] as PhotoView[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPhotoViewMode(mode)}
                        aria-pressed={photoViewMode === mode}
                        className={`rounded px-2 py-1 ${
                          photoViewMode === mode
                            ? 'bg-surface font-semibold text-slate-900 shadow-2xs'
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
                    label="Before"
                    tone="rose"
                    src={ticket.beforePhotoUrl}
                    subtitle={`Reported ${formatDateTime(ticket.createdAt)}`}
                    onOpen={() => openLightbox(ticket.beforePhotoUrl)}
                  />
                )}
                {ticket.afterPhotoUrl && (photoViewMode === 'both' || photoViewMode === 'after') && (
                  <EvidenceImage
                    label="After"
                    tone="emerald"
                    src={ticket.afterPhotoUrl}
                    subtitle={`Fixed ${formatDateTime(latestVerif?.createdAt ?? ticket.updatedAt)}`}
                    onOpen={() => openLightbox(ticket.afterPhotoUrl)}
                  />
                )}
              </div>

              <p className="flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Photos help compare before and after. They are a visual record, not on their own proof
                that the repair is safe.
              </p>

              {/* Evidence integrity signals are staff/admin-only. */}
              {!isStudent && latestVerif && (latestVerif.riskSignals?.length || latestVerif.challengeState) && (
                <Card className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Evidence integrity signals</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {latestVerif.riskLevel && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          latestVerif.riskLevel === 'high'
                            ? 'border-critical-200 bg-critical-100 text-critical-700'
                            : latestVerif.riskLevel === 'medium'
                            ? 'border-warning-200 bg-warning-100 text-warning-800'
                            : 'border-success-200 bg-success-100 text-success-700'
                        }`}
                      >
                        Risk: {latestVerif.riskLevel}
                      </span>
                    )}
                    {latestVerif.challengeState && (
                      <span className="rounded-full border border-line bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        Live challenge: {latestVerif.challengeState.status}
                      </span>
                    )}
                  </div>
                  {latestVerif.riskSignals && latestVerif.riskSignals.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-600">
                      {latestVerif.riskSignals.map((s, i) => (
                        <li key={`${s.code}-${i}`}>
                          <span className="font-semibold text-slate-700">{s.code}</span>: {s.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* REPAIR DETAILS (staff/admin only) */}
          {!isStudent && activeTab === 'ai' && (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Sparkles className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    Issue assessment
                  </span>
                  <div className="flex items-center gap-2">
                    <TicketIdChip id={ticket.id} />
                    <ModeBadge provider={ticket.issueAnalysisMetadata?.provider} />
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={ticket.aiAssessment.priority} />
                    <span className="rounded-full border border-line bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      Suggested department: {ticket.aiAssessment.recommendedDepartment}
                    </span>
                    {ticket.aiAssessment.needsHumanReview && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-critical-200 bg-critical-100 px-2.5 py-1 text-xs font-semibold text-critical-700">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Human review flagged
                      </span>
                    )}
                  </div>

                  <div>
                    <SubHeading>Visible observations</SubHeading>
                    <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                      {ticket.aiAssessment.observations.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>

                  {ticket.aiAssessment.reviewReasons.length > 0 && (
                    <div>
                      <SubHeading>Why review is recommended</SubHeading>
                      <ul className="list-inside list-disc space-y-1 text-sm text-critical-700">
                        {ticket.aiAssessment.reviewReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="border-t border-line pt-2 text-xs text-slate-500">
                    These are automated suggestions based on the description and photo, not verified
                    facts. The original description is kept unchanged.
                  </p>
                </div>
              </Card>

              {latestVerif ? (
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Sparkles className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Repair check (attempt #{latestVerif.attemptNumber})
                    </span>
                    <ModeBadge provider={latestVerif.metadata.provider} />
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OutcomeBadge outcome={latestVerif.assessment.visualOutcome} />
                      <span className="rounded-full border border-line bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        Evidence quality: {latestVerif.assessment.evidenceQuality}
                      </span>
                      {latestVerif.requiresHumanReview && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-critical-200 bg-critical-100 px-2.5 py-1 text-xs font-semibold text-critical-700">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          Human review required
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-control border border-line bg-surface-muted p-3">
                        <SubHeading>Visible changes</SubHeading>
                        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                          {latestVerif.assessment.visibleChanges.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-control border border-line bg-surface-muted p-3">
                        <SubHeading>Remaining concerns</SubHeading>
                        {latestVerif.assessment.remainingConcerns.length > 0 ? (
                          <ul className="list-inside list-disc space-y-1 text-sm text-critical-700">
                            {latestVerif.assessment.remainingConcerns.map((rc, i) => (
                              <li key={i}>{rc}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm font-medium text-success-700">
                            No remaining problems seen in the after photo.
                          </p>
                        )}
                      </div>
                    </div>

                    {latestVerif.assessment.artifactSignals &&
                      latestVerif.assessment.artifactSignals.length > 0 && (
                        <div>
                          <SubHeading>Photo integrity checks</SubHeading>
                          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                            {latestVerif.assessment.artifactSignals.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    <p className="border-t border-line pt-2 text-sm text-slate-600">
                      Recommended action:{' '}
                      <strong className="text-slate-800">
                        {formatAction(latestVerif.assessment.recommendedAction)}
                      </strong>
                    </p>
                  </div>
                </Card>
              ) : (
                <EmptyNote text="No repair verification has been recorded for this ticket yet." />
              )}
            </div>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <Card>
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <History className="h-4 w-4 text-brand-700" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-800">History</h3>
              </div>
              <ol className="space-y-4 p-4">
                {ticket.auditTrail.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-slate-900">{event.action}</span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium text-slate-500">{event.actor}</span>
                        <time className="ml-auto text-slate-400" dateTime={event.timestamp}>
                          {formatDateTime(event.timestamp)}
                        </time>
                      </div>
                      {event.notes && <p className="mt-0.5 text-slate-600">{event.notes}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        {/* Footer actions with policy gates */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5 pt-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {isReportedOrAssigned && (currentRole === 'technician' || currentRole === 'admin') && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onStartWork(ticket.id);
                  onClose();
                }}
              >
                <Wrench className="h-4 w-4" aria-hidden="true" />
                Accept &amp; start work
              </Button>
            )}

            {isInProgress && (currentRole === 'technician' || currentRole === 'admin') && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenRepairModal(ticket);
                }}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Upload after-photo
              </Button>
            )}

            {isAwaitingVerification && (
              <>
                {canStudentConfirm || canAdminConfirm ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      onClose();
                      onConfirmResolution(ticket);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Confirm resolution
                  </Button>
                ) : isStudent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-control border border-critical-200 bg-critical-50 px-3 py-2 text-sm font-semibold text-critical-700">
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    An administrator must confirm this repair
                  </span>
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onClose();
                    onReopenTicket(ticket);
                  }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reopen ticket
                </Button>
              </>
            )}
          </div>

          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-size evidence preview"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            aria-label="Close image preview"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 rounded-control bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Full-size evidence"
            className="max-h-[90vh] max-w-full rounded-card object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    {children}
  </div>
);

const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
    {children}
  </span>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-card border border-dashed border-line bg-surface-muted p-6 text-center text-sm text-slate-500">
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
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
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
  <div className="relative h-56 overflow-hidden rounded-card border border-line bg-slate-100 sm:h-64">
    {src ? (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${label} at full size`}
        className="block h-full w-full cursor-zoom-in"
      >
        <img src={src} alt={label} className="h-full w-full object-cover" />
      </button>
    ) : (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
        No image available
      </div>
    )}
    <span
      className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold uppercase text-white ${
        tone === 'rose' ? 'bg-critical-600/90' : 'bg-success-600/90'
      }`}
    >
      {label}
    </span>
    <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 px-2.5 py-1 text-xs text-white">
      {subtitle}
    </span>
  </div>
);
