import express, { type Request, type Response } from 'express';
import {
  type TrCalculatedRow,
  getInitialProjectWorksheet,
} from '../src/data/trThreadData.ts';

interface PersistedWorkspaceState {
  projectName: string;
  preparedBy: string;
  projectRows: TrCalculatedRow[];
  customMeasuredWireM: Record<string, number>;
  wireCheckPreset: string;
  updatedAt: string;
}

let memoryWorkspaceState: PersistedWorkspaceState = {
  projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
  preparedBy: 'Tim Rekayasa Mekanik & QC',
  projectRows: getInitialProjectWorksheet(),
  customMeasuredWireM: {},
  wireCheckPreset: 'mixed_qc',
  updatedAt: new Date().toISOString(),
};

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, platform: 'vercel', updatedAt: memoryWorkspaceState.updatedAt });
});

app.get('/api/worksheet', (_req: Request, res: Response) => {
  res.json(memoryWorkspaceState);
});

app.put('/api/worksheet', (req: Request, res: Response) => {
  const body = req.body || {};
  memoryWorkspaceState = {
    projectName:
      typeof body.projectName === 'string'
        ? body.projectName
        : memoryWorkspaceState.projectName,
    preparedBy:
      typeof body.preparedBy === 'string'
        ? body.preparedBy
        : memoryWorkspaceState.preparedBy,
    projectRows: Array.isArray(body.projectRows)
      ? body.projectRows
      : memoryWorkspaceState.projectRows,
    customMeasuredWireM:
      body.customMeasuredWireM && typeof body.customMeasuredWireM === 'object'
        ? body.customMeasuredWireM
        : memoryWorkspaceState.customMeasuredWireM,
    wireCheckPreset:
      typeof body.wireCheckPreset === 'string'
        ? body.wireCheckPreset
        : memoryWorkspaceState.wireCheckPreset,
    updatedAt: new Date().toISOString(),
  };
  res.json(memoryWorkspaceState);
});

app.post('/api/worksheet/reset', (_req: Request, res: Response) => {
  memoryWorkspaceState = {
    projectName: 'Spindel & Mur Ulir Trapesium Workshop Utama',
    preparedBy: 'Tim Rekayasa Mekanik & QC',
    projectRows: getInitialProjectWorksheet(),
    customMeasuredWireM: {},
    wireCheckPreset: 'mixed_qc',
    updatedAt: new Date().toISOString(),
  };
  res.json(memoryWorkspaceState);
});

app.get('/api/wire-inspections', (_req: Request, res: Response) => {
  res.json([]);
});

app.post('/api/wire-inspections', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post('/api/supabase/sync', (req: Request, res: Response) => {
  const body = req.body || {};
  if (body.mode !== 'pull' && Array.isArray(body.projectRows) && body.projectRows.length > 0) {
    memoryWorkspaceState = {
      projectName:
        typeof body.projectName === 'string'
          ? body.projectName
          : memoryWorkspaceState.projectName,
      preparedBy:
        typeof body.preparedBy === 'string'
          ? body.preparedBy
          : memoryWorkspaceState.preparedBy,
      projectRows: body.projectRows,
      customMeasuredWireM:
        body.customMeasuredWireM && typeof body.customMeasuredWireM === 'object'
          ? body.customMeasuredWireM
          : memoryWorkspaceState.customMeasuredWireM,
      wireCheckPreset:
        typeof body.wireCheckPreset === 'string'
          ? body.wireCheckPreset
          : memoryWorkspaceState.wireCheckPreset,
      updatedAt: new Date().toISOString(),
    };
  }
  res.json(memoryWorkspaceState);
});

export default app;
