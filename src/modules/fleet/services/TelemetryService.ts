/**
 * TelemetryService: Provides real-time vehicle telemetry and GPS position tracking.
 * Architected with the ITelemetryProvider adapter interface so real GPS hardware APIs
 * (Geotab, Webfleet, Tramigo) can plug in without UI modifications.
 *
 * Current Provider: MockTelemetrySimulator (Deterministic simulation labeled "محاكاة").
 */

import { formatTime, formatPlate } from '../../../core/utils/format';
import { LOCALE } from '../../../config/locale';
import { projectLatLon } from '../../../components/maps/syriaOutline';

export interface TelemetryNode {
  id: string;
  name: string;
  code: string;
  city: string;
  type: 'hub' | 'refinery' | 'oilfield' | 'terminal';
  x: number; // SVG ViewBox coordinates (0-1000, 0-650)
  y: number;
  lat: number;
  lon: number;
  description: string;
}

export interface TelemetryRoute {
  id: string;
  code: string;
  name: string;
  originNodeId: string;
  destinationNodeId: string;
  pathD: string; // SVG path 'd' attribute
  distanceKm: number;
  averageTravelHours: number;
}

export interface VehicleTelemetry {
  vehicleId: string;
  vehicleCode: string;
  vehiclePlate: string;
  driverName: string;
  cargoType: string;
  routeId: string;
  routeName: string;
  originName: string;
  destinationName: string;
  currentPosition: { x: number; y: number };
  progressPercentage: number; // 0 to 100
  speedKmH: number;
  headingDegrees: number;
  fuelLevelPercentage: number;
  engineTempC: number;
  status: 'moving' | 'idling' | 'stopped';
  lastPingTime: string;
  isSimulated: boolean; // Always true for simulator, explicitly labeled "محاكاة"
}

export interface ITelemetryProvider {
  getActiveTelemetries(): Promise<VehicleTelemetry[]>;
  getVehicleTelemetry(vehicleId: string): Promise<VehicleTelemetry | null>;
  subscribeToUpdates(callback: (telemetries: VehicleTelemetry[]) => void): () => void;
}

const sDeir = LOCALE.sites[0]; // حقل الفرات – دير الزور
const sHasakah = LOCALE.sites[1]; // حقل الجزيرة – الحسكة
const sPalmyra = LOCALE.sites[2]; // حقل البادية – تدمر
const sHoms = LOCALE.sites[3]; // مصفاة حمص
const sBaniyas = LOCALE.sites[4]; // مصفاة بانياس
const sTartus = LOCALE.sites[5]; // مرفأ طرطوس
const sLatakia = LOCALE.sites[6]; // مرفأ اللاذقية
const sDamascus = LOCALE.sites[7]; // مستودع دمشق

// Project lat/lon to 1000x650 viewport
const pDam = projectLatLon(sDamascus.latitude, sDamascus.longitude, 1000, 650, 60);
const pDeir = projectLatLon(sDeir.latitude, sDeir.longitude, 1000, 650, 60);
const pHas = projectLatLon(sHasakah.latitude, sHasakah.longitude, 1000, 650, 60);
const pPal = projectLatLon(sPalmyra.latitude, sPalmyra.longitude, 1000, 650, 60);
const pHms = projectLatLon(sHoms.latitude, sHoms.longitude, 1000, 650, 60);
const pBan = projectLatLon(sBaniyas.latitude, sBaniyas.longitude, 1000, 650, 60);
const pTar = projectLatLon(sTartus.latitude, sTartus.longitude, 1000, 650, 60);
const pLat = projectLatLon(sLatakia.latitude, sLatakia.longitude, 1000, 650, 60);

