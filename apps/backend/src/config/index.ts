/**
 * Centralized Configuration
 * 
 * All environment variables are loaded and validated here.
 * Other modules should import from this config instead of using process.env directly.
 */

interface Config {
  // Server Configuration
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  adsWebhookUrl: string;

  // Database Configuration
  mongodbUri: string;
  redisUrl: string;

  // External APIs
  neynarApiKey: string;
  agoraAppId: string;
  agoraAppCertificate: string;
  agoraCustomerKey: string;
  agoraCustomerSecret: string;
  bankrApiKey: string;

  // Authentication
  devHeader?: string;
  devJwtDomain?: string;
  adminToken?: string;

  // Wallet Authentication
  jwtSecret: string;
  localWalletAddress?: string;
  ensRpcUrl: string;

  // AWS/S3 Configuration
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  s3BucketName: string;

  // Feature Flags
  isDevelopment: boolean;

  // Dynamic Methods
  getHostname: (request?: any) => string;

  // Ads/Webhooks
  adsWebhookSecret: string;

  // X (Twitter) Bot
  xConsumerKey?: string;
  xConsumerSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;

  // Reward System
  rewardWalletPrivateKey: string;
  dailyLoginRewardAmount: number;
  hostRoomBaseRewardAmount: number;
  participantMilestones: { threshold: number; reward: number }[];
  // USD-based reward amounts
  dailyLoginRewardUSD: number;
  hostRoomBaseRewardUSD: number;
  participantMilestonesUSD: { threshold: number; rewardUSD: number }[];
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value!;
};

const getOptionalEnvVar = (key: string, defaultValue: string = ''): string => {
  return process.env[key] || defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
};

const frontendUrl = getEnvVar('FRONTEND_URL', 'http://localhost:3000');
const normalizedFrontendUrl = frontendUrl.replace(/\/$/, '');

