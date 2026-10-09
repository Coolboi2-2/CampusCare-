import React, { useState } from 'react';
import {
  X,
  PlayCircle,
  ArrowLeft,
  ArrowRight,
  Wrench,
  GraduationCap,
  Shield,
  ShieldAlert,
  FlaskConical,
} from 'lucide-react';
import { UserRole } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface DemoWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToTicket: (ticketId: string, role: UserRole) => void;
  onRefreshData: () => void;
}

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Report an issue',
    role: 'student' as UserRole,
    headline: 'A student describes the problem and adds a photo',
    desc: 'No need to diagnose the fault. A student describes: "Water is leaking under the sink washbasin in Oak Hall Room 308" and attaches a photo.',
    actionLabel: 'View student report',
  },
  {
    step: 2,
    title: 'Route it',
    role: 'admin' as UserRole,
    headline: 'CampusCare suggests the right department',
    desc: 'The report is matched to Plumbing at Medium priority, then placed in the maintenance queue for the team to pick up.',
    actionLabel: 'See how it is routed',
  },
  {
    step: 3,
    title: 'Assign it',
    role: 'technician' as UserRole,
    headline: 'A technician accepts the work order',
    desc: 'The maintenance team sees the job in their Plumbing queue and marks it In progress, with a timestamp for the record.',
    actionLabel: 'Open maintenance queue',
  },
  {
    step: 4,
    title: 'Fix it',
    role: 'technician' as UserRole,
    headline: 'The repair is completed and photographed',
    desc: 'The technician replaces the worn gasket, tightens the joints, pressure tests for five minutes, and uploads an after-photo.',
    actionLabel: 'View repair flow',
  },
  {
    step: 5,
    title: 'Check it',
    role: 'student' as UserRole,
    headline: 'Before and after photos are compared',
    desc: 'The photos are checked for a clear improvement before the student is asked to confirm the fix.',
    actionLabel: 'See before & after',
  },
  {
    step: 6,
    title: 'Confirm it',
    role: 'student' as UserRole,
    headline: 'The student confirms the fix or reopens',
    desc: 'If the problem is gone, the ticket is closed. If not, it is reopened with the repair history and photos kept.',
    actionLabel: 'See confirm & reopen',
  },
];

const ROLE_ICON: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  student: GraduationCap,
  technician: Wrench,
  admin: Shield,
};

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
  const StepIcon = ROLE_ICON[currentStep.role];

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
        // Complete repair & run verification
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
            notes: 'Preparing duplicate-evidence test.',
          }),
        });
        await fetch(`/api/tickets/CC-2026-1042/repair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technicianName: 'Marcus Vance',
            workNotes: 'Submitted duplicate image asset to test the safety check.',
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-tour-title"
        className="bg-surface rounded-card max-w-2xl w-full p-6 sm:p-7 shadow-card border border-line relative my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-card bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="demo-tour-title" className="text-base font-bold text-slate-900">
                How CampusCare works
              </h2>
              <p className="text-sm text-slate-500">
                Report it. Route it. Fix it. Confirm it.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close product tour"
            className="p-1.5 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step trackers */}
        <div className="mt-4 grid grid-cols-6 gap-1 bg-surface-muted p-1 rounded-card">
          {DEMO_STEPS.map((s, idx) => (
            <button
              key={s.step}
              onClick={() => setCurrentStepIdx(idx)}
              aria-label={`Step ${s.step}: ${s.title}`}
              aria-current={currentStepIdx === idx ? 'step' : undefined}
              className={`py-2 px-1 rounded-control text-center transition-colors ${
                currentStepIdx === idx
                  ? 'bg-surface text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="text-xs font-semibold">Step {s.step}</div>
              <div className="text-xs truncate text-slate-500">{s.title}</div>
            </button>
          ))}
        </div>

        {/* Active step */}
        <Card className="mt-4 p-5 bg-surface-muted space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-control">
              Step {currentStep.step} of 6
            </span>
            <span className="text-xs font-semibold text-slate-500 capitalize flex items-center gap-1">
              <StepIcon className="w-4 h-4 text-brand-700" />
              <span>{currentStep.role} view</span>
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 leading-snug">{currentStep.headline}</h3>

          <p className="text-sm text-slate-600 leading-relaxed">{currentStep.desc}</p>

          <div className="pt-2 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setCurrentStepIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentStepIdx === 0}
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>

            <Button
              variant="primary"
              size="md"
              loading={isSimulating}
              onClick={() => handleExecuteStep(currentStep.step)}
            >
              <span>{currentStep.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Edge cases */}
        <div className="mt-4 p-4 bg-warning-50/60 rounded-card border border-warning-200 space-y-2">
          <span className="flex items-center gap-1.5 text-warning-800 font-bold text-xs">
            <FlaskConical className="w-3.5 h-3.5" />
            Edge cases
          </span>
          <p className="text-xs text-slate-600">
            These make sure a repair cannot be closed with weak or unsafe evidence.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleAdversarialTest('duplicate')}
              disabled={isSimulating}
              className="p-2.5 rounded-control bg-surface hover:bg-slate-50 text-left text-xs border border-line transition-colors disabled:opacity-50"
            >
              <div className="font-bold text-warning-800">What if the same photo is uploaded twice?</div>
              <p className="text-xs text-slate-500 mt-0.5">The repair is flagged for manual review.</p>
            </button>

            <button
              onClick={() => handleAdversarialTest('safety')}
              disabled={isSimulating}
              className="p-2.5 rounded-control bg-surface hover:bg-slate-50 text-left text-xs border border-line transition-colors disabled:opacity-50"
            >
              <div className="font-bold text-critical-700 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                What if the issue is a safety hazard?
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                A sparking light cannot be closed by a student alone.
              </p>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="hidden sm:inline">CampusCare · Campus maintenance service</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
