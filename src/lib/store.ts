import { promises as fs } from "node:fs";
import path from "node:path";
import type { Delivery, Subscription } from "./rules";

const LOCAL_DIR = path.join(process.cwd(), ".data");
/** Explicit Blobs credentials let us persist from any host — not only when running on Netlify. */
const BLOBS_SITE = process.env.NETLIFY_SITE_ID;
const BLOBS_TOKEN = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_TOKEN;
const BLOBS_MANUAL = Boolean(BLOBS_SITE && BLOBS_TOKEN);
const BLOBS =
  !process.env.HERALD_FORCE_LOCAL &&
  (process.env.NETLIFY === "true" || process.env.HERALD_BLOBS === "1" || BLOBS_MANUAL);

interface KeyValueStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/** Netlify Blobs in production (durable, shared); a local JSON directory for development. */
async function kv(): Promise<KeyValueStore> {
  if (BLOBS) {
    const { getStore } = await import("@netlify/blobs");
    const store = BLOBS_MANUAL
      ? getStore({ name: "herald", consistency: "strong", siteID: BLOBS_SITE, token: BLOBS_TOKEN })
      : getStore({ name: "herald", consistency: "strong" });
    return {
      async get(key) {
        return (await store.get(key, { type: "json" })) ?? null;
      },
      async set(key, value) {
        await store.setJSON(key, value as object);
      },
      async list(prefix) {
        const out = await store.list({ prefix });
        return out.blobs.map((b) => b.key);
      },
    };
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const file = (key: string) => path.join(LOCAL_DIR, `${key.replace(/[^a-zA-Z0-9._/-]/g, "_")}.json`);
  return {
    async get(key) {
      try {
        return JSON.parse(await fs.readFile(file(key), "utf8"));
      } catch {
        return null;
      }
    },
    async set(key, value) {
      const target = file(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(value, null, 2), "utf8");
    },
    async list(prefix) {
      try {
        const walk = async (dir: string, rel: string): Promise<string[]> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const out: string[] = [];
          for (const entry of entries) {
            const next = path.join(dir, entry.name);
            const key = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) out.push(...(await walk(next, key)));
            else if (entry.name.endsWith(".json")) out.push(key.slice(0, -5));
          }
          return out;
        };
        return (await walk(LOCAL_DIR, "")).filter((k) => k.startsWith(prefix));
      } catch {
        return [];
      }
    },
  };
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const store = await kv();
  const keys = await store.list("sub/");
  const subs = await Promise.all(keys.map((k) => store.get(k) as Promise<Subscription | null>));
  return subs.filter((s): s is Subscription => Boolean(s)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  const store = await kv();
  return (await store.get(`sub/${id}`)) as Subscription | null;
}

export async function saveSubscription(sub: Subscription): Promise<void> {
  const store = await kv();
  await store.set(`sub/${sub.id}`, sub);
}

export async function appendDelivery(delivery: Delivery): Promise<void> {
  const store = await kv();
  await store.set(`dlv/${delivery.subscriptionId}/${delivery.createdAt}_${delivery.id}`, delivery);
}

export async function listDeliveries(subscriptionId: string, limit = 40): Promise<Delivery[]> {
  const store = await kv();
  const keys = (await store.list(`dlv/${subscriptionId}/`)).sort().reverse().slice(0, limit);
  const items = await Promise.all(keys.map((k) => store.get(k) as Promise<Delivery | null>));
  return items.filter((d): d is Delivery => Boolean(d));
}

export async function listRecentDeliveries(limit = 25): Promise<Delivery[]> {
  const store = await kv();
  const keys = (await store.list("dlv/")).sort().reverse().slice(0, limit);
  const items = await Promise.all(keys.map((k) => store.get(k) as Promise<Delivery | null>));
  return items.filter((d): d is Delivery => Boolean(d));
}

export async function backendName(): Promise<string> {
  return BLOBS ? "netlify-blobs" : "local-files";
}
