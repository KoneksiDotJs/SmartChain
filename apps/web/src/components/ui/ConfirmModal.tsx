'use client';

import React, { useEffect } from 'react';
import { ShieldCheckIcon } from './Icons';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'accent';
  detailNote?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'primary',
  detailNote,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        backgroundColor: 'rgba(20, 20, 19, 0.42)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="sc-tactile-sheet"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tone === 'accent' ? 'var(--accent-soft)' : 'var(--bg-subtle)',
              color: tone === 'accent' ? 'var(--accent)' : 'var(--ink)',
              border: `1px solid ${tone === 'accent' ? 'var(--accent-border)' : 'var(--border)'}`,
              flexShrink: 0,
            }}
          >
            <ShieldCheckIcon size={17} />
          </span>
          <h3
            id="confirm-modal-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>

        <p style={{ margin: '0 0 12px 0', color: 'var(--ink-muted)', fontSize: 14.5 }}>
          {description}
        </p>

        {detailNote && (
          <div
            className="sc-mono"
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              backgroundColor: 'var(--surface-warm)',
              border: '1px solid var(--border)',
              fontSize: 12.5,
              color: 'var(--ink)',
              marginBottom: 16,
            }}
          >
            {detailNote}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button type="button" className="sc-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'accent' ? 'sc-btn-accent' : 'sc-btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