// Key Syrian Energy Nodes (Map Coordinates on 1000x650 viewport, derived from LOCALE.sites)
export const SYRIAN_ENERGY_NODES: TelemetryNode[] = [
  {
    id: sDamascus.code,
    code: '1100',
    name: sDamascus.nameAr,
    city: sDamascus.city,
    type: 'hub',
    x: pDam.x,
    y: pDam.y,
    lat: sDamascus.latitude,
    lon: sDamascus.longitude,
    description: 'المستودع الرئيسي وتوزيع المشتقات النفطية في دمشق وريفها',
  },
  {
    id: sHoms.code,
    code: '1200',
    name: sHoms.nameAr,
    city: sHoms.city,
    type: 'refinery',
    x: pHms.x,
    y: pHms.y,
    lat: sHoms.latitude,
    lon: sHoms.longitude,
    description: 'مصفاة حمص ومجمع التكرير والتوزيع في المنطقة الوسطى',
  },
  {
    id: sBaniyas.code,
    code: '1300',
    name: sBaniyas.nameAr,
    city: sBaniyas.city,
    type: 'refinery',
    x: pBan.x,
    y: pBan.y,
    lat: sBaniyas.latitude,
    lon: sBaniyas.longitude,
    description: 'مصفاة ومصب بانياس البحري لتكرير وتصدير النفط',
  },
  {
    id: sTartus.code,
    code: 'SITE-TAR-PRT',
    name: sTartus.nameAr,
    city: sTartus.city,
    type: 'terminal',
    x: pTar.x,
    y: pTar.y,
    lat: sTartus.latitude,
    lon: sTartus.longitude,
    description: 'مرفأ طرطوس البحري ومستودعات التوريدات البحرية',
  },
  {
    id: sLatakia.code,
    code: 'SITE-LAT-PRT',
    name: sLatakia.nameAr,
    city: sLatakia.city,
    type: 'terminal',
    x: pLat.x,
    y: pLat.y,
    lat: sLatakia.latitude,
    lon: sLatakia.longitude,
    description: 'مرفأ اللاذقية ومحطة تفريغ وتزويد المشتقات النفطية',
  },
  {
    id: sPalmyra.code,
    code: 'SITE-PAL',
    name: sPalmyra.nameAr,
    city: sPalmyra.city,
    type: 'oilfield',
    x: pPal.x,
    y: pPal.y,
    lat: sPalmyra.latitude,
    lon: sPalmyra.longitude,
    description: 'حقل غاز ونفط البادية – تدمر ومعامل معالجة الغاز',
  },
  {
    id: sDeir.code,
    code: 'SITE-DEZ',
    name: sDeir.nameAr,
    city: sDeir.city,
    type: 'oilfield',
    x: pDeir.x,
    y: pDeir.y,
    lat: sDeir.latitude,
    lon: sDeir.longitude,
    description: 'حقل الفرات النفطي – دير الزور ومحطات الضخ الرئيسية',
  },
  {
    id: sHasakah.code,
    code: 'SITE-HAS',
    name: sHasakah.nameAr,
    city: sHasakah.city,
    type: 'oilfield',
    x: pHas.x,
    y: pHas.y,
    lat: sHasakah.latitude,
    lon: sHasakah.longitude,
    description: 'حقول نفط وغاز الجزيرة – الحسكة',
  },
];

// Predefined SVG highway routes connecting Syrian energy facilities along plausible corridors
export const SYRIAN_ENERGY_ROUTES: TelemetryRoute[] = [
  // 1. Fields in the east to Homs (Deir ez-Zor -> Palmyra -> Homs)
  {
    id: 'route-deir-homs',
    code: 'COR-01',
    name: `محور الفرات - حمص (${sDeir.nameAr} - ${sHoms.nameAr})`,
    originNodeId: sDeir.code,
    destinationNodeId: sHoms.code,
    pathD: `M ${pDeir.x} ${pDeir.y} Q ${pPal.x} ${pPal.y} ${pHms.x} ${pHms.y}`,
    distanceKm: 340,
    averageTravelHours: 4.5,
  },
  // 2. Palmyra field to Homs
  {
    id: 'route-palmyra-homs',
    code: 'COR-02',
    name: `خط غاز البادية (${sPalmyra.nameAr} - ${sHoms.nameAr})`,
    originNodeId: sPalmyra.code,
    destinationNodeId: sHoms.code,
    pathD: `M ${pPal.x} ${pPal.y} Q ${(pPal.x + pHms.x) / 2} ${(pPal.y + pHms.y) / 2 - 15} ${pHms.x} ${pHms.y}`,
    distanceKm: 155,
    averageTravelHours: 2.0,
  },
  // 3. Homs to Baniyas
  {
    id: 'route-homs-baniyas',
    code: 'COR-03',
    name: `خط الأنابيب والصهاريج (${sHoms.nameAr} - ${sBaniyas.nameAr})`,
    originNodeId: sHoms.code,
    destinationNodeId: sBaniyas.code,
    pathD: `M ${pHms.x} ${pHms.y} Q ${(pHms.x + pBan.x) / 2} ${(pHms.y + pBan.y) / 2 - 10} ${pBan.x} ${pBan.y}`,
    distanceKm: 85,
    averageTravelHours: 1.2,
  },
  // 4. Homs to Tartus
  {
    id: 'route-homs-tartus',
    code: 'COR-04',
    name: `شريان الساحل الأوسط (${sHoms.nameAr} - ${sTartus.nameAr})`,
    originNodeId: sHoms.code,
    destinationNodeId: sTartus.code,
    pathD: `M ${pHms.x} ${pHms.y} Q ${(pHms.x + pTar.x) / 2 + 10} ${(pHms.y + pTar.y) / 2} ${pTar.x} ${pTar.y}`,
    distanceKm: 95,
    averageTravelHours: 1.3,
  },
  // 5. Homs to Damascus
  {
    id: 'route-homs-damascus',
    code: 'COR-05',
    name: `أوتوستراد حمص - دمشق الدولي (${sHoms.nameAr} - ${sDamascus.nameAr})`,
    originNodeId: sHoms.code,
    destinationNodeId: sDamascus.code,
    pathD: `M ${pHms.x} ${pHms.y} Q ${(pHms.x + pDam.x) / 2 - 15} ${(pHms.y + pDam.y) / 2} ${pDam.x} ${pDam.y}`,
    distanceKm: 165,
    averageTravelHours: 2.1,
  },
  // 6. Latakia to Baniyas
  {
    id: 'route-latakia-baniyas',
    code: 'COR-06',
    name: `المحور الساحلي السريع (${sLatakia.nameAr} - ${sBaniyas.nameAr})`,
    originNodeId: sLatakia.code,
    destinationNodeId: sBaniyas.code,
    pathD: `M ${pLat.x} ${pLat.y} Q ${(pLat.x + pBan.x) / 2 - 10} ${(pLat.y + pBan.y) / 2} ${pBan.x} ${pBan.y}`,
    distanceKm: 55,
    averageTravelHours: 0.8,
  },
];

