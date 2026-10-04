/**
 * TelemetryService: Provides real-time vehicle telemetry and GPS position tracking.
 * Architected with the ITelemetryProvider adapter interface so real GPS hardware APIs
 * (Geotab, Webfleet, Tramigo) can plug in without UI modifications.
 *
 * Current Provider: MockTelemetrySimulator (Deterministic simulation labeled "محاكاة").
 */

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

// Key Saudi Energy Nodes (Map Coordinates on 1000x650 viewport)
export const SAUDI_ENERGY_NODES: TelemetryNode[] = [
  {
    id: 'node-riyadh',
    code: '1100',
    name: 'مركز الرياض اللوجستي المركزي',
    type: 'hub',
    x: 485,
    y: 345,
    description: 'المستودع الرئيسي وتوزيع المنتجات البترولية للقطاع الأوسط',
  },
  {
    id: 'node-ghawar',
    code: 'GHW-01',
    name: 'حقل الغوار النفطي (محطة الضخ 4)',
    type: 'oilfield',
    x: 645,
    y: 310,
    description: 'أكبر حقل نفط بري في العالم - مجمع المعالجة الشمالي',
  },
  {
    id: 'node-dammam',
    code: '1300',
    name: 'مجمع الدمام ورأس تنورة اللوجستي',
    type: 'terminal',
    x: 670,
    y: 235,
    description: 'أرصفة التصدير ومحطات الخلط وتزويد الشاحنات بالساحل الشرقي',
  },
  {
    id: 'node-yanbu',
    code: '1200',
    name: 'مصفاة ومحطة ينبع البترولية',
    type: 'refinery',
    x: 185,
    y: 315,
    description: 'مصفاة التكرير وخطوط أنابيب شرق-غرب على ساحل البحر الأحمر',
  },
  {
    id: 'node-khurais',
    code: 'KHR-02',
    name: 'حقل خريص لمعالجة النفط الخام',
    type: 'oilfield',
    x: 555,
    y: 320,
    description: 'مرافق الإنتاج المركزي لإنتاج الزيت العربي الخفيف',
  },
  {
    id: 'node-jubail',
    code: 'JBL-05',
    name: 'مجمع الجبيل الصناعي للبتروكيماويات',
    type: 'refinery',
    x: 650,
    y: 190,
    description: 'مدينة التكرير والصناعات البترولية والتحويلية',
  },
  {
    id: 'node-shaybah',
    code: 'SHB-09',
    name: 'حقل شيبة - الربع الخالي',
    type: 'oilfield',
    x: 770,
    y: 490,
    description: 'منشأة استخراج وتكثيف الغاز وسوائل الغاز الطبيعي',
  },
  {
    id: 'node-jazan',
    code: 'JZN-07',
    name: 'مصفاة وميناء جازان الاقتصادي',
    type: 'terminal',
    x: 290,
    y: 560,
    description: 'توليد الطاقة وتكرير الديزل الثقيل للقطاع الجنوبي الغربي',
  },
];

