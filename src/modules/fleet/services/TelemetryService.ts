/**
 * TelemetryService: Provides real-time vehicle telemetry and GPS position tracking.
 * Architected with the ITelemetryProvider adapter interface so real GPS hardware APIs
 * (Geotab, Webfleet, Tramigo) can plug in without UI modifications.
 *
 * Current Provider: MockTelemetrySimulator (Deterministic simulation labeled "محاكاة").
 */

import { formatTime, formatPlate } from '../../../core/utils/format';
import { LOCALE } from '../../../config/locale';

export interface TelemetryNode {
  id: string;
  name: string;
  code: string;
  type: 'hub' | 'refinery' | 'oilfield' | 'terminal';
  x: number; // SVG ViewBox coordinates (0-1000, 0-650)
  y: number;
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
  isSimulated: boolean; // Always true for simulator, explicitly labeled in UI
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

// Key Syrian Energy Nodes (Map Coordinates on 1000x650 viewport, derived from LOCALE.sites)
export const SAUDI_ENERGY_NODES: TelemetryNode[] = [
  {
    id: sDamascus.code,
    code: '1100',
    name: sDamascus.nameAr,
    type: 'hub',
    x: 485,
    y: 345,
    description: 'المستودع الرئيسي وتوزيع المنتجات البترولية في دمشق وريفها',
  },
  {
    id: sDeir.code,
    code: 'DEZ-01',
    name: sDeir.nameAr,
    type: 'oilfield',
    x: 645,
    y: 310,
    description: 'حقل إنتاج ومعالجة النفط الخام في حوض الفرات',
  },
  {
    id: sTartus.code,
    code: 'TRT-01',
    name: sTartus.nameAr,
    type: 'terminal',
    x: 670,
    y: 235,
    description: 'مرفأ الشحن البحري ومحطات تزويد الصهاريج على الساحل السوري',
  },
  {
    id: sHoms.code,
    code: '1200',
    name: sHoms.nameAr,
    type: 'refinery',
    x: 185,
    y: 315,
    description: 'مصفاة التكرير المركزية وخطوط الإمداد في المنطقة الوسطى',
  },
  {
    id: sPalmyra.code,
    code: 'PLM-02',
    name: sPalmyra.nameAr,
    type: 'oilfield',
    x: 555,
    y: 320,
    description: 'حقل الغاز والنفط الخام في البادية السورية',
  },
  {
    id: sBaniyas.code,
    code: '1300',
    name: sBaniyas.nameAr,
    type: 'refinery',
    x: 650,
    y: 190,
    description: 'مصفاة بانياس الساحلية لتكرير المشتقات النفطية',
  },
  {
    id: sHasakah.code,
    code: 'HSK-09',
    name: sHasakah.nameAr,
    type: 'oilfield',
    x: 770,
    y: 490,
    description: 'منشأة استخراج وتجميع النفط والغاز في منطقة الجزيرة',
  },
  {
    id: sLatakia.code,
    code: 'LTK-07',
    name: sLatakia.nameAr,
    type: 'terminal',
    x: 290,
    y: 560,
    description: 'مرفأ اللاذقية البحري ومستودعات الخزن الساحلية',
  },
];

// Predefined SVG highway routes connecting Syrian energy facilities
export const SAUDI_ENERGY_ROUTES: TelemetryRoute[] = [
  {
    id: 'route-damascus-tartus',
    code: 'RT-101',
    name: `خط إمداد ${sDamascus.nameAr} - ${sTartus.nameAr}`,
    originNodeId: sDamascus.code,
    destinationNodeId: sTartus.code,
    pathD: 'M 485 345 Q 570 290 670 235',
    distanceKm: 255,
    averageTravelHours: 3.5,
  },
  {
    id: 'route-damascus-homs',
    code: 'RT-102',
    name: `شريان الجنوب - الوسط (${sDamascus.nameAr} - ${sHoms.nameAr})`,
    originNodeId: sDamascus.code,
    destinationNodeId: sHoms.code,
    pathD: 'M 485 345 Q 330 330 185 315',
    distanceKm: 165,
    averageTravelHours: 2.2,
  },
  {
    id: 'route-deir-tartus',
    code: 'RT-103',
    name: `خط تجميع الفرات (${sDeir.nameAr} - ${sTartus.nameAr})`,
    originNodeId: sDeir.code,
    destinationNodeId: sTartus.code,
    pathD: 'M 645 310 Q 660 270 670 235',
    distanceKm: 420,
    averageTravelHours: 5.0,
  },
  {
    id: 'route-palmyra-damascus',
    code: 'RT-104',
    name: `خط الغاز والمكثفات (${sPalmyra.nameAr} - ${sDamascus.nameAr})`,
    originNodeId: sPalmyra.code,
    destinationNodeId: sDamascus.code,
    pathD: 'M 555 320 Q 520 335 485 345',
    distanceKm: 245,
    averageTravelHours: 3.0,
  },
  {
    id: 'route-tartus-baniyas',
    code: 'RT-105',
    name: `الخط الساحلي الصناعي (${sTartus.nameAr} - ${sBaniyas.nameAr})`,
    originNodeId: sTartus.code,
    destinationNodeId: sBaniyas.code,
    pathD: 'M 670 235 Q 660 210 650 190',
    distanceKm: 45,
    averageTravelHours: 0.8,
  },
  {
    id: 'route-damascus-latakia',
    code: 'RT-106',
    name: `محور الساحل الشمالي (${sDamascus.nameAr} - ${sLatakia.nameAr})`,
    originNodeId: sDamascus.code,
    destinationNodeId: sLatakia.code,
    pathD: 'M 485 345 Q 380 460 290 560',
    distanceKm: 340,
    averageTravelHours: 4.2,
  },
];

/**
 * Deterministic helper to sample points along an SVG quadratic curve or line
 */
function samplePointOnRoute(route: TelemetryRoute, progressFraction: number): { x: number; y: number } {
  const origin = SAUDI_ENERGY_NODES.find((n) => n.id === route.originNodeId) || { x: 485, y: 345 };
  const dest = SAUDI_ENERGY_NODES.find((n) => n.id === route.destinationNodeId) || { x: 670, y: 235 };

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
      routeId: 'route-damascus-tartus',
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
      routeId: 'route-damascus-homs',
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
      routeId: 'route-deir-tartus',
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
      routeId: 'route-palmyra-damascus',
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
      routeId: 'route-tartus-baniyas',
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
      routeId: 'route-damascus-latakia',
      speedBase: 82,
      speedVariance: 7,
      initialProgress: 0.54,
      cycleDurationSeconds: 260,
    },
  ];

  public async getActiveTelemetries(): Promise<VehicleTelemetry[]> {
    const now = Date.now();

    return this.activeSimulatedVehicles.map((cfg, idx) => {
      const route = SAUDI_ENERGY_ROUTES.find((r) => r.id === cfg.routeId) || SAUDI_ENERGY_ROUTES[0];
      const originNode = SAUDI_ENERGY_NODES.find((n) => n.id === route.originNodeId)!;
      const destNode = SAUDI_ENERGY_NODES.find((n) => n.id === route.destinationNodeId)!;

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
