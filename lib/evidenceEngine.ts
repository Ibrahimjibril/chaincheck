// lib/evidenceEngine.ts
// Deterministic rules only. No AI is used to reach the verdict, so every
// result is directly traceable back to real Nansen numbers.

import { SmartMoneyNetflowRecord } from "./nansen";
import { ClaimType } from "./claimParser";

export type SignalDirection = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

export type EvidenceItem = {
  metric: string;
  value: string;
  rawValue: number | null;
  direction: SignalDirection;
  period: string;
  source: "Nansen";
  interpretation: string;
};

export type Verdict =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "INSUFFICIENT_EVIDENCE";

export type VerificationResult = {
  claim: string;
  token: string | null;
  chain: string | null;
  verdict: Verdict;
  confidence: number; // 0-100, evidence completeness/quality, NOT "truth probability"
  evidence: EvidenceItem[];
  explanation: string;
};

function fmtUsd(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function directionOf(n: number, neutralBandUsd = 500): SignalDirection {
  if (Math.abs(n) < neutralBandUsd) return "NEUTRAL";
  return n > 0 ? "POSITIVE" : "NEGATIVE";
}

export function buildVerification(opts: {
  claimRaw: string;
  claimType: ClaimType;
  token: string | null;
  chain: string | null;
  record: SmartMoneyNetflowRecord | null;
  tokenNotFound?: boolean;
}): VerificationResult {
  const { claimRaw, claimType, token, chain, record, tokenNotFound } = opts;

  if (tokenNotFound) {
    return {
      claim: claimRaw,
      token,
      chain,
      verdict: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      evidence: [],
      explanation: `CHAINCHECK could not find a token matching "${token}"${
        chain ? ` on ${chain}` : ""
      } in Nansen's token index. Double-check the symbol, or try including the chain name (e.g. "on Solana").`,
    };
  }

  // --- No usable claim type or token: refuse to fabricate a verdict ---
  if (claimType === "UNKNOWN" || !token) {
    return {
      claim: claimRaw,
      token,
      chain,
      verdict: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      evidence: [],
      explanation:
        "CHAINCHECK could not identify a clear accumulation/distribution claim and a token symbol in this sentence. Try a format like: \"Smart Money is buying SOL\" or \"Whales are selling PEPE\".",
    };
  }

  // --- No matching record returned by Nansen: refuse to fabricate ---
  if (!record) {
    return {
      claim: claimRaw,
      token,
      chain,
      verdict: "INSUFFICIENT_EVIDENCE",
      confidence: 10,
      evidence: [],
      explanation: `Nansen returned no Smart Money flow data for "${token}"${
        chain ? ` on ${chain}` : ""
      }. This can mean the token symbol wasn't recognized, or Smart Money wallets show no recent activity on it.`,
    };
  }

  const evidence: EvidenceItem[] = [];

  const flow24 = directionOf(record.net_flow_24h_usd);
  evidence.push({
    metric: "Smart Money Net Flow",
    value: fmtUsd(record.net_flow_24h_usd),
    rawValue: record.net_flow_24h_usd,
    direction: flow24,
    period: "24H",
    source: "Nansen",
    interpretation:
      flow24 === "POSITIVE"
        ? "Net inflow detected in the last 24 hours."
        : flow24 === "NEGATIVE"
        ? "Net outflow detected in the last 24 hours."
        : "Flow is roughly flat over the last 24 hours.",
  });

  const flow7 = directionOf(record.net_flow_7d_usd);
  evidence.push({
    metric: "Smart Money Net Flow",
    value: fmtUsd(record.net_flow_7d_usd),
    rawValue: record.net_flow_7d_usd,
    direction: flow7,
    period: "7D",
    source: "Nansen",
    interpretation:
      flow7 === "POSITIVE"
        ? "Net inflow detected over the past 7 days."
        : flow7 === "NEGATIVE"
        ? "Net outflow detected over the past 7 days."
        : "Flow is roughly flat over the past 7 days.",
  });

  const flow30 = directionOf(record.net_flow_30d_usd);
  evidence.push({
    metric: "Smart Money Net Flow",
    value: fmtUsd(record.net_flow_30d_usd),
    rawValue: record.net_flow_30d_usd,
    direction: flow30,
    period: "30D",
    source: "Nansen",
    interpretation:
      flow30 === "POSITIVE"
        ? "Net inflow detected over the past 30 days."
        : flow30 === "NEGATIVE"
        ? "Net outflow detected over the past 30 days."
        : "Flow is roughly flat over the past 30 days.",
  });

  evidence.push({
    metric: "Active Smart Money Traders",
    value: `${record.trader_count}`,
    rawValue: record.trader_count,
    direction: record.trader_count > 0 ? "NEUTRAL" : "UNKNOWN",
    period: "30D",
    source: "Nansen",
    interpretation: `${record.trader_count} distinct Smart Money wallets have traded this token in the last 30 days.`,
  });

  if (record.market_cap_usd != null) {
    evidence.push({
      metric: "Market Cap",
      value: fmtUsd(record.market_cap_usd).replace("+", ""),
      rawValue: record.market_cap_usd,
      direction: "NEUTRAL",
      period: "current",
      source: "Nansen",
      interpretation: "Context only \u2014 not used to determine the verdict.",
    });
  }

  // --- Verdict logic ---
  // Claim is "ACCUMULATION" -> we expect POSITIVE flows.
  // Claim is "DISTRIBUTION" -> we expect NEGATIVE flows.
  const flows = [
    { period: "24H", dir: flow24 },
    { period: "7D", dir: flow7 },
    { period: "30D", dir: flow30 },
  ];

  const wantDirection: SignalDirection =
    claimType === "ACCUMULATION" ? "POSITIVE" : "NEGATIVE";
  const oppositeDirection: SignalDirection =
    claimType === "ACCUMULATION" ? "NEGATIVE" : "POSITIVE";

  const supportingCount = flows.filter((f) => f.dir === wantDirection).length;
  const contradictingCount = flows.filter((f) => f.dir === oppositeDirection).length;
  const neutralCount = flows.filter((f) => f.dir === "NEUTRAL").length;

  // Weight the 7D signal most heavily since it's the most commonly cited window.
  const primarySupports = flows[1].dir === wantDirection;
  const primaryContradicts = flows[1].dir === oppositeDirection;

  let verdict: Verdict;
  if (supportingCount >= 2 && contradictingCount === 0) {
    verdict = "SUPPORTED";
  } else if (primaryContradicts && supportingCount === 0) {
    verdict = "CONTRADICTED";
  } else if (supportingCount > 0 && contradictingCount > 0) {
    verdict = "PARTIALLY_SUPPORTED";
  } else if (primarySupports) {
    verdict = "PARTIALLY_SUPPORTED";
  } else if (neutralCount === flows.length) {
    verdict = "INSUFFICIENT_EVIDENCE";
  } else {
    verdict = "CONTRADICTED";
  }

  // --- Confidence: data completeness + signal agreement, capped 5-95 ---
  const completeness = evidence.filter((e) => e.rawValue !== null).length / evidence.length;
  const agreement =
    flows.length > 0
      ? Math.max(supportingCount, contradictingCount) / flows.length
      : 0;
  const rawConfidence = Math.round((completeness * 0.4 + agreement * 0.6) * 100);
  const confidence = Math.min(95, Math.max(5, rawConfidence));

  const verbClaim = claimType === "ACCUMULATION" ? "accumulating" : "distributing";
  let explanation = "";
  switch (verdict) {
    case "SUPPORTED":
      explanation = `Nansen's Smart Money data shows consistent ${
        wantDirection === "POSITIVE" ? "net inflow" : "net outflow"
      } for ${token} across the 24H, 7D and 30D windows, which lines up with the claim that Smart Money is ${verbClaim} it.`;
      break;
    case "PARTIALLY_SUPPORTED":
      explanation = `The data shows some ${
        wantDirection === "POSITIVE" ? "inflow" : "outflow"
      } signals for ${token}, but activity is not uniform across all time windows \u2014 some periods point the other way, so the claim is only partially backed by the evidence.`;
      break;
    case "CONTRADICTED":
      explanation = `The strongest available evidence for ${token} points opposite to the claim: Smart Money flow is net ${
        wantDirection === "POSITIVE" ? "negative" : "positive"
      } rather than ${wantDirection === "POSITIVE" ? "positive" : "negative"} over the periods checked.`;
      break;
    default:
      explanation = `There isn't enough reliable Nansen data for ${token} to confidently confirm or deny this claim.`;
  }

  return {
    claim: claimRaw,
    token,
    chain,
    verdict,
    confidence,
    evidence,
    explanation,
  };
}
