"use client";

import { useState, useRef, useEffect } from "react";

type EvidenceItem = {
  metric: string;
  value: string;
  direction: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";
  period: string;
  source: string;
  interpretation: string;
};

type Verdict =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "INSUFFICIENT_EVIDENCE";

type ActiveTrader = {
  address: string;
  label: string;
  chain: string;
  valueUsd: number | null;
  timestamp: string;
  txHash: string;
};

type VerificationResult = {
  claim: string;
  token: string | null;
  chain: string | null;
  verdict: Verdict;
  confidence: number;
  evidence: EvidenceItem[];
  explanation: string;
  supportingSignals: number;
  contradictingSignals: number;
  checkedAt: string;
  activeTraders: ActiveTrader[];
  whaleTraders: ActiveTrader[];
  totalTradeValueUsd: number;
};

const EXPLORER_BASE: Record<string, string> = {
  ethereum: "https://etherscan.io/address/",
  base: "https://basescan.org/address/",
  arbitrum: "https://arbiscan.io/address/",
  polygon: "https://polygonscan.com/address/",
  avalanche: "https://snowtrace.io/address/",
  bnb: "https://bscscan.com/address/",
  optimism: "https://optimistic.etherscan.io/address/",
  solana: "https://solscan.io/account/",
};

function explorerUrl(chain: string, address: string): string | null {
  const base = EXPLORER_BASE[chain];
  return base ? `${base}${address}` : null;
}

const TX_EXPLORER_BASE: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  avalanche: "https://snowtrace.io/tx/",
  bnb: "https://bscscan.com/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  solana: "https://solscan.io/tx/",
};

function txExplorerUrl(chain: string, txHash: string): string | null {
  const base = TX_EXPLORER_BASE[chain];
  return base && txHash ? `${base}${txHash}` : null;
}

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const CHAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "ethereum", label: "Ethereum" },
  { value: "solana", label: "Solana" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "bnb", label: "BNB Chain" },
  { value: "polygon", label: "Polygon" },
  { value: "avalanche", label: "Avalanche" },
  { value: "optimism", label: "Optimism" },
  { value: "linea", label: "Linea" },
  { value: "mantle", label: "Mantle" },
  { value: "monad", label: "Monad" },
  { value: "robinhood", label: "Robinhood Chain" },
  { value: "sei", label: "Sei" },
  { value: "sonic", label: "Sonic" },
  { value: "hyperevm", label: "HyperEVM" },
  { value: "iotaevm", label: "IOTA EVM" },
  { value: "plasma", label: "Plasma" },
  { value: "arc", label: "Arc" },
];

const EXAMPLE_CLAIMS = [
  "Smart Money is buying SOL",
  "Smart Money is buying BTC",
  "Smart Money is selling PEPE",
  "Large holders are distributing WIF on solana",
];

const LOADING_STEPS = [
  "Parsing claim...",
  "Identifying token...",
  "Querying Nansen Smart Money data...",
  "Analyzing onchain flows...",
  "Building evidence...",
  "Preparing verdict...",
];

const VERDICT_STYLES: Record<
  Verdict,
  { label: string; color: string; bg: string; border: string }
> = {
  SUPPORTED: {
    label: "SUPPORTED",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/40",
  },
  PARTIALLY_SUPPORTED: {
    label: "PARTIALLY SUPPORTED",
    color: "text-warn",
    bg: "bg-warn/10",
    border: "border-warn/40",
  },
  CONTRADICTED: {
    label: "CONTRADICTED",
    color: "text-danger",
    bg: "bg-danger/10",
    border: "border-danger/40",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "INSUFFICIENT EVIDENCE",
    color: "text-gray-300",
    bg: "bg-gray-500/10",
    border: "border-gray-500/40",
  },
};

