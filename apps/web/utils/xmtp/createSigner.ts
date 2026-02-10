import type { Signer, Identifier } from '@xmtp/browser-sdk';
import { IdentifierKind } from '@xmtp/browser-sdk';

/**
 * Creates an XMTP EOA signer using the Farcaster miniapp wallet
 * @param address - The Ethereum address from the connected wallet
 * @param provider - The Ethereum provider from Farcaster miniapp SDK
 * @returns XMTP Signer object
 */
export async function createXMTPSigner(address: string, provider: any): Promise<Signer> {
  if (!provider) {
    throw new Error('Ethereum provider not available');
  }
  
  const normalizedAddress = address.toLowerCase();
  
  const accountIdentifier: Identifier = {
    identifier: normalizedAddress,
    identifierKind: IdentifierKind.Ethereum,
  };

  const signer: Signer = {
    type: 'EOA',
    getIdentifier: () => accountIdentifier,
    signMessage: async (message: string): Promise<Uint8Array> => {
      console.log('🔏 Signing message with EoA signer...');
      
      // Use the provider's request method directly to sign
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, normalizedAddress],
      });
      
      console.log('✅ Message signed');
      
      // Convert hex signature to Uint8Array
      const hexString = signature.startsWith('0x') ? signature.slice(2) : signature;
      const bytes = new Uint8Array(hexString.length / 2);
      for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
      }
      return bytes;
    },
  };

  return signer;
}
