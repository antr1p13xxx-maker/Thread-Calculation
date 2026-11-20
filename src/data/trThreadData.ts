import {
  type ThreadStandardFamily,
  THREAD_FAMILY_METADATA,
} from './multiThreadCatalog.ts';

export type ThreadSeries = 1 | 2 | 3;

export type ExternalTolClass = '7e' | '7h' | '8e' | '8c';
export type InternalTolClass = '7H' | '8H';

export type ThreadMaterialGrade =
  | 'C45'
  | 'BRONZE'
  | 'C45_BRONZE_PAIR'
  | '42CRMO4'
  | 'SUS304';

export interface MaterialMechanicalSpec {
  code: ThreadMaterialGrade;
  label: string;
  shortLabel: string;
  yieldStrengthMpa: number; // Re / Rp0.2 (MPa)
  allowableAxialStressMpa: number; // sigma_izin (MPa)
  allowableShearStressMpa: number; // tau_izin (MPa) for core shear calculation
  defaultFrictionMu: number; // Default thread friction coefficient mu (lubricated)
  notes: string;
}

export const THREAD_MATERIAL_SPECS: Record<
  ThreadMaterialGrade,
  MaterialMechanicalSpec
> = {
  C45: {
    code: 'C45',
    label: 'Baja Karbon C45 / S45C',
    shortLabel: 'Baja C45',
    yieldStrengthMpa: 340,
    allowableAxialStressMpa: 110,
    allowableShearStressMpa: 65, // tau_izin = 65 MPa (N/mm2)
    defaultFrictionMu: 0.15,
    notes: 'Poros/baut baja karbon menengah standar konstruksi mesin (SF ≈ 3.0, μ ≈ 0.15)',
  },
  BRONZE: {
    code: 'BRONZE',
    label: 'Perunggu CuSn12 / Rg7',
    shortLabel: 'Perunggu CuSn12',
    yieldStrengthMpa: 150,
    allowableAxialStressMpa: 50,
    allowableShearStressMpa: 30, // tau_izin = 30 MPa (N/mm2)
    defaultFrictionMu: 0.10,
    notes: 'Material mur/ulir perunggu tahan aus gesek rendah (SF ≈ 3.0, μ ≈ 0.10)',
  },
  C45_BRONZE_PAIR: {
    code: 'C45_BRONZE_PAIR',
    label: 'Rakitan Baut C45 + Mur Perunggu',
    shortLabel: 'C45 + Perunggu',
    yieldStrengthMpa: 150,
    allowableAxialStressMpa: 50,
    allowableShearStressMpa: 30, // Governed by the softer Bronze nut shear strength
    defaultFrictionMu: 0.10,
    notes: 'Kapasitas geser & koefisien gesek ditentukan kontak Baja C45 terhadap Perunggu (τ = 30 MPa, μ ≈ 0.10)',
  },
  '42CRMO4': {
    code: '42CRMO4',
    label: 'Baja Paduan 42CrMo4 (SCM440)',
    shortLabel: 'Baja 42CrMo4',
    yieldStrengthMpa: 650,
    allowableAxialStressMpa: 210,
    allowableShearStressMpa: 120,
    defaultFrictionMu: 0.14,
    notes: 'Baja paduan kekuatan tinggi untuk spindel press hidrolik & alat berat (μ ≈ 0.14)',
  },
  SUS304: {
    code: 'SUS304',
    label: 'Stainless Steel SUS 304 (A2)',
    shortLabel: 'SUS 304',
    yieldStrengthMpa: 210,
    allowableAxialStressMpa: 70,
    allowableShearStressMpa: 42,
    defaultFrictionMu: 0.18,
    notes: 'Baja tahan karat austenitik untuk lingkungan korosif / pintu air (μ ≈ 0.18)',
  },
};

export interface TrStandardSpec {
  d: number; // Nominal diameter (mm)
  p: number; // Pitch (mm)
  series: ThreadSeries; // 1 = Utama (Preferred), 2 = Halus (Fine), 3 = Kasar (Coarse)
}

