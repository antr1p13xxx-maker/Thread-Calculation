import {
  TrCalculatedRow,
  calculateTrThread,
  ThreadSeries,
  inferMaterialGrade,
} from '../data/trThreadData';

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
}

/**
 * Extract Spreadsheet ID from either a full Google Sheets URL or a raw ID string
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Build 2D array of headers + rows for Google Sheets export.
 * Supports live Google Sheets formulas (USER_ENTERED) including Core Shear Area (Luas Geser Inti)
 * and Maximum Allowable Static Axial Load for C45 vs Bronze.
 */
export function buildSheetValuesMatrix(
  rows: TrCalculatedRow[],
  useLiveFormulas: boolean,
  includeProjectCols: boolean
): (string | number)[][] {
  const baseHeaders = [
    'Kode Ulir (Designation)', // A
    'Seri ISO', // B
    'd (Dia. Luar mm)', // C
    'P (Pitch mm)', // D
    'n (Starts)', // E
    'Ph (Lead mm)', // F
    'd2 = D2 (Dia. Pitch mm)', // G
    'd3 (Dia. Inti Baut mm)', // H
    'D1 (Dia. Dalam Mur / Bor mm)', // I
    'D4 (Dia. Luar Mur mm)', // J
    'H1 (Tinggi Kontak mm)', // K
    'h3 = H4 (Tinggi Ulir mm)', // L
    'ac (Kelonggaran Puncak mm)', // M
    'f (Lebar Puncak mm)', // N
    'w (Lebar Ujung Pahat mm)', // O
    'dw (Kawat Uji Terbaik mm)', // P
    'M (Ukuran 3-Kawat mm)', // Q
    'Sudut Heliks (derajat)', // R
    'Luas Geser Inti Ac = (π/4)*d3^2 (mm2)', // S
    'Fmaks Statis C45 [τ=65 MPa] (kN)', // T
    'Fmaks Statis Perunggu [τ=30 MPa] (kN)', // U
    'Toleransi d2 Baut (min..max)', // V
    'Toleransi D2 Mur (min..max)', // W
  ];

  const headers = includeProjectCols
    ? [
        ...baseHeaders,
        'Material Pilihan', // X
        'τ_izin Material (MPa)', // Y
        'Beban Statis Maks Izin (kN)', // Z
        'Beban Statis Maks Izin (Ton)', // AA
        'Beban Kerja Aksial F (kN)', // AB
        'Status Keamanan Beban', // AC
        'Koefisien Gesek Ulir (μ)', // AD
        'Torsi Pengencangan Kerja T (N·m)', // AE
        'Panjang Ulir (mm)', // AF
        'Catatan Proyek', // AG
      ]
    : baseHeaders;

  const dataRows = rows.map((row, idx) => {
    const r = idx + 2; // 1-based row number in Google Sheets (row 1 is header)
    const tolExtStr = `${row.d2Min.toFixed(3)} .. ${row.d2Max.toFixed(3)} (${row.extTolClass})`;
    const tolIntStr = `${row.D2Min.toFixed(3)} .. ${row.D2Max.toFixed(3)} (${row.intTolClass})`;

    const baseRow: (string | number)[] = useLiveFormulas
      ? [
          `=IF(E${r}=1, "Tr "&C${r}&" x "&D${r}, "Tr "&C${r}&" x "&F${r}&" (P"&D${r}&")")`, // A: Designation
          row.series, // B: Series
          row.d, // C: d
          row.p, // D: P
          row.starts, // E: n
          `=E${r}*D${r}`, // F: Ph = n * P
          `=ROUND(C${r}-0.5*D${r}, 3)`, // G: d2 = d - 0.5*P
          `=ROUND(C${r}-2*L${r}, 3)`, // H: d3 = d - 2*h3
          `=ROUND(C${r}-2*K${r}, 3)`, // I: D1 = d - 2*H1
          `=ROUND(C${r}+2*M${r}, 3)`, // J: D4 = d + 2*ac
          `=ROUND(0.5*D${r}, 3)`, // K: H1 = 0.5*P
          `=ROUND(K${r}+M${r}, 3)`, // L: h3 = H1 + ac
          `=IF(D${r}<=1.5, 0.15, IF(D${r}<=5, 0.25, IF(D${r}<=12, 0.5, 1.0)))`, // M: ac
          `=ROUND(0.366025*D${r}, 3)`, // N: f
          `=ROUND(0.366025*D${r}-0.535898*M${r}, 3)`, // O: w
          `=ROUND(0.517638*D${r}, 3)`, // P: dw
          `=ROUND(G${r}-1.866025*D${r}+4.863703*P${r}, 3)`, // Q: M
          `=ROUND(DEGREES(ATAN(F${r}/(PI()*G${r}))), 2)`, // R: Lead angle
          `=ROUND((PI()/4)*(H${r}^2), 2)`, // S: Core shear area Ac = (pi/4) * d3^2
          `=ROUND((S${r}*65)/1000, 2)`, // T: Max static load C45 (tau = 65 MPa) in kN
          `=ROUND((S${r}*30)/1000, 2)`, // U: Max static load Bronze (tau = 30 MPa) in kN
          tolExtStr, // V
          tolIntStr, // W
        ]
      : [
          row.designation,
          row.series,
          row.d,
          row.p,
          row.starts,
          row.ph,
          row.d2,
          row.d3,
          row.D1,
          row.D4,
          row.H1,
          row.h3,
          row.ac,
          row.f,
          row.w,
          row.bestWireSize,
          row.measureOverWires,
          row.leadAngleDeg,
          row.coreAreaMm2,
          row.maxStaticLoadC45Kn,
          row.maxStaticLoadBronzeKn,
          tolExtStr,
          tolIntStr,
        ];

    if (includeProjectCols) {
      return [
        ...baseRow,
        row.material ?? 'Baja Karbon C45 / S45C', // X
        row.allowableShearStressMpa, // Y: tau_izin (MPa)
        useLiveFormulas
          ? `=ROUND((S${r}*Y${r})/1000, 2)` // Z: F_maks Izin (kN) = Ac * tau_izin / 1000
          : row.maxStaticLoadActiveKn,
        useLiveFormulas
          ? `=ROUND(Z${r}/9.80665, 2)` // AA: F_maks Izin (Ton)
          : row.maxStaticLoadActiveTon,
        row.appliedLoadKn, // AB: Beban Kerja Aksial F (kN)
        useLiveFormulas
          ? `=IF(AB${r}<=Z${r}, "AMAN ("&ROUND((AB${r}/Z${r})*100,1)&"%)", "OVERLOAD ("&ROUND((AB${r}/Z${r})*100,1)&"%)")` // AC: Status Keamanan Beban
          : `${row.isLoadSafe ? 'AMAN' : 'OVERLOAD'} (${row.loadRatioPct.toFixed(1)}%)`,
        row.frictionMu, // AD: Koefisien Gesek Ulir (mu)
        useLiveFormulas
          ? `=ROUND(0.5*AB${r}*G${r}*TAN(RADIANS(R${r})+ATAN(AD${r}/COS(RADIANS(15)))), 2)` // AE: Torsi Pengencangan T (N*m)
          : row.tighteningTorqueWorkNm,
        row.lengthMm ?? 500, // AF
        row.notes ?? '', // AG
      ];
    }
    return baseRow;
  });

  return [headers, ...dataRows];
}

