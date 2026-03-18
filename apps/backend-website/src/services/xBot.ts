/**
 * X (Twitter) Bot Service
 * 
 * Posts to X automatically when a new fireside goes live.
 * Uses OAuth 1.0a for authentication as required by X API v2.
 * 
 * Ref: https://developer.x.com/en/docs/tutorials/how-to-create-a-twitter-bot-with-twitter-api-v2
 */

import crypto from 'crypto';

interface XBotConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface RoomInfo {
  id: string;
  name: string;
  description?: string;
  hostDisplayName: string;
  hostUsername: string;
  hostFid: number;
  topics?: string[];
  startTime?: Date | string;
}

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  verified_accounts?: Array<{
    platform: string;
    username: string;
  }>;
}

// Farcaster mini app base URL
const MINIAPP_BASE_URL = 'https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside';

// Get config from environment
const getConfig = (): XBotConfig | null => {
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return null;
  }

  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
};

/**
 * Fetch user info from Neynar API by FID
 * Ref: https://docs.neynar.com/reference/fetch-bulk-users
 */
const fetchNeynarUser = async (fid: number): Promise<NeynarUser | null> => {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.warn('[X Bot] NEYNAR_API_KEY not configured, cannot lookup user X account');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          'x-api-key': neynarApiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('[X Bot] Neynar API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.users && data.users.length > 0) {
      return data.users[0];
    }

    return null;
  } catch (error) {
    console.error('[X Bot] Error fetching user from Neynar:', error);
    return null;
  }
};

/**
 * Get X username from Neynar user if they have a verified X account
 */
const getXUsername = (user: NeynarUser): string | null => {
  if (!user.verified_accounts || user.verified_accounts.length === 0) {
    return null;
  }

  const xAccount = user.verified_accounts.find(
    (account) => account.platform === 'x' || account.platform === 'twitter'
  );

  return xAccount?.username || null;
};

/**
 * Generate OAuth 1.0a signature for X API
 */
const generateOAuthSignature = (
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string => {
  // Sort params and create parameter string
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature
  const hmac = crypto.createHmac('sha1', signingKey);
  hmac.update(signatureBaseString);
  return hmac.digest('base64');
};

/**
 * Generate OAuth 1.0a Authorization header
 */
const generateOAuthHeader = (
  method: string,
  url: string,
  config: XBotConfig
): string => {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: '1.0'
  };

  // Generate signature
  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    config.consumerSecret,
    config.accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
};

/**
 * Format a date for display in tweet
 */
const formatScheduledTime = (startTime: Date | string): string => {
  const date = new Date(startTime);
  
  // Format: "Jan 20 at 3:00 PM UTC"
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  };
  
  return date.toLocaleString('en-US', options);
};

/**
 * Format room info into a tweet for LIVE announcement
 */
const formatLiveTweet = (room: RoomInfo, xUsername: string | null): string => {
  // Use Farcaster mini app link
  const roomUrl = `${MINIAPP_BASE_URL}/call/${room.id}`;
  
  // Format host - tag if they have X account, otherwise just name
  const hostMention = xUsername ? `@${xUsername}` : room.hostDisplayName;
  
  // Build tweet text
  let tweet = `🔥 New Fireside is LIVE!\n\n`;
  tweet += `"${room.name}"\n`;
  tweet += `Hosted by ${hostMention}\n\n`;
  
  // Add topics as hashtags (limit to 3)
  if (room.topics && room.topics.length > 0) {
    const hashtags = room.topics
      .slice(0, 3)
      .map(t => `#${t.replace(/\s+/g, '')}`)
      .join(' ');
    tweet += `${hashtags}\n\n`;
  }
  
  tweet += `Join now: ${roomUrl}`;
  
  // Ensure we don't exceed 280 characters
  if (tweet.length > 280) {
    const excess = tweet.length - 280 + 3; // +3 for "..."
    const nameLimit = room.name.length - excess;
    if (nameLimit > 10) {
      tweet = tweet.replace(room.name, room.name.substring(0, nameLimit) + '...');
    }
  }
  
  return tweet.substring(0, 280);
};

/**
 * Format room info into a tweet for SCHEDULED announcement
 */