export interface TrCalculatedRow {
  id: string;
  threadType: ThreadStandardFamily; // TR, METRIC_M, SQ, BUTTRESS_S, ACME, UNC_UNF, BSW_BSF, BSP_NPT
  threadAngleDeg: number; // Included thread angle alpha (30, 60, 0, 33, 29, 55)
  flankHalfAngleDeg: number; // Load flank half-angle beta (15, 30, 0, 3, 14.5, 27.5)
  tpi?: number; // Threads per inch for imperial/pipe standards
  standardName: string; // Short standard reference
  designation: string; // e.g. "Tr 20 x 4", "M 20 x 2.5", "Sq 24 x 5", "1\" - 5 ACME"
  series: ThreadSeries;
  d: number; // Nominal / Major diameter external (mm)
  p: number; // Pitch P (mm)
  starts: number; // Jumlah kepala ulir (n)
  ph: number; // Lead Ph = n * P (mm)
  ac: number; // Crest clearance ac (mm)
  H: number; // Fundamental triangle height H (mm)
  H1: number; // Basic thread engagement height H1 (mm)
  h3: number; // External thread height h3 (mm)
  H4: number; // Internal thread height H4 (mm)
  d2: number; // Basic pitch diameter d2 = D2 (mm)
  d3: number; // External minor/root diameter d3 (mm)
  D1: number; // Internal minor diameter / Tap drill D1 (mm)
  D4: number; // Internal major diameter D4 (mm)
  f: number; // Crest width f (mm)
  w: number; // Root width / Tool tip width w (mm)
  R1max: number; // Max crest radius R1 (mm)
  R2max: number; // Max root radius R2 (mm)
  leadAngleDeg: number; // Helix / Lead angle lambda (degrees)
  selfLocking: boolean; // True if leadAngleDeg <= frictionAngleDeg
  stressAreaMm2: number; // Tensile stress area As = (pi/4)*((d2+d3)/2)^2 (mm^2)
  coreAreaMm2: number; // Core cross-sectional shear area A_core = (pi/4) * d3^2 (mm^2)
  threadRootShearAreaPerPitchMm2: number; // Cylindrical root shear area per 1 pitch (mm^2)
  maxStaticLoadC45Kn: number; // Max allowable static axial load for C45 based on core shear area (kN)
  maxStaticLoadBronzeKn: number; // Max allowable static axial load for Bronze based on core shear area (kN)
  allowableShearStressMpa: number; // Active material tau_izin (MPa)
  maxStaticLoadActiveKn: number; // Active material max static axial load F_max = A_core * tau_izin (kN)
  maxStaticLoadActiveTon: number; // Active material max static axial load in metric tons (tf)
  bestWireSize: number; // Best wire diameter dw (mm)
  measureOverWires: number; // Nominal M over 3 wires (mm)
  recommendedPasses: number; // Recommended lathe threading passes
  // ISO 2903 Tolerances
  extTolClass: ExternalTolClass;
  intTolClass: InternalTolClass;
  d2Max: number;
  d2Min: number;
  d3Max: number;
  d3Min: number;
  D2Min: number;
  D2Max: number;
  D1Min: number;
  D1Max: number;
  // Dedicated 7e/7H Go/No-Go reference & 3-wire measurement limits (DIN 103 / ISO 2903)
  d2Min7e: number;
  d2Max7e: number;
  D2Min7H: number;
  D2Max7H: number;
  wireMMin7e: number; // Lower Go/No-Go 3-wire limit for 7e (mm)
  wireMMax7e: number; // Upper Go/No-Go 3-wire limit for 7e (mm)
  wireMTarget7e: number; // Midpoint target 3-wire measurement for 7e (mm)
  // Project fields for custom worksheet
  materialGrade: ThreadMaterialGrade;
  appliedLoadKn: number; // Applied static axial load F_kerja (kN)
  loadRatioPct: number; // (appliedLoadKn / maxStaticLoadActiveKn) * 100 (%)
  isLoadSafe: boolean; // True if appliedLoadKn <= maxStaticLoadActiveKn
  frictionMu: number; // Thread friction coefficient mu for selected material
  effectiveFrictionMuPrime: number; // mu' = mu / cos(beta)
  frictionAngleDeg: number; // rho' = atan(mu') in degrees
  threadEfficiencyPct: number; // eta = tan(lambda) / tan(lambda + rho') * 100 (%)
  tighteningTorqueWorkNm: number; // Tightening torque T at appliedLoadKn (N*m)
  tighteningTorqueMaxNm: number; // Tightening torque T_max at maxStaticLoadActiveKn (N*m)
  tighteningTorqueC45WorkNm: number; // Reference tightening torque at appliedLoadKn if C45 (mu=0.15) (N*m)
  tighteningTorqueBronzeWorkNm: number; // Reference tightening torque at appliedLoadKn if Bronze (mu=0.10) (N*m)
  lengthMm?: number;
  material?: string;
  notes?: string;
}

/**
 * All standard pitches P (mm) for Trapezoidal Threads (ISO 2902 / DIN 103 Part 1 & Part 2 / Heavy Engineering)
 */
export const ALL_STANDARD_PITCHES: number[] = [
  1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48,
];

/**
 * Standard crest clearance ac (mm) per ISO 2901 / DIN 103
 */
export function getCrestClearanceAc(p: number): number {
  if (p <= 1.5) return 0.15;
  if (p <= 5) return 0.25;
  if (p <= 12) return 0.5;
  return 1.0;
}

/**
 * Infer ThreadMaterialGrade from a free-text material string if not explicitly provided
 */
export function inferMaterialGrade(text?: string): ThreadMaterialGrade {
  if (!text) return 'C45';
  const upper = text.toUpperCase();
  const hasC45 = upper.includes('C45') || upper.includes('S45C') || upper.includes('ST 60');
  const hasBronze =
    upper.includes('PERUNGGU') ||
    upper.includes('BRONZE') ||
    upper.includes('CUSN') ||
    upper.includes('KUNINGAN');
  if (upper.includes('42CRMO') || upper.includes('SCM440') || upper.includes('VCN')) {
    return '42CRMO4';
  }
  if (upper.includes('SUS') || upper.includes('304') || upper.includes('316')) {
    return 'SUS304';
  }
  if (hasC45 && hasBronze) return 'C45_BRONZE_PAIR';
  if (hasBronze) return 'BRONZE';
  return 'C45';
}

/**
 * Calculate ISO 2903 fundamental deviations and tolerances (in micrometers -> converted to mm)
 */
export function calculateIso2903Tolerances(
  d: number,
  p: number,
  d2: number,
  d3: number,
  D1: number,
  extClass: ExternalTolClass = '7e',
  intClass: InternalTolClass = '7H'
) {
  let esMicrons = 0;
  if (extClass === '7h') {
    esMicrons = 0;
  } else if (extClass === '7e' || extClass === '8e') {
    esMicrons = -(38 + 11 * p);
  } else if (extClass === '8c') {
    esMicrons = -(125 + 19 * p);
  }

  const td2Base6 = 90 * Math.pow(p, 0.4) * Math.pow(d, 0.1);
  const extGradeFactor = extClass.startsWith('7') ? 1.25 : 1.6;
  const intGradeFactor = intClass.startsWith('7') ? 1.68 : 2.12;

  const Td2Microns = Math.round(td2Base6 * extGradeFactor);
  const TD2Microns = Math.round(td2Base6 * intGradeFactor);
  const Td3Microns = Math.round(Td2Microns * 1.25 + Math.abs(esMicrons) * 0.5);
  const TD1Microns = Math.round(180 * Math.pow(p, 0.65));

  const esMm = esMicrons / 1000;
  const Td2Mm = Td2Microns / 1000;
  const TD2Mm = TD2Microns / 1000;
  const Td3Mm = Td3Microns / 1000;
  const TD1Mm = TD1Microns / 1000;

  const d2Max = Number((d2 + esMm).toFixed(3));
  const d2Min = Number((d2Max - Td2Mm).toFixed(3));

  const d3Max = Number((d3 + esMm * 1.25).toFixed(3));
  const d3Min = Number((d3Max - Td3Mm).toFixed(3));

  const D2Min = Number(d2.toFixed(3));
  const D2Max = Number((d2 + TD2Mm).toFixed(3));

  const D1Min = Number(D1.toFixed(3));
  const D1Max = Number((D1 + TD1Mm).toFixed(3));

  return {
    d2Max,
    d2Min,
    d3Max,
    d3Min,
    D2Min,
    D2Max,
    D1Min,
    D1Max,
  };
}

