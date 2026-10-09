import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Camera,
  Send,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Ticket, LocationDetail } from '../types';
import { IssueAnalysis, AssessmentMetadata } from '../lib/ai/schemas';
import { ModeBadge, PriorityBadge } from './ui/Badges';

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (newTicket: Ticket) => void;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=200&q=80';

const SAMPLE_PRESETS = [
  {
    name: 'Sink Leak (Iconic 90s Demo)',
    desc: 'Water is leaking heavily under the sink washbasin whenever the tap is used. Base of cabinet is soaking wet.',
    location: {
      zone: 'Hostel Village',
      building: 'Block B - Oak Hall',
      floor: '3rd Floor',
      room: 'Room 308 (Washroom)',
    },
    photo: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Sparking Light (Safety Critical)',
    desc: 'Overhead light fixture in hallway is flickering violently with sparks and burning plastic odor.',
    location: {
      zone: 'Academic Complex',
      building: 'Engineering Hall',
      floor: '2nd Floor',
      room: 'Lecture Hall 201',
    },
    photo: 'https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Broken Study Chair (Carpentry)',
    desc: 'Study carrel chair armrest has splintered wood with exposed metal fastener screws.',
    location: {
      zone: 'Central Library',
      building: 'Main Library Tower',
      floor: '4th Floor',
      room: 'Silent Study Pod #14',
    },
    photo: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=800&q=80',
  },
];

