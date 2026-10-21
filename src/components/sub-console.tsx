"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubConsole({ id, active, cursorBlock }: { id: string; active: boolean; cursorBlock: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [replayFrom, setReplayFrom] = useState(String(Math.max(0, cursorBlock - 200)));

  async function send(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      setMessage(data.ok ? `${action} — done` : data.error ?? "failed");
      router.refresh();
    } catch {
      setMessage(`${action} request failed`);
    } finally {
      setBusy(false);
    }
  }

  async function runTick() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tick", { method: "POST" });
      const data = await res.json();
      setMessage(
        data.ok
          ? `head ${data.head} · scanned ${data.scanned} · matched ${data.matched} · delivered ${data.delivered} · failed ${data.failed}`
          : `tick failed — ${data.error}`,
      );
      router.refresh();
    } catch {
      setMessage("tick request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dossier">
      <div className="dossier-head">
        <span>Controls</span>
        <span style={{ marginLeft: "auto" }}>cursor + replay</span>
      </div>
      <div className="row-actions">
        <div className="field" style={{ maxWidth: 240 }}>
          <label htmlFor="rf">Replay from block</label>
          <input id="rf" value={replayFrom} onChange={(e) => setReplayFrom(e.target.value)} />
        </div>
        <button className="btn ghost" type="button" disabled={busy} onClick={() => send("replay", { fromBlock: Number(replayFrom) })}>
          Replay from block
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={() => send(active ? "pause" : "resume")}>
          {active ? "Pause watch" : "Resume watch"}
        </button>
        <button className="btn" type="button" disabled={busy} onClick={runTick}>
          {busy ? <span className="spin" /> : "Run tick now"}
        </button>
      </div>
      {message && <div className="note">{message}</div>}
    </div>
  );
}
