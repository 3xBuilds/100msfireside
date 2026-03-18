"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { AgoraProvider } from "@/contexts/AgoraContext";
import { ReactNode, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  RainbowKitAuthenticationProvider,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmiConfig";
import { authenticationAdapter } from "./authAdapter";
import { GlobalProvider } from "./globalContext";
import { initViewportFix } from "../viewport";
import { getAuthToken } from "@/utils/auth";

import ProgressBar from "@/components/UI/ProgressBar";

const queryClient = new QueryClient();

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [authStatus, setAuthStatus] = useState<
    "loading" | "unauthenticated" | "authenticated"
  >("loading");

  // Check for existing auth token on mount
  useEffect(() => {
    const token = getAuthToken();
    setAuthStatus(token ? "authenticated" : "unauthenticated");
  }, []);

  // Initialize viewport fix for mobile
  useEffect(() => {
    const cleanup = initViewportFix();
    return cleanup;
  }, []);

  // Listen for auth state changes via polling (cookies don't fire storage events)
  useEffect(() => {
    const interval = setInterval(() => {
      const token = getAuthToken();
      setAuthStatus(token ? "authenticated" : "unauthenticated");
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Wrap the adapter to sync auth status on verify/signOut
  const wrappedAdapter = {
    ...authenticationAdapter,
    verify: async (params: { message: string; signature: string }) => {
      const result = await authenticationAdapter.verify(params);
      if (result) {
        setAuthStatus("authenticated");
      }
      return result;
    },
    signOut: async () => {
      await authenticationAdapter.signOut();
      try { sessionStorage.removeItem("fireside_user"); } catch {}
      setAuthStatus("unauthenticated");
    },
  };

  return (
    <>
      <ProgressBar />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitAuthenticationProvider
            adapter={wrappedAdapter}
            status={authStatus}
          >
            <RainbowKitProvider>
              <GlobalProvider>
                <AgoraProvider>{children}</AgoraProvider>
              </GlobalProvider>
            </RainbowKitProvider>
          </RainbowKitAuthenticationProvider>
        </QueryClientProvider>
      </WagmiProvider>
      <ToastContainer
        position="top-center"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastStyle={{
          background: "#000000",
          color: "#fff",
          border: "1px solid #141414",
          zIndex: 9999,
        }}
      />
    </>
  );
}
