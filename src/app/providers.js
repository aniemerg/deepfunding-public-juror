'use client'
import { WagmiProvider, http, fallback } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'fallback-id'
console.log('WalletConnect projectId:', projectId)

const config = getDefaultConfig({
  appName: 'Verdict',
  projectId,
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: fallback([
      http('https://eth.llamarpc.com'),
      http('https://rpc.ankr.com/eth'),
      http('https://eth.drpc.org'),
    ]),
    [sepolia.id]: http(),
  },
})

const queryClient = new QueryClient()

export default function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}