import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrCalculatedRow,
  THREAD_MATERIAL_SPECS,
} from '../data/trThreadData';

interface ProjectLoadChartProps {
  projectRows: TrCalculatedRow[];
  selectedRowId: string;
  onSelectRow: (id: string, rowNum: number) => void;
  isDark?: boolean;
}

export const ProjectLoadChart: React.FC<ProjectLoadChartProps> = ({
  projectRows,
  selectedRowId,
  onSelectRow,
  isDark = false,
}) => {
  const [unitMode, setUnitMode] = useState<'kN' | 'Ton'>('kN');
  const [scaleMode, setScaleMode] = useState<'linear' | 'log'>('linear');

  const chartData = useMemo(() => {
    const factor = unitMode === 'Ton' ? 1 / 9.80665 : 1;
    return projectRows.map((row, index) => {
      const c45Val = Number((row.maxStaticLoadC45Kn * factor).toFixed(2));
      const bronzeVal = Number((row.maxStaticLoadBronzeKn * factor).toFixed(2));
      const activeVal = Number((row.maxStaticLoadActiveKn * factor).toFixed(2));
      const matShort =
        THREAD_MATERIAL_SPECS[row.materialGrade]?.shortLabel || 'Aktif';

      return {
        id: row.id,
        rowNum: index + 1,
        label: `#${index + 1} ${row.designation}`,
        designation: row.designation,
        d: row.d,
        p: row.p,
        d3: row.d3,
        coreAreaMm2: row.coreAreaMm2,
        materialShort: matShort,
        tauActive: row.allowableShearStressMpa,
        // Ensure strictly positive values for log scale compatibility
        c45Load: Math.max(0.01, c45Val),
        bronzeLoad: Math.max(0.01, bronzeVal),
        activeLoad: Math.max(0.01, activeVal),
        isSelected: row.id === selectedRowId,
      };
    });
  }, [projectRows, unitMode, selectedRowId]);

  if (projectRows.length === 0) {
    return null;
  }

  const unitLabel = unitMode === 'kN' ? 'kN' : 'Ton';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisLineColor = isDark ? '#334155' : '#CBD5E1';
  const tickTextColor = isDark ? '#94A3B8' : '#334155';
  const yTickTextColor = isDark ? '#94A3B8' : '#475569';
  const cursorFill = isDark ? '#1E293B' : '#F1F5F9';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Grafik Perbandingan Kapasitas Beban Statis Aksial: Baja C45 vs Perunggu ({projectRows.length} Baris Proyek)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Berdasarkan rumus luas penampang geser inti <code className="font-mono text-slate-700 dark:text-slate-300">Ac = (π/4)·d3²</code> · Baja C45 (<code className="font-mono">τ_izin = 65 MPa</code>) vs Perunggu CuSn12 (<code className="font-mono">τ_izin = 30 MPa</code>) · Klik batang grafik untuk memilih baris
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Unit Toggle: kN vs Ton */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setUnitMode('kN')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                unitMode === 'kN'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Satuan kN
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('Ton')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                unitMode === 'Ton'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Satuan Ton (tf)
            </button>
          </div>

          {/* Y-Axis Scale Toggle: Linear vs Logarithmic (helpful when mixing Tr 20 and Tr 1120) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setScaleMode('linear')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                scaleMode === 'linear'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Skala Linear
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('log')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                scaleMode === 'log'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Skala Logaritmik
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="h-[320px] w-full font-mono text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 20, left: 12, bottom: 8 }}
            onClick={(state: any) => {
              if (
                state &&
                state.activePayload &&
                state.activePayload.length > 0
              ) {
                const payload = state.activePayload[0].payload;
                if (payload?.id) {
                  onSelectRow(payload.id, payload.rowNum);
                }
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: tickTextColor, fontSize: 11 }}
              axisLine={{ stroke: axisLineColor }}
              tickLine={{ stroke: axisLineColor }}
            />
            <YAxis
              scale={scaleMode}
              domain={scaleMode === 'log' ? ['auto', 'auto'] : [0, 'auto']}
              tick={{ fill: yTickTextColor, fontSize: 11 }}
              axisLine={{ stroke: axisLineColor }}
              tickLine={{ stroke: axisLineColor }}
              tickFormatter={(val: number) =>
                val >= 1000
                  ? `${(val / 1000).toFixed(1)}k`
                  : val.toLocaleString('id-ID')
              }
              label={{
                value: `Beban Statis Aksial (${unitLabel})`,
                angle: -90,
                position: 'insideLeft',
                style: {
                  fill: yTickTextColor,
                  fontSize: 11,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                },
              }}
            />
            <Tooltip
              cursor={{ fill: cursorFill }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-md shadow-lg border border-slate-700 text-xs font-mono space-y-1.5">
                    <div className="font-sans font-semibold text-white border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
                      <span>{item.label}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        d3 = {item.d3.toFixed(3)} mm
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Luas Geser Inti (Ac):{' '}
                      <strong className="text-white">
                        {item.coreAreaMm2.toLocaleString('id-ID')} mm²
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sky-300">
                      <span>Fmaks Baja C45 (65 MPa):</span>
                      <strong>
                        {item.c45Load.toLocaleString('id-ID')} {unitLabel}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-amber-300">
                      <span>Fmaks Perunggu (30 MPa):</span>
                      <strong>
                        {item.bronzeLoad.toLocaleString('id-ID')} {unitLabel}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-emerald-300 pt-1 border-t border-slate-700">
                      <span>
                        Izin Baris ({item.materialShort}, {item.tauActive} MPa):
                      </span>
                      <strong>
                        {item.activeLoad.toLocaleString('id-ID')} {unitLabel}
                      </strong>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '12px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                paddingTop: '8px',
              }}
            />
            <Bar
              dataKey="c45Load"
              name={`Kapasitas Baja C45 (τ=65 MPa) [${unitLabel}]`}
              fill="#2563EB"
              radius={[4, 4, 0, 0]}
              maxBarSize={42}
            />
            <Bar
              dataKey="bronzeLoad"
              name={`Kapasitas Perunggu CuSn12 (τ=30 MPa) [${unitLabel}]`}
              fill="#D97706"
              radius={[4, 4, 0, 0]}
              maxBarSize={42}
            />
            <Line
              type="monotone"
              dataKey="activeLoad"
              name={`Beban Izin Material Baris Aktif [${unitLabel}]`}
              stroke="#059669"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#059669', strokeWidth: 1.5, stroke: '#FFFFFF' }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