export const StudentReportModal: React.FC<StudentReportModalProps> = ({
  isOpen,
  onClose,
  onTicketCreated,
}) => {
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('Hostel Village');
  const [building, setBuilding] = useState('Block B - Oak Hall');
  const [floor, setFloor] = useState('3rd Floor');
  const [room, setRoom] = useState('Room 308');
  const [photoUrl, setPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80'
  );
  const [reporterName, setReporterName] = useState('Aarav Patel');
  const [reporterEmail, setReporterEmail] = useState('aarav.patel@campus.edu');

  // AI Analysis State
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: IssueAnalysis;
    metadata: AssessmentMetadata;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!description.trim() || description.length < 10) {
      setAnalysisResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/tickets/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            location: { zone, building, floor, room },
            photoUrl,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalysisResult(data);
        }
      } catch (err) {
        console.error('AI preview failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [description, zone, building, room]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setDescription(preset.desc);
    setZone(preset.location.zone);
    setBuilding(preset.location.building);
    setFloor(preset.location.floor);
    setRoom(preset.location.room);
    setPhotoUrl(preset.photo);
  };

  const handlePhotoFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhotoUrl(reader.result);
    };
    // shortcut: client-side data URL, fine for demo photos; move to upload storage for large real files
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description of the issue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterName,
          reporterEmail,
          description,
          location: { zone, building, floor, room },
          beforePhotoUrl: photoUrl,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to submit report');
      }

      const newTicket: Ticket = await res.json();
      onTicketCreated(newTicket);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const aiAssessment = analysisResult?.analysis;
  const aiMeta = analysisResult?.metadata;
  const descriptionMissing = !!error && !description.trim();

  const inputClass =
    'w-full text-xs p-2.5 bg-surface-muted border border-line rounded-control text-slate-900 focus:bg-surface focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="bg-surface rounded-card border border-line shadow-card max-w-2xl w-full my-8 max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b border-line">
          <div>
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Structured Issue Intake
            </span>
            <h2 id="report-modal-title" className="text-lg font-bold text-slate-900 mt-1.5">
              Report Campus Maintenance Incident
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Validated application logic inspects defects, detects safety risks, and routes tickets.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report form"
            className="p-1.5 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Quick Demo Presets */}
          <div className="mb-4 p-3 bg-surface-muted border border-line rounded-card">
            <span className="text-[11px] font-bold text-slate-600 block mb-2">
              Quick test presets (1-click fill)
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="text-xs py-1.5 px-2.5 rounded-control bg-surface hover:bg-brand-50 hover:text-brand-700 border border-line font-semibold text-slate-700 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Report Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="p-3 bg-critical-50 border border-critical-200 text-critical-700 text-xs rounded-control flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1 — Describe the issue */}
            <section aria-labelledby="report-section-details">
              <h3
                id="report-section-details"
                className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2"
              >
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  1
                </span>
                Describe the issue
              </h3>

              <label
                htmlFor="report-description"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Natural language description <span className="text-critical-500">*</span>
              </label>
              <textarea
                id="report-description"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={descriptionMissing}
                aria-describedby="report-description-help"
                placeholder="e.g. Water is leaking under the sink washbasin whenever the tap runs..."
                className={`${inputClass} ${descriptionMissing ? 'border-critical-300 ring-1 ring-critical-200' : ''}`}
              />
              <p
                id="report-description-help"
                className={`text-[11px] mt-1 ${descriptionMissing ? 'text-critical-600 font-medium' : 'text-slate-500'}`}
              >
                {descriptionMissing
                  ? 'A description is required before submitting.'
                  : 'Include what broke, where it is, and any immediate risk.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <label htmlFor="report-zone" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Campus zone
                  </label>
                  <select id="report-zone" value={zone} onChange={(e) => setZone(e.target.value)} className={inputClass}>
                    <option value="Hostel Village">Hostel Village</option>
                    <option value="Academic Complex">Academic Complex</option>
                    <option value="Central Library">Central Library</option>
                    <option value="Sports & Rec">Sports &amp; Rec</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="report-building" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Building
                  </label>
                  <input
                    id="report-building"
                    type="text"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="report-floor" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Floor
                  </label>
                  <input
                    id="report-floor"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="report-room" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Room
                  </label>
                  <input
                    id="report-room"
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* Step 2 — Photo evidence */}
            <section aria-labelledby="report-section-photo" className="border-t border-line pt-4">
              <h3
                id="report-section-photo"
                className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2"
              >
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  2
                </span>
                Photo evidence
              </h3>

              <label htmlFor="report-photo-url" className="block text-xs font-semibold text-slate-700 mb-1">
                Photo URL (optional)
              </label>
              <input
                id="report-photo-url"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                <label
                  htmlFor="report-photo-file"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handlePhotoFile(e.dataTransfer.files?.[0]);
                  }}
                  className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-line rounded-control bg-surface-muted p-4 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                >
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-600">
                    Drag &amp; drop an image, or click to browse
                  </span>
                  <span className="text-[10px] text-slate-400">PNG or JPG</span>
                  <input
                    id="report-photo-file"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                  />
                </label>

                {photoUrl && (
                  <div className="flex items-center gap-3">
                    <img
                      src={photoUrl}
                      alt="Selected issue photo preview"
                      className="w-16 h-16 rounded-control object-cover border border-line shrink-0"
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      aria-label="Remove selected photo"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-control bg-surface border border-line text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Step 3 — AI recommendations */}
            <section
              aria-labelledby="report-section-ai"
              className="border-t border-line pt-4"
            >
              <h3
                id="report-section-ai"
                className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2"
              >
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  3
                </span>
                AI recommendations
              </h3>

              <div className="p-4 rounded-card bg-accent-50/50 border border-accent-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
                    <Sparkles className="w-4 h-4 text-accent-600" />
                    Advisory only — a human routes the ticket
                  </span>

                  {aiMeta && <ModeBadge provider={aiMeta.provider} />}

                  {isAnalyzing && (
                    <span role="status" className="flex items-center gap-1 text-[11px] text-brand-600">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Validating schema...
                    </span>
                  )}
                </div>

                {aiMeta?.provider !== 'gemma' && aiMeta && (
                  <p className="flex items-start gap-1.5 text-[11px] text-warning-800 bg-warning-50 border border-warning-200 rounded-control px-2.5 py-1.5 mb-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Fallback rules produced this recommendation. No live model output was used.
                    </span>
                  </p>
                )}

                {aiAssessment ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{aiAssessment.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-100 text-brand-800 border border-brand-200">
                        Dept: {aiAssessment.recommendedDepartment}
                      </span>
                      <PriorityBadge priority={aiAssessment.priority} />
                      {aiAssessment.needsHumanReview && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-critical-100 text-critical-700 border border-critical-200">
                          <ShieldAlert className="w-3 h-3" />
                          Human review
                        </span>
                      )}
                    </div>

                    <div className="bg-surface/90 p-2.5 rounded-control border border-accent-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Observed indicators
                      </span>
                      <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                        {aiAssessment.observations.map((obs, i) => (
                          <li key={i}>{obs}</li>
                        ))}
                      </ul>
                    </div>

                    {aiAssessment.reviewReasons.length > 0 && (
                      <div className="bg-critical-50 p-2.5 rounded-control border border-critical-200 text-critical-800 text-[11px] flex items-start gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-critical-600 mt-0.5" />
                        <div>
                          <span className="font-bold">Human review flagged: </span>
                          {aiAssessment.reviewReasons.join('; ')}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-brand-800">
                    Describe the problem above. The system recommends a department and priority with
                    schema verification.
                  </p>
                )}
              </div>
            </section>

            {/* Step 4 — Review & submit */}
            <section aria-labelledby="report-section-review" className="border-t border-line pt-4">
              <h3
                id="report-section-review"
                className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2"
              >
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  4
                </span>
                Review &amp; submit
              </h3>
              <p className="text-[11px] text-slate-500">
                Your original description and the returned ticket ID are sent exactly as entered.
              </p>

              <div className="pt-3 mt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-control transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-card transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Submit &amp; Generate Work Order</span>
                </button>
              </div>
            </section>
          </form>
        </div>
      </div>
    </div>
  );
};
