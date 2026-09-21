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
  BNB: "bnb",
  AVAX: "avalanche",
  MATIC: "polygon",
};

const WRAPPED_NATIVE_ADDRESS: Record<string, string> = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  bnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  avalanche: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c",
  arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  base: "0x4200000000000000000000000000000000000006",
  optimism: "0x4200000000000000000000000000000000000006",
  solana: "So11111111111111111111111111111111111111112",
};

function isNativeSentinel(address: string): boolean {
  return /^0xe{6,}$/i.test(address.toLowerCase().replace(/^0x0*/, "0x"));
}

const SYMBOL_SEARCH_OVERRIDE: Record<string, { query: string; chain: string }> = {
  BTC: { query: "WBTC", chain: "ethereum" },
  ETH: { query: "WETH", chain: "ethereum" },
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

  const override = SYMBOL_SEARCH_OVERRIDE[upper];
  const searchQuery = override ? override.query : symbolOrAddress;
  const searchUpper = override ? override.query.toUpperCase() : upper;

  const body: Record<string, unknown> = {
    search_query: searchQuery,
    result_type: "token",
    limit: 10,
  };
  const chainHint =
    override?.chain || preferredChain || NATIVE_SYMBOL_CHAIN[upper] || null;
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
      t.symbol?.toUpperCase() === searchUpper &&
      (!chainHint || t.chain === chainHint)
  );
  if (exactOnChain) {
    return finalizeResolved(
      exactOnChain.symbol,
      exactOnChain.name,
      exactOnChain.address,
      exactOnChain.chain
    );
  }

  const exactAnyChain = tokens.find((t) => t.symbol?.toUpperCase() === searchUpper);
  const best = exactAnyChain || tokens[0];

  return finalizeResolved(best.symbol, best.name, best.address, best.chain);
}

function finalizeResolved(
  symbol: string,
  name: string,
  address: string,
  chain: string
): ResolvedToken {
  const wrapped = WRAPPED_NATIVE_ADDRESS[chain];
  let finalAddress = wrapped && isNativeSentinel(address) ? wrapped : address;
  if (chain !== "solana" && finalAddress.startsWith("0x")) {
    finalAddress = finalAddress.toLowerCase();
  }
  return { symbol, name, address: finalAddress, chain };
}
