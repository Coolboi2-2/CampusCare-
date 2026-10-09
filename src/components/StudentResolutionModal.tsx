import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  Star,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';

interface StudentResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  mode: 'confirm' | 'reopen';
  role: UserRole;
  onUpdated: (ticket: Ticket) => void;
}

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                mode === 'confirm' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {mode === 'confirm' ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'confirm' ? 'Confirm Issue Resolution' : 'Reopen Maintenance Ticket'}
              </h2>
              <span className="text-[11px] font-mono text-slate-500">{ticket.id}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Repair Evidence Preview */}
        {ticket.afterPhotoUrl && (
          <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
            <img
              src={ticket.afterPhotoUrl}
              alt="Repair Evidence"
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="text-xs space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Technician Evidence
              </span>
              <p className="text-slate-800 font-medium line-clamp-1">{ticket.workNotes}</p>
              {ticket.latestVerification && (
                <span className="text-[10px] text-purple-700 font-semibold block">
                  AI Assessment: {ticket.latestVerification.assessment.visualOutcome.toUpperCase()} ({ticket.latestVerification.assessment.evidenceQuality} evidence)
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'confirm' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rate Repair Quality & Promptness
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
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
                  <span className="text-xs font-bold text-slate-600 ml-2">{rating}/5 Stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Comments
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Thank the maintenance crew or leave remarks..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Reopening <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Explain why the physical problem remains unresolved..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The ticket will be returned to the {ticket.department} department queue with high priority.
              </p>
            </div>
          )}

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
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 ${
                mode === 'confirm'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : mode === 'confirm' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>{mode === 'confirm' ? 'Confirm & Close Ticket' : 'Reopen Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
