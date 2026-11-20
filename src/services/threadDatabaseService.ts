import {
  TrCalculatedRow,
  calculateTrThread,
  getInitialProjectWorksheet,
  ThreadSeries,
  ExternalTolClass,
  InternalTolClass,
  ThreadMaterialGrade,
  THREAD_MATERIAL_SPECS,
} from '../data/trThreadData';
import { ThreadStandardFamily } from '../data/multiThreadCatalog';

export interface WorkspacePersistencePayload {
  projectName: string;
  preparedBy: string;
  projectRows: TrCalculatedRow[];
  customMeasuredWireM: Record<string, number>;
  wireCheckPreset: string;
  updatedAt?: string;
}

export interface WireInspectionLogPayload {
  rowId: string;
  designation: string;
  bestWireSizeMm: number;
  measuredWireMMm: number;
  wireMMin7eMm: number;
  wireMMax7eMm: number;
  inferredD2Mm: number;
  qcStatus: 'GO' | 'NO_GO_UNDERSIZE' | 'NO_GO_OVERSIZE';
}

export interface WireInspectionRecord extends WireInspectionLogPayload {
  id?: number | string;
  workspaceId?: string;
  inspectedAt: string;
}

// Supabase Project Configuration (Thread Calculation — zfxzrhqiiojhojvlxqsj)
const SUPABASE_REST_URL = 'https://zfxzrhqiiojhojvlxqsj.supabase.co/rest/v1';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_KBrCoCSfUnYOFb0A53cr3A_OW6N7W94';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmeHpyaHFpaW9qaG9qdmx4cXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzgxNjgsImV4cCI6MjEwNjMxNDE2OH0.NvvHMejF2vq3b8wM2swVLD22h_f6an91gYQYAT7A2Ek';

function getSupabaseHeaders(preferUpsert = false): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'X-Client-Info': 'thread-calculation-webapp',
    'X-Supabase-Publishable-Key': SUPABASE_PUBLISHABLE_KEY,
  };
  if (preferUpsert) {
    headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
  }
  return headers;
}

function mapRowToSupabaseRecord(row: TrCalculatedRow) {
  return {
    id: row.id,
    workspace_id: 'default',
    thread_type: row.threadType || 'TR',
    designation: row.designation,
    series: row.series,
    thread_angle_deg: row.threadAngleDeg,
    flank_half_angle_deg: row.flankHalfAngleDeg,
    d: row.d,
    p: row.p,
    tpi: row.tpi ?? null,
    starts: row.starts,
    ph: row.ph,
    d2: row.d2,
    d3: row.d3,
    d1_nut: row.D1,
    d4_nut: row.D4,
    h1: row.H1,
    h3: row.h3,
    ac: row.ac,
    ext_tol_class: row.extTolClass,
    int_tol_class: row.intTolClass,
    d2_min: row.d2Min,
    d2_max: row.d2Max,
    d2_min_7e: row.d2Min7e,
    d2_max_7e: row.d2Max7e,
    best_wire_size: row.bestWireSize,
    measure_over_wires: row.measureOverWires,
    wire_m_min_7e: row.wireMMin7e,
    wire_m_max_7e: row.wireMMax7e,
    core_area_mm2: row.coreAreaMm2,
    max_static_load_c45_kn: row.maxStaticLoadC45Kn,
    max_static_load_bronze_kn: row.maxStaticLoadBronzeKn,
    material_grade: row.materialGrade,
    applied_load_kn: row.appliedLoadKn,
    safety_factor:
      row.appliedLoadKn > 0
        ? Number((row.maxStaticLoadActiveKn / row.appliedLoadKn).toFixed(2))
        : 0,
    is_load_safe: row.isLoadSafe,
    friction_mu: row.frictionMu,
    tightening_torque_nm: row.tighteningTorqueWorkNm,
    length_mm: row.lengthMm ?? 500,
    notes: row.notes ?? '',
    updated_at: new Date().toISOString(),
  };
}

