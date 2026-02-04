import { randomBytes } from 'crypto';

/**
 * Generate a 32-byte encryption key for XMTP
 * @returns Hex string of 32-byte key
 */
export function generateXMTPEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Convert hex string to Uint8Array for XMTP
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array of bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Uint8Array of bytes
 * @returns Hex string with 0x prefix
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ensure user has an XMTP encryption key, generate if missing
 * @param user - User model instance
 * @returns The user's encryption key
 */
export async function ensureXMTPKey(user: any): Promise<string> {
  if (!user.xmtpEncryptionKey) {
    const key = generateXMTPEncryptionKey();
    user.xmtpEncryptionKey = key;
    await user.save();
    return key;
  }
  return user.xmtpEncryptionKey;
}
