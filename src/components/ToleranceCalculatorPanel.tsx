import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Plus, CheckCircle2, Sliders } from 'lucide-react';
import {
  TrCalculatedRow,
  ALL_STANDARD_PITCHES,
  ExternalTolClass,
  InternalTolClass,
  getCrestClearanceAc,
} from '../data/trThreadData';

export type ExtendedExternalTolClass = '7h' | '7e' | '8e' | '8c' | '9c';
export type EngagementLengthGroup = 'N' | 'L';

interface ToleranceCalculatorPanelProps {
  activeRow: TrCalculatedRow;
  onAddCalculatedToProject?: (
    d: number,
    p: number,
    extTol: ExternalTolClass,
    intTol: InternalTolClass,
    notes: string
  ) => void;
}

export const ToleranceCalculatorPanel: React.FC<
  ToleranceCalculatorPanelProps
> = ({ activeRow, onAddCalculatedToProject }) => {
  // Interactive inputs initialized from activeRow
  const [nominalD, setNominalD] = useState<number>(activeRow.d);
  const [pitchP, setPitchP] = useState<number>(activeRow.p);
  const [extClass, setExtClass] = useState<ExtendedExternalTolClass>(
    activeRow.extTolClass
  );
  const [intClass, setIntClass] = useState<InternalTolClass>(
    activeRow.intTolClass
  );
  const [engagementGroup, setEngagementGroup] =
    useState<EngagementLengthGroup>('N');
  const [addedFeedback, setAddedFeedback] = useState<boolean>(false);

  // Sync when user selects a different thread from the top selector in cad_calc
  useEffect(() => {
    setNominalD(activeRow.d);
    setPitchP(activeRow.p);
    setExtClass(activeRow.extTolClass);
    setIntClass(activeRow.intTolClass);
  }, [activeRow.id, activeRow.d, activeRow.p, activeRow.extTolClass, activeRow.intTolClass]);

  // Complete DIN 103 / ISO 2903 calculation engine
  const tolResult = useMemo(() => {
    const d = Math.max(4, Number(nominalD) || 20);
    const p = Math.max(0.5, Number(pitchP) || 4);
    const ac = getCrestClearanceAc(p);

    // Basic profile dimensions per ISO 2901 / DIN 103
    const H1 = 0.5 * p;
    const h3 = H1 + ac;
    const d2 = d - 0.5 * p;
    const d3 = Math.max(0.5, d - 2 * h3);
    const D1 = Math.max(0.5, d - 2 * H1);
    const D4 = d + 2 * ac;

    // Recommended normal length of thread engagement l_N (ISO 2903 / DIN 103)
    const lNMin = Number((2.24 * p * Math.pow(d, 0.2)).toFixed(1));
    const lNMax = Number((6.7 * p * Math.pow(d, 0.2)).toFixed(1));

    // 1. Fundamental Deviation es (micrometers) for External Thread (h, e, c)
    // Per ISO 2903:
    // position h: es = 0
    // position e: es = -(38 + 11 * P) um (for P >= 2; 0 or small for P=1.5)
    // position c: es = -(125 + 19 * P) um
    const tolPosition = extClass.slice(-1) as 'h' | 'e' | 'c';
    const tolGradeNum = Number(extClass.slice(0, -1));

    let esPitchUm = 0;
    if (tolPosition === 'h') {
      esPitchUm = 0;
    } else if (tolPosition === 'e') {
      esPitchUm = -Math.round(38 + 11 * p);
    } else {
      esPitchUm = -Math.round(125 + 19 * p);
    }

    // Internal thread always uses H position in DIN 103: EI = 0 um
    const EIPitchUm = 0;

    // 2. Base Pitch Diameter Tolerance Td2(grade 6) per ISO 2903
    const td2Grade6Um = 90 * Math.pow(p, 0.4) * Math.pow(d, 0.1);
    const engagementMultiplier = engagementGroup === 'L' ? 1.25 : 1.0;

    const extGradeFactor =
      tolGradeNum === 7 ? 1.25 : tolGradeNum === 8 ? 1.6 : 2.0;
    const intGradeFactor = intClass === '7H' ? 1.68 : 2.12;

    const Td2Um = Math.round(
      td2Grade6Um * extGradeFactor * engagementMultiplier
    );
    const TD2Um = Math.round(
      td2Grade6Um * intGradeFactor * engagementMultiplier
    );

    // Major diameter tolerance Td (4h) for external thread crest d
    const TdMajorUm = Math.round(0.63 * (180 * Math.pow(p, 0.65)));

    // Minor diameter tolerance Td3 for external thread root d3
    // Per DIN 103: Td3 = 1.25 * Td2 + |es|
    const Td3Um = Math.round(1.25 * Td2Um + Math.abs(esPitchUm) * 0.5);
    const esRootUm = Math.round(esPitchUm * 1.25);

    // Minor diameter tolerance TD1 (4H) for internal thread bore D1
    const TD1Um = Math.round(180 * Math.pow(p, 0.65));

    // Lower / Upper deviations in micrometers
    const eiPitchUm = esPitchUm - Td2Um;
    const eiRootUm = esRootUm - Td3Um;
    const ESPitchUm = EIPitchUm + TD2Um;
    const ESD1Um = TD1Um;

    // Limit dimensions in millimeters
    const dMax = Number(d.toFixed(3));
    const dMin = Number((d - TdMajorUm / 1000).toFixed(3));

    const d2Max = Number((d2 + esPitchUm / 1000).toFixed(3));
    const d2Min = Number((d2 + eiPitchUm / 1000).toFixed(3));

    const d3Max = Number((d3 + esRootUm / 1000).toFixed(3));
    const d3Min = Number((d3 + eiRootUm / 1000).toFixed(3));

    const D2Min = Number(d2.toFixed(3));
    const D2Max = Number((d2 + ESPitchUm / 1000).toFixed(3));

    const D1Min = Number(D1.toFixed(3));
    const D1Max = Number((D1 + ESD1Um / 1000).toFixed(3));

    const D4Min = Number(D4.toFixed(3));

    // 3-Wire Measurement limits (M_min .. M_max) based on d2Min .. d2Max
    const bestWire = Number((0.5176381 * p).toFixed(3));
    const wireOffset = -1.8660254 * p + 4.8637033 * bestWire;
    const MNominal = Number((d2 + wireOffset).toFixed(3));
    const MMax = Number((d2Max + wireOffset).toFixed(3));
    const MMin = Number((d2Min + wireOffset).toFixed(3));

    // Radial / Pitch clearance & Axial Backlash between Nut (D2) and Screw (d2)
    const minPitchClearanceUm = Math.abs(esPitchUm);
    const maxPitchClearanceUm = Math.abs(esPitchUm) + Td2Um + TD2Um;
    const minPitchClearanceMm = minPitchClearanceUm / 1000;
    const maxPitchClearanceMm = maxPitchClearanceUm / 1000;

    // Axial play (backlash) = Delta_d2 * tan(15 deg) where tan(15 deg) = 0.267949
    const minAxialBacklashMm = Number(
      (minPitchClearanceMm * 0.267949).toFixed(4)
    );
    const maxAxialBacklashMm = Number(
      (maxPitchClearanceMm * 0.267949).toFixed(4)
    );

    return {
      d,
      p,
      ac,
      d2,
      d3,
      D1,
      D4,
      lNMin,
      lNMax,
      esPitchUm,
      eiPitchUm,
      Td2Um,
      esRootUm,
      eiRootUm,
      Td3Um,
      TdMajorUm,
      EIPitchUm,
      ESPitchUm,
      TD2Um,
      TD1Um,
      ESD1Um,
      dMax,
      dMin,
      d2Max,
      d2Min,
      d3Max,
      d3Min,
      D2Min,
      D2Max,
      D1Min,
      D1Max,
      D4Min,
      bestWire,
      MNominal,
      MMin,
      MMax,
      minPitchClearanceUm,
      maxPitchClearanceUm,
      minPitchClearanceMm,
      maxPitchClearanceMm,
      minAxialBacklashMm,
      maxAxialBacklashMm,
    };
  }, [nominalD, pitchP, extClass, intClass, engagementGroup]);

  // Visual SVG coordinate calculation for ISO Tolerance Zone diagram (in micrometers)
  const zoneSvg = useMemo(() => {
    const svgH = 136;
    const padY = 18;
    const usableH = svgH - padY * 2;

    const topUm = Math.max(40, tolResult.ESPitchUm); // +TD2 above zero line
    const bottomUm = Math.min(-40, tolResult.eiPitchUm); // ei below zero line
    const spanUm = Math.max(100, topUm - bottomUm);

    const toY = (um: number) =>
      Number((padY + ((topUm - um) / spanUm) * usableH).toFixed(1));

    const zeroY = toY(0);
    const nutTopY = toY(tolResult.ESPitchUm);
    const nutH = Math.max(14, zeroY - nutTopY);
    const boltTopY = toY(tolResult.esPitchUm);
    const boltBottomY = toY(tolResult.eiPitchUm);
    const boltH = Math.max(14, boltBottomY - boltTopY);

    return {
      zeroY,
      nutTopY,
      nutH,
      boltTopY,
      boltH,
    };
  }, [tolResult]);

  const handleSaveToProject = () => {
    if (!onAddCalculatedToProject) return;
    const mappedExt: ExternalTolClass =
      extClass === '9c' ? '8c' : (extClass as ExternalTolClass);
    onAddCalculatedToProject(
      tolResult.d,
      tolResult.p,
      mappedExt,
      intClass,
      `Toleransi DIN 103 ${extClass}/${intClass} (d2: ${tolResult.d2Min.toFixed(
        3
      )}..${tolResult.d2Max.toFixed(3)} mm, D2: ${tolResult.D2Min.toFixed(
        3
      )}..${tolResult.D2Max.toFixed(3)} mm)`
    );
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Kalkulator Toleransi & Deviasi Presisi DIN 103 / ISO 2903 Interaktif
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Masukkan diameter nominal (d), pitch (P), dan kelas toleransi (7e, 8e, 7h, 8c, 9c / 7H, 8H) untuk menghitung batas ukuran maksimum/minimum, deviasi fundamental (μm), kelonggaran suaian, dan batas ukur 3-kawat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNominalD(activeRow.d);
              setPitchP(activeRow.p);
              setExtClass(activeRow.extTolClass);
              setIntClass(activeRow.intTolClass);
              setEngagementGroup('N');
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke {activeRow.designation}
          </button>

          {onAddCalculatedToProject && (
            <button
              type="button"
              onClick={handleSaveToProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              {addedFeedback ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tersimpan di Proyek
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Simpan Tr {tolResult.d}x{tolResult.p} ({extClass}/{intClass}) ke Proyek
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Input Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
        {/* 1. Nominal Diameter Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            1. Diameter Nominal d (mm)
          </label>
          <input
            type="number"
            step="any"
            min={4}
            max={2000}
            value={nominalD}
            onChange={(e) => setNominalD(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 text-slate-900"
          />
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {[12, 20, 36, 50, 100, 300, 800, 1120].map((presetD) => (
              <button
                key={presetD}
                type="button"
                onClick={() => setNominalD(presetD)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                  nominalD === presetD
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tr{presetD}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Pitch P Selector + Custom Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            2. Pitch / Kisar P (mm)
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={
                ALL_STANDARD_PITCHES.includes(pitchP) ? pitchP : 'custom'
              }
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setPitchP(Number(e.target.value));
                }
              }}
              className="flex-1 px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            >
              {ALL_STANDARD_PITCHES.map((p) => (
                <option key={p} value={p}>
                  P = {p} mm (Standar)
                </option>
              ))}
              <option value="custom">Kustom (Input Manual)</option>
            </select>
            <input
              type="number"
              step="any"
              min={0.5}
              max={100}
              value={pitchP}
              onChange={(e) => setPitchP(Number(e.target.value))}
              className="w-18 px-2 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 text-right"
            />
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1.5">
            Kelonggaran puncak ac = {tolResult.ac.toFixed(2)} mm
          </div>
        </div>

        {/* 3. External Thread Tolerance Class (Baut: 7e, 8e, 7h, 8c, 9c) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            3. Kelas Toleransi Baut (Luar)
          </label>
          <div className="grid grid-cols-5 gap-1">
            {(['7e', '8e', '7h', '8c', '9c'] as ExtendedExternalTolClass[]).map(
              (cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setExtClass(cls)}
                  className={`py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                    extClass === cls
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {cls}
                </button>
              )
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            {extClass === '7e' && '7e: Presisi menengah, kelonggaran e (Standar DIN 103)'}
            {extClass === '8e' && '8e: Konstruksi umum, kelonggaran e'}
            {extClass === '7h' && '7h: Spindel presisi tanpa kelonggaran (es = 0 μm)'}
            {extClass === '8c' && '8c: Kelonggaran besar c (suhu tinggi / kotor)'}
            {extClass === '9c' && '9c: Kelas kasar alat berat & pintu air'}
          </div>
        </div>

        {/* 4. Internal Thread Tolerance Class (Mur: 7H, 8H) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            4. Kelas Toleransi Mur (Dalam)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['7H', '8H'] as InternalTolClass[]).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setIntClass(cls)}
                className={`py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                  intClass === cls
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {cls} (EI = 0)
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            {intClass === '7H'
              ? '7H: Standar utama mur DIN 103 / ISO 2903'
              : '8H: Toleransi diperbesar untuk mur panjang / kasar'}
          </div>
        </div>

        {/* 5. Length of Engagement Group (N vs L) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            5. Kelompok Panjang Kontak (l_e)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setEngagementGroup('N')}
              className={`py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                engagementGroup === 'N'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Grup N (Normal)
            </button>
            <button
              type="button"
              onClick={() => setEngagementGroup('L')}
              className={`py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                engagementGroup === 'L'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Grup L (Panjang)
            </button>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1.5">
            Rentang N: {tolResult.lNMin} .. {tolResult.lNMax} mm
          </div>
        </div>
      </div>

      {/* Main Output Grid: Precision Deviation Table + Visual Zone & Fit Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Precision Limit & Deviation Table (Baut & Mur) */}
        <div className="lg:col-span-2 border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900">
              Tabel Rentang Batas & Deviasi Presisi — Tr {tolResult.d} × {tolResult.p} — {extClass} / {intClass}
            </span>
            <span className="text-[11px] font-mono text-slate-600">
              1 mm = 1000 μm · Grup Kontak {engagementGroup}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs font-mono tabular-nums">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left font-sans font-semibold">
                    Elemen Dimensi
                  </th>
                  <th className="py-2 px-2 text-center font-sans font-semibold">
                    Kelas
                  </th>
                  <th className="py-2 px-2.5 text-right">Ukuran Dasar (mm)</th>
                  <th className="py-2 px-2.5 text-right">
                    Dev. Atas es/ES (μm)
                  </th>
                  <th className="py-2 px-2.5 text-right">
                    Dev. Bawah ei/EI (μm)
                  </th>
                  <th className="py-2 px-2.5 text-right">Toleransi T (μm)</th>
                  <th className="py-2 px-2.5 text-right bg-blue-50/60 text-blue-950">
                    Batas Min (mm)
                  </th>
                  <th className="py-2 px-2.5 text-right bg-emerald-50/60 text-emerald-950">
                    Batas Maks (mm)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* EXTERNAL THREAD (BAUT / SPINDEL) */}
                <tr className="bg-slate-100/70">
                  <td
                    colSpan={8}
                    className="py-1.5 px-3 font-sans font-semibold text-[11px] text-blue-900 uppercase tracking-wider"
                  >
                    A. Ulir Luar / Baut (Spindel) — Kelas {extClass}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-sans text-slate-800">
                    <span className="font-mono font-semibold text-slate-900">
                      d
                    </span>{' '}
                    — Diameter Luar Baut
                  </td>
                  <td className="py-2 px-2 text-center text-slate-600">4h</td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.d.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600">0</td>
                  <td className="py-2 px-2.5 text-right text-slate-600">
                    -{tolResult.TdMajorUm}
                  </td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.TdMajorUm}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-blue-800 bg-blue-50/30">
                    {tolResult.dMin.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-800 bg-emerald-50/30">
                    {tolResult.dMax.toFixed(3)}
                  </td>
                </tr>

                <tr className="bg-blue-50/20 hover:bg-blue-50/40">
                  <td className="py-2 px-3 font-sans text-slate-900 font-medium">
                    <span className="font-mono font-bold text-blue-700">
                      d2
                    </span>{' '}
                    — Diameter Pitch Baut
                  </td>
                  <td className="py-2 px-2 text-center font-bold text-blue-700">
                    {extClass}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold">
                    {tolResult.d2.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-blue-700 font-medium">
                    {tolResult.esPitchUm}
                  </td>
                  <td className="py-2 px-2.5 text-right text-blue-700 font-medium">
                    {tolResult.eiPitchUm}
                  </td>
                  <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                    {tolResult.Td2Um}
                  </td>
                  <td className="py-2 px-2.5 text-right font-bold text-blue-800 bg-blue-50/60">
                    {tolResult.d2Min.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-bold text-emerald-800 bg-emerald-50/60">
                    {tolResult.d2Max.toFixed(3)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-sans text-slate-800">
                    <span className="font-mono font-semibold text-slate-900">
                      d3
                    </span>{' '}
                    — Diameter Inti / Akar Baut
                  </td>
                  <td className="py-2 px-2 text-center text-slate-600">
                    {extClass}
                  </td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.d3.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600">
                    {tolResult.esRootUm}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600">
                    {tolResult.eiRootUm}
                  </td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.Td3Um}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-blue-800 bg-blue-50/30">
                    {tolResult.d3Min.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-800 bg-emerald-50/30">
                    {tolResult.d3Max.toFixed(3)}
                  </td>
                </tr>

                {/* INTERNAL THREAD (MUR) */}
                <tr className="bg-slate-100/70">
                  <td
                    colSpan={8}
                    className="py-1.5 px-3 font-sans font-semibold text-[11px] text-emerald-900 uppercase tracking-wider"
                  >
                    B. Ulir Dalam / Mur — Kelas {intClass}
                  </td>
                </tr>
                <tr className="bg-emerald-50/20 hover:bg-emerald-50/40">
                  <td className="py-2 px-3 font-sans text-slate-900 font-medium">
                    <span className="font-mono font-bold text-emerald-700">
                      D2
                    </span>{' '}
                    — Diameter Pitch Mur
                  </td>
                  <td className="py-2 px-2 text-center font-bold text-emerald-700">
                    {intClass}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold">
                    {tolResult.d2.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-emerald-700 font-medium">
                    +{tolResult.ESPitchUm}
                  </td>
                  <td className="py-2 px-2.5 text-right text-emerald-700 font-medium">
                    0
                  </td>
                  <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                    {tolResult.TD2Um}
                  </td>
                  <td className="py-2 px-2.5 text-right font-bold text-blue-800 bg-blue-50/60">
                    {tolResult.D2Min.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-bold text-emerald-800 bg-emerald-50/60">
                    {tolResult.D2Max.toFixed(3)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-sans text-slate-800">
                    <span className="font-mono font-semibold text-amber-800">
                      D1
                    </span>{' '}
                    — Diameter Dalam / Bor Mur
                  </td>
                  <td className="py-2 px-2 text-center text-slate-600">4H</td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.D1.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600">
                    +{tolResult.ESD1Um}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600">0</td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.TD1Um}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-blue-800 bg-blue-50/30">
                    {tolResult.D1Min.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-800 bg-emerald-50/30">
                    {tolResult.D1Max.toFixed(3)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-sans text-slate-800">
                    <span className="font-mono font-semibold text-slate-900">
                      D4
                    </span>{' '}
                    — Diameter Luar Dasar Mur
                  </td>
                  <td className="py-2 px-2 text-center text-slate-500">-</td>
                  <td className="py-2 px-2.5 text-right font-medium">
                    {tolResult.D4.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-400">
                    Bebas
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600">0</td>
                  <td className="py-2 px-2.5 text-right text-slate-400">-</td>
                  <td className="py-2 px-2.5 text-right font-semibold text-blue-800 bg-blue-50/30">
                    {tolResult.D4Min.toFixed(3)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-500 bg-emerald-50/30">
                    ≥ {tolResult.D4Min.toFixed(3)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Tolerance Zone Diagram + Fit / Backlash & 3-Wire Limits */}
        <div className="space-y-4">
          {/* Visual ISO Tolerance Zone Bar (Garis Nol d2 = D2) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">
                Diagram Zona Toleransi Pitch (d2 / D2)
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Garis 0 = {tolResult.d2.toFixed(3)} mm
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <svg
                viewBox="0 0 340 136"
                className="w-full h-36 block select-none"
                role="img"
                aria-label="Diagram Zona Toleransi Pitch DIN 103"
              >
                {/* Background Grid Lines */}
                <line
                  x1="12"
                  y1={zoneSvg.zeroY}
                  x2="328"
                  y2={zoneSvg.zeroY}
                  stroke="#0F172A"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x="326"
                  y={Math.max(12, zoneSvg.zeroY - 5)}
                  textAnchor="end"
                  className="text-[10px] font-mono font-semibold fill-slate-900"
                >
                  Garis Nol (0 μm)
                </text>

                {/* Internal Thread (Mur D2) Tolerance Band: 0 to +ES */}
                <rect
                  x="24"
                  y={zoneSvg.nutTopY}
                  width="120"
                  height={zoneSvg.nutH}
                  rx="3"
                  fill="#10B981"
                  fillOpacity="0.18"
                  stroke="#059669"
                  strokeWidth="1.5"
                />
                <text
                  x="30"
                  y={zoneSvg.nutTopY + 11}
                  className="text-[10px] font-mono font-bold fill-emerald-950"
                >
                  Mur {intClass} (+{tolResult.ESPitchUm} μm)
                </text>
                <text
                  x="30"
                  y={zoneSvg.nutTopY + zoneSvg.nutH - 3}
                  className="text-[9px] font-mono fill-emerald-800"
                >
                  EI = 0 μm
                </text>

                {/* External Thread (Baut d2) Tolerance Band: es to ei */}
                <rect
                  x="176"
                  y={zoneSvg.boltTopY}
                  width="126"
                  height={zoneSvg.boltH}
                  rx="3"
                  fill="#2563EB"
                  fillOpacity="0.18"
                  stroke="#1D4ED8"
                  strokeWidth="1.5"
                />
                <text
                  x="182"
                  y={zoneSvg.boltTopY + 11}
                  className="text-[10px] font-mono font-bold fill-blue-950"
                >
                  Baut {extClass} (es={tolResult.esPitchUm} μm)
                </text>
                <text
                  x="182"
                  y={zoneSvg.boltTopY + zoneSvg.boltH - 3}
                  className="text-[9px] font-mono fill-blue-800"
                >
                  ei = {tolResult.eiPitchUm} μm
                </text>
              </svg>
            </div>
          </div>

          {/* Fit Clearance & Axial Backlash Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="font-semibold text-slate-900">
              Analisis Suaian Rakitan & Backlash ({extClass} / {intClass})
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
              <span className="text-slate-600">Kelonggaran Pitch (Δd2):</span>
              <span className="font-mono font-semibold text-slate-900">
                {tolResult.minPitchClearanceMm.toFixed(3)} ..{' '}
                {tolResult.maxPitchClearanceMm.toFixed(3)} mm{' '}
                <span className="text-slate-500 font-normal">
                  ({tolResult.minPitchClearanceUm}..{tolResult.maxPitchClearanceUm} μm)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
              <span className="text-slate-600">
                Backlash Aksial (s_a = Δd2·tan 15°):
              </span>
              <span className="font-mono font-semibold text-blue-700">
                {tolResult.minAxialBacklashMm.toFixed(3)} ..{' '}
                {tolResult.maxAxialBacklashMm.toFixed(3)} mm
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-600">
                Batas Ukur 3-Kawat (d_w = {tolResult.bestWire} mm):
              </span>
              <span className="font-mono font-semibold text-emerald-800">
                {tolResult.MMin.toFixed(3)} .. {tolResult.MMax.toFixed(3)} mm
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