/**
 * Full multi-standard thread calculation for a given diameter d, pitch p, starts n, and threadType:
 * Supports Tr 30° (ISO 2901), Metric M 60° (ISO 68-1), Square Sq 0° (DIN 2781), Buttress S 3°/30° (DIN 513),
 * ACME 29° (ASME B1.5), Unified UNC/UNF 60° (ASME B1.1), Whitworth BSW/BSF 55° (BS 84), and Pipe BSP/NPT.
 */
export function calculateTrThread(
  d: number,
  p: number,
  series: ThreadSeries = 1,
  starts: number = 1,
  extTolClass: ExternalTolClass = '7e',
  intTolClass: InternalTolClass = '7H',
  extra?: {
    id?: string;
    threadType?: ThreadStandardFamily;
    customDesignation?: string;
    tpi?: number;
    angleDegOverride?: number;
    materialGrade?: ThreadMaterialGrade;
    appliedLoadKn?: number;
    frictionMu?: number;
    lengthMm?: number;
    material?: string;
    notes?: string;
  }
): TrCalculatedRow {
  const threadType: ThreadStandardFamily = extra?.threadType || 'TR';
  const famMeta = THREAD_FAMILY_METADATA[threadType] || THREAD_FAMILY_METADATA.TR;
  const threadAngleDeg = extra?.angleDegOverride ?? famMeta.includedAngleDeg;
  const flankHalfAngleDeg =
    threadType === 'BUTTRESS_S'
      ? 3
      : extra?.angleDegOverride
      ? extra.angleDegOverride / 2
      : famMeta.flankLoadHalfAngleDeg;

  const validStarts = Math.max(1, Math.round(starts));
  const ph = Number((validStarts * p).toFixed(3));

  let ac = getCrestClearanceAc(p);
  let H = Number((1.8660254 * p).toFixed(4));
  let H1 = Number((0.5 * p).toFixed(3));
  let h3 = Number((H1 + ac).toFixed(3));
  let H4 = h3;
  let d2 = Number((d - 0.5 * p).toFixed(3));
  let d3 = Number(Math.max(0.5, d - 2 * h3).toFixed(3));
  let D1 = Number(Math.max(0.5, d - 2 * H1).toFixed(3));
  let D4 = Number((d + 2 * ac).toFixed(3));
  let f = Number((0.366025 * p).toFixed(3));
  let w = Number((0.366025 * p - 0.535898 * ac).toFixed(3));
  let R1max = Number((0.5 * ac).toFixed(2));
  let R2max = Number(ac.toFixed(2));
  let bestWireSize = Number((0.5176381 * p).toFixed(3));
  let measureOverWires = Number(
    (d2 - 1.8660254 * p + 4.8637033 * bestWireSize).toFixed(3)
  );

  if (threadType === 'METRIC_M' || threadType === 'UNC_UNF') {
    // ISO 68-1 / DIN 13 & ASME B1.1 60° V-Thread
    H = Number((0.8660254 * p).toFixed(4));
    H1 = Number((0.5412659 * p).toFixed(3)); // (5/8) * H
    ac = Number((0.0721688 * p).toFixed(3)); // H / 12
    h3 = Number((0.6134347 * p).toFixed(3)); // (17/24) * H
    H4 = Number((0.5412659 * p).toFixed(3));
    d2 = Number((d - 0.6495191 * p).toFixed(3));
    d3 = Number(Math.max(0.3, d - 1.2268693 * p).toFixed(3));
    D1 = Number(Math.max(0.3, d - 1.0825318 * p).toFixed(3));
    D4 = Number((d + 2 * ac).toFixed(3));
    f = Number((0.125 * p).toFixed(3)); // P / 8
    w = Number((0.25 * p).toFixed(3)); // P / 4
    R1max = Number((0.072 * p).toFixed(2));
    R2max = Number((0.1443 * p).toFixed(2));
    bestWireSize = Number((0.5773503 * p).toFixed(3));
    measureOverWires = Number(
      (d2 - 0.8660254 * p + 3.0 * bestWireSize).toFixed(3)
    );
  } else if (threadType === 'SQ') {
    // Square Thread 0° (DIN 2781)
    ac = Number((getCrestClearanceAc(p) * 0.5).toFixed(3));
    H = Number(p.toFixed(4));
    H1 = Number((0.5 * p).toFixed(3));
    h3 = Number((0.5 * p + ac).toFixed(3));
    H4 = h3;
    d2 = Number((d - 0.5 * p).toFixed(3));
    d3 = Number(Math.max(0.5, d - 2 * h3).toFixed(3));
    D1 = Number(Math.max(0.5, d - p).toFixed(3));
    D4 = Number((d + 2 * ac).toFixed(3));
    f = Number((0.5 * p).toFixed(3));
    w = Number((0.5 * p).toFixed(3));
    R1max = Number((0.25 * ac).toFixed(2));
    R2max = Number((0.5 * ac).toFixed(2));
    bestWireSize = Number((0.5 * p).toFixed(3));
    measureOverWires = Number((d + 0.5 * p).toFixed(3));
  } else if (threadType === 'BUTTRESS_S') {
    // DIN 513 Buttress Thread (S 3° / 30°)
    H = Number((1.587899 * p).toFixed(4));
    H1 = Number((0.75 * p).toFixed(3));
    ac = Number((0.11777 * p).toFixed(3));
    h3 = Number((0.86777 * p).toFixed(3));
    H4 = H1;
    d2 = Number((d - 0.75 * p).toFixed(3));
    d3 = Number(Math.max(0.5, d - 1.73554 * p).toFixed(3));
    D1 = Number(Math.max(0.5, d - 1.5 * p).toFixed(3));
    D4 = Number((d + 2 * ac).toFixed(3));
    f = Number((0.26384 * p).toFixed(3));
    w = Number((0.19 * p).toFixed(3));
    R1max = Number((0.5 * ac).toFixed(2));
    R2max = Number((0.124 * p).toFixed(2));
    bestWireSize = Number((0.5455 * p).toFixed(3));
    measureOverWires = Number(
      (d2 - 0.75 * p + 3.87 * bestWireSize).toFixed(3)
    );
  } else if (threadType === 'ACME') {
    // ASME B1.5 29° ACME Thread
    ac = p <= 2.54 ? 0.127 : 0.254;
    H = Number((1.933357 * p).toFixed(4));
    H1 = Number((0.5 * p).toFixed(3));
    h3 = Number((0.5 * p + ac).toFixed(3));
    H4 = h3;
    d2 = Number((d - 0.5 * p).toFixed(3));
    d3 = Number(Math.max(0.5, d - 2 * h3).toFixed(3));
    D1 = Number(Math.max(0.5, d - p).toFixed(3));
    D4 = Number((d + 2 * ac).toFixed(3));
    f = Number((0.3707 * p).toFixed(3));
    w = Number((0.3707 * p - 0.5176 * ac).toFixed(3));
    R1max = Number((0.5 * ac).toFixed(2));
    R2max = Number(ac.toFixed(2));
    bestWireSize = Number((0.51645 * p).toFixed(3));
    measureOverWires = Number(
      (d2 - 1.933357 * p + 4.993929 * bestWireSize).toFixed(3)
    );
  } else if (threadType === 'BSW_BSF' || (threadType === 'BSP_NPT' && threadAngleDeg === 55)) {
    // British Standard Whitworth BS 84 & BSP Pipe (alpha = 55°)
    H = Number((0.960491 * p).toFixed(4));
    H1 = Number((0.640327 * p).toFixed(3));
    ac = Number((0.074 * p).toFixed(3));
    h3 = Number((0.640327 * p).toFixed(3));
    H4 = h3;
    d2 = Number((d - 0.640327 * p).toFixed(3));
    d3 = Number(Math.max(0.3, d - 1.280655 * p).toFixed(3));
    D1 = d3;
    D4 = Number((d + 2 * ac).toFixed(3));
    f = Number((0.16008 * p).toFixed(3));
    w = f;
    R1max = Number((0.137329 * p).toFixed(2));
    R2max = R1max;
    bestWireSize = Number((0.563692 * p).toFixed(3));
    measureOverWires = Number(
      (d2 - 0.960491 * p + 3.16568 * bestWireSize).toFixed(3)
    );
  } else if (threadType === 'BSP_NPT' && threadAngleDeg === 60) {
    // American Standard Taper Pipe NPT (ASME B1.20.1, alpha = 60°)
    H = Number((0.8660254 * p).toFixed(4));
    H1 = Number((0.8 * p).toFixed(3));
    ac = Number((0.033 * p).toFixed(3));
    h3 = Number((0.8 * p).toFixed(3));
    H4 = h3;
    d2 = Number((d - 0.8 * p).toFixed(3));
    d3 = Number(Math.max(0.3, d - 1.6 * p).toFixed(3));
    D1 = d3;
    D4 = Number((d + 2 * ac).toFixed(3));
    f = Number((0.038 * p).toFixed(3));
    w = f;
    R1max = Number((0.04 * p).toFixed(2));
    R2max = R1max;
    bestWireSize = Number((0.57735 * p).toFixed(3));
    measureOverWires = Number(
      (d2 - 0.8660254 * p + 3.0 * bestWireSize).toFixed(3)
    );
  }

  const leadAngleRad = Math.atan(ph / (Math.PI * Math.max(1, d2)));
  const leadAngleDeg = Number(((leadAngleRad * 180) / Math.PI).toFixed(2));

  // Tensile stress area As = (pi / 4) * ((d2 + d3) / 2)^2
  const dMean = Math.max(0, (d2 + d3) / 2);
  const stressAreaMm2 = Number(((Math.PI / 4) * dMean * dMean).toFixed(1));

  // Fundamental Core Cross-Sectional Shear Area: A_core = (pi / 4) * d3^2 (mm^2)
  const coreAreaMm2 = Number(((Math.PI / 4) * d3 * d3).toFixed(2));

  // Cylindrical Root Shear Area per 1 Pitch Engagement
  const rootShearFactor = Math.max(0.45, (p - f) / Math.max(0.1, p));
  const threadRootShearAreaPerPitchMm2 = Number(
    (Math.PI * d3 * (rootShearFactor * p)).toFixed(2)
  );

  // Material Grade resolution
  const matGrade: ThreadMaterialGrade =
    extra?.materialGrade || inferMaterialGrade(extra?.material);
  const matSpec = THREAD_MATERIAL_SPECS[matGrade] || THREAD_MATERIAL_SPECS.C45;

  // Max allowable static axial load based on Core Shear Area formula:
  // F_max = A_core * tau_izin (in Newtons -> divide by 1000 for kN)
  const tauC45 = THREAD_MATERIAL_SPECS.C45.allowableShearStressMpa; // 65 MPa
  const tauBronze = THREAD_MATERIAL_SPECS.BRONZE.allowableShearStressMpa; // 30 MPa
  const tauActive = matSpec.allowableShearStressMpa;

  const maxStaticLoadC45Kn = Number(((coreAreaMm2 * tauC45) / 1000).toFixed(2));
  const maxStaticLoadBronzeKn = Number(
    ((coreAreaMm2 * tauBronze) / 1000).toFixed(2)
  );
  const maxStaticLoadActiveKn = Number(
    ((coreAreaMm2 * tauActive) / 1000).toFixed(2)
  );
  // 1 Metric Ton-force (tf) = 9.80665 kN
  const maxStaticLoadActiveTon = Number(
    (maxStaticLoadActiveKn / 9.80665).toFixed(2)
  );

  // Default applied static axial load F_kerja (~60% of active capacity if not specified)
  const appliedLoadKn =
    extra?.appliedLoadKn !== undefined
      ? Math.max(0, Number(extra.appliedLoadKn.toFixed(2)))
      : Number((maxStaticLoadActiveKn * 0.6).toFixed(2));
  const loadRatioPct = Number(
    ((appliedLoadKn / Math.max(0.001, maxStaticLoadActiveKn)) * 100).toFixed(1)
  );
  const isLoadSafe = appliedLoadKn <= maxStaticLoadActiveKn;

  // Thread Friction Coefficient mu & Tightening Torque calculation using flank half-angle beta (mu' = mu / cos(beta))
  const cosBeta = Math.cos((flankHalfAngleDeg * Math.PI) / 180);
  const frictionMu =
    extra?.frictionMu !== undefined && extra.frictionMu > 0
      ? Number(extra.frictionMu.toFixed(3))
      : matSpec.defaultFrictionMu;
  const effectiveFrictionMuPrime = Number((frictionMu / cosBeta).toFixed(4));
  const frictionAngleRad = Math.atan(effectiveFrictionMuPrime);
  const frictionAngleDeg = Number(
    ((frictionAngleRad * 180) / Math.PI).toFixed(2)
  );
  const selfLocking = leadAngleDeg <= frictionAngleDeg;

  const tanLambdaPlusRho = Math.tan(leadAngleRad + frictionAngleRad);
  const threadEfficiencyPct = Number(
    ((Math.tan(leadAngleRad) / Math.max(0.0001, tanLambdaPlusRho)) * 100).toFixed(
      1
    )
  );

  // T_ulir (N*m) = F(N) * (d2(m) / 2) * tan(lambda + rho') = 0.5 * F(kN) * d2(mm) * tan(lambda + rho')
  const tighteningTorqueWorkNm = Number(
    (0.5 * appliedLoadKn * d2 * tanLambdaPlusRho).toFixed(2)
  );
  const tighteningTorqueMaxNm = Number(
    (0.5 * maxStaticLoadActiveKn * d2 * tanLambdaPlusRho).toFixed(2)
  );

  // Reference tightening torques at appliedLoadKn for C45 (mu=0.15) vs Bronze (mu=0.10)
  const rhoC45Rad = Math.atan(
    THREAD_MATERIAL_SPECS.C45.defaultFrictionMu / cosBeta
  );
  const rhoBronzeRad = Math.atan(
    THREAD_MATERIAL_SPECS.BRONZE.defaultFrictionMu / cosBeta
  );
  const tighteningTorqueC45WorkNm = Number(
    (0.5 * appliedLoadKn * d2 * Math.tan(leadAngleRad + rhoC45Rad)).toFixed(2)
  );
  const tighteningTorqueBronzeWorkNm = Number(
    (0.5 * appliedLoadKn * d2 * Math.tan(leadAngleRad + rhoBronzeRad)).toFixed(
      2
    )
  );

  const recommendedPasses = Math.max(5, Math.ceil(h3 / 0.18) + 2);

  const tolerances = calculateIso2903Tolerances(
    d,
    p,
    d2,
    d3,
    D1,
    extTolClass,
    intTolClass
  );

  // Dedicated 7e / 7H reference limits & 3-wire Go/No-Go boundaries
  const tol7e7H =
    extTolClass === '7e' && intTolClass === '7H'
      ? tolerances
      : calculateIso2903Tolerances(d, p, d2, d3, D1, '7e', '7H');
  const wireMMin7e = Number(
    (measureOverWires + (tol7e7H.d2Min - d2)).toFixed(3)
  );
  const wireMMax7e = Number(
    (measureOverWires + (tol7e7H.d2Max - d2)).toFixed(3)
  );
  const wireMTarget7e = Number(((wireMMin7e + wireMMax7e) / 2).toFixed(3));

  let designation = extra?.customDesignation || '';
  if (!designation) {
    const prefix = famMeta.prefix;
    designation =
      validStarts === 1
        ? `${prefix} ${d} x ${p}`
        : `${prefix} ${d} x ${ph} (P${p})`;
  } else if (validStarts > 1 && !designation.includes('(P')) {
    designation = `${designation} (${validStarts}-Start, Ph=${ph})`;
  }

  return {
    id: extra?.id || `${threadType.toLowerCase()}-${d}-${p}-s${series}-n${validStarts}`,
    threadType,
    threadAngleDeg,
    flankHalfAngleDeg,
    tpi: extra?.tpi,
    standardName: famMeta.standardRef,
    designation,
    series,
    d,
    p,
    starts: validStarts,
    ph,
    ac,
    H,
    H1,
    h3,
    H4,
    d2,
    d3,
    D1,
    D4,
    f,
    w,
    R1max,
    R2max,
    leadAngleDeg,
    selfLocking,
    stressAreaMm2,
    coreAreaMm2,
    threadRootShearAreaPerPitchMm2,
    maxStaticLoadC45Kn,
    maxStaticLoadBronzeKn,
    allowableShearStressMpa: tauActive,
    maxStaticLoadActiveKn,
    maxStaticLoadActiveTon,
    bestWireSize,
    measureOverWires,
    recommendedPasses,
    extTolClass,
    intTolClass,
    ...tolerances,
    d2Min7e: tol7e7H.d2Min,
    d2Max7e: tol7e7H.d2Max,
    D2Min7H: tol7e7H.D2Min,
    D2Max7H: tol7e7H.D2Max,
    wireMMin7e,
    wireMMax7e,
    wireMTarget7e,
    materialGrade: matGrade,
    appliedLoadKn,
    loadRatioPct,
    isLoadSafe,
    frictionMu,
    effectiveFrictionMuPrime,
    frictionAngleDeg,
    threadEfficiencyPct,
    tighteningTorqueWorkNm,
    tighteningTorqueMaxNm,
    tighteningTorqueC45WorkNm,
    tighteningTorqueBronzeWorkNm,
    lengthMm: extra?.lengthMm ?? 500,
    material: extra?.material ?? matSpec.label,
    notes: extra?.notes ?? famMeta.standardRef,
  };
}

