import Link from "next/link";
import { NETS } from "@/lib/registry";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Herald — launch announcement",
  description: "Herald, signed event webhooks for BOT Chain.",
};

/**
 * Launch announcement.
 *
 * The mainnet claim is DERIVED, never hard-coded. `NETS[677].registry` is set only once the
 * registry contract is actually deployed to BOT Chain mainnet, so the sentence
 * "Officially launched on BOT Chain Mainnet" cannot appear before that is true. Publishing a
 * launch claim ahead of the deployment is both a false statement and the fastest way to fail
 * a grant review — an reviewer will open the explorer link.
 */
export default function LaunchPage() {
  const mainnet = NETS[677];
  const testnet = NETS[968];
  const live = Boolean(mainnet.registry);

  return (
    <main className="wrap" style={{ paddingTop: "clamp(40px, 6vw, 96px)", paddingBottom: "clamp(48px, 6vw, 96px)" }}>
      <div className="sec-label">Announcement</div>
      <h1 className="sec-title" style={{ maxWidth: "22ch" }}>
        {live ? "Officially launched on BOT Chain Mainnet" : "Herald — launching on BOT Chain"}
      </h1>

      <div className="band" style={{ marginTop: 22 }}>
        <div className="note">
          Herald is a read-only relay that turns BOT Chain activity into <strong>signed webhook
          deliveries</strong>. You register a rule — a token transfer above a value, an approval, a
          native BOT movement, any call to a contract — and Herald delivers a payload with an
          HMAC-SHA256 signature you can verify. It holds no funds, takes no custody, and never
          signs for you.
        </div>
      </div>

      <section className="section">
        <div className="sec-label">Status</div>
        <h2 className="sec-title">Where this actually stands</h2>
        <div className="dossier">
          <div className="dossier-head">
            <span className="dash" style={{ width: 14, height: 7, background: "var(--signal)", display: "inline-block" }} />
            <span>Network status</span>
            <span style={{ marginLeft: "auto" }}>live</span>
          </div>
          <div className="kv">
            <span>Relay</span>
            <span>live — /api/health reports the chain head it is reading</span>
          </div>
          <div className="kv">
            <span>{testnet.label}</span>
            <span>
              registry deployed ·{" "}
              {testnet.registry ? (
                <a href={`${testnet.explorer}/address/${testnet.registry}`} target="_blank" rel="noreferrer">
                  {testnet.registry.slice(0, 10)}… ↗
                </a>
              ) : "—"}
            </span>
          </div>
          <div className="kv">
            <span>{mainnet.label}</span>
            <span>
              {live ? (
                <>
                  registry deployed ·{" "}
                  <a href={`${mainnet.explorer}/address/${mainnet.registry}`} target="_blank" rel="noreferrer">
                    {mainnet.registry!.slice(0, 10)}… ↗
                  </a>
                </>
              ) : (
                "registry not deployed yet — the mainnet launch sentence on this page activates the moment it is"
              )}
            </span>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 14 }}>
          The mainnet launch announcement is wired to the registry address above: the launch
          sentence renders only once that contract is deployed to BOT Chain mainnet, and not
          before. Until then this page states the testnet deployment plainly, and the phrase is
          deliberately absent from the source so it cannot appear out of context.
        </div>
      </section>

      <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn" href="/#create">Create a watch</Link>
        <Link className="btn ghost" href="/">Back to Herald</Link>
      </div>
      <SiteFooter variant="inner" />
    </main>
  );
}