export const config = {
  // Server Configuration
  port: getEnvNumber('PORT', 8000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  frontendUrl,
  adsWebhookUrl: getOptionalEnvVar('ADS_WEBHOOK_URL', `${normalizedFrontendUrl}/api/webhooks/ads`),

  // Database Configuration
  mongodbUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/fireside'),
  redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),

  // External APIs
  neynarApiKey: getOptionalEnvVar('NEYNAR_API_KEY', ''),
  agoraAppId: getOptionalEnvVar('AGORA_APP_ID', ''),
  agoraAppCertificate: getOptionalEnvVar('AGORA_APP_CERTIFICATE', ''),
  agoraCustomerKey: getOptionalEnvVar('AGORA_CUSTOMER_KEY', ''),
  agoraCustomerSecret: getOptionalEnvVar('AGORA_CUSTOMER_SECRET', ''),
  bankrApiKey: getOptionalEnvVar('BANKR_API_KEY', ''),

  // Authentication
  devHeader: getOptionalEnvVar('DEV_HEADER'),
  devJwtDomain: getOptionalEnvVar('DEV_JWT_DOMAIN'),
  adminToken: getOptionalEnvVar('ADMIN_TOKEN'),
  localFid: getEnvNumber('LOCAL_FID', 12345678),

  // Wallet Authentication
  jwtSecret: getOptionalEnvVar('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  localWalletAddress: getOptionalEnvVar('LOCAL_WALLET_ADDRESS', '0x0000000000000000000000000000000000000001'),
  ensRpcUrl: getOptionalEnvVar('ENS_RPC_URL', 'https://mainnet.base.org'),

  // AWS/S3 Configuration
  awsRegion: getEnvVar('AWS_REGION', 'us-east-1'),
  awsAccessKeyId: getEnvVar('AWS_ACCESS_KEY_ID'),
  awsSecretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY'),
  s3BucketName: getEnvVar('S3_BUCKET_NAME', 'fireside-assets'),

  // Feature Flags
  isDevelopment: getEnvVar('NODE_ENV', 'development') === 'development',

  // Ads/Webhooks
  adsWebhookSecret: getEnvVar('ADS_WEBHOOK_SECRET'),

  // X (Twitter) Bot - Optional, bot disabled if not configured
  xConsumerKey: getOptionalEnvVar('X_CONSUMER_KEY'),
  xConsumerSecret: getOptionalEnvVar('X_CONSUMER_SECRET'),
  xAccessToken: getOptionalEnvVar('X_ACCESS_TOKEN'),
  xAccessTokenSecret: getOptionalEnvVar('X_ACCESS_TOKEN_SECRET'),

  // Reward System
  rewardWalletPrivateKey: getEnvVar('REWARD_WALLET_PRIVATE_KEY'),
  dailyLoginRewardAmount: getEnvNumber('DAILY_LOGIN_REWARD_AMOUNT', 10),
  hostRoomBaseRewardAmount: getEnvNumber('HOST_ROOM_BASE_REWARD_AMOUNT', 50),
  participantMilestones: [
    { threshold: 10, reward: 25 },
    { threshold: 25, reward: 100 },
    { threshold: 50, reward: 250 },
    { threshold: 100, reward: 500 },
  ],
  // USD-based reward amounts (used for dynamic pricing)
  dailyLoginRewardUSD: 0.01,
  hostRoomBaseRewardUSD: 0.08,
  participantMilestonesUSD: [
    { threshold: 10, rewardUSD: 0.10 },
    { threshold: 50, rewardUSD: 0.50 },
    { threshold: 100, rewardUSD: 1.00 },
  ],

  // Dynamic Methods
  getHostname: (request?: any) => {
    // In development, use explicit dev domain if configured
    if (config.isDevelopment && config.devJwtDomain) {
      console.log("🔒 Using DEV_JWT_DOMAIN for hostname:", config.devJwtDomain);
      return config.devJwtDomain;
    }
    
    // Case-insensitive check for host headers
    const headers = request?.headers || {};

    console.log("This is headersssss: ",headers);
    
    let hostHeader = '';
    
    if (headers['origin'] || headers['Origin']) {
      hostHeader = headers['origin'] || headers['Origin'] || '';
    } 
    else if (typeof headers.get === 'function') {
      hostHeader = headers.get('origin') || headers.get('Origin') || '';
    }

    else if (headers instanceof Object) {
      // Convert headers to a standard object if it's an iterable Headers-like object
      const headerEntries = Object.entries(headers);
      for (const [key, value] of headerEntries) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'origin') {
          hostHeader = String(value);
          break;
        }
      }
    }
    
    console.log("🏠 Extracted host header:", hostHeader);
    if (hostHeader) {
      const hostname = hostHeader.split('https://')[1]; // Remove https:// if present
      console.log("🔒 Using programmatic hostname from request:", hostname);
      return hostname;
    }
    
    // Fallback to localhost for development when no dev domain is set
    console.log("🔒 Using fallback hostname: localhost");
    return 'localhost';
  },
};

const validateConfig = () => {
  const optional = [
    'NEYNAR_API_KEY',
    'HUNDRED_MS_MANAGEMENT_TOKEN', 
    'HUNDRED_MS_TEMPLATE_ID',
    'BANKR_API_KEY'
  ];

  const awsRequired = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];

  const xBotRequired = [
    'X_CONSUMER_KEY',
    'X_CONSUMER_SECRET',
    'X_ACCESS_TOKEN',
    'X_ACCESS_TOKEN_SECRET'
  ];

  const missingOptional = optional.filter(key => !process.env[key]);
  const missingAws = awsRequired.filter(key => !process.env[key]);
  const missingXBot = xBotRequired.filter(key => !process.env[key]);
  
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Missing optional environment variables: ${missingOptional.join(', ')}`);
    console.warn('Some features may not work correctly.');
  }

  if (missingAws.length > 0) {
    console.warn(`⚠️  Missing AWS environment variables: ${missingAws.join(', ')}`);
    console.warn('S3 uploads will not work.');
  }

  if (missingXBot.length > 0) {
    console.warn(`⚠️  Missing X Bot environment variables: ${missingXBot.join(', ')}`);
    console.warn('X Bot announcements will be disabled.');
  }
};

validateConfig();

export default config;
