export default function CameraView({ source, streamUrl, videoRef, imgRef, className = "" }) {
  if (source === "ethernet") {
    return (
      <img
        ref={imgRef}
        src={streamUrl}
        alt="Live stream kamera Ethernet"
        crossOrigin="anonymous"
        className={`w-full h-full object-contain bg-black ${className}`}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`w-full h-full object-contain bg-black ${className}`}
    />
  );
}
