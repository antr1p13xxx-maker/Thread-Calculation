import React, { useState } from 'react';
import {
  TrCalculatedRow,
  THREAD_MATERIAL_SPECS,
} from '../data/trThreadData';
import type { WireInspectionRecord } from '../services/threadDatabaseService';
import { FIREBASE_CONFIG_SUMMARY, type User } from '../firebase';

interface FirebaseSyncDashboardPanelProps {
  firebaseUser: User | null;
  isAuthReady: boolean;
  isAuthBusy: boolean;
  onFirebaseSignIn: () => Promise<void>;
  onFirebaseSignOut: () => Promise<void>;
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
  onSyncToFirebase: () => Promise<void>;
  onPullFromFirebase: () => Promise<void>;
  onLogActiveWireInspection: (customM?: number) => Promise<void>;
  onAddActiveRowToProject: () => void;
  onSelectProjectRow: (rowId: string) => void;
  onOpenProjectView: () => void;
}

const firestoreDbId =
  (FIREBASE_CONFIG_SUMMARY as { firestoreDatabaseId?: string })
    .firestoreDatabaseId || '-default-';

const FIREBASE_CONSOLE_URL = `https://console.firebase.google.com/project/${FIREBASE_CONFIG_SUMMARY.projectId}/firestore/databases/${firestoreDbId}/data`;

export const FirebaseSyncDashboardPanel: React.FC<
  FirebaseSyncDashboardPanelProps
