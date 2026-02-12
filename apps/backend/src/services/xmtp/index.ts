import { Client, type Signer, IdentifierKind } from '@xmtp/node-sdk';
import { ethers } from 'ethers';

/**
 * XMTP Service for managing group chats in rooms
 * Uses a system wallet to create and manage groups on behalf of rooms
 */

// Cache for XMTP clients to avoid recreating them
const clientCache = new Map<string, Client>();

// Cache for created group conversations by group ID
// This avoids issues with syncing newly created groups
const groupCache = new Map<string, any>();

/**
 * Gets the system wallet credentials from environment variables
 * This wallet is used to create and manage all XMTP groups
 */
function getSystemWallet(): { address: string; privateKey: string } {
  const address = process.env.XMTP_SYSTEM_WALLET_ADDRESS;
  const privateKey = process.env.XMTP_SYSTEM_WALLET_PRIVATE_KEY;

  if (!address || !privateKey) {
    throw new Error(
      'XMTP_SYSTEM_WALLET_ADDRESS and XMTP_SYSTEM_WALLET_PRIVATE_KEY must be set in environment variables'
    );
  }

  return { address, privateKey };
}

/**
 * Creates an XMTP signer from a wallet address
 * @param walletAddress - Ethereum address of the wallet
 * @param privateKey - Private key for signing (required for server-side)
 */
