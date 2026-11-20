import express, { type Request, type Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {
  type TrCalculatedRow,
  calculateTrThread,
  getInitialProjectWorksheet,
  type ThreadSeries,
  type ExternalTolClass,
  type InternalTolClass,
  type ThreadMaterialGrade,
  THREAD_MATERIAL_SPECS,
} from './src/data/trThreadData.ts';
import type { ThreadStandardFamily } from './src/data/multiThreadCatalog.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

// Supabase Rest v1 configuration (server-side proxy)
const SUPABASE_PROJECT_ID =
  process.env.SUPABASE_PROJECT_ID || 'zfxzrhqiiojhojvlxqsj';
const SUPABASE_REST_URL = (
  process.env.SUPABASE_URL ||
  `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/`
).replace(/\/+$/, '');
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmeHpyaHFpaW9qaG9qdmx4cXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzgxNjgsImV4cCI6MjEwNjMxNDE2OH0.NvvHMejF2vq3b8wM2swVLD22h_f6an91gYQYAT7A2Ek';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_KBrCoCSfUnYOFb0A53cr3A_OW6N7W94';

export interface WireInspectionLogEntry {
  rowId: string;
  designation: string;
  bestWireSizeMm: number;
  measuredWireMMm: number;
  wireMMin7eMm: number;
  wireMMax7eMm: number;
  inferredD2Mm: number;
  qcStatus: 'GO' | 'NO_GO_UNDERSIZE' | 'NO_GO_OVERSIZE';
  inspectedAt?: string;
}

interface PersistedWorkspaceState {
  projectName: string;
  preparedBy: string;
  projectRows: TrCalculatedRow[];
  customMeasuredWireM: Record<string, number>;
  wireCheckPreset: string;
  updatedAt: string;
}

// Resilient server-side memory store synchronized with Supabase PostgREST tables:
// 1. public.thread_workspaces
// 2. public.thread_project_rows
// 3. public.thread_wire_inspections
let serverWorkspaceState: PersistedWorkspaceState = {
  projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
  preparedBy: 'Tim Rekayasa Mekanik & QC',
  projectRows: getInitialProjectWorksheet(),
  customMeasuredWireM: {},
  wireCheckPreset: 'mixed_qc',
  updatedAt: new Date().toISOString(),
};

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

function mapRowToSupabaseProjectRowRecord(row: TrCalculatedRow) {
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

function mapSupabaseProjectRowToCalculatedRow(
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
    tpi: dbRow.tpi !== null && dbRow.tpi !== undefined ? Number(dbRow.tpi) : undefined,
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
    lengthMm:
      dbRow.length_mm !== undefined ? Number(dbRow.length_mm) : 500,
    material: matSpec.label,
    notes: typeof dbRow.notes === 'string' ? dbRow.notes : '',
  });
}