/**
 * Complete nominal diameters from Tr 8 up to Tr 1120 (ISO 2902, DIN 103 Part 1 & 2, DIN 2781 Heavy Industrial Series)
 */
export const ALL_TR_DIAMETERS: number[] = [
  // Small & Precision Series (Tr 8 .. Tr 30)
  8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 22, 24, 25, 26, 28, 30,
  // Medium Machine Tool Series (Tr 32 .. Tr 100)
  32, 34, 35, 36, 38, 40, 42, 44, 45, 46, 48, 50, 52, 55, 58, 60, 62, 65, 68,
  70, 72, 75, 78, 80, 82, 85, 88, 90, 92, 95, 98, 100,
  // Heavy Machinery Series (Tr 105 .. Tr 300)
  105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175,
  180, 185, 190, 195, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300,
  // Extra-Heavy Press, Turbine, Dam Gate & Marine Series (Tr 310 .. Tr 1120 — DIN 103-2 / DIN 2781 / R20-R40)
  310, 315, 320, 330, 340, 350, 355, 360, 370, 380, 390, 400, 420, 440, 450,
  460, 480, 500, 520, 530, 540, 550, 560, 580, 600, 620, 630, 650, 670, 680,
  700, 710, 720, 750, 780, 800, 820, 850, 880, 900, 920, 950, 980, 1000, 1030,
  1060, 1090, 1120,
];

