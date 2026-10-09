import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  AlertCircle,
  Loader2,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Ticket } from '../types';
import { IssueAnalysis, AssessmentMetadata } from '../lib/ai/schemas';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { estimateFixTime } from '../lib/status';

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (newTicket: Ticket) => void;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=200&q=80';

const SAMPLE_PRESETS = [
  {
    name: 'Sink leak',
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
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');

  // Analysis preview state
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: IssueAnalysis;
    metadata: AssessmentMetadata;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [step, setStep] = useState(1);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

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
        console.error('Analysis preview failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [description, zone, building, room]);

  // Start each visit at the first step, with a clean success screen.
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCreatedTicket(null);
      setError(null);
    }
  }, [isOpen]);

  // Escape closes the dialog for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setDescription(preset.desc);
    setZone(preset.location.zone);
    setBuilding(preset.location.building);
    setFloor(preset.location.floor);
    setRoom(preset.location.room);
    setPhotoUrl(preset.photo);
  };

  const handleSelectLocation = (preset: typeof SAMPLE_PRESETS[0]) => {
    setZone(preset.location.zone);
    setBuilding(preset.location.building);
    setFloor(preset.location.floor);
    setRoom(preset.location.room);
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
      setCreatedTicket(newTicket);
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    if (step === 1 && !description.trim()) {
      setError('Please provide a description of the issue');
      return;
    }
    setError(null);
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const aiAssessment = analysisResult?.analysis;
  const descriptionMissing = !!error && !description.trim();
  const locationSummary = [zone, building, floor, room].filter(Boolean).join(' · ');

  const inputClass =
    'w-full text-sm p-2.5 bg-surface border border-line rounded-control text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400';

  const stepTitles = ['What’s wrong?', 'Where is it?', 'Confirm & send'];

  const recommendation = aiAssessment ? (
    <Card className="p-3 border-brand-200 bg-brand-50">
      <p className="text-sm font-semibold text-slate-900">
        Recommended department: {aiAssessment.recommendedDepartment}
      </p>
      <p className="text-xs text-slate-600 mt-0.5">
        Priority: {aiAssessment.priority} · We’ll route this to the right team.
      </p>
      {aiAssessment.needsHumanReview && (
        <p className="text-xs text-warning-800 mt-1">A staff member will review this report.</p>
      )}
    </Card>
  ) : null;

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
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Campus maintenance
            </span>
            <h2 id="report-modal-title" className="text-lg font-bold text-slate-900 mt-1">
              Report an issue
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Tell us what’s wrong and where, and we’ll send it to the right team.
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

        {createdTicket ? (
          /* Success state */
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-success-50 text-success-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-3">
              Got it! Ticket {createdTicket.id} sent to {createdTicket.department}.{' '}
              {estimateFixTime(createdTicket)}.
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              We’ll keep you posted as it’s assigned and repaired.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="primary" size="md" onClick={() => onTicketCreated(createdTicket)}>
                Track this issue
              </Button>
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Progress */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-2 rounded-full transition-all ${
                      n === step ? 'w-6 bg-brand-600' : n < step ? 'w-2 bg-brand-400' : 'w-2 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Step {step} of 3 · {stepTitles[step - 1]}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="p-3 bg-critical-50 border border-critical-200 text-critical-700 text-sm rounded-control flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1 — What's wrong? */}
              {step === 1 && (
                <section aria-labelledby="report-section-details" className="space-y-4">
                  <div>
                    <h3
                      id="report-section-details"
                      className="text-base font-bold text-slate-900 mb-2"
                    >
                      What’s wrong?
                    </h3>
                    <label
                      htmlFor="report-description"
                      className="block text-sm font-semibold text-slate-700 mb-1"
                    >
                      Describe the issue <span className="text-critical-500">*</span>
                    </label>
                    <textarea
                      id="report-description"
                      required
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      aria-invalid={descriptionMissing}
                      aria-describedby="report-description-help"
                      placeholder="e.g. Water is leaking under the sink washbasin whenever the tap runs…"
                      className={`${inputClass} ${descriptionMissing ? 'border-critical-300 ring-1 ring-critical-200' : ''}`}
                    />
                    <p
                      id="report-description-help"
                      className={`text-xs mt-1 ${descriptionMissing ? 'text-critical-600 font-medium' : 'text-slate-500'}`}
                    >
                      {descriptionMissing
                        ? 'A description is required before submitting.'
                        : 'Include what broke and any immediate risk.'}
                    </p>
                  </div>

                  {/* Recommendation preview */}
                  {isAnalyzing ? (
                    <p role="status" className="flex items-center gap-2 text-sm text-brand-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking your report…
                    </p>
                  ) : (
                    recommendation ?? (
                      <p className="text-xs text-slate-500">
                        Describe the issue and we’ll suggest the right team.
                      </p>
                    )
                  )}

                  {/* Photo */}
                  <div>
                    <span className="block text-sm font-semibold text-slate-700 mb-1">
                      Add a photo (optional)
                    </span>
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
                      <span className="text-sm font-semibold text-slate-600">
                        Drag &amp; drop an image, or click to browse
                      </span>
                      <span className="text-xs text-slate-400">PNG or JPG</span>
                      <input
                        id="report-photo-file"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                      />
                    </label>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Photos are only used to resolve this issue.
                    </p>

                    <label
                      htmlFor="report-photo-url"
                      className="block text-xs font-semibold text-slate-600 mt-3 mb-1"
                    >
                      Or paste an image link
                    </label>
                    <input
                      id="report-photo-url"
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://…"
                      className={inputClass}
                    />

                    {photoUrl && (
                      <div className="flex items-center gap-3 mt-3">
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-control bg-surface border border-line text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Common issues */}
                  <div className="p-3 bg-surface-muted border border-line rounded-card">
                    <span className="text-sm font-semibold text-slate-700 block mb-2">
                      Common issues
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className="text-sm py-2 px-3 rounded-control bg-surface hover:bg-brand-50 hover:text-brand-700 border border-line font-semibold text-slate-700 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Step 2 — Where is it? */}
              {step === 2 && (
                <section aria-labelledby="report-section-location" className="space-y-4">
                  <h3 id="report-section-location" className="text-base font-bold text-slate-900">
                    Where is it?
                  </h3>

                  <div className="p-3 bg-surface-muted border border-line rounded-card">
                    <span className="text-xs font-semibold text-slate-600 block mb-2">
                      Common locations
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectLocation(p)}
                          className="inline-flex items-center gap-1.5 text-xs py-2 px-3 rounded-control bg-surface hover:bg-brand-50 hover:text-brand-700 border border-line font-semibold text-slate-700 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          {p.location.building} · {p.location.room}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="report-zone" className="block text-sm font-medium text-slate-600 mb-1">
                        Campus zone
                      </label>
                      <select
                        id="report-zone"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        className={inputClass}
                      >
                        <option value="Hostel Village">Hostel Village</option>
                        <option value="Academic Complex">Academic Complex</option>
                        <option value="Central Library">Central Library</option>
                        <option value="Sports & Rec">Sports &amp; Rec</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="report-building" className="block text-sm font-medium text-slate-600 mb-1">
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
                      <label htmlFor="report-floor" className="block text-sm font-medium text-slate-600 mb-1">
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
                      <label htmlFor="report-room" className="block text-sm font-medium text-slate-600 mb-1">
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
              )}

              {/* Step 3 — Confirm & send */}
              {step === 3 && (
                <section aria-labelledby="report-section-review" className="space-y-4">
                  <h3 id="report-section-review" className="text-base font-bold text-slate-900">
                    Confirm &amp; send
                  </h3>

                  <Card className="p-4 bg-surface-muted space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-500">Issue</span>
                      <p className="text-sm text-slate-800">{description || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500">Location</span>
                      <p className="text-sm text-slate-800">{locationSummary || '—'}</p>
                    </div>
                    {photoUrl && (
                      <img
                        src={photoUrl}
                        alt="Selected issue photo preview"
                        className="w-16 h-16 rounded-control object-cover border border-line"
                        onError={(e) => {
                          if (e.currentTarget.src !== FALLBACK_PHOTO) e.currentTarget.src = FALLBACK_PHOTO;
                        }}
                      />
                    )}
                  </Card>

                  {recommendation}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="report-reporter-name" className="block text-sm font-medium text-slate-600 mb-1">
                        Your name
                      </label>
                      <input
                        id="report-reporter-name"
                        type="text"
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        placeholder="Your full name"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="report-reporter-email" className="block text-sm font-medium text-slate-600 mb-1">
                        Your email
                      </label>
                      <input
                        id="report-reporter-email"
                        type="email"
                        value={reporterEmail}
                        onChange={(e) => setReporterEmail(e.target.value)}
                        placeholder="you@campus.edu"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-line flex items-center justify-between gap-2">
                {step > 1 ? (
                  <Button type="button" variant="ghost" size="md" onClick={goBack} disabled={isSubmitting}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                )}

                {step < 3 ? (
                  <Button type="button" variant="primary" size="md" onClick={goNext}>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={isSubmitting}
                    disabled={isSubmitting || !description.trim()}
                  >
                    Send report
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
