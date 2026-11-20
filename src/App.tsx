import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Download,
  Plus,
  Trash2,
  Copy,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ISO_2902_STANDARD_SPECS,
  FULL_MATRIX_TR8_TO_1120_SPECS,
  ALL_STANDARD_PITCHES,
  ALL_TR_DIAMETERS,
  SPREADSHEET_COLUMNS,
  THREAD_MATERIAL_SPECS,
  TrCalculatedRow,
  ThreadSeries,
  ExternalTolClass,
  InternalTolClass,
  ThreadMaterialGrade,
  calculateTrThread,
  getInitialProjectWorksheet,
} from './data/trThreadData';
import {
  ThreadStandardFamily,
  THREAD_FAMILY_METADATA,
  METRIC_M_SPECS,
  SQUARE_SQ_SPECS,
  BUTTRESS_S_SPECS,
  ACME_SPECS,
  UNC_UNF_SPECS,
  BSW_BSF_SPECS,
  BSP_NPT_SPECS,
  ALL_NON_TR_SPECS,
  MultiThreadSpecItem,
} from './data/multiThreadCatalog';
import { ThreadProfileSvg } from './components/ThreadProfileSvg';
import { LeadScrewCalculator } from './components/LeadScrewCalculator';
import { ProjectLoadChart } from './components/ProjectLoadChart';
import { ToleranceCalculatorPanel } from './components/ToleranceCalculatorPanel';
import { AdvancedTorqueCalculatorPanel } from './components/AdvancedTorqueCalculatorPanel';
import { Thread3DPreviewPanel } from './components/Thread3DPreviewPanel';
import { FrictionTorqueChartPanel } from './components/FrictionTorqueChartPanel';
import { FirebaseSyncDashboardPanel } from './components/FirebaseSyncDashboardPanel';
import { exportProjectWorksheetToPdf } from './services/pdfReportService';
import {
  auth,
  onAuthStateChanged,
  signInWithFirebaseGoogle,
  signOutFirebase,
  type User,
} from './firebase';
import {
  loadWorkspaceFromFirestore,
  saveWorkspaceToFirestore,
  logWireInspectionToFirestore,
  subscribeToWireInspections,
} from './services/firebaseThreadService';
import {
  loadPersistedWorkspace,
  savePersistedWorkspace,
  resetPersistedWorkspace,
  logWireInspectionReading,
  fetchWireInspectionsFromSupabase,
  WireInspectionRecord,
} from './services/threadDatabaseService';

type ActiveView = 'standard' | 'project' | 'cad_calc';
type ColumnGroup = 'all' | 'basic' | 'profile' | 'tolerance' | 'inspection';
type PitchCatalogMode = 'standard_multi' | 'full_matrix';

