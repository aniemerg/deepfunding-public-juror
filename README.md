# Deep Funding Public Juror

A Web3-enabled evaluation system for the Ethereum ecosystem, where qualified jurors evaluate and compare projects through multiple assessment interfaces. This system addresses systematic bias in value multiplier estimates by using targeted question types and contextualized comparisons.

## Features

- **Web3 Authentication**: Login with Ethereum wallets (MetaMask, WalletConnect, etc.) using SIWE (Sign-In with Ethereum) ✅
- **ENS Name Requirement**: Users must have ENS names ending in .eth to participate ✅  
- **Progressive Data Collection**: Multi-screen evaluation process with session persistence ✅
- **Auto-save & Manual Submit**: Work is auto-saved to Cloudflare KV, submitted to Google Sheets on user action ✅
- **Human-Readable Data**: Structured Google Sheets format for data team analysis (no JSON blobs) ✅
- **Audit Trail**: Complete history in Google Sheets with append-only architecture ✅
- **Edge Performance**: Global distribution with Cloudflare Workers ✅
- **Three-Tier Persistence**: Local State → KV (auto-save) → Google Sheets (submit) ✅

## Architecture

- **Frontend**: Next.js 15 with React 19, vanilla CSS
- **Authentication**: Web3 wallet-based with ENS requirement and cryptographic proof  
- **Storage**: 3-tier persistence (Local State → Cloudflare KV → Google Sheets)
- **Data Format**: Human-readable structured sheets, ENS names as primary identifiers
- **Deployment**: Cloudflare Pages with OpenNext adapter
- **Runtime**: Node.js compatibility mode for universal KV access

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

Deploy to Cloudflare Pages with OpenNext:

```bash
npm run build    # OpenNext build
npm run deploy   # Deploy to Cloudflare Pages
```

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

## Implementation Status

### ✅ Completed Infrastructure
- **Web3 Authentication**: SIWE-based wallet login with ENS requirement and session management
- **ENS Integration**: Real-time ENS detection, requirement enforcement, primary identifier system
- **Data Persistence**: Three-tier architecture (Local → KV → Google Sheets)
- **Human-Readable Data**: Structured Google Sheets with named tabs, no JSON blobs
- **Session Tracking**: Automatic login logging with ENS+address mapping to Sessions sheet
- **Clean UI**: ENS names displayed to users, addresses tracked in backend
- **API Layer**: Node.js compatibility runtime with universal KV access
- **Auto-save System**: 1-second debounced auto-save to Cloudflare KV
- **Submission System**: Manual submit to Google Sheets with append-only audit trail
- **Progress Tracking**: User progress monitoring and recovery

### 🚧 Next Steps
- Design and implement evaluation screen interfaces
- Create specific evaluation workflows (background, scale, comparison, etc.)
- Add progress visualization and navigation
- Implement screen validation and data schemas
- Create admin interface for data analysis

### 🏗️ Ready for Development
The core infrastructure is complete and ready for evaluation screen development. All data persistence, authentication, and submission systems are functional.