/**
 * Fetch spreadsheet metadata and actual sheet tab names (never hardcoding "Sheet1")
 */
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetIdInput: string
): Promise<SpreadsheetMetadata> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const message =
      errBody?.error?.message ||
      `Gagal membaca metadata Google Sheet (HTTP ${res.status}). Pastikan ID benar dan Anda memiliki akses.`;
    throw new Error(message);
  }

  const data = await res.json();
  const sheets: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? 'Untitled',
    rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
    columnCount: s.properties?.gridProperties?.columnCount ?? 26,
  }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? 'Spreadsheet Tanpa Judul',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets,
  };
}

/**
 * Create a brand-new Google Spreadsheet containing:
 * 1. Standar_ISO_DIN103 (Standard Trapezoidal Thread Table)
 * 2. Lembar_Kerja_Proyek (Custom Project Worksheet with C45 vs Bronze Static Load Calculation)
 * 3. Rumus_Referensi_TR (ISO 2901 / DIN 103 & Core Shear Load Formula Reference)
 */
export async function createCompleteTrSpreadsheet(
  accessToken: string,
  title: string,
  standardRows: TrCalculatedRow[],
  projectRows: TrCalculatedRow[],
  useLiveFormulas: boolean = true
): Promise<SpreadsheetMetadata> {
  const createRes = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title:
            title.trim() ||
            'UlirTR Studio - Tabel & Kalkulator Ulir Trapesium ISO 2901',
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Standar_ISO_DIN103',
              gridProperties: {
                rowCount: Math.max(200, standardRows.length + 30),
                columnCount: 26,
                frozenRowCount: 1,
                frozenColumnCount: 1,
              },
            },
          },
          {
            properties: {
              sheetId: 1,
              title: 'Lembar_Kerja_Proyek',
              gridProperties: {
                rowCount: Math.max(100, projectRows.length + 30),
                columnCount: 30,
                frozenRowCount: 1,
                frozenColumnCount: 1,
              },
            },
          },
          {
            properties: {
              sheetId: 2,
              title: 'Rumus_Referensi_TR',
              gridProperties: {
                rowCount: 45,
                columnCount: 6,
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    }
  );

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        `Gagal membuat Google Spreadsheet baru (HTTP ${createRes.status}).`
    );
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;

  const standardMatrix = buildSheetValuesMatrix(
    standardRows,
    useLiveFormulas,
    false
  );
  const projectMatrix = buildSheetValuesMatrix(
    projectRows,
    useLiveFormulas,
    true
  );

  const formulaRefMatrix = [
    [
      'Simbol Parameter',
      'Nama Parameter (ISO 2901 / DIN 103)',
      'Rumus Matematis',
      'Rumus Google Sheets',
      'Satuan',
      'Keterangan Teknis',
    ],
    [
      'α (Alpha)',
      'Sudut Profil Ulir Trapesium Metrik',
      'α = 30°',
      '30',
      'derajat (°)',
      'Berbeda dengan ulir Acme (29°), ulir Tr menggunakan sudut puncak 30°',
    ],
    [
      'P',
      'Pitch / Kisar Ulir',
      'Input dari tabel ISO 2902 (1.5 .. 48 mm)',
      'D2',
      'mm',
      'Jarak aksial antara dua puncak gigi berdekatan',
    ],
    [
      'Ph',
      'Lead / Langkah Ulir',
      'Ph = n × P',
      '=E2*D2',
      'mm',
      'Jarak tempuh aksial dalam 1 putaran (n = jumlah start)',
    ],
    [
      'ac',
      'Kelonggaran Puncak (Crest Clearance)',
      '0.15 (P=1.5); 0.25 (P=2..5); 0.5 (P=6..12); 1.0 (P>=14)',
      '=IF(D2<=1.5,0.15,IF(D2<=5,0.25,IF(D2<=12,0.5,1.0)))',
      'mm',
      'Celah radial antara puncak dan dasar ulir',
    ],
    [
      'H1',
      'Tinggi Kontak Ulir (Basic Height)',
      'H1 = 0.5 × P',
      '=0.5*D2',
      'mm',
      'Tinggi tumpuan kontak efektif antara baut dan mur',
    ],
    [
      'h3 = H4',
      'Tinggi Ulir Baut & Mur',
      'h3 = H1 + ac = 0.5 × P + ac',
      '=K2+M2',
      'mm',
      'Kedalaman pemakanan total pahat bubut ulir',
    ],
    [
      'd2 = D2',
      'Diameter Pitch / Efektif',
      'd2 = d - 0.5 × P',
      '=C2-0.5*D2',
      'mm',
      'Diameter silinder imajiner tempat tebal gigi = lebar alur',
    ],
    [
      'd3',
      'Diameter Inti Baut (Root Diameter)',
      'd3 = d - 2 × h3 = d - P - 2 × ac',
      '=C2-2*L2',
      'mm',
      'Diameter terkecil dasar ulir luar (baut)',
    ],
    [
      'D1',
      'Diameter Dalam Mur (Diameter Bor)',
      'D1 = d - 2 × H1 = d - P',
      '=C2-2*K2',
      'mm',
      'Diameter lubang bor awal sebelum pembuatan ulir dalam (mur)',
    ],
    [
      'D4',
      'Diameter Luar Mur (Major Internal)',
      'D4 = d + 2 × ac',
      '=C2+2*M2',
      'mm',
      'Diameter terdalam alur pada mur',
    ],
    [
      'f',
      'Lebar Puncak Ulir (Crest Width)',
      'f = 0.366 × P',
      '=0.366025*D2',
      'mm',
      'Lebar rata puncak gigi ulir',
    ],
    [
      'w',
      'Lebar Dasar Alur / Ujung Pahat',
      'w = 0.366 × P - 0.536 × ac',
      '=0.366025*D2-0.535898*M2',
      'mm',
      'Lebar ujung pahat bubut ulir trapesium 30°',
    ],
    [
      'Ac',
      'Luas Penampang Geser Inti Ulir',
      'Ac = (π / 4) × d3²',
      '=(PI()/4)*(H2^2)',
      'mm²',
      'Luas penampang inti baut berdasarkan diameter akar d3',
    ],
    [
      'Fmaks (C45)',
      'Beban Statis Aksial Maksimum Baja C45',
      'Fmaks_C45 = Ac × τ_izin_C45 (τ_izin = 65 MPa)',
      '=ROUND((S2*65)/1000, 2)',
      'kN',
      'Kapasitas beban statis aksial maksimum untuk material Baja Karbon C45',
    ],
    [
      'Fmaks (Perunggu)',
      'Beban Statis Aksial Maksimum Perunggu CuSn12',
      'Fmaks_Bronze = Ac × τ_izin_Bronze (τ_izin = 30 MPa)',
      '=ROUND((S2*30)/1000, 2)',
      'kN',
      'Kapasitas beban statis aksial maksimum untuk material Perunggu CuSn12',
    ],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'Standar_ISO_DIN103'!A1`,
            values: standardMatrix,
          },
          {
            range: `'Lembar_Kerja_Proyek'!A1`,
            values: projectMatrix,
          },
          {
            range: `'Rumus_Referensi_TR'!A1`,
            values: formulaRefMatrix,
          },
        ],
      }),
    }
  );

  return getSpreadsheetMetadata(accessToken, spreadsheetId);
}

/**
 * Overwrite/update a specific sheet tab in an existing Google Spreadsheet.
 * IMPORTANT: Must only be called AFTER explicit user confirmation in the UI!
 */
export async function updateSheetTabWithRows(
  accessToken: string,
  spreadsheetIdInput: string,
  sheetTitle: string,
  rows: TrCalculatedRow[],
  useLiveFormulas: boolean,
  includeProjectCols: boolean
): Promise<{ updatedCells: number; updatedRows: number }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const matrix = buildSheetValuesMatrix(
    rows,
    useLiveFormulas,
    includeProjectCols
  );
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A1`;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const putRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: matrix,
      }),
    }
  );

  if (!putRes.ok) {
    const errBody = await putRes.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        `Gagal memperbarui sheet "${sheetTitle}" (HTTP ${putRes.status}).`
    );
  }

  const result = await putRes.json();
  return {
    updatedCells:
      result.updatedCells ?? matrix.length * (matrix[0]?.length || 1),
    updatedRows: result.updatedRows ?? matrix.length,
  };
}

