import React, { useState } from 'react';
import { TrCalculatedRow } from '../data/trThreadData';
import { THREAD_FAMILY_METADATA } from '../data/multiThreadCatalog';

interface ThreadProfileSvgProps {
  row: TrCalculatedRow;
}

export const ThreadProfileSvg: React.FC<ThreadProfileSvgProps> = ({ row }) => {
  const [viewMode, setViewMode] = useState<'assembled' | 'external' | 'internal' | '3wire'>('assembled');

  const tType = row.threadType || 'TR';
  const famInfo = THREAD_FAMILY_METADATA[tType] || THREAD_FAMILY_METADATA.TR;
  const angleLabel =
    tType === 'BUTTRESS_S'
      ? '3° / 30° (Gergaji)'
      : tType === 'SQ'
      ? '0° (Persegi)'
      : `α = ${row.threadAngleDeg ?? 30}°`;

  // Dynamic SVG path for External (Bolt) and Internal (Nut) based on thread family
  let externalPath =
    'M 110 235 L 180 235 L 220 95 L 300 95 L 340 235 L 400 235 L 440 95 L 520 95 L 560 235 L 590 235 L 590 285 L 110 285 Z';
  let internalPath =
    'M 110 30 L 590 30 L 590 215 L 555 215 L 515 75 L 445 75 L 405 215 L 335 215 L 295 75 L 225 75 L 185 215 L 110 215 Z';

  if (tType === 'SQ') {
    // Rectangular 0 deg flanks
    externalPath =
      'M 110 235 L 205 235 L 205 95 L 315 95 L 315 235 L 425 235 L 425 95 L 535 95 L 535 235 L 590 235 L 590 285 L 110 285 Z';
    internalPath =
      'M 110 30 L 590 30 L 590 215 L 535 215 L 535 75 L 425 75 L 425 215 L 315 215 L 315 75 L 205 75 L 205 215 L 110 215 Z';
  } else if (tType === 'BUTTRESS_S') {
    // Asymmetric Buttress: near-vertical 3 deg load flank on left, 30 deg slope on right
    externalPath =
      'M 110 235 L 200 235 L 208 95 L 265 95 L 345 235 L 420 235 L 428 95 L 485 95 L 565 235 L 590 235 L 590 285 L 110 285 Z';
    internalPath =
      'M 110 30 L 590 30 L 590 215 L 560 215 L 482 75 L 428 75 L 420 215 L 340 215 L 262 75 L 208 75 L 200 215 L 110 215 Z';
  } else if (tType === 'METRIC_M' || tType === 'UNC_UNF') {
    // 60 deg V-thread (narrow crest P/8, root P/4)
    externalPath =
      'M 110 235 L 165 235 L 246 95 L 274 95 L 355 235 L 385 235 L 466 95 L 494 95 L 575 235 L 590 235 L 590 285 L 110 285 Z';
    internalPath =
      'M 110 30 L 590 30 L 590 215 L 565 215 L 492 75 L 468 75 L 395 215 L 345 215 L 272 75 L 248 75 L 175 215 L 110 215 Z';
  } else if (tType === 'BSW_BSF' || tType === 'BSP_NPT') {
    // 55 deg Whitworth / Pipe with slightly narrower crest
    externalPath =
      'M 110 235 L 172 235 L 242 95 L 278 95 L 348 235 L 392 235 L 462 95 L 498 95 L 568 235 L 590 235 L 590 285 L 110 285 Z';
    internalPath =
      'M 110 30 L 590 30 L 590 215 L 562 215 L 495 75 L 465 75 L 398 215 L 342 215 L 275 75 L 245 75 L 178 215 L 110 215 Z';
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden transition-colors">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Penampang Geometri Profil Ulir {row.designation} ({famInfo.shortName} — {angleLabel})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {famInfo.standardRef} · Pitch P = {row.p} mm
            {row.tpi ? ` (${row.tpi} TPI)` : ''} · Kelonggaran Puncak ac = {row.ac} mm
          </p>
        </div>

        {/* Interactive segmented control for blueprint mode */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-md">
          <button
            type="button"
            onClick={() => setViewMode('assembled')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'assembled'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Rakitan Baut & Mur
          </button>
          <button
            type="button"
            onClick={() => setViewMode('external')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'external'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Ulir Luar (Baut)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('internal')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'internal'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Ulir Dalam (Mur)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3wire')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === '3wire'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Uji 3-Kawat (dw)
          </button>
        </div>
      </div>

      {/* Blueprint SVG Canvas */}
      <div className="p-4 bg-[#0F172A] dark:bg-slate-950 text-slate-100 relative">
        <svg
          viewBox="0 0 820 340"
          className="w-full h-auto max-h-[340px] select-none font-mono"
          role="img"
          aria-label={`Diagram penampang teknis ulir trapesium ${row.designation}`}
        >
          <defs>
            <pattern
              id="blueprint-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#1E293B"
                strokeWidth="1"
              />
            </pattern>
            <pattern
              id="hatch-external"
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke="#38BDF8"
                strokeWidth="1.5"
                strokeOpacity="0.35"
              />
            </pattern>
            <pattern
              id="hatch-internal"
              width="8"
              height="8"
              patternTransform="rotate(-45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeOpacity="0.35"
              />
            </pattern>
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
            </marker>
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#FBBF24" />
            </marker>
            <marker
              id="arrow-emerald"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#34D399" />
            </marker>
          </defs>

          {/* Background Grid */}
          <rect width="820" height="340" fill="url(#blueprint-grid)" />

          {/* Reference Datum Lines */}
          {/* D4 Line (Internal Major): y = 75 */}
          <line
            x1="70"
            y1="75"
            x2="650"
            y2="75"
            stroke="#F59E0B"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          {/* d Line (External Major / Crest): y = 95 */}
          <line
            x1="70"
            y1="95"
            x2="650"
            y2="95"
            stroke="#38BDF8"
            strokeWidth="1"
            strokeDasharray="6 3"
            opacity="0.8"
          />
          {/* d2 = D2 Pitch Line: y = 155 */}
          <line
            x1="50"
            y1="155"
            x2="680"
            y2="155"
            stroke="#34D399"
            strokeWidth="1.5"
            strokeDasharray="10 4 2 4"
          />
          {/* D1 Line (Internal Minor / Tap Bore): y = 215 */}
          <line
            x1="70"
            y1="215"
            x2="650"
            y2="215"
            stroke="#F59E0B"
            strokeWidth="1"
            strokeDasharray="6 3"
            opacity="0.8"
          />
          {/* d3 Line (External Minor / Root): y = 235 */}
          <line
            x1="70"
            y1="235"
            x2="650"
            y2="235"
            stroke="#38BDF8"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.7"
          />

          {/* Spindle Axis Line */}
          <line
            x1="40"
            y1="310"
            x2="780"
            y2="310"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="16 5 3 5"
          />
          <text x="50" y="326" fill="#94A3B8" fontSize="10">
            GARIS SUMBU ULIR (AXIS OF THREAD)
          </text>

          {/* INTERNAL THREAD (MUR / NUT) PROFILE */}
          {(viewMode === 'assembled' || viewMode === 'internal') && (
            <g>
              <path
                d={internalPath}
                fill="url(#hatch-internal)"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <text
                x="125"
                y="52"
                fill="#FBBF24"
                fontSize="11"
                fontWeight="600"
              >
                ULIR DALAM (MUR / NUT) — TOLERANSI {row.intTolClass}
              </text>
            </g>
          )}

          {/* EXTERNAL THREAD (BAUT / SCREW) PROFILE */}
          {(viewMode === 'assembled' ||
            viewMode === 'external' ||
            viewMode === '3wire') && (
            <g>
              <path
                d={externalPath}
                fill="url(#hatch-external)"
                stroke="#38BDF8"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <text
                x="125"
                y="272"
                fill="#38BDF8"
                fontSize="11"
                fontWeight="600"
              >
                ULIR LUAR (BAUT / SPINDEL) — TOLERANSI {row.extTolClass}
              </text>
            </g>
          )}

          {/* 3-WIRE MEASUREMENT OVERLAY */}
          {viewMode === '3wire' && (
            <g>
              <circle
                cx="370"
                cy="155"
                r="32"
                fill="#10B981"
                fillOpacity="0.25"
                stroke="#34D399"
                strokeWidth="2"
              />
              <line
                x1="338"
                y1="155"
                x2="402"
                y2="155"
                stroke="#34D399"
                strokeWidth="1.5"
                markerStart="url(#arrow-emerald)"
                markerEnd="url(#arrow-emerald)"
              />
              <text
                x="335"
                y="112"
                fill="#34D399"
                fontSize="11"
                fontWeight="600"
              >
                Kawat Uji dw = {row.bestWireSize.toFixed(3)} mm
              </text>
              <text x="335" y="96" fill="#A7F3D0" fontSize="11">
                Ukuran M = {row.measureOverWires.toFixed(3)} mm
              </text>
            </g>
          )}

          {/* DIMENSION ANNOTATIONS */}
          {/* Pitch P annotation between two crests */}
          <line
            x1="260"
            y1="95"
            x2="260"
            y2="52"
            stroke="#38BDF8"
            strokeWidth="1"
          />
          <line
            x1="480"
            y1="95"
            x2="480"
            y2="52"
            stroke="#38BDF8"
            strokeWidth="1"
          />
          <line
            x1="262"
            y1="58"
            x2="478"
            y2="58"
            stroke="#38BDF8"
            strokeWidth="1.5"
            markerStart="url(#arrow-cyan)"
            markerEnd="url(#arrow-cyan)"
          />
          <rect x="325" y="45" width="95" height="18" rx="3" fill="#0F172A" />
          <text
            x="372"
            y="58"
            textAnchor="middle"
            fill="#38BDF8"
            fontSize="11"
            fontWeight="600"
          >
            P = {row.p} mm
          </text>

          {/* Crest width f */}
          <line
            x1="220"
            y1="112"
            x2="300"
            y2="112"
            stroke="#E2E8F0"
            strokeWidth="1.2"
            markerStart="url(#arrow-cyan)"
            markerEnd="url(#arrow-cyan)"
          />
          <text
            x="260"
            y="126"
            textAnchor="middle"
            fill="#E2E8F0"
            fontSize="10"
          >
            f={row.f.toFixed(2)}
          </text>

          {/* Root width w */}
          <line
            x1="340"
            y1="250"
            x2="400"
            y2="250"
            stroke="#FBBF24"
            strokeWidth="1.2"
            markerStart="url(#arrow-amber)"
            markerEnd="url(#arrow-amber)"
          />
          <text
            x="370"
            y="264"
            textAnchor="middle"
            fill="#FBBF24"
            fontSize="10"
          >
            w={row.w.toFixed(2)}
          </text>

          {/* Flank Angle indicator */}
          <path
            d="M 328 195 A 45 45 0 0 1 412 195"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="1.5"
          />
          <text
            x="370"
            y="186"
            textAnchor="middle"
            fill="#FBBF24"
            fontSize="11"
            fontWeight="600"
          >
            {angleLabel}
          </text>

          {/* Crest Clearance ac */}
          <text x="452" y="88" fill="#FBBF24" fontSize="10">
            ac = {row.ac} mm
          </text>

          {/* H1 & h3 Height Indicators on Left */}
          <line
            x1="88"
            y1="95"
            x2="88"
            y2="215"
            stroke="#34D399"
            strokeWidth="1.3"
            markerStart="url(#arrow-emerald)"
            markerEnd="url(#arrow-emerald)"
          />
          <text x="42" y="150" fill="#34D399" fontSize="10" fontWeight="600">
            H1={row.H1}
          </text>

          <line
            x1="102"
            y1="95"
            x2="102"
            y2="235"
            stroke="#38BDF8"
            strokeWidth="1.3"
            markerStart="url(#arrow-cyan)"
            markerEnd="url(#arrow-cyan)"
          />
          <text x="42" y="172" fill="#38BDF8" fontSize="10" fontWeight="600">
            h3={row.h3}
          </text>

          {/* Right-hand Diameter Callouts */}
          <g fontSize="11" fontWeight="500">
            <text x="658" y="79" fill="#FBBF24">
              D4 = {row.D4.toFixed(3)} mm (Mur Luar)
            </text>
            <text x="658" y="99" fill="#38BDF8">
              d = {row.d.toFixed(3)} mm (Nominal)
            </text>
            <text x="686" y="159" fill="#34D399" fontWeight="600">
              d2 = D2 = {row.d2.toFixed(3)} mm
            </text>
            <text x="658" y="219" fill="#FBBF24">
              D1 = {row.D1.toFixed(3)} mm (Bor Mur)
            </text>
            <text x="658" y="239" fill="#38BDF8">
              d3 = {row.d3.toFixed(3)} mm (Inti Baut)
            </text>
          </g>
        </svg>
      </div>

      {/* Quick Geometry Formula Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Dia. Luar (d)</div>
          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {row.d.toFixed(2)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Dia. Pitch (d2)</div>
          <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
            {row.d2.toFixed(3)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Inti Baut (d3)</div>
          <div className="font-mono font-semibold text-blue-700 dark:text-blue-400 mt-0.5">
            {row.d3.toFixed(3)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Bor Mur (D1)</div>
          <div className="font-mono font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
            {row.D1.toFixed(3)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Tinggi Ulir (h3)</div>
          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {row.h3.toFixed(3)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Ujung Pahat (w)</div>
          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {row.w.toFixed(3)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Kawat Uji (dw)</div>
          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {row.bestWireSize.toFixed(3)} mm
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-slate-500 dark:text-slate-400">Ukuran 3-Kawat (M)</div>
          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {row.measureOverWires.toFixed(3)} mm
          </div>
        </div>
      </div>
    </div>
  );
};
