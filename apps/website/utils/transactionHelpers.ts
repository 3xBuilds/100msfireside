import { toast } from "react-toastify";
import { createBaseAccountSDK, getCryptoKeyAccount, base } from "@base-org/account";
import { numberToHex } from "viem";
import { checkStatus } from "./checkStatus";

export interface TransactionCall {
  to: `0x${string}`;
  value?: bigint | string;
  data?: `0x${string}`;
}

export interface ExecuteTransactionOptions {
  calls: TransactionCall[];
  clientFid?: number;
  sendCalls?: any;
  onSuccess?: () => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Executes a transaction using either Base SDK (for clientFid 309857) or standard sendCalls
 * @param options - Transaction options including calls, clientFid, and callbacks
 * @returns Promise that resolves when transaction is complete
 */
export async function executeTransaction({
  calls,
  clientFid,
  sendCalls,
  onSuccess,
  onError,
}: ExecuteTransactionOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (clientFid === 309857) {
      
      const provider = createBaseAccountSDK({
        appName: "Fireside",
        appLogoUrl: "https://firesidebase.vercel.app/app-icon2.png",
        appChainIds: [base.constants.CHAIN_IDS.base],
      }).getProvider();

      const cryptoAccount = await getCryptoKeyAccount();
      const fromAddress = cryptoAccount?.account?.address;

      const callsId: any = await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "1.0",
            chainId: numberToHex(base.constants.CHAIN_IDS.base),
            from: fromAddress,
            calls,
          },
        ],
      });


      const result = await checkStatus(callsId);

      if (result.success === true) {
        toast.success("Transaction confirmed!", {toastId: 2000});
        if (onSuccess) {
          await onSuccess();
        }
        return { success: true };
      } else {
        toast.error("Transaction failed or timed out", {toastId: 2000});
        return { success: false, error: "Transaction failed or timed out" };
      }
    } else {
      // Standard sendCalls flow
      if (!sendCalls) {
        throw new Error("sendCalls function is required for standard flow");
      }
      // @ts-ignore
      sendCalls({ calls });
      return { success: true };
    }
  } catch (error) {
    console.error("Error executing transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    toast.error(`Transaction failed: ${errorMessage}`);
    if (onError) {
      onError(error instanceof Error ? error : new Error(errorMessage));
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Converts transaction calls for Base SDK compatibility (clientFid 309857)
 * Converts BigInt values to hex strings
 */
export function prepareCallsForBaseSDK(
  calls: TransactionCall[],
  clientFid?: number
): TransactionCall[] {
  if (clientFid === 309857) {
    return calls.map(call => ({
      ...call,
      value: typeof call.value === 'bigint' ? numberToHex(call.value) : call.value,
    }));
  }
  return calls;
}
