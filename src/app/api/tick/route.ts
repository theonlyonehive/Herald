import { NextResponse } from "next/server";
import { tick } from "@/lib/poller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The scheduled Netlify function calls this. It is also safe to drive manually. */
export async function POST(request: Request) {
  const token = process.env.HERALD_TICK_TOKEN;
  if (token) {
    const url = new URL(request.url);
    const provided = request.headers.get("x-herald-token") ?? url.searchParams.get("token");
    if (provided !== token) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
  }
  try {
    const result = await tick();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "tick failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST /api/tick to advance every active subscription to the chain head.",
    schedule: "A Netlify scheduled function calls this every minute.",
  });
}