/**
 * Determine all standard pitches and their Series classification (1 = Utama, 2 = Halus, 3 = Kasar)
 * for every nominal diameter from Tr 8 up to Tr 1120.
 */
function buildCompleteTr8To1120Specs(
  includeAllValidPitches: boolean = false
): TrStandardSpec[] {
  const specs: TrStandardSpec[] = [];

  for (const d of ALL_TR_DIAMETERS) {
    let preferredPitch = 2;
    let allowedPitches: number[] = [];

    if (d === 8) {
      preferredPitch = 1.5;
      allowedPitches = [1.5, 2, 2.5];
    } else if (d >= 9 && d <= 11) {
      preferredPitch = 2;
      allowedPitches = [1.5, 2, 2.5, 3];
    } else if (d >= 12 && d <= 15) {
      preferredPitch = 3;
      allowedPitches = [1.5, 2, 2.5, 3, 4];
    } else if (d >= 16 && d <= 18) {
      preferredPitch = 4;
      allowedPitches = [1.5, 2, 2.5, 3, 4, 5, 6];
    } else if (d === 20) {
      preferredPitch = 4;
      allowedPitches = [1.5, 2, 2.5, 3, 4, 5, 6, 8];
    } else if (d >= 22 && d <= 28) {
      preferredPitch = 5;
      allowedPitches = [2, 2.5, 3, 4, 5, 6, 7, 8, 10];
    } else if (d >= 30 && d <= 36) {
      preferredPitch = 6;
      allowedPitches = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
    } else if (d >= 38 && d <= 44) {
      preferredPitch = 7;
      allowedPitches = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
    } else if (d >= 45 && d <= 52) {
      preferredPitch = 8;
      allowedPitches = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14];
    } else if (d >= 55 && d <= 62) {
      preferredPitch = 9;
      allowedPitches = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
    } else if (d >= 65 && d <= 82) {
      preferredPitch = 10;
      allowedPitches = [3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 18];
    } else if (d >= 85 && d <= 115) {
      preferredPitch = 12;
      allowedPitches = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    } else if (d >= 120 && d <= 145) {
      preferredPitch = 14;
      allowedPitches = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
    } else if (d >= 150 && d <= 175) {
      preferredPitch = 16;
      allowedPitches = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28];
    } else if (d >= 180 && d <= 210) {
      preferredPitch = 18;
      allowedPitches = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32];
    } else if (d >= 220 && d <= 230) {
      preferredPitch = 20;
      allowedPitches = [8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36];
    } else if (d >= 240 && d <= 270) {
      preferredPitch = 22;
      allowedPitches = [8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40];
    } else if (d >= 280 && d <= 340) {
      preferredPitch = 24;
      allowedPitches = [8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44];
    } else if (d >= 350 && d <= 440) {
      preferredPitch = 28;
      allowedPitches = [
        10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48,
      ];
    } else if (d >= 450 && d <= 560) {
      preferredPitch = 32;
      allowedPitches = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48];
    } else if (d >= 580 && d <= 710) {
      preferredPitch = 36;
      allowedPitches = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48];
    } else if (d >= 720 && d <= 900) {
      preferredPitch = 40;
      allowedPitches = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48];
    } else {
      preferredPitch = 44;
      allowedPitches = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48];
    }

    const pitchesToUse = includeAllValidPitches
      ? ALL_STANDARD_PITCHES.filter((p) => {
          const ac = getCrestClearanceAc(p);
          const d3 = d - p - 2 * ac;
          return d3 >= Math.max(3.5, d * 0.35);
        })
      : allowedPitches;

    for (const p of pitchesToUse) {
      const series: ThreadSeries =
        p === preferredPitch ? 1 : p < preferredPitch ? 2 : 3;
      specs.push({ d, p, series });
    }
  }

  return specs;
}

