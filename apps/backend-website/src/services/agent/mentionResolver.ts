import { AgoraAPI } from '../agoraAPI';
import { RedisRoomParticipantsService } from '../redis';

/**
 * Mention Resolver Service
 * 
 * Resolves @username and @role mentions in chat prompts to wallet addresses.
 * Used to provide wallet context to Bankr AI for transaction commands.
 */

// Supported role mentions
const ROLE_MENTIONS = ['host', 'co-host', 'speaker', 'listener', 'speakers', 'listeners'];

// Regex to match @mentions (usernames or roles)
const MENTION_REGEX = /@([\w-]+)/g;

export interface ResolvedMention {
  mention: string;        // Original mention text (e.g., "username" or "host")
  type: 'user' | 'role';
  wallets: string[];      // Wallet addresses (can be multiple for role mentions)
  usernames?: string[];   // Usernames for context
}

export interface MentionResolutionResult {
  mentions: ResolvedMention[];
  enrichedPrompt: string;
}

interface PeerMetadata {
  wallet?: string;
  avatar?: string;
  fid?: string;
}

export class MentionResolverService {
  /**
   * Parse mentions from a prompt
   */
  static parseMentions(prompt: string): string[] {
    const mentions: string[] = [];
    let match;
    
    while ((match = MENTION_REGEX.exec(prompt)) !== null) {
      mentions.push(match[1]);
    }
    
    return [...new Set(mentions)]; // Deduplicate
  }

  /**
   * Check if a mention is a role mention
   */
  static isRoleMention(mention: string): boolean {
    return ROLE_MENTIONS.includes(mention.toLowerCase());
  }

  /**
   * Normalize role name (e.g., "speakers" -> "speaker")
   */
  static normalizeRole(role: string): string {
    const normalized = role.toLowerCase();
    if (normalized === 'speakers') return 'speaker';
    if (normalized === 'listeners') return 'listener';
    return normalized;
  }

  /**
   * Parse peer metadata JSON safely
   */
  static parsePeerMetadata(metadataStr?: string): PeerMetadata {
    if (!metadataStr) return {};
    try {
      return JSON.parse(metadataStr);
    } catch {
      return {};
    }
  }

  /**
   * Resolve all mentions in a prompt to wallet addresses
   * @param prompt - The user's prompt containing @mentions
   * @param channelName - The Agora channel name (also used as roomId for Redis lookup)
   */
  static async resolveMentions(prompt: string, channelName: string): Promise<MentionResolutionResult> {
    const mentionTexts = this.parseMentions(prompt);
    
    if (mentionTexts.length === 0) {
      return { mentions: [], enrichedPrompt: prompt };
    }

    // Fetch participants from Redis (which has name, role, wallet data)
    // We need to find the MongoDB room ID from the channelName
    // channelName is stored as room.roomId in the DB
    const groupedParticipants = await RedisRoomParticipantsService.getParticipants(channelName, 'grouped', true) as Record<string, any[]>;
    
    // Flatten grouped participants into a peers-like array
    const peers: Array<{ name: string; role: string; wallet: string }> = [];
    for (const [role, participants] of Object.entries(groupedParticipants)) {
      for (const p of participants) {
        peers.push({
          name: p.username || p.displayName || 'Unknown',
          role,
          wallet: p.wallet || ''
        });
      }
    }
    
    if (peers.length === 0) {
      return { mentions: [], enrichedPrompt: prompt };
    }

    const resolvedMentions: ResolvedMention[] = [];

    for (const mentionText of mentionTexts) {
      if (this.isRoleMention(mentionText)) {
        // Role mention - find all peers with this role
        const normalizedRole = this.normalizeRole(mentionText);
        const matchingPeers = peers.filter(peer => {
          const peerRole = peer.role?.toLowerCase();
          return peerRole === normalizedRole || 
                 (normalizedRole === 'co-host' && peerRole === 'co-host');
        });

        const wallets: string[] = [];
        const usernames: string[] = [];

        for (const peer of matchingPeers) {
          if (peer.wallet) {
            wallets.push(peer.wallet);
            usernames.push(peer.name || 'Unknown');
          }
        }

        if (wallets.length > 0) {
          resolvedMentions.push({
            mention: mentionText,
            type: 'role',
            wallets,
            usernames
          });
        }
      } else {
        // User mention - find peer by name
        const matchingPeer = peers.find(peer => 
          peer.name?.toLowerCase() === mentionText.toLowerCase()
        );

        if (matchingPeer) {
          if (matchingPeer.wallet) {
            resolvedMentions.push({
              mention: mentionText,
              type: 'user',
              wallets: [matchingPeer.wallet],
              usernames: [matchingPeer.name || mentionText]
            });
          }
        }
      }
    }

    // Build enriched prompt with wallet context
    const enrichedPrompt = this.buildEnrichedPrompt(prompt, resolvedMentions);

    return { mentions: resolvedMentions, enrichedPrompt };
  }

  /**
   * Build an enriched prompt with wallet address context
   */
  static buildEnrichedPrompt(originalPrompt: string, mentions: ResolvedMention[]): string {
    if (mentions.length === 0) {
      return originalPrompt;
    }

    const walletContext = mentions.map(m => {
      if (m.type === 'role') {
        const pairs = m.wallets.map((w, i) => `${m.usernames?.[i] || 'user'}: ${w}`).join(', ');
        return `@${m.mention} (${m.wallets.length} ${m.mention}${m.wallets.length > 1 ? 's' : ''}): [${pairs}]`;
      } else {
        return `@${m.mention}: ${m.wallets[0]}`;
      }
    }).join('\n');

    return `${originalPrompt}\n\n[Wallet Context:\n${walletContext}]`;
  }

  /**
   * Quick check if a prompt has any mentions that need resolution
   */
  static hasMentions(prompt: string): boolean {
    return MENTION_REGEX.test(prompt);
  }
}
