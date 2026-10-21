import { NextResponse } from "next/server";
import { listRecentDeliveries, backendName } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const deliveries = await listRecentDeliveries(25);
  return NextResponse.json({ ok: true, backend: await backendName(), deliveries });
}
