import { base, createBaseAccountSDK } from "@base-org/account";
import { toast } from "react-toastify";

export const checkStatus = async (callsId: string, attempt: number = 1): Promise<{ success: boolean; receipts?: any }> => {

    const provider = createBaseAccountSDK({
        appName: "Fireside",
        appLogoUrl: "https://firesidebase.vercel.app/app-icon2.png",
        appChainIds: [base.constants.CHAIN_IDS.base],
    }).getProvider();

  const status:any = await provider.request({
    method: 'wallet_getCallsStatus',
    params: [callsId]
  });
  
  if (status.status === "CONFIRMED") {
    toast.success('Transaction completed successfully!', { toastId: callsId });
    return {
      success: true, receipts: status.receipts
    };
  } else if (status.status === "PENDING") {
    if (attempt < 10) { // Increased max attempts
      console.log(`Batch still pending... (Attempt ${attempt}/10)`);
      // Use a proper promise-based delay instead of setTimeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await checkStatus(callsId, attempt + 1);
    } else {
      console.error('Batch failed: Maximum retry attempts (10) reached');
      toast.error('Transaction check failed: Maximum attempts reached', { toastId: callsId });
      return { success: false };
    }
  } else {
    console.error('Batch failed with status:', status.status);
    toast.error('Transaction failed', { toastId: callsId });
    return { success: false };
  }
};