function mapSupabaseRecordToCalculatedRow(
  dbRow: Record<string, any>
): TrCalculatedRow {
  const d = Number(dbRow.d) || 20;
  const p = Number(dbRow.p) || 4;
  const series = (Number(dbRow.series) || 1) as ThreadSeries;
  const starts = Number(dbRow.starts) || 1;
  const extTol = (dbRow.ext_tol_class || '7e') as ExternalTolClass;
  const intTol = (dbRow.int_tol_class || '7H') as InternalTolClass;
  const matGrade = (dbRow.material_grade || 'C45') as ThreadMaterialGrade;
  const threadType = (dbRow.thread_type || 'TR') as ThreadStandardFamily;
  const matSpec =
    THREAD_MATERIAL_SPECS[matGrade] || THREAD_MATERIAL_SPECS.C45;

  return calculateTrThread(d, p, series, starts, extTol, intTol, {
    id: String(dbRow.id || `proj-${Date.now()}`),
    threadType,
    customDesignation:
      typeof dbRow.designation === 'string' ? dbRow.designation : undefined,
    tpi:
      dbRow.tpi !== null && dbRow.tpi !== undefined
        ? Number(dbRow.tpi)
        : undefined,
    angleDegOverride:
      dbRow.thread_angle_deg !== undefined
        ? Number(dbRow.thread_angle_deg)
        : undefined,
    materialGrade: matGrade,
    appliedLoadKn:
      dbRow.applied_load_kn !== undefined
        ? Number(dbRow.applied_load_kn)
        : undefined,
    frictionMu:
      dbRow.friction_mu !== undefined ? Number(dbRow.friction_mu) : undefined,
    lengthMm: dbRow.length_mm !== undefined ? Number(dbRow.length_mm) : 500,
    material: matSpec.label,
    notes: typeof dbRow.notes === 'string' ? dbRow.notes : '',
  });
}

