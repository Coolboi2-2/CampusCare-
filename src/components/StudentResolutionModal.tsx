import React, { useState } from 'react';
import { X, CheckCircle2, RotateCcw, Star, AlertCircle, Loader2 } from 'lucide-react';
import { Ticket, UserRole } from '../types';
import { ModeBadge } from './ui/Badges';

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
  const [comment, setComment] = useState('Pipe joint is completely dry and leak is resolved. Thank you!');
  const [reopenReason, setReopenReason] = useState(
    'The water continues to drip slightly when the cold water tap is opened at high pressure.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint = mode === 'confirm' ? `/api/tickets/${ticket.id}/resolve` : `/api/tickets/${ticket.id}/reopen`;
      const payload =
        mode === 'confirm'
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

  const isConfirm = mode === 'confirm';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolution-modal-title"
        className="bg-surface rounded-card border border-line shadow-card max-w-lg w-full my-8 max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-control flex items-center justify-center shrink-0 ${
                isConfirm ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {isConfirm ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 id="resolution-modal-title" className="text-base font-bold text-slate-900">
                {isConfirm ? 'Confirm Issue Resolution' : 'Reopen Maintenance Ticket'}
              </h2>
              <span className="text-[11px] font-mono text-slate-500">{ticket.id}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Repair Evidence Preview */}
          {ticket.afterPhotoUrl && (
            <div className="mb-4 p-3 bg-surface-muted rounded-card border border-line flex items-center gap-3">
              <img
                src={ticket.afterPhotoUrl}
                alt="Technician repair evidence"
                loading="lazy"
                className="w-14 h-14 rounded-control object-cover border border-line shrink-0"
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                }}
              />
              <div className="text-xs space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Technician Evidence
                </span>
                <p className="text-slate-800 font-medium line-clamp-1">{ticket.workNotes}</p>
                {ticket.latestVerification && (
                  <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-accent-700 font-semibold">
                    <span>
                      Assessment: {ticket.latestVerification.assessment.visualOutcome}
                      {' '}({ticket.latestVerification.assessment.evidenceQuality} evidence)
                    </span>
                    <ModeBadge provider={ticket.latestVerification.metadata.provider} />
                  </span>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-control flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isConfirm ? (
              <>
                <div>
                  <span
                    id="resolution-rating-label"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Rate Repair Quality &amp; Promptness
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
                        className="p-1 rounded-control hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200 fill-slate-100'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-600 ml-2" aria-hidden="true">
                      {rating}/5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="resolution-comment"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Resolution Comments
                  </label>
                  <textarea
                    id="resolution-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Thank the maintenance crew or leave remarks..."
                    className="w-full text-xs p-3 bg-surface-muted border border-line rounded-control text-slate-900 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                  />
                </div>
              </>
            ) : (
              <div>
                <label
                  htmlFor="resolution-reopen-reason"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Reason for Reopening <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="resolution-reopen-reason"
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why the physical problem remains unresolved..."
                  className="w-full text-xs p-3 bg-surface-muted border border-line rounded-control text-slate-900 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The ticket will be returned to the {ticket.department} department queue with high
                  priority.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-control text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                  isConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isConfirm ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{isConfirm ? 'Confirm & Close Ticket' : 'Reopen Ticket'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
