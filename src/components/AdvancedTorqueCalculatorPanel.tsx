import React, { useState, useEffect, useMemo } from 'react';
import { Wrench, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { TrCalculatedRow, THREAD_MATERIAL_SPECS } from '../data/trThreadData';

export type BoltLubricantId =
  | 'MOS2_PASTE'
  | 'PTFE_SYNTHETIC'
  | 'ANTI_SEIZE_PASTE'
  | 'OIL_BRONZE_PAIR'
  | 'LITHIUM_EP_GREASE'
  | 'LIGHT_MACHINE_OIL'
  | 'DRY_STEEL_BRONZE'
  | 'DRY_UNLUBRICATED';

export interface BoltLubricantSpec {
  id: BoltLubricantId;
  name: string;
  shortName: string;
  category: 'Pelumas Padat / Pasta EP' | 'Oli & Gemuk Industri' | 'Kondisi Kering (Dry)';
  muThreadNominal: number;
  muThreadMin: number;
  muThreadMax: number;
  muCollarNominal: number;
  tempRange: string;
  description: string;
}

export const BOLT_LUBRICANT_SPECS: BoltLubricantSpec[] = [
  {
    id: 'MOS2_PASTE',
    name: 'Molybdenum Disulfide (MoS₂) Paste',
    shortName: 'MoS₂ Paste',
    category: 'Pelumas Padat / Pasta EP',
    muThreadNominal: 0.06,
    muThreadMin: 0.05,
    muThreadMax: 0.08,
    muCollarNominal: 0.07,
    tempRange: '-35°C s/d +400°C',
    description:
      'Pasta pelumas padat MoS₂ tekanan ekstrem (Extreme Pressure); meminimalkan torsi pengencangan & mencegah stick-slip pada beban aksial tinggi.',
  },
  {
    id: 'PTFE_SYNTHETIC',
    name: 'Pelumas Sintetis PTFE / Teflon Film',
    shortName: 'PTFE / Teflon',
    category: 'Pelumas Padat / Pasta EP',
    muThreadNominal: 0.07,
    muThreadMin: 0.06,
    muThreadMax: 0.09,
    muCollarNominal: 0.08,
    tempRange: '-40°C s/d +250°C',
    description:
      'Lapisan pelumas kering/semi-basah berbasis Polytetrafluoroethylene untuk mekanisme aktuator presisi bersih.',
  },
  {
    id: 'ANTI_SEIZE_PASTE',
    name: 'Anti-Seize Paste (Copper / Nickel / Graphite)',
    shortName: 'Anti-Seize Paste',
    category: 'Pelumas Padat / Pasta EP',
    muThreadNominal: 0.09,
    muThreadMin: 0.08,
    muThreadMax: 0.11,
    muCollarNominal: 0.10,
    tempRange: '-30°C s/d +1100°C',
    description:
      'Pasta anti-macet logam (tembaga/nikel/grafit) untuk mencegah galling & cold-welding pada baut/spindel ulir besar atau temperatur tinggi.',
  },
  {
    id: 'OIL_BRONZE_PAIR',
    name: 'Oli Roda Gigi / Hidrolik ISO VG 68 (Baja–Perunggu)',
    shortName: 'Oli ISO VG 68',
    category: 'Oli & Gemuk Industri',
    muThreadNominal: 0.10,
    muThreadMin: 0.09,
    muThreadMax: 0.12,
    muCollarNominal: 0.10,
    tempRange: '-10°C s/d +120°C',
    description:
      'Pelumasan oli mineral/sintetis standar untuk pasangan spindel Baja C45 dengan mur Perunggu CuSn12.',
  },
  {
    id: 'LITHIUM_EP_GREASE',
    name: 'Gemuk Lithium Kompleks EP2 (Multi-Purpose Grease)',
    shortName: 'Gemuk Lithium EP2',
    category: 'Oli & Gemuk Industri',
    muThreadNominal: 0.12,
    muThreadMin: 0.10,
    muThreadMax: 0.14,
    muCollarNominal: 0.12,
    tempRange: '-20°C s/d +140°C',
    description:
      'Gemuk industri standar bengkel untuk ulir penggerak mesin perkakas, ragum, dan dongkrak mekanis.',
  },
  {
    id: 'LIGHT_MACHINE_OIL',
    name: 'Oli Mesin Tipis / Pelumas Proteksi Pabrik (Baja–Baja)',
    shortName: 'Oli Tipis (C45)',
    category: 'Oli & Gemuk Industri',
    muThreadNominal: 0.15,
    muThreadMin: 0.13,
    muThreadMax: 0.17,
    muCollarNominal: 0.15,
    tempRange: '0°C s/d +100°C',
    description:
      'Kondisi ulir Baja Karbon C45 dengan sedikit lapisan oli proteksi standar konstruksi mesin.',
  },
  {
    id: 'DRY_STEEL_BRONZE',
    name: 'Kondisi Kering Tanpa Pelumas (Baja terhadap Perunggu)',
    shortName: 'Kering (Baja–Perunggu)',
    category: 'Kondisi Kering (Dry)',
    muThreadNominal: 0.18,
    muThreadMin: 0.16,
    muThreadMax: 0.22,
    muCollarNominal: 0.18,
    tempRange: 'Ruang Kering',
    description:
      'Kontak kering tanpa pelumas antara poros baja dan mur perunggu; torsi naik signifikan dibanding kondisi terlumasi.',
  },
  {
    id: 'DRY_UNLUBRICATED',
    name: 'Kondisi Kering Logam-ke-Logam (Baja–Baja / SUS 304)',
    shortName: 'Kering (Baja–Baja)',
    category: 'Kondisi Kering (Dry)',
    muThreadNominal: 0.24,
    muThreadMin: 0.20,
    muThreadMax: 0.30,
    muCollarNominal: 0.25,
    tempRange: 'Kering / Korosif',
    description:
      'Kondisi kering bersih atau teroksidasi tanpa pelumas sama sekali; gesekan sangat tinggi dan rawan lecet (galling).',
  },
];

interface AdvancedTorqueCalculatorPanelProps {
  row: TrCalculatedRow;
  onApplyTorqueSettingsToProject?: (
    frictionMu: number,
    appliedLoadKn: number,
    lubricantName: string
  ) => void;
}

export const AdvancedTorqueCalculatorPanel: React.FC<
  AdvancedTorqueCalculatorPanelProps
> = ({ row, onApplyTorqueSettingsToProject }) => {
  const [selectedLubricantId, setSelectedLubricantId] =
    useState<BoltLubricantId>('MOS2_PASTE');
  const [customMuThread, setCustomMuThread] = useState<number>(0.06);
  const [customMuCollar, setCustomMuCollar] = useState<number>(0.07);
  const [includeCollarFriction, setIncludeCollarFriction] =
    useState<boolean>(true);
  const [collarMeanDiaMm, setCollarMeanDiaMm] = useState<number>(
    Number((row.d * 1.35).toFixed(1))
  );
  const [preloadForceKn, setPreloadForceKn] = useState<number>(
    row.appliedLoadKn
  );
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);

  // Sync axial force & collar mean diameter when active row changes
  useEffect(() => {
    setPreloadForceKn(row.appliedLoadKn);
    setCollarMeanDiaMm(Number((row.d * 1.35).toFixed(1)));
  }, [row.id, row.d, row.appliedLoadKn]);

  const activeLubricant = useMemo(() => {
    return (
      BOLT_LUBRICANT_SPECS.find((l) => l.id === selectedLubricantId) ||
      BOLT_LUBRICANT_SPECS[0]
    );
  }, [selectedLubricantId]);

  const handleSelectLubricant = (spec: BoltLubricantSpec) => {
    setSelectedLubricantId(spec.id);
    setCustomMuThread(spec.muThreadNominal);
    setCustomMuCollar(spec.muCollarNominal);
  };

  // Detailed torque & combined stress calculations for ISO 2901 / DIN 103 30-deg Trapezoidal Thread
  const calc = useMemo(() => {
    const cos15 = Math.cos((15 * Math.PI) / 180); // 0.9659258
    const lambdaRad = (row.leadAngleDeg * Math.PI) / 180;
    const FkN = Math.max(0, Number(preloadForceKn) || 0);
    const FN = FkN * 1000;

    const computeForMu = (muThread: number, muCollar: number) => {
      const muPrime = muThread / cos15;
      const rhoPrimeRad = Math.atan(muPrime);
      const rhoPrimeDeg = (rhoPrimeRad * 180) / Math.PI;

      // Thread tightening torque T_thread = 0.5 * F(kN) * d2(mm) * tan(lambda + rho') [N*m]
      const tThreadNm =
        0.5 * FkN * row.d2 * Math.tan(lambdaRad + rhoPrimeRad);

      // Thread loosening / lowering torque T_loosen = 0.5 * F(kN) * d2(mm) * tan(rho' - lambda) [N*m]
      const tLoosenThreadNm =
        0.5 * FkN * row.d2 * Math.tan(rhoPrimeRad - lambdaRad);

      // Collar / Nut Bearing Face Friction Torque T_collar = 0.5 * F(kN) * d_collar_m(mm) * mu_collar [N*m]
      const tCollarNm = includeCollarFriction
        ? 0.5 * FkN * collarMeanDiaMm * muCollar
        : 0;

      const tTotalTightenNm = tThreadNm + tCollarNm;
      const tTotalLoosenNm = tLoosenThreadNm + tCollarNm;

      // Efficiency of thread alone & total assembly
      const etaThreadPct =
        (Math.tan(lambdaRad) / Math.max(0.0001, Math.tan(lambdaRad + rhoPrimeRad))) *
        100;
      const idealWorkPerRevNm = (FN * (row.ph / 1000)) / (2 * Math.PI);
      const etaTotalPct =
        tTotalTightenNm > 0
          ? (idealWorkPerRevNm / tTotalTightenNm) * 100
          : etaThreadPct;

      // Combined Stress in Thread Core (d3):
      // 1. Axial tensile/compressive stress sigma_a = F / A_core (MPa)
      const sigmaAxialMpa = FN / Math.max(1, row.coreAreaMm2);
      // 2. Torsional shear stress in root cylinder tau_t = (16 * T_thread_Nmm) / (pi * d3^3) (MPa)
      const tThreadNmm = tThreadNm * 1000;
      const tauTorsionMpa =
        (16 * tThreadNmm) / (Math.PI * Math.pow(Math.max(1, row.d3), 3));
      // 3. Equivalent von Mises stress sigma_vM = sqrt(sigma_a^2 + 3 * tau_t^2) (MPa)
      const sigmaVonMisesMpa = Math.sqrt(
        sigmaAxialMpa * sigmaAxialMpa + 3 * tauTorsionMpa * tauTorsionMpa
      );

      return {
        muPrime,
        rhoPrimeDeg,
        isSelfLocking: row.leadAngleDeg <= rhoPrimeDeg,
        tThreadNm,
        tCollarNm,
        tTotalTightenNm,
        tTotalLoosenNm,
        etaThreadPct,
        etaTotalPct,
        sigmaAxialMpa,
        tauTorsionMpa,
        sigmaVonMisesMpa,
      };
    };

    const current = computeForMu(customMuThread, customMuCollar);
    const minRange = computeForMu(
      activeLubricant.muThreadMin,
      Math.max(0.03, activeLubricant.muCollarNominal - 0.02)
    );
    const maxRange = computeForMu(
      activeLubricant.muThreadMax,
      activeLubricant.muCollarNominal + 0.02
    );

    // Table across all 8 lubricant conditions for quick engineering comparison
    const comparisonRows = BOLT_LUBRICANT_SPECS.map((spec) => {
      const res = computeForMu(spec.muThreadNominal, spec.muCollarNominal);
      return {
        spec,
        ...res,
      };
    });

    const yieldStrengthMpa =
      THREAD_MATERIAL_SPECS[row.materialGrade]?.yieldStrengthMpa || 340;
    const safetyFactorVonMises =
      current.sigmaVonMisesMpa > 0
        ? yieldStrengthMpa / current.sigmaVonMisesMpa
        : 99.9;

    return {
      FkN,
      current,
      minRange,
      maxRange,
      comparisonRows,
      yieldStrengthMpa,
      safetyFactorVonMises,
    };
  }, [
    row,
    preloadForceKn,
    customMuThread,
    customMuCollar,
    includeCollarFriction,
    collarMeanDiaMm,
    activeLubricant,
  ]);

  const handleApplyToProject = () => {
    if (!onApplyTorqueSettingsToProject) return;
    onApplyTorqueSettingsToProject(
      customMuThread,
      preloadForceKn,
      activeLubricant.shortName
    );
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Kalkulator Torsi Lanjutan — Variasi Koefisien Gesek (μ) &amp; Jenis Pelumas Baut ({row.designation})
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulasikan pengaruh pelumas baut (Molybdenum Disulfide MoS₂, PTFE, Anti-Seize Paste, Gemuk EP, Oli, hingga Kondisi Kering) terhadap torsi pengencangan ulir, torsi bidang tumpu (collar), efisiensi, dan tegangan gabungan von Mises.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              handleSelectLubricant(BOLT_LUBRICANT_SPECS[0]);
              setPreloadForceKn(row.appliedLoadKn);
              setCollarMeanDiaMm(Number((row.d * 1.35).toFixed(1)));
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Parameter
          </button>

          {onApplyTorqueSettingsToProject && (
            <button
              type="button"
              onClick={handleApplyToProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              {appliedFeedback ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Diterapkan ke Lembar Proyek
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  Terapkan μ={customMuThread.toFixed(2)} ({activeLubricant.shortName}) ke Proyek
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Section 1: Lubricant Preset Cards (MoS2, Anti-Seize, PTFE, Grease, Oil, Dry) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800">
            1. Pilih Kondisi Pelumasan Baut / Spindel Ulir Trapesium:
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Kategori Aktif: {activeLubricant.category} · Suhu Kerja: {activeLubricant.tempRange}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {BOLT_LUBRICANT_SPECS.map((spec) => {
            const isSelected = spec.id === selectedLubricantId;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => handleSelectLubricant(spec)}
                className={`p-2.5 rounded-md border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-600 ring-1 ring-indigo-600'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {spec.shortName}
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/80 flex items-baseline justify-between font-mono">
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? 'text-indigo-700' : 'text-slate-800'
                    }`}
                  >
                    μ={spec.muThreadNominal.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {spec.muThreadMin}..{spec.muThreadMax}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-slate-900">{activeLubricant.name}:</strong>{' '}
            {activeLubricant.description}
          </div>
          <span className="font-mono text-[11px] text-indigo-800 font-semibold whitespace-nowrap">
            Rentang μ: {activeLubricant.muThreadMin.toFixed(2)} – {activeLubricant.muThreadMax.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Section 2: Fine-Tuning Inputs (Preload Force, Thread Friction mu_thread, Collar Friction mu_collar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
        {/* Axial Force F (kN) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Beban Aksial / Preload F (kN)
          </label>
          <input
            type="number"
            step="any"
            min={0.1}
            value={preloadForceKn}
            onChange={(e) => setPreloadForceKn(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
          />
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <button
              type="button"
              onClick={() =>
                setPreloadForceKn(
                  Number((row.maxStaticLoadActiveKn * 0.5).toFixed(2))
                )
              }
              className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              50% Fmaks ({(row.maxStaticLoadActiveKn * 0.5).toFixed(1)} kN)
            </button>
            <button
              type="button"
              onClick={() => setPreloadForceKn(row.maxStaticLoadActiveKn)}
              className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              100% Fmaks ({row.maxStaticLoadActiveKn.toFixed(1)} kN)
            </button>
          </div>
        </div>

        {/* Thread Friction Coefficient mu_ulir */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-700">
              Koef. Gesek Sisi Ulir (μ<sub>ulir</sub>)
            </label>
            <span className="font-mono text-xs font-bold text-indigo-700">
              {customMuThread.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.03}
              max={0.35}
              step={0.005}
              value={customMuThread}
              onChange={(e) => setCustomMuThread(Number(e.target.value))}
              className="flex-1 accent-indigo-600"
            />
            <input
              type="number"
              step={0.005}
              min={0.02}
              max={0.5}
              value={customMuThread}
              onChange={(e) => setCustomMuThread(Number(e.target.value))}
              className="w-18 px-2 py-1 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md text-right"
            />
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            μ&apos; = μ/cos 15° = {calc.current.muPrime.toFixed(4)} · ρ&apos; = {calc.current.rhoPrimeDeg.toFixed(2)}°
          </div>
        </div>

        {/* Collar / Bearing Surface Friction Coefficient mu_collar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-700">
              Koef. Gesek Tumpuan (μ<sub>collar</sub>)
            </label>
            <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCollarFriction}
                onChange={(e) => setIncludeCollarFriction(e.target.checked)}
                className="rounded border-slate-300"
              />
              Aktifkan Collar
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.03}
              max={0.35}
              step={0.005}
              disabled={!includeCollarFriction}
              value={customMuCollar}
              onChange={(e) => setCustomMuCollar(Number(e.target.value))}
              className="flex-1 accent-indigo-600 disabled:opacity-40"
            />
            <input
              type="number"
              step={0.005}
              min={0.02}
              max={0.5}
              disabled={!includeCollarFriction}
              value={customMuCollar}
              onChange={(e) => setCustomMuCollar(Number(e.target.value))}
              className="w-18 px-2 py-1 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md text-right disabled:opacity-40"
            />
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            {includeCollarFriction
              ? 'Termasuk gesekan bidang kontak mur/bantalan'
              : 'Hanya torsi ulir murni (bantalan gelinding)'}
          </div>
        </div>

        {/* Mean Collar Diameter d_collar_m */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dia. Rata-rata Tumpuan d<sub>collar</sub> (mm)
          </label>
          <input
            type="number"
            step="any"
            min={row.d}
            disabled={!includeCollarFriction}
            value={collarMeanDiaMm}
            onChange={(e) => setCollarMeanDiaMm(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 disabled:opacity-40"
          />
          <div className="text-[11px] font-mono text-slate-500 mt-1.5">
            Standar ≈ 1.35 × d = {(row.d * 1.35).toFixed(1)} mm
          </div>
        </div>
      </div>

      {/* Section 3: 4 Key Engineering Torque & Combined Stress Readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-md">
          <div className="text-indigo-950 font-medium">
            1. Torsi Ulir Murni (T<sub>ulir</sub>)
          </div>
          <div className="font-mono text-base font-bold text-indigo-800 mt-1">
            {calc.current.tThreadNm.toLocaleString('id-ID', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            N·m
          </div>
          <div className="font-mono text-[11px] text-slate-600 mt-1">
            = 0.5 × {calc.FkN} kN × {row.d2} mm × tan({row.leadAngleDeg}° +{' '}
            {calc.current.rhoPrimeDeg.toFixed(2)}°)
          </div>
        </div>

        <div className="p-3 bg-slate-900 text-white rounded-md">
          <div className="text-slate-300 font-medium">
            2. Total Torsi Pengencangan (T<sub>total</sub>)
          </div>
          <div className="font-mono text-base font-bold text-amber-300 mt-1">
            {calc.current.tTotalTightenNm.toLocaleString('id-ID', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            N·m
          </div>
          <div className="font-mono text-[11px] text-slate-300 mt-1">
            T_ulir ({calc.current.tThreadNm.toFixed(1)}) + T_collar (
            {calc.current.tCollarNm.toFixed(1)} N·m)
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-slate-700 font-medium">
            3. Rentang Variasi Pelumas &amp; Torsi Buka
          </div>
          <div className="font-mono text-sm font-semibold text-slate-900 mt-1">
            {calc.minRange.tTotalTightenNm.toFixed(1)} ..{' '}
            {calc.maxRange.tTotalTightenNm.toFixed(1)} N·m
          </div>
          <div className="font-mono text-[11px] text-slate-500 mt-1">
            Torsi Buka: {calc.current.tTotalLoosenNm.toFixed(2)} N·m · η_ulir ={' '}
            {calc.current.etaThreadPct.toFixed(1)}%
          </div>
        </div>

        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-md">
          <div className="text-emerald-950 font-medium">
            4. Tegangan Gabungan Inti (von Mises σ<sub>vM</sub>)
          </div>
          <div className="font-mono text-sm font-semibold text-emerald-800 mt-1">
            σ_vM = {calc.current.sigmaVonMisesMpa.toFixed(1)} MPa{' '}
            <span className="text-xs font-normal text-slate-600">
              (SF = {calc.safetyFactorVonMises.toFixed(2)})
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 mt-1">
            σ_aksial = {calc.current.sigmaAxialMpa.toFixed(1)} MPa · τ_puntir ={' '}
            {calc.current.tauTorsionMpa.toFixed(1)} MPa
          </div>
        </div>
      </div>

      {/* Section 4: Comprehensive Comparison Table Across All Bolt Lubricants */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            Tabel Komparasi Torsi Pengencangan Berdasarkan Jenis Pelumas Baut — {row.designation} pada F = {calc.FkN} kN
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Klik baris pelumas untuk mengaktifkan parameter
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs font-mono tabular-nums">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left font-sans font-semibold">
                  Jenis Pelumas / Kondisi Permukaan Ulir
                </th>
                <th className="py-2 px-2 text-right">μ Ulir</th>
                <th className="py-2 px-2 text-right">μ&apos; Efektif</th>
                <th className="py-2 px-2 text-right">Sudut ρ&apos; (°)</th>
                <th className="py-2 px-2.5 text-right bg-indigo-50/50 text-indigo-950">
                  Torsi Ulir T_ulir (N·m)
                </th>
                <th className="py-2 px-2.5 text-right">
                  Torsi Collar (N·m)
                </th>
                <th className="py-2 px-2.5 text-right bg-slate-200/70 text-slate-900">
                  Total T_kencang (N·m)
                </th>
                <th className="py-2 px-2 text-right">Efisiensi η (%)</th>
                <th className="py-2 px-2.5 text-right">σ_vM Inti (MPa)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {calc.comparisonRows.map((item) => {
                const isSelected = item.spec.id === selectedLubricantId;
                return (
                  <tr
                    key={item.spec.id}
                    onClick={() => handleSelectLubricant(item.spec)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 font-semibold'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-3 font-sans text-slate-900">
                      <div className="font-medium">{item.spec.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.spec.category} · Rentang μ: {item.spec.muThreadMin}–{item.spec.muThreadMax}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-indigo-700">
                      {item.spec.muThreadNominal.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      {item.muPrime.toFixed(3)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      {item.rhoPrimeDeg.toFixed(2)}°
                    </td>
                    <td className="py-2 px-2.5 text-right font-bold text-indigo-800 bg-indigo-50/30">
                      {item.tThreadNm.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-600">
                      {item.tCollarNm.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-bold text-slate-900 bg-slate-100/70">
                      {item.tTotalTightenNm.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-700">
                      {item.etaThreadPct.toFixed(1)}%
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-700">
                      {item.sigmaVonMisesMpa.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
