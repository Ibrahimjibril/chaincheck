// lib/claimParser.ts
// Deterministic, rule-based parser. No AI required for the MVP claim types,
// which keeps the app simple, fast, and free of an extra API key dependency.

export type ClaimType = "ACCUMULATION" | "DISTRIBUTION" | "UNKNOWN";

export type ParsedClaim = {
  raw: string;
  claimType: ClaimType;
  token: string | null;
  chain: string | null;
};

const CHAIN_KEYWORDS: Record<string, string> = {
  ethereum: "ethereum",
  eth: "ethereum",
  solana: "solana",
  sol: "solana",
  base: "base",
  arbitrum: "arbitrum",
  polygon: "polygon",
  avalanche: "avalanche",
  bnb: "bnb",
  bsc: "bnb",
  optimism: "optimism",
  linea: "linea",
  mantle: "mantle",
};

const ACCUMULATION_WORDS = [
  "accumulat",
  "buying",
  "buy",
  "bought",
  "inflow",
  "loading up",
  "scooping",
];

const DISTRIBUTION_WORDS = [
  "distribut",
  "selling",
  "sell",
  "sold",
  "dumping",
  "dump",
  "outflow",
  "exiting",
];

// Common English words that could be mistaken for a token symbol when they
// appear capitalized at the start of a sentence, or are part of our own
// vocabulary above. We filter these out before guessing the token.
const STOPWORDS = new Set([
  "WHALES",
  "WHALE",
  "SMART",
  "MONEY",
  "LARGE",
  "HOLDERS",
  "HOLDER",
  "WALLET",
  "WALLETS",
  "ARE",
  "IS",
  "THE",
  "ON",
  "IN",
  "OF",
  "TO",
  "FROM",
  "CAPITAL",
  "MOVING",
  "BUYING",
  "SELLING",
  "ACCUMULATING",
  "DISTRIBUTING",
]);

export function parseClaim(rawClaim: string): ParsedClaim {
  const raw = rawClaim.trim();
  const lower = raw.toLowerCase();

  let claimType: ClaimType = "UNKNOWN";
  if (ACCUMULATION_WORDS.some((w) => lower.includes(w))) {
    claimType = "ACCUMULATION";
  } else if (DISTRIBUTION_WORDS.some((w) => lower.includes(w))) {
    claimType = "DISTRIBUTION";
  }

  let chain: string | null = null;
  for (const [keyword, chainId] of Object.entries(CHAIN_KEYWORDS)) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(raw)) {
      chain = chainId;
      break;
    }
  }

  // Token guess: look for short alphanumeric tokens (2-10 chars), prefer
  // ones written in ALL CAPS (typical of tickers: SOL, PEPE, WIF...).
  const words = raw.match(/\b[A-Za-z0-9]{2,10}\b/g) || [];
  let token: string | null = null;

  const upperCandidates = words.filter(
    (w) => w === w.toUpperCase() && /[A-Z]/.test(w) && !STOPWORDS.has(w.toUpperCase())
  );
  if (upperCandidates.length > 0) {
    token = upperCandidates[upperCandidates.length - 1];
  } else {
    // Fallback: last word in the sentence that isn't a stopword or a chain name
    const filtered = words.filter(
      (w) =>
        !STOPWORDS.has(w.toUpperCase()) &&
        !CHAIN_KEYWORDS[w.toLowerCase()] &&
        w.toLowerCase() !== "chain"
    );
    token = filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  return { raw, claimType, token, chain };
}
