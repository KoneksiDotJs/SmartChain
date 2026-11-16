'use client';

import React from 'react';

interface ToastRegionProps {
  message: string | null;
}

export function ToastRegion({ message }: ToastRegionProps) {
  if (!message) return null;
  return (
    <div className="sc-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
