import { signBody, newId } from "./sign";
import type { Delivery, DeliveryAttempt, Subscription } from "./rules";

const ATTEMPTS = 3;
const TIMEOUT_MS = 10_000;
const BACKOFF_MS = [0, 800, 2_500];

async function postOnce(url: string, body: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "follow",
    });
    return { status: response.status, ok: response.ok && response.status < 400, error: null as string | null, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      status: null as number | null,
      ok: false,
      error: error instanceof Error ? error.message : "request failed",
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Signs the exact bytes it sends, retries with backoff, and records every attempt. */
export async function deliver(sub: Subscription, payload: Record<string, unknown>): Promise<Delivery> {
  const body = JSON.stringify(payload);
  const signature = signBody(sub.secret, body);
  const deliveryId = newId("dlv");
  const eventName = String(payload.event ?? payload.type ?? "event");
  const headers = {
    "content-type": "application/json",
    "user-agent": "Herald/1.0 (+BOT Chain event webhooks)",
    "x-herald-signature": signature,
    "x-herald-event": eventName,
    "x-herald-delivery": deliveryId,
    "x-herald-subscription": sub.id,
  };

  const attempts: DeliveryAttempt[] = [];
  let ok = false;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    if (BACKOFF_MS[i]) await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    const result = await postOnce(sub.targetUrl, body, headers);
    attempts.push({ at: new Date().toISOString(), ...result });
    if (result.ok) {
      ok = true;
      break;
    }
    // 4xx (other than 408/429) will not succeed on retry
    if (result.status && result.status >= 400 && result.status < 500 && result.status !== 408 && result.status !== 429) break;
  }

  return {
    id: deliveryId,
    subscriptionId: sub.id,
    createdAt: new Date().toISOString(),
    event: eventName,
    blockNumber: Number(payload.block ?? 0),
    txHash: String(payload.txHash ?? ""),
    payload,
    attempts,
    ok,
  };
}