/**
 * Read rows from a selected tab of an existing Google Spreadsheet and parse them into TrCalculatedRow[]
 */
export async function readRowsFromSheetTab(
  accessToken: string,
  spreadsheetIdInput: string,
  sheetTitle: string
): Promise<TrCalculatedRow[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A1:AC3000`;

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        `Gagal membaca data dari tab "${sheetTitle}" (HTTP ${res.status}).`
    );
  }

  const data = await res.json();
  const values: any[][] = data.values || [];
  if (values.length <= 1) {
    return [];
  }

  const parsedRows: TrCalculatedRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.length < 4) continue;

    let d = Number(row[2]);
    let p = Number(row[3]);
    let series: ThreadSeries =
      Number(row[1]) === 2 ? 2 : Number(row[1]) === 3 ? 3 : 1;
    let starts = Number(row[4]) || 1;

    if (isNaN(d) || isNaN(p) || d <= 0 || p <= 0) {
      const desig = String(row[0] || '');
      const m = desig.match(/Tr\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
      if (m) {
        d = Number(m[1]);
        p = Number(m[2]);
      }
    }

    if (!isNaN(d) && !isNaN(p) && d >= 4 && p >= 0.5) {
      const materialText = row[23] ? String(row[23]) : 'Baja Karbon C45 / S45C';
      const materialGrade = inferMaterialGrade(materialText);
      const lengthMm = Number(row[27]) || 500;
      const notes = row[28]
        ? String(row[28])
        : `Diimpor dari Google Sheet (${sheetTitle})`;

      parsedRows.push(
        calculateTrThread(d, p, series, starts, '7e', '7H', {
          id: `sheet-import-${i}-${Date.now()}`,
          materialGrade,
          material: materialText,
          lengthMm,
          notes,
        })
      );
    }
  }

  return parsedRows;
}
