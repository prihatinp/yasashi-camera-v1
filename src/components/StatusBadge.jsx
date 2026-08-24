export default function StatusBadge({ hasil, size = "sm" }) {
  const cls =
    hasil === "OK" ? "badge-ok" : hasil === "NG" ? "badge-ng" : "badge-unknown";
  const bigCls = size === "lg" ? "!text-3xl !px-8 !py-4 !rounded-3xl" : "";
  return <span className={`${cls} ${bigCls}`}>{hasil ?? "UNKNOWN"}</span>;
}
