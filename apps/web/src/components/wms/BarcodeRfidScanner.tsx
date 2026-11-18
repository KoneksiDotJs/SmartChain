'use client';

import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import React, { useEffect, useRef, useState } from 'react';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { parseBarcodeOrRfidTag, SAMPLE_SCAN_PRESETS } from '@/lib/barcodeRfid';

export function BarcodeRfidScanner({
  activeWarehouseCode,
  preloadedCode,
}: {
  activeWarehouseCode: string;
  preloadedCode?: { code: string; seq: number } | null;
}) {
  const { scanBarcodeOrRfidTag, scanHistory, showToast } = useSmartChainMode();

  const [rawCode, setRawCode] = useState('RFID:MAT-01:WH-04:10');
  const [direction, setDirection] = useState<'IN' | 'OUT' | 'CYCLE_COUNT'>('IN');
  const [qtyOverride, setQtyOverride] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const preview = parseBarcodeOrRfidTag(rawCode);

  useEffect(() => {
    if (preloadedCode?.code) {
      setRawCode(preloadedCode.code);
      setQtyOverride('');
    }
  }, [preloadedCode]);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  async function startCameraScanner(overrideDeviceId?: string) {
    setCameraNote(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraNote(
        'Browser tidak mengizinkan akses kamera (pastikan berjalan di http://localhost atau HTTPS). Gunakan pemindai USB atau input tag di bawah.',
      );
      return;
    }

    try {
      setCameraActive(true);
      const reader = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      setCameras(devices);

      const targetDevice =
        overrideDeviceId ||
        selectedDeviceId ||
        devices[0]?.deviceId ||
        undefined;
      if (targetDevice && !selectedDeviceId) {
        setSelectedDeviceId(targetDevice);
      }

      requestAnimationFrame(async () => {
        if (!videoRef.current) return;
        try {
          controlsRef.current = await reader.decodeFromVideoDevice(
            targetDevice,
            videoRef.current,
            (result, err) => {
              if (result) {
                const decodedText = result.getText();
                setRawCode(decodedText);
                stopCamera();
                void scanBarcodeOrRfidTag({
                  rawCode: decodedText,
                  direction,
                  warehouseCodeOverride: activeWarehouseCode,
                });
              } else if (err && err.name !== 'NotFoundException') {
                // Ignore normal per-frame NotFoundException while searching
              }
            },
          );
        } catch {
          setCameraNote(
            'Tidak ada webcam aktif yang ditemukan atau izin kamera ditolak. Anda tetap dapat memindai lewat gambar barcode, scanner USB, atau preset simulasi.',
          );
          stopCamera();
        }
      });
    } catch {
      setCameraNote('Gagal mengakses kamera perangkat. Pastikan izin kamera aktif pada browser.');
      stopCamera();
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraNote(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const text = result.getText();
      setRawCode(text);
      await scanBarcodeOrRfidTag({
        rawCode: text,
        direction,
        warehouseCodeOverride: activeWarehouseCode,
      });
    } catch {
      setCameraNote(
        'Barcode tidak terbaca dari gambar tersebut. Pastikan gambar jelas (Code128, EAN-13, atau QR Code dengan format SmartChain).',
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedOverride = qtyOverride.trim() ? Number(qtyOverride) : undefined;
    const res = await scanBarcodeOrRfidTag({
      rawCode,
      direction,
      warehouseCodeOverride: activeWarehouseCode,
      quantityOverride:
        parsedOverride && Number.isFinite(parsedOverride) && parsedOverride > 0
          ? Math.round(parsedOverride)
          : undefined,
    });
    if (res.ok) {
      setQtyOverride('');
    }
  }

  async function simulateRfidGateBatch() {
    const gateTags = [
      `RFID:MAT-01:${activeWarehouseCode}:10`,
      `EPC-MAT02-${activeWarehouseCode.replace('-', '')}-001`,
      'BC-MAT03-012',
    ];
    for (const tag of gateTags) {
      await scanBarcodeOrRfidTag({
        rawCode: tag,
        direction,
        warehouseCodeOverride: activeWarehouseCode,
      });
    }
    showToast(`Gerbang RFID (${activeWarehouseCode}) memindai 3 tag pallet sekaligus`);
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
          marginBottom: 12,
        }}
      >
        <div>
          <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
            Pemindai Barcode &amp; RFID Tag ({activeWarehouseCode})
          </h3>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Mendukung kamera laptop/HP lintas browser (ZXing), unggah gambar barcode, scanner USB
            (auto-Enter), dan gerbang RFID.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="sc-btn-secondary"
            onClick={() => (cameraActive ? stopCamera() : void startCameraScanner())}
          >
            {cameraActive ? 'Tutup Kamera' : 'Pindai via Kamera'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => void handleImageUpload(e)}
          />
          <button
            type="button"
            className="sc-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Pindai Gambar Barcode
          </button>

          <button
            type="button"
            className="sc-btn-accent"
            onClick={() => void simulateRfidGateBatch()}
          >
            Simulasi Gerbang RFID (3 Tag)
          </button>
        </div>
      </div>

      {cameraActive && (
        <div
          style={{
            marginBottom: 14,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface-warm)',
            padding: 10,
          }}
        >
          {cameras.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <select
                aria-label="Pilih kamera"
                className="sc-select"
                value={selectedDeviceId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedDeviceId(nextId);
                  stopCamera();
                  void startCameraScanner(nextId);
                }}
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block', borderRadius: 8 }}
          />
        </div>
      )}

      {cameraNote && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 10,
            backgroundColor: 'var(--warn-soft)',
            border: '1px solid var(--warn-border)',
            color: 'var(--warn)',
            fontSize: 13,
          }}
        >
          {cameraNote}
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.9fr) minmax(0, 0.7fr) auto',
          gap: 10,
          alignItems: 'end',
          marginBottom: 12,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          <span>Kode Barcode / Tag RFID (Tekan Enter dari Scanner)</span>
          <input
            type="text"
            className="sc-input sc-mono"
            value={rawCode}
            onChange={(e) => setRawCode(e.target.value)}
            placeholder="RFID:MAT-01:WH-04:10 atau 899100100101"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          <span>Arah Mutasi</span>
          <select
            className="sc-select"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT' | 'CYCLE_COUNT')}
          >
            <option value="IN">Masuk (IN)</option>
            <option value="OUT">Keluar (OUT)</option>
            <option value="CYCLE_COUNT">Hitung Fisik (CYCLE_COUNT)</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          <span>Override Qty (Opsional)</span>
          <input
            type="number"
            min={1}
            className="sc-input"
            value={qtyOverride}
            onChange={(e) => setQtyOverride(e.target.value)}
            placeholder={preview ? String(preview.suggestedQty) : '10'}
          />
        </label>

        <button type="submit" className="sc-btn-primary">
          Pindai Tag
        </button>
      </form>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Contoh Tag:</span>
          {SAMPLE_SCAN_PRESETS.map((preset) => (
            <button
              key={preset.code}
              type="button"
              className="sc-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => setRawCode(preset.code)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div>
          {preview ? (
            <StatusPill variant={preview.tagType === 'RFID' ? 'ok' : 'neutral'}>
              Terbaca: {preview.tagType} | {preview.materialSku} | +{qtyOverride || preview.suggestedQty} unit
            </StatusPill>
          ) : (
            <StatusPill variant="alert">Format tag belum dikenali</StatusPill>
          )}
        </div>
      </div>

      {scanHistory.length > 0 && (
        <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="sc-table" style={{ minWidth: 540 }}>
            <thead>
              <tr>
                <th>Tipe</th>
                <th>Kode Tag / Barcode</th>
                <th>SKU</th>
                <th>Gudang</th>
                <th className="sc-num">Mutasi</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {scanHistory.slice(0, 6).map((s) => (
                <tr key={s.id}>
                  <td>
                    <StatusPill variant={s.tagType === 'RFID' ? 'ok' : 'neutral'}>
                      {s.tagType}
                    </StatusPill>
                  </td>
                  <td className="sc-mono" style={{ fontSize: 12.5 }}>
                    <div>{s.rawCode}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                      {s.idempotencyKey}
                    </div>
                  </td>
                  <td className="sc-mono">{s.materialSku}</td>
                  <td className="sc-mono">{s.warehouseCode}</td>
                  <td className="sc-num">
                    {s.direction} {s.quantity}
                  </td>
                  <td>
                    <StatusPill variant={s.wasOffline ? 'warn' : 'ok'}>
                      {s.wasOffline ? 'Antrean Offline' : 'Tersinkron'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaperCard>
  );
}
