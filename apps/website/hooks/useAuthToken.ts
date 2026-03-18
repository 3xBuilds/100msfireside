"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

/**
 * Hook that provides a function to get the current Privy access token.
 * Replaces sdk.quickAuth.getToken() from the Farcaster miniapp version.
 */
export function useAuthToken() {
  const { getAccessToken } = usePrivy();

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getAccessToken();
      return token;
    } catch (error) {
      console.error("Error getting Privy access token:", error);
      return null;
    }
  }, [getAccessToken]);

  return { getToken };
}
