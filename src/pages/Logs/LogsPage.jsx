import { Fragment, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { exportLogsToExcel } from "../../lib/exportExcel";
import { exportLogsToPdf } from "../../lib/exportPdf";
import StatusBadge from "../../components/StatusBadge.jsx";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";

export default function LogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [filterProgram, setFilterProgram] = useState("");
  const [filterHasil, setFilterHasil] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    if (!profile?.organisasi_id) return;
    setLoading(true);
    let query = supabase
      .from("inspection_logs")
      .select("*, programs(nama_program), inspection_log_tool_results(*)")
      .eq("organisasi_id", profile.organisasi_id)
      .order("timestamp", { ascending: false })
      .limit(500);

    if (filterProgram) query = query.eq("program_id", filterProgram);
    if (filterHasil) query = query.eq("hasil", filterHasil);
    if (dateFrom) query = query.gte("timestamp", new Date(dateFrom).toISOString());
    if (dateTo) query = query.lte("timestamp", new Date(dateTo + "T23:59:59").toISOString());

    const { data } = await query;
    setLogs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!profile?.organisasi_id) return;
    supabase
      .from("programs")
      .select("id, nama_program")
      .eq("organisasi_id", profile.organisasi_id)
      .then(({ data }) => setPrograms(data ?? []));
  }, [profile?.organisasi_id]);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organisasi_id, filterProgram, filterHasil, dateFrom, dateTo]);

  const dateRangeLabel =
    dateFrom || dateTo ? `Rentang: ${dateFrom || "..."} s/d ${dateTo || "..."}` : "Seluruh histori";
  const programLabel = programs.find((p) => p.id === filterProgram)?.nama_program ?? "Semua Program";

  if (!profile?.organisasi_id) return <NoOrgNotice />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Logs</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportLogsToExcel(logs)}>
            📊 Export Excel
          </button>
          <button
            className="btn-secondary"
            onClick={() => exportLogsToPdf(logs, { title: programLabel, dateRangeLabel })}
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="input !w-auto" value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
          <option value="">Semua Program</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama_program}
            </option>
          ))}
        </select>
        <select className="input !w-auto" value={filterHasil} onChange={(e) => setFilterHasil(e.target.value)}>
          <option value="">Semua Hasil</option>
          <option value="OK">OK</option>
          <option value="NG">NG</option>
        </select>
        <input type="date" className="input !w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="input !w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Hasil</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Belum ada log inspeksi.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <Fragment key={log.id}>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">{log.programs?.nama_program}</td>
                  <td className="px-4 py-3">
                    <StatusBadge hasil={log.hasil} />
                  </td>
                  <td className="px-4 py-3 uppercase text-xs text-gray-500">{log.trigger_source}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-yasashi-green-dark text-xs font-medium"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    >
                      {expanded === log.id ? "Tutup" : "Detail"}
                    </button>
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="space-y-1">
                        {(log.inspection_log_tool_results ?? []).map((tr) => (
                          <div key={tr.id} className="flex items-center gap-2 text-xs">
                            <StatusBadge hasil={tr.hasil} />
                            <span className="text-gray-600">
                              {tr.ai_tool}
                              {tr.confidence != null ? ` (${(tr.confidence * 100).toFixed(1)}%)` : ""}
                              {tr.ocr_text ? ` — "${tr.ocr_text}"` : ""}
                              {tr.count_value != null ? ` — count: ${tr.count_value}` : ""}
                            </span>
                          </div>
                        ))}
                        {(log.inspection_log_tool_results ?? []).length === 0 && (
                          <p className="text-xs text-gray-400">Tidak ada rincian per-tool.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
