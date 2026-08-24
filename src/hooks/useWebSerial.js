import { useCallback, useRef, useState } from "react";

/**
 * Wrapper Web Serial API untuk komunikasi dengan Arduino Uno.
 *
 * Protokol sederhana berbasis teks baris (newline-terminated), sketch Arduino contoh:
 *   - Kirim "TRIGGER\n" ke serial saat pin input eksternal (mis. D2) mendeteksi rising edge.
 *   - Terima "OK\n" / "NG\n" dari app untuk menyalakan output digital (lampu/relay) sesuai Judgment.
 *
 * Ganti protokol sesuai kebutuhan sketch Arduino kamu sendiri.
 */
export function useWebSerial({ baudRate = 9600, onLine } = {}) {
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const supported = typeof navigator !== "undefined" && "serial" in navigator;

  const connect = useCallback(async () => {
    if (!supported) {
      setError("Browser tidak mendukung Web Serial API (gunakan Chrome/Edge desktop).");
      return;
    }
    setError("");
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      writerRef.current = port.writable.getWriter();
      setConnected(true);

      keepReadingRef.current = true;
      readLoop(port);
    } catch (err) {
      setError(err.message || "Gagal terhubung ke Arduino.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baudRate, supported]);

  async function readLoop(port) {
    const textDecoder = new TextDecoderStream();
    const readableClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = { reader, readableClosed };

    let buffer = "";
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) onLine?.(line);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      reader.releaseLock();
    }
  }

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    try {
      writerRef.current?.releaseLock();
      await readerRef.current?.reader.cancel();
      await portRef.current?.close();
    } catch {
      // port sudah tertutup / device dicabut, aman diabaikan
    }
    setConnected(false);
  }, []);

  const sendLine = useCallback(async (text) => {
    if (!writerRef.current) return;
    const encoder = new TextEncoder();
    await writerRef.current.write(encoder.encode(`${text}\n`));
  }, []);

  return { supported, connected, error, connect, disconnect, sendLine };
}
