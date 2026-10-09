import React from 'react';

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Initials avatar. Keeps identity recognition without profile photos. */
export const Avatar: React.FC<{ name: string; className?: string }> = ({
  name,
  className = '',
}) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 ${className || 'h-9 w-9'}`}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
);
