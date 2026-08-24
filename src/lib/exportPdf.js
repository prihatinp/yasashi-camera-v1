import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportLogsToPdf(logs, { title = "Laporan Inspeksi", dateRangeLabel = "" } = {}) {
  const doc = new jsPDF();
  const okCount = logs.filter((l) => l.hasil === "OK").length;
  const ngCount = logs.filter((l) => l.hasil === "NG").length;

  doc.setFontSize(16);
  doc.text("Yasashi Camera V1.0 — Laporan Inspeksi", 14, 18);
  doc.setFontSize(11);
  doc.text(title, 14, 26);
  if (dateRangeLabel) doc.text(dateRangeLabel, 14, 32);
  doc.text(`Total: ${logs.length}  |  OK: ${okCount}  |  NG: ${ngCount}`, 14, 38);

  autoTable(doc, {
    startY: 44,
    head: [["Timestamp", "Program", "Hasil", "Trigger"]],
    body: logs.map((l) => [
      new Date(l.timestamp).toLocaleString("id-ID"),
      l.programs?.nama_program ?? "",
      l.hasil,
      l.trigger_source,
    ]),
    headStyles: { fillColor: [29, 185, 84] },
    styles: { fontSize: 9 },
  });

  doc.save("yasashi-camera-laporan.pdf");
}
