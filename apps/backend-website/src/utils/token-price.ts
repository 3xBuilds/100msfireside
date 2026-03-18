import { RedisUtils } from "../services/redis/redis-utils";

const PRICE_CACHE_KEY_PREFIX = 'token:price:';
const PRICE_CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Fetch token price from DexScreener API for Base network
 * @param contractAddress - The token contract address
 * @returns Token price in USD
 */
export const fetchTokenPrice = async (contractAddress: string): Promise<number> => {
  try {
    // Using DexScreener API for Base network token prices
    const apiUrl = `https://api.dexscreener.com/tokens/v1/base/${contractAddress}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const usableResponse = await response.json();
    
    // Check if we have valid data
    if (!usableResponse || !Array.isArray(usableResponse) || usableResponse.length === 0) {
      throw new Error('No price data available for this token');
    }

    const priceUsd = Number(usableResponse[0].priceUsd);
    
    if (isNaN(priceUsd)) {
      throw new Error('Invalid price data received');
    }

    return priceUsd;
  } catch (error) {
    console.error("Error fetching token price:", error);
    throw error;
  }
};

/**
 * Get token price with Redis caching
 * @param contractAddress - The token contract address
 * @returns Token price in USD
 */
export const getCachedTokenPrice = async (contractAddress: string): Promise<number> => {
  const cacheKey = `${PRICE_CACHE_KEY_PREFIX}${contractAddress.toLowerCase()}`;

  try {
    // Try to get cached price
    const client = await RedisUtils.getClient();
    const cachedPrice = await client.get(cacheKey);
    
    if (cachedPrice) {
      const price = parseFloat(cachedPrice);
      if (!isNaN(price) && price > 0) {
        console.log(`💰 Using cached token price: $${price}`);
        return price;
      }
    }

    // Fetch fresh price
    console.log(`🔄 Fetching fresh token price for ${contractAddress}...`);
    const price = await fetchTokenPrice(contractAddress);
    
    // Cache the price
    await client.setex(cacheKey, PRICE_CACHE_TTL, price.toString());
    console.log(`💰 Token price fetched and cached: $${price}`);
    
    return price;
  } catch (error) {
    console.error('❌ Error getting cached token price:', error);
    throw error;
  }
};

/**
 * Calculate token amount from USD value
 * @param usdAmount - Amount in USD
 * @param tokenPrice - Token price in USD
 * @returns Token amount (not in wei, just the decimal amount)
 */
export const calculateTokenAmount = (usdAmount: number, tokenPrice: number): number => {
  if (tokenPrice <= 0) {
    throw new Error('Invalid token price');
  }
  return usdAmount / tokenPrice;
};
