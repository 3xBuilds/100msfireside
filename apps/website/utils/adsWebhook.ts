import crypto from 'crypto';

function safeTimingEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyAdsWebhook(signatureHeader: string | undefined, timestamp: string | undefined, body: string, envSecret: string) {
  if (!signatureHeader || !timestamp) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', envSecret).update(`${timestamp}.${body}`).digest('hex');
  return safeTimingEqual(expected, signatureHeader || '');
}


