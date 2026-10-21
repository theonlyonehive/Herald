# BOT Chain submission package — Herald

## Project

**Name:** Herald
**Tagline:** Stop polling. Start listening.
**Network:** BOT Chain mainnet, chain ID 677
**Track:** Infrastructure / developer tooling / agent-native services

## Description

Herald is a public webhook service for BOT Chain. A developer registers a watch — an ERC-20 or ERC-721
`Transfer`, an `Approval`, an arbitrary 32-byte `topic0`, a native BOT transfer, or any call to a contract —
and supplies an HTTPS endpoint. Herald scans BOT Chain blocks against that rule with a persisted cursor and
POSTs a signed JSON payload the moment it matches.

The payload carries the block number, transaction hash, log index, the decoded event arguments, the rule that
matched and an explorer link. Every request is signed with HMAC-SHA256 over the exact bytes sent
(`x-herald-signature`), so the receiver can prove it came from Herald and only Herald. Failed deliveries retry
with backoff and every attempt is recorded on the watch console. A watch can be paused, resumed, or replayed
from any block.

Herald exists because every team building on BOT Chain that wants to react to on-chain activity writes the
same poller — block cursor, reorg handling, retries, deduplication and signature verification — before they
write a line of their actual product. That plumbing is identical for everyone and is currently offered by
nobody in the ecosystem.

## Evidence

- Watch console: every delivery, its HTTP result, latency and attempt count
- HMAC verification: 11/11 signatures independently recomputed against the exact received bytes
- Live data verified against BOT Chain directly: a delivered `Transfer` payload matches the raw
  `eth_getTransactionReceipt` log (address, topic0, from, to, value `15119098205496109056`)
- Observed throughput during testing: 100 matched events delivered with 0 failures in one scan pass

## How it uses BOT Chain

Herald is locked to chain ID 677 and reads it read-only over the public RPC:

- `eth_blockNumber` for the chain head
- `eth_getLogs` with address + topic filters for event watches
- `eth_getBlockByNumber` (full transactions) for native transfer and contract-call watches

Herald never submits a transaction, never holds a key and never takes custody. Delivery is outbound HTTPS only.

## Why it belongs in the directory

`/en/project-party` was re-pulled and searched: 618 projects, of which **one** mentions webhook-style event
subscription. Chain RPC/gateway, status pages, contract decoding, indexing and dev CLI tooling all have
occupants. On-chain event webhooks are an unoccupied primitive, and the service is cheap to run on BOT Chain
specifically because the chain produces roughly one transaction per block.

## Demo outline (3 minutes)

1. **0:00–0:25 — Problem:** reacting to on-chain activity means running your own poller.
2. **0:25–0:55 — Product:** open Herald, explain the three moving parts.
3. **0:55–1:25 — Create a watch:** ERC-20 `Transfer`, paste a webhook URL, copy the signing secret.
4. **1:25–1:55 — First delivery:** run a tick, watch real BOT Chain transfers land in the ledger.
5. **1:55–2:25 — Proof:** open the payload, show the signature, recompute the HMAC live.
6. **2:25–2:45 — Recovery:** show retries on a failing endpoint and replay from an earlier block.
7. **2:45–3:00 — Limits and roadmap:** no trace namespace on the public RPC; what comes next.

## Form-ready answers

### Project overview (100–300 words)

BOT Chain developers who want to react to on-chain activity must first build infrastructure: a block cursor,
reorg handling, retries, deduplication and payload signing. Every team writes the same poller before writing
its actual product.

Herald provides that layer as a service. A developer registers a watch against any address, event or contract
on BOT Chain and supplies an HTTPS endpoint. Herald scans blocks with a persisted cursor and delivers a signed
POST the moment the rule matches: block, transaction hash, log index, decoded arguments, matched rule and an
explorer link. Requests carry an HMAC-SHA256 signature over the exact bytes sent, so the receiver can verify
provenance. Failures retry with backoff, every attempt is visible on the watch console, and any watch can be
paused, resumed or replayed from an earlier block.

Herald is read-only over the public RPC. It never signs, submits or holds funds. It is deliberately scoped to
what BOT Chain's RPC can answer truthfully, and states its limits in the product itself: with no `debug` or
`trace` namespace, internal value movement inside a contract call cannot be reported, and unrecognised logs
are shown raw rather than guessed.

### BOT Chain integration

Herald is fixed to chain ID 677 and reads `eth_blockNumber`, `eth_getLogs` (address + topic filters) and
`eth_getBlockByNumber` with full transactions. It performs no writes and requires no key or wallet.

### Post-challenge roadmap

1. Filter expressions beyond a single topic0 (multi-topic and indexed-argument matching).
2. Optional public dashboards per watch so delivery history can be linked from a project page.
3. Batching and a digest option for high-volume watches.
4. Webhook retry policies per watch and a dead-letter view.

## Outstanding before submitting

- [ ] Replace the temporary tunnel URL with a permanent host (Netlify deploys are blocked by an account
      credit limit — see below)
- [ ] Record the walkthrough video
- [ ] Submit through the official portal (Google Form linked from `/en/project-party`)

> **Deployment note.** Netlify rejected the final deploy with
> `{"error":"Account credit usage exceeded - new deploys are blocked until credits are added"}` (HTTP 403).
> A complete static-UI + Netlify Functions build of Herald is prepared under `netlify/` and redeploys in
> about two minutes once the account is back in credit.
