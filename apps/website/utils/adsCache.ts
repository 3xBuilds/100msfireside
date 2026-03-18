const idempotencyKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function pruneIdempotencyKeys() {
  const now = Date.now();
  idempotencyKeys.forEach((ts, key) => {
    if (now - ts > IDEMPOTENCY_TTL_MS) {
      idempotencyKeys.delete(key);
    }
  });
}

export function isDuplicateIdempotency(key?: string) {
  if (!key) return false;
  pruneIdempotencyKeys();
  if (idempotencyKeys.has(key)) return true;
  idempotencyKeys.set(key, Date.now());
  return false;
}


