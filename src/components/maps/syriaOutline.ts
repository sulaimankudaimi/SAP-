/**
 * Syria Map Silhouette & Equirectangular Projection
 * --------------------------------------------------
 * SCHEMATIC MAP ONLY: This map outline is purely illustrative/schematic
 * and must NOT be used as a boundary, geographic, or navigation reference.
 * لا يجوز استخدام هذا المخطط كمرجع حدودي أو ملاحي أو جغرافي رسمي.
 *
 * Data: Simplified silhouette polygon representing the internationally
 * recognized boundary of the Syrian Arab Republic (under 120 points).
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Point2D {
  x: number;
  y: number;
}

// Bounding box for Syria projection (with geographical margin)
export const SYRIA_BBOX = {
  minLon: 35.1,
  maxLon: 42.4,
  minLat: 32.2,
  maxLat: 37.4,
} as const;

/**
 * Equirectangular projection from latitude/longitude to SVG coordinate space.
 */
export function projectLatLon(
  lat: number,
  lon: number,
  width = 800,
  height = 560,
  padding = 40
): Point2D {
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const x = padding + ((lon - SYRIA_BBOX.minLon) / (SYRIA_BBOX.maxLon - SYRIA_BBOX.minLon)) * drawWidth;
  // Invert Y because SVG coordinates increase downwards
  const y = padding + ((SYRIA_BBOX.maxLat - lat) / (SYRIA_BBOX.maxLat - SYRIA_BBOX.minLat)) * drawHeight;

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

/**
 * Simplified boundary points of the internationally recognized Syrian border (64 points).
 * Ordered clockwise starting from the north-west Mediterranean coast.
 */
export const SYRIA_OUTLINE_COORDINATES: readonly LatLon[] = [
  // Mediterranean coast & Turkish border in the NW
  { lat: 35.88, lon: 35.90 }, // Kassab / Ras al-Basit
  { lat: 36.15, lon: 36.10 },
  { lat: 36.42, lon: 36.62 }, // Afrin region
  { lat: 36.68, lon: 36.98 }, // Azaz / Turkish border
  { lat: 36.72, lon: 37.50 }, // North of Jarabulus / Euphrates entry
  { lat: 36.85, lon: 38.00 }, // Kobani border
  { lat: 36.90, lon: 38.50 },
  { lat: 36.92, lon: 39.00 }, // Tel Abyad
  { lat: 36.95, lon: 39.75 },
  { lat: 37.05, lon: 40.50 }, // Ras al-Ayn border
  { lat: 37.08, lon: 41.22 }, // Qamishli border
  { lat: 37.15, lon: 41.80 },
  { lat: 37.32, lon: 42.35 }, // Ain Diwar / Tigris river tripoint (northeast horn)

  // Eastern border with Iraq
  { lat: 37.10, lon: 42.25 },
  { lat: 36.80, lon: 42.00 },
  { lat: 36.45, lon: 41.60 },
  { lat: 36.10, lon: 41.35 },
  { lat: 35.65, lon: 41.15 },
  { lat: 35.25, lon: 41.05 },
  { lat: 34.80, lon: 41.00 },
  { lat: 34.42, lon: 40.92 }, // Abu Kamal / Euphrates river exit

  // South-eastern border with Iraq & desert line
  { lat: 34.10, lon: 40.40 },
  { lat: 33.70, lon: 39.60 },
  { lat: 33.37, lon: 38.79 }, // Al-Tanf tripoint

  // Southern border with Jordan
  { lat: 33.00, lon: 38.00 },
  { lat: 32.75, lon: 37.40 },
  { lat: 32.55, lon: 36.90 },
  { lat: 32.40, lon: 36.45 },
  { lat: 32.32, lon: 36.10 }, // South of Bosra / Daraa
  { lat: 32.45, lon: 35.85 }, // Yarmouk river valley
  { lat: 32.70, lon: 35.75 },

  // Western border
  { lat: 33.00, lon: 35.78 },
  { lat: 33.25, lon: 35.80 },
  { lat: 33.55, lon: 35.95 }, // Mount Hermon area
  { lat: 33.75, lon: 36.05 }, // Qalamoun / Anti-Lebanon
  { lat: 34.05, lon: 36.35 }, // West of Nabek
  { lat: 34.35, lon: 36.55 }, // West of Qusayr
  { lat: 34.55, lon: 36.30 }, // West of Homs / Talkalakh
  { lat: 34.68, lon: 35.98 }, // Nahr al-Kabir al-Janoubi border near coast

  // Mediterranean coastline (Northwards)
  { lat: 34.75, lon: 35.95 },
  { lat: 34.90, lon: 35.88 }, // Tartus Port
  { lat: 35.18, lon: 35.95 }, // Baniyas Terminal / Refinery
  { lat: 35.35, lon: 35.92 }, // Jableh
  { lat: 35.52, lon: 35.78 }, // Latakia Port
  { lat: 35.68, lon: 35.82 },
  { lat: 35.88, lon: 35.90 }, // Return to Kassab start
];

/**
 * Generates an SVG path 'd' string from the simplified boundary coordinates.
 */
export function getSyriaSvgPath(width = 800, height = 560, padding = 40): string {
  const points = SYRIA_OUTLINE_COORDINATES.map((c) => projectLatLon(c.lat, c.lon, width, height, padding));
  if (points.length === 0) return '';
  const first = points[0];
  const rest = points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
  return `M ${first.x} ${first.y} ${rest} Z`;
}
