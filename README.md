# CHAINCHECK

**Onchain claims. Verified by evidence.**

CHAINCHECK verifies claims about blockchain activity (e.g. "Smart Money is
buying SOL") against real Nansen API data, and returns a traceable verdict
(SUPPORTED / PARTIALLY SUPPORTED / CONTRADICTED / INSUFFICIENT EVIDENCE)
along with the evidence that led to it.

CHAINCHECK is **not** a trading platform. It does not tell users what to buy
or sell, does not predict prices, and does not give financial advice. Its
only job is: take a claim → check real onchain data → show the evidence →
explain the result.

Built for the **Nansen Meridian Buildathon** (Sept 14–27, 2026).

---

## How it works

1. The user types a natural-language claim, e.g. `Smart Money is buying SOL`
2. A deterministic claim parser extracts the claim type (accumulation /
   distribution) and the token symbol — no AI is used for this step
3. The server (API key never exposed to the browser) queries Nansen's
   Smart Money Netflow endpoint (`/api/v1/smart-money/netflow`) for that
   token's 24H / 7D / 30D net flow and active trader count
4. A rule-based evidence engine classifies each signal and produces a
   verdict that is fully traceable back to the raw numbers — nothing is
   fabricated. If there isn't enough data, it returns
   `INSUFFICIENT EVIDENCE` instead of guessing
5. The frontend displays the verdict, an evidence-confidence score, the
   individual evidence cards, and a simple evidence-flow map

## 1. Prerequisites

- A computer (Windows, Mac, or Linux) — or Termux on Android, as used to
  build this submission
- [Node.js](https://nodejs.org) (LTS version recommended)
- A Nansen API key (see step 2 below)
- A GitHub account (already used to host this repo)
- A free [Vercel](https://vercel.com) account, to deploy the live app

## 2. Getting a Nansen API key

1. Go to [app.nansen.ai](https://app.nansen.ai) and sign up / log in
2. Go to Account Settings → API Keys
3. Create a new key. If prompted, choose the Pioneer plan (1,000 free
   testing credits)
4. If you run out of credits, an extra 1,000 free credits are available in
   the Nansen "Points Hub" (per the buildathon announcement email)

## 3. Run it locally

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and set your real key:

```
NANSEN_API_KEY=your_nansen_api_key_here
```

**Never commit `.env.local` to GitHub** (already excluded via `.gitignore`).

```bash
npm run dev
```

Open `http://localhost:3000` and try a claim like:

- `Smart Money is buying SOL`
- `Whales are accumulating ETH`
- `Smart Money is selling PEPE`

Each verification is one call to the Nansen API. Test a variety of claims
and tokens (SOL, ETH, BTC, PEPE, WIF, DOGE, etc.) to log the 1,000 API
calls required for buildathon entry.

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. "Add New" → "Project" → import this `chaincheck` repository
3. Under "Environment Variables", add:
   - Name: `NANSEN_API_KEY`
   - Value: your real Nansen API key
4. Click **Deploy**

After a couple of minutes you'll get a live URL (e.g.
`chaincheck.vercel.app`) — this is the link used in the demo video and
submission.

## 5. Buildathon submission checklist

1. Log 1,000 Nansen API calls (by testing claims repeatedly on the live app)
2. Record a 30–60s demo video and post it on X, tagging `@nansen_ai` and
   linking this GitHub repo
3. Submit the entry via the buildathon submission form

---

## Project structure

- `app/page.tsx` — frontend: claim input, loading states, verdict and
  evidence display
- `app/api/verify/route.ts` — server route: parses the claim, calls Nansen,
  builds the verification result
- `lib/nansen.ts` — server-only Nansen API client (API key stays on the
  server)
- `lib/claimParser.ts` — turns a claim sentence into a structured
  (claim type, token, chain) query
- `lib/evidenceEngine.ts` — deterministic rules that turn Nansen data into
  evidence items and a verdict

## Possible extensions

- More claim types (e.g. "Capital is moving from ETH to SOL")
- A real timeline view once Nansen returns per-event timestamps
- Wallet-specific claims using Nansen's Profiler endpoints
