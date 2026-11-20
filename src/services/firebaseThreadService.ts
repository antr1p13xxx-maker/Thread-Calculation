import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  TrCalculatedRow,
  calculateTrThread,
  ThreadSeries,
  ExternalTolClass,
  InternalTolClass,
  ThreadMaterialGrade,
  THREAD_MATERIAL_SPECS,
} from '../data/trThreadData';
import { ThreadStandardFamily } from '../data/multiThreadCatalog';
import type {
  WorkspacePersistencePayload,
  WireInspectionLogPayload,
  WireInspectionRecord,
} from './threadDatabaseService';

const VALID_WIRE_PRESETS = new Set([
  'mixed_qc',
  'target_7e',
  'nominal_basic_d2',
  'undersize_nogo',
  'oversize_nogo',
]);

const VALID_THREAD_TYPES = new Set([
  'TR',
  'METRIC_M',
  'SQ',
  'BUTTRESS_S',
  'ACME',
  'UNC_UNF',
  'BSW_BSF',
  'BSP_NPT',
]);

const VALID_EXT_TOLS = new Set(['7e', '7h', '8e', '8c']);
const VALID_INT_TOLS = new Set(['7H', '8H']);
const VALID_MATERIAL_GRADES = new Set([
  'C45',
  'BRONZE',
  'C45_BRONZE_PAIR',
  '42CRMO4',
  'SUS304',
]);

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = String(raw || 'item')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'item';
}

function sanitizeCustomMeasuredMap(
  input: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  const entries = Object.entries(input || {}).slice(0, 100);
  for (const [key, val] of entries) {
    const safeKey = sanitizeFirestoreId(key);
    const num = Number(val);
    if (safeKey && Number.isFinite(num) && num > 0) {
      out[safeKey] = Number(num.toFixed(3));
    }
  }
  return out;
}

function sanitizeWorkspaceMeta(payload: WorkspacePersistencePayload) {
  const projectName =
    String(payload.projectName || 'Spindel & Mur Ulir Trapesium Workshop Utama')
      .trim()
      .slice(0, 200) || 'Spindel & Mur Ulir Trapesium Workshop Utama';
  const preparedBy =
    String(payload.preparedBy || 'Tim Rekayasa Mekanik & QC')
      .trim()
      .slice(0, 150) || 'Tim Rekayasa Mekanik & QC';
  const wireCheckPreset = VALID_WIRE_PRESETS.has(payload.wireCheckPreset)
    ? payload.wireCheckPreset
    : 'mixed_qc';
  const customMeasuredWireM = sanitizeCustomMeasuredMap(
    payload.customMeasuredWireM
  );
  return {
    projectName,
    preparedBy,
    wireCheckPreset,
    customMeasuredWireM,
  };
}