function createSigner(walletAddress: string, privateKey: string): Signer {
  const wallet = new ethers.Wallet(privateKey);
  
  return {
    type: 'EOA' as const,
    getIdentifier: () => ({
      identifier: walletAddress.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const signature = await wallet.signMessage(message);
      return ethers.getBytes(signature);
    },
  };
}

/**
 * Creates or retrieves an XMTP client for a given wallet
 * @param walletAddress - Ethereum address (optional, uses system wallet if not provided)
 * @param privateKey - Private key for signing (optional, uses system wallet if not provided)
 */
export async function createXMTPClient(
  walletAddress?: string,
  privateKey?: string
): Promise<Client> {
  // Use system wallet if no credentials provided
  const wallet = walletAddress && privateKey 
    ? { address: walletAddress, privateKey }
    : getSystemWallet();

  const cacheKey = wallet.address.toLowerCase();
  
  // Return cached client if exists
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const signer = createSigner(wallet.address, wallet.privateKey);
  
  // Get encryption key from environment (required for persistent database access)
  if (!process.env.XMTP_DB_ENCRYPTION_KEY) {
    throw new Error(
      'XMTP_DB_ENCRYPTION_KEY must be set in environment variables. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  const dbEncryptionKey = Buffer.from(process.env.XMTP_DB_ENCRYPTION_KEY, 'hex');

  try {
    const client = await Client.create(signer, {
      env: process.env.XMTP_ENV === 'dev' ? 'dev' : 'production',
      dbEncryptionKey,
    });

    clientCache.set(cacheKey, client);
    console.log(`✅ XMTP client created for ${wallet.address}`);
    
    return client;
  } catch (error) {
    console.error(`❌ Failed to create XMTP client for ${wallet.address}:`, error);
    throw error;
  }
}

/**
 * Gets the system XMTP client (singleton)
 * This is the main client used for managing room groups
 */
export async function getSystemClient(): Promise<Client> {
  return await createXMTPClient();
}

/**
 * Creates a new XMTP group for a room using optimistic creation
 * Optimistic groups are created locally and synced to network when members are added
 * @param client - XMTP client instance
 * @param roomId - MongoDB room ID
 * @param hostWalletAddress - Optional wallet address of the room host to add as first member
 */
export async function createXMTPGroup(
  client: Client,
  roomId: string,
  hostWalletAddress?: string
): Promise<string> {
  try {
    // Create optimistic group (stays local until members are added)
    const group = await client.conversations.createGroupOptimistic();
    
    console.log(`Created optimistic group ${group.id} for room ${roomId}. Host wallet: ${hostWalletAddress || 'none'}`);
    // Add the host as the first member to sync the group to the network
    // This ensures the group is immediately visible to all clients
    if (hostWalletAddress) {
      console.log(`Adding room host ${hostWalletAddress} to group...`);
      const hostInboxId = await getInboxIdFromAddress(client, hostWalletAddress);
      
      if (hostInboxId) {
        await group.addMembers([hostInboxId]);
        console.log(`Host ${hostWalletAddress} added to group ${group.id}`);
      } else {
        console.warn(`Host wallet ${hostWalletAddress} not registered on XMTP, group may not sync properly`);
      }
    }
    
    // Sync the group to ensure it's properly initialized
    await group.sync();
    
    // Cache the group conversation for immediate access
    groupCache.set(group.id, group);
    
    console.log(`✅ XMTP optimistic group created and synced: ${group.id} for room ${roomId}`);
    
    return group.id;
  } catch (error) {
    console.error(`❌ Failed to create XMTP group for room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Adds a member to an existing XMTP group by inbox ID
 * @param client - XMTP client instance (must be group admin)
 * @param groupId - XMTP group conversation ID
 * @param memberInboxId - InboxId of the member to add
 */
export async function addMemberToGroup(
  client: Client,
  groupId: string,
  memberInboxId: string
): Promise<void> {
  try {
    let group = groupCache.get(groupId);
    
    // If not in cache, try to find it by syncing
    if (!group) {
      console.log(`Group ${groupId} not in cache, syncing conversations...`);
      await client.conversations.syncAll();
      
      // Find the group
      const conversations = await client.conversations.list();
      console.log(`Searching for group ${groupId} among ${conversations.length} conversations...`);
      group = conversations.find(conv => conv.id === groupId);

      if (!group) {
        console.error(`Group ${groupId} not found. Available conversations:`, conversations.map(c => c.id));
        throw new Error(`Group ${groupId} not found`);
      }
      
      // Cache it for future use
      groupCache.set(groupId, group);
    } else {
      console.log(`Using cached group ${groupId}`);
    }

    // Check if member is already in group
    await group.sync();
    const members = await group.members();
    const isMember = members.some(m => m.inboxId === memberInboxId);

    if (isMember) {
      console.log(`Member ${memberInboxId} already in group ${groupId}`);
      return;
    }

    // Add the member (this also syncs optimistic groups to network)
    // Only groups (not DMs) support addMembers
    if ('addMembers' in group && typeof group.addMembers === 'function') {
      await group.addMembers([memberInboxId]);
      console.log(`Added member ${memberInboxId} to group ${groupId}`);
    } else {
      throw new Error('Cannot add members to this conversation type');
    }
  } catch (error) {
    console.error(`Failed to add member to group ${groupId}:`, error);
    throw error;
  }
}

/**
 * Adds members to an XMTP group by their Ethereum addresses
 * Converts addresses to inbox IDs before adding
 * @param client - XMTP client instance (must be group admin)
 * @param groupId - XMTP group conversation ID
 * @param addresses - Array of Ethereum addresses to add
 */
export async function addMembersWithAddresses(
  client: Client,
  groupId: string,
  addresses: string[]
): Promise<void> {
  try {
    let group = groupCache.get(groupId);
    
    // If not in cache, sync and find the group
    if (!group) {
      await client.conversations.syncAll();
      
      const conversations = await client.conversations.list();
      group = conversations.find(conv => conv.id === groupId);

      if (!group) {
        throw new Error(`Group ${groupId} not found`);
      }
      
      // Cache it for future use
      groupCache.set(groupId, group);
    }

    // Convert addresses to inbox IDs
    const inboxIds: string[] = [];
    for (const address of addresses) {
      const inboxId = await getInboxIdFromAddress(client, address);
      if (inboxId) {
        inboxIds.push(inboxId);
      } else {
        console.warn(`Skipping address ${address} - not registered on XMTP`);
      }
    }

    if (inboxIds.length === 0) {
      console.log('No valid inbox IDs to add');
      return;
    }

    // Check existing members
    await group.sync();
    const members = await group.members();
    const existingInboxIds = new Set(members.map(m => m.inboxId));
    
    // Filter out already-added members
    const newInboxIds = inboxIds.filter(id => !existingInboxIds.has(id));

    if (newInboxIds.length === 0) {
      console.log(`All members already in group ${groupId}`);
      return;
    }

    // Add new members (this also syncs optimistic groups to network)
    // Only groups (not DMs) support addMembers
    if ('addMembers' in group && typeof group.addMembers === 'function') {
      await group.addMembers(newInboxIds);
      console.log(`Added ${newInboxIds.length} members to group ${groupId}`);
    } else {
      throw new Error('Cannot add members to this conversation type');
    }
  } catch (error) {
    console.error(`Failed to add members to group ${groupId}:`, error);
    throw error;
  }
}

/**
 * Checks if addresses can receive XMTP messages
 * @param client - XMTP client instance
 * @param addresses - Array of Ethereum addresses to check
 */
export async function canMessage(
  client: Client,
  addresses: string[]
): Promise<Map<string, boolean>> {
  try {
    const identifiers = addresses.map(addr => ({
      identifier: addr.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }));

    const results = await Client.canMessage(identifiers);
    
    const resultMap = new Map<string, boolean>();
    let index = 0;
    for (const [key, value] of results.entries()) {
      resultMap.set(key, value);
      index++;
    }

    return resultMap;
  } catch (error) {
    console.error('❌ Failed to check canMessage:', error);
    throw error;
  }
}

/**
 * Gets an inbox ID from an Ethereum address
 * @param client - XMTP client instance
 * @param address - Ethereum address
 */
export async function getInboxIdFromAddress(
  client: Client,
  address: string
): Promise<string | null> {
  try {
    // Directly fetch the inbox ID using the address as an identifier
    // This is more reliable than canMessage() for newly registered wallets
    const identifier = {
      identifier: address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    };

    const inboxId = await client.fetchInboxIdByIdentifier(identifier);
    
    if (inboxId) {
      console.log(`Found inbox ID ${inboxId} for address ${address}`);
      return inboxId;
    }

    console.log(`No inbox ID found for address ${address} - wallet not registered on XMTP`);
    return null;
  } catch (error) {
    console.error(`Failed to get inbox ID for ${address}:`, error);
    return null;
  }
}

/**
 * Retrieves a group conversation by ID
 * @param client - XMTP client instance
 * @param groupId - XMTP group conversation ID
 */
export async function getGroupById(
  client: Client,
  groupId: string
): Promise<any> {
  try {
    let group = groupCache.get(groupId);
    
    // If not in cache, sync and find the group
    if (!group) {
      await client.conversations.syncAll();
      
      const conversations = await client.conversations.list();
      group = conversations.find(conv => conv.id === groupId);

      if (!group) {
        throw new Error(`Group ${groupId} not found`);
      }
      
      // Cache it for future use
      groupCache.set(groupId, group);
    }

    await group.sync();
    return group;
  } catch (error) {
    console.error(`Failed to get group ${groupId}:`, error);
    throw error;
  }
}

/**
 * Clears the client and group caches (useful for testing or cleanup)
 */
export function clearClientCache(): void {
  clientCache.clear();
  groupCache.clear();
  console.log('XMTP client and group caches cleared');
}
