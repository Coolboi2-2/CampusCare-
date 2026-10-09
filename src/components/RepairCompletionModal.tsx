import React, { useEffect, useState } from 'react';
import {
  X,
  Camera,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Step 4: Repair &amp; Verification Evidence
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Complete Work Order &amp; Verify</h2>
            <p className="text-xs text-slate-500">
              Submit repair notes and photographic evidence. AI will compare before and after photos.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close repair form"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Before Photo & Problem Reference */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
          <img
            src={ticket.beforePhotoUrl}
            alt="Before repair"
            className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
          />
          <div className="text-xs">
            <span className="font-mono text-blue-700 font-bold">{ticket.id}</span>
            <p className="font-semibold text-slate-800">{ticket.aiAssessment.title}</p>
            <p className="text-slate-500 line-clamp-1">{ticket.description}</p>
          </div>
        </div>

        {/* Server-issued challenge */}
        {role === 'technician' || role === 'admin' ? (
          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                  Repair challenge code
                </h3>
                {challenge ? (
                  <>
                    <p
                      className="mt-1 text-3xl font-black tracking-[0.3em] text-indigo-800 font-mono"
                      aria-live="polite"
                    >
                      {challenge.code}
                    </p>
                    <p className="mt-1 text-[11px] text-indigo-900 leading-relaxed">
                      Write this code clearly on paper or card and place it beside the repaired item.
                      It must be visible in the after-photo. The code is single-use and expires{' '}
                      {new Date(challenge.expiresAt).toLocaleTimeString()}.
                    </p>
                  </>
                ) : challengeError ? (
                  <p className="mt-1 text-[11px] text-amber-800">
                    {challengeError}. You can still submit, but it will be routed for human review.
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-indigo-700 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Issuing challenge…
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
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
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* In-app capture with an upload fallback */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">After-Repair Photo</span>
              <span className="text-[10px] text-indigo-600 font-medium">
                {capturedDataUrl ? 'Captured in-app' : 'Camera or upload'}
              </span>
            </div>

            {capturedDataUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={capturedDataUrl}
                  alt="After repair preview"
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setCapturedDataUrl(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retake / remove
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer transition-colors">
                {captureBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
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
                className="flex-1 text-xs p-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Next AI Step:</span> Upon submission, CampusCare AI analyzes
              both before &amp; after photos to detect visible changes, check the challenge code, and
              report evidence quality and any remaining concerns before notifying the student.
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !workNotes.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Submit &amp; Run AI Verification</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
