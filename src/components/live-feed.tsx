"use client";

import { useCallback, useEffect, useState } from "react";

interface DeliveryView {
  id: string;
  subscriptionId: string;
  createdAt: string;
  event: string;
  blockNumber: number;
  txHash: string;
  ok: boolean;
  attempts: { status: number | null; ok: boolean; latencyMs: number; error?: string | null }[];
}

export function LiveFeed() {
  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [backend, setBackend] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickResult, setTickResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/deliveries", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setDeliveries(data.deliveries ?? []);
        setBackend(data.backend ?? "");
      }
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function runTick() {
    setBusy(true);
    setTickResult(null);
    try {
      const res = await fetch("/api/tick", { method: "POST" });
      const data = await res.json();
      setTickResult(
        data.ok
          ? `head ${data.head} · scanned ${data.scanned} blocks · ${data.matched} matched · ${data.delivered} delivered · ${data.failed} failed`
          : `tick failed — ${data.error}`,
      );
      await load();
    } catch {
      setTickResult("tick request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <span className="sec-label" style={{ margin: 0 }}>
          store · {backend || "…"}
        </span>
        <span style={{ marginLeft: "auto" }} />
        <button className="btn ghost sm" type="button" onClick={runTick} disabled={busy}>
          {busy ? "running…" : "Run tick now"}
        </button>
      </div>

      {tickResult && <div className="note">{tickResult}</div>}

      {deliveries.length === 0 ? (
        <p className="empty">No deliveries yet. Create a watch, then run a tick — or let the scheduled function do it.</p>
      ) : (
        deliveries.map((d) => {
          const last = d.attempts[d.attempts.length - 1];
          return (
            <div className="dlv" key={`${d.subscriptionId}-${d.id}`}>
              <span className={`dot ${d.ok ? "ok" : "bad"}`} />
              <span>
                {d.event} · block {d.blockNumber} · {d.txHash.slice(0, 14)}…
              </span>
              <span style={{ color: "var(--ink-2)" }}>
                {last ? `HTTP ${last.status ?? last.error ?? "error"}` : "no attempt"} · {d.attempts.length} attempt{d.attempts.length === 1 ? "" : "s"}
              </span>
              <span className="when">{last ? `${last.latencyMs}ms` : "—"}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
