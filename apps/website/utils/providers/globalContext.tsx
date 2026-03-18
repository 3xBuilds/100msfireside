"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { fetchAPI } from "@/utils/serverActions";
import { toast } from "react-toastify";
import { useAccount } from "wagmi";
import { getAuthToken, clearAuthToken } from "@/utils/auth";
import { readContractSetup } from "../contract/contractSetup";

const USER_SESSION_KEY = "fireside_user";
import { contractAdds } from "../contract/contractAdds";
import { erc20Abi } from "../contract/abis/erc20abi";
import { ethers } from "ethers";

interface GlobalContextProps {
  user: any;
  setUser: (value: any) => void;
  isUserLoading: boolean;
  setIsUserLoading: (value: boolean) => void;
  isPopupOpen: boolean;
  setIsPopupOpen: (value: boolean) => void;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);

  const { address, isConnected } = useAccount();

  const checkSoundboardEligibilty = async (): Promise<boolean> => {
    try {
      const contract = await readContractSetup(
        contractAdds.fireToken,
        erc20Abi
      );
      if (!contract) {
        console.error("Failed to read contract");
        toast.error("Failed to read contract for soundboard eligibility");
        return false;
      }
      const balance = await contract.balanceOf(address);

      console.log("User token balance:", balance.toString());
      const readableBalance = ethers.formatEther(balance);

      return Number(readableBalance) >= 1000000;
    } catch (error) {
      console.error("Error checking soundboard eligibility:", error);
      return false;
    }
  };

  const handleSignIn = async (): Promise<void> => {
    console.log("handleSignIn called", new Date().toISOString());
    try {
      const token = getAuthToken();
      if (!token) {
        console.log("No auth token found, waiting for wallet SIWE sign-in");
        setIsUserLoading(false);
        return;
      }

      // Check sessionStorage cache first
      try {
        const cached = sessionStorage.getItem(USER_SESSION_KEY);
        if (cached) {
          const cachedUser = JSON.parse(cached);
          if (cachedUser) {
            console.log("Using cached user from sessionStorage");
            setUser(cachedUser);
            setIsUserLoading(false);
            return;
          }
        }
      } catch {
        // sessionStorage not available or parse error, continue with API call
      }

      const URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const createUserRes = await fetchAPI(
        `${URL}/api/wallet-users/protected/handle`,
        {
          method: "POST",
          authToken: token,
        }
      );

      if (!createUserRes.ok) {
        console.error("Failed to create user:", createUserRes.data);
        setIsUserLoading(false);
        return;
      }

      const localUser = createUserRes.data.data.user;
      localUser.soundboardEligible = await checkSoundboardEligibilty();
      console.log("User signed in:", localUser);

      // Cache user in sessionStorage
      try {
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(localUser));
      } catch {
        // sessionStorage not available
      }

      setUser(localUser);

      if (!localUser?.token || localUser?.token === "") {
        setIsPopupOpen(true);
      }
      setIsUserLoading(false);
    } catch (error) {
      console.error("Sign in error:", error);
      setIsUserLoading(false);
    }
  };

  useEffect(() => {
    // Check for existing cookie token regardless of wallet connection
    const token = getAuthToken();
    if (token) {
      handleSignIn();
    } else {
      setIsUserLoading(false);
    }
  }, [isConnected, address]);

  // Poll for auth token changes (cookies don't fire storage events)
  useEffect(() => {
    const interval = setInterval(() => {
      const token = getAuthToken();
      if (token && !user) {
        handleSignIn();
      } else if (!token && user) {
        setUser(null);
        try {
          sessionStorage.removeItem(USER_SESSION_KEY);
        } catch {}
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <GlobalContext.Provider
      value={{
        user,
        setUser,
        isUserLoading,
        setIsUserLoading,
        isPopupOpen,
        setIsPopupOpen,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    // Return a mock context for test mode
    return {
      user: null,
      setUser: () => {},
      isUserLoading: false,
      setIsUserLoading: () => {},
      isPopupOpen: false,
      setIsPopupOpen: () => {},
    };
  }
  return context;
}
