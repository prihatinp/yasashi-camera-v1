import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import MasteringStep from "./steps/MasteringStep.jsx";
import AddToolsStep from "./steps/AddToolsStep.jsx";
import LevelAdjustmentStep from "./steps/LevelAdjustmentStep.jsx";
import DecisionLogicStep from "./steps/DecisionLogicStep.jsx";
import TriggerConfigStep from "./steps/TriggerConfigStep.jsx";

const STEPS = [
  { key: "mastering", label: "1. Mastering" },
  { key: "tools", label: "2. Add & Save Tools" },
  { key: "level", label: "3. Level Adjustment" },
  { key: "decision", label: "4. Decision Logic" },
  { key: "trigger", label: "5. Trigger Config" },
];

export default function SetupProgramPage() {
  const { programId, step = "mastering" } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [{ data: programData }, { data: toolsData }] = await Promise.all([
      supabase.from("programs").select("*").eq("id", programId).single(),
      supabase
        .from("program_tools")
        .select("*")
        .eq("program_id", programId)
        .order("tool_order", { ascending: true }),
    ]);
    setProgram(programData ?? null);
    setTools(toolsData ?? []);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function markReadyIfPossible(currentTools) {
    const anyReady = currentTools.some((t) => t.is_saved && t.is_level_adjusted && t.is_active);
    if (anyReady) {
      await supabase.from("programs").update({ is_ready_to_run: true }).eq("id", programId);
    }
  }

  if (loading) return <p className="text-gray-400">Memuat Program...</p>;
  if (!program) return <p className="text-red-600">Program tidak ditemukan.</p>;

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/programs" className="text-sm text-gray-400">
            ← Kembali ke daftar Program
          </Link>
          <h1 className="text-xl font-bold">{program.nama_program}</h1>
        </div>
        <span className={program.is_ready_to_run ? "badge-ok" : "badge-unknown"}>
          {program.is_ready_to_run ? "Siap Run" : "Belum Siap Run"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => navigate(`/programs/${programId}/setup/${s.key}`)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
              i === currentIndex
                ? "bg-yasashi-green text-white"
                : i < currentIndex
                ? "bg-yasashi-green/10 text-yasashi-green-dark"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card">
        {step === "mastering" && <MasteringStep program={program} onSaved={reload} />}
        {step === "tools" && <AddToolsStep program={program} tools={tools} onSaved={reload} />}
        {step === "level" && (
          <LevelAdjustmentStep
            program={program}
            tools={tools}
            onSaved={async (updatedTools) => {
              await reload();
              await markReadyIfPossible(updatedTools ?? tools);
            }}
          />
        )}
        {step === "decision" && <DecisionLogicStep program={program} onSaved={reload} />}
        {step === "trigger" && <TriggerConfigStep program={program} onSaved={reload} />}
      </div>
    </div>
  );
}
