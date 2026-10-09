import React from 'react';
import { Check } from 'lucide-react';
import { Ticket } from '../../types';
import { progressSteps, formatDateTime } from '../../lib/status';

/**
 * The 4-step journey for a ticket (Reported → Assigned → Fixed → Confirmed).
 * Vertical rail on mobile, horizontal tracker on larger screens.
 */
export const ProgressTracker: React.FC<{ ticket: Ticket; className?: string }> = ({
  ticket,
  className = '',
}) => {
  const steps = progressSteps(ticket);
  return (
    <ol className={`flex flex-col sm:grid sm:grid-cols-4 ${className}`}>
      {steps.map((step, i) => {
        const marker = step.done
          ? 'border-brand-600 bg-brand-600 text-white'
          : step.current
            ? 'border-brand-600 bg-surface text-brand-700'
            : 'border-line bg-surface text-slate-400';
        return (
          <li key={step.key} className="flex gap-3 sm:block">
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${marker}`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={`w-0.5 flex-1 sm:mx-2 sm:h-0.5 sm:w-full sm:flex-none ${
                    step.done ? 'bg-brand-600' : 'bg-line'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="pb-5 sm:pb-0 sm:pt-2 sm:pr-3">
              <p
                className={`text-sm font-semibold ${
                  step.current && !step.done ? 'text-brand-700' : 'text-slate-800'
                }`}
              >
                {step.label}
              </p>
              <p className="text-xs text-slate-500">
                {step.at ? formatDateTime(step.at) : 'Pending'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
