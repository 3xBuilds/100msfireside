import { useState, useEffect } from 'react';
import type { Signer } from '@xmtp/browser-sdk';
import { createXMTPSigner } from '../utils/xmtp/createSigner';
import sdk from '@farcaster/miniapp-sdk';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { useAccount } from 'wagmi';

/**
 * Hook to create and manage XMTP signer using Farcaster miniapp wallet
 * @returns {signer, isLoading, error} - XMTP signer object, loading state, and error
 */
export function useXMTPSigner() {
  const { user } = useGlobalContext();
  const {address} = useAccount()
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('useXMTPSigner - Effect triggered with address:', address);
    async function initializeSigner() {
      if (!address) {
        console.log('⏳ useXMTPSigner - Waiting for user wallet...');
        setIsLoading(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🔄 useXMTPSigner - Creating EoA signer with wallet:', address);
        
        let provider;
        
        // Try to get ethereum provider from Farcaster miniapp SDK
        try {
          provider = await sdk.wallet.getEthereumProvider();
          console.log('✅ Got Ethereum provider from Farcaster miniapp');
        } catch (miniappError) {
          console.log('⚠️ Farcaster miniapp provider not available, falling back to browser wallet');
          
          // Fallback to browser wallet (MetaMask, etc.)
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            provider = (window as any).ethereum;
            console.log('✅ Got Ethereum provider from browser wallet');
          } else {
            throw new Error('No Ethereum provider available (neither Farcaster miniapp nor browser wallet)');
          }
        }

        console.log('🔄 Creating XMTP signer with provider:', provider);
        
        const xmtpSigner = await createXMTPSigner(address, provider);
        setSigner(xmtpSigner);
        console.log('✅ XMTP EoA signer created for address:', address);
      } catch (err) {
        console.error('❌ Failed to create XMTP signer:', err);
        setError(err instanceof Error ? err : new Error('Failed to create XMTP signer'));
        setSigner(null);
      } finally {
        setIsLoading(false);
      }
    }

    initializeSigner();
  }, [address]);

  return { signer, isLoading, error };
}