function mapRowToFirestoreFields(row: TrCalculatedRow) {
  const threadType = VALID_THREAD_TYPES.has(row.threadType || 'TR')
    ? row.threadType || 'TR'
    : 'TR';
  const extTolClass = VALID_EXT_TOLS.has(row.extTolClass)
    ? row.extTolClass
    : '7e';
  const intTolClass = VALID_INT_TOLS.has(row.intTolClass)
    ? row.intTolClass
    : '7H';
  const materialGrade = VALID_MATERIAL_GRADES.has(row.materialGrade)
    ? row.materialGrade
    : 'C45';

  const base: Record<string, unknown> = {
    threadType,
    designation:
      String(row.designation || 'Tr')
        .trim()
        .slice(0, 120) || 'Tr',
    series: Number(row.series) || 1,
    threadAngleDeg: Number(row.threadAngleDeg) || 30,
    flankHalfAngleDeg: Number(row.flankHalfAngleDeg) || 15,
    d: Math.max(0.1, Number(row.d) || 20),
    p: Math.max(0.05, Number(row.p) || 4),
    starts: Math.max(1, Number(row.starts) || 1),
    ph: Number(row.ph) || 4,
    d2: Number(row.d2) || 18,
    d3: Number(row.d3) || 15.5,
    D1: Number(row.D1) || 16,
    D4: Number(row.D4) || 20.5,
    H1: Number(row.H1) || 2,
    h3: Number(row.h3) || 2.25,
    ac: Number(row.ac) || 0.25,
    extTolClass,
    intTolClass,
    d2Min: Number(row.d2Min) || 0,
    d2Max: Number(row.d2Max) || 0,
    d2Min7e: Number(row.d2Min7e) || 0,
    d2Max7e: Number(row.d2Max7e) || 0,
    bestWireSize: Number(row.bestWireSize) || 0,
    measureOverWires: Number(row.measureOverWires) || 0,
    wireMMin7e: Number(row.wireMMin7e) || 0,
    wireMMax7e: Number(row.wireMMax7e) || 0,
    coreAreaMm2: Number(row.coreAreaMm2) || 0,
    maxStaticLoadC45Kn: Number(row.maxStaticLoadC45Kn) || 0,
    maxStaticLoadBronzeKn: Number(row.maxStaticLoadBronzeKn) || 0,
    materialGrade,
    appliedLoadKn: Math.max(0, Number(row.appliedLoadKn) || 0),
    safetyFactor:
      row.appliedLoadKn > 0
        ? Number((row.maxStaticLoadActiveKn / row.appliedLoadKn).toFixed(2))
        : 0,
    isLoadSafe: Boolean(row.isLoadSafe),
    frictionMu: Math.max(0, Number(row.frictionMu) || 0.15),
    tighteningTorqueWorkNm: Number(row.tighteningTorqueWorkNm) || 0,
    lengthMm: Math.max(0, Number(row.lengthMm ?? 500)),
    notes: String(row.notes ?? '').slice(0, 500),
  };

  if (typeof row.tpi === 'number' && Number.isFinite(row.tpi)) {
    base.tpi = row.tpi;
  }

  return base;
}

function mapFirestoreDocToCalculatedRow(
  docId: string,
  data: Record<string, any>
): TrCalculatedRow {
  const d = Number(data.d) || 20;
  const p = Number(data.p) || 4;
  const series = (Number(data.series) || 1) as ThreadSeries;
  const starts = Number(data.starts) || 1;
  const extTol = (data.extTolClass || '7e') as ExternalTolClass;
  const intTol = (data.intTolClass || '7H') as InternalTolClass;
  const matGrade = (data.materialGrade || 'C45') as ThreadMaterialGrade;
  const threadType = (data.threadType || 'TR') as ThreadStandardFamily;
  const matSpec =
    THREAD_MATERIAL_SPECS[matGrade] || THREAD_MATERIAL_SPECS.C45;

  return calculateTrThread(d, p, series, starts, extTol, intTol, {
    id: docId,
    threadType,
    customDesignation:
      typeof data.designation === 'string' ? data.designation : undefined,
    tpi: typeof data.tpi === 'number' ? data.tpi : undefined,
    angleDegOverride:
      typeof data.threadAngleDeg === 'number'
        ? data.threadAngleDeg
        : undefined,
    materialGrade: matGrade,
    appliedLoadKn:
      typeof data.appliedLoadKn === 'number' ? data.appliedLoadKn : undefined,
    frictionMu:
      typeof data.frictionMu === 'number' ? data.frictionMu : undefined,
    lengthMm: typeof data.lengthMm === 'number' ? data.lengthMm : 500,
    material: matSpec.label,
    notes: typeof data.notes === 'string' ? data.notes : '',
  });
}

function toIsoTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function ensureFirestoreWorkspaceExists(
  uid: string,
  payload: WorkspacePersistencePayload
): Promise<string> {
  const workspaceId = sanitizeFirestoreId(uid);
  const wsPath = `workspaces/${workspaceId}`;
  const wsRef = doc(db, 'workspaces', workspaceId);
  const meta = sanitizeWorkspaceMeta(payload);

  try {
    const snap = await getDoc(wsRef);
    if (!snap.exists()) {
      await setDoc(wsRef, {
        ownerId: uid,
        ...meta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return workspaceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }
}

export async function loadWorkspaceFromFirestore(
  uid: string
): Promise<WorkspacePersistencePayload | null> {
  const workspaceId = sanitizeFirestoreId(uid);
  const wsPath = `workspaces/${workspaceId}`;
  const rowsPath = `workspaces/${workspaceId}/projectRows`;

  try {
    const wsSnap = await getDoc(doc(db, 'workspaces', workspaceId));
    if (!wsSnap.exists()) {
      return null;
    }

    const wsData = wsSnap.data();
    const rowsSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'projectRows'),
        where('ownerId', '==', uid)
      )
    );

    const projectRows = rowsSnap.docs
      .map((d) => ({
        row: mapFirestoreDocToCalculatedRow(d.id, d.data()),
        createdAtMs: d.data().createdAt?.toMillis?.() ?? 0,
      }))
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((item) => item.row);

    return {
      projectName:
        String(wsData.projectName || 'Spindel & Mur Ulir Trapesium Workshop Utama'),
      preparedBy: String(wsData.preparedBy || 'Tim Rekayasa Mekanik & QC'),
      projectRows,
      customMeasuredWireM:
        wsData.customMeasuredWireM &&
        typeof wsData.customMeasuredWireM === 'object'
          ? (wsData.customMeasuredWireM as Record<string, number>)
          : {},
      wireCheckPreset: String(wsData.wireCheckPreset || 'mixed_qc'),
      updatedAt: toIsoTimestamp(wsData.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${wsPath} | ${rowsPath}`);
  }
}

export async function saveWorkspaceToFirestore(
  uid: string,
  payload: WorkspacePersistencePayload
): Promise<string> {
  const workspaceId = sanitizeFirestoreId(uid);
  const wsPath = `workspaces/${workspaceId}`;
  const rowsPath = `workspaces/${workspaceId}/projectRows`;
  const wsRef = doc(db, 'workspaces', workspaceId);
  const meta = sanitizeWorkspaceMeta(payload);

  try {
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) {
      await setDoc(wsRef, {
        ownerId: uid,
        ...meta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(wsRef, {
        ...meta,
        updatedAt: serverTimestamp(),
      });
    }

    // Fetch existing rows so we preserve createdAt on updates and delete removed rows
    const existingRowsSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'projectRows'),
        where('ownerId', '==', uid)
      )
    );
    const existingIds = new Set(existingRowsSnap.docs.map((d) => d.id));
    const incomingIds = new Set<string>();

    const batch = writeBatch(db);
    for (const row of payload.projectRows.slice(0, 200)) {
      const rowId = sanitizeFirestoreId(row.id);
      incomingIds.add(rowId);
      const rowRef = doc(db, 'workspaces', workspaceId, 'projectRows', rowId);
      const fields = mapRowToFirestoreFields(row);

      if (existingIds.has(rowId)) {
        batch.update(rowRef, {
          ...fields,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(rowRef, {
          ownerId: uid,
          workspaceId,
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    for (const oldId of existingIds) {
      if (!incomingIds.has(oldId)) {
        batch.delete(doc(db, 'workspaces', workspaceId, 'projectRows', oldId));
      }
    }

    await batch.commit();
    return new Date().toISOString();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${wsPath} | ${rowsPath}`);
  }
}

export async function logWireInspectionToFirestore(
  uid: string,
  entry: WireInspectionLogPayload,
  workspaceSeedPayload: WorkspacePersistencePayload
): Promise<WireInspectionRecord> {
  const workspaceId = await ensureFirestoreWorkspaceExists(
    uid,
    workspaceSeedPayload
  );
  const inspectionId = sanitizeFirestoreId(`qc-${Date.now()}`);
  const docPath = `workspaces/${workspaceId}/wireInspections/${inspectionId}`;
  const docRef = doc(
    db,
    'workspaces',
    workspaceId,
    'wireInspections',
    inspectionId
  );

  const safeRowId = sanitizeFirestoreId(entry.rowId);
  const safeDesignation =
    String(entry.designation || 'Tr')
      .trim()
      .slice(0, 120) || 'Tr';
  const safeQcStatus: WireInspectionRecord['qcStatus'] =
    entry.qcStatus === 'NO_GO_UNDERSIZE'
      ? 'NO_GO_UNDERSIZE'
      : entry.qcStatus === 'NO_GO_OVERSIZE'
      ? 'NO_GO_OVERSIZE'
      : 'GO';

  try {
    await setDoc(docRef, {
      ownerId: uid,
      workspaceId,
      rowId: safeRowId,
      designation: safeDesignation,
      bestWireSizeMm: Number(entry.bestWireSizeMm) || 0,
      measuredWireMMm: Number(entry.measuredWireMMm) || 0,
      wireMMin7eMm: Number(entry.wireMMin7eMm) || 0,
      wireMMax7eMm: Number(entry.wireMMax7eMm) || 0,
      inferredD2Mm: Number(entry.inferredD2Mm) || 0,
      qcStatus: safeQcStatus,
      inspectedAt: serverTimestamp(),
    });

    return {
      id: inspectionId,
      workspaceId,
      rowId: safeRowId,
      designation: safeDesignation,
      bestWireSizeMm: Number(entry.bestWireSizeMm) || 0,
      measuredWireMMm: Number(entry.measuredWireMMm) || 0,
      wireMMin7eMm: Number(entry.wireMMin7eMm) || 0,
      wireMMax7eMm: Number(entry.wireMMax7eMm) || 0,
      inferredD2Mm: Number(entry.inferredD2Mm) || 0,
      qcStatus: safeQcStatus,
      inspectedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function fetchWireInspectionsFromFirestore(
  uid: string,
  maxItems = 30
): Promise<WireInspectionRecord[]> {
  const workspaceId = sanitizeFirestoreId(uid);
  const path = `workspaces/${workspaceId}/wireInspections`;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'wireInspections'),
        where('ownerId', '==', uid),
        limit(maxItems)
      )
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          workspaceId: String(data.workspaceId || workspaceId),
          rowId: String(data.rowId || ''),
          designation: String(data.designation || 'Tr'),
          bestWireSizeMm: Number(data.bestWireSizeMm || 0),
          measuredWireMMm: Number(data.measuredWireMMm || 0),
          wireMMin7eMm: Number(data.wireMMin7eMm || 0),
          wireMMax7eMm: Number(data.wireMMax7eMm || 0),
          inferredD2Mm: Number(data.inferredD2Mm || 0),
          qcStatus:
            data.qcStatus === 'NO_GO_UNDERSIZE'
              ? ('NO_GO_UNDERSIZE' as const)
              : data.qcStatus === 'NO_GO_OVERSIZE'
              ? ('NO_GO_OVERSIZE' as const)
              : ('GO' as const),
          inspectedAt: toIsoTimestamp(data.inspectedAt),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime()
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToWireInspections(
  uid: string,
  onUpdate: (records: WireInspectionRecord[]) => void,
  maxItems = 30
): () => void {
  const workspaceId = sanitizeFirestoreId(uid);
  const path = `workspaces/${workspaceId}/wireInspections`;
  const q = query(
    collection(db, 'workspaces', workspaceId, 'wireInspections'),
    where('ownerId', '==', uid),
    limit(maxItems)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WireInspectionRecord[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            workspaceId: String(data.workspaceId || workspaceId),
            rowId: String(data.rowId || ''),
            designation: String(data.designation || 'Tr'),
            bestWireSizeMm: Number(data.bestWireSizeMm || 0),
            measuredWireMMm: Number(data.measuredWireMMm || 0),
            wireMMin7eMm: Number(data.wireMMin7eMm || 0),
            wireMMax7eMm: Number(data.wireMMax7eMm || 0),
            inferredD2Mm: Number(data.inferredD2Mm || 0),
            qcStatus:
              data.qcStatus === 'NO_GO_UNDERSIZE'
                ? ('NO_GO_UNDERSIZE' as const)
                : data.qcStatus === 'NO_GO_OVERSIZE'
                ? ('NO_GO_OVERSIZE' as const)
                : ('GO' as const),
            inspectedAt: toIsoTimestamp(data.inspectedAt),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime()
        );
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
