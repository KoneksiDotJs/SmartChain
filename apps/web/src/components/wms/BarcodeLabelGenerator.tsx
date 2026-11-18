'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { downloadCode128Png, encodeCode128B } from '@/lib/code128';

type LabelType = 'BARCODE_CODE128' | 'RFID_SMARTTAG' | 'RFID_EPC';

export function BarcodeLabelGenerator({
  activeWarehouseCode,
  availableSkus,
  warehouseOptions,
  onSendToScanner,
}: {
  activeWarehouseCode: string;
  availableSkus: string[];
  warehouseOptions: Array<{ code: string; name: string }>;
  onSendToScanner: (rawCode: string) => void;
}) {
  const { issueWarehouseLabel, showToast } = useSmartChainMode();

  const [labelType, setLabelType] = useState<LabelType>('BARCODE_CODE128');
  const [materialSku, setMaterialSku] = useState(availableSkus[0] ?? 'MAT-01');
  const [warehouseCode, setWarehouseCode] = useState(activeWarehouseCode);
  const [quantity, setQuantity] = useState('10');
  const [batchCode, setBatchCode] = useState('B2026A');
  const [lastIssuedCode, setLastIssuedCode] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    setWarehouseCode(activeWarehouseCode);
  }, [activeWarehouseCode]);

  const parsedQty = Math.max(1, Math.min(9999, Math.round(Number(quantity) || 10)));
  const cleanBatch = batchCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'B001';

  const previewCode = useMemo(() => {
    const compactSku = materialSku.trim().toUpperCase().replaceAll('-', '');
    const compactWh = warehouseCode.trim().toUpperCase().replaceAll('-', '');
    if (labelType === 'RFID_SMARTTAG') {
      return `RFID:${materialSku}:${warehouseCode}:${parsedQty}`;
    }
    if (labelType === 'RFID_EPC') {
      return `EPC-${compactSku}-${compactWh}-${cleanBatch}`;
    }
    return `BC-${compactSku}-${String(parsedQty).padStart(3, '0')}`;
  }, [cleanBatch, labelType, materialSku, parsedQty, warehouseCode]);

  const encoded = useMemo(() => encodeCode128B(previewCode), [previewCode]);
  const quietModules = 10;
  const viewBoxWidth = encoded.totalWidthModules + quietModules * 2;
  const barcodeHeight = 52;

  async function handleIssueLabel() {
    setIssuing(true);
    try {
      const res = await issueWarehouseLabel({
        labelType,
        materialSku,
        warehouseCode,
        quantity: parsedQty,
        batchCode: cleanBatch,
      });
      if (res.ok && res.rawCode) {
        setLastIssuedCode(res.rawCode);
      }
    } finally {
      setIssuing(false);
    }
  }

  function handleDownloadPng() {
    downloadCode128Png({
      rawCode: previewCode,
      subtitle: `${materialSku} • ${warehouseCode} • ${parsedQty} unit • Batch ${cleanBatch}`,
    });
    showToast(`File PNG ${previewCode} diunduh — siap diuji di Pindai Gambar Barcode`);
  }

  return (
    <PaperCard>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
            Generator Label Barcode &amp; RFID Gudang
          </h3>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Penerbitan label Code128 / RFID internal saat penerimaan barang (Goods Receipt) atau pelabelan ulang rak. Setiap penerbitan dicatat ke AuditLog.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusPill variant="ok">ISO Code 128-B</StatusPill>
          {lastIssuedCode ? <StatusPill variant="warn">Tercatat: {lastIssuedCode}</StatusPill> : null}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <label
            htmlFor="gen-label-type"
            style={{ display: 'block', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}
          >
            Standar Label
          </label>
          <select
            id="gen-label-type"
            className="sc-select"
            style={{ width: '100%' }}
            value={labelType}
            onChange={(e) => setLabelType(e.target.value as LabelType)}
          >
            <option value="BARCODE_CODE128">Code128 Barcode (BC-...)</option>
            <option value="RFID_SMARTTAG">RFID SmartTag (RFID:...)</option>
            <option value="RFID_EPC">RFID EPC Gen2 (EPC-...)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="gen-label-sku"
            style={{ display: 'block', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}
          >
            Material SKU
          </label>
          <select
            id="gen-label-sku"
            className="sc-select"
            style={{ width: '100%' }}
            value={materialSku}
            onChange={(e) => setMaterialSku(e.target.value)}
          >
            {availableSkus.map((sku) => (
              <option key={sku} value={sku}>
                {sku}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="gen-label-wh"
            style={{ display: 'block', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}
          >
            Gudang Penerbit
          </label>
          <select
            id="gen-label-wh"
            className="sc-select"
            style={{ width: '100%' }}
            value={warehouseCode}
            onChange={(e) => setWarehouseCode(e.target.value)}
          >
            {warehouseOptions.map((wh) => (
              <option key={wh.code} value={wh.code}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="gen-label-qty"
            style={{ display: 'block', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}
          >
            Qty per Kemasan
          </label>
          <input
            id="gen-label-qty"
            type="number"
            min={1}
            max={9999}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="gen-label-batch"
            style={{ display: 'block', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}
          >
            Kode Batch / Lot
          </label>
          <input
            id="gen-label-batch"
            type="text"
            maxLength={12}
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              fontSize: 13,
              fontFamily: 'ui-monospace, monospace',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1fr) auto',
          gap: 16,
          alignItems: 'center',
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface-warm)',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg
            role="img"
            aria-label={`Barcode Code128 untuk ${previewCode}`}
            viewBox={`0 0 ${viewBoxWidth} ${barcodeHeight}`}
            style={{ width: '100%', maxWidth: 360, height: 74, shapeRendering: 'crispEdges' }}
          >
            <rect x={0} y={0} width={viewBoxWidth} height={barcodeHeight} fill="var(--surface)" />
            {encoded.bars.map((bar, idx) => (
              <rect
                key={idx}
                x={quietModules + bar.x}
                y={0}
                width={bar.width}
                height={barcodeHeight}
                fill="var(--ink)"
              />
            ))}
          </svg>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em' }}>
            {previewCode}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {materialSku} • {warehouseCode} • {parsedQty} unit • Batch {cleanBatch}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 210 }}>
          <button
            type="button"
            className="sc-btn sc-btn-primary"
            disabled={issuing}
            onClick={handleIssueLabel}
          >
            {issuing ? 'Mencatat...' : 'Buat & Catat Label'}
          </button>
          <button type="button" className="sc-btn sc-btn-secondary" onClick={handleDownloadPng}>
            Unduh PNG (Siap Uji Scan)
          </button>
          <button
            type="button"
            className="sc-btn sc-btn-secondary"
            onClick={() => {
              onSendToScanner(previewCode);
              showToast(`Payload ${previewCode} dimuat ke pemindai di atas`);
            }}
          >
            Kirim ke Scanner di Atas
          </button>
          <button type="button" className="sc-btn sc-btn-secondary" onClick={() => window.print()}>
            Cetak Label Gudang
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-muted)' }}>
        Alur uji mandiri tanpa hardware: klik <strong>Unduh PNG (Siap Uji Scan)</strong>, lalu klik{' '}
        <strong>Pindai Gambar Barcode</strong> pada pemindai di atas dan pilih file PNG hasil unduhan—@zxing/browser akan mendekode garis Code128 secara nyata dan memperbarui stok {warehouseCode}.
      </p>
    </PaperCard>
  );
}
