"use client";

/**
 * BotChainWallet — EIP-1193 connection to BOT Chain.
 *
 * Deliberately minimal: we ask the injected wallet for accounts, put it on the right
 * chain, and send ONE transaction type — register a watch in the Herald registry.
 * Herald never holds funds, never signs for the user, and never asks for a private key.
 */

import { useCallback, useEffect, useState } from "react";
import { JsonRpcProvider, BrowserProvider, Contract } from "ethers";
import { NETS, REGISTRY_ABI, addChainParams, type NetId } from "./registry";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (ev: string, cb: (...a: any[]) => void) => void;
  removeListener?: (ev: string, cb: (...a: any[]) => void) => void;
};

function injected(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: Eip1193 };
  return w.ethereum ?? null;
}

export function useBotChainWallet(net: NetId) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  const refresh = useCallback(async () => {
    const eth = injected();
    setAvailable(!!eth);
    if (!eth) return;
    try {
      const accts = (await eth.request({ method: "eth_accounts" })) as string[];
      setAccount(accts?.[0] ?? null);
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(cid, 16));
    } catch { /* wallet locked — treat as disconnected */ }
  }, []);

  useEffect(() => {
    refresh();
    const eth = injected();
    if (!eth?.on) return;
    const onAcc = (...a: any[]) => setAccount((a[0] as string[])?.[0] ?? null);
    const onChain = (...a: any[]) => setChainId(parseInt(String(a[0]), 16));
    eth.on("accountsChanged", onAcc);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAcc);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    const eth = injected();
    if (!eth) { setError("No BOT Chain wallet found. Install a browser wallet that supports custom networks."); return; }
    setBusy(true);
    try {
      const accts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accts?.[0] ?? null);
    } catch (e: any) {
      setError(e?.code === 4001 ? "Connection request was rejected." : (e?.message ?? "Could not connect."));
    } finally { setBusy(false); }
  }, []);

  const disconnect = useCallback(() => { setAccount(null); setError(null); }, []);

  /** Put the wallet on BOT Chain `n`, adding the network if the wallet doesn't know it. */
  const ensureChain = useCallback(async (n: NetId) => {
    const eth = injected();
    if (!eth) throw new Error("No wallet available.");
    const hex = "0x" + n.toString(16);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e: any) {
      // 4902 = unrecognised chain, 32603 = some wallets wrap it
      if (e?.code === 4902 || e?.code === 32603) {
        await eth.request({ method: "wallet_addEthereumChain", params: addChainParams(n) });
      } else if (e?.code === 4001) {
        throw new Error("Network switch was rejected.");
      } else {
        throw new Error(e?.message ?? "Could not switch network.");
      }
    }
    setChainId(n);
  }, []);

  /**
   * Register a watch in the on-chain registry for `net`. Returns the new watch id + tx hash.
   * Creates the network first if the wallet isn't already on it.
   */
  const registerOnChain = useCallback(async (args: { token?: string; minValueWei?: bigint; endpoint: string; }) => {
    const eth = injected();
    const def = NETS[net];
    if (!eth) throw new Error("Connect a wallet first.");
    if (!def.registry) throw new Error(`The Herald registry is not deployed on ${def.label} yet.`);
    if (!account) throw new Error("Connect a wallet first.");

    const cur = parseInt((await eth.request({ method: "eth_chainId" })) as string, 16);
    if (cur !== net) await ensureChain(net);

    const provider = new BrowserProvider(eth as any);
    const signer = await provider.getSigner();
    const c = new Contract(def.registry, REGISTRY_ABI as unknown as string[], signer);
    const tx = await c.register(
      net,
      args.token ?? "0x0000000000000000000000000000000000000000",
      args.minValueWei ?? 0n,
      args.endpoint,
    );
    const rc = await tx.wait();
    const id: bigint = await c.watchCount();
    return { id: id.toString(), txHash: rc?.hash ?? tx.hash, block: rc?.blockNumber ?? 0, explorer: def.explorer };
  }, [account, net, ensureChain]);

  /** Reads the registry with a plain RPC provider — works without a wallet. */
  const readWatch = useCallback(async (id: string) => {
    const def = NETS[net];
    if (!def.registry) return null;
    const p = new JsonRpcProvider(def.rpcUrl, net);
    const c = new Contract(def.registry, REGISTRY_ABI as unknown as string[], p);
    const v = await c.getWatch(id);
    return {
      owner: v.owner as string,
      chainId: Number(v.chainId),
      token: v.token as string,
      minValue: v.minValue as bigint,
      endpoint: v.endpoint as string,
      active: v.active as boolean,
      createdAt: Number(v.createdAt),
    };
  }, [net]);

  const onRightChain = chainId === net;

  return { available, account, chainId, onRightChain, busy, error, connect, disconnect, ensureChain, registerOnChain, readWatch };
}
