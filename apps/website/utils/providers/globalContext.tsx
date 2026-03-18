"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { fetchAPI } from "@/utils/serverActions";
import { toast } from "react-toastify";
import { useAccount } from "wagmi";
import { readContractSetup } from "../contract/contractSetup";
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

  const { authenticated, ready, getAccessToken } = usePrivy();
  const { address } = useAccount();

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

  const checkSoundboardEligibilty = async (): Promise<boolean> => {
    try {
      const contract = await readContractSetup(contractAdds.fireToken, erc20Abi);
      if (!contract) {
        console.error("Failed to read contract");
        return false;
      }
      const balance = await contract.balanceOf(address);
      const readableBalance = ethers.formatEther(balance);
      return Number(readableBalance) >= 1000000;
    } catch (error) {
      console.error("Error checking soundboard eligibility:", error);
      return false;
    }
  };

  const handleSignIn = useCallback(async (): Promise<void> => {
    console.log("handleSignIn called", new Date().toISOString());
    try {
      const token = await getAccessToken();

      if (!token) {
        console.error("Failed to get Privy access token");
        setIsUserLoading(false);
        return;
      }

      const createUserRes = await fetchAPI(
        `${URL}/api/users/protected/handle`,
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

      var localUser = createUserRes.data.data.user;
      localUser.soundboardEligible = await checkSoundboardEligibilty();
      console.log("User signed in:", localUser);

      setUser(localUser);

      if (!localUser?.token || localUser?.token === "") {
        setIsPopupOpen(true);
      }
      setIsUserLoading(false);
    } catch (error) {
      console.error("Sign in error:", error);
      setIsUserLoading(false);
    }
  }, [getAccessToken, address]);

  useEffect(() => {
    if (!ready) return;

    if (authenticated) {
      handleSignIn();
    } else {
      setUser(null);
      setIsUserLoading(false);
    }
  }, [authenticated, ready, handleSignIn]);

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
