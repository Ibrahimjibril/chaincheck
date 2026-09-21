import { NextRequest, NextResponse } from "next/server";
import { parseClaim } from "@/lib/claimParser";
import { getSmartMoneyNetflow, NansenApiError } from "@/lib/nansen";
import { resolveToken } from "@/lib/tokenResolver";
import { buildVerification } from "@/lib/evidenceEngine";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let claim: string;
  try {
    const body = await req.json();
    claim = typeof body?.claim === "string" ? body.claim.trim() : "";
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Request body must be JSON with a 'claim' field." },
      { status: 400 }
    );
  }

  if (!claim) {
    return NextResponse.json(
      { error: "missing_claim", message: "Please provide a claim to verify." },
      { status: 400 }
    );
  }

  const parsed = parseClaim(claim);

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

    const result = buildVerification({
      claimRaw: claim,
      claimType: parsed.claimType,
      token: resolved.symbol,
      chain: resolved.chain,
      record: match,
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
