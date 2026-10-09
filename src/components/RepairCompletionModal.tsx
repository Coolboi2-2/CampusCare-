import React, { useEffect, useState } from 'react';
import { X, Camera, AlertCircle, Loader2, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Ticket, UserRole } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TicketIdChip } from './ui/Badges';

interface RepairCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  role: UserRole;
  onRepairCompleted: (updatedTicket: Ticket) => void;
}

interface IssuedChallenge {
  id: string;
  code: string;
  expiresAt: string;
}

const MAX_CAPTURE_DIMENSION = 1600;

/**
 * Reads a selected/captured file, downscales it and re-encodes as JPEG.
 * This keeps uploads inside the server's 8MB limit and drops client-side EXIF
 * (which the server would not trust anyway).
 */
async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Selected file is not a readable image'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export const RepairCompletionModal: React.FC<RepairCompletionModalProps> = ({
  isOpen,
  onClose,
  ticket,
  role,
  onRepairCompleted,
}) => {
  const [workNotes, setWorkNotes] = useState(
    'Replaced worn rubber slip-joint gasket on the P-trap drainage pipe. Hand-tightened compression collar and ran full-flow water test for 5 minutes without any leaks. Floor dried clean.'
  );
  const [afterPhotoUrl, setAfterPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80'
  );
  const [technicianName, setTechnicianName] = useState('Devon Miller (Lead Plumber)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [challenge, setChallenge] = useState<IssuedChallenge | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);

  // Issue a one-time, server-generated challenge when a technician opens the flow.
  useEffect(() => {
    if (!isOpen || !ticket) return;
    setChallenge(null);
    setChallengeError(null);
    setCapturedDataUrl(null);
    if (role !== 'technician' && role !== 'admin') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.id}/repair/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-actor-role': role },
          body: JSON.stringify({ role }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not issue a challenge code');
        if (!cancelled) setChallenge({ id: data.challengeId, code: data.code, expiresAt: data.expiresAt });
      } catch (err: any) {
        if (!cancelled) setChallengeError(err.message || 'Challenge unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ticket?.id, role]);

  // Escape closes the dialog for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticket) return null;

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCaptureBusy(true);
    setError(null);
    try {
      setCapturedDataUrl(await fileToDownscaledDataUrl(file));
    } catch (err: any) {
      setError(err.message || 'Could not process the captured photo');
    } finally {
      setCaptureBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workNotes.trim()) {
      setError('Please provide notes describing the repair work completed.');
      return;
    }
    if (!capturedDataUrl && !afterPhotoUrl.trim()) {
      setError('Capture or provide an after-repair photo showing the completed work.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { workNotes, technicianName, role };
      if (challenge) body.challengeId = challenge.id;
      if (capturedDataUrl) body.afterPhotoBase64 = capturedDataUrl;
      else body.afterPhotoUrl = afterPhotoUrl;

      const res = await fetch(`/api/tickets/${ticket.id}/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to submit repair completion');
      }

      const updated = await res.json();
      onRepairCompleted(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-modal-title"
        aria-describedby="repair-modal-desc"
        className="relative my-2 max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain sm:my-8"
      >
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-6">
            <div className="min-w-0">
              <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                Final step
              </span>
              <h2 id="repair-modal-title" className="mt-2 text-lg font-bold text-slate-900">
                Complete work order
              </h2>
              <p id="repair-modal-desc" className="mt-1 text-sm leading-relaxed text-slate-500">
                Add your repair notes and an after-photo so the student can confirm the fix.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close repair form"
              className="shrink-0 rounded-control p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {/* Step 1 — review the issue */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">1. Review the issue</h3>
              <Card className="flex items-start gap-3 bg-surface-muted p-3">
                <div className="shrink-0">
                  <img
                    src={ticket.beforePhotoUrl}
                    alt={`Before repair evidence for ${ticket.id}`}
                    className="h-16 w-16 rounded-control border border-line object-cover"
                  />
                  <span className="mt-1 block text-center text-xs font-semibold text-slate-500">
                    Before
                  </span>
                </div>
                <div className="min-w-0 space-y-1 text-sm">
                  <TicketIdChip id={ticket.id} />
                  <p className="font-semibold text-slate-800 line-clamp-2">
                    {ticket.aiAssessment.title}
                  </p>
                  <p className="text-slate-500 line-clamp-2">{ticket.description}</p>
                </div>
              </Card>
            </section>

            {/* Step 2 — repair challenge (staff only) */}
            {(role === 'technician' || role === 'admin') && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-800">2. Repair challenge</h3>
                <Card className="border-brand-200 bg-brand-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                    <div className="flex-1">
                      {challenge ? (
                        <>
                          <p className="text-xs font-semibold text-brand-900">Your challenge code</p>
                          <p
                            className="mt-1 text-3xl font-bold tracking-[0.2em] text-brand-800"
                            aria-live="polite"
                          >
                            {challenge.code}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-brand-900">
                            Write this code clearly on paper or card and place it beside the repaired
                            item. It must be visible in the after-photo. The code is single-use and
                            expires {new Date(challenge.expiresAt).toLocaleTimeString()}.
                          </p>
                        </>
                      ) : challengeError ? (
                        <p className="text-xs text-warning-700" role="status">
                          {challengeError}. You can still submit, but it will be routed for human
                          review.
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-brand-700" role="status">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Issuing
                          challenge…
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </section>
            )}

            {/* Step 3 — repair details and after-photo */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">3. Record the repair</h3>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-control border border-critical-200 bg-critical-50 p-3 text-sm text-critical-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="repair-technician"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Technician name &amp; crew
                </label>
                <input
                  id="repair-technician"
                  type="text"
                  required
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full rounded-control border border-line bg-surface-muted p-2.5 text-sm text-slate-900 focus:border-brand-400 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label
                  htmlFor="repair-notes"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Work completed <span className="text-critical-500">*</span>
                </label>
                <textarea
                  id="repair-notes"
                  required
                  rows={3}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="Describe what you replaced, what you tested, and any safety precautions…"
                  className="w-full rounded-control border border-line bg-surface-muted p-3 text-sm text-slate-900 focus:border-brand-400 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* After-photo upload */}
              <div className="space-y-2 rounded-card border border-line bg-surface-muted p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700">After-repair photo</span>
                  <span className="text-xs font-medium text-slate-500">
                    {capturedDataUrl ? 'Captured in-app' : 'Camera or upload'}
                  </span>
                </div>

                {capturedDataUrl ? (
                  <div className="flex items-center gap-3">
                    <div>
                      <img
                        src={capturedDataUrl}
                        alt="After repair preview"
                        className="h-16 w-16 rounded-control border border-line object-cover"
                      />
                      <span className="mt-1 block text-center text-xs font-semibold text-slate-500">
                        After
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCapturedDataUrl(null)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retake / remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-control border-2 border-dashed border-line p-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-surface">
                    {captureBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>
                      {captureBusy ? 'Processing photo…' : 'Capture with camera or upload an image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={handleCapture}
                    />
                  </label>
                )}

                <div className="flex items-center gap-2">
                  <label htmlFor="repair-after-url" className="shrink-0 text-xs text-slate-500">
                    or image URL
                  </label>
                  <input
                    id="repair-after-url"
                    type="url"
                    disabled={Boolean(capturedDataUrl)}
                    value={afterPhotoUrl}
                    onChange={(e) => setAfterPhotoUrl(e.target.value)}
                    placeholder="https://…"
                    className="min-w-0 flex-1 rounded-control border border-line bg-surface p-2.5 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                  />
                </div>

                <p className="text-xs text-slate-500">Photos are only used to resolve this issue.</p>
              </div>

              <div className="flex items-start gap-2 rounded-card border border-info-200 bg-info-50 p-3 text-xs text-info-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="leading-relaxed">
                  When you submit, the after-photo is reviewed against the original report before the
                  student is asked to confirm the fix.
                </p>
              </div>

              <p className="sr-only" role="status" aria-live="polite">
                {isSubmitting ? 'Submitting repair for review…' : ''}
              </p>

              <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
                <Button type="button" variant="secondary" size="md" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isSubmitting}
                  disabled={!workNotes.trim()}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? 'Submitting…' : 'Submit repair'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};
