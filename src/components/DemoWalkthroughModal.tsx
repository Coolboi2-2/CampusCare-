import React, { useState } from 'react';
import {
  X,
  PlayCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Wrench,
  GraduationCap,
  RotateCcw,
  Shield,
  Loader2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { Ticket, UserRole } from '../types';

interface DemoWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToTicket: (ticketId: string, role: UserRole) => void;
  onRefreshData: () => void;
}

const DEMO_STEPS = [
  {
    step: 1,
    time: '0–15s',
    title: 'Report Naturally',
    role: 'student' as UserRole,
    headline: 'Student uploads washbasin leak photo & describes problem',
    desc: 'Student does not need to diagnose the technical fault. They describe: "Water is leaking under the sink washbasin in Oak Hall Room 308" and attach a photo.',
    actionLabel: 'View Student Report Intake',
  },
  {
    step: 2,
    time: '15–30s',
    title: 'Validate Schema',
    role: 'admin' as UserRole,
    headline: 'Gemini 3.8 Flash extracts defect, observations, priority & validates Zod contract',
    desc: 'Strict Zod schema contract validates output. Department recommended: Plumbing. Priority: Medium. Safety checks evaluated before queue placement.',
    actionLabel: 'Inspect Schema Output & Triage',
  },
  {
    step: 3,
    time: '30–45s',
    title: 'Assign & Accept',
    role: 'technician' as UserRole,
    headline: 'Technician Marcus Vance accepts the work order in the Plumbing queue',
    desc: 'Maintenance staff receives work order in their department queue and transitions status to "In Progress" with verifiable audit trail timestamps.',
    actionLabel: 'Open Technician Work Queue',
  },
  {
    step: 4,
    time: '45–65s',
    title: 'Repair & Evidence',
    role: 'technician' as UserRole,
    headline: 'Technician completes repair & uploads after-photo',
    desc: 'Technician replaces worn gasket, tightens compression joints, pressure tests for 5 minutes, and uploads after-photo evidence.',
    actionLabel: 'Upload After-Photo & Submit',
  },
  {
    step: 5,
    time: '65–80s',
    title: 'Verify with AI',
    role: 'student' as UserRole,
    headline: 'Gemini compares Before & After photos and evaluates evidence quality',
    desc: 'AI evaluates visual outcome (Improved), evidence quality (Clear), checks for residual defects, and generates an immutable RepairAssessmentRecord.',
    actionLabel: 'Review Before & After Comparison',
  },
  {
    step: 6,
    time: '80–90s',
    title: 'Resolve or Reopen',
    role: 'student' as UserRole,
    headline: 'Evidence-based sign-off: Student confirms resolution or reopens',
    desc: 'Authorized people confirm completion. If problem persists, student reopens ticket while preserving all previous repair attempts and photographic evidence.',
    actionLabel: 'Test Resolution & Reopen Flow',
  },
];

