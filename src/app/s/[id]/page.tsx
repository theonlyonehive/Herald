import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubscription, listDeliveries } from "@/lib/store";
import { describeRule } from "@/lib/rules";
import { BOT_CHAIN } from "@/lib/chain";
import { SubConsole } from "@/components/sub-console";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await getSubscription(id);
  if (!sub) notFound();
  const deliveries = await listDeliveries(id, 40);

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <span className="dash" aria-hidden="true" />
          <span className="ident">BOT / HERALD</span>
          <span className="links">
            <Link href="/">← ALL WATCHES</Link>
            <a href="/api/health" target="_blank" rel="noreferrer">HEALTH</a>
          </span>
          <Link className="btn ghost sm" href="/" style={{ marginLeft: 16 }}>New watch</Link>
        </div>
      </nav>

      <section className="section">
        <div className="sec-label">
          Watch console · {sub.active ? "live" : "paused"} · {describeRule(sub)}
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px, 5.4vw, 64px)" }}>{sub.label}</h1>

        <div className="kv" style={{ marginBottom: 20 }}>
          <div><div className="k">Status</div><div className="v">{sub.active ? "live" : "paused"}</div></div>
          <div><div className="k">Cursor block</div><div className="v">{sub.cursorBlock.toLocaleString()}</div></div>
          <div><div className="k">Delivered</div><div className="v">{sub.delivered}</div></div>
          <div><div className="k">Failed</div><div className="v">{sub.failed}</div></div>
          <div><div className="k">Last tick</div><div className="v">{sub.lastTickAt ? `${sub.lastTickAt.slice(11, 19)}Z` : "—"}</div></div>
          <div><div className="k">Created</div><div className="v">{sub.createdAt.slice(0, 16).replace("T", " ")}Z</div></div>
        </div>

        <div className="dossier" style={{ marginBottom: 26 }}>
          <div className="dossier-head">
            <span>Target</span>
            <span style={{ marginLeft: "auto" }}>{sub.rule.kind}</span>
          </div>
          <div className="field wide">
            <label>Webhook URL</label>
            <input readOnly value={sub.targetUrl} />
          </div>
          <div className="hint" style={{ marginTop: 10 }}>
            Signing secret (shown once at creation): <code>{sub.secret.slice(0, 12)}…</code> — verify every
            <code> x-herald-signature</code> header against the full secret.
          </div>
        </div>

        <SubConsole id={sub.id} active={sub.active} cursorBlock={sub.cursorBlock} />

        <h2 className="sec-title" style={{ marginTop: 38, fontSize: "clamp(22px, 2.6vw, 32px)" }}>
          Deliveries ({deliveries.length})
        </h2>
        {deliveries.length === 0 ? (
          <p className="empty">Nothing delivered yet for this watch.</p>
        ) : (
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr><th>When UTC</th><th>Event</th><th>Block</th><th>Transaction</th><th>Result</th><th>Latency</th></tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const last = d.attempts[d.attempts.length - 1];
                  return (
                    <tr key={d.id}>
                      <td>{d.createdAt.slice(11, 19)}</td>
                      <td>{d.event}</td>
                      <td>{d.blockNumber}</td>
                      <td>
                        <a href={`${BOT_CHAIN.explorer}/tx/${d.txHash}`} target="_blank" rel="noreferrer">
                          {d.txHash.slice(0, 14)}…
                        </a>
                      </td>
                      <td style={{ color: d.ok ? "#5D7D4A" : "#D9362B" }}>
                        {last ? `HTTP ${last.status ?? last.error ?? "error"}` : "no attempt"} · {d.attempts.length}×
                      </td>
                      <td>{last ? `${last.latencyMs}ms` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="sec-title" style={{ marginTop: 38, fontSize: "clamp(22px, 2.6vw, 32px)" }}>
          Payload as delivered
        </h2>
        <pre className="payload">
{deliveries.length > 0
  ? JSON.stringify(deliveries[0].payload, null, 2)
  : JSON.stringify({ note: "the first delivered event appears here exactly as your endpoint received it" }, null, 2)}
        </pre>
      </section>

      <SiteFooter variant="inner" />
    </>
  );
}