function DirectionBadge({ direction }: { direction: EvidenceItem["direction"] }) {
  const map = {
    POSITIVE: { icon: "\u2713", cls: "text-accent" },
    NEGATIVE: { icon: "\u2717", cls: "text-danger" },
    NEUTRAL: { icon: "\u2022", cls: "text-gray-400" },
    UNKNOWN: { icon: "?", cls: "text-gray-500" },
  } as const;
  const m = map[direction];
  return <span className={`${m.cls} font-mono`}>{m.icon}</span>;
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right ${valueClassName || "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

function WalletCard({
  title,
  subtitle,
  wallets,
}: {
  title: string;
  subtitle: string;
  wallets: ActiveTrader[];
}) {
  if (wallets.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-panel/60 p-6">
      <div className="mb-1 text-xs font-mono uppercase tracking-wider text-gray-500">
        {title} ({wallets.length})
      </div>
      <div className="mb-4 text-[11px] text-gray-600">{subtitle}</div>
      <div className="space-y-2">
        {wallets.map((t, i) => {
          const addrUrl = explorerUrl(t.chain, t.address);
          const txUrl = txExplorerUrl(t.chain, t.txHash);
          return (
            <div
              key={i}
              className="rounded-xl border border-border bg-black/30 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-white">
                    {truncateAddress(t.address)}
                  </div>
                  <div className="truncate text-[11px] text-gray-500">
                    {t.label}
                  </div>
                </div>
                <div className="font-mono text-sm text-accent">
                  {t.valueUsd != null
                    ? `$${t.valueUsd.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}`
                    : "\u2014"}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                <button
                  onClick={() => copyText(t.address)}
                  className="text-gray-500 underline decoration-dotted hover:text-accent"
                >
                  Copy address
                </button>
                {addrUrl && (
                  <a
                    href={addrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 underline decoration-dotted hover:text-accent"
                  >
                    View wallet
                  </a>
                )}
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 underline decoration-dotted hover:text-accent"
                  >
                    View transaction
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildShareText(result: VerificationResult): string {
  const verdictLabel = VERDICT_STYLES[result.verdict].label;
  const evidenceLines = result.evidence
    .slice(0, 3)
    .map((ev) => `\u2022 ${ev.metric} (${ev.period}): ${ev.value}`);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?claim=${encodeURIComponent(result.claim)}`
      : "";
  return [
    `CHAINCHECK verified an onchain claim:`,
    `"${result.claim}"`,
    ``,
    `Verdict: ${verdictLabel}`,
    `Evidence confidence: ${result.confidence}%`,
    ...evidenceLines,
    ``,
    `Powered by real @nansen_ai data \u2014 built for the Nansen Meridian Buildathon.`,
    ``,
    `Check it yourself \u2192 ${shareUrl}`,
  ].join("\n");
}

export default function Home() {
  const [claim, setClaim] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selChain, setSelChain] = useState("ethereum");
  const [selToken, setSelToken] = useState("");
  const [selClaimType, setSelClaimType] = useState<"ACCUMULATION" | "DISTRIBUTION">(
    "ACCUMULATION"
  );
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedClaim = params.get("claim");
    if (sharedClaim) {
      setClaim(sharedClaim);
      handleVerify(sharedClaim);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runVerification(
    payload: { claim: string } | { token: string; chain: string; claimType: "ACCUMULATION" | "DISTRIBUTION" }
  ) {
    setLoading(true);
    setResult(null);
    setError(null);
    setStepIndex(0);
    setShowReceipt(false);

    stepTimer.current = setInterval(() => {
      setStepIndex((i) => (i < LOADING_STEPS.length - 1 ? i + 1 : i));
    }, 450);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong.");
      } else {
        setResult(data);
        if (typeof data.claim === "string") setClaim(data.claim);
      }
    } catch (e) {
      setError("Network error — could not reach CHAINCHECK's server.");
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      setLoading(false);
    }
  }

  async function handleVerify(claimText?: string) {
    const text = (claimText ?? claim).trim();
    if (!text) return;
    await runVerification({ claim: text });
  }

  async function handleStructuredVerify() {
    const token = selToken.trim();
    if (!token) return;
    await runVerification({ token, chain: selChain, claimType: selClaimType });
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />

      <div className="relative mx-auto max-w-3xl px-6 py-16">
        <header className="fade-up mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm font-mono uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
            Onchain claims. Verified by evidence.
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            CHAIN<span className="text-accent">CHECK</span>
          </h1>
          <p className="mt-3 text-gray-400">
            Verify what is actually happening on-chain — powered by real Nansen Smart Money data.
          </p>
        </header>

        <section className="fade-up rounded-2xl border border-border bg-panel/60 p-5 shadow-2xl backdrop-blur">
          <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-gray-500">
            What do you want to verify?
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="e.g. Whales are accumulating SOL"
              className="flex-1 rounded-xl border border-border bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-gray-600 focus:border-accent/60"
            />
            <button
              onClick={() => handleVerify()}
              disabled={loading || !claim.trim()}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              VERIFY CLAIM
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_CLAIMS.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setClaim(ex);
                  handleVerify(ex);
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-gray-400 transition hover:border-accent/50 hover:text-accent"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-3 text-xs font-mono uppercase tracking-wider text-gray-500">
              Or search by Chain + Token
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-600">
                  Blockchain
                </label>
                <select
                  value={selChain}
                  onChange={(e) => setSelChain(e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
                >
                  {CHAIN_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-600">
                  Token
                </label>
                <input
                  value={selToken}
                  onChange={(e) => setSelToken(e.target.value)}
                  placeholder="e.g. SOL, PEPE, WIF"
                  className="w-full rounded-xl border border-border bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-gray-600 focus:border-accent/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-600">
                  Investigate
                </label>
                <select
                  value={selClaimType}
                  onChange={(e) =>
                    setSelClaimType(e.target.value as "ACCUMULATION" | "DISTRIBUTION")
                  }
                  className="w-full rounded-xl border border-border bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
                >
                  <option value="ACCUMULATION">Smart Money Buying</option>
                  <option value="DISTRIBUTION">Smart Money Selling</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleStructuredVerify}
              disabled={loading || !selToken.trim()}
              className="mt-3 w-full rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              VERIFY SELECTION
            </button>
          </div>
        </section>

        {loading && (
          <section className="fade-up mt-8 rounded-2xl border border-border bg-panel/60 p-6 font-mono text-sm text-gray-400">
            {LOADING_STEPS.map((step, i) => (
              <div
                key={step}
                className={`flex items-center gap-2 py-1 transition ${
                  i <= stepIndex ? "text-accent" : "text-gray-600"
                }`}
              >
                <span>{i < stepIndex ? "\u2713" : i === stepIndex ? "\u25CF" : "\u25CB"}</span>
                {step}
              </div>
            ))}
          </section>
        )}

        {error && (
          <section className="fade-up mt-8 rounded-2xl border border-danger/40 bg-danger/10 p-6 text-sm text-danger">
            {error}
          </section>
        )}

        {result && !loading && (
          <>
          <section className="fade-up mt-8 space-y-6">
            <div className="rounded-2xl border border-border bg-panel/60 p-6">
              <div className="text-xs font-mono uppercase tracking-wider text-gray-500">
                Claim
              </div>
              <div className="mt-1 text-lg">&ldquo;{result.claim}&rdquo;</div>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span
                  className={`rounded-lg border px-4 py-2 font-mono text-sm font-bold ${
                    VERDICT_STYLES[result.verdict].color
                  } ${VERDICT_STYLES[result.verdict].bg} ${
                    VERDICT_STYLES[result.verdict].border
                  }`}
                >
                  {VERDICT_STYLES[result.verdict].label}
                </span>
                <div className="text-sm text-gray-400">
                  Evidence confidence:{" "}
                  <span className="font-mono text-white">{result.confidence}%</span>
                  <span className="ml-1 text-xs text-gray-600">
                    (data quality, not probability of truth)
                  </span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-gray-300">
                {result.explanation}
              </p>
            </div>

            {result.evidence.length > 0 && (
              <div className="rounded-2xl border border-border bg-panel/60 p-6">
                <div className="mb-4 text-xs font-mono uppercase tracking-wider text-gray-500">
                  Evidence ({result.evidence.length})
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.evidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border bg-black/30 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {ev.metric} · {ev.period}
                        </span>
                        <DirectionBadge direction={ev.direction} />
                      </div>
                      <div className="mt-1 font-mono text-lg">{ev.value}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {ev.interpretation}
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-wider text-gray-600">
                        Source: {ev.source}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-panel/60 p-6">
              <div className="mb-4 text-xs font-mono uppercase tracking-wider text-gray-500">
                Evidence Map
              </div>
              <div className="flex flex-col items-center gap-2 font-mono text-xs">
                <div className="rounded-lg border border-border bg-black/40 px-4 py-2 text-center">
                  CLAIM
                  <div className="text-gray-500">&ldquo;{result.claim}&rdquo;</div>
                </div>
                <div className="text-gray-600">↓</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {result.evidence.slice(0, 3).map((ev, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-3 py-2 text-center ${
                        ev.direction === "POSITIVE"
                          ? "border-accent/40 text-accent"
                          : ev.direction === "NEGATIVE"
                          ? "border-danger/40 text-danger"
                          : "border-border text-gray-400"
                      }`}
                    >
                      {ev.period}
                      <div>{ev.value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-gray-600">↓</div>
                <div
                  className={`rounded-lg border px-4 py-2 font-bold ${
                    VERDICT_STYLES[result.verdict].color
                  } ${VERDICT_STYLES[result.verdict].border} ${
                    VERDICT_STYLES[result.verdict].bg
                  }`}
                >
                  {VERDICT_STYLES[result.verdict].label}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/60 p-6">
              <div className="mb-4 text-xs font-mono uppercase tracking-wider text-gray-500">
                Evidence Breakdown
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600">
                    Supporting
                  </div>
                  <div className="font-mono text-xl text-accent">
                    {result.supportingSignals}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600">
                    Contradicting
                  </div>
                  <div className="font-mono text-xl text-danger">
                    {result.contradictingSignals}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600">
                    Relevant wallets
                  </div>
                  <div className="font-mono text-xl text-white">
                    {result.activeTraders.length + result.whaleTraders.length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600">
                    Trade value
                  </div>
                  <div className="font-mono text-xl text-white">
                    {result.totalTradeValueUsd > 0
                      ? `$${result.totalTradeValueUsd.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}`
                      : "\u2014"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-[11px] text-gray-500">
                <span>Observation window: Last 24h</span>
                <span>Data source: Nansen</span>
              </div>
            </div>

            <WalletCard
              title="Active Smart Money Wallets"
              subtitle="Labeled Smart Money wallets from Nansen's DEX trade data."
              wallets={result.activeTraders}
            />

            <WalletCard
              title="Top Buyers/Sellers · All Wallets"
              subtitle="Whale-level view: the largest wallets by USD volume in the last 24h, not limited to labeled Smart Money."
              wallets={result.whaleTraders}
            />
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowReceipt((v) => !v)}
              className="rounded-xl border border-accent/40 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/20"
            >
              {showReceipt ? "HIDE EVIDENCE RECEIPT" : "GENERATE EVIDENCE RECEIPT"}
            </button>
          </div>

          {showReceipt && (
            <div className="fade-up rounded-2xl border border-accent/30 bg-black/40 p-6 font-mono text-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-accent font-bold tracking-widest">
                  CHAINCHECK
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Evidence Receipt
                </div>
              </div>

              <div className="space-y-3 text-gray-300">
                <Row label="Claim" value={`"${result.claim}"`} />
                <Row label="Asset" value={result.token || "\u2014"} />
                <Row label="Chain" value={result.chain || "\u2014"} />
                <Row
                  label="Verdict"
                  value={VERDICT_STYLES[result.verdict].label}
                  valueClassName={VERDICT_STYLES[result.verdict].color}
                />
                <Row
                  label="Evidence confidence"
                  value={`${result.confidence}% (data quality, not probability)`}
                />
                <Row
                  label="Supporting signals"
                  value={String(result.supportingSignals)}
                />
                <Row
                  label="Contradicting signals"
                  value={String(result.contradictingSignals)}
                />
                <Row label="Data source" value="Nansen" />
                <Row
                  label="Checked"
                  value={new Date(result.checkedAt).toUTCString()}
                />
              </div>

              {result.evidence.length > 0 && (
                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">
                    Evidence Detail
                  </div>
                  {result.evidence.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {ev.metric} ({ev.period})
                      </span>
                      <span className="flex items-center gap-2">
                        <DirectionBadge direction={ev.direction} />
                        <span className="text-white">{ev.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {result.activeTraders.length > 0 && (
                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">
                    Verified Wallets ({result.activeTraders.length})
                  </div>
                  {result.activeTraders.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{t.label}</span>
                      <span className="text-white">{truncateAddress(t.address)}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.whaleTraders.length > 0 && (
                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">
                    Top Wallets · All Wallets ({result.whaleTraders.length})
                  </div>
                  {result.whaleTraders.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{t.label}</span>
                      <span className="text-white">{truncateAddress(t.address)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-gray-400">
                {result.explanation}
              </div>

              <button
                onClick={() => {
                  const text = buildShareText(result);
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    text
                  )}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="mt-5 w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                SHARE ON X
              </button>
            </div>
          )}
          </>
        )}

        <footer className="mt-16 text-center text-xs text-gray-600">
          CHAINCHECK does not give financial advice and does not predict prices.
          It only checks claims against real onchain data from Nansen.
        </footer>
      </div>
    </main>
  );
}
