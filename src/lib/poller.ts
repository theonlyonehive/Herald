import { getBlockWithTxs, getHeadBlock, getLogs, hexToNumber, explorerTx, type RpcLog } from "./chain";
import { decodeLog } from "./events";
import { deliver } from "./deliver";
import { appendDelivery, listSubscriptions, saveSubscription } from "./store";
import type { Subscription } from "./rules";
import { describeRule } from "./rules";

const MAX_BLOCKS_PER_TICK = 300;
const MAX_MATCHES_PER_SUB_PER_TICK = 25;

export interface TickResult {
  head: number;
  subscriptions: number;
  scanned: number;
  matched: number;
  delivered: number;
  failed: number;
  perSubscription: { id: string; label: string; from: number; to: number; matches: number; delivered: number; failed: number }[];
  notes: string[];
}

function toWeiString(value: string | undefined): bigint {
  try {
    return BigInt(value ?? "0");
  } catch {
    return 0n;
  }
}

function matchesRule(sub: Subscription, decodedName: string | null, args: Record<string, string>): boolean {
  const rule = sub.rule;
  const watched = (rule.watchedAddress ?? "").toLowerCase();
  if (rule.direction && rule.direction !== "any" && watched) {
    const key = decodedName === "TransferSingle" ? (rule.direction === "to" ? "to" : "from") : rule.direction;
    const actual = (args[key] ?? "").toLowerCase();
    if (actual !== watched) return false;
  }
  if (rule.minValue) {
    const min = toWeiString(rule.minValue);
    if (min > 0n) {
      const raw = args.value ?? "0";
      try {
        if (BigInt(raw) < min) return false;
      } catch {
        return false;
      }
    }
  }
  return true;
}

async function matchesForSubscription(sub: Subscription, from: number, to: number) {
  const matches: { log?: RpcLog; txHash: string; blockNumber: number; event: string; args: Record<string, string>; contract?: string; from?: string | null; to?: string | null; value?: string }[] = [];

  if (sub.rule.kind === "event") {
    const logs = await getLogs({
      fromBlock: from,
      toBlock: to,
      address: sub.rule.contractAddress ?? undefined,
      topics: [sub.rule.topic0 ?? null],
    });
    for (const log of logs) {
      const decoded = decodeLog(log);
      if (sub.rule.topic0 && decoded.topic0 !== sub.rule.topic0.toLowerCase()) continue;
      if (!matchesRule(sub, decoded.name, decoded.args)) continue;
      matches.push({
        log,
        txHash: log.transactionHash,
        blockNumber: hexToNumber(log.blockNumber),
        event: decoded.name ?? `topic ${decoded.topic0.slice(0, 10)}`,
        args: decoded.args,
        contract: log.address,
        from: decoded.args.from ?? decoded.args.owner ?? null,
        to: decoded.args.to ?? decoded.args.spender ?? null,
        value: decoded.args.value,
      });
      if (matches.length >= MAX_MATCHES_PER_SUB_PER_TICK) break;
    }
    return matches;
  }

  // native_transfer / contract_call need full transactions
  for (let block = from; block <= to && matches.length < MAX_MATCHES_PER_SUB_PER_TICK; block += 1) {
    const full = await getBlockWithTxs(block);
    if (!full?.transactions) continue;
    for (const tx of full.transactions) {
      const value = toWeiString(tx.value);
      const watched = (sub.rule.watchedAddress ?? "").toLowerCase();
      const fromAddr = (tx.from ?? "").toLowerCase();
      const toAddr = (tx.to ?? "").toLowerCase();

      if (sub.rule.kind === "contract_call") {
        if (sub.rule.contractAddress && toAddr !== sub.rule.contractAddress.toLowerCase()) continue;
        if (!tx.input || tx.input === "0x") continue;
      } else {
        if (sub.rule.direction === "to" && watched && toAddr !== watched) continue;
        if (sub.rule.direction === "from" && watched && fromAddr !== watched) continue;
        if (sub.rule.direction === "any" && watched && fromAddr !== watched && toAddr !== watched) continue;
        if (sub.rule.minValue && value < toWeiString(sub.rule.minValue)) continue;
        if (value === 0n && sub.rule.kind === "native_transfer") continue;
      }

      matches.push({
        txHash: tx.hash,
        blockNumber: block,
        event: sub.rule.kind === "contract_call" ? "ContractCall" : "NativeTransfer",
        args: { from: tx.from, to: tx.to ?? "contract creation", value: value.toString() },
        from: tx.from,
        to: tx.to,
        value: value.toString(),
      });
      if (matches.length >= MAX_MATCHES_PER_SUB_PER_TICK) break;
    }
  }
  return matches;
}

export async function tick(onlySubscriptionId?: string): Promise<TickResult> {
  const notes: string[] = [];
  const head = await getHeadBlock();
  let subs = await listSubscriptions();
  if (onlySubscriptionId) subs = subs.filter((s) => s.id === onlySubscriptionId);

  const result: TickResult = { head, subscriptions: subs.length, scanned: 0, matched: 0, delivered: 0, failed: 0, perSubscription: [], notes };

  for (const sub of subs) {
    const entry = { id: sub.id, label: sub.label, from: 0, to: 0, matches: 0, delivered: 0, failed: 0 };
    if (!sub.active) {
      result.perSubscription.push(entry);
      continue;
    }
    const from = sub.cursorBlock + 1;
    if (from > head) {
      sub.lastTickAt = new Date().toISOString();
      await saveSubscription(sub);
      result.perSubscription.push(entry);
      continue;
    }
    const to = Math.min(head, from + MAX_BLOCKS_PER_TICK - 1);
    entry.from = from;
    entry.to = to;
    result.scanned += to - from + 1;

    let matches: Awaited<ReturnType<typeof matchesForSubscription>> = [];
    try {
      matches = await matchesForSubscription(sub, from, to);
    } catch (error) {
      notes.push(`${sub.id}: scan failed — ${error instanceof Error ? error.message : "unknown error"}`);
      result.perSubscription.push(entry);
      continue;
    }

    for (const match of matches) {
      result.matched += 1;
      entry.matches += 1;
      const payload = {
        id: match.txHash ? `${match.txHash}:${match.log?.logIndex ?? "0"}` : match.txHash,
        type: sub.rule.kind,
        chainId: 677,
        block: match.blockNumber,
        txHash: match.txHash,
        logIndex: match.log ? hexToNumber(match.log.logIndex) : null,
        contract: match.contract ?? null,
        event: match.event,
        args: match.args,
        from: match.from ?? null,
        to: match.to ?? null,
        value: match.value ?? null,
        matchedRule: describeRule(sub),
        explorer: explorerTx(match.txHash),
      };
      const delivery = await deliver(sub, payload);
      await appendDelivery(delivery);
      if (delivery.ok) {
        sub.delivered += 1;
        result.delivered += 1;
        entry.delivered += 1;
      } else {
        sub.failed += 1;
        result.failed += 1;
        entry.failed += 1;
      }
    }

    sub.cursorBlock = to;
    sub.lastTickAt = new Date().toISOString();
    await saveSubscription(sub);
    result.perSubscription.push(entry);
  }

  return result;
}
