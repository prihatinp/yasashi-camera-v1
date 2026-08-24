import * as XLSX from "xlsx";

/** logs: array inspection_logs dengan relasi programs(nama_program) & inspection_log_tool_results(*) */
export function exportLogsToExcel(logs, filename = "yasashi-camera-logs.xlsx") {
  const rows = [];

  for (const log of logs) {
    const toolResults = log.inspection_log_tool_results ?? [];
    if (toolResults.length === 0) {
      rows.push({
        Timestamp: log.timestamp,
        Program: log.programs?.nama_program ?? "",
        "Hasil Akhir": log.hasil,
        "Trigger Source": log.trigger_source,
        "AI Tool": "",
        "Hasil Tool": "",
        Confidence: "",
        "Count Value": "",
        "OCR Text": "",
      });
      continue;
    }
    for (const tr of toolResults) {
      rows.push({
        Timestamp: log.timestamp,
        Program: log.programs?.nama_program ?? "",
        "Hasil Akhir": log.hasil,
        "Trigger Source": log.trigger_source,
        "AI Tool": tr.ai_tool,
        "Hasil Tool": tr.hasil,
        Confidence: tr.confidence ?? "",
        "Count Value": tr.count_value ?? "",
        "OCR Text": tr.ocr_text ?? "",
      });
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inspection Logs");
  XLSX.writeFile(workbook, filename);
}
