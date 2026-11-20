import type { ThreadSeries } from './trThreadData.ts';

export type ThreadStandardFamily =
  | 'TR'
  | 'METRIC_M'
  | 'SQ'
  | 'BUTTRESS_S'
  | 'ACME'
  | 'UNC_UNF'
  | 'BSW_BSF'
  | 'BSP_NPT';

export interface ThreadFamilyInfo {
  code: ThreadStandardFamily;
  prefix: string;
  shortName: string;
  fullName: string;
  standardRef: string;
  includedAngleDeg: number; // alpha (deg)
  flankLoadHalfAngleDeg: number; // beta (deg) for torque calculation: mu' = mu / cos(beta)
  profileShape: string;
  primaryUse: string;
}

export const THREAD_FAMILY_METADATA: Record<
  ThreadStandardFamily,
  ThreadFamilyInfo
> = {
  TR: {
    code: 'TR',
    prefix: 'Tr',
    shortName: 'Ulir Trapesium (Tr 30°)',
    fullName: 'Ulir Metrik Trapesium ISO 2901–2904 / DIN 103',
    standardRef: 'ISO 2901 / DIN 103 / DIN 2781',
    includedAngleDeg: 30,
    flankLoadHalfAngleDeg: 15,
    profileShape: 'Trapesium Simetris 30°',
    primaryUse: 'Spindel mesin bubut/frais, aktuator linier, pintu air, press hidrolik',
  },
  METRIC_M: {
    code: 'METRIC_M',
    prefix: 'M',
    shortName: 'Ulir Metrik Segitiga (M 60°)',
    fullName: 'Ulir Metrik Segitiga ISO 68-1 / ISO 261 / DIN 13',
    standardRef: 'ISO 68-1 / ISO 261 / DIN 13',
    includedAngleDeg: 60,
    flankLoadHalfAngleDeg: 30,
    profileShape: 'Segitiga V-Metrik 60°',
    primaryUse: 'Baut & mur pengikat konstruksi mesin standar (Kasar & Halus)',
  },
  SQ: {
    code: 'SQ',
    prefix: 'Sq',
    shortName: 'Ulir Persegi / Square (Sq 0°)',
    fullName: 'Ulir Persegi (Square Power Screw) DIN 2781',
    standardRef: 'DIN 2781 / Standar Transmisi Daya',
    includedAngleDeg: 0,
    flankLoadHalfAngleDeg: 0,
    profileShape: 'Persegi Tegak Lurus 0°',
    primaryUse: 'Dongkrak beban berat, ragum presisi, katup utama (efisiensi tertinggi, tanpa gaya radial)',
  },
  BUTTRESS_S: {
    code: 'BUTTRESS_S',
    prefix: 'S',
    shortName: 'Ulir Gergaji / Buttress (S 3°/30°)',
    fullName: 'Ulir Gergaji Metrik (Buttress Thread) DIN 513 / ISO 2901',
    standardRef: 'DIN 513 / DIN 514 / DIN 2781',
    includedAngleDeg: 33,
    flankLoadHalfAngleDeg: 3,
    profileShape: 'Asimetris Gergaji (Sisi Beban 3° + Sisi Belakang 30°)',
    primaryUse: 'Beban kejut aksial searah ekstra tinggi (mesin tempa, injeksi, pengait kait derek)',
  },
  ACME: {
    code: 'ACME',
    prefix: 'ACME',
    shortName: 'Ulir ACME Amerika (29°)',
    fullName: 'American Standard Trapezoidal ACME Thread ASME B1.5',
    standardRef: 'ASME / ANSI B1.5',
    includedAngleDeg: 29,
    flankLoadHalfAngleDeg: 14.5,
    profileShape: 'Trapesium Inci Amerika 29°',
    primaryUse: 'Lead screw mesin perkakas Amerika, katup industri, aktuator mekanis',
  },
  UNC_UNF: {
    code: 'UNC_UNF',
    prefix: 'UN',
    shortName: 'Ulir Unified Inci (UNC / UNF 60°)',
    fullName: 'Unified National Coarse (UNC) & Fine (UNF) ASME B1.1',
    standardRef: 'ASME / ANSI B1.1',
    includedAngleDeg: 60,
    flankLoadHalfAngleDeg: 30,
    profileShape: 'Segitiga V-Unified 60° (Berbasis TPI)',
    primaryUse: 'Baut pengikat otomotif, kedirgantaraan, alat berat, dan permesinan standar Amerika',
  },
  BSW_BSF: {
    code: 'BSW_BSF',
    prefix: 'BSW',
    shortName: 'Ulir Whitworth Inci (BSW / BSF 55°)',
    fullName: 'British Standard Whitworth (BSW) & Fine (BSF) BS 84',
    standardRef: 'BS 84 (Sudut Puncak 55° Membulat)',
    includedAngleDeg: 55,
    flankLoadHalfAngleDeg: 27.5,
    profileShape: 'Segitiga 55° dengan Puncak & Lembah Membulat (r = 0.1373·P)',
    primaryUse: 'Mesin industri Inggris, konstruksi perkapalan, dan peralatan klasik',
  },
  BSP_NPT: {
    code: 'BSP_NPT',
    prefix: 'G/NPT',
    shortName: 'Ulir Pipa & Hidrolik (G / R / NPT)',
    fullName: 'Ulir Pipa British Standard Pipe (G / BSP 55°) & American NPT (60°)',
    standardRef: 'ISO 228-1 (G) / ISO 7-1 (R) / ASME B1.20.1 (NPT)',
    includedAngleDeg: 55,
    flankLoadHalfAngleDeg: 27.5,
    profileShape: 'Ulir Pipa Silindris/Tirus 55° (BSP) & 60° (NPT)',
    primaryUse: 'Fitting hidrolik, pneumatik, perpipaan fluida bertekanan, dan katup proses',
  },
};

