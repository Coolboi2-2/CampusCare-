import React from 'react';

/** Friendly, composed empty state. Always says what to do next. */
export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = '' }) => (
  <div
    className={`flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center ${className}`}
  >
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    {description && (
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
