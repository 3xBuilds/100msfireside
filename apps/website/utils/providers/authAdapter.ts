"use client";

import { createAuthenticationAdapter } from "@rainbow-me/rainbowkit";
import { createSiweMessage } from "viem/siwe";
import { setAuthToken, clearAuthToken } from "@/utils/auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export const authenticationAdapter = createAuthenticationAdapter({
  getNonce: async () => {
    const response = await fetch(`${BACKEND_URL}/api/wallet-auth/nonce`);
    const json = await response.json();
    return json.data.nonce;
  },

  createMessage: ({ nonce, address, chainId }) => {
    return createSiweMessage({
      domain: window.location.host,
      address: address as `0x${string}`,
      statement: "Sign in to Fireside",
      uri: window.location.origin,
      version: "1",
      chainId,
      nonce,
    });
  },

  verify: async ({ message, signature }) => {
    const response = await fetch(`${BACKEND_URL}/api/wallet-auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });

    const json = await response.json();
    if (response.ok && json.data?.token) {
      setAuthToken(json.data.token);
      return true;
    }
    return false;
  },

  signOut: async () => {
    clearAuthToken();
  },
});