export const ISO_2902_STANDARD_SPECS: TrStandardSpec[] =
  buildCompleteTr8To1120Specs(false);

export const FULL_MATRIX_TR8_TO_1120_SPECS: TrStandardSpec[] =
  buildCompleteTr8To1120Specs(true);

/**
 * Generate initial custom project worksheet items demonstrating C45 vs Bronze static axial load capacity
 */
export function getInitialProjectWorksheet(): TrCalculatedRow[] {
  return [
    calculateTrThread(20, 4, 1, 1, '7e', '7H', {
      id: 'proj-1',
      materialGrade: 'C45',
      appliedLoadKn: 9.5, // Safe for C45 (Fmaks = 13.78 kN -> 68.9% Hijau)
      lengthMm: 450,
      material: THREAD_MATERIAL_SPECS.C45.label,
      notes: 'Poros eretan bubut (Beban 9.5 kN Aman pada C45)',
    }),
    calculateTrThread(20, 4, 1, 1, '7e', '7H', {
      id: 'proj-2',
      materialGrade: 'BRONZE',
      appliedLoadKn: 9.5, // Overload for Bronze (Fmaks = 6.36 kN -> 149.4% Merah!)
      lengthMm: 450,
      material: THREAD_MATERIAL_SPECS.BRONZE.label,
      notes: 'Pembanding Tr 20x4 Perunggu (Beban 9.5 kN Melebihi Kapasitas!)',
    }),
    calculateTrThread(24, 5, 1, 1, '7e', '7H', {
      id: 'proj-3',
      materialGrade: 'C45_BRONZE_PAIR',
      appliedLoadKn: 7.2,
      lengthMm: 680,
      material: THREAD_MATERIAL_SPECS.C45_BRONZE_PAIR.label,
      notes: 'Poros pengangkat meja frais (dibatasi geser mur Perunggu)',
    }),
    calculateTrThread(36, 6, 1, 1, '8e', '7H', {
      id: 'proj-4',
      materialGrade: 'C45',
      appliedLoadKn: 32.0,
      lengthMm: 1200,
      material: THREAD_MATERIAL_SPECS.C45.label,
      notes: 'Spindel tekan dongkrak mekanik (Baja C45)',
    }),
    calculateTrThread(120, 14, 1, 1, '8e', '7H', {
      id: 'proj-5',
      materialGrade: 'C45_BRONZE_PAIR',
      appliedLoadKn: 210.0,
      lengthMm: 2400,
      material: THREAD_MATERIAL_SPECS.C45_BRONZE_PAIR.label,
      notes: 'Spindel pintu air bendungan utama',
    }),
    calculateTrThread(400, 28, 1, 1, '8c', '8H', {
      id: 'proj-6',
      materialGrade: '42CRMO4',
      appliedLoadKn: 8500.0,
      lengthMm: 4500,
      material: THREAD_MATERIAL_SPECS['42CRMO4'].label,
      notes: 'Kolom press tempa hidrolik',
    }),
    calculateTrThread(1120, 44, 1, 1, '8c', '8H', {
      id: 'proj-7',
      materialGrade: 'C45',
      appliedLoadKn: 38000.0,
      lengthMm: 6000,
      material: THREAD_MATERIAL_SPECS.C45.label,
      notes: 'Spindel raksasa Tr 1120 x 44',
    }),
  ];
}

