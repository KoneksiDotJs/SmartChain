'use client';

import React from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

export function HeroBand() {
  const { stressMode, setStressMode } = useSmartChainMode();

  return (
    <section className="sc-hero-band">
      <div className="sc-container sc-hero-grid">
        <div>
          <h1 className="sc-h1">Kendali Rantai Pasok Terpadu PT Nusantara Manufacturing</h1>
          <p style={{ color: 'var(--ink-muted)', margin: 0, maxWidth: '58ch', fontSize: 15 }}>
            Platform operasional modular untuk menyatukan 3 pabrik, 15 pemasok utama, 8 gudang, dan
            25 distributor dalam satu alur kerja yang tahan gangguan.
          </p>
        </div>

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
      </div>
    </section>
  );
}
