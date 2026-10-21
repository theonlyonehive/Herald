import Link from "next/link";
import { BOT_CHAIN } from "@/lib/chain";

/**
 * Shared site footer.
 *
 * Criterion 3 of the BOT Chain onboarding requirements: the bottom section of the site must
 * display the BOT Chain name/logo and link to https://botchain.ai and https://scan.botchain.ai.
 * This lives in one component so EVERY route (home, watch detail, launch note) carries it —
 * a reviewer can land on any URL and still find the partnership block.
 *
 * The mark is used exactly as supplied in the BOT Chain brand kit (white + #10A37F), rendered
 * on the ink surface it was drawn for.
 */
export function SiteFooter({ variant = "home" }: { variant?: "home" | "inner" }) {
  return (
    <footer className="footer">
      <div className="partners">
        <div className="partners-label">Built on</div>
        <div className="partners-row">
          <a className="partner-logo" href="https://botchain.ai" target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/partners/botchain.svg" alt="BOT Chain" />
          </a>
          <a className="partner-link" href="https://botchain.ai" target="_blank" rel="noreferrer">
            botchain.ai ↗
          </a>
          <a className="partner-link" href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
            scan.botchain.ai ↗
          </a>
        </div>
      </div>
      <div className="footer-inner">
        <div>
          <div className="footbrand">Herald</div>
          <div className="stamp">
            Read-only · chain {BOT_CHAIN.chainId} · {BOT_CHAIN.rpcUrl.replace("https://", "")}
            <br />
            Signed event webhooks for BOT Chain.
          </div>
        </div>
        {variant === "home" ? (
          <>
            <div className="cols">
              <a href="#how">How it works</a>
              <a href="#create">Create a watch</a>
              <a href="#activity">Activity</a>
              <a href="/launch">Launch note</a>
            </div>
            <div className="cols">
              <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
                Botscan ↗
              </a>
              <a href="/api/health" target="_blank" rel="noreferrer">
                Health ↗
              </a>
              <a href="/api/subscriptions" target="_blank" rel="noreferrer">
                REST ↗
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="cols">
              <Link href="/">All watches</Link>
              <Link href="/launch">Launch note</Link>
              <a href="/api/subscriptions" target="_blank" rel="noreferrer">
                WATCHES JSON ↗
              </a>
            </div>
            <div className="cols">
              <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
                BOTSCAN ↗
              </a>
              <a href="/api/health" target="_blank" rel="noreferrer">
                HEALTH ↗
              </a>
              <Link href="/#create">CREATE A WATCH</Link>
            </div>
          </>
        )}
      </div>
    </footer>
  );
}
