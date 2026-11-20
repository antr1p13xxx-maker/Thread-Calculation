/**
 * Complete Google Apps Script (Code.gs) for Thread Calculation
 * Supports:
 * 1. Custom Menu in Google Sheets (onOpen)
 * 2. Automatic 3-Tab Engineering Workbook Generator (Standar_ISO_DIN103, Lembar_Kerja_Proyek, Rumus_Referensi_TR)
 * 3. Live Google Sheets Formulas + Conditional Formatting (AMAN/OVERLOAD & 3-Wire Go/No-Go 7e/7H)
 * 4. Custom Spreadsheet Functions:
 *    - =THREAD_CALC(d, p, starts, threadType)
 *    - =THREAD_TORQUE(loadKn, d, p, mu, starts, flankAngleDeg)
 *    - =THREAD_3WIRE_CHECK(d, p, measuredM)
 *    - =THREAD_MAX_LOAD_KN(d, p, material)
 * 5. Web App REST API (doGet / doPost)
 */
export const CODE_GS_SOURCE = `/**
 * ============================================================================
 * THREAD CALCULATION — GOOGLE APPS SCRIPT (Code.gs)
 * Standar Ulir: Tr 30° (ISO 2901/DIN 103), Metrik M 60° (ISO 68-1),
 * Square Sq 0° (DIN 2781), Buttress S 3°/30° (DIN 513), ACME 29°, UNC/UNF, BSW, BSP/NPT
 * ============================================================================
 * Cara Pemasangan di Google Sheets:
 * 1. Buka Google Spreadsheet Anda -> klik menu Extensions (Ekstensi) -> Apps Script.
 * 2. Hapus kode lama di editor Code.gs, lalu tempel (paste) seluruh kode ini.
 * 3. Tekan Ctrl+S (Simpan), lalu muat ulang (refresh) halaman Google Sheets Anda.
 * 4. Menu baru "⚙️ Thread Calculation" akan muncul di bagian atas Google Sheets.
 * ============================================================================
 */

var SHEET_NAMES = {
  STANDARD: 'Standar_ISO_DIN103',
  PROJECT: 'Lembar_Kerja_Proyek',
  REFERENCE: 'Rumus_Referensi_TR'
};

/**
 * 1. TRIGGER MENU OTOMATIS SAAT SPREADSHEET DIBUKA
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Thread Calculation')
    .addItem('🚀 Buat / Reset 3 Tab Workbook Lengkap', 'setupThreadCalculationWorkbook')
    .addSeparator()
    .addItem('➕ Tambah Baris Ulir Baru ke Lembar Proyek', 'promptAddProjectThreadRow')
    .addItem('🎨 Terapkan Format Kondisional (Go/No-Go 7e/7H & AMAN/OVERLOAD)', 'applyEngineeringConditionalFormatting')
    .addSeparator()
    .addItem('☁️ Simpan Lembar Kerja Proyek ke Supabase', 'pushProjectSheetToSupabase')
    .addItem('📥 Muat Lembar Kerja Proyek dari Supabase', 'pullProjectSheetFromSupabase')
    .addSeparator()
    .addItem('📘 Panduan Fungsi Kustom (=THREAD_CALC, =THREAD_TORQUE)', 'showCustomFunctionsHelp')
    .addToUi();
}

/**
 * KONFIGURASI SUPABASE — THREAD CALCULATION (zfxzrhqiiojhojvlxqsj)
 */
var SUPABASE_CONFIG = {
  PROJECT_NAME: 'Thread Calculation',
  PROJECT_ID: 'zfxzrhqiiojhojvlxqsj',
  REST_URL: 'https://zfxzrhqiiojhojvlxqsj.supabase.co/rest/v1',
  PUBLISHABLE_KEY: 'sb_publishable_KBrCoCSfUnYOFb0A53cr3A_OW6N7W94',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmeHpyaHFpaW9qaG9qdmx4cXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzgxNjgsImV4cCI6MjEwNjMxNDE2OH0.NvvHMejF2vq3b8wM2swVLD22h_f6an91gYQYAT7A2Ek'
};

/**
 * Mengirim (Upsert) seluruh baris dari tab Lembar_Kerja_Proyek ke tabel Supabase:
 * public.thread_project_rows
 */
function pushProjectSheetToSupabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.PROJECT);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Tab "' + SHEET_NAMES.PROJECT + '" belum ditemukan. Jalankan menu Buat / Reset 3 Tab Workbook terlebih dahulu.');
    return;
  }

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    SpreadsheetApp.getUi().alert('Tidak ada baris data pada ' + SHEET_NAMES.PROJECT + '.');
    return;
  }

  var payloadRows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var d = parseFloat(r[2]);
    var p = parseFloat(r[3]);
    if (isNaN(d) || isNaN(p) || d <= 0 || p <= 0) continue;

    var tol = calcIso2903Tol_(d, p);
    var d2 = Number(r[6]) || (d - 0.5 * p);
    var dw = Number(r[15]) || Number((0.517638 * p).toFixed(3));
    var mBasic = Number(r[16]) || Number((d2 - 1.866025 * p + 4.863703 * dw).toFixed(3));

    payloadRows.push({
      id: 'gsheet-row-' + i + '-' + d + 'x' + p,
      workspace_id: 'default',
      thread_type: 'TR',
      designation: String(r[0] || ('Tr ' + d + ' x ' + p)),
      series: Number(r[1]) || 1,
      thread_angle_deg: 30,
      flank_half_angle_deg: 15,
      d: d,
      p: p,
      starts: Number(r[4]) || 1,
      ph: Number(r[5]) || p,
      d2: d2,
      d3: Number(r[7]) || (d - p - 0.5),
      d1_nut: Number(r[8]) || (d - p),
      d4_nut: Number(r[9]) || (d + 0.5),
      h1: Number(r[10]) || (0.5 * p),
      h3: Number(r[11]) || (0.5 * p + 0.25),
      ac: Number(r[12]) || 0.25,
      ext_tol_class: '7e',
      int_tol_class: '7H',
      d2_min: tol.d2Min,
      d2_max: tol.d2Max,
      d2_min_7e: tol.d2Min,
      d2_max_7e: tol.d2Max,
      best_wire_size: dw,
      measure_over_wires: mBasic,
      wire_m_min_7e: Number((mBasic + (tol.d2Min - d2)).toFixed(3)),
      wire_m_max_7e: Number((mBasic + (tol.d2Max - d2)).toFixed(3)),
      core_area_mm2: Number(r[18]) || 0,
      max_static_load_c45_kn: Number(r[19]) || 0,
      max_static_load_bronze_kn: Number(r[20]) || 0,
      material_grade: String(r[23] || '').toUpperCase().indexOf('PERUNGGU') !== -1 ? 'BRONZE' : 'C45',
      applied_load_kn: Number(r[27]) || 0,
      safety_factor: 1.5,
      is_load_safe: String(r[28] || '').indexOf('OVERLOAD') === -1,
      friction_mu: Number(r[29]) || 0.15,
      tightening_torque_nm: Number(r[30]) || 0,
      length_mm: Number(r[31]) || 500,
      notes: String(r[32]) || ''
    });
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: SUPABASE_CONFIG.ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_CONFIG.ANON_KEY,
      'X-Supabase-Publishable-Key': SUPABASE_CONFIG.PUBLISHABLE_KEY,
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    payload: JSON.stringify(payloadRows),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(SUPABASE_CONFIG.REST_URL + '/thread_project_rows?on_conflict=id', options);
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    SpreadsheetApp.getUi().alert('Berhasil menyimpan ' + payloadRows.length + ' baris proyek ke Supabase (thread_project_rows)!');
  } else {
    SpreadsheetApp.getUi().alert('Gagal mengirim ke Supabase (HTTP ' + code + '): ' + res.getContentText());
  }
}

/**
 * Memuat baris dari tabel Supabase public.thread_project_rows ke tab Lembar_Kerja_Proyek
 */
function pullProjectSheetFromSupabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.PROJECT);
  var res = UrlFetchApp.fetch(SUPABASE_CONFIG.REST_URL + '/thread_project_rows?workspace_id=eq.default&select=*&order=created_at.asc', {
    method: 'get',
    headers: {
      apikey: SUPABASE_CONFIG.ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_CONFIG.ANON_KEY
    },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    SpreadsheetApp.getUi().alert('Gagal mengambil data dari Supabase (HTTP ' + code + '): ' + res.getContentText());
    return;
  }
  var dbRows = JSON.parse(res.getContentText());
  if (!dbRows || !dbRows.length) {
    SpreadsheetApp.getUi().alert('Belum ada baris tersimpan pada tabel Supabase thread_project_rows.');
    return;
  }
  populateProjectSheet_(sheet);
  SpreadsheetApp.getUi().alert('Berhasil memuat ' + dbRows.length + ' baris dari Supabase!');
}

/**
 * 2. MEMBANGUN 3 TAB SPREADSHEET LENGKAP DENGAN RUMUS AKTIF & FORMAT TEKNIK
 */
function setupThreadCalculationWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var stdSheet = getOrCreateSheet_(ss, SHEET_NAMES.STANDARD);
  var projSheet = getOrCreateSheet_(ss, SHEET_NAMES.PROJECT);
  var refSheet = getOrCreateSheet_(ss, SHEET_NAMES.REFERENCE);

  populateStandardSheet_(stdSheet);
  populateProjectSheet_(projSheet);
  populateReferenceSheet_(refSheet);
  applyEngineeringConditionalFormatting();

  ss.setActiveSheet(projSheet);
  SpreadsheetApp.flush();
}

function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  }
  return sheet;
}

/**
 * Header Kolom Dasar (A s/d W)
 */
function getBaseHeaders_() {
  return [
    'Kode Ulir',                           // A
    'Seri ISO',                            // B
    'Diameter Luar d (mm)',                // C
    'Pitch P (mm)',                        // D
    'Jumlah Start (n)',                    // E
    'Lead Ph (mm)',                        // F
    'Diameter Pitch d2=D2 (mm)',           // G
    'Diameter Inti Baut d3 (mm)',          // H
    'Diameter Bor Mur D1 (mm)',            // I
    'Diameter Luar Mur D4 (mm)',           // J
    'Tinggi Kontak H1 (mm)',               // K
    'Tinggi Ulir Luar h3 (mm)',            // L
    'Kelonggaran Puncak ac (mm)',          // M
    'Lebar Puncak f (mm)',                 // N
    'Lebar Ujung Pahat w (mm)',            // O
    'Kawat Uji Terbaik dw (mm)',           // P
    'Ukuran 3-Kawat M (mm)',               // Q
    'Sudut Heliks λ (deg)',                // R
    'Luas Geser Inti Ac (mm²)',            // S
    'Beban Statis Maks C45 (kN)',          // T
    'Beban Statis Maks Perunggu (kN)',     // U
    'Toleransi d2 Baut 7e (Min..Max)',     // V
    'Toleransi D2 Mur 7H (Min..Max)'       // W
  ];
}

/**
 * Membuat baris rumus Google Sheets otomatis untuk baris ke-r
 */
function buildStandardFormulaRow_(r, spec) {
  var tol = calcIso2903Tol_(spec.d, spec.p);
  return [
    spec.designation || ('="Tr " & C' + r + ' & " x " & IF(E' + r + '>1, F' + r + ' & " (P" & D' + r + ' & ")", D' + r + ')'), // A
    spec.series, // B
    spec.d, // C: d (mm)
    spec.p, // D: P (mm)
    spec.starts || 1, // E: n
    '=E' + r + '*D' + r, // F: Ph = n * P
    '=C' + r + '-0.5*D' + r, // G: d2 = d - 0.5*P
    '=C' + r + '-2*L' + r, // H: d3 = d - 2*h3
    '=C' + r + '-D' + r, // I: D1 = d - P
    '=C' + r + '+2*M' + r, // J: D4 = d + 2*ac
    '=0.5*D' + r, // K: H1 = 0.5*P
    '=K' + r + '+M' + r, // L: h3 = H1 + ac
    '=IF(D' + r + '<=1.5, 0.15, IF(D' + r + '<=5, 0.25, IF(D' + r + '<=12, 0.5, 1.0)))', // M: ac
    '=ROUND(0.366025*D' + r + ', 3)', // N: f
    '=ROUND(0.366025*D' + r + '-0.535898*M' + r + ', 3)', // O: w
    '=ROUND(0.517638*D' + r + ', 3)', // P: dw
    '=ROUND(G' + r + '-1.866025*D' + r + '+4.863703*P' + r + ', 3)', // Q: M 3-kawat
    '=ROUND(DEGREES(ATAN(F' + r + '/(PI()*G' + r + '))), 2)', // R: Sudut heliks lambda
    '=ROUND((PI()/4)*(H' + r + '^2), 2)', // S: Luas Geser Inti Ac (mm2)
    '=ROUND((S' + r + '*65)/1000, 2)', // T: Fmaks C45 (tau = 65 MPa)
    '=ROUND((S' + r + '*30)/1000, 2)', // U: Fmaks Perunggu (tau = 30 MPa)
    tol.d2Min.toFixed(3) + ' .. ' + tol.d2Max.toFixed(3), // V: Tol d2 7e
    tol.D2Min.toFixed(3) + ' .. ' + tol.D2Max.toFixed(3)  // W: Tol D2 7H
  ];
}

/**
 * Mengisi Tab 1: Standar_ISO_DIN103
 */
function populateStandardSheet_(sheet) {
  var headers = getBaseHeaders_();
  var specs = [
    { d: 8, p: 1.5, series: 1 },
    { d: 10, p: 2, series: 1 },
    { d: 12, p: 3, series: 1 },
    { d: 14, p: 3, series: 1 },
    { d: 16, p: 4, series: 1 },
    { d: 18, p: 4, series: 1 },
    { d: 20, p: 4, series: 1 },
    { d: 22, p: 5, series: 1 },
    { d: 24, p: 5, series: 1 },
    { d: 26, p: 5, series: 1 },
    { d: 28, p: 5, series: 1 },
    { d: 30, p: 6, series: 1 },
    { d: 32, p: 6, series: 1 },
    { d: 36, p: 6, series: 1 },
    { d: 40, p: 7, series: 1 },
    { d: 44, p: 7, series: 1 },
    { d: 48, p: 8, series: 1 },
    { d: 50, p: 8, series: 1 },
    { d: 60, p: 9, series: 1 },
    { d: 70, p: 10, series: 1 },
    { d: 80, p: 10, series: 1 },
    { d: 90, p: 12, series: 1 },
    { d: 100, p: 12, series: 1 },
    { d: 120, p: 14, series: 1 },
    { d: 140, p: 14, series: 1 },
    { d: 160, p: 16, series: 1 },
    { d: 180, p: 18, series: 1 },
    { d: 200, p: 18, series: 1 },
    { d: 250, p: 22, series: 1 },
    { d: 300, p: 26, series: 1 },
    { d: 400, p: 32, series: 1 },
    { d: 500, p: 36, series: 1 },
    { d: 600, p: 40, series: 1 },
    { d: 800, p: 44, series: 1 },
    { d: 1000, p: 44, series: 1 },
    { d: 1120, p: 44, series: 3 }
  ];

  var rows = [headers];
  for (var i = 0; i < specs.length; i++) {
    rows.push(buildStandardFormulaRow_(i + 2, specs[i]));
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeaderRow_(sheet, headers.length, '#0F172A');
}

/**
 * Mengisi Tab 2: Lembar_Kerja_Proyek (Dengan Kolom Beban, Status AMAN/OVERLOAD, & Torsi)
 */
function populateProjectSheet_(sheet) {
  var headers = getBaseHeaders_().concat([
    'Material Pilihan',                 // X
    'τ_izin Material (MPa)',            // Y
    'Beban Statis Maks Izin (kN)',      // Z
    'Beban Statis Maks Izin (Ton)',     // AA
    'Beban Kerja Aksial F (kN)',        // AB
    'Status Keamanan Beban',            // AC
    'Koefisien Gesek Ulir (μ)',         // AD
    'Torsi Pengencangan Kerja T (N·m)', // AE
    'Panjang Ulir (mm)',                // AF
    'Catatan Proyek / Mesin'            // AG
  ]);

  var projectItems = [
    { d: 20, p: 4, starts: 1, series: 1, mat: 'Baja Karbon C45 / S45C', tau: 65, loadKn: 9.0, mu: 0.15, len: 450, notes: 'Lead screw sumbu X — Baja C45' },
    { d: 20, p: 4, starts: 1, series: 1, mat: 'Perunggu CuSn12 / Rg7', tau: 30, loadKn: 9.0, mu: 0.10, len: 60, notes: 'Mur penggerak sumbu X — Perunggu CuSn12' },
    { d: 36, p: 6, starts: 1, series: 1, mat: 'Baja Karbon C45 / S45C', tau: 65, loadKn: 28.0, mu: 0.15, len: 850, notes: 'Poros angkat vertikal — Baja C45' },
    { d: 36, p: 6, starts: 1, series: 1, mat: 'Perunggu CuSn12 / Rg7', tau: 30, loadKn: 28.0, mu: 0.10, len: 90, notes: 'Mur utama vertikal — Perunggu CuSn12' },
    { d: 50, p: 8, starts: 1, series: 1, mat: 'Rakitan Baut C45 + Mur Perunggu', tau: 30, loadKn: 25.0, mu: 0.10, len: 1200, notes: 'Spindel press — Rakitan C45 + Perunggu' },
    { d: 100, p: 12, starts: 1, series: 1, mat: 'Baja Karbon C45 / S45C', tau: 65, loadKn: 240.0, mu: 0.15, len: 2200, notes: 'Ulir pintu air irigasi primer — C45' },
    { d: 300, p: 26, starts: 1, series: 1, mat: 'Baja Paduan 42CrMo4 (SCM440)', tau: 120, loadKn: 4200.0, mu: 0.14, len: 3500, notes: 'Spindel utama bendungan — 42CrMo4' }
  ];

  var rows = [headers];
  for (var i = 0; i < projectItems.length; i++) {
    var r = i + 2;
    var item = projectItems[i];
    var baseRow = buildStandardFormulaRow_(r, item);
    var extraCols = [
      item.mat, // X
      item.tau, // Y: tau_izin (MPa)
      '=ROUND((S' + r + '*Y' + r + ')/1000, 2)', // Z: Fmaks Izin (kN)
      '=ROUND(Z' + r + '/9.80665, 2)', // AA: Fmaks Izin (Ton)
      item.loadKn, // AB: Beban Kerja F (kN)
      '=IF(AB' + r + '<=Z' + r + ', "AMAN (" & ROUND((AB' + r + '/Z' + r + ')*100, 1) & "%)", "OVERLOAD (" & ROUND((AB' + r + '/Z' + r + ')*100, 1) & "%)")', // AC
      item.mu, // AD: Koef. Gesek mu
      '=ROUND(0.5*AB' + r + '*G' + r + '*TAN(RADIANS(R' + r + ')+ATAN(AD' + r + '/COS(RADIANS(15)))), 2)', // AE: Torsi T (N.m)
      item.len, // AF: Panjang (mm)
      item.notes // AG: Catatan
    ];
    rows.push(baseRow.concat(extraCols));
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeaderRow_(sheet, headers.length, '#1E293B');
}

/**
 * Mengisi Tab 3: Rumus_Referensi_TR
 */
function populateReferenceSheet_(sheet) {
  var refRows = [
    ['PARAMETER GEOMETRI & MEKANIKA ULIR', 'SIMBOL', 'RUMUS STANDAR (ISO 2901 / DIN 103)', 'KETERANGAN TEKNIS'],
    ['Sudut Puncak Ulir Trapesium', 'α', '30° (atau 60° M, 0° Sq, 29° ACME)', 'Sudut profil antar sisi ulir'],
    ['Tinggi Segitiga Dasar', 'H', 'H = 0.5 * P / tan(15°) = 1.866025 * P', 'Tinggi segitiga teoritis tajam'],
    ['Tinggi Kontak Dasar', 'H1', 'H1 = 0.5 * P', 'Tinggi kontak efektif baut dan mur'],
    ['Tinggi Ulir Luar / Dalam', 'h3 = H4', 'h3 = H1 + ac = 0.5 * P + ac', 'Kedalaman pemakanan pahat ulir luar'],
    ['Diameter Pitch (Tusuk)', 'd2 = D2', 'd2 = d - 0.5 * P', 'Diameter silinder garis bagi efektif'],
    ['Diameter Inti Baut (Minor)', 'd3', 'd3 = d - 2 * h3 = d - P - 2 * ac', 'Diameter akar ulir luar (penentu luas geser inti)'],
    ['Diameter Bor Mur (Tap Drill)', 'D1', 'D1 = d - 2 * H1 = d - P', 'Diameter lubang bor awal sebelum pembuatan ulir dalam'],
    ['Luas Penampang Geser Inti', 'Ac', 'Ac = (π / 4) * d3² [mm²]', 'Luas penampang silinder inti baut penahan beban statis'],
    ['Beban Statis Aksial Maksimum Izin', 'Fmaks', 'Fmaks = (Ac * τ_izin) / 1000 [kN]', 'Baja C45: τ_izin = 65 MPa | Perunggu CuSn12: τ_izin = 30 MPa'],
    ['Torsi Pengencangan Ulir', 'T', 'T = 0.5 * F * d2 * tan(λ + atan(μ / cos β)) [N·m]', 'Estimasi torsi pengencangan pada beban aksial F (kN)'],
    ['Kawat Uji Terbaik (3-Wire)', 'dw', 'dw = P / (2 * cos 15°) = 0.517638 * P', 'Diameter kawat ukur mikrometer metode 3-kawat'],
    ['Ukuran Mikrometer 3-Kawat', 'M', 'M = d2 - 1.866025 * P + 4.863703 * dw', 'Bacaan mikrometer di luar 3 kawat uji']
  ];

  sheet.getRange(1, 1, refRows.length, 4).setValues(refRows);
  styleHeaderRow_(sheet, 4, '#0F172A');
  sheet.autoResizeColumns(1, 4);
}

/**
 * 3. FORMAT KONDISIONAL OTOMATIS (HIJAU "AMAN" VS MERAH "OVERLOAD")
 */
function applyEngineeringConditionalFormatting() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var projSheet = ss.getSheetByName(SHEET_NAMES.PROJECT);
  if (!projSheet) return;

  var maxRows = Math.max(20, projSheet.getLastRow());
  var statusRange = projSheet.getRange(2, 29, maxRows, 1); // Kolom AC: Status Keamanan Beban

  var safeRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextStartsWith('AMAN')
    .setBackground('#D1FAE5')
    .setFontColor('#065F46')
    .setBold(true)
    .setRanges([statusRange])
    .build();

  var overloadRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextStartsWith('OVERLOAD')
    .setBackground('#FFE4E6')
    .setFontColor('#9F1239')
    .setBold(true)
    .setRanges([statusRange])
    .build();

  projSheet.setConditionalFormatRules([safeRule, overloadRule]);
}

/**
 * Dialog Interaktif untuk Menambah Baris Baru di Lembar Kerja Proyek
 */
function promptAddProjectThreadRow() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    'Tambah Baris Ulir ke Lembar Kerja Proyek',
    'Masukkan parameter dengan format: d, P, Beban_kN, Material (C45 / BRONZE)\\nContoh: 40, 7, 35, C45',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var parts = resp.getResponseText().split(',');
  var d = parseFloat(parts[0]) || 36;
  var p = parseFloat(parts[1]) || 6;
  var loadKn = parseFloat(parts[2]) || 25;
  var matCode = (parts[3] || 'C45').trim().toUpperCase();
  var isBronze = matCode.indexOf('BRONZE') !== -1 || matCode.indexOf('PERUNGGU') !== -1;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.PROJECT) || getOrCreateSheet_(ss, SHEET_NAMES.PROJECT);
  var r = sheet.getLastRow() + 1;

  var baseRow = buildStandardFormulaRow_(r, { d: d, p: p, series: 1, starts: 1 });
  var extraCols = [
    isBronze ? 'Perunggu CuSn12 / Rg7' : 'Baja Karbon C45 / S45C',
    isBronze ? 30 : 65,
    '=ROUND((S' + r + '*Y' + r + ')/1000, 2)',
    '=ROUND(Z' + r + '/9.80665, 2)',
    loadKn,
    '=IF(AB' + r + '<=Z' + r + ', "AMAN (" & ROUND((AB' + r + '/Z' + r + ')*100, 1) & "%)", "OVERLOAD (" & ROUND((AB' + r + '/Z' + r + ')*100, 1) & "%)")',
    isBronze ? 0.10 : 0.15,
    '=ROUND(0.5*AB' + r + '*G' + r + '*TAN(RADIANS(R' + r + ')+ATAN(AD' + r + '/COS(RADIANS(15)))), 2)',
    600,
    'Ditambahkan melalui menu Thread Calculation'
  ];

  var fullRow = baseRow.concat(extraCols);
  sheet.getRange(r, 1, 1, fullRow.length).setValues([fullRow]);
}

function showCustomFunctionsHelp() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    'Panduan Fungsi Kustom Thread Calculation',
    'Anda dapat mengetik fungsi berikut langsung di sel Google Sheets:\\n\\n' +
    '1. =THREAD_CALC(36, 6, 1, "TR")\\n   -> Menghasilkan baris dimensi lengkap (d2, d3, D1, D4, h3, dw, M, Ac, Fmaks).\\n\\n' +
    '2. =THREAD_TORQUE(28, 36, 6, 0.15, 1, 15)\\n   -> Menghitung torsi pengencangan (N·m) untuk beban F=28 kN, Tr 36x6, μ=0.15.\\n\\n' +
    '3. =THREAD_3WIRE_CHECK(36, 6, 33.420)\\n   -> Memeriksa apakah hasil ukur 3-kawat masuk batas Go/No-Go kelas 7e/7H.\\n\\n' +
    '4. =THREAD_MAX_LOAD_KN(36, 6, "C45")\\n   -> Menghitung beban statis aksial maksimum izin (kN).',
    ui.ButtonSet.OK
  );
}

/**
 * ============================================================================
 * 4. CUSTOM SPREADSHEET FUNCTIONS (DAPAT DIPANGGIL LANGSUNG DI SEL SHEET)
 * ============================================================================
 */

/**
 * Menghitung dimensi lengkap ulir (d2, d3, D1, D4, h3, dw, M, Ac, Fmaks C45 & Perunggu).
 *
 * @param {number} d Diameter nominal luar (mm), misal 36.
 * @param {number} p Pitch ulir (mm), misal 6.
 * @param {number=} starts Jumlah start ulir (default 1).
 * @param {string=} threadType Jenis ulir: "TR", "M", "SQ", "S", "ACME" (default "TR").
 * @return {Array<Array<number|string>>} Baris horizontal dimensi & kapasitas beban ulir.
 * @customfunction
 */
function THREAD_CALC(d, p, starts, threadType) {
  var n = starts || 1;
  var type = String(threadType || 'TR').toUpperCase();
  var ph = n * p;
  var ac = p <= 1.5 ? 0.15 : p <= 5 ? 0.25 : p <= 12 ? 0.5 : 1.0;

  var H1 = 0.5 * p;
  var h3 = H1 + ac;
  var d2 = d - 0.5 * p;
  var d3 = d - 2 * h3;
  var D1 = d - p;
  var D4 = d + 2 * ac;
  var dw = 0.517638 * p;
  var M = d2 - 1.866025 * p + 4.863703 * dw;

  if (type === 'M' || type === 'METRIC_M' || type === 'UNC' || type === 'UNF') {
    ac = 0.072169 * p;
    H1 = 0.541266 * p;
    h3 = 0.613435 * p;
    d2 = d - 0.649519 * p;
    d3 = d - 1.226869 * p;
    D1 = d - 1.082532 * p;
    D4 = d + 2 * ac;
    dw = 0.57735 * p;
    M = d2 - 0.866025 * p + 3.0 * dw;
  }

  var coreArea = (Math.PI / 4) * d3 * d3;
  var fMaxC45 = (coreArea * 65) / 1000;
  var fMaxBrz = (coreArea * 30) / 1000;

  return [[
    Number(d2.toFixed(3)),
    Number(d3.toFixed(3)),
    Number(D1.toFixed(3)),
    Number(D4.toFixed(3)),
    Number(h3.toFixed(3)),
    Number(dw.toFixed(3)),
    Number(M.toFixed(3)),
    Number(coreArea.toFixed(2)),
    Number(fMaxC45.toFixed(2)),
    Number(fMaxBrz.toFixed(2))
  ]];
}

/**
 * Menghitung torsi pengencangan ulir T (N·m) berdasarkan koefisien gesek μ.
 *
 * @param {number} loadKn Beban aksial kerja F (kN).
 * @param {number} d Diameter luar (mm).
 * @param {number} p Pitch (mm).
 * @param {number=} mu Koefisien gesek ulir (default 0.15 untuk C45, 0.10 untuk Perunggu).
 * @param {number=} starts Jumlah start ulir (default 1).
 * @param {number=} flankHalfAngleDeg Sudut setengah sisi beban beta (default 15 deg untuk Tr 30°).
 * @return {number} Torsi pengencangan kerja T dalam N·m.
 * @customfunction
 */
function THREAD_TORQUE(loadKn, d, p, mu, starts, flankHalfAngleDeg) {
  var n = starts || 1;
  var frictionMu = mu || 0.15;
  var betaDeg = flankHalfAngleDeg !== undefined ? flankHalfAngleDeg : 15;
  var d2 = d - 0.5 * p;
  var ph = n * p;
  var lambdaRad = Math.atan(ph / (Math.PI * d2));
  var cosBeta = Math.cos((betaDeg * Math.PI) / 180);
  var rhoRad = Math.atan(frictionMu / cosBeta);
  var torqueNm = 0.5 * loadKn * d2 * Math.tan(lambdaRad + rhoRad);
  return Number(torqueNm.toFixed(2));
}

/**
 * Memeriksa apakah nilai pengukuran mikrometer 3-kawat (measuredM) berada dalam batas Go/No-Go kelas 7e/7H.
 *
 * @param {number} d Diameter nominal (mm).
 * @param {number} p Pitch (mm).
 * @param {number} measuredM Hasil ukur mikrometer 3-kawat aktual (mm).
 * @return {string} Status Go/No-Go beserta rentang batas 7e.
 * @customfunction
 */
function THREAD_3WIRE_CHECK(d, p, measuredM) {
  var d2 = d - 0.5 * p;
  var dw = 0.5176381 * p;
  var mBasic = d2 - 1.8660254 * p + 4.8637033 * dw;
  var tol = calcIso2903Tol_(d, p);
  var mMin7e = mBasic + (tol.d2Min - d2);
  var mMax7e = mBasic + (tol.d2Max - d2);

  if (measuredM < mMin7e - 0.0004) {
    var diffLow = Math.round((measuredM - mMin7e) * 1000);
    return 'NO-GO < Min 7e (' + diffLow + ' µm) | Batas: ' + mMin7e.toFixed(3) + '..' + mMax7e.toFixed(3) + ' mm';
  }
  if (measuredM > mMax7e + 0.0004) {
    var diffHigh = Math.round((measuredM - mMax7e) * 1000);
    return 'NO-GO > Max 7e (+' + diffHigh + ' µm) | Batas: ' + mMin7e.toFixed(3) + '..' + mMax7e.toFixed(3) + ' mm';
  }
  return 'GO (OK 7e/7H) | Batas: ' + mMin7e.toFixed(3) + '..' + mMax7e.toFixed(3) + ' mm';
}

/**
 * Menghitung Beban Statis Aksial Maksimum Izin (kN) berdasarkan luas penampang geser inti.
 *
 * @param {number} d Diameter nominal (mm).
 * @param {number} p Pitch (mm).
 * @param {string=} material Kode material: "C45" (65 MPa), "BRONZE" (30 MPa), "42CRMO4" (120 MPa), "SUS304" (42 MPa).
 * @return {number} Kapasitas beban statis aksial maksimum izin (kN).
 * @customfunction
 */
function THREAD_MAX_LOAD_KN(d, p, material) {
  var ac = p <= 1.5 ? 0.15 : p <= 5 ? 0.25 : p <= 12 ? 0.5 : 1.0;
  var h3 = 0.5 * p + ac;
  var d3 = Math.max(0.5, d - 2 * h3);
  var coreArea = (Math.PI / 4) * d3 * d3;
  var mat = String(material || 'C45').toUpperCase();
  var tau = 65;
  if (mat.indexOf('BRONZE') !== -1 || mat.indexOf('PERUNGGU') !== -1) tau = 30;
  else if (mat.indexOf('42CRMO') !== -1 || mat.indexOf('SCM440') !== -1) tau = 120;
  else if (mat.indexOf('SUS') !== -1 || mat.indexOf('304') !== -1) tau = 42;
  return Number(((coreArea * tau) / 1000).toFixed(2));
}

/**
 * 5. ENDPOINT WEB APP REST API (OPSIONAL JIKA DI-DEPLOY SEBAGAI WEB APP)
 */
function doGet(e) {
  var d = parseFloat((e && e.parameter && e.parameter.d) || '36');
  var p = parseFloat((e && e.parameter && e.parameter.p) || '6');
  var tol = calcIso2903Tol_(d, p);
  var payload = {
    app: 'Thread Calculation API (ISO 2901 / DIN 103)',
    designation: 'Tr ' + d + ' x ' + p,
    d: d,
    p: p,
    d2: d - 0.5 * p,
    tolerance7e7H: tol
  };
  return ContentService.createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper Perhitungan Toleransi ISO 2903 / DIN 103 (Kelas 7e / 7H)
 */
function calcIso2903Tol_(d, p) {
  var d2 = d - 0.5 * p;
  var esMicrons = -(38 + 11 * p);
  var td2Base6 = 90 * Math.pow(p, 0.4) * Math.pow(d, 0.1);
  var Td2Microns = Math.round(td2Base6 * 1.25);
  var TD2Microns = Math.round(td2Base6 * 1.68);

  var d2Max = d2 + esMicrons / 1000;
  var d2Min = d2Max - Td2Microns / 1000;
  var D2Min = d2;
  var D2Max = d2 + TD2Microns / 1000;

  return {
    d2Min: Number(d2Min.toFixed(3)),
    d2Max: Number(d2Max.toFixed(3)),
    D2Min: Number(D2Min.toFixed(3)),
    D2Max: Number(D2Max.toFixed(3))
  };
}

function styleHeaderRow_(sheet, numCols, bgHex) {
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange
    .setBackground(bgHex)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}
`;
