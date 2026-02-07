import { Client, type Signer, IdentifierKind } from '@xmtp/node-sdk';
import { Wallet } from 'ethers';
import { hexToBytes } from '../../utils/xmtp-helpers';

/**
 * Session-based XMTP client cache
 * Maps userFid -> Client instance
 */
class XMTPClientManager {
  private clients: Map<string, Client> = new Map();
  private clientTimestamps: Map<string, number> = new Map();
  private readonly SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
  private wallet: Wallet | null = null;

  constructor() {
    // Initialize wallet from private key on startup
    const privateKey = process.env.XMTP_PRIVATE_KEY;
    if (privateKey) {
      this.wallet = new Wallet(privateKey);
      console.log('[XMTP] Initialized with wallet address:', this.wallet.address);
    } else {
      console.warn('[XMTP] No private key configured. Set XMTP_PRIVATE_KEY environment variable.');
    }
  }

  /**
   * Get or create XMTP client for a user
   * @param userFid - User's Farcaster ID
   * @returns XMTP Client instance
   */
  async getOrCreateClient(
    userFid: string
  ): Promise<Client> {
    if (!this.wallet) {
      throw new Error('XMTP wallet not initialized. Set XMTP_PRIVATE_KEY environment variable.');
    }

    // Check if we have a valid cached client
    const cachedClient = this.clients.get(userFid);
    const timestamp = this.clientTimestamps.get(userFid);
    
    if (cachedClient && timestamp && Date.now() - timestamp < this.SESSION_TIMEOUT) {
      // Update timestamp to extend session
      this.clientTimestamps.set(userFid, Date.now());
      return cachedClient;
    }

    // Create new client
    const client = await this.createClient();
    
    // Cache it
    this.clients.set(userFid, client);
    this.clientTimestamps.set(userFid, Date.now());
    
    return client;
  }

  /**
   * Create a new XMTP client using backend private key
   * @returns New XMTP Client instance
   */
  private async createClient(): Promise<Client> {
    if (!this.wallet) {
      throw new Error('XMTP wallet not initialized');
    }

    // Create signer from backend wallet (Node SDK format)
    const signer: Signer = {
      type: 'EOA',
      getIdentifier: () => ({
        identifier: this.wallet!.address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      }),
      signMessage: async (message: string): Promise<Uint8Array> => {
        const signature = await this.wallet!.signMessage(message);
        return hexToBytes(signature);
      }
    };

    // Convert encryption key to Uint8Array
    const dbEncryptionKey = hexToBytes(encryptionKey);

    // Create XMTP client
    const client = await Client.create(signer, {
      eUse a consistent encryption key from environment or generate one
    const dbEncryptionKeyHex = process.env.XMTP_DB_ENCRYPTION_KEY || 
      '0000000000000000000000000000000000000000000000000000000000000000';
    const dbEncryptionKey = hexToBytes(dbEncryptionKeyHex
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
