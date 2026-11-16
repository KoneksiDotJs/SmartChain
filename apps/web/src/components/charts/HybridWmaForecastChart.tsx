'use client';

import React, { useState } from 'react';
import { StatusPill } from '@/components/ui/StatusPill';
import type { ForecastMaterialDto } from '@/lib/types';

interface HybridWmaForecastChartProps {
  materials: ForecastMaterialDto[];
  surgeFactor: number;
}

export function HybridWmaForecastChart({ materials, surgeFactor }: HybridWmaForecastChartProps) {
  const [selectedSku, setSelectedSku] = useState(materials[0]?.sku ?? 'MAT-01');
  const [activeIdx, setActiveIdx] = useState(12); // default highlight: Forecast point

  const material = materials.find((m) => m.sku === selectedSku) ?? materials[0];
  if (!material) return null;

  const series = [
    ...material.historySeries.map((pt, idx) => ({
      label: pt.periodLabel,
      value: pt.observedQty === null ? null : Math.round(pt.observedQty * surgeFactor),
      isMissing: pt.isMissing,
      isForecast: false,
      weight: pt.isMissing ? 0 : idx + 1,
    })),
    {
      label: 'WMA Next',
      value: material.forecast.forecastNextPeriod,
      isMissing: false,
      isForecast: true,
      weight: 0,
    },
  ];

  const validValues = series.map((p) => p.value ?? 0);
  const maxVal = Math.max(100, ...validValues);
  const minVal = 0;

  const padLeft = 48;
  const padRight = 32;
  const padTop = 20;
  const padBottom = 38;
  const width = Math.max(760, padLeft + padRight + (series.length - 1) * 64);
  const height = 228;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const stepX = innerW / (series.length - 1);

  const coords = series.map((pt, idx) => {
    const x = padLeft + idx * stepX;
    const y =
      pt.value === null
        ? null
        : padTop + innerH - ((pt.value - minVal) / (maxVal - minVal)) * innerH;
    return { ...pt, x, y, idx };
  });

  // Connect consecutive valid historical points with solid polyline; connect last valid to WMA forecast with dashed line
  const validHistorical = coords.filter((c) => !c.isForecast && c.y !== null);
  const historicalPath = validHistorical
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
    .join(' ');
  const lastHist = validHistorical[validHistorical.length - 1];
  const forecastCoord = coords[coords.length - 1]!;
  const focused = coords[Math.min(activeIdx, coords.length - 1)]!;

  return (
    <div className="sc-paper-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
            Tren Permintaan 3 Bulan &amp; Proyeksi Hybrid WMA
          </h3>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Arahkan kursor atau klik titik minggu untuk melihat bobot WMA dan interval data yang
            hilang.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="wma-sku-select" className="sr-only">
            Pilih material untuk grafik WMA
          </label>
          <select
            id="wma-sku-select"
            className="sc-select"
            value={material.sku}
            onChange={(e) => setSelectedSku(e.target.value)}
          >
            {materials.map((m) => (
              <option key={m.sku} value={m.sku}>
                {m.sku} — {m.name}
              </option>
            ))}
          </select>
          <StatusPill variant="warn">Kelengkapan {material.forecast.completenessPercent}%</StatusPill>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Grafik permintaan 12 minggu dan proyeksi WMA untuk ${material.name}`}
        >
          {[0, 0.5, 1].map((tick) => {
            const y = padTop + innerH - tick * innerH;
            const val = Math.round(maxVal * tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--ink-muted)"
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Highlight missing intervals vertically */}
          {coords
            .filter((c) => c.isMissing)
            .map((c) => (
              <g key={`gap-${c.label}`}>
                <line
                  x1={c.x}
                  y1={padTop}
                  x2={c.x}
                  y2={padTop + innerH}
                  stroke="var(--warn)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={c.x}
                  cy={padTop + innerH - 8}
                  r="4.5"
                  fill="var(--warn-soft)"
                  stroke="var(--warn)"
                  strokeWidth="1.5"
                />
              </g>
            ))}

          {historicalPath && (
            <path d={historicalPath} fill="none" stroke="var(--ink)" strokeWidth="2.4" />
          )}

          {lastHist && lastHist.y !== null && forecastCoord.y !== null && (
            <line
              x1={lastHist.x}
              y1={lastHist.y}
              x2={forecastCoord.x}
              y2={forecastCoord.y}
              stroke="var(--accent)"
              strokeWidth="2.4"
              strokeDasharray="5 4"
            />
          )}

          {coords.map((c) => {
            const isSelected = c.idx === focused.idx;
            const dotY = c.y ?? padTop + innerH - 8;
            return (
              <g
                key={c.label}
                role="button"
                tabIndex={0}
                aria-label={`${c.label}: ${c.value === null ? 'data kosong' : `${c.value} unit`}`}
                style={{ cursor: 'pointer', outline: 'none' }}
                onMouseEnter={() => setActiveIdx(c.idx)}
                onFocus={() => setActiveIdx(c.idx)}
                onClick={() => setActiveIdx(c.idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIdx(c.idx);
                  }
                }}
              >
                <rect
                  x={c.x - stepX / 2}
                  y={padTop}
                  width={stepX}
                  height={innerH + 16}
                  fill="transparent"
                />

                {c.y !== null && (
                  <circle
                    cx={c.x}
                    cy={dotY}
                    r={isSelected ? 6.5 : 4.5}
                    fill={c.isForecast ? 'var(--accent)' : 'var(--ink)'}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                )}

                <text
                  x={c.x}
                  y={height - 10}
                  textAnchor="middle"
                  fill={isSelected ? 'var(--ink)' : 'var(--ink-muted)'}
                  fontWeight={isSelected ? '700' : '500'}
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {c.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          backgroundColor: 'var(--surface-warm)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 13,
        }}
      >
        <div>
          <strong className="sc-mono">{focused.label}</strong>:{' '}
          {focused.isMissing ? (
            <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
              Data historis kosong (dilewati oleh renormalisasi bobot WMA)
            </span>
          ) : focused.isForecast ? (
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Proyeksi periode berikutnya via Hybrid WMA ({surgeFactor}x permintaan)
            </span>
          ) : (
            <span>
              Permintaan aktual tercatat (bobot resensi <span className="sc-mono">w={focused.weight}</span>)
            </span>
          )}
        </div>
        <div className="sc-mono">
          Nilai: <strong>{focused.value === null ? 'NULL (Kosong)' : `${focused.value} unit`}</strong>
        </div>
      </div>
    </div>
  );
}