/**
 * Deterministic helper to sample points along an SVG quadratic curve or line
 */
function samplePointOnRoute(route: TelemetryRoute, progressFraction: number): { x: number; y: number } {
  const origin = SYRIAN_ENERGY_NODES.find((n) => n.id === route.originNodeId) || { x: pDam.x, y: pDam.y };
  const dest = SYRIAN_ENERGY_NODES.find((n) => n.id === route.destinationNodeId) || { x: pHms.x, y: pHms.y };

  // Parse control point if quadratic curve Q cx cy dx dy
  const qMatch = route.pathD.match(/Q\s+([\d.]+)\s+([\d.]+)/);
  if (qMatch) {
    const cx = parseFloat(qMatch[1]);
    const cy = parseFloat(qMatch[2]);
    const t = Math.min(1, Math.max(0, progressFraction));
    const inv = 1 - t;
    // B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
    const x = inv * inv * origin.x + 2 * inv * t * cx + t * t * dest.x;
    const y = inv * inv * origin.y + 2 * inv * t * cy + t * t * dest.y;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  // Linear fallback
  const t = Math.min(1, Math.max(0, progressFraction));
  return {
    x: Math.round((origin.x + (dest.x - origin.x) * t) * 10) / 10,
    y: Math.round((origin.y + (dest.y - origin.y) * t) * 10) / 10,
  };
}

const fn = LOCALE.namePools.firstNames;
const ln = LOCALE.namePools.lastNames;
const gov = LOCALE.governorates;

/**
 * Deterministic Mock Telemetry Simulator
 * Continuously computes real-time vehicle tracking without external API reliance.
 * Explicitly labeled "محاكاة".
 */
class MockTelemetrySimulator implements ITelemetryProvider {
  private activeSimulatedVehicles: Array<{
    vehicleId: string;
    vehicleCode: string;
    vehiclePlate: string;
    driverName: string;
    cargoType: string;
    routeId: string;
    speedBase: number;
    speedVariance: number;
    initialProgress: number; // 0 to 1
    cycleDurationSeconds: number;
  }> = [
    {
      vehicleId: 'veh-1',
      vehicleCode: 'TNK-001',
      vehiclePlate: formatPlate(gov[0].nameAr, 110142),
      driverName: `${fn[0]} ${ln[0]}`,
      cargoType: 'ديزل صناعي - 36,000 لتر',
      routeId: 'route-homs-damascus',
      speedBase: 78,
      speedVariance: 5,
      initialProgress: 0.42,
      cycleDurationSeconds: 180,
    },
    {
      vehicleId: 'veh-2',
      vehicleCode: 'TNK-002',
      vehiclePlate: formatPlate(gov[3].nameAr, 220215),
      driverName: `${fn[1]} ${ln[1]}`,
      cargoType: 'بنزين 95 سوبر - 40,000 لتر',
      routeId: 'route-deir-homs',
      speedBase: 84,
      speedVariance: 6,
      initialProgress: 0.68,
      cycleDurationSeconds: 240,
    },
    {
      vehicleId: 'veh-3',
      vehicleCode: 'TNK-003',
      vehiclePlate: formatPlate(gov[11].nameAr, 330319),
      driverName: `${fn[2]} ${ln[2]}`,
      cargoType: 'نفط خام خفيف - 45,000 لتر',
      routeId: 'route-palmyra-homs',
      speedBase: 72,
      speedVariance: 4,
      initialProgress: 0.25,
      cycleDurationSeconds: 150,
    },
    {
      vehicleId: 'veh-4',
      vehicleCode: 'TNK-004',
      vehiclePlate: formatPlate(gov[4].nameAr, 440481),
      driverName: `${fn[3]} ${ln[3]}`,
      cargoType: 'وقود طائرات Jet A-1 - 38,000 لتر',
      routeId: 'route-homs-baniyas',
      speedBase: 80,
      speedVariance: 5,
      initialProgress: 0.81,
      cycleDurationSeconds: 160,
    },
    {
      vehicleId: 'veh-5',
      vehicleCode: 'TNK-005',
      vehiclePlate: formatPlate(gov[6].nameAr, 550512),
      driverName: `${fn[4]} ${ln[4]}`,
      cargoType: 'غاز بترولي مسال LPG - 32,000 لتر',
      routeId: 'route-homs-tartus',
      speedBase: 75,
      speedVariance: 4,
      initialProgress: 0.15,
      cycleDurationSeconds: 130,
    },
    {
      vehicleId: 'veh-6',
      vehicleCode: 'TNK-006',
      vehiclePlate: formatPlate(gov[5].nameAr, 660674),
      driverName: `${fn[5]} ${ln[5]}`,
      cargoType: 'ديزل ممتاز نظيف - 36,000 لتر',
      routeId: 'route-latakia-baniyas',
      speedBase: 82,
      speedVariance: 7,
      initialProgress: 0.54,
      cycleDurationSeconds: 260,
    },
  ];

  public async getActiveTelemetries(): Promise<VehicleTelemetry[]> {
    const now = Date.now();

    return this.activeSimulatedVehicles.map((cfg, idx) => {
      const route = SYRIAN_ENERGY_ROUTES.find((r) => r.id === cfg.routeId) || SYRIAN_ENERGY_ROUTES[0];
      const originNode = SYRIAN_ENERGY_NODES.find((n) => n.id === route.originNodeId)!;
      const destNode = SYRIAN_ENERGY_NODES.find((n) => n.id === route.destinationNodeId)!;

      // Time-based smooth continuous progress
      const elapsedSeconds = (now / 1000) % cfg.cycleDurationSeconds;
      const progressFraction = ((cfg.initialProgress * cfg.cycleDurationSeconds + elapsedSeconds) % cfg.cycleDurationSeconds) / cfg.cycleDurationSeconds;
      const currentPos = samplePointOnRoute(route, progressFraction);

      // Fluctuate speed slightly around base
      const speedSine = Math.sin((now / 1000) * 0.5 + idx);
      const speed = Math.round(cfg.speedBase + speedSine * cfg.speedVariance);

      // Fuel level decays slowly or wraps around
      const fuelLevel = Math.max(25, Math.round(92 - progressFraction * 40));

      return {
        vehicleId: cfg.vehicleId,
        vehicleCode: cfg.vehicleCode,
        vehiclePlate: cfg.vehiclePlate,
        driverName: cfg.driverName,
        cargoType: cfg.cargoType,
        routeId: route.id,
        routeName: route.name,
        originName: originNode.name,
        destinationName: destNode.name,
        currentPosition: currentPos,
        progressPercentage: Math.round(progressFraction * 100),
        speedKmH: speed,
        headingDegrees: Math.round(45 + (idx * 60) % 360),
        fuelLevelPercentage: fuelLevel,
        engineTempC: 86 + Math.round(Math.abs(speedSine) * 4),
        status: speed > 5 ? 'moving' : 'idling',
        lastPingTime: formatTime(new Date(now - (idx * 2000))),
        isSimulated: true, // Clearly marked per requirement
      };
    });
  }

  public async getVehicleTelemetry(vehicleId: string): Promise<VehicleTelemetry | null> {
    const telemetries = await this.getActiveTelemetries();
    return telemetries.find((t) => t.vehicleId === vehicleId) || null;
  }

  public subscribeToUpdates(callback: (telemetries: VehicleTelemetry[]) => void): () => void {
    // Initial emit
    this.getActiveTelemetries().then(callback);

    // 2-second heartbeat
    const interval = setInterval(async () => {
      const data = await this.getActiveTelemetries();
      callback(data);
    }, 2000);

    return () => clearInterval(interval);
  }
}

export const telemetryService: ITelemetryProvider = new MockTelemetrySimulator();
