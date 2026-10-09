import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Camera,
  MapPin,
  Send,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { Ticket, LocationDetail } from '../types';
import { IssueAnalysis, AssessmentMetadata } from '../lib/ai/schemas';

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (newTicket: Ticket) => void;
}

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Phase A: Structured Issue Intake
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Report Campus Maintenance Incident</h2>
            <p className="text-xs text-slate-500">
              Validated application logic inspects defects, detects safety risks, and routes tickets.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Presets */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">
            ⚡ Quick Test Presets (1-Click Fill):
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className="text-xs py-1.5 px-2.5 rounded-xl bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 font-semibold text-slate-700 transition-colors shadow-2xs"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Report Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Natural Language Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Water is leaking under the sink washbasin whenever the tap runs..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Campus Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
              >
                <option value="Hostel Village">Hostel Village</option>
                <option value="Academic Complex">Academic Complex</option>
                <option value="Central Library">Central Library</option>
                <option value="Sports & Rec">Sports & Rec</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Building</label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Floor</label>
              <input
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Room</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Photo Evidence (URL)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}
            </div>
          </div>

          {/* AI Intake Preview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-200/90 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI Intake Assessment</span>
              </div>

              {aiMeta && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    aiMeta.provider === 'gemma'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {aiMeta.provider === 'gemma' ? 'Live Gemma 4' : 'Fallback Rules (AI Offline)'}
                </span>
              )}

              {isAnalyzing && (
                <div className="flex items-center gap-1 text-[11px] text-indigo-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating schema...</span>
                </div>
              )}
            </div>

            {aiAssessment ? (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{aiAssessment.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                    Dept: {aiAssessment.recommendedDepartment}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      aiAssessment.priority === 'Critical'
                        ? 'bg-rose-100 text-rose-800 font-extrabold'
                        : aiAssessment.priority === 'High'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Priority: {aiAssessment.priority}
                  </span>

                  {aiAssessment.needsHumanReview && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-600 text-white flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Safety Flag</span>
                    </span>
                  )}
                </div>

                <div className="bg-white/90 p-2.5 rounded-xl border border-indigo-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Observed Indicators:
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                    {aiAssessment.observations.map((obs, i) => (
                      <li key={i}>{obs}</li>
                    ))}
                  </ul>
                </div>

                {aiAssessment.reviewReasons.length > 0 && (
                  <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <span className="font-bold">Human Review Flagged: </span>
                      {aiAssessment.reviewReasons.join('; ')}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-indigo-700">
                Describe the problem above. The model will recommend department and priority with Zod schema verification.
              </p>
            )}
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
              disabled={isSubmitting || !description.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Submit & Generate Work Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
