"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { Client, type Conversation } from '@xmtp/browser-sdk';
import type { Signer } from '@xmtp/browser-sdk';
import { IdentifierKind } from '@xmtp/browser-sdk';
import { createMessageContent, type SenderMetadata, type FormattedMessage, type MessageContent } from '@/utils/xmtp/messageHelpers';
import type { MentionData } from '@/utils/mentions';

interface XMTPMessage {
  id: string;
  senderInboxId: string;
  content: any;
  sentAt: Date;
}

interface XMTPContextProps {
  client: Client | null;
  currentGroup: Conversation | null;
  messages: XMTPMessage[];
  isLoading: boolean;
  error: Error | null;
  initializeClient: () => Promise<void>;
  joinGroup: (groupId: string) => Promise<boolean>;
  sendMessage: (text: string, sender: SenderMetadata, mentions?: MentionData[]) => Promise<void>;
  sendReply: (text: string, referenceMessage: FormattedMessage, sender: SenderMetadata, mentions?: MentionData[]) => Promise<void>;
  leaveGroup: () => void;
}

const XMTPContext = createContext<XMTPContextProps | undefined>(undefined);

export function XMTPProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<XMTPMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [streamCleanup, setStreamCleanup] = useState<(() => void) | null>(null);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Initialize XMTP client
  const initializeClient = useCallback(async () => {
    if (!address || !walletClient || !isConnected) {
      setError(new Error('Wallet not connected'));
      return;
    }

    // If client already exists for this address, don't reinitialize
    if (client) {
      console.log('✅ XMTP client already initialized for address:', address);
      return;
    }

    if (isLoading) {
      console.log('⏭️ Skipping initialization - already initializing');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Creating XMTP signer for address:', address);
      
      // Create XMTP signer from wallet client
      const signer: Signer = {
        type: 'EOA',
        getIdentifier: () => ({
          identifier: address,
          identifierKind: IdentifierKind.Ethereum,
        }),
        signMessage: async (message: string): Promise<Uint8Array> => {
          try {
            console.log('🔏 Requesting signature from wallet...');
            const signature = await walletClient.signMessage({
              message,
            });

            // Convert hex signature to Uint8Array
            const signatureBytes = new Uint8Array(
              signature.slice(2).match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
            );

            console.log('✅ Message signed successfully');
            return signatureBytes;
          } catch (err) {
            console.error('❌ Error signing message:', err);
            throw err;
          }
        },
      };

      console.log('🔄 Initializing XMTP client...');
      const xmtpEnv = (process.env.NEXT_PUBLIC_XMTP_ENV || 'dev') as 'dev' | 'production';
      console.log('🌐 Using XMTP network:', xmtpEnv);
      
      const xmtpClient = await Client.create(signer, {
        env: xmtpEnv,
      });

      setClient(xmtpClient);
      console.log('✅ XMTP client initialized successfully! Inbox ID:', xmtpClient.inboxId);
    } catch (err: any) {
      console.error('❌ Failed to initialize XMTP client:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize XMTP client'));
      setClient(null);
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, isConnected, client, isLoading]);

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (isConnected && address && walletClient && !client && !isLoading) {
      console.log('🔄 Wallet connected, auto-initializing XMTP...');
      // Small delay to ensure wallet is fully ready
      const timer = setTimeout(() => {
        initializeClient();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isConnected, address, walletClient, client, isLoading, initializeClient]);

  // Disconnect when wallet disconnects
  useEffect(() => {
    if (!isConnected && client) {
      console.log('👋 Wallet disconnected, cleaning up XMTP client');
      setClient(null);
      setCurrentGroup(null);
      setMessages([]);
      setError(null);
    }
  }, [isConnected, client]);

  // Join a group by ID
  const joinGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!client) {
      console.error('❌ Cannot join group: XMTP client not initialized');
      setError(new Error('XMTP client not initialized'));
      return false;
    }

    try {
      console.log(`🔄 Searching for group ${groupId}...`);
      
      // Retry logic with exponential backoff for finding newly created groups
      const maxRetries = 5;
      let group = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Retry attempt ${attempt}/${maxRetries - 1} - waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log(`🔄 Syncing all conversations (attempt ${attempt + 1})...`);
        await client.conversations.syncAll();
        
        const conversations = await client.conversations.list();
        console.log(`📋 Found ${conversations.length} conversations total`);
        group = conversations.find(conv => conv.id === groupId);
        
        if (group) {
          console.log(`✅ Found group ${groupId} on attempt ${attempt + 1}`);
          break;
        }
        
        console.log(`⚠️ Group ${groupId} not found on attempt ${attempt + 1}`);
      }

      if (!group) {
        console.error(`❌ Group ${groupId} not found in user's conversations`);
        setError(new Error('Group not found. You may need to be added by the room host.'));
        return false;
      }

      // Sync the group to get latest messages
      await group.sync();
      setCurrentGroup(group);
      console.log(`✅ Joined group ${groupId}`);

      // Load existing messages
      const groupMessages = await group.messages();
      const formattedMessages = groupMessages.map(msg => {
        return {
          id: msg.id,
          senderInboxId: msg.senderInboxId,
          content: msg.content,
          contentType: msg.contentType,
          sentAt: msg.sentAt,
        };
      });
      setMessages(formattedMessages);

      // Start streaming new messages from the client (not just this group)
      const stream = await client.conversations.streamAllMessages({
        onValue: (message) => {
          console.log('📨 New XMTP message:', message);
          // Only add messages from THIS group
          if (message.conversationId === groupId) {
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              const messageExists = prev.some(m => m.id === message.id);
              if (messageExists) {
                console.log('⏭️ Skipping duplicate message:', message.id);
                return prev;
              }
              
              return [...prev, {
                id: message.id,
                senderInboxId: message.senderInboxId,
                content: message.content,
                contentType: message.contentType,
                sentAt: message.sentAt,
              }];
            });
          }
        },
        onError: (error) => {
          console.error('❌ Message stream error:', error);
        }
      });

      // Store cleanup function
      setStreamCleanup(() => () => {
        // Stream cleanup happens automatically in browser SDK
        console.log('🧹 Cleaned up message stream');
      });

      return true;
    } catch (err) {
      console.error('❌ Failed to join group:', err);
      setError(err instanceof Error ? err : new Error('Failed to join group'));
      return false;
    }
  }, [client]);

  // Send a text message with sender metadata and mentions
  const sendMessage = useCallback(async (text: string, sender: SenderMetadata, mentions?: MentionData[]) => {
    if (!currentGroup) {
      throw new Error('No group joined');
    }

    try {
      // Create structured content with sender metadata and mentions
      const messageContent = createMessageContent(text, sender, mentions);
      
      // Send as text with embedded JSON metadata
      await currentGroup.sendText(JSON.stringify(messageContent));
      
      console.log('✅ Message sent with sender metadata:', sender.username);
    } catch (err) {
      console.error('❌ Failed to send message:', err);
      throw err;
    }
  }, [currentGroup]);

  // Send a reply to a message with sender metadata and mentions
  const sendReply = useCallback(async (text: string, referenceMessage: FormattedMessage, sender: SenderMetadata, mentions?: MentionData[]) => {
    if (!currentGroup) {
      throw new Error('No group joined');
    }

    try {
      // Create message content with sender metadata and mentions
      const messageContent = createMessageContent(text, sender, mentions);
      
      // Encode as JSON text and send as text message with reply metadata
      const contentString = JSON.stringify({
        ...messageContent,
        replyTo: {
          reference: referenceMessage.id,
          senderInboxId: referenceMessage.userId,
          text: referenceMessage.message,
          username: referenceMessage.username,
          displayName: referenceMessage.displayName,
          pfp_url: referenceMessage.pfp_url,
        },
      });
      
      await currentGroup.sendText(contentString);
      
      console.log('✅ Reply sent with sender metadata:', sender.username);
    } catch (err) {
      console.error('❌ Failed to send reply:', err);
      throw err;
    }
  }, [currentGroup]);

  // Leave current group and cleanup
  const leaveGroup = useCallback(() => {
    if (streamCleanup) {
      streamCleanup();
      setStreamCleanup(null);
    }
    setCurrentGroup(null);
    setMessages([]);
    console.log('👋 Left group');
  }, [streamCleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamCleanup) {
        streamCleanup();
      }
    };
  }, [streamCleanup]);

  return (
    <XMTPContext.Provider
      value={{
        client,
        currentGroup,
        messages,
        isLoading,
        error,
        initializeClient,
        joinGroup,
        sendMessage,
        sendReply,
        leaveGroup,
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
