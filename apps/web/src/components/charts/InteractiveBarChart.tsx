'use client';

import React, { useState } from 'react';

export type ChartTone = 'ink' | 'accent' | 'ok' | 'warn' | 'muted';

export interface BarDatum {
  id: string;
  label: string;
  sublabel?: string;
  primaryValue: number;
  secondaryValue?: number;
  thresholdValue?: number;
  tone?: ChartTone;
  secondaryTone?: ChartTone;
  note?: string;
}

interface InteractiveBarChartProps {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
  thresholdLabel?: string;
  unitSuffix?: string;
  formatValue?: (val: number) => string;
  data: BarDatum[];
}

function resolveToneVar(tone: ChartTone = 'ink'): string {
  switch (tone) {
    case 'accent':
      return 'var(--accent)';
    case 'ok':
      return 'var(--ok)';
    case 'warn':
      return 'var(--warn)';
    case 'muted':
      return 'var(--ink-muted)';
    default:
      return 'var(--ink)';
  }
}

export function InteractiveBarChart({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  thresholdLabel,
  unitSuffix = '',
  formatValue,
  data,
}: InteractiveBarChartProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (data.length === 0) return null;

  const activeIndex = Math.min(selectedIdx, data.length - 1);
  const activeItem = data[activeIndex]!;

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.primaryValue, d.secondaryValue ?? 0, d.thresholdValue ?? 0]),
  );

  const fmt = (val: number) =>
    formatValue ? formatValue(val) : `${val.toLocaleString('id-ID')}${unitSuffix ? ` ${unitSuffix}` : ''}`;

  const padLeft = 48;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 38;
  const longestLabel = Math.max(4, ...data.map((d) => d.label.length));
  const minSlotWidth = Math.max(66, longestLabel * 8 + 18);
  const chartWidth = Math.max(680, padLeft + padRight + data.length * minSlotWidth);
  const chartHeight = 220;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const slotWidth = innerWidth / data.length;

  return (
    <div className="sc-paper-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
            {title}
          </h3>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            {subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: 'var(--ink)',
                display: 'inline-block',
              }}
            />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: 'var(--ok)',
                  display: 'inline-block',
                }}
              />
              {secondaryLabel}
            </span>
          )}
          {thresholdLabel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 2,
                  borderTop: '2px dashed var(--accent)',
                  display: 'inline-block',
                }}
              />
              {thresholdLabel}
            </span>
          )}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{
            width: '100%',
            minWidth: Math.max(460, Math.min(chartWidth, data.length * 54)),
            height: 'auto',
            display: 'block',
          }}
          role="img"
          aria-label={title}
        >
          {[0, 0.5, 1].map((tick) => {
            const y = padTop + innerHeight - tick * innerHeight;
            const tickVal = Math.round(maxVal * tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--ink-muted)"
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                >
                  {tickVal >= 1_000_000
                    ? `${(tickVal / 1_000_000).toFixed(1)}M`
                    : tickVal >= 1000
                      ? `${(tickVal / 1000).toFixed(1)}k`
                      : tickVal}
                </text>
              </g>
            );
          })}

          {data.map((item, idx) => {
            const xCenter = padLeft + slotWidth * idx + slotWidth / 2;
            const hasSecondary = item.secondaryValue !== undefined;
            const barWidth = Math.min(26, Math.max(12, slotWidth * (hasSecondary ? 0.32 : 0.48)));
            const primaryHeight = (item.primaryValue / maxVal) * innerHeight;
            const primaryY = padTop + innerHeight - primaryHeight;
            const primaryX = hasSecondary ? xCenter - barWidth - 2 : xCenter - barWidth / 2;

            const secondaryHeight = hasSecondary
              ? ((item.secondaryValue ?? 0) / maxVal) * innerHeight
              : 0;
            const secondaryY = padTop + innerHeight - secondaryHeight;
            const secondaryX = xCenter + 2;

            const isSelected = idx === activeIndex;

            return (
              <g
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.sublabel ?? item.label}: ${fmt(item.primaryValue)}`}
                style={{ cursor: 'pointer', outline: 'none' }}
                onMouseEnter={() => setSelectedIdx(idx)}
                onFocus={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedIdx(idx);
                  }
                }}
              >
                {isSelected && (
                  <rect
                    x={padLeft + slotWidth * idx + 4}
                    y={padTop - 2}
                    width={Math.max(10, slotWidth - 8)}
                    height={innerHeight + 6}
                    rx="8"
                    fill="var(--surface-warm)"
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                )}

                <rect
                  x={primaryX}
                  y={primaryY}
                  width={barWidth}
                  height={Math.max(2, primaryHeight)}
                  rx="4"
                  fill={resolveToneVar(item.tone ?? 'ink')}
                />

                {hasSecondary && (
                  <rect
                    x={secondaryX}
                    y={secondaryY}
                    width={barWidth}
                    height={Math.max(2, secondaryHeight)}
                    rx="4"
                    fill={resolveToneVar(item.secondaryTone ?? 'ok')}
                  />
                )}

                {item.thresholdValue !== undefined && (
                  <line
                    x1={padLeft + slotWidth * idx + 8}
                    x2={padLeft + slotWidth * (idx + 1) - 8}
                    y1={padTop + innerHeight - (item.thresholdValue / maxVal) * innerHeight}
                    y2={padTop + innerHeight - (item.thresholdValue / maxVal) * innerHeight}
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}

                <text
                  x={xCenter}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  fill={isSelected ? 'var(--ink)' : 'var(--ink-muted)'}
                  fontWeight={isSelected ? '700' : '500'}
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                >
                  {item.label}
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
          <strong>{activeItem.sublabel ?? activeItem.label}</strong>
          {activeItem.note && (
            <span style={{ color: 'var(--ink-muted)', marginLeft: 8 }}>{activeItem.note}</span>
          )}
        </div>
        <div className="sc-mono" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>
            {primaryLabel}: <strong>{fmt(activeItem.primaryValue)}</strong>
          </span>
          {secondaryLabel && activeItem.secondaryValue !== undefined && (
            <span>
              {secondaryLabel}: <strong>{fmt(activeItem.secondaryValue)}</strong>
            </span>
          )}
          {thresholdLabel && activeItem.thresholdValue !== undefined && (
            <span style={{ color: 'var(--accent)' }}>
              {thresholdLabel}: <strong>{fmt(activeItem.thresholdValue)}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