export const SUPABASE_SCHEMA_SQL = `-- ============================================================================
-- THREAD CALCULATION — SUPABASE DATABASE SCHEMA (PostgreSQL)
-- Project: Thread Calculation (zfxzrhqiiojhojvlxqsj)
-- ============================================================================

-- 1. Tabel Utama Workspace & Lembar Kerja Proyek
CREATE TABLE IF NOT EXISTS public.thread_workspaces (
  id TEXT PRIMARY KEY DEFAULT 'default',
  project_name TEXT NOT NULL DEFAULT 'Spindel & Mur Ulir Trapesium Workshop Utama',
  prepared_by TEXT NOT NULL DEFAULT 'Tim Rekayasa Mekanik & QC',
  project_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_measured_wire_m JSONB NOT NULL DEFAULT '{}'::jsonb,
  wire_check_preset TEXT NOT NULL DEFAULT 'mixed_qc',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Relasional Baris Kalkulasi Ulir Proyek
CREATE TABLE IF NOT EXISTS public.thread_project_rows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default'
    REFERENCES public.thread_workspaces(id) ON DELETE CASCADE,
  thread_type TEXT NOT NULL DEFAULT 'TR',
  designation TEXT NOT NULL,
  series SMALLINT NOT NULL DEFAULT 1,
  thread_angle_deg NUMERIC(6,2) NOT NULL DEFAULT 30,
  flank_half_angle_deg NUMERIC(6,2) NOT NULL DEFAULT 15,
  d NUMERIC(10,3) NOT NULL,
  p NUMERIC(10,4) NOT NULL,
  tpi NUMERIC(10,3),
  starts INT NOT NULL DEFAULT 1,
  ph NUMERIC(10,3) NOT NULL,
  d2 NUMERIC(10,3) NOT NULL,
  d3 NUMERIC(10,3) NOT NULL,
  d1_nut NUMERIC(10,3) NOT NULL,
  d4_nut NUMERIC(10,3) NOT NULL,
  h1 NUMERIC(10,3) NOT NULL,
  h3 NUMERIC(10,3) NOT NULL,
  ac NUMERIC(10,3) NOT NULL,
  ext_tol_class TEXT NOT NULL DEFAULT '7e',
  int_tol_class TEXT NOT NULL DEFAULT '7H',
  d2_min NUMERIC(10,3) NOT NULL,
  d2_max NUMERIC(10,3) NOT NULL,
  d2_min_7e NUMERIC(10,3) NOT NULL,
  d2_max_7e NUMERIC(10,3) NOT NULL,
  best_wire_size NUMERIC(10,3) NOT NULL,
  measure_over_wires NUMERIC(10,3) NOT NULL,
  wire_m_min_7e NUMERIC(10,3) NOT NULL,
  wire_m_max_7e NUMERIC(10,3) NOT NULL,
  core_area_mm2 NUMERIC(12,2) NOT NULL,
  max_static_load_c45_kn NUMERIC(12,2) NOT NULL,
  max_static_load_bronze_kn NUMERIC(12,2) NOT NULL,
  material_grade TEXT NOT NULL DEFAULT 'C45',
  applied_load_kn NUMERIC(12,2) NOT NULL DEFAULT 0,
  safety_factor NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_load_safe BOOLEAN NOT NULL DEFAULT TRUE,
  friction_mu NUMERIC(6,3) NOT NULL DEFAULT 0.15,
  tightening_torque_nm NUMERIC(12,2) NOT NULL DEFAULT 0,
  length_mm NUMERIC(10,2) NOT NULL DEFAULT 500,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Log Pemeriksaan Batas Toleransi 3-Kawat (QC Go/No-Go 7e/7H)
CREATE TABLE IF NOT EXISTS public.thread_wire_inspections (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default'
    REFERENCES public.thread_workspaces(id) ON DELETE CASCADE,
  row_id TEXT NOT NULL,
  designation TEXT NOT NULL,
  best_wire_size_mm NUMERIC(10,3) NOT NULL,
  measured_wire_m_mm NUMERIC(10,3) NOT NULL,
  wire_m_min_7e_mm NUMERIC(10,3) NOT NULL,
  wire_m_max_7e_mm NUMERIC(10,3) NOT NULL,
  inferred_d2_mm NUMERIC(10,3) NOT NULL,
  qc_status TEXT NOT NULL CHECK (qc_status IN ('GO', 'NO_GO_UNDERSIZE', 'NO_GO_OVERSIZE')),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const LOCAL_STORAGE_KEY = 'thread_calculation_workspace_v1';

function readLocalCache(): WorkspacePersistencePayload | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspacePersistencePayload;
    if (!parsed || !Array.isArray(parsed.projectRows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(payload: WorkspacePersistencePayload): void {
  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        ...payload,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchDirectlyFromSupabase(): Promise<WorkspacePersistencePayload | null> {
  try {
    const [wsRes, rowsRes] = await Promise.all([
      fetch(`${SUPABASE_REST_URL}/thread_workspaces?id=eq.default&select=*`, {
        method: 'GET',
        headers: getSupabaseHeaders(false),
      }),
      fetch(
        `${SUPABASE_REST_URL}/thread_project_rows?workspace_id=eq.default&select=*&order=created_at.asc`,
        {
          method: 'GET',
          headers: getSupabaseHeaders(false),
        }
      ),
    ]);

    let relationalRows: TrCalculatedRow[] = [];
    if (rowsRes.ok) {
      const rawRows = await rowsRes.json();
      if (Array.isArray(rawRows) && rawRows.length > 0) {
        relationalRows = rawRows.map(mapSupabaseRecordToCalculatedRow);
      }
    }

    if (wsRes.ok) {
      const wsArray = await wsRes.json();
      if (Array.isArray(wsArray) && wsArray.length > 0) {
        const rec = wsArray[0];
        const jsonRows = Array.isArray(rec.project_rows)
          ? (rec.project_rows as TrCalculatedRow[])
          : [];
        const resolvedRows =
          relationalRows.length > 0 ? relationalRows : jsonRows;

        return {
          projectName:
            rec.project_name ||
            'Spindel & Mur Ulir Trapesium Workshop Utama',
          preparedBy: rec.prepared_by || 'Tim Rekayasa Mekanik & QC',
          projectRows: resolvedRows,
          customMeasuredWireM:
            rec.custom_measured_wire_m &&
            typeof rec.custom_measured_wire_m === 'object'
              ? (rec.custom_measured_wire_m as Record<string, number>)
              : {},
          wireCheckPreset: rec.wire_check_preset || 'mixed_qc',
          updatedAt: rec.updated_at || new Date().toISOString(),
        };
      }
    }

    if (relationalRows.length > 0) {
      return {
        projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
        preparedBy: 'Tim Rekayasa Mekanik & QC',
        projectRows: relationalRows,
        customMeasuredWireM: {},
        wireCheckPreset: 'mixed_qc',
        updatedAt: new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function pushDirectlyToSupabase(
  payload: WorkspacePersistencePayload
): Promise<boolean> {
  try {
    const nowIso = payload.updatedAt || new Date().toISOString();

    // 1. Upsert workspace metadata & JSONB snapshot into public.thread_workspaces
    const wsRes = await fetch(
      `${SUPABASE_REST_URL}/thread_workspaces?on_conflict=id`,
      {
        method: 'POST',
        headers: getSupabaseHeaders(true),
        body: JSON.stringify({
          id: 'default',
          project_name: payload.projectName,
          prepared_by: payload.preparedBy,
          project_rows: payload.projectRows,
          custom_measured_wire_m: payload.customMeasuredWireM,
          wire_check_preset: payload.wireCheckPreset,
          updated_at: nowIso,
        }),
      }
    );

    // 2. Sync relational rows in public.thread_project_rows
    if (Array.isArray(payload.projectRows) && payload.projectRows.length > 0) {
      const relationalPayload = payload.projectRows.map(mapRowToSupabaseRecord);
      await fetch(`${SUPABASE_REST_URL}/thread_project_rows?on_conflict=id`, {
        method: 'POST',
        headers: getSupabaseHeaders(true),
        body: JSON.stringify(relationalPayload),
      });

      const validIdsList = payload.projectRows
        .map((r) => `"${String(r.id).replace(/"/g, '')}"`)
        .join(',');
      if (validIdsList) {
        await fetch(
          `${SUPABASE_REST_URL}/thread_project_rows?workspace_id=eq.default&id=not.in.(${encodeURIComponent(
            validIdsList
          )})`,
          {
            method: 'DELETE',
            headers: getSupabaseHeaders(false),
          }
        );
      }
    }

    return wsRes.ok;
  } catch {
    return false;
  }
}

