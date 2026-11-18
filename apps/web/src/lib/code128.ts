/**
 * Pure ISO/IEC 15417 Code 128-B barcode encoder.
 * Produces deterministic module widths usable both for SVG preview and
 * crisp PNG canvas downloads (with mandatory quiet zones for @zxing/browser).
 */

const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export interface EncodedCode128 {
  encodedText: string;
  /** Alternating bar/space module widths starting with a bar. */
  modules: number[];
  totalWidthModules: number;
  /** X-offset and width of each black bar in module units (including quietZone = 0 origin). */
  bars: Array<{ x: number; width: number }>;
}

/**
 * Encodes printable ASCII strings (char codes 32..127) using Code 128 Set B.
 */
export function encodeCode128B(rawInput: string): EncodedCode128 {
  const sanitized = rawInput
    .trim()
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 127;
    })
    .join('');

  const encodedText = sanitized || 'BC-MAT01-010';
  const values: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < encodedText.length; i += 1) {
    const val = encodedText.charCodeAt(i) - 32;
    values.push(val);
    checksum += val * (i + 1);
  }

  values.push(checksum % 103);
  values.push(STOP_CODE);

  const modules: number[] = [];
  for (const val of values) {
    const pattern = CODE128_PATTERNS[val] ?? '';
    for (const digit of pattern) {
      modules.push(Number(digit));
    }
  }

  const bars: Array<{ x: number; width: number }> = [];
  let cursor = 0;
  for (let idx = 0; idx < modules.length; idx += 1) {
    const width = modules[idx] ?? 0;
    if (idx % 2 === 0 && width > 0) {
      bars.push({ x: cursor, width });
    }
    cursor += width;
  }

  return {
    encodedText,
    modules,
    totalWidthModules: cursor,
    bars,
  };
}

/**
 * Renders the Code 128 barcode onto an offscreen canvas with ISO quiet zones and
 * human-readable text, then triggers a crisp PNG download ready for camera/image scan testing.
 */
export function downloadCode128Png(options: {
  rawCode: string;
  subtitle: string;
  filename?: string;
}): void {
  const encoded = encodeCode128B(options.rawCode);
  const quietModules = 14;
  const pxPerModule = 4;
  const barHeight = 140;
  const topPad = 24;
  const bottomPad = 64;
  const canvasWidth = (encoded.totalWidthModules + quietModules * 2) * pxPerModule;
  const canvasHeight = topPad + barHeight + bottomPad;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const surfaceColor = rootStyle.getPropertyValue('--surface').trim() || 'white';
  const inkColor = rootStyle.getPropertyValue('--ink').trim() || 'black';
  const mutedColor = rootStyle.getPropertyValue('--ink-muted').trim() || 'dimgray';

  ctx.fillStyle = surfaceColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = inkColor;
  for (const bar of encoded.bars) {
    const x = (quietModules + bar.x) * pxPerModule;
    const w = bar.width * pxPerModule;
    ctx.fillRect(x, topPad, w, barHeight);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = inkColor;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(encoded.encodedText, canvasWidth / 2, topPad + barHeight + 28);

  ctx.fillStyle = mutedColor;
  ctx.font = '14px sans-serif';
  ctx.fillText(options.subtitle, canvasWidth / 2, topPad + barHeight + 50);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = options.filename ?? `${encoded.encodedText.replace(/[^A-Z0-9_-]/gi, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