export default function App() {
  // Light / Dark Mode state synced with early script in index.html
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('thread-calc-theme', theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  // Navigation state
  const [activeView, setActiveView] = useState<ActiveView>('standard');

  // Standard Table Filters & Parameters
  const [threadFamilyFilter, setThreadFamilyFilter] = useState<
    ThreadStandardFamily | 'ALL'
  >('TR');
  const [catalogMode, setCatalogMode] =
    useState<PitchCatalogMode>('standard_multi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<'all' | ThreadSeries>('all');
  const [colGroup, setColGroup] = useState<ColumnGroup>('all');
  const [diaRange, setDiaRange] = useState<
    'all' | 'small' | 'medium' | 'large' | 'heavy_300_600' | 'ultra_620_1120'
  >('all');
  const [exactDiameterFilter, setExactDiameterFilter] = useState<
    number | 'all'
  >('all');
  const [exactPitchFilter, setExactPitchFilter] = useState<number | 'all'>(
    'all'
  );
  const [globalStarts, setGlobalStarts] = useState<number>(1);
  const [extTolClass, setExtTolClass] = useState<ExternalTolClass>('7e');
  const [intTolClass, setIntTolClass] = useState<InternalTolClass>('7H');

  // 3-Wire Go/No-Go Tolerance Limit Check State (Class 7e / 7H)
  const [isToleranceCheckEnabled, setIsToleranceCheckEnabled] =
    useState<boolean>(true);
  const [wireCheckPreset, setWireCheckPreset] = useState<
    | 'mixed_qc'
    | 'target_7e'
    | 'nominal_basic_d2'
    | 'undersize_nogo'
    | 'oversize_nogo'
  >('mixed_qc');
  const [customMeasuredWireM, setCustomMeasuredWireM] = useState<
    Record<string, number>
  >({});
  const [onlyShowOutOfTolRows, setOnlyShowOutOfTolRows] =
    useState<boolean>(false);

  const evaluate3WireGoNoGo7e7H = (row: TrCalculatedRow) => {
    let measuredM = customMeasuredWireM[row.id];
    if (measuredM === undefined || Number.isNaN(measuredM)) {
      if (wireCheckPreset === 'target_7e') {
        measuredM = row.wireMTarget7e;
      } else if (wireCheckPreset === 'nominal_basic_d2') {
        measuredM = row.measureOverWires;
      } else if (wireCheckPreset === 'undersize_nogo') {
        measuredM = Number((row.wireMMin7e - 0.065).toFixed(3));
      } else if (wireCheckPreset === 'oversize_nogo') {
        measuredM = Number((row.wireMMax7e + 0.055).toFixed(3));
      } else {
        // 'mixed_qc': deterministic shop-floor QC sample where specific rows are out-of-spec
        const hash = Math.round(row.d * 3 + row.p * 7);
        if (hash % 5 === 1) {
          // Undersize / worn (< M_min 7e)
          measuredM = Number((row.wireMMin7e - 0.048).toFixed(3));
        } else if (hash % 5 === 3) {
          // Cut to basic pitch diameter d2 without 7e negative deviation es (> M_max 7e)
          measuredM = row.measureOverWires;
        } else {
          measuredM = row.wireMTarget7e;
        }
      }
    }

    const inferredD2 = Number(
      (row.d2 + (measuredM - row.measureOverWires)).toFixed(3)
    );
    const isBelowMin7e = measuredM < row.wireMMin7e - 0.0004;
    const isAboveMax7e = measuredM > row.wireMMax7e + 0.0004;
    const isOutOfRange = isBelowMin7e || isAboveMax7e;

    let outOfBoundsUm = 0;
    if (isBelowMin7e) {
      outOfBoundsUm = Math.round((measuredM - row.wireMMin7e) * 1000);
    } else if (isAboveMax7e) {
      outOfBoundsUm = Math.round((measuredM - row.wireMMax7e) * 1000);
    }

    const statusLabel = isBelowMin7e
      ? 'NO-GO (< Min 7e)'
      : isAboveMax7e
      ? 'NO-GO (> Max 7e)'
      : 'GO (7e/7H OK)';

    return {
      measuredM,
      inferredD2,
      isBelowMin7e,
      isAboveMax7e,
      isOutOfRange,
      outOfBoundsUm,
      statusLabel,
    };
  };

  // Pagination for fast rendering of 1,300 - 2,300 rows
  const [pageSize, setPageSize] = useState<number>(300);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const activeSpecs = useMemo<MultiThreadSpecItem[]>(() => {
    const trList: MultiThreadSpecItem[] = (
      catalogMode === 'full_matrix'
        ? FULL_MATRIX_TR8_TO_1120_SPECS
        : ISO_2902_STANDARD_SPECS
    ).map((s) => ({
      threadType: 'TR',
      designation: `Tr ${s.d} x ${s.p}`,
      d: s.d,
      p: s.p,
      series: s.series,
    }));

    if (threadFamilyFilter === 'TR') return trList;
    if (threadFamilyFilter === 'METRIC_M') return METRIC_M_SPECS;
    if (threadFamilyFilter === 'SQ') return SQUARE_SQ_SPECS;
    if (threadFamilyFilter === 'BUTTRESS_S') return BUTTRESS_S_SPECS;
    if (threadFamilyFilter === 'ACME') return ACME_SPECS;
    if (threadFamilyFilter === 'UNC_UNF') return UNC_UNF_SPECS;
    if (threadFamilyFilter === 'BSW_BSF') return BSW_BSF_SPECS;
    if (threadFamilyFilter === 'BSP_NPT') return BSP_NPT_SPECS;
    // 'ALL' combines standard TR + all 7 other complete thread families
    const stdTrList: MultiThreadSpecItem[] = ISO_2902_STANDARD_SPECS.map(
      (s) => ({
        threadType: 'TR',
        designation: `Tr ${s.d} x ${s.p}`,
        d: s.d,
        p: s.p,
        series: s.series,
      })
    );
    return [...stdTrList, ...ALL_NON_TR_SPECS];
  }, [threadFamilyFilter, catalogMode]);

  // Calculate all standard rows dynamically based on starts & tolerance class
  const allStandardRows = useMemo(() => {
    return activeSpecs.map((spec, idx) =>
      calculateTrThread(
        spec.d,
        spec.p,
        spec.series,
        globalStarts,
        extTolClass,
        intTolClass,
        {
          id: `std-${spec.threadType}-${catalogMode}-${idx}-${spec.d}x${spec.p}`,
          threadType: spec.threadType,
          customDesignation: spec.designation,
          tpi: spec.tpi,
          angleDegOverride: spec.angleDeg,
        }
      )
    );
  }, [activeSpecs, catalogMode, globalStarts, extTolClass, intTolClass]);

  const filteredStandardRows = useMemo(() => {
    return allStandardRows.filter((row) => {
      if (seriesFilter !== 'all' && row.series !== seriesFilter) return false;
      if (exactDiameterFilter !== 'all' && row.d !== exactDiameterFilter)
        return false;
      if (exactPitchFilter !== 'all' && row.p !== exactPitchFilter) return false;

      if (diaRange === 'small' && (row.d < 8 || row.d > 30)) return false;
      if (diaRange === 'medium' && (row.d < 32 || row.d > 100)) return false;
      if (diaRange === 'large' && (row.d < 105 || row.d > 300)) return false;
      if (diaRange === 'heavy_300_600' && (row.d < 310 || row.d > 600))
        return false;
      if (diaRange === 'ultra_620_1120' && row.d < 620) return false;

      if (onlyShowOutOfTolRows) {
        const check = evaluate3WireGoNoGo7e7H(row);
        if (!check.isOutOfRange) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const compactDesig = row.designation.toLowerCase().replace(/\s+/g, '');
        const compactQuery = q.replace(/\s+/g, '');
        return (
          row.designation.toLowerCase().includes(q) ||
          compactDesig.includes(compactQuery) ||
          String(row.d) === q ||
          `tr${row.d}` === compactQuery
        );
      }
      return true;
    });
  }, [
    allStandardRows,
    seriesFilter,
    exactDiameterFilter,
    exactPitchFilter,
    diaRange,
    searchQuery,
    onlyShowOutOfTolRows,
    wireCheckPreset,
    customMeasuredWireM,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    threadFamilyFilter,
    catalogMode,
    seriesFilter,
    exactDiameterFilter,
    exactPitchFilter,
    diaRange,
    searchQuery,
    pageSize,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStandardRows.length / pageSize)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const visibleStandardRows = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredStandardRows.slice(startIdx, startIdx + pageSize);
  }, [filteredStandardRows, safeCurrentPage, pageSize]);

  // Custom Project Worksheet State
  const [projectRows, setProjectRows] = useState<TrCalculatedRow[]>(() =>
    getInitialProjectWorksheet()
  );

  // New Custom Row Form State
  const [customThreadType, setCustomThreadType] =
    useState<ThreadStandardFamily>('TR');
  const [customD, setCustomD] = useState<number>(36);
  const [customP, setCustomP] = useState<number>(6);
  const [customStarts, setCustomStarts] = useState<number>(1);
  const [customMaterialGrade, setCustomMaterialGrade] =
    useState<ThreadMaterialGrade>('C45');
  const [customAppliedLoadKn, setCustomAppliedLoadKn] = useState<number>(25);
  const [customFrictionMu, setCustomFrictionMu] = useState<number>(
    THREAD_MATERIAL_SPECS.C45.defaultFrictionMu
  );
  const [customLength, setCustomLength] = useState<number>(1000);
  const [customNotes, setCustomNotes] = useState<string>(
    'Spindel tekan beban statis aksial'
  );

  // PDF Report Header Metadata State
  const [reportProjectName, setReportProjectName] = useState<string>(
    'Spindel & Mur Ulir Trapesium Workshop Utama'
  );
  const [reportPreparedBy, setReportPreparedBy] = useState<string>(
    'Tim Rekayasa Mekanik & QC'
  );
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState<boolean>(false);
  const [isFirebaseAuthBusy, setIsFirebaseAuthBusy] = useState<boolean>(false);
  const [wireInspections, setWireInspections] = useState<
    WireInspectionRecord[]
  >([]);
  const [isDatabaseSyncing, setIsDatabaseSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsFirebaseAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Load initial local/fallback workspace on mount
  useEffect(() => {
    let active = true;
    Promise.all([
      loadPersistedWorkspace(),
      fetchWireInspectionsFromSupabase(30),
    ])
      .then(([persisted, inspections]) => {
        if (!active) return;
        if (persisted.projectName) {
          setReportProjectName(persisted.projectName);
        }
        if (persisted.preparedBy) {
          setReportPreparedBy(persisted.preparedBy);
        }
        if (
          Array.isArray(persisted.projectRows) &&
          persisted.projectRows.length > 0
        ) {
          setProjectRows(persisted.projectRows);
        }
        if (
          persisted.customMeasuredWireM &&
          typeof persisted.customMeasuredWireM === 'object'
        ) {
          setCustomMeasuredWireM(persisted.customMeasuredWireM);
        }
        if (
          persisted.wireCheckPreset === 'mixed_qc' ||
          persisted.wireCheckPreset === 'target_7e' ||
          persisted.wireCheckPreset === 'nominal_basic_d2' ||
          persisted.wireCheckPreset === 'undersize_nogo' ||
          persisted.wireCheckPreset === 'oversize_nogo'
        ) {
          setWireCheckPreset(persisted.wireCheckPreset);
        }
        if (Array.isArray(inspections)) {
          setWireInspections(inspections);
        }
        setLastSyncedAt(persisted.updatedAt || new Date().toISOString());
        setIsWorkspaceLoaded(true);
      })
      .catch(() => {
        if (active) setIsWorkspaceLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync with Firebase Cloud Firestore when authenticated & subscribe to 3-wire QC logs
  useEffect(() => {
    if (!isFirebaseAuthReady || !firebaseUser) return;
    let active = true;
    setIsDatabaseSyncing(true);

    loadWorkspaceFromFirestore(firebaseUser.uid)
      .then(async (remote) => {
        if (!active) return;
        if (remote && remote.projectRows.length > 0) {
          setReportProjectName(remote.projectName);
          setReportPreparedBy(remote.preparedBy);
          setProjectRows(remote.projectRows);
          setCustomMeasuredWireM(remote.customMeasuredWireM || {});
          if (
            remote.wireCheckPreset === 'mixed_qc' ||
            remote.wireCheckPreset === 'target_7e' ||
            remote.wireCheckPreset === 'nominal_basic_d2' ||
            remote.wireCheckPreset === 'undersize_nogo' ||
            remote.wireCheckPreset === 'oversize_nogo'
          ) {
            setWireCheckPreset(remote.wireCheckPreset);
          }
          setLastSyncedAt(remote.updatedAt || new Date().toISOString());
        } else {
          // Seed initial workspace into Firestore for first-time Firebase user
          const syncedAt = await saveWorkspaceToFirestore(firebaseUser.uid, {
            projectName: reportProjectName,
            preparedBy: reportPreparedBy,
            projectRows,
            customMeasuredWireM,
            wireCheckPreset,
          });
          if (active) setLastSyncedAt(syncedAt);
        }
      })
      .catch((err) => {
        console.error('Firestore initial sync error:', err);
      })
      .finally(() => {
        if (active) setIsDatabaseSyncing(false);
      });

    const unsubInspections = subscribeToWireInspections(
      firebaseUser.uid,
      (records) => {
        if (active) setWireInspections(records);
      },
      30,
      (errInfo) => {
        console.error('Firestore wire inspections subscription error:', errInfo);
        if (active) {
          triggerToast(
            `Gagal menyinkronkan log inspeksi 3-kawat: ${errInfo.error}`
          );
        }
      }
    );

    return () => {
      active = false;
      unsubInspections();
    };
  }, [isFirebaseAuthReady, firebaseUser?.uid]);

  const inlineWireLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  useEffect(() => {
    return () => {
      if (inlineWireLogTimerRef.current) {
        clearTimeout(inlineWireLogTimerRef.current);
      }
    };
  }, []);

  // Automatically persist changes to Firestore (when signed in) and local cache
  useEffect(() => {
    if (!isWorkspaceLoaded) return;
    const timer = setTimeout(() => {
      const payload = {
        projectName: reportProjectName,
        preparedBy: reportPreparedBy,
        projectRows,
        customMeasuredWireM,
        wireCheckPreset,
      };
      void savePersistedWorkspace(payload).then((saved) => {
        if (!firebaseUser && saved.updatedAt) {
          setLastSyncedAt(saved.updatedAt);
        }
      });
      if (firebaseUser) {
        void saveWorkspaceToFirestore(firebaseUser.uid, payload)
          .then((ts) => setLastSyncedAt(ts))
          .catch((err) => console.error('Firestore auto-save error:', err));
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [
    isWorkspaceLoaded,
    firebaseUser,
    reportProjectName,
    reportPreparedBy,
    projectRows,
    customMeasuredWireM,
    wireCheckPreset,
  ]);

  const handleFirebaseSignIn = async () => {
    setIsFirebaseAuthBusy(true);
    try {
      const user = await signInWithFirebaseGoogle();
      triggerToast(
        `Terhubung ke Firebase Console sebagai ${user.email || user.uid}.`
      );
    } catch (err) {
      console.error('Firebase Google Sign-In error:', err);
      triggerToast('Gagal masuk dengan akun Google Firebase.');
    } finally {
      setIsFirebaseAuthBusy(false);
    }
  };

  const handleFirebaseSignOut = async () => {
    setIsFirebaseAuthBusy(true);
    try {
      await signOutFirebase();
      triggerToast('Sesi Firebase keluar. Data lokal tetap tersimpan.');
    } catch (err) {
      console.error('Firebase Sign-Out error:', err);
      triggerToast('Gagal keluar dari sesi Firebase.');
    } finally {
      setIsFirebaseAuthBusy(false);
    }
  };

  const handleManualSaveProject = async () => {
    setIsDatabaseSyncing(true);
    try {
      const payload = {
        projectName: reportProjectName,
        preparedBy: reportPreparedBy,
        projectRows,
        customMeasuredWireM,
        wireCheckPreset,
      };
      const saved = await savePersistedWorkspace(payload);
      if (firebaseUser) {
        const ts = await saveWorkspaceToFirestore(firebaseUser.uid, payload);
        setLastSyncedAt(ts);
        triggerToast(
          `Lembar Kerja Proyek (${projectRows.length} baris) berhasil disimpan ke Cloud Firestore.`
        );
      } else {
        if (saved.updatedAt) setLastSyncedAt(saved.updatedAt);
        triggerToast(
          `Disimpan secara lokal (${projectRows.length} baris). Masuk Google untuk menyimpan ke Firebase Console.`
        );
      }
    } catch (err) {
      console.error('Manual save project error:', err);
      triggerToast(
        'Gagal menyimpan ke Cloud Firestore. Data tersimpan di cache lokal.'
      );
    } finally {
      setIsDatabaseSyncing(false);
    }
  };

  const handlePullProjectFromDatabase = async () => {
    if (!firebaseUser) {
      await handleFirebaseSignIn();
      return;
    }
    setIsDatabaseSyncing(true);
    try {
      const remote = await loadWorkspaceFromFirestore(firebaseUser.uid);
      if (remote && remote.projectRows.length > 0) {
        setReportProjectName(remote.projectName);
        setReportPreparedBy(remote.preparedBy);
        setProjectRows(remote.projectRows);
        setCustomMeasuredWireM(remote.customMeasuredWireM || {});
        setLastSyncedAt(remote.updatedAt || new Date().toISOString());
        triggerRowEntryAnimation(remote.projectRows.map((r) => r.id));
        triggerToast(
          `Berhasil memuat ${remote.projectRows.length} baris proyek terbaru dari Cloud Firestore.`
        );
      } else {
        await handleManualSaveProject();
      }
    } catch (err) {
      console.error('Pull project from Firestore error:', err);
      triggerToast('Gagal memuat data proyek dari Cloud Firestore.');
    } finally {
      setIsDatabaseSyncing(false);
    }
  };

  const handleResetProjectToDefault = async () => {
    try {
      const resetData = await resetPersistedWorkspace();
      setReportProjectName(resetData.projectName);
      setReportPreparedBy(resetData.preparedBy);
      setProjectRows(resetData.projectRows);
      setCustomMeasuredWireM(resetData.customMeasuredWireM);
      setWireCheckPreset('mixed_qc');
      if (firebaseUser) {
        try {
          const ts = await saveWorkspaceToFirestore(firebaseUser.uid, resetData);
          setLastSyncedAt(ts);
        } catch (err) {
          console.error('Firestore reset sync error:', err);
          triggerToast(
            'Templat lokal direset, namun sinkronisasi ke Cloud Firestore gagal.'
          );
          return;
        }
      }
      triggerToast('Lembar Kerja Proyek dikembalikan ke templat standar awal.');
    } catch (err) {
      console.error('Reset workspace error:', err);
      triggerToast('Gagal mereset Lembar Kerja Proyek.');
    }
  };

  const handleExportPdfReport = () => {
    if (projectRows.length === 0) {
      triggerToast('Tambahkan minimal 1 baris pada Lembar Kerja Proyek sebelum mencetak PDF.');
      return;
    }
    exportProjectWorksheetToPdf(projectRows, {
      projectName: reportProjectName,
      preparedBy: reportPreparedBy,
    });
    triggerToast('Laporan Teknis PDF dengan Kop Surat Thread Calculation berhasil diunduh.');
  };

  // Selected Cell & Selected Row for Formula Bar & CAD Inspector
  const [selectedRowId, setSelectedRowId] = useState<string>(
    () => allStandardRows[0]?.id || 'std-0'
  );
  const [selectedColLetter, setSelectedColLetter] = useState<string>('T');
  const [selectedRowNumber, setSelectedRowNumber] = useState<number>(1);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // State for Tailwind CSS fade-in & slide-down row entry transitions
  const [enteringRowIds, setEnteringRowIds] = useState<Record<string, boolean>>({});
  const [highlightedRowIds, setHighlightedRowIds] = useState<Record<string, boolean>>({});

  const triggerRowEntryAnimation = (ids: string[]) => {
    if (ids.length === 0) return;
    // Frame 1: Mount with initial pre-transition classes (opacity-0 -translate-y-2)
    setEnteringRowIds((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    setHighlightedRowIds((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    // Frame 2: Trigger Tailwind CSS transition to opacity-100 translate-y-0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEnteringRowIds((prev) => {
          const next = { ...prev };
          ids.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      });
    });

    // Clear soft accent highlight after transition settles
    setTimeout(() => {
      setHighlightedRowIds((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }, 900);
  };

  const triggerToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 2600);
  };

  const selectedRow: TrCalculatedRow = useMemo(() => {
    const fromProj = projectRows.find((r) => r.id === selectedRowId);
    if (fromProj) return fromProj;
    const fromStd = allStandardRows.find((r) => r.id === selectedRowId);
    if (fromStd) return fromStd;
    return filteredStandardRows[0] || allStandardRows[0];
  }, [selectedRowId, allStandardRows, projectRows, filteredStandardRows]);

  const activeColMeta = useMemo(() => {
    return (
      SPREADSHEET_COLUMNS.find((c) => c.colLetter === selectedColLetter) ||
      SPREADSHEET_COLUMNS[5]
    );
  }, [selectedColLetter]);

  // Determine which columns are visible in the Standard Table
  const isColVisible = (colLetter: string): boolean => {
    if (colGroup === 'all') return true;
    if (['A', 'B', 'C', 'D'].includes(colLetter)) return true;
    if (colGroup === 'basic') {
      return ['E', 'F', 'G', 'H', 'I'].includes(colLetter);
    }
    if (colGroup === 'profile') {
      return ['J', 'K', 'L', 'M', 'N'].includes(colLetter);
    }
    if (colGroup === 'tolerance') {
      return ['F', 'G', 'H', 'O', 'P', 'Q', 'R'].includes(colLetter);
    }
    if (colGroup === 'inspection') {
      return ['F', 'G', 'Q', 'R', 'S', 'T', 'U', 'V'].includes(colLetter);
    }
    return true;
  };

  // Add a standard row to the Custom Project Worksheet
  const handleAddRowToProject = (
    row: TrCalculatedRow,
    grade: ThreadMaterialGrade = 'C45'
  ) => {
    const matSpec = THREAD_MATERIAL_SPECS[grade];
    const newRow = calculateTrThread(
      row.d,
      row.p,
      row.series,
      row.starts,
      row.extTolClass,
      row.intTolClass,
      {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        threadType: row.threadType,
        customDesignation: row.designation,
        tpi: row.tpi,
        angleDegOverride: row.threadAngleDeg,
        materialGrade: grade,
        appliedLoadKn: row.appliedLoadKn,
        lengthMm: row.lengthMm ?? (row.d >= 300 ? 3500 : 500),
        material: matSpec.label,
        notes: `Salinan dari ${row.designation} (${matSpec.shortLabel})`,
      }
    );
    setProjectRows((prev) => [...prev, newRow]);
    setSelectedRowId(newRow.id);
    triggerRowEntryAnimation([newRow.id]);
    triggerToast(
      `${row.designation} (${matSpec.shortLabel}: Fmaks = ${newRow.maxStaticLoadActiveKn} kN) ditambahkan ke Proyek.`
    );
  };

  // Add both C45 and Bronze rows side-by-side for direct comparison in Project Worksheet
  const handleAddComparisonPairToProject = (row: TrCalculatedRow) => {
    const sharedTestLoadKn = Number((row.maxStaticLoadC45Kn * 0.7).toFixed(2));
    const c45Row = calculateTrThread(
      row.d,
      row.p,
      row.series,
      row.starts,
      row.extTolClass,
      row.intTolClass,
      {
        id: `proj-c45-${Date.now()}-1`,
        threadType: row.threadType,
        customDesignation: row.designation,
        tpi: row.tpi,
        angleDegOverride: row.threadAngleDeg,
        materialGrade: 'C45',
        appliedLoadKn: sharedTestLoadKn,
        lengthMm: row.lengthMm ?? 600,
        material: THREAD_MATERIAL_SPECS.C45.label,
        notes: `Komparasi C45 (${row.designation}) — Beban ${sharedTestLoadKn} kN Aman`,
      }
    );
    const bronzeRow = calculateTrThread(
      row.d,
      row.p,
      row.series,
      row.starts,
      row.extTolClass,
      row.intTolClass,
      {
        id: `proj-brz-${Date.now()}-2`,
        threadType: row.threadType,
        customDesignation: row.designation,
        tpi: row.tpi,
        angleDegOverride: row.threadAngleDeg,
        materialGrade: 'BRONZE',
        appliedLoadKn: sharedTestLoadKn,
        lengthMm: row.lengthMm ?? 600,
        material: THREAD_MATERIAL_SPECS.BRONZE.label,
        notes: `Komparasi Perunggu (${row.designation}) — Beban ${sharedTestLoadKn} kN Overload!`,
      }
    );
    setProjectRows((prev) => [...prev, c45Row, bronzeRow]);
    setSelectedRowId(c45Row.id);
    triggerRowEntryAnimation([c45Row.id, bronzeRow.id]);
    triggerToast(
      `Pasangan komparasi C45 vs Perunggu untuk ${row.designation} ditambahkan ke Lembar Kerja Proyek.`
    );
  };

  // Add a brand-new custom thread to Project Worksheet
  const handleCreateCustomProjectRow = (e: React.FormEvent) => {
    e.preventDefault();
    const validD = Math.max(2, Number(customD) || 20);
    const validP = Math.max(0.25, Number(customP) || 4);
    const matSpec = THREAD_MATERIAL_SPECS[customMaterialGrade];
    const famMeta = THREAD_FAMILY_METADATA[customThreadType];
    const newRow = calculateTrThread(
      validD,
      validP,
      1,
      customStarts,
      extTolClass,
      intTolClass,
      {
        id: `proj-custom-${Date.now()}`,
        threadType: customThreadType,
        materialGrade: customMaterialGrade,
        appliedLoadKn: Math.max(0, Number(customAppliedLoadKn) || 0),
        frictionMu: Math.max(0.01, Number(customFrictionMu) || matSpec.defaultFrictionMu),
        lengthMm: Math.max(10, Number(customLength) || 500),
        material: matSpec.label,
        notes: customNotes || famMeta.shortName,
      }
    );
    setProjectRows((prev) => [...prev, newRow]);
    setSelectedRowId(newRow.id);
    triggerRowEntryAnimation([newRow.id]);
    triggerToast(
      `Ulir ${newRow.designation} (${famMeta.shortName}, ${matSpec.shortLabel}, T = ${newRow.tighteningTorqueWorkNm} N·m) berhasil ditambahkan.`
    );
  };

  // Update an existing Project Row inline
  const handleUpdateProjectRow = (
    id: string,
    updates: Partial<{
      threadType: ThreadStandardFamily;
      d: number;
      p: number;
      starts: number;
      materialGrade: ThreadMaterialGrade;
      appliedLoadKn: number;
      frictionMu: number;
      extTolClass: ExternalTolClass;
      intTolClass: InternalTolClass;
      lengthMm: number;
      material: string;
      notes: string;
    }>
  ) => {
    setProjectRows((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextThreadType = updates.threadType ?? item.threadType ?? 'TR';
        const nextD = updates.d !== undefined ? Math.max(2, updates.d) : item.d;
        const nextP =
          updates.p !== undefined ? Math.max(0.25, updates.p) : item.p;
        const nextStarts =
          updates.starts !== undefined
            ? Math.max(1, Math.round(updates.starts))
            : item.starts;
        const nextExtTol = updates.extTolClass ?? item.extTolClass;
        const nextIntTol = updates.intTolClass ?? item.intTolClass;
        const nextGrade = updates.materialGrade ?? item.materialGrade;
        const nextAppliedLoad =
          updates.appliedLoadKn !== undefined
            ? Math.max(0, updates.appliedLoadKn)
            : item.appliedLoadKn;
        const nextFrictionMu =
          updates.frictionMu !== undefined
            ? Math.max(0.01, updates.frictionMu)
            : updates.materialGrade !== undefined
            ? THREAD_MATERIAL_SPECS[updates.materialGrade].defaultFrictionMu
            : item.frictionMu;
        const nextMaterialLabel =
          updates.materialGrade !== undefined
            ? THREAD_MATERIAL_SPECS[updates.materialGrade].label
            : updates.material !== undefined
            ? updates.material
            : item.material;

        const dimsChanged =
          updates.d !== undefined ||
          updates.p !== undefined ||
          updates.starts !== undefined ||
          updates.threadType !== undefined;

        return calculateTrThread(
          nextD,
          nextP,
          item.series,
          nextStarts,
          nextExtTol,
          nextIntTol,
          {
            id: item.id,
            threadType: nextThreadType,
            customDesignation: dimsChanged ? undefined : item.designation,
            tpi: dimsChanged ? undefined : item.tpi,
            angleDegOverride:
              updates.threadType !== undefined ? undefined : item.threadAngleDeg,
            materialGrade: nextGrade,
            appliedLoadKn: nextAppliedLoad,
            frictionMu: nextFrictionMu,
            lengthMm:
              updates.lengthMm !== undefined ? updates.lengthMm : item.lengthMm,
            material: nextMaterialLabel,
            notes: updates.notes !== undefined ? updates.notes : item.notes,
          }
        );
      })
    );
  };

  const handleDeleteProjectRow = (id: string) => {
    setProjectRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Export CSV handler (includes Core Shear Area & C45 vs Bronze Static Axial Load)
  const handleExportCsv = () => {
    const sourceRows =
      activeView === 'project' ? projectRows : filteredStandardRows;
    const headers = [
      'Kode_Ulir',
      'Seri_ISO',
      'd_mm',
      'P_mm',
      'Starts_n',
      'Lead_Ph_mm',
      'd2_D2_Pitch_mm',
      'd3_Inti_Baut_mm',
      'D1_Bor_Mur_mm',
      'D4_Luar_Mur_mm',
      'H1_Kontak_mm',
      'h3_Tinggi_Ulir_mm',
      'ac_Clearance_mm',
      'f_Lebar_Puncak_mm',
      'w_Lebar_Pahat_mm',
      'Luas_Geser_Inti_Ac_mm2',
      'Fmaks_Statis_C45_kN',
      'Fmaks_Statis_Perunggu_kN',
      'Material_Aktif',
      'Tau_Izin_MPa',
      'Fmaks_Izin_Aktif_kN',
      'Fmaks_Izin_Aktif_Ton',
      'Beban_Kerja_Aktual_kN',
      'Rasio_Beban_Persen',
      'Status_Keamanan_Beban',
      'Koefisien_Gesek_Mu',
      'Torsi_Pengencangan_Kerja_Nm',
      'Torsi_Pengencangan_Maks_Nm',
      'Efisiensi_Ulir_Persen',
      'dw_Kawat_Uji_mm',
      'M_Ukuran_3Kawat_mm',
      'Sudut_Heliks_deg',
      'Panjang_mm',
      'Catatan',
    ];

    const csvLines = [
      headers.join(','),
      ...sourceRows.map((r) =>
        [
          `"${r.designation}"`,
          r.series,
          r.d,
          r.p,
          r.starts,
          r.ph,
          r.d2,
          r.d3,
          r.D1,
          r.D4,
          r.H1,
          r.h3,
          r.ac,
          r.f,
          r.w,
          r.coreAreaMm2,
          r.maxStaticLoadC45Kn,
          r.maxStaticLoadBronzeKn,
          `"${(r.material || '').replace(/"/g, '""')}"`,
          r.allowableShearStressMpa,
          r.maxStaticLoadActiveKn,
          r.maxStaticLoadActiveTon,
          r.appliedLoadKn,
          r.loadRatioPct,
          r.isLoadSafe ? 'AMAN' : 'OVERLOAD',
          r.frictionMu,
          r.tighteningTorqueWorkNm,
          r.tighteningTorqueMaxNm,
          r.threadEfficiencyPct,
          r.bestWireSize,
          r.measureOverWires,
          r.leadAngleDeg,
          r.lengthMm ?? '',
          `"${(r.notes || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      activeView === 'project'
        ? 'Lembar_Kerja_Proyek_Ulir_TR_Beban_Statis_C45_vs_Perunggu.csv'
        : 'Tabel_Lengkap_Ulir_TR8_Sampai_TR1120_Semua_Pitch.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format dynamic formula preview for the selected cell
  const getCellDisplayValue = (
    row: TrCalculatedRow,
    colLetter: string
  ): string => {
    switch (colLetter) {
      case 'A':
        return row.designation;
      case 'B':
        return `Seri ${row.series}`;
      case 'C':
        return `${row.d.toFixed(2)} mm`;
      case 'D':
        return `${row.p.toFixed(2)} mm`;
      case 'E':
        return `${row.ph.toFixed(2)} mm (${row.starts} start)`;
      case 'F':
        return `${row.d2.toFixed(3)} mm`;
      case 'G':
        return `${row.d3.toFixed(3)} mm`;
      case 'H':
        return `${row.D1.toFixed(3)} mm`;
      case 'I':
        return `${row.D4.toFixed(3)} mm`;
      case 'J':
        return `${row.H1.toFixed(3)} mm`;
      case 'K':
        return `${row.h3.toFixed(3)} mm`;
      case 'L':
        return `${row.ac.toFixed(2)} mm`;
      case 'M':
        return `${row.f.toFixed(3)} mm`;
      case 'N':
        return `${row.w.toFixed(3)} mm`;
      case 'O':
        return `${row.d2Min.toFixed(3)} .. ${row.d2Max.toFixed(3)} mm (${row.extTolClass})`;
      case 'P':
        return `${row.D2Min.toFixed(3)} .. ${row.D2Max.toFixed(3)} mm (${row.intTolClass})`;
      case 'Q':
        return `${row.bestWireSize.toFixed(3)} mm`;
      case 'R':
        return `${row.measureOverWires.toFixed(3)} mm`;
      case 'S':
        return `${row.leadAngleDeg.toFixed(2)}°`;
      case 'T':
        return `${row.coreAreaMm2.toFixed(2)} mm²`;
      case 'U':
        return `${row.maxStaticLoadC45Kn.toFixed(2)} kN (${(
          row.maxStaticLoadC45Kn / 9.80665
        ).toFixed(2)} Ton)`;
      case 'V':
        return `${row.maxStaticLoadBronzeKn.toFixed(2)} kN (${(
          row.maxStaticLoadBronzeKn / 9.80665
        ).toFixed(2)} Ton)`;
      default:
        return '-';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 transition-colors duration-150">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('standard');
          }}
          className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          Thread Calculation
        </a>

        {/* Zone 2: 3 clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveView('standard')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'standard'
                ? 'border-blue-600 dark:border-blue-400 text-slate-900 dark:text-slate-100 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Tabel Standar Tr 8 – Tr 1120
          </button>
          <button
            type="button"
            onClick={() => setActiveView('project')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'project'
                ? 'border-blue-600 dark:border-blue-400 text-slate-900 dark:text-slate-100 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Lembar Kerja Proyek ({projectRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveView('cad_calc')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'cad_calc'
                ? 'border-blue-600 dark:border-blue-400 text-slate-900 dark:text-slate-100 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Profil CAD & Kalkulator
          </button>
        </nav>

        {/* Zone 3: Theme Toggle & Primary Action (Export CSV) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
            }
            aria-label={
              theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'
            }
            title={
              theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span>Gelap</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor CSV (
            {activeView === 'project'
              ? projectRows.length
              : filteredStandardRows.length}
            )
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center gap-1 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveView('standard')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
            activeView === 'standard'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Tr 8 – Tr 1120
        </button>
        <button
          type="button"
          onClick={() => setActiveView('project')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
            activeView === 'project'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Proyek & Beban Statis ({projectRows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView('cad_calc')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
            activeView === 'cad_calc'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Profil CAD & CNC
        </button>
      </div>

      {/* Toast notification */}
      {toastNotice && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 dark:bg-slate-800 text-white border border-transparent dark:border-slate-700 text-xs font-medium rounded-md shadow-md">
          {toastNotice}
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Domain Context Subheader & Active Thread Summary (Unboxed Metadata with · separators) */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Spreadsheet Teknik Ulir Trapesium Tr 8 s/d Tr 1120 — Kalkulasi Beban Statis Geser Inti (C45 vs Perunggu)
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>Sudut Puncak α = 30°</span>
              <span aria-hidden="true">·</span>
              <span>Luas Geser Inti Ac = (π/4)·d3²</span>
              <span aria-hidden="true">·</span>
              <span>Baja C45 (τ_izin = 65 MPa) vs Perunggu CuSn12 (τ_izin = 30 MPa)</span>
              <span aria-hidden="true">·</span>
              <span>Toleransi {extTolClass} / {intTolClass}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Baris Aktif:</span>
            <strong className="font-mono font-semibold text-blue-700 dark:text-blue-400">
              {selectedRow.designation}
            </strong>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              C45: <strong>{selectedRow.maxStaticLoadC45Kn} kN</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              /
            </span>
            <span className="font-mono text-amber-800 dark:text-amber-400">
              Perunggu: <strong>{selectedRow.maxStaticLoadBronzeKn} kN</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <button
              type="button"
              onClick={() => handleAddComparisonPairToProject(selectedRow)}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors whitespace-nowrap"
            >
              + Komparasi C45 vs Perunggu ke Proyek
            </button>
          </div>
        </div>

        {/* FIREBASE CLOUD FIRESTORE SYNCHRONIZATION DASHBOARD PANEL */}
        {(activeView === 'standard' || activeView === 'project') && (
          <FirebaseSyncDashboardPanel
            firebaseUser={firebaseUser}
            isAuthReady={isFirebaseAuthReady}
            isAuthBusy={isFirebaseAuthBusy}
            onFirebaseSignIn={handleFirebaseSignIn}
            onFirebaseSignOut={handleFirebaseSignOut}
            projectName={reportProjectName}
            preparedBy={reportPreparedBy}
            onChangeProjectName={setReportProjectName}
            onChangePreparedBy={setReportPreparedBy}
            projectRows={projectRows}
            wireInspections={wireInspections}
            selectedRow={selectedRow}
            activeMeasuredWireM={evaluate3WireGoNoGo7e7H(selectedRow).measuredM}
            isSyncing={isDatabaseSyncing}
            lastSyncedAt={lastSyncedAt}
            onSyncToFirebase={handleManualSaveProject}
            onPullFromFirebase={handlePullProjectFromDatabase}
            onLogActiveWireInspection={async (customM?: number) => {
              const effectiveM =
                typeof customM === 'number'
                  ? customM
                  : evaluate3WireGoNoGo7e7H(selectedRow).measuredM;
              setCustomMeasuredWireM((prev) => ({
                ...prev,
                [selectedRow.id]: Number(effectiveM.toFixed(3)),
              }));
              const inferredD2 = Number(
                (
                  selectedRow.d2 +
                  (effectiveM - selectedRow.measureOverWires)
                ).toFixed(3)
              );
              const qcStatus =
                effectiveM < selectedRow.wireMMin7e - 1e-6
                  ? 'NO_GO_UNDERSIZE'
                  : effectiveM > selectedRow.wireMMax7e + 1e-6
                  ? 'NO_GO_OVERSIZE'
                  : 'GO';
              const entry = {
                rowId: selectedRow.id,
                designation: selectedRow.designation,
                bestWireSizeMm: selectedRow.bestWireSize,
                measuredWireMMm: Number(effectiveM.toFixed(3)),
                wireMMin7eMm: selectedRow.wireMMin7e,
                wireMMax7eMm: selectedRow.wireMMax7e,
                inferredD2Mm: inferredD2,
                qcStatus,
              } as const;
              try {
                const newInspection = firebaseUser
                  ? await logWireInspectionToFirestore(
                      firebaseUser.uid,
                      entry,
                      {
                        projectName: reportProjectName,
                        preparedBy: reportPreparedBy,
                        projectRows,
                        customMeasuredWireM,
                        wireCheckPreset,
                      }
                    )
                  : await logWireInspectionReading(entry);
                if (!firebaseUser) {
                  setWireInspections((prev) => [newInspection, ...prev]);
                }
                setLastSyncedAt(new Date().toISOString());
                triggerToast(
                  `Inspeksi 3-Kawat ${selectedRow.designation} (M=${effectiveM.toFixed(
                    3
                  )} mm · ${qcStatus}) tersinkron ke ${
                    firebaseUser ? 'Cloud Firestore' : 'penyimpanan lokal'
                  }.`
                );
              } catch (err) {
                console.error('Log active wire inspection error:', err);
                triggerToast(
                  `Gagal mencatat inspeksi 3-kawat ke ${
                    firebaseUser ? 'Cloud Firestore' : 'server lokal'
                  }.`
                );
              }
            }}
            onAddActiveRowToProject={() => {
              handleAddRowToProject(selectedRow, 'C45');
            }}
            onSelectProjectRow={(rowId: string) => {
              setSelectedRowId(rowId);
            }}
            onOpenProjectView={() => setActiveView('project')}
          />
        )}

        {/* SPREADSHEET FORMULA BAR (Always visible on Standard & Project views) */}
        {(activeView === 'standard' || activeView === 'project') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center gap-2 text-xs shadow-2xs">
            {/* Active Cell Reference Box */}
            <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono font-semibold text-slate-900 dark:text-slate-100 min-w-[64px] text-center">
              {selectedColLetter}
              {selectedRowNumber}
            </div>

            {/* Function symbol fx */}
            <div className="px-2 py-1 font-mono italic font-semibold text-slate-500 dark:text-slate-400 select-none">
              fx
            </div>

            {/* Formula Expression Box */}
            <div className="flex-1 min-w-[240px] px-3 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-mono text-slate-800 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-blue-700 dark:text-blue-400 font-semibold">
                  {activeColMeta.symbol}
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-400">
                  {activeColMeta.formulaExpr}
                </span>
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                = {getCellDisplayValue(selectedRow, selectedColLetter)}
              </div>
            </div>

            {/* Parameter Description */}
            <div className="hidden xl:block text-xs text-slate-500 dark:text-slate-400 px-2 max-w-md truncate">
              {activeColMeta.description}
            </div>
          </div>
        )}

        {/* =========================================================
            VIEW 1: TABEL STANDAR MULTI-ULIR LENGKAP (TR, M, SQ, S, ACME, UNC/UNF, BSW, BSP/NPT)
           ========================================================= */}
        {activeView === 'standard' && (
          <div className="space-y-5">
            {/* Filter & Parameter Control Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-3">
              {/* Row 0: Complete Thread Standard Family Selector */}
              <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Pilih Jenis &amp; Standar Ulir Lengkap:
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    8 Keluarga Standar Ulir Internasional · Total{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {ISO_2902_STANDARD_SPECS.length + ALL_NON_TR_SPECS.length}
                    </strong>{' '}
                    Spesifikasi Standar (+ {FULL_MATRIX_TR8_TO_1120_SPECS.length}{' '}
                    Matriks Tr)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      {
                        id: 'TR',
                        label: 'Tr 30° (Trapesium ISO/DIN 103)',
                        count:
                          catalogMode === 'full_matrix'
                            ? FULL_MATRIX_TR8_TO_1120_SPECS.length
                            : ISO_2902_STANDARD_SPECS.length,
                      },
                      {
                        id: 'METRIC_M',
                        label: 'M 60° (Metrik Segitiga ISO/DIN 13)',
                        count: METRIC_M_SPECS.length,
                      },
                      {
                        id: 'SQ',
                        label: 'Sq 0° (Ulir Persegi / Square)',
                        count: SQUARE_SQ_SPECS.length,
                      },
                      {
                        id: 'BUTTRESS_S',
                        label: 'S 3°/30° (Ulir Gergaji / Buttress)',
                        count: BUTTRESS_S_SPECS.length,
                      },
                      {
                        id: 'ACME',
                        label: 'ACME 29° (Trapesium Inci ASME)',
                        count: ACME_SPECS.length,
                      },
                      {
                        id: 'UNC_UNF',
                        label: 'UNC / UNF 60° (Unified Inci)',
                        count: UNC_UNF_SPECS.length,
                      },
                      {
                        id: 'BSW_BSF',
                        label: 'BSW / BSF 55° (Whitworth Inci)',
                        count: BSW_BSF_SPECS.length,
                      },
                      {
                        id: 'BSP_NPT',
                        label: 'G / R / NPT (Ulir Pipa & Hidrolik)',
                        count: BSP_NPT_SPECS.length,
                      },
                      {
                        id: 'ALL',
                        label: 'Semua Jenis Ulir (Gabungan)',
                        count:
                          ISO_2902_STANDARD_SPECS.length +
                          ALL_NON_TR_SPECS.length,
                      },
                    ] as const
                  ).map((tab) => {
                    const active = threadFamilyFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setThreadFamilyFilter(tab.id);
                          setExactDiameterFilter('all');
                          setExactPitchFilter('all');
                          setDiaRange('all');
                        }}
                        className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                            active
                              ? 'bg-blue-700 text-blue-50'
                              : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Thread Family Technical Summary Strip */}
                {threadFamilyFilter !== 'ALL' && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {THREAD_FAMILY_METADATA[threadFamilyFilter].fullName}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <span className="font-mono text-blue-700 dark:text-blue-400 font-medium">
                        Profil:{' '}
                        {THREAD_FAMILY_METADATA[threadFamilyFilter].profileShape}{' '}
                        (β ={' '}
                        {
                          THREAD_FAMILY_METADATA[threadFamilyFilter]
                            .flankLoadHalfAngleDeg
                        }
                        °)
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Aplikasi Utama:
                      </span>{' '}
                      {THREAD_FAMILY_METADATA[threadFamilyFilter].primaryUse}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari ulir (mis. Tr 36, M 20, Sq 24, S 40, ACME, UNC, G 1/2)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>

                {/* Mode Cakupan Pitch: Multi-Pitch Standar vs Matriks Penuh Semua Pitch */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <button
                    type="button"
                    onClick={() => setCatalogMode('standard_multi')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      catalogMode === 'standard_multi'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Standar DIN 103 & Alat Berat (
                    {ISO_2902_STANDARD_SPECS.length} Baris)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogMode('full_matrix')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      catalogMode === 'full_matrix'
                        ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Matriks Penuh Semua Pitch (
                    {FULL_MATRIX_TR8_TO_1120_SPECS.length} Baris)
                  </button>
                </div>

                {/* Segmented Control: ISO Series Filter */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <button
                    type="button"
                    onClick={() => setSeriesFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      seriesFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Semua Pitch
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeriesFilter(1)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      seriesFilter === 1
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Seri 1 Utama
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeriesFilter(2)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      seriesFilter === 2
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Seri 2 Halus
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeriesFilter(3)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      seriesFilter === 3
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Seri 3 Kasar
                  </button>
                </div>
              </div>

              {/* Second Row: Diameter, Specific Pitch, Column Group, Starts, Tolerance */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Range Diameter */}
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Rentang:</span>
                    <select
                      value={diaRange}
                      onChange={(e) => {
                        setDiaRange(e.target.value as any);
                        setExactDiameterFilter('all');
                      }}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    >
                      <option value="all">Semua (Tr 8 – Tr 1120)</option>
                      <option value="small">Tr 8 – Tr 30 (Kecil)</option>
                      <option value="medium">Tr 32 – Tr 100 (Menengah)</option>
                      <option value="large">Tr 105 – Tr 300 (Besar)</option>
                      <option value="heavy_300_600">
                        Tr 310 – Tr 600 (Alat Berat)
                      </option>
                      <option value="ultra_620_1120">
                        Tr 620 – Tr 1120 (Press / Turbin Raksasa)
                      </option>
                    </select>
                  </div>

                  {/* Pilih Diameter Spesifik (Tr 8 s/d Tr 1120) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Diameter (d):
                    </span>
                    <select
                      value={exactDiameterFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExactDiameterFilter(
                          val === 'all' ? 'all' : Number(val)
                        );
                      }}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    >
                      <option value="all">Semua d (8..1120)</option>
                      {ALL_TR_DIAMETERS.map((d) => (
                        <option key={d} value={d}>
                          Tr {d} ({d} mm)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pilih Pitch Spesifik (P = 1.5 s/d 48 mm) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Pitch (P):
                    </span>
                    <select
                      value={exactPitchFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExactPitchFilter(
                          val === 'all' ? 'all' : Number(val)
                        );
                      }}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    >
                      <option value="all">Semua Pitch (1.5..48)</option>
                      {ALL_STANDARD_PITCHES.map((p) => (
                        <option key={p} value={p}>
                          P = {p} mm
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Jumlah Start */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Start:</span>
                    <select
                      value={globalStarts}
                      onChange={(e) => setGlobalStarts(Number(e.target.value))}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    >
                      <option value={1}>1 Start (Tunggal)</option>
                      <option value={2}>2 Starts (Ph=2P)</option>
                      <option value={3}>3 Starts (Ph=3P)</option>
                      <option value={4}>4 Starts (Ph=4P)</option>
                    </select>
                  </div>

                  {/* Kelas Toleransi */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Tol:</span>
                    <select
                      value={`${extTolClass}/${intTolClass}`}
                      onChange={(e) => {
                        const [ext, int] = e.target.value.split('/');
                        setExtTolClass(ext as ExternalTolClass);
                        setIntTolClass(int as InternalTolClass);
                      }}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    >
                      <option value="7e/7H">7e / 7H</option>
                      <option value="8e/7H">8e / 7H</option>
                      <option value="8c/8H">8c / 8H</option>
                      <option value="7h/7H">7h / 7H</option>
                    </select>
                  </div>
                </div>

                {/* Column Group Selector */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setColGroup('all')}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      colGroup === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Semua Kolom (A–V)
                  </button>
                  <button
                    type="button"
                    onClick={() => setColGroup('basic')}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      colGroup === 'basic'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Dimensi Dasar
                  </button>
                  <button
                    type="button"
                    onClick={() => setColGroup('profile')}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      colGroup === 'profile'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Profil & Pahat
                  </button>
                  <button
                    type="button"
                    onClick={() => setColGroup('tolerance')}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      colGroup === 'tolerance'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Toleransi
                  </button>
                  <button
                    type="button"
                    onClick={() => setColGroup('inspection')}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      colGroup === 'inspection'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Beban Statis C45 vs Perunggu
                  </button>
                </div>
              </div>

              {/* Third Row: Pagination & Quick Jump Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span>
                    Hasil Filter:{' '}
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {filteredStandardRows.length}
                    </strong>{' '}
                    baris (dari Tr 8 hingga Tr 1120)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Lompat Cepat:</span>
                  {[8, 20, 50, 100, 200, 300, 500, 800, 1000, 1120].map(
                    (jumpD) => (
                      <button
                        key={jumpD}
                        type="button"
                        onClick={() => {
                          setExactDiameterFilter(
                            exactDiameterFilter === jumpD ? 'all' : jumpD
                          );
                          setDiaRange('all');
                        }}
                        className={`px-1.5 py-0.5 font-mono rounded border transition-colors ${
                          exactDiameterFilter === jumpD
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        Tr {jumpD}
                      </button>
                    )
                  )}
                  {(exactDiameterFilter !== 'all' ||
                    exactPitchFilter !== 'all' ||
                    diaRange !== 'all' ||
                    seriesFilter !== 'all' ||
                    searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setExactDiameterFilter('all');
                        setExactPitchFilter('all');
                        setDiaRange('all');
                        setSeriesFilter('all');
                        setSearchQuery('');
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium ml-1"
                    >
                      Reset Semua Filter
                    </button>
                  )}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                  >
                    <option value={200}>200 baris / hal</option>
                    <option value={500}>500 baris / hal</option>
                    <option value={1000}>1000 baris / hal</option>
                    <option value={3000}>
                      Tampilkan Semua ({filteredStandardRows.length})
                    </option>
                  </select>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 font-mono">
                      <button
                        type="button"
                        disabled={safeCurrentPage <= 1}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        className="p-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-slate-700 dark:text-slate-300">
                        Hal {safeCurrentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="p-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* INTERACTIVE 3-WIRE GO/NO-GO TOLERANCE LIMIT CHECKER (CLASS 7e / 7H) */}
            {(() => {
              const activeCheck = evaluate3WireGoNoGo7e7H(selectedRow);
              const outOfSpecCount = filteredStandardRows.filter(
                (r) => evaluate3WireGoNoGo7e7H(r).isOutOfRange
              ).length;
              return (
                <div
                  className={`border rounded-lg p-3.5 space-y-3 transition-colors ${
                    isToleranceCheckEnabled && activeCheck.isOutOfRange
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white border border-transparent dark:border-slate-700">
                        Pemeriksaan Batas Toleransi 3-Kawat (Go / No-Go Kelas 7e/7H)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setIsToleranceCheckEnabled((prev) => !prev)
                        }
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                          isToleranceCheckEnabled
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {isToleranceCheckEnabled
                          ? 'Highlight Otomatis: AKTIF'
                          : 'Highlight Otomatis: NONAKTIF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setColGroup('tolerance')}
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                      >
                        Fokus Kolom Toleransi &amp; 3-Kawat (O, P, Q, R)
                      </button>
                    </div>

                    {/* Simulation Presets & Filter Out-of-Spec */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Simulasi Pengukuran Tabel:
                      </span>
                      {(
                        [
                          {
                            id: 'mixed_qc',
                            label: 'Sampel QC (GO & NO-GO)',
                          },
                          {
                            id: 'target_7e',
                            label: 'Semua GO (Tengah 7e)',
                          },
                          {
                            id: 'nominal_basic_d2',
                            label: 'Ukuran Dasar d2 (> Max 7e)',
                          },
                          {
                            id: 'undersize_nogo',
                            label: 'Aus / Longgar (< Min 7e)',
                          },
                          {
                            id: 'oversize_nogo',
                            label: 'Terlalu Besar (> Max 7e)',
                          },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setWireCheckPreset(mode.id);
                            setCustomMeasuredWireM({});
                          }}
                          className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                            wireCheckPreset === mode.id &&
                            Object.keys(customMeasuredWireM).length === 0
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setOnlyShowOutOfTolRows((prev) => !prev)
                        }
                        className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors ${
                          onlyShowOutOfTolRows
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                        }`}
                      >
                        {onlyShowOutOfTolRows
                          ? `Menampilkan Hanya NO-GO (${filteredStandardRows.length})`
                          : `Filter NO-GO (${outOfSpecCount} Baris)`}
                      </button>
                    </div>
                  </div>

                  {/* Active Row 3-Wire Go/No-Go Live Inspector */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                    {/* Box 1: Input Measured 3-Wire M_ukur for Selected Row */}
                    <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          1. Ukur 3-Kawat ({selectedRow.designation})
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          dw = {selectedRow.bestWireSize.toFixed(3)} mm
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.005"
                          value={activeCheck.measuredM}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!Number.isNaN(val)) {
                              setCustomMeasuredWireM((prev) => ({
                                ...prev,
                                [selectedRow.id]: val,
                              }));
                            }
                          }}
                          className={`w-full px-2.5 py-1 font-mono text-sm font-semibold rounded border focus:outline-none ${
                            activeCheck.isOutOfRange
                              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-700 text-rose-950 dark:text-rose-200'
                              : 'bg-emerald-50/70 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200'
                          }`}
                        />
                        <span className="font-mono text-slate-600 dark:text-slate-400 shrink-0">
                          mm
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCustomMeasuredWireM((prev) => ({
                              ...prev,
                              [selectedRow.id]: Number(
                                (activeCheck.measuredM - 0.03).toFixed(3)
                              ),
                            }))
                          }
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700"
                        >
                          -0.03 mm
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomMeasuredWireM((prev) => ({
                              ...prev,
                              [selectedRow.id]: selectedRow.wireMTarget7e,
                            }))
                          }
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded border border-emerald-200 dark:border-emerald-800"
                        >
                          Target 7e ({selectedRow.wireMTarget7e.toFixed(3)})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomMeasuredWireM((prev) => ({
                              ...prev,
                              [selectedRow.id]: selectedRow.measureOverWires,
                            }))
                          }
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded border border-rose-200 dark:border-rose-800"
                        >
                          Dasar d2 ({selectedRow.measureOverWires.toFixed(3)})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomMeasuredWireM((prev) => ({
                              ...prev,
                              [selectedRow.id]: Number(
                                (activeCheck.measuredM + 0.03).toFixed(3)
                              ),
                            }))
                          }
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700"
                        >
                          +0.03 mm
                        </button>
                      </div>
                    </div>

                    {/* Box 2: 3-Wire Go/No-Go Range for 7e */}
                    <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md space-y-1">
                      <div className="text-slate-600 dark:text-slate-400 font-medium">
                        2. Rentang Batas 3-Kawat Kelas 7e (Go/No-Go)
                      </div>
                      <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {selectedRow.wireMMin7e.toFixed(3)} ..{' '}
                        {selectedRow.wireMMax7e.toFixed(3)} mm
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Lebar Tol Td2(7e) ={' '}
                        {Math.round(
                          (selectedRow.wireMMax7e - selectedRow.wireMMin7e) *
                            1000
                        )}{' '}
                        µm · M_dasar = {selectedRow.measureOverWires.toFixed(3)}{' '}
                        mm
                      </div>
                    </div>

                    {/* Box 3: Inferred Pitch Diameter d2_ukur vs 7e/7H Limits */}
                    <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md space-y-1">
                      <div className="text-slate-600 dark:text-slate-400 font-medium">
                        3. Diameter Pitch Aktual (d2_ukur) vs 7e / 7H
                      </div>
                      <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                        d2_ukur = {activeCheck.inferredD2.toFixed(3)} mm
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Batas Baut 7e: {selectedRow.d2Min7e.toFixed(3)}..
                        {selectedRow.d2Max7e.toFixed(3)} · Mur 7H:{' '}
                        {selectedRow.D2Min7H.toFixed(3)}..
                        {selectedRow.D2Max7H.toFixed(3)}
                      </div>
                    </div>

                    {/* Box 4: Go / No-Go Verdict & Cell Highlight Explanation */}
                    <div
                      className={`p-2.5 rounded-md border flex flex-col justify-between ${
                        activeCheck.isOutOfRange
                          ? 'bg-rose-100/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                          : 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          4. Status Inspeksi Go/No-Go 7e/7H
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded ${
                            activeCheck.isOutOfRange
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {activeCheck.statusLabel}
                        </span>
                      </div>
                      <div className="font-mono text-xs font-semibold mt-1">
                        {activeCheck.isBelowMin7e
                          ? `Di bawah batas minimum 7e sebesar ${activeCheck.outOfBoundsUm} µm (Ulir terlalu longgar / aus)`
                          : activeCheck.isAboveMax7e
                          ? `Melebihi batas maksimum 7e sebesar +${activeCheck.outOfBoundsUm} µm (Ulir belum masuk / seret terhadap Mur 7H)`
                          : 'Pengukuran 3-kawat berada di dalam zona toleransi presisi 7e/7H.'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* HIGH-DENSITY SPREADSHEET GRID */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 select-none">
                    {/* Row 1 of Header: Excel/Sheets Column Letters */}
                    <tr className="bg-slate-200/70 dark:bg-slate-900 text-[11px] font-mono text-slate-500 dark:text-slate-400 border-b border-slate-300 dark:border-slate-700">
                      <th className="w-12 py-1 px-2 text-center border-r border-slate-300 dark:border-slate-700 sticky left-0 bg-slate-200 dark:bg-slate-900 z-30">
                        #
                      </th>
                      {SPREADSHEET_COLUMNS.filter((c) =>
                        isColVisible(c.colLetter)
                      ).map((col) => (
                        <th
                          key={col.colLetter}
                          onClick={() => setSelectedColLetter(col.colLetter)}
                          className={`py-1 px-2.5 text-center border-r border-slate-300 dark:border-slate-700 cursor-pointer transition-colors ${
                            col.colLetter === 'A'
                              ? 'sticky left-12 z-30 bg-slate-200 dark:bg-slate-900'
                              : ''
                          } ${
                            selectedColLetter === col.colLetter
                              ? 'bg-blue-100 dark:bg-[#172554] text-blue-900 dark:text-blue-200 font-bold'
                              : 'hover:bg-slate-300/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          {col.colLetter}
                        </th>
                      ))}
                      <th className="py-1 px-2.5 text-center bg-slate-200/70 dark:bg-slate-900">
                        Aksi Proyek
                      </th>
                    </tr>

                    {/* Row 2 of Header: Engineering Parameter Names & Symbols */}
                    <tr>
                      <th className="py-2 px-2 text-center border-r border-slate-300 dark:border-slate-700 sticky left-0 bg-slate-100 dark:bg-slate-800 z-30 font-mono text-slate-500 dark:text-slate-400">
                        Baris
                      </th>
                      {SPREADSHEET_COLUMNS.filter((c) =>
                        isColVisible(c.colLetter)
                      ).map((col) => (
                        <th
                          key={col.key}
                          onClick={() => setSelectedColLetter(col.colLetter)}
                          className={`py-2 px-2.5 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap cursor-pointer ${
                            col.colLetter === 'A'
                              ? 'sticky left-12 z-30 bg-slate-100 dark:bg-slate-800 text-left'
                              : 'text-right'
                          } ${
                            selectedColLetter === col.colLetter
                              ? 'bg-blue-50/90 dark:bg-[#172554] text-blue-950 dark:text-blue-100'
                              : ''
                          }`}
                        >
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {col.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-normal">
                            {col.symbol}{' '}
                            {col.unit !== '-' ? `(${col.unit})` : ''}
                          </div>
                        </th>
                      ))}
                      <th className="py-2 px-2.5 text-center font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        Salin ke Proyek
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                    {visibleStandardRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={24}
                          className="py-10 text-center font-sans text-slate-500 dark:text-slate-400"
                        >
                          Tidak ada ukuran ulir TR yang cocok dengan filter saat ini.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setSeriesFilter('all');
                              setDiaRange('all');
                              setExactDiameterFilter('all');
                              setExactPitchFilter('all');
                            }}
                            className="text-blue-600 dark:text-blue-400 underline font-medium ml-1"
                          >
                            Reset filter
                          </button>
                        </td>
                      </tr>
                    ) : (
                      visibleStandardRows.map((row, idx) => {
                        const rowNum =
                          (safeCurrentPage - 1) * pageSize + idx + 1;
                        const isSelectedRow = row.id === selectedRow.id;

                        const renderCell = (
                          colLetter: string,
                          content: React.ReactNode,
                          extraClass: string = ''
                        ) => {
                          if (!isColVisible(colLetter)) return null;
                          const isSelectedCell =
                            isSelectedRow && selectedColLetter === colLetter;
                          return (
                            <td
                              key={colLetter}
                              onClick={() => {
                                setSelectedRowId(row.id);
                                setSelectedColLetter(colLetter);
                                setSelectedRowNumber(rowNum);
                              }}
                              className={`py-1.5 px-2.5 border-r border-slate-200/80 dark:border-slate-800 whitespace-nowrap cursor-pointer transition-colors ${extraClass} ${
                                isSelectedCell
                                  ? 'ring-2 ring-inset ring-blue-600 dark:ring-blue-400 bg-blue-50/90 dark:bg-[#172554] font-semibold text-blue-950 dark:text-blue-100'
                                  : ''
                              }`}
                            >
                              {content}
                            </td>
                          );
                        };

                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              isSelectedRow
                                ? 'bg-blue-50/40 dark:bg-blue-950/30'
                                : row.series === 1
                                ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                : 'bg-slate-50/40 dark:bg-slate-950/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            {/* Row Number Header (opaque bg for horizontal scroll) */}
                            <td
                              onClick={() => {
                                setSelectedRowId(row.id);
                                setSelectedRowNumber(rowNum);
                              }}
                              className={`py-1.5 px-2 text-center border-r border-slate-300 dark:border-slate-700 sticky left-0 z-10 cursor-pointer select-none text-[11px] ${
                                isSelectedRow
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {rowNum}
                            </td>

                            {/* A: Designation (opaque bg for sticky column) */}
                            {renderCell(
                              'A',
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {row.designation}
                                </span>
                                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {row.threadType === 'BUTTRESS_S'
                                    ? 'S 3°/30°'
                                    : row.threadType === 'SQ'
                                    ? 'Sq 0°'
                                    : `${
                                        THREAD_FAMILY_METADATA[
                                          row.threadType || 'TR'
                                        ].prefix
                                      } ${row.threadAngleDeg ?? 30}°`}
                                  {row.tpi ? ` · ${row.tpi} TPI` : ''}
                                </span>
                              </div>,
                              `sticky left-12 z-10 text-left ${
                                isSelectedRow
                                  ? 'bg-blue-50 dark:bg-[#172554]'
                                  : 'bg-white dark:bg-slate-900'
                              }`
                            )}

                            {/* B: Series */}
                            {renderCell(
                              'B',
                              <span
                                className={
                                  row.series === 1
                                    ? 'text-blue-700 dark:text-blue-400 font-semibold'
                                    : 'text-slate-500 dark:text-slate-400'
                                }
                              >
                                S{row.series}
                              </span>,
                              'text-center'
                            )}

                            {/* C: d */}
                            {renderCell(
                              'C',
                              row.d.toFixed(2),
                              'text-right font-medium text-slate-900 dark:text-slate-100'
                            )}

                            {/* D: P */}
                            {renderCell(
                              'D',
                              row.p.toFixed(2),
                              'text-right font-medium text-slate-900 dark:text-slate-100'
                            )}

                            {/* E: Ph */}
                            {renderCell(
                              'E',
                              row.ph.toFixed(2),
                              'text-right text-slate-700 dark:text-slate-300'
                            )}

                            {/* F: d2 = D2 */}
                            {renderCell(
                              'F',
                              row.d2.toFixed(3),
                              'text-right font-medium text-emerald-700 dark:text-emerald-400'
                            )}

                            {/* G: d3 */}
                            {renderCell(
                              'G',
                              row.d3.toFixed(3),
                              'text-right text-blue-700 dark:text-blue-400'
                            )}

                            {/* H: D1 (Tap Drill) */}
                            {renderCell(
                              'H',
                              row.D1.toFixed(3),
                              'text-right font-medium text-amber-800 dark:text-amber-400'
                            )}

                            {/* I: D4 */}
                            {renderCell(
                              'I',
                              row.D4.toFixed(3),
                              'text-right text-slate-700 dark:text-slate-300'
                            )}

                            {/* J: H1 */}
                            {renderCell(
                              'J',
                              row.H1.toFixed(3),
                              'text-right text-slate-700 dark:text-slate-300'
                            )}

                            {/* K: h3 */}
                            {renderCell(
                              'K',
                              row.h3.toFixed(3),
                              'text-right text-slate-900 dark:text-slate-100'
                            )}

                            {/* L: ac */}
                            {renderCell(
                              'L',
                              row.ac.toFixed(2),
                              'text-right text-slate-600 dark:text-slate-400'
                            )}

                            {/* M: f */}
                            {renderCell(
                              'M',
                              row.f.toFixed(3),
                              'text-right text-slate-700 dark:text-slate-300'
                            )}

                            {/* N: w (Tool tip width) */}
                            {renderCell(
                              'N',
                              row.w.toFixed(3),
                              'text-right font-medium text-slate-900 dark:text-slate-100'
                            )}

                            {/* O: d2 min..max (Highlighted automatically when 3-wire M is outside 7e/7H Go/No-Go limits) */}
                            {(() => {
                              const wireCheck = evaluate3WireGoNoGo7e7H(row);
                              const tolHighlightClass = !isToleranceCheckEnabled
                                ? 'text-right text-slate-600 dark:text-slate-400 text-[11px]'
                                : wireCheck.isOutOfRange
                                ? 'text-right bg-rose-100/95 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200 font-semibold ring-1 ring-inset ring-rose-300 dark:ring-rose-800 text-[11px]'
                                : 'text-right bg-emerald-50/75 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 text-[11px]';

                              const nutHighlightClass = !isToleranceCheckEnabled
                                ? 'text-right text-slate-600 dark:text-slate-400 text-[11px]'
                                : wireCheck.isOutOfRange
                                ? 'text-right bg-rose-100/80 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200 font-semibold ring-1 ring-inset ring-rose-200 dark:ring-rose-800 text-[11px]'
                                : 'text-right bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 text-[11px]';

                              const wireCellHighlightClass =
                                !isToleranceCheckEnabled
                                  ? 'text-right font-medium text-slate-900 dark:text-slate-100'
                                  : wireCheck.isOutOfRange
                                  ? 'text-right bg-rose-100/95 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200 font-semibold ring-1 ring-inset ring-rose-300 dark:ring-rose-800'
                                  : 'text-right bg-emerald-50/75 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-medium';

                              return (
                                <>
                                  {renderCell(
                                    'O',
                                    <div className="flex flex-col items-end leading-tight">
                                      <div className="flex items-center gap-1">
                                        <span>
                                          {row.d2Min7e.toFixed(3)}..
                                          {row.d2Max7e.toFixed(3)}
                                        </span>
                                        {isToleranceCheckEnabled && (
                                          <span
                                            className={`px-1 py-0.2 text-[9px] font-bold rounded ${
                                              wireCheck.isOutOfRange
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-emerald-600 text-white'
                                            }`}
                                          >
                                            {wireCheck.isBelowMin7e
                                              ? 'NO-GO <Min'
                                              : wireCheck.isAboveMax7e
                                              ? 'NO-GO >Max'
                                              : 'GO 7e'}
                                          </span>
                                        )}
                                      </div>
                                      {isToleranceCheckEnabled && (
                                        <span
                                          className={`text-[10px] ${
                                            wireCheck.isOutOfRange
                                              ? 'text-rose-800 dark:text-rose-300 font-semibold'
                                              : 'text-emerald-700 dark:text-emerald-400'
                                          }`}
                                        >
                                          d2_ukur={wireCheck.inferredD2.toFixed(3)}{' '}
                                          {wireCheck.isOutOfRange
                                            ? `(${
                                                wireCheck.outOfBoundsUm > 0
                                                  ? '+'
                                                  : ''
                                              }${wireCheck.outOfBoundsUm} µm)`
                                            : '(OK)'}
                                        </span>
                                      )}
                                    </div>,
                                    tolHighlightClass
                                  )}

                                  {/* P: D2 min..max (7H Internal Nut Tolerance) */}
                                  {renderCell(
                                    'P',
                                    <div className="flex flex-col items-end leading-tight">
                                      <div className="flex items-center gap-1">
                                        <span>
                                          {row.D2Min7H.toFixed(3)}..
                                          {row.D2Max7H.toFixed(3)}
                                        </span>
                                        {isToleranceCheckEnabled &&
                                          wireCheck.isOutOfRange && (
                                            <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-rose-600 text-white">
                                              {wireCheck.isAboveMax7e
                                                ? 'SERET 7H'
                                                : 'LONGGAR 7H'}
                                            </span>
                                          )}
                                      </div>
                                      {isToleranceCheckEnabled && (
                                        <span
                                          className={`text-[10px] ${
                                            wireCheck.isOutOfRange
                                              ? 'text-rose-800 dark:text-rose-300'
                                              : 'text-emerald-700 dark:text-emerald-400'
                                          }`}
                                        >
                                          Celah={(
                                            row.D2Min7H - wireCheck.inferredD2
                                          ).toFixed(3)}{' '}
                                          mm
                                        </span>
                                      )}
                                    </div>,
                                    nutHighlightClass
                                  )}

                                  {/* Q: dw (Best wire) */}
                                  {renderCell(
                                    'Q',
                                    row.bestWireSize.toFixed(3),
                                    'text-right text-slate-700 dark:text-slate-300'
                                  )}

                                  {/* R: M (Over 3 wires — Editable & Highlighted against 7e Go/No-Go range) */}
                                  {renderCell(
                                    'R',
                                    <div
                                      className="flex flex-col items-end gap-0.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          step="0.005"
                                          value={wireCheck.measuredM}
                                          onChange={(e) => {
                                            const val = parseFloat(
                                              e.target.value
                                            );
                                            setSelectedRowId(row.id);
                                            setSelectedColLetter('R');
                                            setSelectedRowNumber(rowNum);
                                            if (!Number.isNaN(val)) {
                                              setCustomMeasuredWireM((prev) => ({
                                                ...prev,
                                                [row.id]: val,
                                              }));
                                              const inferredD2 = Number(
                                                (
                                                  row.d2 +
                                                  (val - row.measureOverWires)
                                                ).toFixed(3)
                                              );
                                              const qcStatus =
                                                val < row.wireMMin7e - 0.0004
                                                  ? 'NO_GO_UNDERSIZE'
                                                  : val > row.wireMMax7e + 0.0004
                                                  ? 'NO_GO_OVERSIZE'
                                                  : 'GO';
                                              const entry = {
                                                rowId: row.id,
                                                designation: row.designation,
                                                bestWireSizeMm: row.bestWireSize,
                                                measuredWireMMm: val,
                                                wireMMin7eMm: row.wireMMin7e,
                                                wireMMax7eMm: row.wireMMax7e,
                                                inferredD2Mm: inferredD2,
                                                qcStatus,
                                              } as const;
                                              if (inlineWireLogTimerRef.current) {
                                                clearTimeout(
                                                  inlineWireLogTimerRef.current
                                                );
                                              }
                                              inlineWireLogTimerRef.current =
                                                setTimeout(() => {
                                                  if (firebaseUser) {
                                                    void logWireInspectionToFirestore(
                                                      firebaseUser.uid,
                                                      entry,
                                                      {
                                                        projectName:
                                                          reportProjectName,
                                                        preparedBy:
                                                          reportPreparedBy,
                                                        projectRows,
                                                        customMeasuredWireM: {
                                                          ...customMeasuredWireM,
                                                          [row.id]: val,
                                                        },
                                                        wireCheckPreset,
                                                      }
                                                    )
                                                      .then(() => {
                                                        setLastSyncedAt(
                                                          new Date().toISOString()
                                                        );
                                                      })
                                                      .catch((err) => {
                                                        console.error(
                                                          'Inline wire Firestore log error:',
                                                          err
                                                        );
                                                      });
                                                  } else {
                                                    void logWireInspectionReading(
                                                      entry
                                                    )
                                                      .then((rec) => {
                                                        setWireInspections(
                                                          (prev) => [
                                                            rec,
                                                            ...prev,
                                                          ]
                                                        );
                                                        setLastSyncedAt(
                                                          new Date().toISOString()
                                                        );
                                                      })
                                                      .catch((err) => {
                                                        console.error(
                                                          'Inline wire local log error:',
                                                          err
                                                        );
                                                      });
                                                  }
                                                }, 500);
                                            }
                                          }}
                                          title="Ketik nilai pengukuran 3-kawat aktual (mm) untuk menguji batas Go/No-Go 7e/7H"
                                          className={`w-20 px-1.5 py-0.5 text-right font-mono text-xs rounded border focus:outline-none ${
                                            !isToleranceCheckEnabled
                                              ? 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                                              : wireCheck.isOutOfRange
                                              ? 'bg-white dark:bg-slate-950 border-rose-500 dark:border-rose-600 text-rose-950 dark:text-rose-200 font-bold'
                                              : 'bg-white dark:bg-slate-950 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 font-semibold'
                                          }`}
                                        />
                                      </div>
                                      <span
                                        className={`text-[10px] ${
                                          isToleranceCheckEnabled &&
                                          wireCheck.isOutOfRange
                                            ? 'text-rose-800 dark:text-rose-300 font-semibold'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                      >
                                        7e: {row.wireMMin7e.toFixed(3)}..
                                        {row.wireMMax7e.toFixed(3)}
                                      </span>
                                    </div>,
                                    wireCellHighlightClass
                                  )}
                                </>
                              );
                            })()}

                            {/* S: Lead Angle */}
                            {renderCell(
                              'S',
                              `${row.leadAngleDeg.toFixed(2)}°`,
                              'text-right text-slate-700 dark:text-slate-300'
                            )}

                            {/* T: Core Shear Area Ac */}
                            {renderCell(
                              'T',
                              row.coreAreaMm2.toFixed(2),
                              'text-right font-medium text-slate-900 dark:text-slate-100'
                            )}

                            {/* U: Max Static Load C45 */}
                            {renderCell(
                              'U',
                              row.maxStaticLoadC45Kn.toFixed(2),
                              'text-right font-semibold text-blue-700 dark:text-blue-400'
                            )}

                            {/* V: Max Static Load Bronze */}
                            {renderCell(
                              'V',
                              row.maxStaticLoadBronzeKn.toFixed(2),
                              'text-right font-semibold text-amber-800 dark:text-amber-400'
                            )}

                            {/* Action: Add to Project */}
                            <td className="py-1.5 px-2 text-center whitespace-nowrap font-sans">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddRowToProject(row, 'C45')
                                  }
                                  title="Tambahkan sebagai Baja C45 ke Proyek"
                                  className="px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:text-white dark:hover:text-white hover:bg-blue-600 dark:hover:bg-blue-600 border border-blue-200 dark:border-blue-800 rounded transition-colors"
                                >
                                  +C45
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddRowToProject(row, 'BRONZE')
                                  }
                                  title="Tambahkan sebagai Perunggu CuSn12 ke Proyek"
                                  className="px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 hover:text-white dark:hover:text-white hover:bg-amber-600 dark:hover:bg-amber-600 border border-amber-200 dark:border-amber-800 rounded transition-colors"
                                >
                                  +Perunggu
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Real-Time Three.js 3D Preview for Selected Standard Thread */}
            <Thread3DPreviewPanel row={selectedRow} />

            {/* Live Interactive 2D CAD Blueprint for Selected Row */}
            <ThreadProfileSvg row={selectedRow} />
          </div>
        )}

        {/* =========================================================
            VIEW 2: LEMBAR KERJA PROYEK (CUSTOM EDITABLE SPREADSHEET
            WITH C45 VS BRONZE STATIC AXIAL LOAD CALCULATION)
           ========================================================= */}
        {activeView === 'project' && (
          <div className="space-y-5">
            {/* Engineering Breakdown Card: C45 vs Perunggu Core Shear Formula for Active Row */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Analisis Beban Statis Aksial Maksimum Berdasarkan Luas Penampang Geser Inti — {selectedRow.designation}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Rumus Dasar Geser Inti: <code className="font-mono text-slate-800 dark:text-slate-200">A_c = (π / 4) × d3²</code> dan{' '}
                    <code className="font-mono text-slate-800 dark:text-slate-200">F_maks = A_c × τ_izin</code> (dengan diameter inti baut{' '}
                    <code className="font-mono text-blue-700 dark:text-blue-400">d3 = {selectedRow.d3.toFixed(3)} mm</code>)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualSaveProject}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap"
                  >
                    Simpan Proyek
                  </button>
                  <button
                    type="button"
                    onClick={handlePullProjectFromDatabase}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap"
                  >
                    Muat Data Proyek
                  </button>
                  <button
                    type="button"
                    onClick={handleResetProjectToDefault}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    Reset Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddComparisonPairToProject(selectedRow)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    + Duplikat Komparasi C45 vs Perunggu ({selectedRow.designation})
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdfReport}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ekspor Laporan Teknis PDF
                  </button>
                </div>
              </div>

              {/* PDF Report Letterhead Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Judul Proyek pada Kop Surat PDF
                  </label>
                  <input
                    type="text"
                    value={reportProjectName}
                    onChange={(e) => setReportProjectName(e.target.value)}
                    placeholder="Contoh: Spindel Pintu Air & Mesin Bubut"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Disusun / Diverifikasi Oleh
                  </label>
                  <input
                    type="text"
                    value={reportPreparedBy}
                    onChange={(e) => setReportPreparedBy(e.target.value)}
                    placeholder="Contoh: Divisi Engineering & QC"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div className="flex items-end">
                  <div className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Format: A4 Landscape · Kop Thread Calculation</span>
                    <button
                      type="button"
                      onClick={handleExportPdfReport}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline ml-2 whitespace-nowrap"
                    >
                      Unduh PDF ({projectRows.length} Baris)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {/* Box 1: Core Shear Area */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
                  <div className="text-slate-500 dark:text-slate-400">
                    1. Luas Penampang Geser Inti (A<sub>c</sub>)
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {selectedRow.coreAreaMm2.toLocaleString('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    mm²
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    = (π/4) × ({selectedRow.d3.toFixed(3)})²
                  </div>
                </div>

                {/* Box 2: Baja C45 Max Static Axial Load */}
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="text-blue-900 dark:text-blue-200 font-medium">
                    2. Beban Statis Maksimum — Baja C45
                  </div>
                  <div className="font-mono text-base font-semibold text-blue-700 dark:text-blue-400 mt-1">
                    {selectedRow.maxStaticLoadC45Kn.toLocaleString('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kN{' '}
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                      (
                      {(selectedRow.maxStaticLoadC45Kn / 9.80665).toFixed(2)}{' '}
                      Ton)
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    τ_izin C45 = 65 MPa · R_e = 340 MPa
                  </div>
                </div>

                {/* Box 3: Perunggu CuSn12 Max Static Axial Load */}
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800 rounded-md">
                  <div className="text-amber-950 dark:text-amber-200 font-medium">
                    3. Beban Statis Maksimum — Perunggu
                  </div>
                  <div className="font-mono text-base font-semibold text-amber-800 dark:text-amber-400 mt-1">
                    {selectedRow.maxStaticLoadBronzeKn.toLocaleString('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kN{' '}
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                      (
                      {(selectedRow.maxStaticLoadBronzeKn / 9.80665).toFixed(2)}{' '}
                      Ton)
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    τ_izin Perunggu = 30 MPa · R_p0.2 = 150 MPa
                  </div>
                </div>

                {/* Box 4: Active Row Selected Material Result & Status Lamp */}
                <div
                  className={`p-3 rounded-md border ${
                    selectedRow.isLoadSafe
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50/70 dark:bg-red-950/35 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-medium ${
                        selectedRow.isLoadSafe
                          ? 'text-emerald-950 dark:text-emerald-200'
                          : 'text-red-950 dark:text-red-200'
                      }`}
                    >
                      4. Status Baris Aktif (
                      {THREAD_MATERIAL_SPECS[selectedRow.materialGrade].shortLabel}
                      )
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold">
                      <span
                        aria-hidden="true"
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          selectedRow.isLoadSafe
                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                            : 'bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.85)]'
                        }`}
                      />
                      <span
                        className={
                          selectedRow.isLoadSafe
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-red-700 dark:text-red-300'
                        }
                      >
                        {selectedRow.isLoadSafe ? 'AMAN' : 'OVERLOAD'}
                      </span>
                    </span>
                  </div>
                  <div
                    className={`font-mono text-base font-semibold mt-1 ${
                      selectedRow.isLoadSafe
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    F = {selectedRow.appliedLoadKn.toFixed(2)} kN{' '}
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                      / Fmaks = {selectedRow.maxStaticLoadActiveKn.toFixed(2)} kN
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                     Beban Kerja: {selectedRow.loadRatioPct.toFixed(1)}% dari kapasitas {THREAD_MATERIAL_SPECS[selectedRow.materialGrade].shortLabel}
                  </div>
                </div>
              </div>

              {/* Tightening Torque Estimation Sub-Panel Based on Thread Friction Coefficient (mu) */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Estimasi Torsi Pengencangan Ulir (Tightening Torque) Berdasarkan Koefisien Gesek (μ) — {selectedRow.designation} ({THREAD_MATERIAL_SPECS[selectedRow.materialGrade].shortLabel})
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rumus Ulir Trapesium 30° (β = 15°):{' '}
                      <code className="font-mono text-slate-800 dark:text-slate-200">
                        T = 0.5 × F × d2 × tan(λ + ρ&apos;)
                      </code>{' '}
                      dengan{' '}
                      <code className="font-mono text-slate-800 dark:text-slate-200">
                        ρ&apos; = arctan(μ / cos 15°)
                      </code>{' '}
                      dan{' '}
                      <code className="font-mono text-blue-700 dark:text-blue-400">
                        d2 = {selectedRow.d2.toFixed(3)} mm
                      </code>
                    </p>
                  </div>

                  {/* Quick Friction Coefficient Preset Switcher for Selected Project Row */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Preset μ Baris Aktif:
                    </span>
                    {[
                      { label: '0.08 (Bronze+Oli)', mu: 0.08 },
                      { label: '0.10 (Perunggu)', mu: 0.10 },
                      { label: '0.14 (42CrMo4)', mu: 0.14 },
                      { label: '0.15 (Baja C45)', mu: 0.15 },
                      { label: '0.18 (SUS304)', mu: 0.18 },
                    ].map((preset) => (
                      <button
                        key={preset.mu}
                        type="button"
                        onClick={() =>
                          handleUpdateProjectRow(selectedRow.id, {
                            frictionMu: preset.mu,
                          })
                        }
                        className={`px-2 py-0.5 font-mono rounded border transition-colors ${
                          Math.abs(selectedRow.frictionMu - preset.mu) < 0.002
                            ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        μ={preset.mu.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
                    <div className="text-slate-500 dark:text-slate-400">
                      Koefisien Gesek Ulir Aktif (μ &amp; μ&apos;)
                    </div>
                    <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      μ = {selectedRow.frictionMu.toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                        (μ&apos; = {selectedRow.effectiveFrictionMuPrime.toFixed(3)})
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Sudut Gesek ρ&apos; = {selectedRow.frictionAngleDeg}° · Heliks λ = {selectedRow.leadAngleDeg}°
                    </div>
                  </div>

                  <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-800 rounded-md">
                    <div className="text-indigo-950 dark:text-indigo-200 font-medium">
                      Torsi Pengencangan Kerja (T<sub>kerja</sub>)
                    </div>
                    <div className="font-mono text-sm font-semibold text-indigo-800 dark:text-indigo-300 mt-0.5">
                      {selectedRow.tighteningTorqueWorkNm.toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      N·m
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Pada beban kerja F = {selectedRow.appliedLoadKn.toFixed(2)} kN
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
                    <div className="text-slate-700 dark:text-slate-300 font-medium">
                      Torsi pada Kapasitas Izin Maks (T<sub>maks</sub>)
                    </div>
                    <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {selectedRow.tighteningTorqueMaxNm.toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      N·m
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Pada Fmaks = {selectedRow.maxStaticLoadActiveKn.toFixed(2)} kN ({THREAD_MATERIAL_SPECS[selectedRow.materialGrade].shortLabel})
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
                    <div className="text-slate-700 dark:text-slate-300 font-medium">
                      Komparasi Torsi C45 vs Perunggu &amp; Efisiensi
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      <span className="text-blue-700 dark:text-blue-400">
                        C45 (μ=0.15): {selectedRow.tighteningTorqueC45WorkNm} N·m
                      </span>{' '}
                      ·{' '}
                      <span className="text-amber-800 dark:text-amber-400">
                        Brz (μ=0.10): {selectedRow.tighteningTorqueBronzeWorkNm} N·m
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Efisiensi η = {selectedRow.threadEfficiencyPct}% ·{' '}
                      {selectedRow.selfLocking
                        ? 'Self-Locking (λ ≤ ρ\')'
                        : 'Non Self-Locking (λ > ρ\')'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recharts Visualization: Static Axial Load Comparison (C45 vs Bronze) for all active project rows */}
            <ProjectLoadChart
              projectRows={projectRows}
              selectedRowId={selectedRow.id}
              onSelectRow={(id, rowNum) => {
                setSelectedRowId(id);
                setSelectedRowNumber(rowNum);
              }}
              isDark={theme === 'dark'}
            />

            {/* Custom Thread Generator Form */}
            <form
              onSubmit={handleCreateCustomProjectRow}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Tambah Baris Ulir (Tr, Metrik M, Square Sq, Buttress S, ACME, UNC/UNF, BSW, Pipa) ke Lembar Kerja Proyek
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih jenis standar ulir dan material (Baja C45 vs Perunggu CuSn12) untuk menghitung profil geometri, luas geser inti, beban statis, dan torsi secara otomatis.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-10 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Jenis Standar Ulir
                  </label>
                  <select
                    value={customThreadType}
                    onChange={(e) =>
                      setCustomThreadType(
                        e.target.value as ThreadStandardFamily
                      )
                    }
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  >
                    <option value="TR">Tr 30° (Trapesium ISO)</option>
                    <option value="METRIC_M">M 60° (Metrik Segitiga)</option>
                    <option value="SQ">Sq 0° (Persegi / Square)</option>
                    <option value="BUTTRESS_S">S 3°/30° (Gergaji / Buttress)</option>
                    <option value="ACME">ACME 29° (Trapesium Inci)</option>
                    <option value="UNC_UNF">UNC / UNF 60° (Inci)</option>
                    <option value="BSW_BSF">BSW / BSF 55° (Whitworth)</option>
                    <option value="BSP_NPT">G / NPT (Ulir Pipa)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Dia. Luar d (mm)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={4}
                    value={customD}
                    onChange={(e) => setCustomD(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pitch P (mm)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0.5}
                    value={customP}
                    onChange={(e) => setCustomP(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Start (n)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={customStarts}
                    onChange={(e) => setCustomStarts(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Material (C45 vs Perunggu)
                  </label>
                  <select
                    value={customMaterialGrade}
                    onChange={(e) => {
                      const nextGrade = e.target.value as ThreadMaterialGrade;
                      setCustomMaterialGrade(nextGrade);
                      setCustomFrictionMu(
                        THREAD_MATERIAL_SPECS[nextGrade].defaultFrictionMu
                      );
                    }}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  >
                    <option value="C45">Baja C45 (τ=65, μ=0.15)</option>
                    <option value="BRONZE">Perunggu CuSn12 (τ=30, μ=0.10)</option>
                    <option value="C45_BRONZE_PAIR">
                      C45 + Perunggu (τ=30, μ=0.10)
                    </option>
                    <option value="42CRMO4">Baja 42CrMo4 (τ=120, μ=0.14)</option>
                    <option value="SUS304">SUS 304 (τ=42, μ=0.18)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Beban Aksial F (kN)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={customAppliedLoadKn}
                    onChange={(e) =>
                      setCustomAppliedLoadKn(Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Koef. Gesek Ulir (μ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.02}
                    max={0.5}
                    value={customFrictionMu}
                    onChange={(e) =>
                      setCustomFrictionMu(Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Panjang Ulir (mm)
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={customLength}
                    onChange={(e) => setCustomLength(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Catatan Komponen
                  </label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                </div>
              </div>
            </form>

            {/* Editable Project Spreadsheet Grid with Core Shear Area & C45 vs Bronze Max Static Load Columns */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-2 text-center border-r border-slate-300 dark:border-slate-700 font-mono text-slate-500 dark:text-slate-400">
                        #
                      </th>
                      <th className="py-2 px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                        Kode Ulir
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        d (mm)
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        P (mm)
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        Start
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700">
                        d3 Inti (mm)
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-900">
                        <div>Luas Geser Inti</div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal">
                          Ac = (π/4)·d3² (mm²)
                        </div>
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700 bg-blue-50/70 dark:bg-blue-950/50">
                        <div className="text-blue-950 dark:text-blue-200">Fmaks C45</div>
                        <div className="text-[10px] font-mono text-blue-700 dark:text-blue-400 font-normal">
                          τ=65 MPa (kN)
                        </div>
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700 bg-amber-50/70 dark:bg-amber-950/50">
                        <div className="text-amber-950 dark:text-amber-200">Fmaks Perunggu</div>
                        <div className="text-[10px] font-mono text-amber-800 dark:text-amber-400 font-normal">
                          τ=30 MPa (kN)
                        </div>
                      </th>
                      <th className="py-2 px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                        Pilih Material Baris
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        τ_izin (MPa)
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/50">
                        <div className="text-emerald-950 dark:text-emerald-200">
                          Beban Statis Izin
                        </div>
                        <div className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 font-normal">
                          Fmaks = Ac × τ_izin
                        </div>
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-900">
                        <div>Beban Kerja F</div>
                        <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-normal">
                          Aktual (kN) [Edit]
                        </div>
                      </th>
                      <th className="py-2 px-2.5 text-left border-r border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-900">
                        <div>Status Keamanan</div>
                        <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-normal">
                          Indikator F ≤ Fmaks
                        </div>
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700 bg-indigo-50/70 dark:bg-indigo-950/50">
                        <div className="text-indigo-950 dark:text-indigo-200">Koef. Gesek μ</div>
                        <div className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 font-normal">
                          Ulir [Edit]
                        </div>
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700 bg-indigo-50/70 dark:bg-indigo-950/50">
                        <div className="text-indigo-950 dark:text-indigo-200">
                          Torsi Pengencangan
                        </div>
                        <div className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 font-normal">
                          T = 0.5·F·d2·tan(λ+ρ&apos;)
                        </div>
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-700">
                        D1 Bor Mur (mm)
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        Panjang (mm)
                      </th>
                      <th className="py-2 px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                        Catatan Proyek
                      </th>
                      <th className="py-2 px-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                    {projectRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={20}
                          className="py-10 text-center font-sans text-slate-500 dark:text-slate-400"
                        >
                          Lembar Kerja Proyek masih kosong. Tambahkan ulir dari form di atas atau salin dari Tabel Standar ISO.
                        </td>
                      </tr>
                    ) : (
                      projectRows.map((row, idx) => {
                        const isSelected = row.id === selectedRow.id;
                        const isEntering = Boolean(enteringRowIds[row.id]);
                        const isHighlighted = Boolean(highlightedRowIds[row.id]);
                        return (
                          <tr
                            key={row.id}
                            onClick={() => {
                              setSelectedRowId(row.id);
                              setSelectedRowNumber(idx + 1);
                            }}
                            className={`transform transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                              isEntering
                                ? 'opacity-0 -translate-y-2.5'
                                : 'opacity-100 translate-y-0'
                            } ${
                              isHighlighted
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40'
                                : isSelected
                                ? 'bg-blue-50/50 dark:bg-blue-950/30'
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2.5 font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                              {row.designation}
                            </td>
                            {/* Editable d */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                min={2}
                                value={row.d}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    d: Number(e.target.value),
                                  })
                                }
                                className="w-18 px-1.5 py-0.5 text-right bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                              />
                            </td>
                            {/* Editable P */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                min={0.25}
                                value={row.p}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    p: Number(e.target.value),
                                  })
                                }
                                className="w-14 px-1.5 py-0.5 text-right bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                              />
                            </td>
                            {/* Editable Starts */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={row.starts}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    starts: Number(e.target.value),
                                  })
                                }
                                className="w-11 px-1 py-0.5 text-right bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                              />
                            </td>
                            {/* d3 Core Diameter */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 text-blue-700 dark:text-blue-400 font-medium">
                              {row.d3.toFixed(3)}
                            </td>
                            {/* Core Shear Area Ac = (pi/4)*d3^2 */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-950/60">
                              {row.coreAreaMm2.toFixed(2)}
                            </td>
                            {/* Max Static Load C45 (kN) */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/25">
                              {row.maxStaticLoadC45Kn.toFixed(2)}
                            </td>
                            {/* Max Static Load Bronze (kN) */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-semibold text-amber-800 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/25">
                              {row.maxStaticLoadBronzeKn.toFixed(2)}
                            </td>
                            {/* Material Selector (C45 vs Bronze, etc.) */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800 font-sans">
                              <select
                                value={row.materialGrade}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    materialGrade: e.target
                                      .value as ThreadMaterialGrade,
                                  })
                                }
                                className="w-40 px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 font-medium text-slate-900 dark:text-slate-100"
                              >
                                <option value="C45">
                                  Baja C45 (τ=65 MPa)
                                </option>
                                <option value="BRONZE">
                                  Perunggu CuSn12 (τ=30 MPa)
                                </option>
                                <option value="C45_BRONZE_PAIR">
                                  C45 + Perunggu (τ=30 MPa)
                                </option>
                                <option value="42CRMO4">
                                  Baja 42CrMo4 (τ=120 MPa)
                                </option>
                                <option value="SUS304">
                                  SUS 304 (τ=42 MPa)
                                </option>
                              </select>
                            </td>
                            {/* Active Allowable Shear Stress tau_izin */}
                            <td className="py-1.5 px-2 text-right border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                              {row.allowableShearStressMpa}
                            </td>
                            {/* Active Max Static Axial Load (kN & Ton) */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/25 whitespace-nowrap">
                              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                {row.maxStaticLoadActiveKn.toFixed(2)} kN
                              </span>{' '}
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                ({row.maxStaticLoadActiveTon.toFixed(2)} T)
                              </span>
                            </td>
                            {/* Editable Applied Static Axial Load F_kerja (kN) */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={row.appliedLoadKn}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    appliedLoadKn: Number(e.target.value),
                                  })
                                }
                                className="w-20 px-1.5 py-0.5 text-right bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 font-semibold text-slate-900 dark:text-slate-100"
                              />
                            </td>
                            {/* Green / Red Status Lamp Indicator (Lampu Hijau = Aman, Lampu Merah = Overload) */}
                            <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap font-sans">
                              <div className="flex items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className={`inline-block w-3 h-3 rounded-full shrink-0 border ${
                                    row.isLoadSafe
                                      ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.75)]'
                                      : 'bg-red-600 border-red-700 shadow-[0_0_8px_rgba(220,38,38,0.85)]'
                                  }`}
                                />
                                <span
                                  className={`font-semibold text-xs ${
                                    row.isLoadSafe
                                      ? 'text-emerald-800 dark:text-emerald-400'
                                      : 'text-red-700 dark:text-red-400'
                                  }`}
                                >
                                  {row.isLoadSafe ? 'AMAN' : 'OVERLOAD'}
                                </span>
                                <span className="text-slate-400 dark:text-slate-600">·</span>
                                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                  {row.loadRatioPct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            {/* Editable Thread Friction Coefficient mu */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-950/20">
                              <input
                                type="number"
                                step="0.01"
                                min={0.02}
                                max={0.5}
                                value={row.frictionMu}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    frictionMu: Number(e.target.value),
                                  })
                                }
                                className="w-16 px-1.5 py-0.5 text-right bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800 rounded focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 font-semibold text-indigo-950 dark:text-indigo-200"
                              />
                            </td>
                            {/* Calculated Tightening Torque T (N*m) at F_kerja & T_max */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 bg-indigo-50/30 dark:bg-indigo-950/25 whitespace-nowrap">
                              <div className="font-semibold text-indigo-900 dark:text-indigo-300">
                                {row.tighteningTorqueWorkNm.toFixed(2)} N·m
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                Maks: {row.tighteningTorqueMaxNm.toFixed(1)} N·m · η={row.threadEfficiencyPct}%
                              </div>
                            </td>
                            {/* D1 Tap Drill */}
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 text-amber-800 dark:text-amber-400">
                              {row.D1.toFixed(3)}
                            </td>
                            {/* Editable Length */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step={10}
                                value={row.lengthMm ?? 500}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    lengthMm: Number(e.target.value),
                                  })
                                }
                                className="w-16 px-1.5 py-0.5 text-right bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                              />
                            </td>
                            {/* Editable Notes */}
                            <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800 font-sans">
                              <input
                                type="text"
                                value={row.notes ?? ''}
                                onChange={(e) =>
                                  handleUpdateProjectRow(row.id, {
                                    notes: e.target.value,
                                  })
                                }
                                className="w-40 px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                              />
                            </td>
                            {/* Row Actions */}
                            <td className="py-1 px-2 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Duplikat baris"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddRowToProject(
                                      row,
                                      row.materialGrade
                                    );
                                  }}
                                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Hapus baris"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProjectRow(row.id);
                                  }}
                                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CAD & Lead Screw Preview for the Selected Project Row */}
            <ThreadProfileSvg row={selectedRow} />
          </div>
        )}

        {/* =========================================================
            VIEW 3: PROFIL CAD, KALKULATOR SPINDEL & G-CODE CNC
           ========================================================= */}
        {activeView === 'cad_calc' && (
          <div className="space-y-6">
            {/* Quick Thread Selector Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Pilih Spesifikasi Ulir (Tr 8 – Tr 1120):
                </label>
                <select
                  value={selectedRow.id}
                  onChange={(e) => setSelectedRowId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 max-w-md"
                >
                  <optgroup label="Lembar Kerja Proyek Anda">
                    {projectRows.map((r) => (
                      <option key={r.id} value={r.id}>
                        [Proyek] {r.designation} (
                        {THREAD_MATERIAL_SPECS[r.materialGrade].shortLabel}) — Fmaks=
                        {r.maxStaticLoadActiveKn} kN
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Tabel Terfilter (Tr 8 – Tr 1120)">
                    {filteredStandardRows.slice(0, 500).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.designation} (Seri {r.series}) — C45:{' '}
                        {r.maxStaticLoadC45Kn} kN | Perunggu:{' '}
                        {r.maxStaticLoadBronzeKn} kN
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span>d3 = {selectedRow.d3} mm</span>
                <span>·</span>
                <span>Ac = {selectedRow.coreAreaMm2} mm²</span>
                <span>·</span>
                <span>Fmaks(C45) = {selectedRow.maxStaticLoadC45Kn} kN</span>
                <span>·</span>
                <span>
                  Fmaks(Perunggu) = {selectedRow.maxStaticLoadBronzeKn} kN
                </span>
              </div>
            </div>

            {/* Real-Time Three.js 3D Thread Profile Preview */}
            <Thread3DPreviewPanel row={selectedRow} />

            {/* 2D Blueprint SVG */}
            <ThreadProfileSvg row={selectedRow} />

            {/* Interactive DIN 103 / ISO 2903 Tolerance & Deviation Calculator Panel */}
            <ToleranceCalculatorPanel
              activeRow={selectedRow}
              onAddCalculatedToProject={(d, p, extTol, intTol, notes) => {
                const newRow = calculateTrThread(
                  d,
                  p,
                  1,
                  selectedRow.starts || 1,
                  extTol,
                  intTol,
                  {
                    id: `proj-tol-${Date.now()}`,
                    materialGrade: selectedRow.materialGrade || 'C45',
                    lengthMm: selectedRow.lengthMm ?? 500,
                    material:
                      THREAD_MATERIAL_SPECS[selectedRow.materialGrade || 'C45']
                        .label,
                    notes,
                  }
                );
                setProjectRows((prev) => [...prev, newRow]);
                setSelectedRowId(newRow.id);
                triggerRowEntryAnimation([newRow.id]);
                triggerToast(
                  `${newRow.designation} (${extTol}/${intTol}) ditambahkan ke Lembar Kerja Proyek.`
                );
              }}
            />

            {/* Advanced Tightening Torque Calculator Panel (MoS2, Anti-Seize, PTFE, Grease, Oil, Dry) */}
            <AdvancedTorqueCalculatorPanel
              row={selectedRow}
              onApplyTorqueSettingsToProject={(
                frictionMu,
                appliedLoadKn,
                lubricantName
              ) => {
                const existsInProject = projectRows.some(
                  (r) => r.id === selectedRow.id
                );
                if (existsInProject) {
                  handleUpdateProjectRow(selectedRow.id, {
                    frictionMu,
                    appliedLoadKn,
                    notes: `Pelumas: ${lubricantName} (μ=${frictionMu.toFixed(
                      2
                    )})`,
                  });
                  triggerToast(
                    `Parameter torsi ${selectedRow.designation} (μ=${frictionMu.toFixed(
                      2
                    )}, ${lubricantName}) diperbarui di Lembar Kerja Proyek.`
                  );
                } else {
                  const matSpec =
                    THREAD_MATERIAL_SPECS[selectedRow.materialGrade || 'C45'];
                  const newRow = calculateTrThread(
                    selectedRow.d,
                    selectedRow.p,
                    selectedRow.series,
                    selectedRow.starts,
                    selectedRow.extTolClass,
                    selectedRow.intTolClass,
                    {
                      id: `proj-trq-${Date.now()}`,
                      materialGrade: selectedRow.materialGrade || 'C45',
                      appliedLoadKn,
                      frictionMu,
                      lengthMm: selectedRow.lengthMm ?? 500,
                      material: matSpec.label,
                      notes: `Pelumas: ${lubricantName} (μ=${frictionMu.toFixed(
                        2
                      )})`,
                    }
                  );
                  setProjectRows((prev) => [...prev, newRow]);
                  setSelectedRowId(newRow.id);
                  triggerRowEntryAnimation([newRow.id]);
                  triggerToast(
                    `${newRow.designation} dengan pelumas ${lubricantName} (μ=${frictionMu.toFixed(
                      2
                    )}) ditambahkan ke Lembar Kerja Proyek.`
                  );
                }
              }}
            />

            {/* Recharts Visualization: Friction Coefficient (mu) vs Tightening Torque (T) & Core d3 Stress */}
            <FrictionTorqueChartPanel
              row={selectedRow}
              isDark={theme === 'dark'}
              onSelectFrictionMu={(newMu) => {
                const existsInProject = projectRows.some(
                  (r) => r.id === selectedRow.id
                );
                if (existsInProject) {
                  handleUpdateProjectRow(selectedRow.id, {
                    frictionMu: newMu,
                  });
                  triggerToast(
                    `Koefisien gesek ${selectedRow.designation} diperbarui menjadi μ = ${newMu.toFixed(
                      2
                    )} dari grafik.`
                  );
                }
              }}
            />

            {/* Lead Screw Mechanics & CNC G-Code */}
            <LeadScrewCalculator row={selectedRow} />
          </div>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Thread Calculation · Standar Geometri Ulir Metrik Trapesium Tr 8 s/d Tr 1120 (ISO 2901–2904, DIN 103 & DIN 2781)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('standard')}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Tabel Standar Tr 8 – Tr 1120
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveView('project')}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Lembar Kerja Proyek
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