const LOCAL_WIRE_INSPECTIONS_KEY = 'thread_calculation_wire_inspections_v1';

function readLocalWireInspections(): WireInspectionRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_WIRE_INSPECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalWireInspections(records: WireInspectionRecord[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_WIRE_INSPECTIONS_KEY,
      JSON.stringify(records.slice(0, 50))
    );
  } catch {
    // Ignore storage quota errors
  }
}

function mapRawWireInspection(item: Record<string, any>): WireInspectionRecord {
  return {
    id: item.id ?? `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: String(item.workspace_id || item.workspaceId || 'default'),
    rowId: String(item.row_id || item.rowId || ''),
    designation: String(item.designation || 'Tr'),
    bestWireSizeMm: Number(item.best_wire_size_mm ?? item.bestWireSizeMm ?? 0),
    measuredWireMMm: Number(
      item.measured_wire_m_mm ?? item.measuredWireMMm ?? 0
    ),
    wireMMin7eMm: Number(item.wire_m_min_7e_mm ?? item.wireMMin7eMm ?? 0),
    wireMMax7eMm: Number(item.wire_m_max_7e_mm ?? item.wireMMax7eMm ?? 0),
    inferredD2Mm: Number(item.inferred_d2_mm ?? item.inferredD2Mm ?? 0),
    qcStatus:
      item.qc_status === 'NO_GO_UNDERSIZE' ||
      item.qcStatus === 'NO_GO_UNDERSIZE'
        ? 'NO_GO_UNDERSIZE'
        : item.qc_status === 'NO_GO_OVERSIZE' ||
          item.qcStatus === 'NO_GO_OVERSIZE'
        ? 'NO_GO_OVERSIZE'
        : 'GO',
    inspectedAt: String(
      item.inspected_at || item.inspectedAt || new Date().toISOString()
    ),
  };
}

export async function fetchWireInspectionsFromSupabase(
  limit = 30
): Promise<WireInspectionRecord[]> {
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}/thread_wire_inspections?workspace_id=eq.default&select=*&order=inspected_at.desc&limit=${limit}`,
      {
        method: 'GET',
        headers: getSupabaseHeaders(false),
      }
    );
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw.map(mapRawWireInspection);
        writeLocalWireInspections(mapped);
        return mapped;
      }
    }
  } catch {
    // Fallback to backend proxy
  }

  try {
    const proxyRes = await fetch('/api/wire-inspections', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (proxyRes.ok) {
      const raw = await proxyRes.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw.map(mapRawWireInspection);
        writeLocalWireInspections(mapped);
        return mapped;
      }
    }
  } catch {
    // Fallback to local cache
  }

  return readLocalWireInspections();
}

