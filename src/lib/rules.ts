export type RuleKind = "event" | "native_transfer" | "contract_call";
export type Direction = "to" | "from" | "any";

export interface Rule {
  kind: RuleKind;
  /** For kind=event: the contract address to listen to (optional = any contract). */
  contractAddress?: string | null;
  /** For kind=event: topic0 to match. */
  topic0?: string | null;
  /** For transfer rules: which side of the movement to match. */
  direction?: Direction;
  /** For transfer rules: the counterparty address. */
  watchedAddress?: string | null;
  /** Minimum native value in wei for native_transfer / minimum token value for event transfers. */
  minValue?: string | null;
}

export interface Subscription {
  id: string;
  label: string;
  targetUrl: string;
  secret: string;
  rule: Rule;
  active: boolean;
  cursorBlock: number;
  createdAt: string;
  lastTickAt?: string | null;
  delivered: number;
  failed: number;
}

export interface DeliveryAttempt {
  at: string;
  status: number | null;
  ok: boolean;
  error?: string | null;
  latencyMs: number;
}

export interface Delivery {
  id: string;
  subscriptionId: string;
  createdAt: string;
  event: string;
  blockNumber: number;
  txHash: string;
  payload: Record<string, unknown>;
  attempts: DeliveryAttempt[];
  ok: boolean;
}

export function isHexAddress(value: string | undefined | null): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function isHexTopic(value: string | undefined | null): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export function normaliseAddress(value: string | undefined | null): string | null {
  return isHexAddress(value) ? (value as string).trim().toLowerCase() : null;
}

/** Human-readable summary of what a watch is listening for. */
export function describeRule(sub: Pick<Subscription, "rule">): string {
  const r = sub.rule;
  if (r.kind === "event") {
    return `event ${r.topic0 ? r.topic0.slice(0, 10) : "any"}${r.contractAddress ? ` on ${r.contractAddress}` : " on any contract"}`;
  }
  if (r.kind === "contract_call") return `call to ${r.contractAddress ?? "any contract"}`;
  return `native ${r.direction ?? "any"} ${r.watchedAddress ?? "any address"}`;
}
