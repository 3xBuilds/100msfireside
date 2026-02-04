import { Client, type Signer } from '@xmtp/node-sdk';
import { hexToBytes } from '../../utils/xmtp-helpers';

/**
 * Session-based XMTP client cache
 * Maps userFid -> Client instance
 */
class XMTPClientManager {
  private clients: Map<string, Client> = new Map();
  private clientTimestamps: Map<string, number> = new Map();
  private readonly SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds

  /**
   * Get or create XMTP client for a user
   * @param userFid - User's Farcaster ID
   * @param walletAddress - User's connected wallet address
   * @param encryptionKey - User's XMTP encryption key (hex string)
   * @param signMessage - Function to sign messages (from frontend wallet)
   * @returns XMTP Client instance
   */
  async getOrCreateClient(
    userFid: string,
    walletAddress: string,
    encryptionKey: string,
    signMessage: (message: string) => Promise<string>
  ): Promise<Client> {
    // Check if we have a valid cached client
    const cachedClient = this.clients.get(userFid);
    const timestamp = this.clientTimestamps.get(userFid);
    
    if (cachedClient && timestamp && Date.now() - timestamp < this.SESSION_TIMEOUT) {
      // Update timestamp to extend session
      this.clientTimestamps.set(userFid, Date.now());
      return cachedClient;
    }

    // Create new client
    const client = await this.createClient(walletAddress, encryptionKey, signMessage);
    
    // Cache it
    this.clients.set(userFid, client);
    this.clientTimestamps.set(userFid, Date.now());
    
    return client;
  }

  /**
   * Create a new XMTP client
   * @param walletAddress - User's wallet address
   * @param encryptionKey - Encryption key (hex string)
   * @param signMessage - Function to sign messages
   * @returns New XMTP Client instance
   */
  private async createClient(
    walletAddress: string,
    encryptionKey: string,
    signMessage: (message: string) => Promise<string>
  ): Promise<Client> {
    // Create signer from wallet
    const signer: Signer = {
      getAddress: () => walletAddress.toLowerCase(),
      signMessage: async (message: string) => {
        // Frontend will provide the signature as hex string
        const signature = await signMessage(message);
        return hexToBytes(signature);
      }
    };

    // Convert encryption key to Uint8Array
    const dbEncryptionKey = hexToBytes(encryptionKey);

    // Create XMTP client
    const client = await Client.create(signer, {
      env: process.env.XMTP_ENV === 'production' ? 'production' : 'dev',
      dbEncryptionKey,
      appVersion: 'fireside/1.0',
    });

    return client;
  }

  /**
   * Remove client from cache (on logout or error)
   * @param userFid - User's Farcaster ID
   */
  removeClient(userFid: string): void {
    this.clients.delete(userFid);
    this.clientTimestamps.delete(userFid);
  }

  /**
   * Clean up expired sessions
   */
  cleanup(): void {
    const now = Date.now();
    for (const [userFid, timestamp] of this.clientTimestamps.entries()) {
      if (now - timestamp >= this.SESSION_TIMEOUT) {
        this.removeClient(userFid);
      }
    }
  }

  /**
   * Get cached client without creating new one
   * @param userFid - User's Farcaster ID
   * @returns Client instance or undefined
   */
  getClient(userFid: string): Client | undefined {
    const timestamp = this.clientTimestamps.get(userFid);
    if (timestamp && Date.now() - timestamp < this.SESSION_TIMEOUT) {
      return this.clients.get(userFid);
    }
    return undefined;
  }
}

// Singleton instance
export const xmtpClientManager = new XMTPClientManager();

// Run cleanup every 10 minutes
setInterval(() => {
  xmtpClientManager.cleanup();
}, 600000);
