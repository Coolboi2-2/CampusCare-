import React, { useEffect, useState } from 'react';
import {
  X,
  Camera,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';
import { PriorityBadge, TicketIdChip } from './ui/Badges';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-modal-title"
        aria-describedby="repair-modal-desc"
        className="relative w-full max-w-2xl my-2 sm:my-8 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-surface rounded-card border border-line shadow-card"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-line flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Step 4: Repair &amp; Verification Evidence
            </span>
            <h2 id="repair-modal-title" className="text-lg font-bold text-slate-900 mt-2">
              Complete Work Order &amp; Verify
            </h2>
            <p id="repair-modal-desc" className="mt-1 text-xs text-slate-500 leading-relaxed">
              Submit repair notes and photographic evidence. AI will compare before and after photos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close repair form"
            className="p-1.5 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Before Photo & Problem Reference */}
          <div className="p-3 bg-surface-muted rounded-card border border-line flex items-start gap-3">
            <img
              src={ticket.beforePhotoUrl}
              alt={`Before repair evidence for ${ticket.id}`}
              className="w-16 h-16 rounded-control object-cover border border-line shrink-0"
            />
            <div className="text-xs space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TicketIdChip id={ticket.id} />
                <PriorityBadge priority={ticket.aiAssessment.priority} />
              </div>
              <p className="font-semibold text-slate-800 line-clamp-2">{ticket.aiAssessment.title}</p>
              <p className="text-slate-500 line-clamp-2">{ticket.description}</p>
            </div>
          </div>

          {/* Server-issued challenge */}
          {role === 'technician' || role === 'admin' ? (
            <div className="p-4 bg-brand-50 border border-brand-200 rounded-card">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wide">
                    Repair challenge code
                  </h3>
                  {challenge ? (
                    <>
                      <p
                        className="mt-1 text-3xl font-black tracking-[0.3em] text-brand-800 font-mono"
                        aria-live="polite"
                      >
                        {challenge.code}
                      </p>
                      <p className="mt-1 text-[11px] text-brand-900 leading-relaxed">
                        Write this code clearly on paper or card and place it beside the repaired item.
                        It must be visible in the after-photo. The code is single-use and expires{' '}
                        {new Date(challenge.expiresAt).toLocaleTimeString()}.
                      </p>
                    </>
                  ) : challengeError ? (
                    <p className="mt-1 text-[11px] text-amber-800" role="status">
                      {challengeError}. You can still submit, but it will be routed for human review.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-brand-700 flex items-center gap-1.5" role="status">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Issuing challenge…
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-control flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="repair-technician" className="block text-xs font-semibold text-slate-700 mb-1">
                Technician Name &amp; Crew
              </label>
              <input
                id="repair-technician"
                type="text"
                required
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="w-full text-xs p-2.5 bg-surface-muted border border-line rounded-control text-slate-900 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              />
            </div>

            <div>
              <label htmlFor="repair-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Work Completed &amp; Diagnostics Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="repair-notes"
                required
                rows={3}
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                placeholder="Describe what components were replaced, testing performed, and safety precautions..."
                className="w-full text-xs p-3 bg-surface-muted border border-line rounded-control text-slate-900 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              />
            </div>

            {/* In-app capture with an upload fallback */}
            <div className="p-3 bg-surface-muted border border-line rounded-card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">After-Repair Photo</span>
                <span className="text-[10px] text-brand-600 font-medium">
                  {capturedDataUrl ? 'Captured in-app' : 'Camera or upload'}
                </span>
              </div>

              {capturedDataUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={capturedDataUrl}
                    alt="After repair preview"
                    className="w-16 h-16 rounded-control object-cover border border-line"
                  />
                  <button
                    type="button"
                    onClick={() => setCapturedDataUrl(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-surface border border-line hover:bg-slate-50 rounded-control transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Retake / remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-line rounded-control text-xs font-semibold text-slate-600 hover:bg-surface cursor-pointer transition-colors">
                  {captureBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{captureBusy ? 'Processing photo…' : 'Capture with camera or upload an image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handleCapture}
                  />
                </label>
              )}

              <div className="flex gap-2 items-center">
                <label htmlFor="repair-after-url" className="text-[10px] text-slate-500 shrink-0">
                  or image URL
                </label>
                <input
                  id="repair-after-url"
                  type="url"
                  disabled={Boolean(capturedDataUrl)}
                  value={afterPhotoUrl}
                  onChange={(e) => setAfterPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 min-w-0 text-xs p-2.5 bg-surface border border-line rounded-control text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="p-3 bg-accent-50 border border-accent-200 rounded-card text-xs text-accent-700 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold">Next AI Step:</span> Upon submission, CampusCare AI analyzes
                both before &amp; after photos to detect visible changes, check the challenge code, and
                report evidence quality and any remaining concerns before notifying the student.
              </div>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {isSubmitting ? 'Submitting repair for verification…' : ''}
            </p>

            <div className="pt-2 border-t border-line flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-surface border border-line hover:bg-slate-50 rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !workNotes.trim()}
                aria-busy={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{isSubmitting ? 'Submitting…' : 'Submit & Run AI Verification'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
