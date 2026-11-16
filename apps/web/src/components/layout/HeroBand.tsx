'use client';

import React from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { getHeroCopyForUser } from '@/lib/rbac';

export function HeroBand() {
  const { session, stressMode, setStressMode } = useSmartChainMode();
  if (!session) return null;

  const copy = getHeroCopyForUser(session.user);
  const hideSimToggle = session.user.role === 'PARTNER' || session.user.role === 'SYSTEM_ADMIN';

  return (
    <section className="sc-hero-band">
      <div className="sc-container sc-hero-grid">
        <div>
          <h1 className="sc-h1">{copy.title}</h1>
          <p style={{ color: 'var(--ink-muted)', margin: 0, maxWidth: '60ch', fontSize: 15 }}>
            {copy.subtitle}
          </p>
        </div>

        {!hideSimToggle && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Kondisi Operasi</span>
            <SegmentedControl
              ariaLabel="Pilih kondisi operasi"
              value={stressMode ? 'stress' : 'normal'}
              onChange={(next) => setStressMode(next === 'stress')}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'stress', label: 'Simulasi 6 Gangguan' },
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
