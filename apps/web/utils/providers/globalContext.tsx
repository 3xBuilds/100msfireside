"use client";

// import { useMiniKit } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/miniapp-sdk";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { generateNonce } from "@farcaster/auth-client";
import { useAddFrame, useMiniKit, useNotification } from "@coinbase/onchainkit/minikit";
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

  const {context} = useMiniKit()
  const {address} = useAccount()

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // useEffect for sign-in moved to a single place with hasRunRef check below

  const getNonce = async (): Promise<string> => {
    try {
      const nonce = await generateNonce();
      if (!nonce) throw new Error("Unable to generate nonce");
      return nonce;
    } catch (error) {
      console.error("Error in getNonce:", error);
      throw error;
    }
  };

  const checkSoundboardEligibilty = async (): Promise<boolean> => {
    try {
      // toast.info("Checking soundboard eligibility...");
      const contract = await readContractSetup(contractAdds.fireToken, erc20Abi);
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
  }

  const handleSignIn = async (): Promise<void> => {
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      var token: any;
      if (env !== "DEV" && !token) {
        const nonce = await getNonce();

        await sdk.actions.signIn({ nonce });

        token = (await sdk.quickAuth.getToken()).token;
      }

      const URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const createUserRes = await fetchAPI(
        `${URL}/api/users/protected/handle`,
        {
          method: "POST",
          authToken: token,
        }
      );

      if (!createUserRes.ok) {
        console.error("Failed to create user:", createUserRes.data);
      }



      var localUser = createUserRes.data.data.user;
      localUser.soundboardEligible = await checkSoundboardEligibilty();
      console.log("User signed in:", localUser);
      
      if(context){
        localUser.pfp_url = context.user.pfpUrl;
        localUser.username = context?.user.username;
      }
      
      // Add wallet address from wagmi if not present
      if (address && !localUser.wallet) {
        localUser.wallet = address;
        console.log("Added wallet address to user:", address);
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
    if (!context && process.env.NEXT_PUBLIC_ENV !== "DEV") return;
    
    (async () => {
      await handleSignIn();
     
      if (process.env.NEXT_PUBLIC_ENV !== "DEV") {
         sdk.actions.ready();
      await sdk.actions.requestCameraAndMicrophoneAccess();

        try {
          
          console.log(
            "[HMS Action - CallClient] Microphone and camera permissions granted"
          );
        } catch (permissionError) {
          console.warn(
            "[HMS Action - CallClient] Microphone/camera permission denied:",
            permissionError
          );
          // Continue with room join even if permissions are denied
          // User can grant permissions later when they try to unmute
        }
      }
    })();
  }, [context, address]);

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