export interface MultiThreadSpecItem {
  threadType: ThreadStandardFamily;
  designation: string;
  d: number; // Major diameter in mm
  p: number; // Pitch in mm
  tpi?: number; // Threads per inch (for ACME, UNC/UNF, BSW/BSF, BSP/NPT)
  series: ThreadSeries; // 1 = Utama/Coarse, 2 = Halus/Fine, 3 = Kasar/Extra
  angleDeg?: number; // Override angle (e.g., 60 deg for NPT inside BSP_NPT)
}

/**
 * 1. ULIR METRIK SEGITIGA ISO (M1 s/d M300 — ISO 68-1 / ISO 261 / DIN 13, alpha = 60 deg)
 * Series 1 = Coarse (Kasar), Series 2 = Fine (Halus)
 */
export const METRIC_M_SPECS: MultiThreadSpecItem[] = [
  // Micro & Small Metric
  { threadType: 'METRIC_M', designation: 'M 2 x 0.4', d: 2, p: 0.4, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 2.5 x 0.45', d: 2.5, p: 0.45, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 3 x 0.5', d: 3, p: 0.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 3 x 0.35 (Halus)', d: 3, p: 0.35, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 4 x 0.7', d: 4, p: 0.7, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 4 x 0.5 (Halus)', d: 4, p: 0.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 5 x 0.8', d: 5, p: 0.8, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 5 x 0.5 (Halus)', d: 5, p: 0.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 6 x 1', d: 6, p: 1.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 6 x 0.75 (Halus)', d: 6, p: 0.75, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 8 x 1.25', d: 8, p: 1.25, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 8 x 1 (Halus)', d: 8, p: 1.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 8 x 0.75 (Halus)', d: 8, p: 0.75, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 10 x 1.5', d: 10, p: 1.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 10 x 1.25 (Halus)', d: 10, p: 1.25, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 10 x 1 (Halus)', d: 10, p: 1.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 12 x 1.75', d: 12, p: 1.75, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 12 x 1.5 (Halus)', d: 12, p: 1.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 12 x 1.25 (Halus)', d: 12, p: 1.25, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 14 x 2', d: 14, p: 2.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 14 x 1.5 (Halus)', d: 14, p: 1.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 16 x 2', d: 16, p: 2.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 16 x 1.5 (Halus)', d: 16, p: 1.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 18 x 2.5', d: 18, p: 2.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 18 x 1.5 (Halus)', d: 18, p: 1.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 20 x 2.5', d: 20, p: 2.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 20 x 1.5 (Halus)', d: 20, p: 1.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 22 x 2.5', d: 22, p: 2.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 22 x 1.5 (Halus)', d: 22, p: 1.5, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 24 x 3', d: 24, p: 3.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 24 x 2 (Halus)', d: 24, p: 2.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 27 x 3', d: 27, p: 3.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 27 x 2 (Halus)', d: 27, p: 2.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 30 x 3.5', d: 30, p: 3.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 30 x 2 (Halus)', d: 30, p: 2.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 33 x 3.5', d: 33, p: 3.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 33 x 2 (Halus)', d: 33, p: 2.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 36 x 4', d: 36, p: 4.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 36 x 3 (Halus)', d: 36, p: 3.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 39 x 4', d: 39, p: 4.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 42 x 4.5', d: 42, p: 4.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 42 x 3 (Halus)', d: 42, p: 3.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 45 x 4.5', d: 45, p: 4.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 48 x 5', d: 48, p: 5.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 48 x 3 (Halus)', d: 48, p: 3.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 52 x 5', d: 52, p: 5.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 56 x 5.5', d: 56, p: 5.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 60 x 5.5', d: 60, p: 5.5, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 64 x 6', d: 64, p: 6.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 68 x 6', d: 68, p: 6.0, series: 1 },
  { threadType: 'METRIC_M', designation: 'M 72 x 6 (Halus)', d: 72, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 80 x 6 (Halus)', d: 80, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 90 x 6 (Halus)', d: 90, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 100 x 6 (Halus)', d: 100, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 110 x 6 (Halus)', d: 110, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 120 x 6 (Halus)', d: 120, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 140 x 6 (Halus)', d: 140, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 160 x 6 (Halus)', d: 160, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 200 x 6 (Halus)', d: 200, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 250 x 6 (Halus)', d: 250, p: 6.0, series: 2 },
  { threadType: 'METRIC_M', designation: 'M 300 x 6 (Halus)', d: 300, p: 6.0, series: 2 },
];

/**
 * 2. ULIR PERSEGI / SQUARE THREAD (Sq 10 s/d Sq 400 — alpha = 0 deg)
 */
export const SQUARE_SQ_SPECS: MultiThreadSpecItem[] = [
  { threadType: 'SQ', designation: 'Sq 10 x 2', d: 10, p: 2, series: 1 },
  { threadType: 'SQ', designation: 'Sq 12 x 3', d: 12, p: 3, series: 1 },
  { threadType: 'SQ', designation: 'Sq 16 x 4', d: 16, p: 4, series: 1 },
  { threadType: 'SQ', designation: 'Sq 20 x 4', d: 20, p: 4, series: 1 },
  { threadType: 'SQ', designation: 'Sq 22 x 5', d: 22, p: 5, series: 1 },
  { threadType: 'SQ', designation: 'Sq 24 x 5', d: 24, p: 5, series: 1 },
  { threadType: 'SQ', designation: 'Sq 28 x 6', d: 28, p: 6, series: 1 },
  { threadType: 'SQ', designation: 'Sq 30 x 6', d: 30, p: 6, series: 1 },
  { threadType: 'SQ', designation: 'Sq 32 x 6', d: 32, p: 6, series: 1 },
  { threadType: 'SQ', designation: 'Sq 36 x 7', d: 36, p: 7, series: 1 },
  { threadType: 'SQ', designation: 'Sq 40 x 7', d: 40, p: 7, series: 1 },
  { threadType: 'SQ', designation: 'Sq 44 x 8', d: 44, p: 8, series: 1 },
  { threadType: 'SQ', designation: 'Sq 50 x 8', d: 50, p: 8, series: 1 },
  { threadType: 'SQ', designation: 'Sq 55 x 9', d: 55, p: 9, series: 1 },
  { threadType: 'SQ', designation: 'Sq 60 x 9', d: 60, p: 9, series: 1 },
  { threadType: 'SQ', designation: 'Sq 70 x 10', d: 70, p: 10, series: 1 },
  { threadType: 'SQ', designation: 'Sq 80 x 10', d: 80, p: 10, series: 1 },
  { threadType: 'SQ', designation: 'Sq 90 x 12', d: 90, p: 12, series: 1 },
  { threadType: 'SQ', designation: 'Sq 100 x 12', d: 100, p: 12, series: 1 },
  { threadType: 'SQ', designation: 'Sq 120 x 14', d: 120, p: 14, series: 1 },
  { threadType: 'SQ', designation: 'Sq 150 x 16', d: 150, p: 16, series: 1 },
  { threadType: 'SQ', designation: 'Sq 200 x 18', d: 200, p: 18, series: 1 },
  { threadType: 'SQ', designation: 'Sq 250 x 22', d: 250, p: 22, series: 1 },
  { threadType: 'SQ', designation: 'Sq 300 x 26', d: 300, p: 26, series: 1 },
  { threadType: 'SQ', designation: 'Sq 400 x 32', d: 400, p: 32, series: 1 },
];

/**
 * 3. ULIR GERGAJI / BUTTRESS THREAD (S 12 s/d S 500 — DIN 513, 3 deg / 30 deg)
 */
export const BUTTRESS_S_SPECS: MultiThreadSpecItem[] = [
  { threadType: 'BUTTRESS_S', designation: 'S 12 x 3', d: 12, p: 3, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 16 x 4', d: 16, p: 4, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 20 x 4', d: 20, p: 4, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 24 x 5', d: 24, p: 5, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 28 x 5', d: 28, p: 5, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 30 x 6', d: 30, p: 6, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 36 x 6', d: 36, p: 6, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 40 x 7', d: 40, p: 7, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 44 x 7', d: 44, p: 7, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 50 x 8', d: 50, p: 8, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 60 x 9', d: 60, p: 9, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 70 x 10', d: 70, p: 10, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 80 x 10', d: 80, p: 10, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 90 x 12', d: 90, p: 12, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 100 x 12', d: 100, p: 12, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 120 x 14', d: 120, p: 14, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 150 x 16', d: 150, p: 16, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 200 x 20', d: 200, p: 20, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 250 x 24', d: 250, p: 24, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 300 x 28', d: 300, p: 28, series: 1 },
  { threadType: 'BUTTRESS_S', designation: 'S 400 x 36', d: 400, p: 36, series: 3 },
  { threadType: 'BUTTRESS_S', designation: 'S 500 x 44', d: 500, p: 44, series: 3 },
];

/**
 * 4. ULIR TRAPESIUM AMERIKA (ACME — ASME B1.5, alpha = 29 deg)
 */
export const ACME_SPECS: MultiThreadSpecItem[] = [
  { threadType: 'ACME', designation: '1/4" - 16 ACME', d: 6.35, p: Number((25.4 / 16).toFixed(3)), tpi: 16, series: 1 },
  { threadType: 'ACME', designation: '5/16" - 14 ACME', d: 7.938, p: Number((25.4 / 14).toFixed(3)), tpi: 14, series: 1 },
  { threadType: 'ACME', designation: '3/8" - 12 ACME', d: 9.525, p: Number((25.4 / 12).toFixed(3)), tpi: 12, series: 1 },
  { threadType: 'ACME', designation: '1/2" - 10 ACME', d: 12.7, p: 2.54, tpi: 10, series: 1 },
  { threadType: 'ACME', designation: '5/8" - 8 ACME', d: 15.875, p: 3.175, tpi: 8, series: 1 },
  { threadType: 'ACME', designation: '3/4" - 6 ACME', d: 19.05, p: Number((25.4 / 6).toFixed(3)), tpi: 6, series: 1 },
  { threadType: 'ACME', designation: '7/8" - 6 ACME', d: 22.225, p: Number((25.4 / 6).toFixed(3)), tpi: 6, series: 1 },
  { threadType: 'ACME', designation: '1" - 5 ACME', d: 25.4, p: 5.08, tpi: 5, series: 1 },
  { threadType: 'ACME', designation: '1-1/8" - 5 ACME', d: 28.575, p: 5.08, tpi: 5, series: 1 },
  { threadType: 'ACME', designation: '1-1/4" - 5 ACME', d: 31.75, p: 5.08, tpi: 5, series: 1 },
  { threadType: 'ACME', designation: '1-3/8" - 4 ACME', d: 34.925, p: 6.35, tpi: 4, series: 1 },
  { threadType: 'ACME', designation: '1-1/2" - 4 ACME', d: 38.1, p: 6.35, tpi: 4, series: 1 },
  { threadType: 'ACME', designation: '1-3/4" - 4 ACME', d: 44.45, p: 6.35, tpi: 4, series: 1 },
  { threadType: 'ACME', designation: '2" - 4 ACME', d: 50.8, p: 6.35, tpi: 4, series: 1 },
  { threadType: 'ACME', designation: '2-1/4" - 3 ACME', d: 57.15, p: Number((25.4 / 3).toFixed(3)), tpi: 3, series: 1 },
  { threadType: 'ACME', designation: '2-1/2" - 3 ACME', d: 63.5, p: Number((25.4 / 3).toFixed(3)), tpi: 3, series: 1 },
  { threadType: 'ACME', designation: '3" - 2 ACME', d: 76.2, p: 12.7, tpi: 2, series: 1 },
  { threadType: 'ACME', designation: '4" - 2 ACME', d: 101.6, p: 12.7, tpi: 2, series: 1 },
  { threadType: 'ACME', designation: '5" - 2 ACME', d: 127.0, p: 12.7, tpi: 2, series: 1 },
];

/**
 * 5. ULIR UNIFIED INCI (UNC & UNF — ASME B1.1, alpha = 60 deg)
 */
export const UNC_UNF_SPECS: MultiThreadSpecItem[] = [
  { threadType: 'UNC_UNF', designation: '1/4" - 20 UNC', d: 6.35, p: 1.27, tpi: 20, series: 1 },
  { threadType: 'UNC_UNF', designation: '1/4" - 28 UNF', d: 6.35, p: Number((25.4 / 28).toFixed(3)), tpi: 28, series: 2 },
  { threadType: 'UNC_UNF', designation: '5/16" - 18 UNC', d: 7.938, p: Number((25.4 / 18).toFixed(3)), tpi: 18, series: 1 },
  { threadType: 'UNC_UNF', designation: '5/16" - 24 UNF', d: 7.938, p: Number((25.4 / 24).toFixed(3)), tpi: 24, series: 2 },
  { threadType: 'UNC_UNF', designation: '3/8" - 16 UNC', d: 9.525, p: Number((25.4 / 16).toFixed(3)), tpi: 16, series: 1 },
  { threadType: 'UNC_UNF', designation: '3/8" - 24 UNF', d: 9.525, p: Number((25.4 / 24).toFixed(3)), tpi: 24, series: 2 },
  { threadType: 'UNC_UNF', designation: '7/16" - 14 UNC', d: 11.112, p: Number((25.4 / 14).toFixed(3)), tpi: 14, series: 1 },
  { threadType: 'UNC_UNF', designation: '7/16" - 20 UNF', d: 11.112, p: 1.27, tpi: 20, series: 2 },
  { threadType: 'UNC_UNF', designation: '1/2" - 13 UNC', d: 12.7, p: Number((25.4 / 13).toFixed(3)), tpi: 13, series: 1 },
  { threadType: 'UNC_UNF', designation: '1/2" - 20 UNF', d: 12.7, p: 1.27, tpi: 20, series: 2 },
  { threadType: 'UNC_UNF', designation: '5/8" - 11 UNC', d: 15.875, p: Number((25.4 / 11).toFixed(3)), tpi: 11, series: 1 },
  { threadType: 'UNC_UNF', designation: '5/8" - 18 UNF', d: 15.875, p: Number((25.4 / 18).toFixed(3)), tpi: 18, series: 2 },
  { threadType: 'UNC_UNF', designation: '3/4" - 10 UNC', d: 19.05, p: 2.54, tpi: 10, series: 1 },
  { threadType: 'UNC_UNF', designation: '3/4" - 16 UNF', d: 19.05, p: Number((25.4 / 16).toFixed(3)), tpi: 16, series: 2 },
  { threadType: 'UNC_UNF', designation: '7/8" - 9 UNC', d: 22.225, p: Number((25.4 / 9).toFixed(3)), tpi: 9, series: 1 },
  { threadType: 'UNC_UNF', designation: '7/8" - 14 UNF', d: 22.225, p: Number((25.4 / 14).toFixed(3)), tpi: 14, series: 2 },
  { threadType: 'UNC_UNF', designation: '1" - 8 UNC', d: 25.4, p: 3.175, tpi: 8, series: 1 },
  { threadType: 'UNC_UNF', designation: '1" - 12 UNF', d: 25.4, p: Number((25.4 / 12).toFixed(3)), tpi: 12, series: 2 },
  { threadType: 'UNC_UNF', designation: '1-1/4" - 7 UNC', d: 31.75, p: Number((25.4 / 7).toFixed(3)), tpi: 7, series: 1 },
  { threadType: 'UNC_UNF', designation: '1-1/2" - 6 UNC', d: 38.1, p: Number((25.4 / 6).toFixed(3)), tpi: 6, series: 1 },
  { threadType: 'UNC_UNF', designation: '2" - 4.5 UNC', d: 50.8, p: Number((25.4 / 4.5).toFixed(3)), tpi: 4.5, series: 1 },
  { threadType: 'UNC_UNF', designation: '3" - 4 UNC', d: 76.2, p: 6.35, tpi: 4, series: 1 },
  { threadType: 'UNC_UNF', designation: '4" - 4 UNC', d: 101.6, p: 6.35, tpi: 4, series: 1 },
];

/**
 * 6. ULIR WHITWORTH INCI (BSW & BSF — BS 84, alpha = 55 deg)
 */
export const BSW_BSF_SPECS: MultiThreadSpecItem[] = [
  { threadType: 'BSW_BSF', designation: '1/4" - 20 BSW', d: 6.35, p: 1.27, tpi: 20, series: 1 },
  { threadType: 'BSW_BSF', designation: '5/16" - 18 BSW', d: 7.938, p: Number((25.4 / 18).toFixed(3)), tpi: 18, series: 1 },
  { threadType: 'BSW_BSF', designation: '3/8" - 16 BSW', d: 9.525, p: Number((25.4 / 16).toFixed(3)), tpi: 16, series: 1 },
  { threadType: 'BSW_BSF', designation: '1/2" - 12 BSW', d: 12.7, p: Number((25.4 / 12).toFixed(3)), tpi: 12, series: 1 },
  { threadType: 'BSW_BSF', designation: '1/2" - 16 BSF', d: 12.7, p: Number((25.4 / 16).toFixed(3)), tpi: 16, series: 2 },
  { threadType: 'BSW_BSF', designation: '5/8" - 11 BSW', d: 15.875, p: Number((25.4 / 11).toFixed(3)), tpi: 11, series: 1 },
  { threadType: 'BSW_BSF', designation: '3/4" - 10 BSW', d: 19.05, p: 2.54, tpi: 10, series: 1 },
  { threadType: 'BSW_BSF', designation: '7/8" - 9 BSW', d: 22.225, p: Number((25.4 / 9).toFixed(3)), tpi: 9, series: 1 },
  { threadType: 'BSW_BSF', designation: '1" - 8 BSW', d: 25.4, p: 3.175, tpi: 8, series: 1 },
  { threadType: 'BSW_BSF', designation: '1-1/4" - 7 BSW', d: 31.75, p: Number((25.4 / 7).toFixed(3)), tpi: 7, series: 1 },
  { threadType: 'BSW_BSF', designation: '1-1/2" - 6 BSW', d: 38.1, p: Number((25.4 / 6).toFixed(3)), tpi: 6, series: 1 },
  { threadType: 'BSW_BSF', designation: '2" - 4.5 BSW', d: 50.8, p: Number((25.4 / 4.5).toFixed(3)), tpi: 4.5, series: 1 },
  { threadType: 'BSW_BSF', designation: '3" - 3.5 BSW', d: 76.2, p: Number((25.4 / 3.5).toFixed(3)), tpi: 3.5, series: 1 },
];

/**
 * 7. ULIR PIPA & HIDROLIK (BSPP G / BSPT R 55 deg & NPT 60 deg)
 */
export const BSP_NPT_SPECS: MultiThreadSpecItem[] = [
  // BSP (ISO 228-1 / ISO 7-1, 55 deg)
  { threadType: 'BSP_NPT', designation: 'G 1/8" - 28 BSP', d: 9.728, p: 0.907, tpi: 28, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 1/4" - 19 BSP', d: 13.157, p: 1.337, tpi: 19, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 3/8" - 19 BSP', d: 16.662, p: 1.337, tpi: 19, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 1/2" - 14 BSP', d: 20.955, p: 1.814, tpi: 14, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 3/4" - 14 BSP', d: 26.441, p: 1.814, tpi: 14, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 1" - 11 BSP', d: 33.249, p: 2.309, tpi: 11, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 1-1/4" - 11 BSP', d: 41.91, p: 2.309, tpi: 11, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 1-1/2" - 11 BSP', d: 47.803, p: 2.309, tpi: 11, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 2" - 11 BSP', d: 59.614, p: 2.309, tpi: 11, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 3" - 11 BSP', d: 87.884, p: 2.309, tpi: 11, series: 1, angleDeg: 55 },
  { threadType: 'BSP_NPT', designation: 'G 4" - 11 BSP', d: 113.03, p: 2.309, tpi: 11, series: 1, angleDeg: 55 },
  // NPT (ASME B1.20.1, 60 deg)
  { threadType: 'BSP_NPT', designation: '1/8" - 27 NPT', d: 10.287, p: 0.941, tpi: 27, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '1/4" - 18 NPT', d: 13.716, p: 1.411, tpi: 18, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '3/8" - 18 NPT', d: 17.145, p: 1.411, tpi: 18, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '1/2" - 14 NPT', d: 21.336, p: 1.814, tpi: 14, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '3/4" - 14 NPT', d: 26.67, p: 1.814, tpi: 14, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '1" - 11.5 NPT', d: 33.401, p: 2.209, tpi: 11.5, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '1-1/2" - 11.5 NPT', d: 48.26, p: 2.209, tpi: 11.5, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '2" - 11.5 NPT', d: 60.325, p: 2.209, tpi: 11.5, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '3" - 8 NPT', d: 88.9, p: 3.175, tpi: 8, series: 2, angleDeg: 60 },
  { threadType: 'BSP_NPT', designation: '4" - 8 NPT', d: 114.3, p: 3.175, tpi: 8, series: 2, angleDeg: 60 },
];

export const ALL_NON_TR_SPECS: MultiThreadSpecItem[] = [
  ...METRIC_M_SPECS,
  ...SQUARE_SQ_SPECS,
  ...BUTTRESS_S_SPECS,
  ...ACME_SPECS,
  ...UNC_UNF_SPECS,
  ...BSW_BSF_SPECS,
  ...BSP_NPT_SPECS,
];
