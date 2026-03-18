const TOKEN_KEY = "fireside_auth_token";
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export function setAuthToken(token: string): void {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // document not available (SSR)
  }
}

export function getAuthToken(): string | null {
  try {
    const cookies = document.cookie.split("; ");
    const match = cookies.find((c) => c.startsWith(`${TOKEN_KEY}=`));
    if (!match) return null;

    const token = decodeURIComponent(match.split("=").slice(1).join("="));
    if (!token) return null;

    // Check if token is expired by decoding the JWT payload
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuthToken();
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  try {
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  } catch {
    // document not available (SSR)
  }
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
