import * as differentiate from "./differentiate/index.jsx";
import * as identify from "./identify/index.jsx";
import * as count from "./count/index.jsx";
import * as throughCount from "./through_count/index.jsx";
import * as ocr from "./ocr/index.jsx";
import * as trigger from "./trigger/index.jsx";

/**
 * Registry modular AI Tools. Tambah tool baru cukup buat folder baru di ai-tools/<nama>
 * dengan export { meta, ThresholdForm }, lalu daftarkan di sini.
 */
export const AI_TOOLS = {
  differentiate,
  identify,
  count,
  through_count: throughCount,
  ocr,
  trigger,
};

export const AI_TOOL_LIST = Object.values(AI_TOOLS).map((mod) => mod.meta);

export function getToolMeta(key) {
  return AI_TOOLS[key]?.meta;
}

export function getToolThresholdForm(key) {
  return AI_TOOLS[key]?.ThresholdForm;
}
