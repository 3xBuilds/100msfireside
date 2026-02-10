import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import type { Signer } from '@xmtp/browser-sdk';
import { createXMTPSigner } from '../xmtp/createSigner';

/**
 * Hook to create and manage XMTP signer
 * @returns {signer, isLoading, error} - XMTP signer object, loading state, and error
 */
export function useXMTPSigner() {
  const { address, isConnected } = useAccount();
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initializeSigner() {
      if (!address || !isConnected) {
        setSigner(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const xmtpSigner = await createXMTPSigner(address);
        setSigner(xmtpSigner);
      } catch (err) {
        console.error('Failed to create XMTP signer:', err);
        setError(err instanceof Error ? err : new Error('Failed to create XMTP signer'));
        setSigner(null);
      } finally {
        setIsLoading(false);
      }
    }

    initializeSigner();
  }, [address, isConnected]);

  return { signer, isLoading, error };
}