/**
 * Column metadata for the Spreadsheet Formula Bar
 */
export interface ColumnMeta {
  colLetter: string;
  key: keyof TrCalculatedRow;
  label: string;
  symbol: string;
  unit: string;
  formulaExpr: string;
  description: string;
}

export const SPREADSHEET_COLUMNS: ColumnMeta[] = [
  {
    colLetter: 'A',
    key: 'designation',
    label: 'Kode Ulir',
    symbol: 'Tr d × Ph (P)',
    unit: '-',
    formulaExpr: '= "Tr " & d & " x " & (n * P)',
    description: 'Penunjukan standar ulir trapesium sesuai ISO 2901 / DIN 103',
  },
  {
    colLetter: 'B',
    key: 'series',
    label: 'Seri',
    symbol: 'Seri ISO',
    unit: '-',
    formulaExpr: 'ISO 2902 / DIN 103 (1=Utama, 2=Halus, 3=Kasar)',
    description: 'Klasifikasi seri pemilihan pitch (Seri 1=Utama, 2=Halus, 3=Kasar)',
  },
  {
    colLetter: 'C',
    key: 'd',
    label: 'Dia. Luar Baut',
    symbol: 'd',
    unit: 'mm',
    formulaExpr: 'Input Nominal Diameter (d: 8 .. 1120 mm)',
    description: 'Diameter nominal / diameter mayor ulir luar (baut/poros)',
  },
  {
    colLetter: 'D',
    key: 'p',
    label: 'Pitch (Kisar)',
    symbol: 'P',
    unit: 'mm',
    formulaExpr: 'Input Pitch (P: 1.5 .. 48 mm)',
    description: 'Jarak aksial antara dua puncak ulir yang berdekatan',
  },
  {
    colLetter: 'E',
    key: 'ph',
    label: 'Lead (Langkah)',
    symbol: 'Ph',
    unit: 'mm',
    formulaExpr: '= n * P',
    description: 'Jarak maju aksial dalam satu putaran penuh (Ph = jumlah start × P)',
  },
  {
    colLetter: 'F',
    key: 'd2',
    label: 'Dia. Pitch',
    symbol: 'd2 = D2',
    unit: 'mm',
    formulaExpr: '= d - 0.5 * P',
    description: 'Diameter efektif / tengah tempat tebal gigi sama dengan lebar alur',
  },
  {
    colLetter: 'G',
    key: 'd3',
    label: 'Dia. Inti Baut',
    symbol: 'd3',
    unit: 'mm',
    formulaExpr: '= d - 2 * h3 = d - P - 2 * ac',
    description: 'Diameter terkecil (akar) pada ulir luar / baut',
  },
  {
    colLetter: 'H',
    key: 'D1',
    label: 'Dia. Dalam Mur (Bor)',
    symbol: 'D1',
    unit: 'mm',
    formulaExpr: '= d - 2 * H1 = d - P',
    description: 'Diameter dalam mur sekaligus ukuran diameter lubang bor sebelum di-ulir',
  },
  {
    colLetter: 'I',
    key: 'D4',
    label: 'Dia. Luar Mur',
    symbol: 'D4',
    unit: 'mm',
    formulaExpr: '= d + 2 * ac',
    description: 'Diameter dasar alur terdalam pada ulir dalam (mur)',
  },
  {
    colLetter: 'J',
    key: 'H1',
    label: 'Tinggi Kontak',
    symbol: 'H1',
    unit: 'mm',
    formulaExpr: '= 0.5 * P',
    description: 'Tinggi profil kontak efektif antara ulir baut dan mur',
  },
  {
    colLetter: 'K',
    key: 'h3',
    label: 'Tinggi Ulir Baut',
    symbol: 'h3 = H4',
    unit: 'mm',
    formulaExpr: '= H1 + ac = 0.5 * P + ac',
    description: 'Kedalaman total profil ulir yang harus disayat pahat bubut',
  },
  {
    colLetter: 'L',
    key: 'ac',
    label: 'Kelonggaran Puncak',
    symbol: 'ac',
    unit: 'mm',
    formulaExpr: '= IF(P<=1.5, 0.15, IF(P<=5, 0.25, IF(P<=12, 0.5, 1.0)))',
    description: 'Celah bebas (clearance) radial pada puncak dan dasar ulir',
  },
  {
    colLetter: 'M',
    key: 'f',
    label: 'Lebar Puncak',
    symbol: 'f',
    unit: 'mm',
    formulaExpr: '= 0.366 * P',
    description: 'Lebar rata puncak gigi ulir teoritis (0.366 × P)',
  },
  {
    colLetter: 'N',
    key: 'w',
    label: 'Lebar Ujung Pahat',
    symbol: 'w',
    unit: 'mm',
    formulaExpr: '= 0.366 * P - 0.536 * ac',
    description: 'Lebar dasar alur ulir = lebar ujung pahat bubut trapesium 30°',
  },
  {
    colLetter: 'O',
    key: 'd2Min',
    label: 'Batas d2 (Baut)',
    symbol: 'd2 min..max',
    unit: 'mm',
    formulaExpr: '= (d2 + es) - Td2 .. (d2 + es)',
    description: 'Rentang toleransi diameter pitch ulir luar sesuai ISO 2903',
  },
  {
    colLetter: 'P',
    key: 'D2Max',
    label: 'Batas D2 (Mur)',
    symbol: 'D2 min..max',
    unit: 'mm',
    formulaExpr: '= D2 .. (D2 + TD2)',
    description: 'Rentang toleransi diameter pitch ulir dalam (mur) sesuai ISO 2903',
  },
  {
    colLetter: 'Q',
    key: 'bestWireSize',
    label: 'Kawat Uji Terbaik',
    symbol: 'dw',
    unit: 'mm',
    formulaExpr: '= P / (2 * COS(15°)) = 0.517638 * P',
    description: 'Diameter kawat ukur terbaik untuk metode inspeksi 3-kawat pada lingkaran pitch',
  },
  {
    colLetter: 'R',
    key: 'measureOverWires',
    label: 'Ukuran 3-Kawat',
    symbol: 'M',
    unit: 'mm',
    formulaExpr: '= d2 - 1.866025 * P + 4.863703 * dw',
    description: 'Hasil bacaan mikrometer di atas 3 kawat ukur (nominal)',
  },
  {
    colLetter: 'S',
    key: 'leadAngleDeg',
    label: 'Sudut Heliks',
    symbol: 'λ',
    unit: '°',
    formulaExpr: '= DEGREES(ATAN(Ph / (PI() * d2)))',
    description: 'Sudut kemiringan heliks ulir pada diameter pitch',
  },
  {
    colLetter: 'T',
    key: 'coreAreaMm2',
    label: 'Luas Geser Inti',
    symbol: 'Ac = (π/4)·d3²',
    unit: 'mm²',
    formulaExpr: '= (PI() / 4) * (d3 ^ 2)',
    description: 'Luas penampang geser inti ulir (A_inti) sebagai dasar kalkulasi beban statis aksial',
  },
  {
    colLetter: 'U',
    key: 'maxStaticLoadC45Kn',
    label: 'Beban Maks C45',
    symbol: 'Fmaks(C45)',
    unit: 'kN',
    formulaExpr: '= (Ac * τ_izin_C45) / 1000 = ((PI()/4)*d3^2 * 65) / 1000',
    description: 'Beban statis aksial maksimum izin untuk Baja C45 (τ_izin = 65 MPa)',
  },
  {
    colLetter: 'V',
    key: 'maxStaticLoadBronzeKn',
    label: 'Beban Maks Perunggu',
    symbol: 'Fmaks(CuSn12)',
    unit: 'kN',
    formulaExpr: '= (Ac * τ_izin_Perunggu) / 1000 = ((PI()/4)*d3^2 * 30) / 1000',
    description: 'Beban statis aksial maksimum izin untuk Perunggu CuSn12 (τ_izin = 30 MPa)',
  },
];

