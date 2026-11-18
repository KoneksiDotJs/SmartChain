export type ScanTagType = 'RFID' | 'BARCODE';

export interface ParsedScanTag {
  rawCode: string;
  tagType: ScanTagType;
  materialSku: string;
  warehouseCode?: string;
  suggestedQty: number;
}

function normalizeCodeToken(token: string, prefix: 'MAT' | 'WH'): string {
  const upper = token.trim().toUpperCase();
  const compact = upper.replaceAll('-', '');
  if (compact.startsWith(prefix) && compact.length > prefix.length) {
    return `${prefix}-${compact.slice(prefix.length)}`;
  }
  return upper;
}

/**
 * Mirrors backend wms.domain.ts parseBarcodeOrRfidTag so offline edge scanning
 * decodes Barcode (EAN/Code128) & RFID (EPC/SmartTag) payloads identically.
 */
export function parseBarcodeOrRfidTag(rawCode: string): ParsedScanTag | null {
  const cleaned = rawCode.trim().toUpperCase();
  if (!cleaned) return null;

  if (cleaned.startsWith('RFID:')) {
    const parts = cleaned.split(':');
    const skuPart = parts[1];
    if (!skuPart) return null;
    const whPart = parts[2];
    const qtyPart = Number(parts[3] ?? 10);
    return {
      rawCode: cleaned,
      tagType: 'RFID',
      materialSku: normalizeCodeToken(skuPart, 'MAT'),
      warehouseCode: whPart ? normalizeCodeToken(whPart, 'WH') : undefined,
      suggestedQty: Number.isFinite(qtyPart) && qtyPart > 0 ? Math.round(qtyPart) : 10,
    };
  }

  if (cleaned.startsWith('EPC-')) {
    const parts = cleaned.split('-');
    const skuPart = parts[1];
    if (!skuPart) return null;
    const whPart = parts[2];
    return {
      rawCode: cleaned,
      tagType: 'RFID',
      materialSku: normalizeCodeToken(skuPart, 'MAT'),
      warehouseCode: whPart ? normalizeCodeToken(whPart, 'WH') : undefined,
      suggestedQty: 10,
    };
  }

  if (cleaned.startsWith('BC-')) {
    const parts = cleaned.split('-');
    const skuPart = parts[1];
    if (!skuPart) return null;
    const qtyPart = Number(parts[2] ?? 1);
    return {
      rawCode: cleaned,
      tagType: 'BARCODE',
      materialSku: normalizeCodeToken(skuPart, 'MAT'),
      suggestedQty: Number.isFinite(qtyPart) && qtyPart > 0 ? Math.round(qtyPart) : 1,
    };
  }

  const eanMatch = /^899100([1-4])\d{2,10}$/.exec(cleaned);
  if (eanMatch) {
    return {
      rawCode: cleaned,
      tagType: 'BARCODE',
      materialSku: `MAT-0${eanMatch[1]!}`,
      suggestedQty: 1,
    };
  }

  return null;
}

export const SAMPLE_SCAN_PRESETS: Array<{ label: string; code: string; kind: ScanTagType }> = [
  { label: 'RFID Baja +10 (WH-04)', code: 'RFID:MAT-01:WH-04:10', kind: 'RFID' },
  { label: 'EPC Resin +10 (WH-04)', code: 'EPC-MAT02-WH04-001', kind: 'RFID' },
  { label: 'Barcode Code128 (+15)', code: 'BC-MAT01-015', kind: 'BARCODE' },
  { label: 'Barcode EAN-13 (MAT-01)', code: '899100100101', kind: 'BARCODE' },
];
