import { NextRequest, NextResponse } from "next/server";
import { parseClaim } from "@/lib/claimParser";
import { getSmartMoneyNetflow, getSmartMoneyDexTrades, getWhoBoughtSold, NansenApiError } from "@/lib/nansen";
import { resolveToken } from "@/lib/tokenResolver";
import { buildVerification } from "@/lib/evidenceEngine";

export const runtime = "nodejs";

const SUPPORTED_CHAINS = new Set([
  "all",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "hyperevm",
  "iotaevm",
  "linea",
  "mantle",
  "monad",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
]);

export async function POST(req: NextRequest) {
  let claim: string;
  let structuredToken: string | null = null;
  let structuredChain: string | null = null;
  let structuredClaimType: "ACCUMULATION" | "DISTRIBUTION" | null = null;

  try {
    const body = await req.json();
    claim = typeof body?.claim === "string" ? body.claim.trim() : "";

    if (typeof body?.token === "string" && body.token.trim()) {
      structuredToken = body.token.trim();
    }
    if (typeof body?.chain === "string" && body.chain.trim()) {
      structuredChain = body.chain.trim();
    }
    if (body?.claimType === "ACCUMULATION" || body?.claimType === "DISTRIBUTION") {
      structuredClaimType = body.claimType;
    }
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Request body must be JSON with a 'claim' field." },
      { status: 400 }
    );
  }

  if (structuredToken && structuredClaimType) {
    const verb = structuredClaimType === "ACCUMULATION" ? "buying" : "selling";
    claim = `Smart Money is ${verb} ${structuredToken}${
      structuredChain ? ` on ${structuredChain}` : ""
    }`;
  }

  if (!claim) {
    return NextResponse.json(
      { error: "missing_claim", message: "Please provide a claim to verify." },
      { status: 400 }
    );
  }

  const parsed = structuredToken && structuredClaimType
    ? {
        raw: claim,
        claimType: structuredClaimType,
        token: structuredToken,
        chain: structuredChain,
      }
    : parseClaim(claim);

  if (parsed.claimType === "UNKNOWN" || !parsed.token) {
    const result = buildVerification({
      claimRaw: claim,
      claimType: parsed.claimType,
      token: parsed.token,
      chain: parsed.chain,
      record: null,
    });
    return NextResponse.json(result);
  }

  try {
    const resolved = await resolveToken(parsed.token, parsed.chain);
    console.log("[verify] parsed:", parsed, "resolved:", resolved);

    if (!resolved) {
      const result = buildVerification({
        claimRaw: claim,
        claimType: parsed.claimType,
        token: parsed.token,
        chain: parsed.chain,
        record: null,
        tokenNotFound: true,
      });
      return NextResponse.json(result);
    }

    if (!SUPPORTED_CHAINS.has(resolved.chain)) {
      const result = buildVerification({
        claimRaw: claim,
        claimType: parsed.claimType,
        token: resolved.symbol,
        chain: resolved.chain,
        record: null,
        chainUnsupported: true,
      });
      return NextResponse.json(result);
    }

    const records = await getSmartMoneyNetflow({
      chain: resolved.chain,
      tokenAddress: resolved.address,
    });
    console.log(
      "[verify] netflow records count:",
      records.length,
      "sample:",
      records[0]
    );

    const match =
      records.find(
        (r) => r.token_symbol?.toUpperCase() === resolved.symbol.toUpperCase()
      ) || records[0] || null;

    let trades: Awaited<ReturnType<typeof getSmartMoneyDexTrades>> = [];
    try {
      trades = await getSmartMoneyDexTrades({
        chain: resolved.chain,
        tokenAddress: resolved.address,
      });
    } catch (tradeErr) {
      console.error("[verify] dex-trades fetch failed (non-fatal):", tradeErr);
    }

    let whoBoughtSold: Awaited<ReturnType<typeof getWhoBoughtSold>> = [];
    try {
      whoBoughtSold = await getWhoBoughtSold({
        chain: resolved.chain,
        tokenAddress: resolved.address,
        buyOrSell: parsed.claimType === "ACCUMULATION" ? "BUY" : "SELL",
      });
    } catch (wbsErr) {
      console.error("[verify] who-bought-sold fetch failed (non-fatal):", wbsErr);
    }

    const result = buildVerification({
      claimRaw: claim,
      claimType: parsed.claimType,
      token: resolved.symbol,
      chain: resolved.chain,
      record: match,
      trades,
      whoBoughtSold,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NansenApiError) {
      return NextResponse.json(
        {
          error: err.code || "nansen_error",
          message: err.message,
        },
        { status: err.status || 502 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "internal_error", message: "Something went wrong while verifying this claim." },
      { status: 500 }
    );
  }
}
