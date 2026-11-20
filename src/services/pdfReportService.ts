import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TrCalculatedRow,
  THREAD_MATERIAL_SPECS,
  ThreadMaterialGrade,
} from '../data/trThreadData';

export interface PdfReportOptions {
  projectName?: string;
  preparedBy?: string;
  companyOrWorkshop?: string;
  documentCode?: string;
}

/**
 * Generate and download a formatted A4 Landscape Engineering PDF Report
 * with UlirTR Studio Letterhead, Material Load Summary (C45 vs Bronze),
 * and full Project Worksheet table.
 */
export function exportProjectWorksheetToPdf(
  projectRows: TrCalculatedRow[],
  options?: PdfReportOptions
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const marginX = 14;

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const docCode =
    options?.documentCode?.trim() ||
    `UTR-ENG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(now.getDate()).padStart(2, '0')}`;
  const projectName =
    options?.projectName?.trim() ||
    'Spesifikasi Spindel & Mur Ulir Trapesium (ISO 2901 / DIN 103)';
  const preparedBy =
    options?.preparedBy?.trim() || 'Divisi Rekayasa Mekanik & Pemesinan';
  const workshopName =
    options?.companyOrWorkshop?.trim() ||
    'Thread Calculation — Precision Thread Engineering & Metrology';

  // =========================================================================
  // 1. KOP SURAT RESMI (LETTERHEAD) THREAD CALCULATION
  // =========================================================================
  // Top accent bar
  doc.setFillColor(15, 23, 42); // #0F172A slate-900
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFillColor(37, 99, 235); // #2563EB blue-600
  doc.rect(0, 0, 85, 4, 'F');

  // Vector Trapezoidal Thread Emblem Box on Left
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginX, 9, 16, 16, 2, 2, 'F');

  // Draw mini 30-deg trapezoidal profile inside logo box
  doc.setDrawColor(56, 189, 248); // sky-400
  doc.setLineWidth(0.6);
  doc.lines(
    [
      [2, 0],
      [1.5, -5],
      [3, 0],
      [1.5, 5],
      [2, 0],
      [1.5, -5],
      [2, 0],
    ],
    marginX + 1.2,
    20.5
  );
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TR 30°', marginX + 8, 14, { align: 'center' });

  // Brand & Letterhead Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('THREAD CALCULATION', marginX + 20, 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(workshopName, marginX + 20, 19.2);
  doc.text(
    'Standar Acuan: ISO 2901, ISO 2902, ISO 2903, ISO 2904 & DIN 103 (Sudut Profil Ulir Metrik Trapesium 30°)',
    marginX + 20,
    23.5
  );

  // Right-side Document Control Stamp Box
  const metaBoxWidth = 86;
  const metaBoxX = pageWidth - marginX - metaBoxWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(metaBoxX, 8.5, metaBoxWidth, 17, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`NO. DOKUMEN : ${docCode}`, metaBoxX + 3, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tanggal Cetak : ${dateStr}, ${timeStr}`, metaBoxX + 3, 17.5);
  doc.text(`Total Item Ulir : ${projectRows.length} Spesifikasi Proyek`, metaBoxX + 3, 21.8);

  // Double horizontal rule under letterhead
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(marginX, 28, pageWidth - marginX, 28);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(marginX, 29.2, pageWidth - marginX, 29.2);

  // =========================================================================
  // 2. JUDUL LAPORAN & RINGKASAN EKSEKUTIF BEBAN MATERIAL
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'LAPORAN TEKNIS LEMBAR KERJA PROYEK & ANALISIS BEBAN STATIS AKSIAL (C45 VS PERUNGGU)',
    marginX,
    35.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Nama Proyek: ${projectName}   |   Disusun Oleh: ${preparedBy}`,
    marginX,
    40.2
  );

  // Compute aggregate material load summary across projectRows
  const totalRows = projectRows.length;
  const countC45 = projectRows.filter((r) => r.materialGrade === 'C45').length;
  const countBronze = projectRows.filter(
    (r) =>
      r.materialGrade === 'BRONZE' || r.materialGrade === 'C45_BRONZE_PAIR'
  ).length;
  const countOther = totalRows - countC45 - countBronze;

  const minLoadRow =
    projectRows.length > 0
      ? projectRows.reduce((prev, curr) =>
          curr.maxStaticLoadActiveKn < prev.maxStaticLoadActiveKn ? curr : prev
        )
      : null;
  const maxLoadRow =
    projectRows.length > 0
      ? projectRows.reduce((prev, curr) =>
          curr.maxStaticLoadActiveKn > prev.maxStaticLoadActiveKn ? curr : prev
        )
      : null;

  // Draw 4 Summary Cards for Material Load & Core Shear Formula
  const cardY = 43.5;
  const cardH = 20;
  const gap = 4;
  const cardW = (pageWidth - marginX * 2 - gap * 3) / 4;

  // Card 1: Core Shear Formula
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, cardY, cardW, cardH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('1. RUMUS DASAR GESER INTI ULIR', marginX + 3, cardY + 5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Ac = (pi / 4) * d3^2  [mm2]', marginX + 3, cardY + 10.5);
  doc.text('Fmaks = (Ac * tau_izin) / 1000 [kN]', marginX + 3, cardY + 15.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('d3 = d - 2*h3 = d - P - 2*ac', marginX + 3, cardY + 18.5);

  // Card 2: Baja C45 Reference
  const card2X = marginX + cardW + gap;
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(card2X, cardY, cardW, cardH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 138);
  doc.text('2. PARAMETER BAJA KARBON C45', card2X + 3, cardY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 78, 216);
  doc.text('tau_izin = 65 MPa (N/mm2)', card2X + 3, cardY + 10.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Batas Luluh Re = 340 MPa | sigma_izin = 110 MPa', card2X + 3, cardY + 15);
  doc.text(`Rasio Kapasitas C45 vs Perunggu = 2.17x`, card2X + 3, cardY + 18.5);

  // Card 3: Perunggu CuSn12 Reference
  const card3X = marginX + (cardW + gap) * 2;
  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(card3X, cardY, cardW, cardH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  doc.text('3. PARAMETER PERUNGGU CuSn12', card3X + 3, cardY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(180, 83, 9);
  doc.text('tau_izin = 30 MPa (N/mm2)', card3X + 3, cardY + 10.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Batas Luluh Rp0.2 = 150 MPa | sigma_izin = 50 MPa', card3X + 3, cardY + 15);
  doc.text('Menentukan batas aman pada rakitan C45+Bronze', card3X + 3, cardY + 18.5);

  // Card 4: Project Load Summary
  const card4X = marginX + (cardW + gap) * 3;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(card4X, cardY, cardW, cardH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.text('4. RINGKASAN BEBAN PROYEK AKTIF', card4X + 3, cardY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Distribusi: ${countC45} C45 | ${countBronze} Perunggu | ${countOther} Lainnya`,
    card4X + 3,
    cardY + 10
  );
  if (minLoadRow && maxLoadRow) {
    doc.text(
      `Min: ${minLoadRow.designation} (${minLoadRow.maxStaticLoadActiveKn} kN)`,
      card4X + 3,
      cardY + 14.3
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Maks: ${maxLoadRow.designation} (${maxLoadRow.maxStaticLoadActiveKn.toLocaleString(
        'id-ID'
      )} kN / ${maxLoadRow.maxStaticLoadActiveTon.toLocaleString('id-ID')} T)`,
      card4X + 3,
      cardY + 18.5
    );
  }

  // =========================================================================
  // 3. TABEL UTAMA SPESIFIKASI LEMBAR KERJA PROYEK & BEBAN STATIS
  // =========================================================================
  const tableHead = [
    [
      'No',
      'Kode Ulir',
      'd\n(mm)',
      'P\n(mm)',
      'Ph\n(mm)',
      'd2 Pitch\n(mm)',
      'd3 Inti\n(mm)',
      'D1 Bor\n(mm)',
      'h3\n(mm)',
      'w Pahat\n(mm)',
      'M 3-Kawat\n(mm)',
      'Luas Inti Ac\n(mm2)',
      'Fmaks C45\n(kN)',
      'Fmaks Brz\n(kN)',
      'Material Aktif',
      'tau\n(MPa)',
      'Fmaks Izin\n(kN | Ton)',
      'Beban F\n(kN)',
      'Status\nBeban',
      'Koef.\nGesek u',
      'Torsi T\n(N.m)',
      'Panjang\n(mm)',
      'Catatan Proyek',
    ],
  ];

  const tableBody = projectRows.map((row, idx) => {
    const matShort =
      THREAD_MATERIAL_SPECS[row.materialGrade as ThreadMaterialGrade]
        ?.shortLabel ||
      row.material ||
      'C45';

    return [
      String(idx + 1),
      row.designation,
      row.d.toFixed(2),
      row.p.toFixed(2),
      row.ph.toFixed(2),
      row.d2.toFixed(3),
      row.d3.toFixed(3),
      row.D1.toFixed(3),
      row.h3.toFixed(3),
      row.w.toFixed(3),
      row.measureOverWires.toFixed(3),
      row.coreAreaMm2.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      row.maxStaticLoadC45Kn.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      row.maxStaticLoadBronzeKn.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      matShort,
      String(row.allowableShearStressMpa),
      `${row.maxStaticLoadActiveKn.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} kN\n(${row.maxStaticLoadActiveTon.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} T)`,
      row.appliedLoadKn.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      `${row.isLoadSafe ? 'AMAN' : 'OVERLOAD'}\n(${row.loadRatioPct.toFixed(1)}%)`,
      row.frictionMu.toFixed(2),
      `${row.tighteningTorqueWorkNm.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} N.m`,
      String(row.lengthMm ?? 500),
      row.notes || '-',
    ];
  });

  autoTable(doc, {
    startY: 67,
    margin: { left: marginX, right: marginX, bottom: 24 },
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: 1.6,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { fontStyle: 'bold', cellWidth: 21 },
      2: { halign: 'right', cellWidth: 11 },
      3: { halign: 'right', cellWidth: 9 },
      4: { halign: 'right', cellWidth: 10 },
      5: { halign: 'right', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 14, textColor: [29, 78, 216] },
      7: { halign: 'right', cellWidth: 13, textColor: [146, 64, 14] },
      8: { halign: 'right', cellWidth: 10 },
      9: { halign: 'right', cellWidth: 12 },
      10: { halign: 'right', cellWidth: 14 },
      11: { halign: 'right', fontStyle: 'bold', cellWidth: 16 },
      12: {
        halign: 'right',
        fontStyle: 'bold',
        textColor: [29, 78, 216],
        fillColor: [239, 246, 255],
        cellWidth: 16,
      },
      13: {
        halign: 'right',
        fontStyle: 'bold',
        textColor: [180, 83, 9],
        fillColor: [255, 251, 235],
        cellWidth: 16,
      },
      14: { halign: 'left', cellWidth: 16 },
      15: { halign: 'right', cellWidth: 9 },
      16: {
        halign: 'right',
        fontStyle: 'bold',
        textColor: [6, 95, 70],
        fillColor: [236, 253, 245],
        cellWidth: 17,
      },
      17: { halign: 'right', cellWidth: 11 },
      18: { halign: 'center', cellWidth: 14 },
      19: { halign: 'right', cellWidth: 9 },
      20: { halign: 'right', cellWidth: 13 },
      21: { halign: 'right', cellWidth: 10 },
      22: { halign: 'left', cellWidth: 'auto' },
    },
  });

  // =========================================================================
  // 4. TABEL REFERENSI PARAMETER MATERIAL & BLOK PENGESAHAN TEKNIS
  // =========================================================================
  const finalY = (doc as any).lastAutoTable?.finalY || 140;
  let nextSectionY = finalY + 6;

  // If remaining space on current page is too tight, add a page
  if (nextSectionY + 42 > pageHeight - 14) {
    doc.addPage();
    nextSectionY = 16;
  }

  // Reference Box on Left + Signature Approval Block on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'CATATAN METODOLOGI PERHITUNGAN & PARAMETER MATERIAL STANDAR:',
    marginX,
    nextSectionY
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const methodologyNotes = [
    '1. Geometri Dasar ISO 2901 / DIN 103: Sudut puncak ulir alpha = 30 deg, tinggi kontak H1 = 0.5*P, tinggi ulir luar h3 = 0.5*P + ac, diameter pitch d2 = d - 0.5*P, diameter inti d3 = d - 2*h3.',
    '2. Luas Penampang Geser Inti (Ac): Dihitung dari penampang silinder inti baut Ac = (pi/4) * d3^2 [mm2].',
    '3. Beban Statis Aksial Maksimum Izin (Fmaks): Dihitung dengan Fmaks = Ac * tau_izin, di mana tau_izin Baja C45 = 65 MPa (SF ~ 3.0) dan tau_izin Perunggu CuSn12 = 30 MPa (SF ~ 3.0).',
    '4. Untuk pasangan rakitan Baut Baja C45 dengan Mur Perunggu CuSn12, kapasitas geser statis kritis ditentukan oleh material mur yang lebih lunak (Perunggu, tau_izin = 30 MPa).',
  ];
  methodologyNotes.forEach((line, i) => {
    doc.text(line, marginX, nextSectionY + 4.5 + i * 3.8);
  });

  // Signature / Verification Boxes on Right
  const sigBoxW = 78;
  const sigBoxX = pageWidth - marginX - sigBoxW;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(sigBoxX, nextSectionY - 2, sigBoxW, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('DISETUJUI / DIVERIFIKASI OLEH:', sigBoxX + 3, nextSectionY + 2.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Engineer Mekanik:', sigBoxX + 3, nextSectionY + 7.5);
  doc.text('QC / Metrologi:', sigBoxX + 42, nextSectionY + 7.5);

  doc.setDrawColor(148, 163, 184);
  doc.line(sigBoxX + 3, nextSectionY + 17, sigBoxX + 35, nextSectionY + 17);
  doc.line(sigBoxX + 42, nextSectionY + 17, sigBoxX + 74, nextSectionY + 17);

  // Add Footer & Page Numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Thread Calculation — Laporan Teknis Ulir ISO 2901 / DIN 103 (${docCode})`,
      marginX,
      pageHeight - 6
    );
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  doc.save(`Laporan_Teknis_Thread_Calculation_${docCode}.pdf`);
}
