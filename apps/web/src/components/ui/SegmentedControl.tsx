'use client';

import React from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="sc-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`sc-seg-btn ${value === opt.value ? 'active' : ''}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
