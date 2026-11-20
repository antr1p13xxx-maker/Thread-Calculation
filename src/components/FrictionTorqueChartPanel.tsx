import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, CheckCircle2 } from 'lucide-react';
import { TrCalculatedRow, THREAD_MATERIAL_SPECS } from '../data/trThreadData';

interface FrictionTorqueChartPanelProps {
  row: TrCalculatedRow;
  onSelectFrictionMu?: (newMu: number) => void;
}

type ChartDisplayMode = 'work_torque_efficiency' | 'd3_core_capacity_torsion';

interface FrictionCurveDataPoint {
  mu: number;
  muLabel: string;
  muPrime: number;
  rhoPrimeDeg: number;
  tThreadWorkNm: number;
  tCollarWorkNm: number;
  tTotalWorkNm: number;
  tMaxC45Nm: number;
  tMaxBronzeNm: number;
  tauTorsionD3Mpa: number;
  sigmaVonMisesD3Mpa: number;
  efficiencyPct: number;
  benchmarkTag?: string;
}

export const FrictionTorqueChartPanel: React.FC<
  FrictionTorqueChartPanelProps
> = ({ row, onSelectFrictionMu }) => {
  const [displayMode, setDisplayMode] = useState<ChartDisplayMode>(
    'work_torque_efficiency'
  );
  const [customLoadKn, setCustomLoadKn] = useState<number | null>(null);
  const [includeCollar, setIncludeCollar] = useState<boolean>(true);
  const [appliedNotice, setAppliedNotice] = useState<number | null>(null);

  const activeLoadKn =
    customLoadKn !== null ? customLoadKn : row.appliedLoadKn;

  // Generate 27 high-resolution points from mu = 0.04 to mu = 0.30 (step = 0.01)
  const curveData: FrictionCurveDataPoint[] = useMemo(() => {
    const cos15 = Math.cos((15 * Math.PI) / 180);
    const lambdaRad = (row.leadAngleDeg * Math.PI) / 180;
    const FkN = Math.max(0.1, activeLoadKn);
    const FN = FkN * 1000;
    const dCollarMeanMm = row.d * 1.35;

    const sigmaAxialD3Mpa = FN / Math.max(1, row.coreAreaMm2);

    const points: FrictionCurveDataPoint[] = [];
    for (let i = 4; i <= 30; i++) {
      const mu = Number((i / 100).toFixed(2));
      const muPrime = Number((mu / cos15).toFixed(4));
      const rhoPrimeRad = Math.atan(muPrime);
      const rhoPrimeDeg = Number(((rhoPrimeRad * 180) / Math.PI).toFixed(2));
      const tanSum = Math.tan(lambdaRad + rhoPrimeRad);

      // Thread tightening torque at active working load F (N*m)
      const tThreadWorkNm = Number((0.5 * FkN * row.d2 * tanSum).toFixed(2));
      const tCollarWorkNm = includeCollar
        ? Number((0.5 * FkN * dCollarMeanMm * mu).toFixed(2))
        : 0;
      const tTotalWorkNm = Number((tThreadWorkNm + tCollarWorkNm).toFixed(2));

      // Tightening torque at Maximum Core Shear Load (d3) for C45 & Bronze
      const tMaxC45Nm = Number(
        (0.5 * row.maxStaticLoadC45Kn * row.d2 * tanSum).toFixed(2)
      );
      const tMaxBronzeNm = Number(
        (0.5 * row.maxStaticLoadBronzeKn * row.d2 * tanSum).toFixed(2)
      );

      // Torsional shear stress on core diameter d3: tau_t = (16 * T_thread_Nmm) / (pi * d3^3) (MPa)
      const tauTorsionD3Mpa = Number(
        (
          (16 * (tThreadWorkNm * 1000)) /
          (Math.PI * Math.pow(Math.max(1, row.d3), 3))
        ).toFixed(2)
      );
      const sigmaVonMisesD3Mpa = Number(
        Math.sqrt(
          sigmaAxialD3Mpa * sigmaAxialD3Mpa +
            3 * tauTorsionD3Mpa * tauTorsionD3Mpa
        ).toFixed(2)
      );

      const efficiencyPct = Number(
        (
          (Math.tan(lambdaRad) / Math.max(0.0001, tanSum)) *
          100
        ).toFixed(1)
      );

      let benchmarkTag: string | undefined;
      if (mu === 0.06) benchmarkTag = 'MoS₂ Paste (0.06)';
      else if (mu === 0.09) benchmarkTag = 'Anti-Seize (0.09)';
      else if (mu === 0.1) benchmarkTag = 'Perunggu CuSn12 (0.10)';
      else if (mu === 0.12) benchmarkTag = 'Gemuk EP2 (0.12)';
      else if (mu === 0.15) benchmarkTag = 'Baja C45 (0.15)';
      else if (mu === 0.18) benchmarkTag = 'SUS 304 / Kering Brz (0.18)';
      else if (mu === 0.24) benchmarkTag = 'Kering Baja–Baja (0.24)';

      points.push({
        mu,
        muLabel: mu.toFixed(2),
        muPrime,
        rhoPrimeDeg,
        tThreadWorkNm,
        tCollarWorkNm,
        tTotalWorkNm,
        tMaxC45Nm,
        tMaxBronzeNm,
        tauTorsionD3Mpa,
        sigmaVonMisesD3Mpa,
        efficiencyPct,
        benchmarkTag,
      });
    }
    return points;
  }, [row, activeLoadKn, includeCollar]);

  // Find point closest to row.frictionMu
  const activePoint = useMemo(() => {
    return (
      curveData.find(
        (pt) => Math.abs(pt.mu - row.frictionMu) < 0.006
      ) || curveData[11]
    );
  }, [curveData, row.frictionMu]);

  const minPoint = curveData[0]; // mu = 0.04
  const maxPoint = curveData[curveData.length - 1]; // mu = 0.30

  const handlePointClick = (muVal: number) => {
    if (!onSelectFrictionMu) return;
    onSelectFrictionMu(muVal);
    setAppliedNotice(muVal);
    setTimeout(() => setAppliedNotice(null), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      {/* Top Header & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Visualisasi Grafik Hubungan Koefisien Gesek (μ) terhadap Torsi Pengencangan (T) &amp; Penampang Inti d3 — {row.designation}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kurva analitik non-linear <code className="font-mono text-slate-800">T(μ) = 0.5 · F · d2 · tan(λ + arctan(μ / cos 15°))</code> dan tegangan puntir inti <code className="font-mono text-blue-700">d3 = {row.d3.toFixed(3)} mm</code> (<code className="font-mono text-slate-800">Ac = {row.coreAreaMm2.toFixed(2)} mm²</code>) untuk rentang <code className="font-mono text-slate-800">μ = 0.04 s/d 0.30</code>. Klik titik pada kurva untuk menerapkan nilai μ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Mode Segmented Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md text-xs">
            <button
              type="button"
              onClick={() => setDisplayMode('work_torque_efficiency')}
              className={`px-2.5 py-1 font-medium rounded transition-colors whitespace-nowrap ${
                displayMode === 'work_torque_efficiency'
                  ? 'bg-white text-indigo-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kurva Torsi Kerja (T) &amp; Efisiensi (η)
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('d3_core_capacity_torsion')}
              className={`px-2.5 py-1 font-medium rounded transition-colors whitespace-nowrap ${
                displayMode === 'd3_core_capacity_torsion'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kapasitas Inti d3 (C45 vs Perunggu) &amp; τ_puntir
            </button>
          </div>

          {/* Toggle Collar Friction */}
          <button
            type="button"
            onClick={() => setIncludeCollar((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              includeCollar
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {includeCollar ? '+ Gesekan Collar Aktif' : 'Hanya Torsi Ulir Murni'}
          </button>
        </div>
      </div>

      {/* Interactive Load & Active Point Telemetry Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">
              Beban Aksial Simulasi F (kN):
            </span>
            {customLoadKn !== null && (
              <button
                type="button"
                onClick={() => setCustomLoadKn(null)}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Reset ({row.appliedLoadKn} kN)
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="number"
              step="any"
              min={0.5}
              value={activeLoadKn}
              onChange={(e) => setCustomLoadKn(Number(e.target.value))}
              className="w-24 px-2 py-1 text-xs font-mono font-semibold bg-white border border-slate-300 rounded focus:outline-none focus:border-indigo-600"
            />
            <span className="font-mono text-[11px] text-slate-500">
              d2={row.d2} mm · d3={row.d3} mm
            </span>
          </div>
        </div>

        <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-md">
          <div className="text-indigo-950 font-medium flex items-center justify-between">
            <span>Titik Operasi Aktif (μ = {row.frictionMu.toFixed(2)})</span>
            {appliedNotice !== null && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                μ={appliedNotice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="font-mono text-sm font-bold text-indigo-800 mt-1">
            T_ulir = {activePoint.tThreadWorkNm} N·m{' '}
            <span className="text-xs font-normal text-slate-600">
              (T_total = {activePoint.tTotalWorkNm} N·m)
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 mt-0.5">
            Efisiensi η = {activePoint.efficiencyPct}% · τ_puntir(d3) = {activePoint.tauTorsionD3Mpa} MPa
          </div>
        </div>

        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-md">
          <div className="text-blue-950 font-medium">
            Rentang Torsi Ulir (μ = 0.04 → 0.30)
          </div>
          <div className="font-mono text-sm font-bold text-blue-800 mt-1">
            {minPoint.tThreadWorkNm} N·m → {maxPoint.tThreadWorkNm} N·m
          </div>
          <div className="font-mono text-[11px] text-slate-600 mt-0.5">
            Kenaikan torsi {(maxPoint.tThreadWorkNm / Math.max(0.01, minPoint.tThreadWorkNm)).toFixed(2)}× dari pelumas MoS₂ ke kering
          </div>
        </div>

        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-md">
          <div className="text-amber-950 font-medium">
            Kapasitas Torsi Inti d3 ({THREAD_MATERIAL_SPECS[row.materialGrade].shortLabel})
          </div>
          <div className="font-mono text-sm font-bold text-amber-900 mt-1">
            C45: {activePoint.tMaxC45Nm} N·m · Brz: {activePoint.tMaxBronzeNm} N·m
          </div>
          <div className="font-mono text-[11px] text-slate-600 mt-0.5">
            Pada beban geser inti maks d3 = {row.d3.toFixed(3)} mm
          </div>
        </div>
      </div>

      {/* Main Recharts Curve Visualization */}
      <div className="h-[340px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {displayMode === 'work_torque_efficiency' ? (
            <ComposedChart
              data={curveData}
              margin={{ top: 16, right: 24, left: 10, bottom: 16 }}
              onClick={(state: any) => {
                if (
                  state &&
                  state.activePayload &&
                  state.activePayload.length > 0
                ) {
                  const pt = state.activePayload[0]
                    .payload as FrictionCurveDataPoint;
                  if (pt && typeof pt.mu === 'number') {
                    handlePointClick(pt.mu);
                  }
                }
              }}
            >
              <defs>
                <linearGradient id="gradTotalTorque" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="muLabel"
                tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                label={{
                  value: 'Koefisien Gesek Ulir (μ)',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 11,
                  fill: '#334155',
                }}
              />
              <YAxis
                yAxisId="torque"
                tick={{ fontSize: 11, fill: '#1E293B', fontFamily: 'JetBrains Mono, monospace' }}
                label={{
                  value: 'Torsi Pengencangan T (N·m)',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                  fill: '#1E293B',
                }}
              />
              <YAxis
                yAxisId="eff"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#059669', fontFamily: 'JetBrains Mono, monospace' }}
                label={{
                  value: 'Efisiensi Mekanis Ulir η (%)',
                  angle: 90,
                  position: 'insideRight',
                  fontSize: 11,
                  fill: '#059669',
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as FrictionCurveDataPoint;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-md shadow-lg border border-slate-700 text-xs font-mono space-y-1.5">
                      <div className="font-sans font-bold text-amber-300 border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
                        <span>Koefisien Gesek μ = {pt.mu.toFixed(2)}</span>
                        {pt.benchmarkTag && (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-sky-300 rounded text-[10px]">
                            {pt.benchmarkTag}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-300">Sudut Gesek ρ&apos;:</span>
                        <span className="font-semibold">{pt.rhoPrimeDeg}° (μ&apos;={pt.muPrime})</span>
                      </div>
                      <div className="flex justify-between gap-4 text-sky-300">
                        <span>Torsi Ulir Murni (T_ulir):</span>
                        <span className="font-bold">{pt.tThreadWorkNm} N·m</span>
                      </div>
                      {includeCollar && (
                        <div className="flex justify-between gap-4 text-indigo-300">
                          <span>Total Torsi (T_ulir + Collar):</span>
                          <span className="font-bold">{pt.tTotalWorkNm} N·m</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 text-emerald-300">
                        <span>Efisiensi Mekanis (η):</span>
                        <span className="font-bold">{pt.efficiencyPct}%</span>
                      </div>
                      <div className="flex justify-between gap-4 text-slate-300 pt-1 border-t border-slate-800">
                        <span>Tegangan Puntir Inti d3:</span>
                        <span>{pt.tauTorsionD3Mpa} MPa (σ_vM = {pt.sigmaVonMisesD3Mpa} MPa)</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend />

              {/* Benchmark Vertical Reference Lines */}
              <ReferenceLine
                yAxisId="torque"
                x="0.06"
                stroke="#64748B"
                strokeDasharray="3 3"
                label={{ value: 'MoS₂ (0.06)', position: 'top', fontSize: 10, fill: '#475569' }}
              />
              <ReferenceLine
                yAxisId="torque"
                x="0.10"
                stroke="#D97706"
                strokeDasharray="3 3"
                label={{ value: 'Perunggu (0.10)', position: 'top', fontSize: 10, fill: '#B45309' }}
              />
              <ReferenceLine
                yAxisId="torque"
                x="0.15"
                stroke="#2563EB"
                strokeDasharray="3 3"
                label={{ value: 'C45 (0.15)', position: 'top', fontSize: 10, fill: '#1D4ED8' }}
              />
              <ReferenceLine
                yAxisId="torque"
                x={activePoint.muLabel}
                stroke="#DC2626"
                strokeWidth={2}
                label={{
                  value: `Aktif μ=${row.frictionMu.toFixed(2)}`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: '#DC2626',
                }}
              />

              {includeCollar && (
                <Area
                  yAxisId="torque"
                  type="monotone"
                  dataKey="tTotalWorkNm"
                  name="Total Torsi Pengencangan T_total (N·m)"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  fill="url(#gradTotalTorque)"
                />
              )}
              <Line
                yAxisId="torque"
                type="monotone"
                dataKey="tThreadWorkNm"
                name="Torsi Ulir Murni T_ulir (N·m)"
                stroke="#0284C7"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#0284C7' }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="eff"
                type="monotone"
                dataKey="efficiencyPct"
                name="Efisiensi Mekanis Ulir η (%)"
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={curveData}
              margin={{ top: 16, right: 24, left: 10, bottom: 16 }}
              onClick={(state: any) => {
                if (
                  state &&
                  state.activePayload &&
                  state.activePayload.length > 0
                ) {
                  const pt = state.activePayload[0]
                    .payload as FrictionCurveDataPoint;
                  if (pt && typeof pt.mu === 'number') {
                    handlePointClick(pt.mu);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="muLabel"
                tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                label={{
                  value: 'Koefisien Gesek Ulir (μ)',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 11,
                  fill: '#334155',
                }}
              />
              <YAxis
                yAxisId="maxTorque"
                tick={{ fontSize: 11, fill: '#1E293B', fontFamily: 'JetBrains Mono, monospace' }}
                label={{
                  value: 'Torsi Kapasitas Maks Inti d3 (N·m)',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                  fill: '#1E293B',
                }}
              />
              <YAxis
                yAxisId="stress"
                orientation="right"
                tick={{ fontSize: 11, fill: '#DC2626', fontFamily: 'JetBrains Mono, monospace' }}
                label={{
                  value: 'Tegangan Puntir Inti d3 τ_t (MPa)',
                  angle: 90,
                  position: 'insideRight',
                  fontSize: 11,
                  fill: '#DC2626',
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as FrictionCurveDataPoint;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-md shadow-lg border border-slate-700 text-xs font-mono space-y-1.5">
                      <div className="font-sans font-bold text-amber-300 border-b border-slate-700 pb-1">
                        Analisis Inti d3 = {row.d3.toFixed(3)} mm pada μ = {pt.mu.toFixed(2)}
                      </div>
                      <div className="flex justify-between gap-4 text-sky-300">
                        <span>T_maks Inti d3 Baja C45:</span>
                        <span className="font-bold">{pt.tMaxC45Nm} N·m</span>
                      </div>
                      <div className="flex justify-between gap-4 text-amber-300">
                        <span>T_maks Inti d3 Perunggu:</span>
                        <span className="font-bold">{pt.tMaxBronzeNm} N·m</span>
                      </div>
                      <div className="flex justify-between gap-4 text-rose-300 pt-1 border-t border-slate-800">
                        <span>Tegangan Puntir d3 (τ_t):</span>
                        <span className="font-bold">{pt.tauTorsionD3Mpa} MPa</span>
                      </div>
                      <div className="flex justify-between gap-4 text-emerald-300">
                        <span>Tegangan Gabungan von Mises:</span>
                        <span className="font-bold">{pt.sigmaVonMisesD3Mpa} MPa</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend />

              <ReferenceLine
                yAxisId="maxTorque"
                x={activePoint.muLabel}
                stroke="#DC2626"
                strokeWidth={2}
                label={{
                  value: `Aktif μ=${row.frictionMu.toFixed(2)}`,
                  position: 'top',
                  fontSize: 10,
                  fill: '#DC2626',
                }}
              />

              <Line
                yAxisId="maxTorque"
                type="monotone"
                dataKey="tMaxC45Nm"
                name="Torsi Maks Kapasitas Inti d3 — Baja C45 (N·m)"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="maxTorque"
                type="monotone"
                dataKey="tMaxBronzeNm"
                name="Torsi Maks Kapasitas Inti d3 — Perunggu CuSn12 (N·m)"
                stroke="#D97706"
                strokeWidth={2.5}
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="stress"
                type="monotone"
                dataKey="tauTorsionD3Mpa"
                name={`Tegangan Puntir Inti d3 τ_t pada F=${activeLoadKn} kN (MPa)`}
                stroke="#DC2626"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