async function fetchRemoteWorkspaceFromSupabase(): Promise<Partial<PersistedWorkspaceState> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const [wsResponse, rowsResponse] = await Promise.all([
      fetch(`${SUPABASE_REST_URL}/thread_workspaces?id=eq.default&select=*`, {
        method: 'GET',
        headers: getSupabaseHeaders(false),
        signal: controller.signal,
      }),
      fetch(
        `${SUPABASE_REST_URL}/thread_project_rows?workspace_id=eq.default&select=*&order=created_at.asc`,
        {
          method: 'GET',
          headers: getSupabaseHeaders(false),
          signal: controller.signal,
        }
      ),
    ]);
    clearTimeout(timeout);

    let relationalRows: TrCalculatedRow[] | undefined;
    if (rowsResponse.ok) {
      const dbProjectRows = (await rowsResponse.json()) as Array<
        Record<string, any>
      >;
      if (Array.isArray(dbProjectRows) && dbProjectRows.length > 0) {
        relationalRows = dbProjectRows.map(mapSupabaseProjectRowToCalculatedRow);
      }
    }

    if (wsResponse.ok) {
      const rows = (await wsResponse.json()) as Array<{
        id?: string;
        project_name?: string;
        prepared_by?: string;
        project_rows?: TrCalculatedRow[];
        custom_measured_wire_m?: Record<string, number>;
        wire_check_preset?: string;
        updated_at?: string;
      }>;

      if (Array.isArray(rows) && rows.length > 0) {
        const record = rows[0];
        return {
          projectName:
            typeof record.project_name === 'string'
              ? record.project_name
              : undefined,
          preparedBy:
            typeof record.prepared_by === 'string'
              ? record.prepared_by
              : undefined,
          projectRows:
            Array.isArray(record.project_rows) && record.project_rows.length > 0
              ? record.project_rows
              : relationalRows,
          customMeasuredWireM:
            record.custom_measured_wire_m &&
            typeof record.custom_measured_wire_m === 'object'
              ? record.custom_measured_wire_m
              : undefined,
          wireCheckPreset:
            typeof record.wire_check_preset === 'string'
              ? record.wire_check_preset
              : undefined,
          updatedAt: record.updated_at || new Date().toISOString(),
        };
      }
    }

    if (relationalRows && relationalRows.length > 0) {
      return {
        projectRows: relationalRows,
        updatedAt: new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function pushWorkspaceToSupabase(
  state: PersistedWorkspaceState
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    // 1. Upsert main workspace document in public.thread_workspaces
    await fetch(`${SUPABASE_REST_URL}/thread_workspaces?on_conflict=id`, {
      method: 'POST',
      headers: getSupabaseHeaders(true),
      body: JSON.stringify({
        id: 'default',
        project_name: state.projectName,
        prepared_by: state.preparedBy,
        project_rows: state.projectRows,
        custom_measured_wire_m: state.customMeasuredWireM,
        wire_check_preset: state.wireCheckPreset,
        updated_at: state.updatedAt,
      }),
      signal: controller.signal,
    });

    // 2. Sync relational rows in public.thread_project_rows
    if (Array.isArray(state.projectRows) && state.projectRows.length > 0) {
      const relationalPayload = state.projectRows.map(
        mapRowToSupabaseProjectRowRecord
      );
      await fetch(`${SUPABASE_REST_URL}/thread_project_rows?on_conflict=id`, {
        method: 'POST',
        headers: getSupabaseHeaders(true),
        body: JSON.stringify(relationalPayload),
        signal: controller.signal,
      });
    }

    clearTimeout(timeout);
  } catch {
    // Fallback gracefully to server-side state when offline or table is not yet created
  }
}

async function fetchWireInspectionsFromSupabase(): Promise<
  Array<Record<string, any>>
> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `${SUPABASE_REST_URL}/thread_wire_inspections?workspace_id=eq.default&select=*&order=inspected_at.desc&limit=50`,
      {
        method: 'GET',
        headers: getSupabaseHeaders(false),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function syncWithSupabaseOnBoot(): Promise<void> {
  try {
    const remote = await fetchRemoteWorkspaceFromSupabase();
    if (remote && remote.projectRows && remote.projectRows.length > 0) {
      serverWorkspaceState = {
        projectName: remote.projectName ?? serverWorkspaceState.projectName,
        preparedBy: remote.preparedBy ?? serverWorkspaceState.preparedBy,
        projectRows: remote.projectRows,
        customMeasuredWireM:
          remote.customMeasuredWireM ??
          serverWorkspaceState.customMeasuredWireM,
        wireCheckPreset:
          remote.wireCheckPreset ?? serverWorkspaceState.wireCheckPreset,
        updatedAt: remote.updatedAt ?? serverWorkspaceState.updatedAt,
      };
      // Ensure relational rows table is also populated
      await pushWorkspaceToSupabase(serverWorkspaceState);
    } else {
      // Remote table is empty after schema.sql setup -> push initial project rows immediately
      await pushWorkspaceToSupabase(serverWorkspaceState);
    }
  } catch {
    // Keep default state if unreachable
  }
}

async function pushWireInspectionToSupabase(
  entry: WireInspectionLogEntry
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    await fetch(`${SUPABASE_REST_URL}/thread_wire_inspections`, {
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
        inspected_at: entry.inspectedAt || new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Fallback gracefully if table is not yet created
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // GET /api/worksheet — Retrieve persisted project worksheet & 3-wire QC data
  app.get('/api/worksheet', async (_req: Request, res: Response) => {
    try {
      const remote = await fetchRemoteWorkspaceFromSupabase();
      if (remote) {
        const hadRemoteRows =
          Array.isArray(remote.projectRows) && remote.projectRows.length > 0;
        serverWorkspaceState = {
          projectName: remote.projectName ?? serverWorkspaceState.projectName,
          preparedBy: remote.preparedBy ?? serverWorkspaceState.preparedBy,
          projectRows: hadRemoteRows
            ? remote.projectRows!
            : serverWorkspaceState.projectRows,
          customMeasuredWireM:
            remote.customMeasuredWireM ??
            serverWorkspaceState.customMeasuredWireM,
          wireCheckPreset:
            remote.wireCheckPreset ?? serverWorkspaceState.wireCheckPreset,
          updatedAt: remote.updatedAt ?? serverWorkspaceState.updatedAt,
        };
        if (!hadRemoteRows) {
          void pushWorkspaceToSupabase(serverWorkspaceState);
        }
      }
      res.json(serverWorkspaceState);
    } catch {
      res.json(serverWorkspaceState);
    }
  });

  // POST /api/supabase/sync — Full bidirectional sync with Supabase tables
  app.post('/api/supabase/sync', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const mode: 'push' | 'pull' = body.mode === 'pull' ? 'pull' : 'push';

      if (mode === 'pull') {
        const remote = await fetchRemoteWorkspaceFromSupabase();
        if (remote && remote.projectRows && remote.projectRows.length > 0) {
          serverWorkspaceState = {
            projectName: remote.projectName ?? serverWorkspaceState.projectName,
            preparedBy: remote.preparedBy ?? serverWorkspaceState.preparedBy,
            projectRows: remote.projectRows,
            customMeasuredWireM:
              remote.customMeasuredWireM ??
              serverWorkspaceState.customMeasuredWireM,
            wireCheckPreset:
              remote.wireCheckPreset ?? serverWorkspaceState.wireCheckPreset,
            updatedAt: remote.updatedAt ?? new Date().toISOString(),
          };
        } else {
          await pushWorkspaceToSupabase(serverWorkspaceState);
        }
        res.json(serverWorkspaceState);
        return;
      }

      if (Array.isArray(body.projectRows) && body.projectRows.length > 0) {
        serverWorkspaceState = {
          projectName:
            typeof body.projectName === 'string'
              ? body.projectName
              : serverWorkspaceState.projectName,
          preparedBy:
            typeof body.preparedBy === 'string'
              ? body.preparedBy
              : serverWorkspaceState.preparedBy,
          projectRows: body.projectRows,
          customMeasuredWireM:
            body.customMeasuredWireM &&
            typeof body.customMeasuredWireM === 'object'
              ? body.customMeasuredWireM
              : serverWorkspaceState.customMeasuredWireM,
          wireCheckPreset:
            typeof body.wireCheckPreset === 'string'
              ? body.wireCheckPreset
              : serverWorkspaceState.wireCheckPreset,
          updatedAt: new Date().toISOString(),
        };
      }

      await pushWorkspaceToSupabase(serverWorkspaceState);
      res.json(serverWorkspaceState);
    } catch {
      res.status(500).json({ error: 'Failed to synchronize with Supabase.' });
    }
  });

  // GET /api/wire-inspections — Retrieve recent 3-wire Go/No-Go inspections from Supabase
  app.get('/api/wire-inspections', async (_req: Request, res: Response) => {
    try {
      const items = await fetchWireInspectionsFromSupabase();
      res.json(items);
    } catch {
      res.json([]);
    }
  });

  // PUT /api/worksheet — Save project worksheet, relational rows, & 3-wire measurements
  app.put('/api/worksheet', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      serverWorkspaceState = {
        projectName:
          typeof body.projectName === 'string'
            ? body.projectName
            : serverWorkspaceState.projectName,
        preparedBy:
          typeof body.preparedBy === 'string'
            ? body.preparedBy
            : serverWorkspaceState.preparedBy,
        projectRows: Array.isArray(body.projectRows)
          ? body.projectRows
          : serverWorkspaceState.projectRows,
        customMeasuredWireM:
          body.customMeasuredWireM &&
          typeof body.customMeasuredWireM === 'object'
            ? body.customMeasuredWireM
            : serverWorkspaceState.customMeasuredWireM,
        wireCheckPreset:
          typeof body.wireCheckPreset === 'string'
            ? body.wireCheckPreset
            : serverWorkspaceState.wireCheckPreset,
        updatedAt: new Date().toISOString(),
      };

      await pushWorkspaceToSupabase(serverWorkspaceState);
      res.json(serverWorkspaceState);
    } catch {
      res.status(500).json({ error: 'Failed to save worksheet data.' });
    }
  });

  // POST /api/wire-inspections — Log 3-wire Go/No-Go 7e/7H inspection to public.thread_wire_inspections
  app.post('/api/wire-inspections', async (req: Request, res: Response) => {
    try {
      const body = req.body as WireInspectionLogEntry;
      if (body && body.rowId && typeof body.measuredWireMMm === 'number') {
        serverWorkspaceState.customMeasuredWireM[body.rowId] =
          body.measuredWireMMm;
        serverWorkspaceState.updatedAt = new Date().toISOString();
        await Promise.all([
          pushWireInspectionToSupabase(body),
          pushWorkspaceToSupabase(serverWorkspaceState),
        ]);
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to log wire inspection.' });
    }
  });

  // POST /api/worksheet/reset — Reset worksheet rows to initial engineering template
  app.post('/api/worksheet/reset', async (_req: Request, res: Response) => {
    try {
      serverWorkspaceState = {
        projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
        preparedBy: 'Tim Rekayasa Mekanik & QC',
        projectRows: getInitialProjectWorksheet(),
        customMeasuredWireM: {},
        wireCheckPreset: 'mixed_qc',
        updatedAt: new Date().toISOString(),
      };
      await pushWorkspaceToSupabase(serverWorkspaceState);
      res.json(serverWorkspaceState);
    } catch {
      res.status(500).json({ error: 'Failed to reset worksheet data.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Thread Calculation server running on http://0.0.0.0:${PORT}`);
    void syncWithSupabaseOnBoot();
  });
}

startServer();
