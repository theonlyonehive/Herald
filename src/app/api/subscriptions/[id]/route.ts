import { NextResponse } from "next/server";
import { getSubscription, listDeliveries, saveSubscription } from "@/lib/store";
import { getHeadBlock } from "@/lib/chain";
import { publicView } from "@/lib/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await getSubscription(id);
  if (!sub) return NextResponse.json({ ok: false, error: "Subscription not found." }, { status: 404 });
  const deliveries = await listDeliveries(id, 40);
  let head = 0;
  try {
    head = await getHeadBlock();
  } catch {
    /* head is informational */
  }
  return NextResponse.json({ ok: true, subscription: publicView(sub), deliveries, head });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await getSubscription(id);
  if (!sub) return NextResponse.json({ ok: false, error: "Subscription not found." }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* default action */
  }
  const action = String(body.action ?? "");

  if (action === "pause") sub.active = false;
  else if (action === "resume") sub.active = true;
  else if (action === "replay") {
    const from = Number(body.fromBlock ?? 0);
    if (!Number.isFinite(from) || from < 0) {
      return NextResponse.json({ ok: false, error: "fromBlock must be a positive block number." }, { status: 400 });
    }
    // cursor sits one block behind, so the next tick rescans from `from`
    sub.cursorBlock = Math.max(0, Math.floor(from) - 1);
    sub.active = true;
  } else if (action !== "refresh") {
    return NextResponse.json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
  }

  await saveSubscription(sub);
  return NextResponse.json({ ok: true, subscription: publicView(sub) });
}
