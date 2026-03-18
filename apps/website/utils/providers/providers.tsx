"use client";

import { AgoraProvider } from "@/contexts/AgoraContext";
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "wagmi/chains";
import { ReactNode, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import WagmiQueryProvider from "./wagmiQueryProvider";
import { GlobalProvider } from "./globalContext";
import { initViewportFix } from "../viewport";

interface ProvidersProps {
  children: ReactNode;
}

import ProgressBar from "@/components/UI/ProgressBar";

export default function Providers({ children }: ProvidersProps) {
  // Initialize viewport fix for mobile
  useEffect(() => {
    const cleanup = initViewportFix();
    return cleanup;
  }, []);

  return (
    <>
      <ProgressBar />
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
        config={{
          loginMethods: ["twitter", "wallet"],
          appearance: {
            theme: "dark",
            accentColor: "#FF6B00",
            walletList: ["metamask", "rainbow", "wallet_connect"],
          },
        }}
      >
        <GlobalProvider>
          <WagmiQueryProvider>
            <AgoraProvider>{children}</AgoraProvider>
          </WagmiQueryProvider>
        </GlobalProvider>
      </PrivyProvider>
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
          background: '#000000',
          color: '#fff',
          border: '1px solid #141414',
          zIndex: 9999,
        }}
      />
    </>
  );
}
