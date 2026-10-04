/**
 * Offline Code128 (Subset B) Barcode Generator
 * Generates pure vector SVG without external libraries or network calls.
 */

// Code128B pattern table (107 patterns)
const CODE128_PATTERNS: string[] = [
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
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export function generateCode128Svg(
  text: string,
  options: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    label?: string;
  } = {}
): string {
  const height = options.height || 60;
  const moduleWidth = options.moduleWidth || 2;
  const showText = options.showText ?? true;

  // Code128 Subset B ASCII encoding (32 to 126)
  const codes: number[] = [START_CODE_B];
  let checkSum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) - 32;
    const validCode = Math.max(0, Math.min(charCode, 95));
    codes.push(validCode);
    checkSum += validCode * (i + 1);
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(STOP_CODE);

  // Convert codes to bar pattern string
  let barString = '';
  for (const code of codes) {
    barString += CODE128_PATTERNS[code] || '111111';
  }

  // Calculate width
  let totalModules = 0;
  for (const char of barString) {
    totalModules += parseInt(char, 10);
  }
  const quietZone = 10 * moduleWidth;
  const totalSvgWidth = totalModules * moduleWidth + quietZone * 2;
  const svgHeight = showText ? height + 24 : height;

  // Build SVG bars
  let currentX = quietZone;
  let isBar = true;
  let rects = '';

  for (const char of barString) {
    const width = parseInt(char, 10) * moduleWidth;
    if (isBar) {
      rects += `<rect x="${currentX}" y="5" width="${width}" height="${height}" fill="#0B2545" />`;
    }
    currentX += width;
    isBar = !isBar;
  }

  const textLabel = options.label || text;
  const textElement = showText
    ? `<text x="${totalSvgWidth / 2}" y="${height + 18}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#0B2545">${textLabel}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSvgWidth} ${svgHeight}" width="100%" height="${svgHeight}">
    <rect width="${totalSvgWidth}" height="${svgHeight}" fill="#FFFFFF" rx="8" />
    ${rects}
    ${textElement}
  </svg>`;
}
