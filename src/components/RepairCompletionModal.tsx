import React, { useState } from 'react';
import {
  X,
  Camera,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';

interface RepairCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  role: UserRole;
  onRepairCompleted: (updatedTicket: Ticket) => void;
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

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workNotes.trim()) {
      setError('Please provide notes describing the repair work completed.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workNotes,
          afterPhotoUrl,
          technicianName,
          role,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
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
              Step 4: Repair & Verification Evidence
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Complete Work Order & Verify</h2>
            <p className="text-xs text-slate-500">
              Submit repair notes and photographic evidence. AI will compare before and after photos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Before Photo & Problem Reference */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
          <img
            src={ticket.beforePhotoUrl}
            alt="Before"
            className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
          />
          <div className="text-xs">
            <span className="font-mono text-blue-700 font-bold">{ticket.id}</span>
            <p className="font-semibold text-slate-800">{ticket.aiAssessment.title}</p>
            <p className="text-slate-500 line-clamp-1">{ticket.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Technician Name & Crew
            </label>
            <input
              type="text"
              required
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work Completed & Diagnostics Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={workNotes}
              onChange={(e) => setWorkNotes(e.target.value)}
              placeholder="Describe what components were replaced, testing performed, and safety precautions..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>After-Repair Photo URL (Visual Evidence)</span>
              <span className="text-[10px] text-indigo-600 font-medium">Used for Gemini 3.8 Flash visual comparison</span>
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="url"
                required
                value={afterPhotoUrl}
                onChange={(e) => setAfterPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              {afterPhotoUrl && (
                <img
                  src={afterPhotoUrl}
                  alt="After Preview"
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}
            </div>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Next AI Step:</span> Upon submission, CampusCare AI analyzes
              both before &amp; after photos to detect visible changes (e.g. pipe joint seated, dry surface)
              and reports evidence quality and any remaining concerns before notifying the student.
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
              <span>Submit & Run AI Verification</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
