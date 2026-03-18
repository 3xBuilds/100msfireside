"use client";

import { useEffect, useState } from "react";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { getEthPrice } from "@/utils/commons";
import { encodeFunctionData } from "viem";
import { erc20Abi } from "@/utils/contract/abis/erc20abi";
import { firebaseAdsAbi } from "@/utils/contract/abis/firebaseAdsAbi";
import { contractAdds } from "@/utils/contract/contractAdds";
import {
  createBaseAccountSDK,
  getCryptoKeyAccount,
  base,
} from "@base-org/account";
import { readContract } from "@wagmi/core";
import Background from "@/components/UI/Background";
import NavigationWrapper from "@/components/NavigationWrapper";
import AdsPurchaseForm from "@/components/AdsPurchaseForm";
import { toast } from "react-toastify";
import { useAuthToken } from "@/hooks/useAuthToken";
import { checkStatus } from "@/utils/checkStatus";
import { useSendCalls } from "wagmi";
import { executeTransaction, type TransactionCall } from "@/utils/transactionHelpers";

export default function PurchaseAdPage() {
  const { user } = useGlobalContext();
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { getToken } = useAuthToken();
  const { sendCalls, isSuccess, status } = useSendCalls();

  const [formData, setFormData] = useState<FormData | null>(null);

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  useEffect(() => {
    const handleStatusChange = async () => {
      if (isSuccess) {
        toast.success("Transaction successful!");
        await createOnBackend();
      } else if (status === "error") {
        toast.error("Transaction failed. Please try again.");
        setProcessing(false);
        setCreating(false);
        console.error("Transaction failed");
      }
    };

    if (isSuccess || status === "error") {
      handleStatusChange().catch((err) => {
        console.error("Status handling failed", err);
        toast.error("Something went wrong while processing the transaction status.");
        setProcessing(false);
        setCreating(false);
      });
    }
  }, [isSuccess, status]);

  const handleERC20Payment = async (price: number, formData: FormData) => {
    try {
      setProcessing(true);
      setCreating(true);
      
      if(!formData) {
        toast.error("Form data is not set");
        setProcessing(false);
        setCreating(false);
        return;
      }
      setFormData(formData);
      
      const distributorAddress = process.env.NEXT_PUBLIC_ADS_DISTRIBUTOR;
      if (!distributorAddress) {
        toast.error("Distributor address not set");
        return;
      }

      const revenueAddress = process.env.NEXT_PUBLIC_ADS_REVENUE;
      if (!revenueAddress) {
        toast.error("Revenue address not set");
        return;
      }

      const usdcAmountToSend = BigInt(Math.floor((price / 2) * 1e6)); // USDC has 6 decimals

      const viewers_call = {
        to: USDC_ADDRESS as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [distributorAddress, usdcAmountToSend],
        }),
      };

      const revenue_call = {
        to: USDC_ADDRESS as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [revenueAddress, usdcAmountToSend],
        }),
      };

      const sendingCalls: TransactionCall[] = [viewers_call, revenue_call];

      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: undefined,
        sendCalls,
        onSuccess: async () => {
          await createOnBackend();
        },
      });

      if (!result.success) {
        setProcessing(false);
        setCreating(false);
      }

      return result;
    } catch (err) {
      console.error("ERC20 Payment Error:", err);
      toast.error("Failed to process ERC20 payment.");
      setProcessing(false);
      setCreating(false);
    }
  };

  const handleEthPayment = async (price:number, formData: FormData) => {
    try {
      setProcessing(true);
      setCreating(true);
      
      if(!formData) {
        toast.error("Form data is not set");
        setProcessing(false);
        setCreating(false);
        return;
      }
      setFormData(formData);
      
      const distributorAddress = process.env.NEXT_PUBLIC_ADS_DISTRIBUTOR;
      if (!distributorAddress) {
        toast.error("Distributor address not set");
        setProcessing(false);
        setCreating(false);
        return;
      }

      const revenueAddress = process.env.NEXT_PUBLIC_ADS_REVENUE;
      if (!revenueAddress) {
        toast.error("Revenue address not set");
        setProcessing(false);
        setCreating(false);
        return;
      }

      const ethPriceUsd = await getEthPrice();
      if (!ethPriceUsd) {
        toast.error("Failed to fetch ETH price");
        setProcessing(false);
        setCreating(false);
        return;
      }
      
      // Convert USD to ETH
      const tipAmountETH = price / (2*ethPriceUsd);

      // Convert ETH to Wei
      const ethValueInWei = BigInt(Math.floor(tipAmountETH * 1e18));

      const viewers_call = {
        to: distributorAddress as `0x${string}`,
        value: ethValueInWei,
      };

      const revenue_call = {
        to: revenueAddress as `0x${string}`,
        value: ethValueInWei,
      };

      const sendingCalls: TransactionCall[] = [viewers_call, revenue_call];

      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: undefined,
        sendCalls,
        onSuccess: async () => {
          await createOnBackend();
        },
      });

      if (!result.success) {
        setProcessing(false);
        setCreating(false);
      }

      return result;

    } catch (err) {
      console.error("ETH Payment Error:", err);
      toast.error("Failed to process ETH payment.");
      setProcessing(false);
      setCreating(false);
    }
  };

  const createOnBackend = async () => {
    if(!formData) {
      toast.error("Form data is not set");
      setProcessing(false);
      setCreating(false);
      return;
    };
    if (!user?.privyId) {
      toast.error("User not authenticated");
      setProcessing(false);
      setCreating(false);
      return;
    }

    // Debug: Log FormData contents
    console.log("FormData contents:");
    const entries = Array.from(formData.entries());
    entries.forEach(([key, value]) => {
      if (value instanceof File) {
        console.log(
          `${key}: File(name: ${value.name}, size: ${value.size}, type: ${value.type})`
        );
      } else {
        console.log(`${key}: ${value}`);
      }
    });

    const backend =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    console.log("Making request to:", `${backend}/api/ads/protected/create`);
    console.log("User ID:", user.privyId);

    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let authHeader = "Bearer dev";
      if (env !== "DEV") {
        const tokenResponse = await getToken();
        authHeader = `Bearer ${tokenResponse}`;
      }

      const res = await fetch(`${backend}/api/ads/protected/create`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
        body: formData,
      });

      console.log("Response status:", res.status);
      console.log(
        "Response headers:",
        Object.fromEntries(res.headers.entries())
      );

      const responseText = await res.text();
      console.log("Raw response:", responseText);

      if (!res.ok) {
        let errorMessage = "Failed to create ad";
        try {
          const err = JSON.parse(responseText);
          errorMessage = err?.error || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorMessage = `HTTP ${res.status}: ${responseText}`;
        }
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const result = JSON.parse(responseText);
      toast.success("Advertisement created successfully!");
      setProcessing(false);
      setCreating(false);
      return result;
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      toast.error("Failed to create advertisement. Please try again.");
      setProcessing(false);
      setCreating(false);
      throw fetchError;
    }
  };
  return (
    <>
      <AdsPurchaseForm handleETHPayment={handleEthPayment} handleERC20Payment={handleERC20Payment} loading={processing} />
      <NavigationWrapper />
    </>
  );
}
