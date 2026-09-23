// lib/nansen.ts
// Server-side only. NEVER import this file from a client component.
// The Nansen API key lives only in the environment (.env.local) and is
// attached here on the server, so it never reaches the browser bundle.

export type SmartMoneyNetflowRecord = {
  token_address: string;
  token_symbol: string;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  chain: string;
  token_sectors: string[];
  trader_count: number;
  token_age_days: number;
  market_cap_usd?: number | null;
};

type NetflowResponse = {
  data: SmartMoneyNetflowRecord[];
  pagination: { page: number; per_page: number; is_last_page: boolean };
};

const NANSEN_BASE_URL = "https://api.nansen.ai";

export class NansenApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "NansenApiError";
    this.status = status;
    this.code = code;
  }
}

export async function getSmartMoneyNetflow(params: {
  chain: string;
  tokenAddress: string;
}): Promise<SmartMoneyNetflowRecord[]> {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    throw new NansenApiError(
      "Missing NANSEN_API_KEY. Add it to your .env.local file.",
      500,
      "missing_api_key"
    );
  }

  const body = {
    chains: [params.chain],
    filters: {
      token_address: [params.tokenAddress],
      include_stablecoins: true,
      include_native_tokens: true,
    },
    pagination: { page: 1, per_page: 25 },
  };

  const res = await fetch(`${NANSEN_BASE_URL}/api/v1/smart-money/netflow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Nansen API error (${res.status})`;
    let code: string | undefined;
    try {
      const errJson = await res.json();
      message = errJson.message || message;
      code = errJson.code;
    } catch {
      // ignore parse failure, keep default message
    }
    throw new NansenApiError(message, res.status, code);
  }

  const json = (await res.json()) as NetflowResponse;
  return json.data || [];
}

export type SmartMoneyDexTrade = {
  chain: string;
  block_timestamp: string;
  transaction_hash: string;
  trader_address: string;
  trader_address_label: string;
  token_bought_symbol: string;
  token_sold_symbol: string;
  trade_value_usd: number | null;
};

type DexTradesResponse = {
  data: SmartMoneyDexTrade[];
  pagination: { page: number; per_page: number; is_last_page: boolean };
};

export async function getSmartMoneyDexTrades(params: {
  chain: string;
  tokenAddress: string;
}): Promise<SmartMoneyDexTrade[]> {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    throw new NansenApiError(
      "Missing NANSEN_API_KEY. Add it to your .env.local file.",
      500,
      "missing_api_key"
    );
  }

  const body = {
    chains: [params.chain],
    filters: {
      token_bought_address: [params.tokenAddress],
    },
    pagination: { page: 1, per_page: 8 },
    order_by: [{ field: "trade_value_usd", direction: "DESC" }],
  };

  const res = await fetch(`${NANSEN_BASE_URL}/api/v1/smart-money/dex-trades`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  const json = (await res.json()) as DexTradesResponse;
  return json.data || [];
}
