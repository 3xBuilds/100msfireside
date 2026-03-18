import { toast } from "react-toastify";

export interface TransactionCall {
  to: `0x${string}`;
  value?: bigint | string;
  data?: `0x${string}`;
}

export interface ExecuteTransactionOptions {
  calls: TransactionCall[];
  sendCalls?: any;
  onSuccess?: () => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Executes a transaction using wagmi sendCalls
 */
export async function executeTransaction({
  calls,
  sendCalls,
  onSuccess,
  onError,
}: ExecuteTransactionOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sendCalls) {
      throw new Error("sendCalls function is required");
    }
    // @ts-ignore
    sendCalls({ calls });
    return { success: true };
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
