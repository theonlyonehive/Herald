import type { RpcLog } from "./chain";

/** topic0 values, computed once and pinned (no runtime keccak needed). */
export const TOPICS = {
  transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  approval: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  approvalForAll: "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31",
  transferSingle: "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
} as const;

export const NAMED_EVENTS: { key: string; label: string; topic0: string }[] = [
  { key: "transfer", label: "ERC-20 / ERC-721 Transfer", topic0: TOPICS.transfer },
  { key: "approval", label: "Approval", topic0: TOPICS.approval },
  { key: "approvalForAll", label: "ApprovalForAll", topic0: TOPICS.approvalForAll },
  { key: "transferSingle", label: "ERC-1155 TransferSingle", topic0: TOPICS.transferSingle },
];

export interface DecodedLog {
  name: string | null;
  args: Record<string, string>;
  topic0: string;
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40)}`;
}

/** Decodes only the events we ship signatures for. Anything else is returned raw — never guessed. */
export function decodeLog(log: RpcLog): DecodedLog {
  const topic0 = (log.topics[0] ?? "").toLowerCase();
  const t = log.topics;
  const data = log.data ?? "0x";
  try {
    switch (topic0) {
      case TOPICS.transfer:
        return {
          name: "Transfer",
          topic0,
          args: {
            from: topicToAddress(t[1] ?? "0x0"),
            to: topicToAddress(t[2] ?? "0x0"),
            value: hexToBigInt(data).toString(),
          },
        };
      case TOPICS.approval:
        return {
          name: "Approval",
          topic0,
          args: {
            owner: topicToAddress(t[1] ?? "0x0"),
            spender: topicToAddress(t[2] ?? "0x0"),
            value: hexToBigInt(data).toString(),
          },
        };
      case TOPICS.approvalForAll:
        return {
          name: "ApprovalForAll",
          topic0,
          args: {
            owner: topicToAddress(t[1] ?? "0x0"),
            operator: topicToAddress(t[2] ?? "0x0"),
            approved: hexToBigInt(data) !== 0n ? "true" : "false",
          },
        };
      case TOPICS.transferSingle: {
        const raw = data.startsWith("0x") ? data.slice(2) : data;
        const idHex = `0x${raw.slice(0, 64)}`;
        const valueHex = `0x${raw.slice(64, 128)}`;
        return {
          name: "TransferSingle",
          topic0,
          args: {
            operator: topicToAddress(t[1] ?? "0x0"),
            from: topicToAddress(t[2] ?? "0x0"),
            to: topicToAddress(t[3] ?? "0x0"),
            id: hexToBigInt(idHex || "0x").toString(),
            value: hexToBigInt(valueHex || "0x").toString(),
          },
        };
      }
      default:
        return { name: null, topic0, args: { raw: JSON.stringify({ topics: t, data }) } };
    }
  } catch {
    return { name: null, topic0, args: { raw: JSON.stringify({ topics: t, data }) } };
  }
}

export function isTransferLike(decoded: DecodedLog) {
  return decoded.name === "Transfer" || decoded.name === "TransferSingle";
}
