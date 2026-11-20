import React, { useState } from 'react';
import {
  TrCalculatedRow,
  THREAD_MATERIAL_SPECS,
} from '../data/trThreadData';
import {
  WireInspectionRecord,
  SUPABASE_SCHEMA_SQL,
} from '../services/threadDatabaseService';

interface SupabaseSyncDashboardPanelProps {
  projectName: string;
  preparedBy: string;
  onChangeProjectName: (val: string) => void;
  onChangePreparedBy: (val: string) => void;
  projectRows: TrCalculatedRow[];
  wireInspections: WireInspectionRecord[];
  selectedRow: TrCalculatedRow;
  activeMeasuredWireM: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  onPushToSupabase: () => Promise<void>;
  onPullFromSupabase: () => Promise<void>;
  onLogActiveWireInspection: (customM?: number) => Promise<void>;
  onAddActiveRowToSupabase: () => void;
  onSelectProjectRow: (rowId: string) => void;
  onOpenProjectView: () => void;
}

export const SupabaseSyncDashboardPanel: React.FC<
  SupabaseSyncDashboardPanelProps
> = ({
  projectName,
  preparedBy,
  onChangeProjectName,
  onChangePreparedBy,
  projectRows,
  wireInspections,
  selectedRow,
  activeMeasuredWireM,
  isSyncing,
  lastSyncedAt,
  onPushToSupabase,
  onPullFromSupabase,
  onLogActiveWireInspection,
  onAddActiveRowToSupabase,
  onSelectProjectRow,
  onOpenProjectView,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    'project_rows' | 'wire_inspections' | 'workspace_sql'
  >('project_rows');
  const [quickWireInputM, setQuickWireInputM] = useState<string>(() =>
    activeMeasuredWireM.toFixed(3)
  );
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Otomatis';

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
      {/* Top Bar: Unboxed Domain Summary & Direct Sync Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Sinkronisasi Database Supabase — Lembar Kerja Proyek &amp; Inspeksi QC 3-Kawat
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            <span className="font-sans text-slate-700 font-medium">
              {projectName}
            </span>
            <span aria-hidden="true">·</span>
            <span>thread_project_rows: {projectRows.length} baris</span>
            <span aria-hidden="true">·</span>
            <span>
              thread_wire_inspections: {wireInspections.length} rekaman
            </span>
            <span aria-hidden="true">·</span>
            <span>Sinkron terakhir: {formattedSyncTime}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPushToSupabase}
            disabled={isSyncing}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan ke Supabase'}
          </button>

          <button
            type="button"
            onClick={onPullFromSupabase}
            disabled={isSyncing}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            Muat dari Supabase
          </button>

          <button
            type="button"
            onClick={() => onLogActiveWireInspection()}
            disabled={isSyncing}
            className="px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            + Catat QC 3-Kawat ({selectedRow.designation})
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            {isExpanded ? 'Sembunyikan Tabel' : 'Tampilkan Tabel Sinkronisasi'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-3 border-t border-slate-200 space-y-3">
          {/* Interactive Segmented Control for the 3 Synchronized Supabase Tables */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('project_rows')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'project_rows'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel thread_project_rows ({projectRows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('wire_inspections')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'wire_inspections'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel thread_wire_inspections ({wireInspections.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('workspace_sql')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'workspace_sql'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel thread_workspaces &amp; Skema SQL
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAddActiveRowToSupabase}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors whitespace-nowrap"
              >
                + Tambah Baris Aktif ({selectedRow.designation}) ke Proyek &amp; Supabase
              </button>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={onOpenProjectView}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2 transition-colors whitespace-nowrap"
              >
                Buka Editor Lembar Kerja Penuh
              </button>
            </div>
          </div>

          {/* TAB 1: public.thread_project_rows */}
          {activeTab === 'project_rows' && (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                    <th className="py-2 px-2.5 font-semibold">No</th>
                    <th className="py-2 px-2.5 font-semibold">Designation</th>
                    <th className="py-2 px-2.5 font-semibold">Jenis</th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      d × P (mm)
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      d2 Tengah (mm)
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      d3 Inti (mm)
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      Ac Geser (mm²)
                    </th>
                    <th className="py-2 px-2.5 font-semibold">Material</th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      Fmaks Izin (kN)
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      Beban Kerja (kN)
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      Safety Factor
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-right">
                      Torsi Kerja (Nm)
                    </th>
                    <th className="py-2 px-2.5 font-semibold text-center">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {projectRows.map((row, idx) => {
                    const sf =
                      row.appliedLoadKn > 0
                        ? (
                            row.maxStaticLoadActiveKn / row.appliedLoadKn
                          ).toFixed(2)
                        : '∞';
                    const isSelected = row.id === selectedRow.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => onSelectProjectRow(row.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-900">
                          {row.designation}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600">
                          {row.threadType || 'TR'} ({row.threadAngleDeg}°)
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-700">
                          {row.d.toFixed(2)} × {row.p.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-700">
                          {row.d2.toFixed(3)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-blue-700 font-medium">
                          {row.d3.toFixed(3)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800">
                          {row.coreAreaMm2.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 font-sans text-slate-700">
                          {THREAD_MATERIAL_SPECS[row.materialGrade]?.shortLabel ||
                            row.materialGrade}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900">
                          {row.maxStaticLoadActiveKn.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800">
                          {row.appliedLoadKn.toFixed(2)}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-semibold ${
                            row.isLoadSafe
                              ? 'text-emerald-800'
                              : 'text-rose-700'
                          }`}
                        >
                          {sf}× ({row.isLoadSafe ? 'AMAN' : 'OVERLOAD'})
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800">
                          {row.tighteningTorqueWorkNm.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProjectRow(row.id);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Inspeksi
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: public.thread_wire_inspections */}
          {activeTab === 'wire_inspections' && (
            <div className="space-y-3">
              {/* Quick 3-Wire Measurement Logger to Supabase */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-slate-700">
                  <span className="font-sans font-medium text-slate-900">
                    Input Cepat Mikrometer 3-Kawat ({selectedRow.designation}):
                  </span>
                  <span>d_w = {selectedRow.bestWireSize.toFixed(3)} mm</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Batas 7e: {selectedRow.wireMMin7e.toFixed(3)} ..{' '}
                    {selectedRow.wireMMax7e.toFixed(3)} mm
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-slate-600">M Ukur (mm):</label>
                  <input
                    type="number"
                    step="0.001"
                    value={quickWireInputM}
                    onChange={(e) => setQuickWireInputM(e.target.value)}
                    className="w-28 px-2 py-1 text-right font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseFloat(quickWireInputM);
                      if (!Number.isNaN(parsed) && parsed > 0) {
                        void onLogActiveWireInspection(parsed);
                      }
                    }}
                    className="px-3 py-1 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                  >
                    Simpan ke thread_wire_inspections
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-md">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                      <th className="py-2 px-2.5 font-semibold">Waktu QC</th>
                      <th className="py-2 px-2.5 font-semibold">Designation</th>
                      <th className="py-2 px-2.5 font-semibold text-right">
                        Kawat d_w (mm)
                      </th>
                      <th className="py-2 px-2.5 font-semibold text-right">
                        M Terukur (mm)
                      </th>
                      <th className="py-2 px-2.5 font-semibold text-right">
                        Rentang 7e Min..Max (mm)
                      </th>
                      <th className="py-2 px-2.5 font-semibold text-right">
                        d2 Aktual (mm)
                      </th>
                      <th className="py-2 px-2.5 font-semibold">
                        Keputusan QC 7e/7H
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {wireInspections.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-4 px-3 text-center font-sans text-slate-500"
                        >
                          Belum ada log inspeksi 3-kawat di tabel{' '}
                          <code className="font-mono">
                            thread_wire_inspections
                          </code>
                          . Klik tombol{' '}
                          <strong>
                            + Catat QC 3-Kawat ({selectedRow.designation})
                          </strong>{' '}
                          di atas untuk menyimpan pembacaan mikrometer ke
                          Supabase.
                        </td>
                      </tr>
                    ) : (
                      wireInspections.map((item, idx) => (
                        <tr
                          key={item.id || `${item.rowId}-${idx}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="py-1.5 px-2.5 text-slate-500">
                            {new Date(item.inspectedAt).toLocaleString(
                              'id-ID',
                              {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              }
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-900">
                            {item.designation}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-700">
                            {item.bestWireSizeMm.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900">
                            {item.measuredWireMMm.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">
                            {item.wireMMin7eMm.toFixed(3)} ..{' '}
                            {item.wireMMax7eMm.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-blue-700">
                            {item.inferredD2Mm.toFixed(3)}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 font-sans font-semibold ${
                              item.qcStatus === 'GO'
                                ? 'text-emerald-800'
                                : 'text-rose-700'
                            }`}
                          >
                            {item.qcStatus === 'GO'
                              ? 'GO (Masuk Toleransi 7e)'
                              : item.qcStatus === 'NO_GO_UNDERSIZE'
                              ? 'NO-GO (Undersize < Min 7e)'
                              : 'NO-GO (Oversize > Max 7e)'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: public.thread_workspaces & SQL Schema */}
          {activeTab === 'workspace_sql' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3 border border-slate-200 rounded-md p-3">
                <div className="text-xs font-semibold text-slate-900">
                  Metadata Tabel public.thread_workspaces (ID: default)
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Nama Proyek Teknik (project_name):
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => onChangeProjectName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Disusun Oleh / Divisi QC (prepared_by):
                    </label>
                    <input
                      type="text"
                      value={preparedBy}
                      onChange={(e) => onChangePreparedBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="pt-1 flex items-center justify-between text-slate-500">
                    <span>
                      Perubahan otomatis tersinkron ke Supabase setiap Anda
                      mengetik atau menekan tombol Sinkronkan.
                    </span>
                    <button
                      type="button"
                      onClick={onPushToSupabase}
                      className="px-3 py-1 font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors shrink-0"
                    >
                      Simpan Metadata
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Skema SQL Supabase (supabase/schema.sql)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors"
                  >
                    {copiedSql ? 'SQL Tersalin' : 'Salin Skema SQL'}
                  </button>
                </div>
                <pre className="max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-700 leading-relaxed">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
