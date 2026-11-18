'use client';

import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { DISTRIBUTOR_DIRECTORY } from '@/lib/mockSnapshot';

export default function InventoryAndTraceabilityPage() {
  const { suppliers, purchaseOrders, warehouses, salesOrders, shipments, forecasts } =
    useSmartChainMode();

  const [skuFilter, setSkuFilter] = useState<'ALL' | 'MAT-01' | 'MAT-02' | 'MAT-03'>('MAT-01');
  const [whFilter, setWhFilter] = useState<string>('ALL');

  const filteredStocks = warehouses.filter(
    (w) =>
      (skuFilter === 'ALL' || w.materialSku === skuFilter) &&
      (whFilter === 'ALL' || w.warehouseCode === whFilter),
  );

  const selectedMaterial = forecasts.find((m) => m.sku === skuFilter) ?? forecasts[0]!;
  const matchingCategory =
    skuFilter === 'MAT-01'
      ? 'LOGAM'
      : skuFilter === 'MAT-02'
        ? 'POLIMER'
        : skuFilter === 'MAT-03'
          ? 'KOMPONEN'
          : null;

  const linkedSuppliers = matchingCategory
    ? suppliers.filter((s) => s.materialCategory === matchingCategory)
    : suppliers;
  const linkedPos =
    skuFilter === 'ALL'
      ? purchaseOrders
      : purchaseOrders.filter((po) => po.materialSku === skuFilter);

  const linkedOrders = salesOrders.filter((o) =>
    whFilter === 'ALL' ? true : shipments.some((s) => s.orderNumber === o.orderNumber),
  );
  const linkedShipments = shipments;
  const linkedDistributors = DISTRIBUTOR_DIRECTORY.filter((d) =>
    linkedOrders.some((o) => o.distributorCode === d.code),
  );

  const uniqueWhCodes = Array.from(new Set(warehouses.map((w) => w.warehouseCode)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 className="sc-section-head">
            Inventory Management &amp; Pelacakan Hubungan Rantai Pasok
          </h2>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Memantau buku besar persediaan lintas 8 gudang serta menelusuri hubungan Pemasok →
            Pabrik → Gudang → Pengiriman → Distributor.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            aria-label="Filter Material SKU"
            className="sc-select"
            value={skuFilter}
            onChange={(e) =>
              setSkuFilter(e.target.value as 'ALL' | 'MAT-01' | 'MAT-02' | 'MAT-03')
            }
          >
            <option value="ALL">Semua Material</option>
            <option value="MAT-01">MAT-01 — Baja Lembaran</option>
            <option value="MAT-02">MAT-02 — Resin Polimer</option>
            <option value="MAT-03">MAT-03 — Komponen Presisi</option>
          </select>

          <select
            aria-label="Filter Gudang"
            className="sc-select"
            value={whFilter}
            onChange={(e) => setWhFilter(e.target.value)}
          >
            <option value="ALL">Semua 8 Gudang</option>
            {uniqueWhCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TactileSheet>
        <h3 className="sc-section-head">
          Peta Hubungan Entitas End-to-End ({skuFilter === 'ALL' ? 'Semua SKU' : selectedMaterial.sku})
        </h3>
        <p className="sc-section-desc">
          Menghubungkan hulu ke hilir secara real-time dalam satu basis data relasional terpusat.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: 'var(--surface-warm)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>
              1. Pemasok (SRM)
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)' }}>
              {linkedSuppliers.length} Pemasok
            </div>
            <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
              {linkedSuppliers.slice(0, 3).map((s) => s.code).join(', ')}
              {linkedSuppliers.length > 3 ? ` +${linkedSuppliers.length - 3}` : ''}
            </div>
            <div className="sc-mono" style={{ fontSize: 11.5, marginTop: 4 }}>
              PO Aktif: {linkedPos.length} dokumen
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: 'var(--surface-warm)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>
              2. Pabrik Produksi
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)' }}>
              3 Pabrik Aktif
            </div>
            <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
              FAC-01 Cikarang, FAC-02 Gresik, FAC-03 Semarang
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: 'var(--surface-warm)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>
              3. Gudang (Inventory &amp; WMS)
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)' }}>
              {filteredStocks.reduce((sum, s) => sum + s.physicalQty, 0)} unit
            </div>
            <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
              {new Set(filteredStocks.map((s) => s.warehouseCode)).size} gudang | Karantina:{' '}
              {filteredStocks.reduce((sum, s) => sum + s.quarantineQty, 0)} unit
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: 'var(--surface-warm)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>
              4. Distributor &amp; Resi TMS
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)' }}>
              {linkedDistributors.length} / 25 Mitra
            </div>
            <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
              {linkedOrders.length} order | {linkedShipments.length} resi aktif
            </div>
          </div>
        </div>
      </TactileSheet>

      <InteractiveBarChart
        title="Saldo Fisik vs Batas ROP per Lokasi Gudang"
        subtitle="Selisih RFID vs fisik atau stok di bawah ROP langsung ditandai untuk tindak lanjut."
        primaryLabel="Stok Fisik"
        secondaryLabel="Karantina"
        thresholdLabel="Batas ROP"
        unitSuffix="unit"
        data={filteredStocks.map((st) => ({
          id: st.stockId,
          label: `${st.warehouseCode}/${st.materialSku}`,
          sublabel: `${st.warehouseName} — ${st.materialName}`,
          primaryValue: st.physicalQty,
          secondaryValue: st.quarantineQty,
          thresholdValue: st.rop,
          tone:
            st.rfidQty !== st.physicalQty || st.physicalQty <= st.rop ? 'accent' : 'ink',
          secondaryTone: 'warn',
          note:
            st.rfidQty !== st.physicalQty
              ? `Selisih RFID ${st.rfidQty} vs Fisik ${st.physicalQty}`
              : st.physicalQty <= st.rop
                ? 'Di bawah ROP — perlu pengadaan'
                : 'Stok sehat',
        }))}
      />

      <PaperCard>
        <h3 className="sc-section-head">Buku Besar Persediaan (Inventory Ledger)</h3>
        <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="sc-table">
            <thead>
              <tr>
                <th>Gudang</th>
                <th>SKU</th>
                <th className="sc-num">RFID</th>
                <th className="sc-num">Fisik</th>
                <th className="sc-num">Karantina</th>
                <th className="sc-num">ROP</th>
                <th>Status Kesehatan</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((st) => {
                const hasDiff = st.rfidQty !== st.physicalQty;
                const belowRop = st.physicalQty <= st.rop;
                return (
                  <tr key={st.stockId}>
                    <td>
                      <strong className="sc-mono">{st.warehouseCode}</strong>
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{st.city}</div>
                    </td>
                    <td className="sc-mono">
                      <div>{st.materialSku}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                        {st.materialName}
                      </div>
                    </td>
                    <td className="sc-num">{st.rfidQty}</td>
                    <td className="sc-num">{st.physicalQty}</td>
                    <td className="sc-num">{st.quarantineQty}</td>
                    <td className="sc-num">{st.rop}</td>
                    <td>
                      <StatusPill
                        variant={hasDiff ? 'alert' : belowRop ? 'warn' : 'ok'}
                      >
                        {hasDiff ? 'Selisih RFID' : belowRop ? 'Di Bawah ROP' : 'Sehat'}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PaperCard>
    </div>
  );
}
