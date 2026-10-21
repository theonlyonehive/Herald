"use client";

import { useState } from "react";
import { useBotChainWallet } from "@/lib/wallet";
import { NETS, DEFAULT_NET, type NetId } from "@/lib/registry";

const WATCH_TYPES = [
  { key: "transfer", label: "ERC-20 / ERC-721 — Transfer", kind: "event" },
  { key: "approval", label: "Approval — allowance granted", kind: "event" },
  { key: "approvalForAll", label: "ApprovalForAll — operator", kind: "event" },
  { key: "transferSingle", label: "ERC-1155 — TransferSingle", kind: "event" },
  { key: "custom", label: "Arbitrary topic0 (advanced)", kind: "event" },
  { key: "native", label: "Native BOT transfer", kind: "native_transfer" },
  { key: "call", label: "Any call to a contract", kind: "contract_call" },
];

export function CreateWatch() {
  const [watchType, setWatchType] = useState("transfer");
  const [label, setLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [topic0, setTopic0] = useState("");
  const [watchedAddress, setWatchedAddress] = useState("");
  const [direction, setDirection] = useState("to");
  const [minValue, setMinValue] = useState("");
  const [backfillBlocks, setBackfill] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; secret: string } | null>(null);
  const [net, setNet] = useState<NetId>(DEFAULT_NET);
  const wallet = useBotChainWallet(net);
  const [onchain, setOnchain] = useState<{ id: string; txHash: string; block: number; explorer: string } | null>(null);

  const selected = WATCH_TYPES.find((t) => t.key === watchType)!;
  const isEvent = selected.kind === "event";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const minWei = minValue.trim() ? BigInt(Math.round(Number(minValue) * 1e18)).toString() : null;
      const body: Record<string, unknown> = {
        label: label || `${selected.label} watch`,
        targetUrl,
        kind: selected.kind,
        backfillBlocks: Number(backfillBlocks) || 0,
      };
      if (isEvent) {
        body.topic0 = watchType === "custom" ? topic0.trim() : watchType;
        if (contractAddress.trim()) body.contractAddress = contractAddress.trim();
      }
      if (selected.kind === "native_transfer") {
        body.watchedAddress = watchedAddress.trim();
        body.direction = direction;
        if (minWei) body.minValue = minWei;
      }
      if (selected.kind === "contract_call") body.contractAddress = contractAddress.trim();

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Could not create the watch.");
      setCreated({ id: data.subscription.id, secret: data.secret });
      setOnchain(null);
      setLabel("");
      setTargetUrl("");

      // If a BOT Chain wallet is connected, anchor the watch in the on-chain registry too.
      // The off-chain record holds the HMAC secret; the registry holds ownership + the rule,
      // so the watch is publicly attributable without ever exposing a signing key.
      if (wallet.account) {
        try {
          const minWei = minValue.trim() ? BigInt(Math.round(Number(minValue) * 1e18)) : 0n;
          const r = await wallet.registerOnChain({
            token: "0x0000000000000000000000000000000000000000",
            minValueWei: minWei,
            endpoint: targetUrl,
          });
          setOnchain(r);
        } catch (e) {
          setError(e instanceof Error ? e.message : "On-chain registration failed.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dossier" onSubmit={submit}>
      <div className="dossier-head">
        <span className="dash" style={{ width: 14, height: 7, background: "var(--signal)", display: "inline-block" }} />
        <span>Watch specification · {NETS[net].label} ({net})</span>
        <span style={{ marginLeft: "auto" }}>read-only</span>
      </div>

      {/* Connect a BOT Chain wallet to anchor the watch on-chain. Optional: the relay works
          without it, but a registered watch is publicly owned and auditable in the registry. */}
      <div className="walletbar">
        <div className="wb-net">
          {([968, 677] as NetId[]).map((n) => (
            <button key={n} type="button" className={n === net ? "on" : ""} onClick={() => setNet(n)}>
              {NETS[n].short}
            </button>
          ))}
        </div>
        {wallet.account ? (
          <>
            <span className="chainchip">
              {wallet.onRightChain ? `on ${NETS[net].short}` : `on chain ${wallet.chainId}`}
            </span>
            <span className="wb-status">{wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}</span>
            {!wallet.onRightChain && (
              <button className="btn ghost sm" type="button" onClick={() => wallet.ensureChain(net)}>
                Switch to {NETS[net].short}
              </button>
            )}
            <button className="btn ghost sm" type="button" onClick={wallet.disconnect}>Disconnect</button>
          </>
        ) : (
          <>
            <button className="btn ghost sm" type="button" onClick={wallet.connect} disabled={wallet.busy}>
              {wallet.busy ? <span className="spin" /> : "Connect BOT Chain wallet"}
            </button>
            <span className="wb-status">
              {wallet.available ? "optional — anchors the watch on-chain" : "no injected wallet detected"}
            </span>
          </>
        )}
        {wallet.error && <div className="wb-err">{wallet.error}</div>}
      </div>

      <div className="fgrid">
        <div className="field">
          <label htmlFor="wt">What to watch</label>
          <select id="wt" value={watchType} onChange={(e) => setWatchType(e.target.value)}>
            {WATCH_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="label">Label</label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Treasury inflows" />
        </div>

        <div className="field wide">
          <label htmlFor="url">Your webhook URL</label>
          <input id="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://api.yourapp.com/herald" required />
        </div>

        {selected.kind === "native_transfer" && (
          <>
            <div className="field">
              <label htmlFor="wa">Address to watch</label>
              <input id="wa" value={watchedAddress} onChange={(e) => setWatchedAddress(e.target.value)} placeholder="0x…" required />
            </div>
            <div className="field">
              <label htmlFor="dir">Direction</label>
              <select id="dir" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="to">incoming — to this address</option>
                <option value="from">outgoing — from this address</option>
                <option value="any">both</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="min">Minimum value in BOT (optional)</label>
              <input id="min" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="e.g. 1" />
            </div>
          </>
        )}

        {selected.kind !== "native_transfer" && (
          <div className="field">
            <label htmlFor="ca">
              Contract address {selected.kind === "event" ? "— optional, blank means any contract" : ""}
            </label>
            <input id="ca" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} placeholder="0x…" required={selected.kind === "contract_call"} />
          </div>
        )}

        {watchType === "custom" && (
          <div className="field">
            <label htmlFor="t0">topic0 · 32-byte hash</label>
            <input id="t0" value={topic0} onChange={(e) => setTopic0(e.target.value)} placeholder="0x… 64 hex characters" required />
          </div>
        )}

        <div className="field">
          <label htmlFor="bf">Backfill — blocks of history to replay on creation</label>
          <input id="bf" value={backfillBlocks} onChange={(e) => setBackfill(e.target.value)} placeholder="0" />
        </div>

        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label aria-hidden="true">&nbsp;</label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spin" /> : "Create watch"}
          </button>
        </div>
      </div>

      {error && <div className="note bad">{error}</div>}

      {created && (
        <div className="note">
          <strong>Watch created.</strong> This signing secret is shown once — store it and verify every incoming
          <code> x-herald-signature</code> against it.
          <div className="secret">{created.secret}</div>
          <div style={{ marginTop: 12 }}>
            <a className="btn ghost sm" href={`/s/${created.id}`}>Open the watch console →</a>
          </div>
        </div>
      )}

      {onchain && (
        <div className="onchain">
          <div className="oc-label">Registered on-chain · {NETS[net].label}</div>
          <div className="oc-row">
            watch id <strong>#{onchain.id}</strong> · block {onchain.block}
            <br />
            <a href={`${onchain.explorer}/tx/${onchain.txHash}`} target="_blank" rel="noreferrer">
              {onchain.txHash.slice(0, 26)}… ↗
            </a>
          </div>
        </div>
      )}
    </form>
  );
}
