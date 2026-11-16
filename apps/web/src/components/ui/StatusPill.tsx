import React from 'react';

export type PillVariant = 'neutral' | 'ok' | 'warn' | 'alert';

interface StatusPillProps {
  variant?: PillVariant;
  children: React.ReactNode;
}

export function StatusPill({ variant = 'neutral', children }: StatusPillProps) {
  const variantClass = variant === 'neutral' ? '' : variant;
  return <span className={`sc-pill ${variantClass}`}>{children}</span>;
}
