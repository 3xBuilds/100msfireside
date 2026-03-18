"use client"

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { createConfig, http, WagmiProvider } from 'wagmi';
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sei,
  baseSepolia,
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import { ReactNode } from 'react';

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
})
const queryClient = new QueryClient();


const WagmiQueryProvider = ({ children }:{children:ReactNode}) => {
  
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        
          {children}
       
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default WagmiQueryProvider;