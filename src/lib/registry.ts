/**
 * Herald registry — the on-chain half of a watch.
 *
 * Off-chain Herald stores the HMAC secret and runs the delivery worker. The registry
 * on-chain stores the PUBLIC part: who owns the watch, what it observes, and where it
 * delivers. The signing secret is deliberately never written on-chain.
 */

export type NetId = 968 | 677;

export interface NetDef {
  chainId: NetId;
  label: string;
  short: string;
  rpcUrl: string;
  explorer: string;
  testnet: boolean;
  /** Registry address, or null when the registry is not deployed on that network yet. */
  registry: string | null;
}

export const NETS: Record<NetId, NetDef> = {
  968: {
    chainId: 968,
    label: "BOT Chain Testnet",
    short: "testnet",
    rpcUrl: "https://rpc.bohr.life",
    explorer: "https://scan.bohr.life",
    testnet: true,
    registry: "0x6FB73035c6C53f6BF22e8fD412e37850a746d1b6",
  },
  677: {
    chainId: 677,
    label: "BOT Chain Mainnet",
    short: "mainnet",
    rpcUrl: "https://rpc.botchain.ai",
    explorer: "https://scan.botchain.ai",
    testnet: false,
    registry: null, // deployed after testnet sign-off
  },
};

export const DEFAULT_NET: NetId = 968;

/** Minimal ABI — only what the browser actually calls. */
export const REGISTRY_ABI = [
  "function register(uint256 chainId, address token, uint256 minValue, string endpoint) returns (uint256)",
  "function updateRule(uint256 id, address token, uint256 minValue)",
  "function setEndpoint(uint256 id, string endpoint)",
  "function setActive(uint256 id, bool active)",
  "function watchCount() view returns (uint256)",
  "function watchesOf(address owner) view returns (uint256[])",
  "function getWatch(uint256 id) view returns (tuple(address owner, uint256 chainId, address token, uint256 minValue, string endpoint, bool active, uint64 createdAt, uint64 updatedAt))",
  "event WatchRegistered(uint256 indexed id, address indexed owner, uint256 chainId, address token, uint256 minValue, string endpoint)",
] as const;

/** Canonical EIP-1193 parameters for wallet_addEthereumChain. */
export function addChainParams(n: NetId) {
  const d = NETS[n];
  return [{
    chainId: "0x" + n.toString(16),
    chainName: d.label,
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrls: [d.rpcUrl],
    blockExplorerUrls: [d.explorer],
  }];
}

export const NATIVE = "0x0000000000000000000000000000000000000000";
