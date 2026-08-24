export default function YasashiLogo({ size = 40, showText = true, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}logo-ymt.png`}
        alt="PT. Yasashi Mitra Teknik"
        style={{ height: size }}
        className="w-auto rounded-md"
      />
      {showText && (
        <div className="leading-tight">
          <div className="font-bold text-gray-900">Yasashi Camera</div>
          <div className="text-[11px] text-gray-500">
            Pray Hard &middot; Work Smart &middot; Keep Yasashi
          </div>
        </div>
      )}
    </div>
  );
}
