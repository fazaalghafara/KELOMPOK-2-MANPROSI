import { useEffect, useRef, useCallback } from "react";

/**
 * usePolling — jalankan `fn` setiap `intervalMs` selama komponen mounted.
 * Polling pertama langsung dijalankan saat mount (bisa dimatikan dengan skipFirst).
 * Berhenti otomatis saat tab tidak aktif (visibilitychange) untuk hemat resource.
 */
export function usePolling(
  fn: () => Promise<void> | void,
  intervalMs: number,
  { enabled = true, skipFirst = false }: { enabled?: boolean; skipFirst?: boolean } = {}
) {
  const savedFn = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Selalu panggil versi fn terbaru
  useEffect(() => {
    savedFn.current = fn;
  }, [fn]);

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        savedFn.current();
      }
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    if (!skipFirst) {
      savedFn.current();
    }

    start();

    // Pause saat tab background, resume saat kembali
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        savedFn.current(); // langsung refresh saat tab aktif kembali
        start();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, skipFirst, start, stop]);
}
