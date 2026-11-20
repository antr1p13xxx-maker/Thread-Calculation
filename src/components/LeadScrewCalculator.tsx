import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { TrCalculatedRow, generateCncGCode } from '../data/trThreadData';

interface LeadScrewCalculatorProps {
  row: TrCalculatedRow;
}

export const LeadScrewCalculator: React.FC<LeadScrewCalculatorProps> = ({
  row,
}) => {
  const [axialLoadN, setAxialLoadN] = useState<number>(15000); // 15 kN (~1.5 Ton)
  const [frictionMu, setFrictionMu] = useState<number>(0.12); // Bronze on steel lubricated
  const [nutLengthMm, setNutLengthMm] = useState<number>(
    Math.round(row.d * 1.8)
  );
  const [spindleRpm, setSpindleRpm] = useState<number>(300);
  const [isInternalGCode, setIsInternalGCode] = useState<boolean>(false);
  const [copiedGCode, setCopiedGCode] = useState<boolean>(false);

  // Mechanics calculations for 30 deg Trapezoidal Thread:
  // Flank half-angle beta = 15 degrees
  const betaRad = (15 * Math.PI) / 180;
  // Equivalent friction coefficient mu' = mu / cos(15 deg)
  const muPrime = frictionMu / Math.cos(betaRad);
  const rhoPrimeRad = Math.atan(muPrime);
  const rhoPrimeDeg = (rhoPrimeRad * 180) / Math.PI;
  const lambdaRad = (row.leadAngleDeg * Math.PI) / 180;

  // Torque to raise/move against axial load F:
  // T_R = (F * d2 / 2) * tan(lambda + rho') (in N*mm -> divide by 1000 for N*m)
  const torqueRaiseNm =
    ((axialLoadN * (row.d2 / 1000)) / 2) * Math.tan(lambdaRad + rhoPrimeRad);

  // Torque to lower load F:
  // T_L = (F * d2 / 2) * tan(rho' - lambda)
  const torqueLowerNm =
    ((axialLoadN * (row.d2 / 1000)) / 2) * Math.tan(rhoPrimeRad - lambdaRad);

  // Mechanical efficiency eta = tan(lambda) / tan(lambda + rho')
  const efficiencyPct =
    (Math.tan(lambdaRad) / Math.tan(lambdaRad + rhoPrimeRad)) * 100;

  // Is truly self-locking at this friction coefficient?
  const isSelfLockingNow = row.leadAngleDeg < rhoPrimeDeg;

  // Tensile / compressive stress sigma = F / As (MPa = N / mm^2)
  const axialStressMpa = axialLoadN / Math.max(1, row.stressAreaMm2);

  // Engaged threads in nut z_e = nutLengthMm / P
  const engagedThreads = Math.max(1, nutLengthMm / row.p);
  // Flank bearing pressure p_B = F / (pi * d2 * H1 * z_e) (MPa)
  const bearingPressureMpa =
    axialLoadN /
    Math.max(1, Math.PI * row.d2 * row.H1 * engagedThreads);

  // Linear travel speed v = (RPM * Ph) / 60 (mm/s)
  const linearSpeedMmSec = (spindleRpm * row.ph) / 60;
  // Required Drive Power P_kW = (T_R * 2 * pi * n) / (60 * 1000)
  const powerKw = (torqueRaiseNm * 2 * Math.PI * spindleRpm) / 60000;

  const gcodeText = generateCncGCode(row, isInternalGCode, spindleRpm);

  const handleCopyGCode = () => {
    navigator.clipboard.writeText(gcodeText);
    setCopiedGCode(true);
    setTimeout(() => setCopiedGCode(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Lead Screw Mechanics & Load Calculator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 transition-colors">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            01. Kalkulator Mekanika Spindel & Torsi ({row.designation})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Analisis torsi pengangkatan, efisiensi mekanis, tekanan bidang kontak mur, dan status self-locking.
          </p>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Beban Aksial F (N)
            </label>
            <input
              type="number"
              min={100}
              step={500}
              value={axialLoadN}
              onChange={(e) => setAxialLoadN(Math.max(0, Number(e.target.value)))}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Koef. Gesek (μ)
            </label>
            <select
              value={frictionMu}
              onChange={(e) => setFrictionMu(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-600"
            >
              <option value={0.08}>0.08 (Perunggu + Oli)</option>
              <option value={0.10}>0.10 (Perunggu + Gemuk)</option>
              <option value={0.12}>0.12 (Baja/Bronze Standar)</option>
              <option value={0.15}>0.15 (Besi Cor / Kering)</option>
              <option value={0.18}>0.18 (Baja ke Baja Kering)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Panjang Mur (mm)
            </label>
            <input
              type="number"
              min={row.p * 2}
              step={5}
              value={nutLengthMm}
              onChange={(e) =>
                setNutLengthMm(Math.max(row.p, Number(e.target.value)))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Putaran (RPM)
            </label>
            <input
              type="number"
              min={1}
              step={10}
              value={spindleRpm}
              onChange={(e) =>
                setSpindleRpm(Math.max(1, Number(e.target.value)))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Calculated Results Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-200 dark:divide-slate-800 text-xs">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-slate-600 dark:text-slate-400">
              Torsi Angkat / Dorong (T<sub>R</sub>)
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {torqueRaiseNm.toFixed(2)} N·m
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-slate-600 dark:text-slate-400">
              Torsi Turun / Balik (T<sub>L</sub>)
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {torqueLowerNm.toFixed(2)} N·m
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-slate-600 dark:text-slate-400">Efisiensi Mekanis Ulir (η)</span>
            <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
              {efficiencyPct.toFixed(1)} %
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-slate-600 dark:text-slate-400">
              Status Penguncian Otomatis (Self-Locking)
            </span>
            <span
              className={`font-mono font-semibold ${
                isSelfLockingNow
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {isSelfLockingNow
                ? `Ya — Mengunci (λ = ${row.leadAngleDeg}° < ρ' = ${rhoPrimeDeg.toFixed(2)}°)`
                : `Tidak Mengunci (λ = ${row.leadAngleDeg}° ≥ ρ' = ${rhoPrimeDeg.toFixed(2)}°)`}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-slate-600 dark:text-slate-400">
              Tegangan Aksial Inti Baut (σ = F / A<sub>s</sub>)
            </span>
            <span
              className={`font-mono font-semibold ${
                axialStressMpa > 120
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {axialStressMpa.toFixed(1)} MPa ({row.stressAreaMm2} mm²)
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-slate-600 dark:text-slate-400">
              Tekanan Kontak Gigi Mur (p<sub>B</sub> pada {engagedThreads.toFixed(1)} lilitan)
            </span>
            <span
              className={`font-mono font-semibold ${
                bearingPressureMpa > 15
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {bearingPressureMpa.toFixed(2)} MPa
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-slate-600 dark:text-slate-400">
              Kecepatan Linear & Daya Motor ({spindleRpm} RPM)
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {linearSpeedMmSec.toFixed(1)} mm/dtk · {powerKw.toFixed(2)} kW
            </span>
          </div>
        </div>
      </div>

      {/* Right: CNC Lathe G-Code & Tooling Sheet */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 transition-colors">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                02. Generator Program Bubut CNC (Fanuc G76) & Geometri Pahat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Parameter penyayatan ulir trapesium 30° otomatis untuk mesin bubut CNC.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              <button
                type="button"
                onClick={() => setIsInternalGCode(false)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  !isInternalGCode
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Ulir Luar (Baut)
              </button>
              <button
                type="button"
                onClick={() => setIsInternalGCode(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  isInternalGCode
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Ulir Dalam (Mur)
              </button>
            </div>
          </div>

          {/* Tooling summary strip */}
          <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-md border border-slate-200 dark:border-slate-700/80">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Sudut Pahat / Infeed</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                30° (Infeed 29°)
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Lebar Ujung Pahat (w)</span>
              <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                {row.w.toFixed(3)} mm
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Dalam Pemakanan (h3)</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {row.h3.toFixed(3)} mm (~{row.recommendedPasses}x pass)
              </span>
            </div>
          </div>

          {/* G-Code Output Block */}
          <div className="relative">
            <pre className="p-3.5 bg-[#0F172A] dark:bg-slate-950 border border-transparent dark:border-slate-800 text-slate-100 rounded-md text-xs font-mono overflow-x-auto leading-relaxed">
              {gcodeText}
            </pre>
            <button
              type="button"
              onClick={handleCopyGCode}
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors"
            >
              {copiedGCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Salin G-Code
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          Catatan Bengkel: Untuk ulir luar {row.designation}, periksa ukuran di atas 3 kawat ukur{' '}
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            dw = {row.bestWireSize.toFixed(3)} mm
          </strong>{' '}
          hingga mikrometer menunjukkan{' '}
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            M = {row.measureOverWires.toFixed(3)} mm
          </strong>.
        </div>
      </div>
    </div>
  );
};
