import { NextResponse } from "next/server";
import { listSubscriptions, saveSubscription, getSubscription } from "@/lib/store";
import { getHeadBlock } from "@/lib/chain";
import { TOPICS } from "@/lib/events";
import { newSecret, newId } from "@/lib/sign";
import { type Subscription, type Rule, normaliseAddress, isHexTopic } from "@/lib/rules";
import { publicView } from "@/lib/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMED: Record<string, string> = {
  transfer: TOPICS.transfer,
  approval: TOPICS.approval,
  approvalForAll: TOPICS.approvalForAll,
  transferSingle: TOPICS.transferSingle,
};

export async function GET() {
  const subs = await listSubscriptions();
  return NextResponse.json({ ok: true, subscriptions: subs.map(publicView) });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const label = String(body.label ?? "").trim() || "Untitled watch";
  const targetUrl = String(body.targetUrl ?? "").trim();
  const kind = String(body.kind ?? "event") as Rule["kind"];

  if (!/^https?:\/\/.+/i.test(targetUrl)) {
    return NextResponse.json({ ok: false, error: "Target URL must start with http:// or https://" }, { status: 400 });
  }
  if (!["event", "native_transfer", "contract_call"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "Unknown rule kind." }, { status: 400 });
  }

  const contractAddress = normaliseAddress(body.contractAddress as string | null);
  const watchedAddress = normaliseAddress(body.watchedAddress as string | null);
  let topic0: string | null = null;

  if (kind === "event") {
    const raw = String(body.topic0 ?? "").trim();
    topic0 = NAMED[raw] ?? (isHexTopic(raw) ? raw.toLowerCase() : null);
    if (!topic0) {
      return NextResponse.json(
        { ok: false, error: "Pick a named event or paste a 32-byte topic0 hash.", namedEvents: Object.keys(NAMED) },
        { status: 400 },
      );
    }
    if (body.contractAddress && !contractAddress) {
      return NextResponse.json({ ok: false, error: "contractAddress must be a 20-byte hex address." }, { status: 400 });
    }
  }

  if (kind === "native_transfer") {
    if (!watchedAddress) {
      return NextResponse.json({ ok: false, error: "watchedAddress must be a 20-byte hex address." }, { status: 400 });
    }
  }

  if (kind === "contract_call" && !contractAddress) {
    return NextResponse.json({ ok: false, error: "contractAddress must be a 20-byte hex address." }, { status: 400 });
  }

  let head = 0;
  try {
    head = await getHeadBlock();
  } catch {
    return NextResponse.json({ ok: false, error: "BOT Chain RPC is not reachable right now." }, { status: 503 });
  }

  const backfill = Math.max(0, Math.min(5000, Number(body.backfillBlocks ?? 0) || 0));

  const rule: Rule = {
    kind,
    contractAddress: kind === "event" ? contractAddress : contractAddress,
    topic0,
    direction: (["to", "from", "any"].includes(String(body.direction)) ? String(body.direction) : "any") as Rule["direction"],
    watchedAddress,
    minValue: body.minValue ? String(body.minValue) : null,
  };

  const sub: Subscription = {
    id: newId("sub"),
    label,
    targetUrl,
    secret: newSecret(),
    rule,
    active: true,
    cursorBlock: Math.max(0, head - backfill),
    createdAt: new Date().toISOString(),
    lastTickAt: null,
    delivered: 0,
    failed: 0,
  };

  await saveSubscription(sub);
  const stored = await getSubscription(sub.id);
  return NextResponse.json({ ok: true, subscription: publicView(stored ?? sub), secret: sub.secret }, { status: 201 });
}
