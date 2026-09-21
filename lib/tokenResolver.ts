// lib/tokenResolver.ts
import { NansenApiError } from "./nansen";

export type ResolvedToken = {
  symbol: string;
  name: string;
  address: string;
  chain: string;
};

const NANSEN_BASE_URL = "https://api.nansen.ai";

const NATIVE_SYMBOL_CHAIN: Record<string, string> = {
  SOL: "solana",
  ETH: "ethereum",
  BTC: "bitcoin",
  BNB: "bnb",
  AVAX: "avalanche",
  MATIC: "polygon",
};

export async function resolveToken(
  symbolOrAddress: string,
  preferredChain: string | null
): Promise<ResolvedToken | null> {
  const upper = symbolOrAddress.toUpperCase();
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    throw new NansenApiError(
      "Missing NANSEN_API_KEY. Add it to your .env.local file.",
      500,
      "missing_api_key"
    );
  }

  const body: Record<string, unknown> = {
    search_query: symbolOrAddress,
    result_type: "token",
    limit: 10,
  };
  const chainHint = preferredChain || NATIVE_SYMBOL_CHAIN[upper] || null;
  if (chainHint) body.chain = chainHint;

  const res = await fetch(`${NANSEN_BASE_URL}/api/v1/search/general`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  const tokens: Array<{
    name: string;
    symbol: string;
    chain: string;
    address: string;
    rank?: number | null;
  }> = json.tokens || [];

  if (tokens.length === 0) return null;

  const exactOnChain = tokens.find(
    (t) =>
      t.symbol?.toUpperCase() === upper &&
      (!chainHint || t.chain === chainHint)
  );
  if (exactOnChain) {
    return {
      symbol: exactOnChain.symbol,
      name: exactOnChain.name,
      address: exactOnChain.address,
      chain: exactOnChain.chain,
    };
  }

  const exactAnyChain = tokens.find((t) => t.symbol?.toUpperCase() === upper);
  const best = exactAnyChain || tokens[0];

  return {
    symbol: best.symbol,
    name: best.name,
    address: best.address,
    chain: best.chain,
  };
}
