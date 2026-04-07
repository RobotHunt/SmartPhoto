import { useEffect, useRef } from "react";

/**
 * Custom hook to poll for quality status updates.
 *
 * @param needsPolling Boolean indicating if there are assets with "pending_async_review" status
 * @param pollFn The async function to call to refresh the data
 * @param intervalMs Polling interval in milliseconds (default: 5000)
 */
export function useQualityPolling(
  needsPolling: boolean,
  pollFn: () => Promise<void>,
  intervalMs = 5000
) {
  const pollFnRef = useRef(pollFn);

  useEffect(() => {
    pollFnRef.current = pollFn;
  }, [pollFn]);

  useEffect(() => {
    if (!needsPolling) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      if (cancelled) return;
      try {
        await pollFnRef.current();
      } catch (err) {
        // Silence errors during polling
        console.error("Quality polling error:", err);
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [needsPolling, intervalMs]);
}
