export const BOT_CHAIN = {
  name: "BOT Chain",
  chainId: 677,
  rpcUrl: process.env.BOT_CHAIN_RPC_URL ?? "https://rpc.botchain.ai",
  explorer: "https://scan.botchain.ai",
  gasFloorWei: 20_000_000_000n,
} as const;

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  removed?: boolean;
}

export interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value?: string;
  input?: string;
  nonce?: number;
  blockNumber?: string;
}

export interface RpcBlock {
  number: string;
  timestamp: string;
  transactions: RpcTx[];
}

let id = 0;

export async function rpc<T>(method: string, params: unknown[] = [], timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(BOT_CHAIN.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = (await response.json()) as { result?: T; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message ?? "RPC error");
    return body.result as T;
  } finally {
    clearTimeout(timer);
  }
}

export function hexToNumber(hex: string | undefined | null): number {
  if (!hex) return 0;
  return Number.parseInt(hex, 16);
}

export async function getHeadBlock(): Promise<number> {
  return hexToNumber(await rpc<string>("eth_blockNumber"));
}

export async function getLogs(params: {
  fromBlock: number;
  toBlock: number;
  address?: string;
  topics?: (string | null)[];
}): Promise<RpcLog[]> {
  const filter: Record<string, unknown> = {
    fromBlock: `0x${params.fromBlock.toString(16)}`,
    toBlock: `0x${params.toBlock.toString(16)}`,
  };
  if (params.address) filter.address = params.address;
  if (params.topics) filter.topics = params.topics;
  return (await rpc<RpcLog[]>("eth_getLogs", [filter], 20_000)) ?? [];
}

export async function getBlockWithTxs(block: number): Promise<RpcBlock | null> {
  return rpc<RpcBlock | null>("eth_getBlockByNumber", [`0x${block.toString(16)}`, true]);
}

export async function getBlock(block: number): Promise<RpcBlock | null> {
  return rpc<RpcBlock | null>("eth_getBlockByNumber", [`0x${block.toString(16)}`, false]);
}

export function explorerTx(hash: string) {
  return `${BOT_CHAIN.explorer}/tx/${hash}`;
}

export function short(address?: string | null, size = 4) {
  if (!address) return "—";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}
