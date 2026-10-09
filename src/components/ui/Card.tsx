import React from 'react';

/** White surface card with the shared radius, border and soft shadow. */
export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div className={`rounded-card border border-line bg-surface shadow-card ${className}`}>
    {children}
  </div>
);
