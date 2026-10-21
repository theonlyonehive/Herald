import Link from "next/link";
import { CreateWatch } from "@/components/create-watch";
import { LiveFeed } from "@/components/live-feed";
import { listSubscriptions, listRecentDeliveries } from "@/lib/store";
import { describeRule } from "@/lib/rules";
import { BOT_CHAIN, short } from "@/lib/chain";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";

/* The mark: a core with the signal coming off it. */
function Mark({ inverse = false }: { inverse?: boolean }) {
  const ring = inverse ? "#ffffff" : "#0b0b12";
  const core = inverse ? "#8b7bff" : "#4b34f0";
  return (
    <svg className="mark" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="39" stroke={ring} strokeWidth="8" />
      <circle cx="48" cy="48" r="26" stroke={ring} strokeWidth="4" />
      <circle cx="48" cy="48" r="12" fill={core} />
    </svg>
  );
}

const SAMPLE = [
  { event: "Transfer", block: 26816792, ok: true },
  { event: "Approval", block: 26816788, ok: true },
  { event: "NativeTransfer", block: 26816770, ok: true },
];

const STAGES = [
  {
    num: "01 / Watch",
    title: "Register what matters",
    body: "An address, an event signature, a contract, or a raw 32-byte topic0. Nothing to install.",
  },
  {
    num: "02 / Filter",
    title: "Resolve against the chain",
    body: "Herald walks BOT Chain logs and native transfers, applying your rule and a persisted cursor.",
  },
  {
    num: "03 / Sign",
    title: "Sign the exact bytes",
    body: "Block, tx, log index, decoded args and the matched rule — sealed with HMAC-SHA256.",
    code: "x-herald-signature: sha256=7c1f4a9e…",
  },
  {
    num: "04 / Deliver",
    title: "POST, retry, replay",
    body: "Delivered once, retried with backoff on failure, every attempt recorded on the console.",
  },
];

export default async function Home() {
  let subs: Awaited<ReturnType<typeof listSubscriptions>> = [];
  let recent: Awaited<ReturnType<typeof listRecentDeliveries>> = [];
  try {
    subs = await listSubscriptions();
    recent = await listRecentDeliveries(4);
  } catch {
    /* store unavailable — page still renders */
  }

  const last = recent[0];
  const feed = recent.length > 0 ? recent.slice(0, 3).map((d) => ({ event: d.event, block: d.blockNumber, ok: d.ok })) : SAMPLE;
  const latency = last?.attempts[last.attempts.length - 1]?.latencyMs;

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="/">
            <Mark />
            <span className="brandname">Herald</span>
          </a>
          <span className="ident">BOT Chain {BOT_CHAIN.chainId}</span>
          <span className="links">
            <a href="#how">How it works</a>
            <a href="#create">Create a watch</a>
            <a href="#activity">Activity</a>
            <a href="/api/health" target="_blank" rel="noreferrer">API</a>
          </span>
          <a className="btn sm" href="#create" style={{ marginLeft: 12 }}>Create a watch</a>
        </div>
      </nav>

      <header className="hero">
        <div className="rings" aria-hidden="true">
          <span className="ring" /><span className="ring" /><span className="ring" />
          <span className="ring" /><span className="ring" />
          <span className="spark" />
          <span className="core">Chain<br />{BOT_CHAIN.chainId}</span>
        </div>
        <div className="hero-inner">
          <span className="kicker">Signed event webhooks</span>
          <h1>
            Stop polling.<br />
            Start <i>listening.</i>
          </h1>
          <div className="hero-sub">
            <p className="hero-copy">
              Point Herald at a contract, an event or an address. The moment it happens on-chain, a signed
              payload lands on your endpoint.
            </p>
            <div className="actions">
              <a className="btn" href="#create">Create a watch</a>
              <a className="btn ghost" href="#how">How it works</a>
            </div>
          </div>
        </div>
      </header>

      <div className="band">
        <div className="beam">
          <div className="metric">
            <div className="k">Last delivery</div>
            <div className="v">{last ? `block ${last.blockNumber}` : "awaiting first event"}</div>
          </div>
          <div className="metric">
            <div className="k">Endpoint</div>
            <div className="v">{last?.ok === false ? "HTTP error" : "HTTP 200"}</div>
          </div>
          <div className="metric">
            <div className="k">Round trip</div>
            <div className="v">{latency ? `${latency} ms` : "— ms"}</div>
          </div>
          <div className="feed">
            <div className="metric">
              <div className="k">Signature</div>
              <div className="v sig">{last ? "sha256=verified by your endpoint" : "HMAC-SHA256 over the exact bytes"}</div>
            </div>
            <div className="feed-rows">
              {feed.map((f, i) => (
                <div className="event" key={`${f.event}-${f.block}-${i}`}>
                  <span className={`dotted ${f.ok ? "on" : ""}`} />
                  <b>{f.event}</b>
                  <span>blk {f.block}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="section" id="how">
        <div className="sec-label">Methodology</div>
        <h2 className="sec-title">Four parts. No poller to own.</h2>
        <div className="pipeline">
          {STAGES.map((s) => (
            <div className="stage" key={s.num}>
              <span className="num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              {s.code ? <code>{s.code}</code> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="numbers">
          <div className="num-item">
            <span className="n acc">{BOT_CHAIN.chainId}</span>
            <span className="l">Chain id · native BOT</span>
          </div>
          <div className="num-item">
            <span className="n">SHA-256</span>
            <span className="l">HMAC on every delivery</span>
          </div>
          <div className="num-item">
            <span className="n">3×</span>
            <span className="l">Retries with backoff</span>
          </div>
          <div className="num-item">
            <span className="n">0</span>
            <span className="l">Keys held by Herald</span>
          </div>
        </div>
      </section>

      <section className="section" id="create">
        <div className="sec-label">Specification</div>
        <h2 className="sec-title">Create a watch</h2>
        <CreateWatch />
      </section>

      <section className="section">
        <div className="sec-label">Registry</div>
        <h2 className="sec-title">Your watches ({subs.length})</h2>
        {subs.length === 0 ? (
          <p className="empty">No watches yet — create one above.</p>
        ) : (
          subs.map((s) => (
            <div className="watch" key={s.id}>
              <span className={`tag ${s.active ? "" : "off"}`}>{s.active ? "live" : "paused"}</span>
              <span>
                <div className="name">{s.label}</div>
                <div className="meta">{describeRule(s)}</div>
              </span>
              <span className="meta">
                → {short(s.targetUrl, 14)}
                <br />cursor {s.cursorBlock.toLocaleString()} · {s.delivered} ok / {s.failed} failed
              </span>
              <Link className="btn ghost sm" href={`/s/${s.id}`}>Console</Link>
            </div>
          ))
        )}
      </section>

      <section className="section" id="activity">
        <div className="sec-label">Ledger</div>
        <h2 className="sec-title">Delivery activity</h2>
        <LiveFeed />
      </section>

      <SiteFooter />
    </>
  );
}
