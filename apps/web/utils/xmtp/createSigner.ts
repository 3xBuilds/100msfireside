import type { Signer, Identifier } from '@xmtp/browser-sdk';
import { IdentifierKind } from '@xmtp/browser-sdk';
import { ethers } from 'ethers';
import sdk from '@farcaster/miniapp-sdk';

/**
 * Creates an XMTP EOA signer using the Farcaster miniapp wallet
 * @param address - The Ethereum address from the connected wallet
 * @returns XMTP Signer object
 */
export async function createXMTPSigner(address: string): Promise<Signer> {
  const provider = await sdk.wallet.getEthereumProvider();
  const ethersProvider = new ethers.BrowserProvider(provider);
  
  const accountIdentifier: Identifier = {
    identifier: address,
    identifierKind: IdentifierKind.Ethereum,
  };

  const signer: Signer = {
    type: 'EOA',
    getIdentifier: () => accountIdentifier,
    signMessage: async (message: string): Promise<Uint8Array> => {
      const ethersSigner = await ethersProvider.getSigner();
      const signature = await ethersSigner.signMessage(message);
      return ethers.getBytes(signature);
    },
  };

  return signer;
}
