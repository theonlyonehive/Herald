import { NextResponse } from "next/server";
import { getHeadBlock, BOT_CHAIN } from "@/lib/chain";
import { backendName, listSubscriptions } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let head: number | null = null;
  let rpcOk = true;
  try {
    head = await getHeadBlock();
  } catch {
    rpcOk = false;
  }
  const subs = await listSubscriptions();
  return NextResponse.json({
    ok: rpcOk,
    service: "Herald",
    chain: { name: BOT_CHAIN.name, chainId: BOT_CHAIN.chainId, rpc: BOT_CHAIN.rpcUrl, head },
    store: await backendName(),
    subscriptions: subs.length,
    active: subs.filter((s) => s.active).length,
    at: new Date().toISOString(),
  });
}
