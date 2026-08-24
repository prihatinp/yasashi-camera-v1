export default function YasashiLogo({ size = 40, showText = true, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="31" fill="#1DB954" />
        <rect x="18" y="24" width="28" height="20" rx="6" fill="white" />
        <circle cx="26" cy="34" r="4" fill="#1DB954" />
        <circle cx="38" cy="34" r="4" fill="#1DB954" />
        <rect x="29" y="14" width="6" height="10" rx="3" fill="white" />
        <circle cx="32" cy="12" r="3" fill="white" />
        <rect x="10" y="30" width="6" height="8" rx="3" fill="white" />
        <rect x="48" y="30" width="6" height="8" rx="3" fill="white" />
      </svg>
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
