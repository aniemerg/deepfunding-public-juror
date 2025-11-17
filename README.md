# Deep Funding Public Juror

A Web3-enabled evaluation system for the Ethereum ecosystem, where qualified jurors evaluate and compare projects through multiple assessment interfaces. This system addresses systematic bias in value multiplier estimates by using targeted question types and contextualized comparisons.

## How It Works

**Deep Funding Public Juror** is a Web3-native evaluation platform built to collect high-quality comparative judgments about Ethereum ecosystem projects.

### Authentication & Evaluation Flow

Users authenticate with their Ethereum wallets using Sign-In with Ethereum (SIWE). The system requires participants to have ENS names ending in `.eth`, which serves as their primary identifier. When users connect their wallet and sign the authentication message, their ENS name and wallet address are recorded together, creating a persistent identity across sessions.

Jurors progress through a structured evaluation sequence. The current flow begins with background information and personal scale calibration (identifying most and least valuable projects), then proceeds through randomized project comparisons, similarity assessments, and originality evaluations. Each evaluation generates specific data points designed to reveal relative project values rather than asking for absolute valuations. The evaluation flow is an active area of development and may evolve as we refine the data collection approach.

### Data Persistence

The system employs a three-tier persistence model:

**Local State** captures every user interaction immediately in the browser. Changes are instant without network latency.

**Cloudflare KV Storage** acts as the session persistence layer. Every change is auto-saved with one-second debouncing. Users can close their browser, switch devices, or lose connectivity without losing progress.

**Google Sheets** serves as the final submission layer. When users explicitly submit a screen, data is formatted as human-readable structured columns and appended to the appropriate sheet tab. Previous submissions are marked as superseded rather than deleted, creating a complete audit trail. ENS names serve as the primary identifier across all sheets.

This architecture separates "working data" (KV) from "permanent records" (Sheets), giving users control over when their work becomes part of the official dataset.

### Deployment

The application runs on Cloudflare Workers using Next.js 15 with the OpenNext adapter. Separate preview and production environments maintain isolated KV namespaces and Google Sheets for safe testing.

For detailed deployment procedures, see [docs/deployment.md](./docs/deployment.md).

## Getting Started

### Prerequisites

- Node.js 18+
- Ethereum wallet with ENS name ending in .eth (MetaMask recommended)
- Cloudflare account (for deployment)
- Google Cloud account with Sheets API (for production)

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Primary Development** (with KV access):
   ```bash
   npm run preview  # OpenNext with production parity
   ```
   Open [http://localhost:8787](http://localhost:8787)

3. **Alternative Development** (UI iteration only):
   ```bash
   npm run dev      # Next.js dev server (KV won't work)
   ```
   Open [http://localhost:3001](http://localhost:3001)

### Environment Variables

Create a `.env.local` file for development:

```bash
# Session Management
SESSION_SECRET=your-32-char-random-string

# Google Sheets (production)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Optional
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
ENABLE_INVITE_CODES=true
```

### Deployment

Deploy to Cloudflare Workers with OpenNext:

```bash
# Deploy to cloud preview (testing)
npm run deploy:preview    # → Preview Worker (separate environment)

# Deploy to production
npm run deploy            # → Production Worker
```

The preview deployment creates a separate worker (`deepfunding-jury-scoring-preview`) with preview KV namespace and preview Google Sheet for safe testing. Production uses separate production KV and Google Sheet for real juror data.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── siwe/           # Authentication routes (Node runtime)
│   │   └── */              # Data routes (Node-compat runtime)
│   ├── login/              # Login screen with ENS requirement
│   └── evaluation/         # Main evaluation screens
├── components/             # Reusable UI components
├── hooks/                  # Custom React hooks (useAuth, useAutoSave)
└── lib/                    # Configuration and Google Sheets integration
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Cloudflare Pages](https://pages.cloudflare.com/) - Deployment platform documentation
- [SIWE Documentation](https://login.xyz/) - Sign-In with Ethereum standard
- [Deployment Guide](./docs/deployment.md) - Production deployment procedures
