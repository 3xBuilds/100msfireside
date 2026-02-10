import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Client } from '@xmtp/browser-sdk';
import type { Signer } from '@xmtp/browser-sdk';
import { useXMTPSigner } from '@/hooks/useXMTPSigner';

interface XMTPContextProps {
  client: Client | null;
  isLoading: boolean;
  error: Error | null;
  initializeClient: () => Promise<void>;
}

const XMTPContext = createContext<XMTPContextProps | undefined>(undefined);

export function XMTPProvider({ children }: { children: ReactNode }) {
  const { signer, isLoading: signerLoading, error: signerError } = useXMTPSigner();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initializeClient = async () => {
    if (!signer) {
      setError(new Error('Signer not available'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const xmtpClient = await Client.create(signer, {
        env: 'production', // or 'dev' for development
      });
      setClient(xmtpClient);
    } catch (err) {
      console.error('Failed to initialize XMTP client:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize XMTP client'));
      setClient(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (signerError) {
      setError(signerError);
    }
  }, [signerError]);

  return (
    <XMTPContext.Provider
      value={{
        client,
        isLoading: isLoading || signerLoading,
        error,
        initializeClient,
      }}
    >
      {children}
    </XMTPContext.Provider>
  );
}

export function useXMTP() {
  const context = useContext(XMTPContext);
  if (context === undefined) {
    throw new Error('useXMTP must be used within an XMTPProvider');
  }
  return context;
}