const formatScheduledTweet = (room: RoomInfo, xUsername: string | null): string => {
  // Use Farcaster mini app link
  const roomUrl = `${MINIAPP_BASE_URL}/call/${room.id}`;
  
  // Format host - tag if they have X account, otherwise just name
  const hostMention = xUsername ? `@${xUsername}` : room.hostDisplayName;
  
  // Format the scheduled time
  const scheduledTime = room.startTime ? formatScheduledTime(room.startTime) : 'soon';
  
  // Build tweet text
  let tweet = `📅 New Fireside Scheduled!\n\n`;
  tweet += `"${room.name}"\n`;
  tweet += `Hosted by ${hostMention}\n`;
  tweet += `🕐 ${scheduledTime}\n\n`;
  
  // Add topics as hashtags (limit to 3)
  if (room.topics && room.topics.length > 0) {
    const hashtags = room.topics
      .slice(0, 3)
      .map(t => `#${t.replace(/\s+/g, '')}`)
      .join(' ');
    tweet += `${hashtags}\n\n`;
  }
  
  tweet += `Set a reminder: ${roomUrl}`;
  
  // Ensure we don't exceed 280 characters
  if (tweet.length > 280) {
    const excess = tweet.length - 280 + 3; // +3 for "..."
    const nameLimit = room.name.length - excess;
    if (nameLimit > 10) {
      tweet = tweet.replace(room.name, room.name.substring(0, nameLimit) + '...');
    }
  }
  
  return tweet.substring(0, 280);
};

/**
 * Post a tweet to X
 */
export const postTweet = async (text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> => {
  const config = getConfig();
  
  if (!config) {
    console.log('[X Bot] Skipping tweet - X API credentials not configured');
    return { success: false, error: 'X API credentials not configured' };
  }

  const url = 'https://api.x.com/2/tweets';
  
  try {
    const authHeader = generateOAuthHeader('POST', url, config);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[X Bot] Failed to post tweet:', data);
      return { success: false, error: data.detail || data.title || 'Failed to post tweet' };
    }

    console.log('[X Bot] Tweet posted successfully:', data.data?.id);
    return { success: true, tweetId: data.data?.id };
  } catch (error) {
    console.error('[X Bot] Error posting tweet:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Lookup host X account helper
 */
const lookupHostXAccount = async (hostFid: number): Promise<string | null> => {
  if (!hostFid) return null;
  
  const neynarUser = await fetchNeynarUser(hostFid);
  if (neynarUser) {
    const xUsername = getXUsername(neynarUser);
    if (xUsername) {
      console.log(`[X Bot] Found X account for host: @${xUsername}`);
      return xUsername;
    } else {
      console.log('[X Bot] Host does not have a verified X account');
    }
  }
  return null;
};

/**
 * Post announcement when a fireside goes live
 */
export const announceFiresideLive = async (room: RoomInfo): Promise<void> => {
  console.log('[X Bot] Announcing live fireside:', room.name);
  
  const xUsername = await lookupHostXAccount(room.hostFid);
  const tweet = formatLiveTweet(room, xUsername);
  
  const result = await postTweet(tweet);
  
  if (result.success) {
    console.log(`[X Bot] Successfully announced live fireside "${room.name}" - Tweet ID: ${result.tweetId}`);
  } else {
    console.warn(`[X Bot] Failed to announce live fireside "${room.name}": ${result.error}`);
  }
};

/**
 * Post announcement when a fireside is scheduled
 */
export const announceFiresideScheduled = async (room: RoomInfo): Promise<void> => {
  console.log('[X Bot] Announcing scheduled fireside:', room.name);
  
  const xUsername = await lookupHostXAccount(room.hostFid);
  const tweet = formatScheduledTweet(room, xUsername);
  
  const result = await postTweet(tweet);
  
  if (result.success) {
    console.log(`[X Bot] Successfully announced scheduled fireside "${room.name}" - Tweet ID: ${result.tweetId}`);
  } else {
    console.warn(`[X Bot] Failed to announce scheduled fireside "${room.name}": ${result.error}`);
  }
};

export default {
  postTweet,
  announceFiresideLive,
  announceFiresideScheduled
};