export const DemoWalkthroughModal: React.FC<DemoWalkthroughModalProps> = ({
  isOpen,
  onClose,
  onJumpToTicket,
  onRefreshData,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const currentStep = DEMO_STEPS[currentStepIdx];

  const handleExecuteStep = async (stepNumber: number) => {
    setIsSimulating(true);
    try {
      const ticketId = 'CC-2026-1042';

      if (stepNumber === 3 || stepNumber === 4 || stepNumber === 5) {
        // Ensure the ticket is in progress; the state machine requires it before work completes.
        await fetch(`/api/tickets/${ticketId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'in_progress',
            actor: 'Marcus Vance (Lead Plumber)',
            role: 'technician',
            notes: 'Technician arrived on-site and staged P-trap replacement fittings.',
          }),
        });
      }

      if (stepNumber === 4 || stepNumber === 5) {
        // Complete repair & run AI verification
        await fetch(`/api/tickets/${ticketId}/repair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technicianName: 'Marcus Vance (Lead Plumber)',
            workNotes: 'Replaced rubber gasket, aligned compression joint, and pressure tested for 5 minutes. Cabinet base dried completely.',
            afterPhotoUrl: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80',
            role: 'technician',
          }),
        });
      }

      onRefreshData();
      onJumpToTicket(ticketId, currentStep.role);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleAdversarialTest = async (type: 'duplicate' | 'safety') => {
    setIsSimulating(true);
    try {
      if (type === 'duplicate') {
        // Trigger duplicate photo test on CC-2026-1042 (ensure in progress first).
        await fetch(`/api/tickets/CC-2026-1042/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'in_progress',
            actor: 'Marcus Vance',
            role: 'technician',
            notes: 'Preparing duplicate-evidence adversarial test.',
          }),
        });
        await fetch(`/api/tickets/CC-2026-1042/repair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technicianName: 'Marcus Vance',
            workNotes: 'Submitted duplicate image asset to test adversarial safety gate.',
            afterPhotoUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
            role: 'technician',
          }),
        });
        onRefreshData();
        onJumpToTicket('CC-2026-1042', 'admin');
      } else {
        // Jump to safety critical ticket CC-2026-1039
        onJumpToTicket('CC-2026-1039', 'student');
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  90-Second Walkthrough: AI Reliability v1
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  Engineering Milestone
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Gemini recommends • Validated application logic decides • People confirm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Trackers */}
        <div className="mt-4 grid grid-cols-6 gap-1 bg-slate-100 p-1 rounded-2xl">
          {DEMO_STEPS.map((s, idx) => (
            <button
              key={s.step}
              onClick={() => setCurrentStepIdx(idx)}
              className={`py-2 px-1 rounded-xl text-center transition-all ${
                currentStepIdx === idx
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="text-[10px] uppercase font-mono">{s.time}</div>
              <div className="text-xs truncate font-bold">Step {s.step}</div>
            </button>
          ))}
        </div>

        {/* Active Step Content Card */}
        <div className="mt-4 p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2.5 py-1 rounded-lg">
              Stage {currentStep.step} of 6 • {currentStep.time}
            </span>
            <span className="text-xs font-semibold text-slate-500 capitalize flex items-center gap-1">
              {currentStep.role === 'student' ? (
                <GraduationCap className="w-4 h-4 text-blue-600" />
              ) : currentStep.role === 'technician' ? (
                <Wrench className="w-4 h-4 text-amber-600" />
              ) : (
                <Shield className="w-4 h-4 text-purple-600" />
              )}
              <span>{currentStep.role} view</span>
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {currentStep.headline}
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed">{currentStep.desc}</p>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => setCurrentStepIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentStepIdx === 0}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold disabled:opacity-30"
            >
              ← Previous Step
            </button>

            <button
              onClick={() => handleExecuteStep(currentStep.step)}
              disabled={isSimulating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{currentStep.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Adversarial Testing Shortcuts for Judges */}
        <div className="mt-4 p-3 bg-slate-900 text-slate-300 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-amber-400 font-bold uppercase text-[10px] tracking-wider">
              🧪 Live Adversarial Stress Tests:
            </span>
            <span className="text-[10px] text-slate-400">Verifies AI doesn't hallucinate resolution</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleAdversarialTest('duplicate')}
              disabled={isSimulating}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-left text-[11px] transition-colors"
            >
              <div className="font-bold text-amber-300">Test: Identical Photo Upload</div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Flags &ldquo;Unusable Evidence&rdquo; & triggers manual review.
              </p>
            </button>

            <button
              onClick={() => handleAdversarialTest('safety')}
              disabled={isSimulating}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-left text-[11px] transition-colors"
            >
              <div className="font-bold text-rose-300">Test: Safety Hazard Protection</div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Critical spark issue cannot be auto-closed by student.
              </p>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>CampusCare AI Reliability v1 • Zod validated output contracts</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