> = ({
  firebaseUser,
  isAuthReady,
  isAuthBusy,
  onFirebaseSignIn,
  onFirebaseSignOut,
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
  onSyncToFirebase,
  onPullFromFirebase,
  onLogActiveWireInspection,
  onAddActiveRowToProject,
  onSelectProjectRow,
  onOpenProjectView,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    'project_rows' | 'wire_inspections' | 'firebase_config'
  >('project_rows');
  const [quickWireInputM, setQuickWireInputM] = useState<string>(() =>
    activeMeasuredWireM.toFixed(3)
  );
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);

  const configJsonText = JSON.stringify(FIREBASE_CONFIG_SUMMARY, null, 2);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configJsonText);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Menunggu Login';

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3.5 transition-colors">
      {/* Top Bar: Unboxed Domain Summary & Direct Firebase Sync Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Sinkronisasi Database Google Firebase Console (Cloud Firestore)
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            <span className="font-sans text-slate-700 dark:text-slate-300 font-medium">
              {projectName}
            </span>
            <span aria-hidden="true">·</span>
            <span>Project: {FIREBASE_CONFIG_SUMMARY.projectId}</span>
            <span aria-hidden="true">·</span>
            <span>
              {firebaseUser
                ? `Terhubung: ${firebaseUser.email || firebaseUser.uid}`
                : isAuthReady
                ? 'Mode Lokal (Masuk Google untuk Sinkron Cloud Firestore)'
                : 'Memeriksa Sesi Firebase...'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Sinkron terakhir: {formattedSyncTime}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!firebaseUser ? (
            <button
              type="button"
              onClick={onFirebaseSignIn}
              disabled={isAuthBusy || !isAuthReady}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {isAuthBusy
                ? 'Menghubungkan...'
                : 'Masuk Google & Hubungkan Firestore'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onSyncToFirebase}
                disabled={isSyncing}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                {isSyncing ? 'Menyinkronkan...' : 'Simpan ke Firestore'}
              </button>

              <button
                type="button"
                onClick={onPullFromFirebase}
                disabled={isSyncing}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                Muat dari Firestore
              </button>

              <button
                type="button"
                onClick={() => onLogActiveWireInspection()}
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs font-medium text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                + Catat QC 3-Kawat ({selectedRow.designation})
              </button>

              <button
                type="button"
                onClick={onFirebaseSignOut}
                disabled={isAuthBusy}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Keluar
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            {isExpanded ? 'Sembunyikan Tabel' : 'Tampilkan Tabel Firestore'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {/* Interactive Segmented Control for Firestore Collections */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('project_rows')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'project_rows'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Koleksi projectRows ({projectRows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('wire_inspections')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'wire_inspections'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Koleksi wireInspections ({wireInspections.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('firebase_config')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'firebase_config'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Konfigurasi Firebase Console &amp; Metadata
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAddActiveRowToProject}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors whitespace-nowrap"
              >
                + Tambah Baris Aktif ({selectedRow.designation}) ke Firestore
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <button
                type="button"
                onClick={onOpenProjectView}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-2 transition-colors whitespace-nowrap"
              >
                Buka Editor Lembar Kerja Penuh
              </button>
            </div>
          </div>

          {/* TAB 1: /workspaces/{uid}/projectRows */}
          {activeTab === 'project_rows' && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans">
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
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
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
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-slate-500 dark:text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          {row.designation}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400">
                          {row.threadType || 'TR'} ({row.threadAngleDeg}°)
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-700 dark:text-slate-300">
                          {row.d.toFixed(2)} × {row.p.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-700 dark:text-slate-300">
                          {row.d2.toFixed(3)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-blue-700 dark:text-blue-400 font-medium">
                          {row.d3.toFixed(3)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800 dark:text-slate-200">
                          {row.coreAreaMm2.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 font-sans text-slate-700 dark:text-slate-300">
                          {THREAD_MATERIAL_SPECS[row.materialGrade]?.shortLabel ||
                            row.materialGrade}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {row.maxStaticLoadActiveKn.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800 dark:text-slate-200">
                          {row.appliedLoadKn.toFixed(2)}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-semibold ${
                            row.isLoadSafe
                              ? 'text-emerald-800 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {sf}× ({row.isLoadSafe ? 'AMAN' : 'OVERLOAD'})
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800 dark:text-slate-200">
                          {row.tighteningTorqueWorkNm.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProjectRow(row.id);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
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

          {/* TAB 2: /workspaces/{uid}/wireInspections */}
          {activeTab === 'wire_inspections' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  <span className="font-sans font-medium text-slate-900 dark:text-slate-100">
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
                  <label className="text-slate-600 dark:text-slate-400">M Ukur (mm):</label>
                  <input
                    type="number"
                    step="0.001"
                    value={quickWireInputM}
                    onChange={(e) => setQuickWireInputM(e.target.value)}
                    className="w-28 px-2 py-1 text-right font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:border-blue-600"
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
                    Simpan ke Firestore (wireInspections)
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans">
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
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {wireInspections.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-4 px-3 text-center font-sans text-slate-500 dark:text-slate-400"
                        >
                          Belum ada rekaman inspeksi 3-kawat di koleksi{' '}
                          <code className="font-mono">wireInspections</code>.
                          Klik <strong>+ Catat QC 3-Kawat</strong> untuk
                          menyimpan ke Firestore.
                        </td>
                      </tr>
                    ) : (
                      wireInspections.map((item, idx) => (
                        <tr
                          key={item.id || `${item.rowId}-${idx}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-1.5 px-2.5 text-slate-500 dark:text-slate-400">
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
                          <td className="py-1.5 px-2.5 font-semibold text-slate-900 dark:text-slate-100">
                            {item.designation}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-700 dark:text-slate-300">
                            {item.bestWireSizeMm.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {item.measuredWireMMm.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600 dark:text-slate-400">
                            {item.wireMMin7eMm.toFixed(3)} ..{' '}
                            {item.wireMMax7eMm.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-blue-700 dark:text-blue-400">
                            {item.inferredD2Mm.toFixed(3)}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 font-sans font-semibold ${
                              item.qcStatus === 'GO'
                                ? 'text-emerald-800 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
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

          {/* TAB 3: Metadata & Firebase Console Configuration */}
          {activeTab === 'firebase_config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3 border border-slate-200 dark:border-slate-800 rounded-md p-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Metadata Dokumen /workspaces/
                  {firebaseUser ? firebaseUser.uid : '{uid}'}
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">
                      Nama Proyek Teknik (projectName):
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={projectName}
                      onChange={(e) => onChangeProjectName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">
                      Disusun Oleh / Divisi QC (preparedBy):
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      value={preparedBy}
                      onChange={(e) => onChangePreparedBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
                    <a
                      href={FIREBASE_CONSOLE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline underline-offset-2"
                    >
                      Buka Cloud Firestore di Firebase Console
                    </a>
                    <button
                      type="button"
                      onClick={
                        firebaseUser ? onSyncToFirebase : onFirebaseSignIn
                      }
                      className="px-3 py-1 font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                    >
                      {firebaseUser
                        ? 'Simpan Metadata ke Firestore'
                        : 'Masuk Google untuk Simpan'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Konfigurasi Firebase Console (firebase-applet-config.json)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyConfig}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copiedConfig ? 'Tersalin' : 'Salin JSON'}
                  </button>
                </div>
                <pre className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
                  {configJsonText}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
