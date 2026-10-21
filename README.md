# Herald

**Signed event webhooks for BOT Chain.**

Herald watches BOT Chain and delivers a signed HTTP webhook when something you care about
happens — a token transfer above a threshold, an approval, a native BOT movement, any call to a
contract. Every delivery carries an `HMAC-SHA256` signature so the receiver can prove it came
from Herald and was not replayed.

Herald is **read-only**. It holds no funds, takes no custody, and never signs on your behalf.
RPC in, HTTP out.

- Live: https://herald-zeta.vercel.app
- Health: https://herald-zeta.vercel.app/api/health

## Why

BOT Chain has an explorer and an RPC. What it does not have out of the box is *push*: a way for
a wallet, treasury, or agent to be told "this happened" without polling the chain.

Polling is the default way people solve this, and it is a bad deal — every consumer re-implements
log scanning, cursor management, reorg handling and retry, and then runs it forever. Herald does
that once, and hands you a verifiable payload instead.

## How it works

```
BOT Chain ──► Herald poller ──► rule match ──► HMAC-SHA256 sign ──► POST to your endpoint
   (RPC)         (cursor)                                          (retry + backoff)
```

1. You register a **rule** — what to watch, and where to deliver.
2. Herald polls the chain, keeping a block cursor per rule so nothing is silently skipped.
3. On a match it POSTs a payload and signs it. Non-2xx is retried with backoff; deliveries are
   never dropped silently.
4. You verify the `x-herald-signature` header against the secret shown once at creation.

### Payload

```json
{
  "id": "...",
  "chainId": 677,
  "block": 26816770,
  "txHash": "0x…",
  "logIndex": 0,
  "event": "NativeTransfer",
  "args": { "from": "0x…", "to": "0x…", "value": "1000000000000000000" },
  "token": { "address": "0x…", "symbol": "BOT", "decimals": 18 },
  "matchedRule": "...",
  "signature": "…"
}
```

## Rules you can register

| Rule | Watches |
|---|---|
| `Transfer` | ERC-20 / ERC-721 transfers, optionally filtered by contract |
| `Approval` | allowance granted |
| `ApprovalForAll` | operator approval |
| `TransferSingle` | ERC-1155 transfers |
| arbitrary `topic0` | any event signature |
| `NativeTransfer` | native BOT movements, by address and direction |
| `contract_call` | any call to a contract |

## On-chain registry

The public half of a watch lives in `HeraldRegistry`, so ownership is attributable without ever
putting a signing secret on-chain.

| Network | Chain ID | Registry |
|---|---|---|
| BOT Chain Testnet | 968 | `0x6FB73035c6C53f6BF22e8fD412e37850a746d1b6` |
| BOT Chain Mainnet | 677 | *pending* |

`contracts/src/HeraldRegistry.sol` — no funds, no fees, no custody: registering a watch costs gas
and nothing else.

```solidity
function register(uint256 chainId, address token, uint256 minValue, string calldata endpoint)
    external returns (uint256 id);
```

Endpoints are validated on-chain (absolute `https://`, bounded length) so the relay never
attempts a plaintext or oversized delivery.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Environment: `BOT_CHAIN_RPC_URL`, `NETLIFY_SITE_ID` / `NETLIFY_API_TOKEN` for durable storage.

## Layout

```
src/app/            routes — landing, /launch, watch console, API
src/components/     create-watch, live-feed, sub-console
src/lib/            chain, rules, store, registry, wallet
contracts/          HeraldRegistry.sol + foundry.toml + deployments.json
```

## Built on BOT Chain

- https://botchain.ai
- https://scan.botchain.ai
