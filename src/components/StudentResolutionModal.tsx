import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, RotateCcw, Star, AlertCircle } from 'lucide-react';
import { Ticket, UserRole } from '../types';
import { Button } from './ui/Button';
import { TicketIdChip } from './ui/Badges';

interface StudentResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  mode: 'confirm' | 'reopen';
  role: UserRole;
  onUpdated: (ticket: Ticket) => void;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=200&q=80';

export const StudentResolutionModal: React.FC<StudentResolutionModalProps> = ({
  isOpen,
  onClose,
  ticket,
  mode,
  role,
  onUpdated,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'confirm' | 'reopen'>(mode);

  // Follow the mode the caller opened with, while letting the student switch locally.
  useEffect(() => {
    if (isOpen) setActiveMode(mode);
  }, [isOpen, mode]);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint =
        activeMode === 'confirm'
          ? `/api/tickets/${ticket.id}/resolve`
          : `/api/tickets/${ticket.id}/reopen`;
      const payload =
        activeMode === 'confirm'
          ? { confirmedBy: ticket.reporterName, rating, comment, role }
          : { reason: reopenReason, reopenedBy: ticket.reporterName, role };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Action failed');
      }

      const updated = await res.json();
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirm = activeMode === 'confirm';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resolve issue"
        aria-labelledby="resolution-modal-title"
        className="my-8 max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto rounded-card border border-line bg-surface shadow-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line p-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${
                isConfirm ? 'bg-success-50 text-success-600' : 'bg-critical-50 text-critical-600'
              }`}
            >
              {isConfirm ? <CheckCircle2 className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2 id="resolution-modal-title" className="text-base font-bold text-slate-900">
                {isConfirm ? "Confirm it's fixed" : "Tell us it's not fixed yet"}
              </h2>
              <TicketIdChip id={ticket.id} />
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="p-5">
          {/* Before / after evidence */}
          <div className="grid grid-cols-2 gap-3">
            <figure className="space-y-1.5">
              <img
                src={ticket.beforePhotoUrl}
                alt="Before the repair"
                loading="lazy"
                className="h-28 w-full rounded-control border border-line object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                }}
              />
              <figcaption className="text-xs font-medium text-slate-500">Before</figcaption>
            </figure>
            <figure className="space-y-1.5">
              {ticket.afterPhotoUrl ? (
                <img
                  src={ticket.afterPhotoUrl}
                  alt="After the repair"
                  loading="lazy"
                  className="h-28 w-full rounded-control border border-line object-cover"
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                  }}
                />
              ) : (
                <div className="flex h-28 w-full items-center justify-center rounded-control border border-dashed border-line bg-surface-muted text-xs text-slate-500">
                  No photo yet
                </div>
              )}
              <figcaption className="text-xs font-medium text-slate-500">After</figcaption>
            </figure>
          </div>

          {ticket.workNotes && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-700">What was done: </span>
              {ticket.workNotes}
            </p>
          )}

          {/* Two choices */}
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={isConfirm ? 'primary' : 'secondary'}
              onClick={() => setActiveMode('confirm')}
              aria-pressed={isConfirm}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Yes, it's fixed
            </Button>
            <Button
              type="button"
              variant={!isConfirm ? 'danger' : 'secondary'}
              onClick={() => setActiveMode('reopen')}
              aria-pressed={!isConfirm}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Not fixed yet
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-control border border-critical-200 bg-critical-50 p-3 text-sm text-critical-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {isConfirm ? (
              <>
                <div>
                  <span
                    id="resolution-rating-label"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    How was the repair?
                  </span>
                  <div
                    role="group"
                    aria-labelledby="resolution-rating-label"
                    className="flex items-center gap-1"
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        aria-label={`${star} out of 5 stars`}
                        aria-pressed={rating === star}
                        className="rounded-control p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            star <= rating
                              ? 'fill-warning-400 text-warning-400'
                              : 'fill-slate-100 text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-600" aria-hidden="true">
                      {rating}/5
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="resolution-comment"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    Anything to add? (optional)
                  </label>
                  <textarea
                    id="resolution-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Thank the maintenance crew or leave a note..."
                    className="w-full rounded-control border border-line bg-surface-muted p-3 text-sm text-slate-900 focus:border-brand-400 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </>
            ) : (
              <div>
                <label
                  htmlFor="resolution-reopen-reason"
                  className="mb-1 block text-sm font-semibold text-slate-700"
                >
                  What still needs fixing? <span className="text-critical-500">*</span>
                </label>
                <textarea
                  id="resolution-reopen-reason"
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Tell us what's still wrong so the crew can take another look."
                  className="w-full rounded-control border border-line bg-surface-muted p-3 text-sm text-slate-900 focus:border-brand-400 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
                <p className="mt-1 text-sm text-slate-500">
                  This goes back to the {ticket.department} team with priority.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant={isConfirm ? 'primary' : 'danger'} loading={isSubmitting}>
                {isConfirm ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                {isConfirm ? "Yes, it's fixed" : 'Not fixed yet'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