export async function loadPersistedWorkspace(): Promise<WorkspacePersistencePayload> {
  const localCached = readLocalCache();

  // 1. Try direct Supabase PostgREST connection first
  const directRemote = await fetchDirectlyFromSupabase();
  if (directRemote) {
    if (directRemote.projectRows.length > 0) {
      writeLocalCache(directRemote);
      return directRemote;
    } else {
      // Newly created table from schema.sql has empty [] rows -> seed initial rows into Supabase immediately
      const initialSeed: WorkspacePersistencePayload = localCached &&
        localCached.projectRows.length > 0
        ? localCached
        : {
            projectName:
              directRemote.projectName ||
              'Spindel & Mur Ulir Trapesium Workshop Utama',
            preparedBy:
              directRemote.preparedBy || 'Tim Rekayasa Mekanik & QC',
            projectRows: getInitialProjectWorksheet(),
            customMeasuredWireM: directRemote.customMeasuredWireM || {},
            wireCheckPreset: directRemote.wireCheckPreset || 'mixed_qc',
            updatedAt: new Date().toISOString(),
          };
      void savePersistedWorkspace(initialSeed);
      return initialSeed;
    }
  }

  // 2. Fallback to backend /api/worksheet
  try {
    const response = await fetch('/api/worksheet', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const data = (await response.json()) as WorkspacePersistencePayload;
      if (data && Array.isArray(data.projectRows) && data.projectRows.length > 0) {
        writeLocalCache(data);
        return data;
      }
    }
  } catch {
    // Fallback to local cache
  }

  if (localCached && localCached.projectRows.length > 0) {
    return localCached;
  }

  return {
    projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
    preparedBy: 'Tim Rekayasa Mekanik & QC',
    projectRows: getInitialProjectWorksheet(),
    customMeasuredWireM: {},
    wireCheckPreset: 'mixed_qc',
    updatedAt: new Date().toISOString(),
  };
}

export async function pullWorkspaceFromSupabase(): Promise<WorkspacePersistencePayload | null> {
  const remote = await fetchDirectlyFromSupabase();
  if (remote && remote.projectRows.length > 0) {
    writeLocalCache(remote);
    return remote;
  }
  try {
    const res = await fetch('/api/supabase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'pull' }),
    });
    if (res.ok) {
      const data = (await res.json()) as WorkspacePersistencePayload;
      if (data && Array.isArray(data.projectRows) && data.projectRows.length > 0) {
        writeLocalCache(data);
        return data;
      }
    }
  } catch {
    // Ignore fallback error
  }
  return null;
}

export async function savePersistedWorkspace(
  payload: WorkspacePersistencePayload
): Promise<WorkspacePersistencePayload> {
  const timestamped: WorkspacePersistencePayload = {
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  writeLocalCache(timestamped);

  await Promise.allSettled([
    pushDirectlyToSupabase(timestamped),
    fetch('/api/supabase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...timestamped, mode: 'push' }),
    }),
  ]);

  return timestamped;
}

export async function logWireInspectionReading(
  entry: WireInspectionLogPayload
): Promise<WireInspectionRecord> {
  const inspectedAt = new Date().toISOString();
  const newRecord: WireInspectionRecord = {
    id: `qc-${Date.now()}`,
    workspaceId: 'default',
    ...entry,
    inspectedAt,
  };
  const existing = readLocalWireInspections();
  writeLocalWireInspections([newRecord, ...existing]);

  await Promise.allSettled([
    fetch(`${SUPABASE_REST_URL}/thread_wire_inspections`, {
      method: 'POST',
      headers: getSupabaseHeaders(false),
      body: JSON.stringify({
        workspace_id: 'default',
        row_id: entry.rowId,
        designation: entry.designation,
        best_wire_size_mm: entry.bestWireSizeMm,
        measured_wire_m_mm: entry.measuredWireMMm,
        wire_m_min_7e_mm: entry.wireMMin7eMm,
        wire_m_max_7e_mm: entry.wireMMax7eMm,
        inferred_d2_mm: entry.inferredD2Mm,
        qc_status: entry.qcStatus,
        inspected_at: inspectedAt,
      }),
    }),
    fetch('/api/wire-inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, inspectedAt }),
    }),
  ]);

  return newRecord;
}

export async function resetPersistedWorkspace(): Promise<WorkspacePersistencePayload> {
  const defaultState: WorkspacePersistencePayload = {
    projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
    preparedBy: 'Tim Rekayasa Mekanik & QC',
    projectRows: getInitialProjectWorksheet(),
    customMeasuredWireM: {},
    wireCheckPreset: 'mixed_qc',
    updatedAt: new Date().toISOString(),
  };
  writeLocalCache(defaultState);

  await Promise.allSettled([
    pushDirectlyToSupabase(defaultState),
    fetch('/api/worksheet/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
  ]);

  return defaultState;
}
