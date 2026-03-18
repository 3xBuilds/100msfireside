import { createConfig, http } from '@wagmi/core'
import { base, mainnet, sepolia } from '@wagmi/core/chains'

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
})