/**
 * Generate Fanuc G76 / G92 CNC Lathe Threading Code for a selected TrCalculatedRow
 */
export function generateCncGCode(
  row: TrCalculatedRow,
  isInternal: boolean = false,
  spindleRpm: number = 320
): string {
  const threadLength = row.lengthMm ? Math.min(row.lengthMm, 250) : 100;
  const startZ = 8.0;
  const endZ = -threadLength;
  const h3Microns = Math.round(row.h3 * 1000);
  const firstCutMicrons = Math.max(
    80,
    Math.round(h3Microns / Math.sqrt(row.recommendedPasses))
  );

  if (!isInternal) {
    const xApproach = (row.d + 4).toFixed(2);
    const xCore = row.d3.toFixed(3);
    const xRetract = (row.d + 50).toFixed(1);
    return `(PROGRAM CNC BUBUT ULIR LUAR: ${row.designation} - ISO 2901 / DIN 103)
(PAHAT: INSERT TRAPESIUM 30 DERAJAT, LEBAR UJUNG W = ${row.w.toFixed(3)} MM)
(DIAMETER LUAR d = ${row.d.toFixed(2)} MM, DIAMETER INTI d3 = ${xCore} MM)
G21 G40 G99
T0404 (PAHAT ULIR TR 30 DERAJAT)
G97 S${spindleRpm} M03
G00 X${xApproach} Z${startZ.toFixed(1)} M08
(SIKLUS G76 FANUC - PEMAKANAN FLANK INFEED 29 DERAJAT)
G76 P020029 Q50 R0.03
G76 X${xCore} Z${endZ.toFixed(1)} P${h3Microns} Q${firstCutMicrons} F${row.ph.toFixed(3)}
G00 X${xRetract} Z100.0 M09
M05
M30`;
  } else {
    const xApproach = Math.max(4, row.D1 - 2.0).toFixed(2);
    const xMajorInternal = row.D4.toFixed(3);
    return `(PROGRAM CNC BUBUT ULIR DALAM / MUR: ${row.designation} - ISO 2901 / DIN 103)
(BOR AWAL D1 = ${row.D1.toFixed(2)} MM, DIAMETER DALAM MAKS D4 = ${xMajorInternal} MM)
(PAHAT DALAM: TRAPESIUM 30 DERAJAT, LEBAR UJUNG W = ${row.w.toFixed(3)} MM)
G21 G40 G99
T0606 (PAHAT ULIR DALAM TR 30 DERAJAT)
G97 S${Math.round(spindleRpm * 0.85)} M03
G00 X${xApproach} Z${startZ.toFixed(1)} M08
(SIKLUS G76 FANUC ULIR DALAM)
G76 P020029 Q40 R0.03
G76 X${xMajorInternal} Z-${Math.min(threadLength, row.d * 1.5).toFixed(1)} P${h3Microns} Q${firstCutMicrons} F${row.ph.toFixed(3)}
G00 X${xApproach} Z50.0 M09
M05
M30`;
  }
}
