// lib/tokenResolver.ts
// Turns a user-typed symbol (e.g. "WIF") into a real, Nansen-recognized
// {symbol, name, address, chain} object using Nansen's General Search
// endpoint. This is what fixes the "Invalid address format: WIF" bug:
// we were previously sending a bare ticker where Nansen expected an
// on-chain contract address.

import { NansenApiError } from "./nansen";

export type ResolvedToken = {
  symbol: string;
  name: string;
  address: string;
  chain: string;
};

const NANSEN_BASE_URL = "https://api.nansen.ai";

// A short list of native/base assets that Nansen's smart-money endpoints
// accept as bare symbols (no ERC-20-style contract address exists for
// these on their "home" chain). We skip the search call entirely for
// these to save a credit and avoid ambiguous search results.
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

  // Fast path for common native assets, optionally still chain-checked
  // against what the user said (if they named a different chain, fall
  // through to a real search instead).
  if (NATIVE_SYMBOL_CHAIN[upper] && (!preferredChain || preferredChain === NATIVE_SYMBOL_CHAIN[upper])) {
    return {
      symbol: upper,
      name: upper,
      address: upper, // native assets are referenced by symbol in Nansen's flow endpoints
      chain: NATIVE_SYMBOL_CHAIN[upper],
    };
  }

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
  if (preferredChain) body.chain = preferredChain;

  const res = await fetch(`${NANSEN_BASE_URL}/api/v1/search/general`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    // A search failure shouldn't crash the whole verification \u2014 treat
    // it as "token not found" and let the evidence engine explain that.
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

  // Prefer an exact symbol match on the requested chain, then an exact
  // symbol match on any chain (best rank first), then just the top result.
  const exactOnChain = tokens.find(
    (t) =>
      t.symbol?.toUpperCase() === upper &&
      (!preferredChain || t.chain === preferredChain)
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
