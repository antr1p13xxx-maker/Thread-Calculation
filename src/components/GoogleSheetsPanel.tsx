import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Download,
  Upload,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Copy,
  Code2,
} from 'lucide-react';
import { TrCalculatedRow } from '../data/trThreadData';
import { CODE_GS_SOURCE } from '../services/appsScriptCode';
import {
  SpreadsheetMetadata,
  createCompleteTrSpreadsheet,
  getSpreadsheetMetadata,
  readRowsFromSheetTab,
  updateSheetTabWithRows,
} from '../services/googleSheetsService';

interface GoogleSheetsPanelProps {
  user: User | null;
  accessToken: string | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  standardRows: TrCalculatedRow[];
  projectRows: TrCalculatedRow[];
  onImportProjectRows: (rows: TrCalculatedRow[], mode: 'replace' | 'append') => void;
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  user,
  accessToken,
  needsAuth,
  isLoggingIn,
  onLogin,
  onLogout,
  standardRows,
  projectRows,
  onImportProjectRows,
}) => {
  const [newSheetTitle, setNewSheetTitle] = useState(
    'Thread Calculation — Database & Kalkulator Ulir (ISO 2901 / DIN 103)'
  );
  const [useLiveFormulas, setUseLiveFormulas] = useState(true);

  const [existingInputUrl, setExistingInputUrl] = useState('');
  const [connectedMeta, setConnectedMeta] =
    useState<SpreadsheetMetadata | null>(null);
  const [selectedTabTitle, setSelectedTabTitle] = useState<string>('');
  const [syncSource, setSyncSource] = useState<'project' | 'standard'>('project');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Mandatory Confirmation Dialog state before mutating/overwriting existing Google Sheet data
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const [copiedCodeGs, setCopiedCodeGs] = useState(false);

  const handleCopyCodeGs = () => {
    navigator.clipboard.writeText(CODE_GS_SOURCE);
    setCopiedCodeGs(true);
    setTimeout(() => setCopiedCodeGs(false), 2200);
  };

  const handleDownloadCodeGs = () => {
    const blob = new Blob([CODE_GS_SOURCE], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateNewSheet = async () => {
    if (!accessToken) {
      setStatusMessage({
        type: 'error',
        text: 'Silakan masuk dengan akun Google terlebih dahulu.',
      });
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const meta = await createCompleteTrSpreadsheet(
        accessToken,
        newSheetTitle,
        standardRows,
        projectRows,
        useLiveFormulas
      );
      setConnectedMeta(meta);
      setExistingInputUrl(meta.spreadsheetUrl);
      if (meta.sheets.length > 0) {
        setSelectedTabTitle(meta.sheets[0].title);
      }
      setStatusMessage({
        type: 'success',
        text: `Berhasil membuat Google Spreadsheet "${meta.title}" dengan 3 tab (Standar_ISO_DIN103, Lembar_Kerja_Proyek, Rumus_Referensi_TR).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Gagal membuat Google Spreadsheet baru.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleFetchMetadata = async () => {
    if (!accessToken) {
      setStatusMessage({
        type: 'error',
        text: 'Silakan masuk dengan akun Google terlebih dahulu.',
      });
      return;
    }
    if (!existingInputUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan URL atau ID Google Spreadsheet terlebih dahulu.',
      });
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const meta = await getSpreadsheetMetadata(accessToken, existingInputUrl);
      setConnectedMeta(meta);
      if (meta.sheets.length > 0) {
        setSelectedTabTitle(meta.sheets[0].title);
      }
      setStatusMessage({
        type: 'info',
        text: `Terhubung ke "${meta.title}" (${meta.sheets.length} tab ditemukan). Pilih tab untuk membaca atau memperbarui data.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Gagal mengambil metadata spreadsheet.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFromSheet = async () => {
    if (!accessToken || !connectedMeta || !selectedTabTitle) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const rows = await readRowsFromSheetTab(
        accessToken,
        connectedMeta.spreadsheetId,
        selectedTabTitle
      );
      if (rows.length === 0) {
        setStatusMessage({
          type: 'error',
          text: `Tidak ditemukan baris spesifikasi ulir TR yang valid pada tab "${selectedTabTitle}". Pastikan kolom C berisi diameter d (mm) dan kolom D berisi pitch P (mm).`,
        });
      } else {
        onImportProjectRows(rows, importMode);
        setStatusMessage({
          type: 'success',
          text: `Berhasil mengimpor ${rows.length} baris spesifikasi ulir TR dari tab "${selectedTabTitle}" ke Lembar Kerja Proyek.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Gagal membaca data dari Google Sheet.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmedOverwrite = async () => {
    setConfirmOverwriteOpen(false);
    if (!accessToken || !connectedMeta || !selectedTabTitle) return;

    const rowsToPush = syncSource === 'project' ? projectRows : standardRows;
    const includeProjectCols = syncSource === 'project';

    setIsBusy(true);
    setStatusMessage(null);
    try {
      const res = await updateSheetTabWithRows(
        accessToken,
        connectedMeta.spreadsheetId,
        selectedTabTitle,
        rowsToPush,
        useLiveFormulas,
        includeProjectCols
      );
      setStatusMessage({
        type: 'success',
        text: `Berhasil memperbarui tab "${selectedTabTitle}" pada "${connectedMeta.title}" (${res.updatedRows} baris, ${res.updatedCells} sel diperbarui).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Gagal memperbarui Google Sheet.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const rowsToPushCount =
    syncSource === 'project' ? projectRows.length : standardRows.length;

  return (
    <div className="space-y-6">
      {/* Connection Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Integrasi Langsung Google Sheets (REST API v4)
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Ekspor seluruh tabel standar ISO 2902 / DIN 103 beserta rumus hidup Google Sheets, atau sinkronkan daftar ulir proyek Anda langsung ke Google Spreadsheet milik Anda.
            </p>
          </div>

          {/* Auth Status / Official Sign in with Google button */}
          <div className="flex items-center gap-3">
            {needsAuth || !accessToken ? (
              <button
                type="button"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
                  </span>
                  <span style={{ display: 'none' }}>Sign in with Google</span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-600">
                  Terhubung sebagai{' '}
                  <strong className="text-slate-900 font-medium">
                    {user?.email || user?.displayName || 'Akun Google'}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-red-600 font-medium transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status feedback banner */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-md border text-xs flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : statusMessage.type === 'error'
                ? 'bg-red-50/80 border-red-200 text-red-900'
                : 'bg-blue-50/80 border-blue-200 text-blue-900'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
          </div>
        )}
      </div>

      {/* Two-Column Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Create Brand New Google Spreadsheet */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                01. Buat File Google Spreadsheet Baru (3 Tab Lengkap)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Membuat spreadsheet baru di Google Drive Anda berisi tab{' '}
                <span className="font-mono text-slate-700">Standar_ISO_DIN103</span> ({standardRows.length} baris),{' '}
                <span className="font-mono text-slate-700">Lembar_Kerja_Proyek</span> ({projectRows.length} baris), dan{' '}
                <span className="font-mono text-slate-700">Rumus_Referensi_TR</span>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Judul Google Spreadsheet Baru
              </label>
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder="Contoh: Standar & Proyek Ulir Trapesium DIN 103"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useLiveFormulas}
                onChange={(e) => setUseLiveFormulas(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700">
                <strong>Sertakan Rumus Google Sheets Aktif</strong> — menulis rumus asli seperti{' '}
                <code className="font-mono text-blue-700">=ROUND(C2-0.5*D2, 3)</code> pada sel{' '}
                <code className="font-mono">d2, d3, D1, D4, H1, h3, ac, f, w, dw, M</code> sehingga nilai otomatis dihitung ulang di Google Sheets saat Anda mengubah diameter atau pitch.
              </span>
            </label>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Total data: {standardRows.length + projectRows.length} baris ulir
            </span>
            <button
              type="button"
              onClick={handleCreateNewSheet}
              disabled={isBusy || !accessToken}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              {isBusy ? 'Memproses...' : 'Buat Google Sheet Baru'}
            </button>
          </div>
        </div>

        {/* Column 2: Connect & Sync Existing Google Spreadsheet */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                02. Hubungkan Spreadsheet yang Ada (Impor / Update Tab)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan URL atau ID Google Spreadsheet untuk memuat daftar nama tab secara dinamis, mengimpor baris ke aplikasi, atau memperbarui tab tertentu.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={existingInputUrl}
                onChange={(e) => setExistingInputUrl(e.target.value)}
                placeholder="Tempel URL Google Sheets atau Spreadsheet ID..."
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 font-mono"
              />
              <button
                type="button"
                onClick={handleFetchMetadata}
                disabled={isBusy || !accessToken}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Cek Tab Sheet
              </button>
            </div>

            {connectedMeta && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {connectedMeta.title}
                    </span>
                  </div>
                  <a
                    href={connectedMeta.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
                  >
                    Buka di Google Sheets
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Pilih Tab Sheet Tujuan / Sumber
                    </label>
                    <select
                      value={selectedTabTitle}
                      onChange={(e) => setSelectedTabTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                    >
                      {connectedMeta.sheets.map((s) => (
                        <option key={s.sheetId} value={s.title}>
                          {s.title} ({s.rowCount} baris)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Data untuk Dikirim (Saat Update)
                    </label>
                    <select
                      value={syncSource}
                      onChange={(e) =>
                        setSyncSource(e.target.value as 'project' | 'standard')
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                    >
                      <option value="project">
                        Lembar Kerja Proyek ({projectRows.length} baris)
                      </option>
                      <option value="standard">
                        Tabel Standar Terfilter ({standardRows.length} baris)
                      </option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <select
                      value={importMode}
                      onChange={(e) =>
                        setImportMode(e.target.value as 'append' | 'replace')
                      }
                      className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    >
                      <option value="append">Tambahkan ke Proyek</option>
                      <option value="replace">Ganti Isi Proyek</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleImportFromSheet}
                      disabled={isBusy || !selectedTabTitle}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Impor dari Tab Ini
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmOverwriteOpen(true)}
                    disabled={isBusy || !selectedTabTitle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Update Tab Google Sheet
                  </button>
                </div>
              </div>
            )}
          </div>

          {!connectedMeta && (
            <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500">
              Tips: Buat spreadsheet baru pada panel sebelah kiri untuk langsung terhubung otomatis, atau tempel URL Google Sheets Anda di atas.
            </div>
          )}
        </div>
      </div>

      {/* PANEL GOOGLE APPS SCRIPT (CODE.GS) UNTUK EKSTENSI GOOGLE SHEETS */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Google Apps Script (Code.gs) — Otomasi Menu &amp; Rumus Kustom di Google Sheets
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Salin atau unduh file <code className="font-mono text-slate-800">Code.gs</code> ini ke dalam{' '}
              <strong>Extensions &rarr; Apps Script</strong> di Google Spreadsheet Anda untuk menambahkan menu{' '}
              <strong>⚙️ Thread Calculation</strong> serta fungsi sel kustom{' '}
              <code className="font-mono text-blue-700">=THREAD_CALC()</code>,{' '}
              <code className="font-mono text-blue-700">=THREAD_TORQUE()</code>,{' '}
              <code className="font-mono text-blue-700">=THREAD_3WIRE_CHECK()</code>, dan{' '}
              <code className="font-mono text-blue-700">=THREAD_MAX_LOAD_KN()</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCodeGs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600" />
              {copiedCodeGs ? 'Code.gs Tersalin!' : 'Salin Code.gs'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCodeGs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh File Code.gs
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#0F172A] text-slate-100 font-mono text-xs overflow-x-auto max-h-[380px] overflow-y-auto">
          <pre className="leading-relaxed select-all">{CODE_GS_SOURCE}</pre>
        </div>
      </div>

      {/* MANDATORY CONFIRMATION DIALOG FOR MUTATING / OVERWRITING GOOGLE SHEETS DATA */}
      {confirmOverwriteOpen && connectedMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-sheet-overwrite-title"
        >
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 shadow-lg space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-amber-50 text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="confirm-sheet-overwrite-title"
                  className="text-sm font-semibold text-slate-900"
                >
                  Konfirmasi Perubahan Data di Google Sheets
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tindakan ini akan menghapus isi lama dan menulis ulang data baru pada tab yang dipilih di Google Spreadsheet Anda:
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-slate-500">Spreadsheet:</span>{' '}
                <strong className="text-slate-900">{connectedMeta.title}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tab Tujuan:</span>{' '}
                <strong className="text-blue-700">{selectedTabTitle}</strong>
              </div>
              <div>
                <span className="text-slate-500">Sumber Data:</span>{' '}
                <strong className="text-slate-900">
                  {syncSource === 'project'
                    ? 'Lembar Kerja Proyek'
                    : 'Tabel Standar ISO 2902'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Jumlah Baris:</span>{' '}
                <strong className="text-slate-900">
                  {rowsToPushCount} baris data + 1 baris header
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Mode Rumus:</span>{' '}
                <strong className="text-slate-900">
                  {useLiveFormulas
                    ? 'Rumus Google Sheets Aktif (USER_ENTERED)'
                    : 'Nilai Numerik Statis'}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOverwriteOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmedOverwrite}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                Konfirmasi & Update Google Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
