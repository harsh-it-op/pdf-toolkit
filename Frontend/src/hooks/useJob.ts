import { useEffect, useRef, useState } from "react";
import { api, APIError, type JobPublic } from "@/lib/api";

interface State {
  status: JobPublic["status"] | "idle";
  progress: number;
  stage: string;
  result: unknown;
  error: APIError | null;
}

/**
 * Poll a job by id. Resolves only via setState — the caller decides what to do
 * with `result` (e.g. type narrow it). Stops polling on terminal status.
 */
export function useJob(jobId: string | null) {
  const [state, setState] = useState<State>({
    status: "idle",
    progress: 0,
    stage: "",
    result: undefined,
    error: null,
  });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!jobId) {
      setState({ status: "idle", progress: 0, stage: "", result: undefined, error: null });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await api.job(jobId);
        if (cancelled.current) return;
        const j = r.job;
        setState({
          status: j.status,
          progress: j.progress,
          stage: j.stage,
          result: j.result,
          error: j.error
            ? new APIError(j.error.message, j.error.code, 422)
            : null,
        });
        if (j.status === "queued" || j.status === "processing") {
          // Adaptive polling: faster at start, slower as it goes on.
          const delay = j.progress < 30 ? 400 : 800;
          timer = setTimeout(tick, delay);
        }
      } catch (e) {
        if (cancelled.current) return;
        const err =
          e instanceof APIError
            ? e
            : new APIError("Lost connection to the server", "NETWORK", 0);
        setState((s) => ({ ...s, status: "failed", error: err }));
      }
    };
    tick();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return state;
}