// Predefined SVG highway routes connecting Saudi energy facilities
export const SAUDI_ENERGY_ROUTES: TelemetryRoute[] = [
  {
    id: 'route-riyadh-dammam',
    code: 'RT-101',
    name: 'خط إمداد الرياض - الدمام (طريق 40 السريع)',
    originNodeId: 'node-riyadh',
    destinationNodeId: 'node-dammam',
    pathD: 'M 485 345 Q 570 290 670 235',
    distanceKm: 395,
    averageTravelHours: 4.5,
  },
  {
    id: 'route-riyadh-yanbu',
    code: 'RT-102',
    name: 'شريان شرق - غرب (الرياض - ينبع)',
    originNodeId: 'node-riyadh',
    destinationNodeId: 'node-yanbu',
    pathD: 'M 485 345 Q 330 330 185 315',
    distanceKm: 1050,
    averageTravelHours: 11.5,
  },
  {
    id: 'route-ghawar-dammam',
    code: 'RT-103',
    name: 'خط تجميع بقيق (الغوار - الدمام)',
    originNodeId: 'node-ghawar',
    destinationNodeId: 'node-dammam',
    pathD: 'M 645 310 Q 660 270 670 235',
    distanceKm: 140,
    averageTravelHours: 1.8,
  },
  {
    id: 'route-khurais-riyadh',
    code: 'RT-104',
    name: 'خط الغاز والمكثفات (خريص - الرياض)',
    originNodeId: 'node-khurais',
    destinationNodeId: 'node-riyadh',
    pathD: 'M 555 320 Q 520 335 485 345',
    distanceKm: 160,
    averageTravelHours: 2.0,
  },
  {
    id: 'route-dammam-jubail',
    code: 'RT-105',
    name: 'الخط الساحلي الصناعي (الدمام - الجبيل)',
    originNodeId: 'node-dammam',
    destinationNodeId: 'node-jubail',
    pathD: 'M 670 235 Q 660 210 650 190',
    distanceKm: 95,
    averageTravelHours: 1.2,
  },
  {
    id: 'route-riyadh-jazan',
    code: 'RT-106',
    name: 'محور الجنوب الغربي (الرياض - جازان)',
    originNodeId: 'node-riyadh',
    destinationNodeId: 'node-jazan',
    pathD: 'M 485 345 Q 380 460 290 560',
    distanceKm: 980,
    averageTravelHours: 10.5,
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
      vehiclePlate: 'أ ب ج 1101',
      driverName: 'سلطان المطيري',
      cargoType: 'ديزل صناعي - 36,000 لتر',
      routeId: 'route-riyadh-dammam',
      speedBase: 78,
      speedVariance: 5,
      initialProgress: 0.42,
      cycleDurationSeconds: 180,
    },
    {
      vehicleId: 'veh-2',
      vehicleCode: 'TNK-002',
      vehiclePlate: 'د هـ و 2202',
      driverName: 'خالد العنزي',
      cargoType: 'بنزين 95 سوبر - 40,000 لتر',
      routeId: 'route-riyadh-yanbu',
      speedBase: 84,
      speedVariance: 6,
      initialProgress: 0.68,
      cycleDurationSeconds: 240,
    },
    {
      vehicleId: 'veh-3',
      vehicleCode: 'TNK-003',
      vehiclePlate: 'ح ط ي 3303',
      driverName: 'فهد القحطاني',
      cargoType: 'زيت خام عربي خفيف - 45,000 لتر',
      routeId: 'route-ghawar-dammam',
      speedBase: 72,
      speedVariance: 4,
      initialProgress: 0.25,
      cycleDurationSeconds: 150,
    },
    {
      vehicleId: 'veh-4',
      vehicleCode: 'TNK-004',
      vehiclePlate: 'ك ل م 4404',
      driverName: 'عبدالله الشمري',
      cargoType: 'وقود طائرات Jet A-1 - 38,000 لتر',
      routeId: 'route-khurais-riyadh',
      speedBase: 80,
      speedVariance: 5,
      initialProgress: 0.81,
      cycleDurationSeconds: 160,
    },
    {
      vehicleId: 'veh-5',
      vehicleCode: 'TNK-005',
      vehiclePlate: 'ن س ع 5505',
      driverName: 'محمد الدوسري',
      cargoType: 'غاز بترولي مسال LPG - 32,000 لتر',
      routeId: 'route-dammam-jubail',
      speedBase: 75,
      speedVariance: 4,
      initialProgress: 0.15,
      cycleDurationSeconds: 130,
    },
    {
      vehicleId: 'veh-6',
      vehicleCode: 'TNK-006',
      vehiclePlate: 'ف ص ق 6606',
      driverName: 'تركي العتيبي',
      cargoType: 'ديزل ممتاز نظيف - 36,000 لتر',
      routeId: 'route-riyadh-jazan',
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
        lastPingTime: new Date(now - (idx * 2000)).toLocaleTimeString('ar-SA'),
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
