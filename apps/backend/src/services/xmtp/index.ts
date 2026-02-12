import { Client, type Signer, IdentifierKind } from '@xmtp/node-sdk';
import { ethers } from 'ethers';

/**
 * XMTP Service for managing group chats in rooms
 * Uses a system wallet to create and manage groups on behalf of rooms
 */


// Note: We intentionally DO NOT cache groups locally
// to ensure fresh network state on every operation

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
  const wallet = getSystemWallet();
  const signer = createSigner(wallet.address, wallet.privateKey);
  
  // Get encryption key from environment (required for persistent database access)
  if (!process.env.XMTP_DB_ENCRYPTION_KEY) {
    throw new Error(
      'XMTP_DB_ENCRYPTION_KEY must be set in environment variables. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  const dbEncryptionKey = Buffer.from(process.env.XMTP_DB_ENCRYPTION_KEY, 'hex');

  const identifier = await signer.getIdentifier();

  console.log(`✅ XMTP identifier obtained for ${wallet.address}:`, identifier);
  

  const options = {
      env:"production" as "production" | "local" | "dev",
      appVersion: 'fireside/1.0.0',
      dbEncryptionKey,
      disableDeviceSync:false
    }
  try {
    let client = await Client.build(identifier, options)

    if(!client){
      console.log(`Client.build did not return a client instance, trying Client.create...`);
      client = await Client.create(signer, options);

      console.log(`✅ XMTP client created for ${wallet.address}`);
    }
    
    // CRITICAL: Sync from network immediately after client creation
    // This ensures we have the latest conversations from the network,
    // not just what's in the local database
    console.log(`Syncing client from network to get latest state...`);
    await client.conversations.syncAll();
    await client.conversations.sync();
    
    const conversationCount = (await client.conversations.list()).length;
    console.log(`✅ Client synced - ${conversationCount} conversations available`);
    
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
 * Creates a new XMTP group for a room
 * @param client - XMTP client instance
 * @param roomId - MongoDB room ID
 * @param hostWalletAddress - Wallet address of the room host to add as first member (required)
 */
export async function createXMTPGroup(
  client: Client,
  roomId: string,
  hostWalletAddress?: string
): Promise<string> {
  try {
    if (!hostWalletAddress) {
      throw new Error('Host wallet address is required to create XMTP group');
    }

    console.log(`Getting inbox ID for host ${hostWalletAddress}...`);
    const hostInboxId = await getInboxIdFromAddress(client, hostWalletAddress);
    
    if (!hostInboxId) {
      throw new Error(`Host wallet ${hostWalletAddress} not registered on XMTP`);
    }

    console.log(`Creating group with host ${hostWalletAddress} (inbox: ${hostInboxId})...`);
    const group = await client.conversations.createGroup([hostInboxId]);
    
    console.log(`Sending welcome message to publish group to network...`);
    await group.send('Welcome to the room! 🎉');
    
    console.log(`Syncing group state to network...`);
    await group.sync();
    
    console.log(`Publishing pending messages...`);
    await group.publishMessages();
    
    console.log(`Syncing client conversations to network...`);
    await client.conversations.sync();
    
    // Final sync to ensure everything is committed
    console.log(`Final sync to commit to network...`);
    await group.sync();
    
    // Extended wait for network propagation across XMTP nodes
    console.log(`Waiting for network propagation across nodes...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify group is queryable by doing a fresh sync from network
    console.log(`Verifying group is discoverable on network...`);
    await client.conversations.syncAll();
    const conversations = await client.conversations.list();
    const verifyGroup = conversations.find(conv => conv.id === group.id);
    
    if (!verifyGroup) {
      console.warn(`⚠️ Group ${group.id} not found in conversation list after creation - may still be propagating`);
    } else {
      console.log(`✅ Group ${group.id} verified in conversation list`);
    }
    
    console.log(`✅ XMTP group created and published: ${group.id} for room ${roomId}`);
    
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
      // Aggressive sync to pull latest groups from network
      console.log(`Syncing conversations from network...`);
      await client.conversations.syncAll();
      
      // Additional sync cycle to ensure we have latest network state
      await client.conversations.sync();
      
      // Find the group
      const conversations = await client.conversations.list();
      console.log(`Searching for group ${groupId} among ${conversations.length} conversations...`);
      const group = conversations.find(conv => conv.id === groupId);

      if (!group) {
        console.error(`Group ${groupId} not found. Available conversations:`, conversations.map(c => c.id));
        throw new Error(`Group ${groupId} not found`);
      }
    

    // Check if member is already in group
    await group.sync();
    const members = await group.members();
    const isMember = members.some(m => m.inboxId === memberInboxId);

    if (isMember) {
      console.log(`Member ${memberInboxId} already in group ${groupId}`);
      return;
    }

    // Add the member and sync to network
    // Only groups (not DMs) support addMembers
    if ('addMembers' in group && typeof group.addMembers === 'function') {
      await group.addMembers([memberInboxId]);
      
      // Ensure changes are published to network
      await group.sync();
      await group.publishMessages();
      await client.conversations.sync();
      
      console.log(`✅ Added member ${memberInboxId} to group ${groupId} and synced to network`);
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
    // Always sync from network to get latest state
    await client.conversations.syncAll();
    await client.conversations.sync();
    
    const conversations = await client.conversations.list();
    const group = conversations.find(conv => conv.id === groupId);

    if (!group) {
      throw new Error(`Group ${groupId} not found`);
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

    // Add new members and sync to network
    // Only groups (not DMs) support addMembers
    if ('addMembers' in group && typeof group.addMembers === 'function') {
      await group.addMembers(newInboxIds);
      
      // Ensure changes are published to network
      await group.sync();
      await group.publishMessages();
      await client.conversations.sync();
      
      console.log(`✅ Added ${newInboxIds.length} members to group ${groupId} and synced to network`);
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
    // Always sync from network to get latest state
    await client.conversations.syncAll();
    await client.conversations.sync();
    
    const conversations = await client.conversations.list();
    const group = conversations.find(conv => conv.id === groupId);

    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    await group.sync();
    return group;
  } catch (error) {
    console.error(`Failed to get group ${groupId}:`, error);
    throw error;
  }
}

