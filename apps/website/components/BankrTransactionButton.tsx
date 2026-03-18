'use client';

import { useState, useEffect } from 'react';
import { useSendCalls } from 'wagmi';
import { useAuthToken } from '@/hooks/useAuthToken';
import { toast } from 'react-toastify';
import { executeTransaction, type TransactionCall } from '@/utils/transactionHelpers';
import { confirmBankrTransaction } from '@/utils/serverActions';

interface BankrChatTransaction {
  type: string;
  chainId: number;
  to: string;
  data?: string;
  value?: string;
  gas?: string;
  description?: string;
  status?: 'pending' | 'executed' | 'confirmed' | 'failed';
  txHash?: string;
}

interface BankrTransactionButtonProps {
  transactions: BankrChatTransaction[];
  messageId: string;
  roomId: string;
  isPrompter: boolean;
  onTransactionComplete?: (messageId: string, txHash: string, status: 'confirmed' | 'failed') => void;
}

// Transaction type display mappings
const TX_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  transfer_erc20: { label: 'Send', emoji: '💸' },
  transfer_eth: { label: 'Send ETH', emoji: '💰' },
  swap: { label: 'Swap', emoji: '🔄' },
  approval: { label: 'Approve', emoji: '✅' },
  swapCrossChain: { label: 'Bridge', emoji: '🌉' },
  buy_nft: { label: 'Buy NFT', emoji: '🎨' },
  transfer_nft: { label: 'Send NFT', emoji: '🖼️' },
  avantisTrade: { label: 'Trade', emoji: '📈' },
  manage_bankr_staking: { label: 'Stake', emoji: '🔒' },
};

export function BankrTransactionButton({
  transactions,
  messageId,
  roomId,
  isPrompter,
  onTransactionComplete
}: BankrTransactionButtonProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txStatus, setTxStatus] = useState<'pending' | 'executed' | 'confirmed' | 'failed'>('pending');
  const { sendCalls, isSuccess, status } = useSendCalls();
  const { getToken } = useAuthToken();

  // Handle transaction status changes and confirm with backend
  useEffect(() => {
    const confirmTransaction = async (finalStatus: 'confirmed' | 'failed') => {
      try {
        const env = process.env.NEXT_PUBLIC_ENV;
        let token: string | null = null;
        if (env !== 'DEV') {
          token = await getToken();
        }
        
        await confirmBankrTransaction(roomId, messageId, {
          status: finalStatus,
          txHash: '' // TODO: Get actual txHash from wagmi if available
        }, token);
      } catch (error) {
        console.error('[Bankr TX] Failed to confirm transaction with backend:', error);
      }
    };

    if (isSuccess && txStatus === 'executed') {
      setTxStatus('confirmed');
      toast.success('Transaction confirmed!');
      confirmTransaction('confirmed');
      onTransactionComplete?.(messageId, '', 'confirmed');
    } else if (status === 'error' && txStatus === 'executed') {
      setTxStatus('failed');
      toast.error('Transaction failed');
      confirmTransaction('failed');
      onTransactionComplete?.(messageId, '', 'failed');
    }
  }, [isSuccess, status, txStatus, messageId, roomId, onTransactionComplete]);

  // Don't show button if not the prompter or no transactions
  if (!isPrompter || transactions.length === 0) {
    return null;
  }

  // Don't show button if already confirmed or failed
  const firstTx = transactions[0];
  if (firstTx.status === 'confirmed' || firstTx.status === 'failed') {
    return (
      <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${
        firstTx.status === 'confirmed' 
          ? 'bg-green-500/20 text-green-300' 
          : 'bg-red-500/20 text-red-300'
      }`}>
        {firstTx.status === 'confirmed' ? '✅ Transaction confirmed' : '❌ Transaction failed'}
        {firstTx.txHash && (
          <a 
            href={`https://basescan.org/tx/${firstTx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline hover:no-underline"
          >
            View
          </a>
        )}
      </div>
    );
  }

  const handleExecute = async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setTxStatus('executed');

    try {
      // Build transaction calls from Bankr transactions
      const calls: TransactionCall[] = transactions.map(tx => ({
        to: tx.to as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : BigInt(0),
        data: (tx.data || '0x') as `0x${string}`
      }));

      const result = await executeTransaction({
        calls,
        clientFid: undefined,
        sendCalls,
        onSuccess: async () => {
          console.log('[Bankr TX] Transaction executed successfully');
        },
        onError: (error) => {
          console.error('[Bankr TX] Transaction failed:', error);
          setTxStatus('failed');
        }
      });

      if (!result.success) {
        setTxStatus('failed');
        toast.error(result.error || 'Transaction failed');
      }
    } catch (error) {
      console.error('[Bankr TX] Error executing transaction:', error);
      setTxStatus('failed');
      toast.error('Failed to execute transaction');
    } finally {
      setIsExecuting(false);
    }
  };

  // Get display info for the transaction
  const txType = firstTx.type;
  const typeInfo = TX_TYPE_LABELS[txType] || { label: 'Execute', emoji: '⚡' };
  const description = firstTx.description || `${typeInfo.label} transaction`;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs text-blue-300/70">
        {transactions.length > 1 
          ? `${transactions.length} transactions to sign` 
          : description
        }
      </div>
      <button
        onClick={handleExecute}
        disabled={isExecuting || txStatus !== 'pending'}
        className={`
          w-full px-4 py-2.5 rounded-lg font-medium text-sm
          flex items-center justify-center gap-2
          transition-all duration-200
          ${isExecuting || txStatus !== 'pending'
            ? 'bg-blue-500/30 text-blue-300/50 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
          }
        `}
      >
        {isExecuting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Signing...
          </>
        ) : txStatus === 'executed' ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Confirming...
          </>
        ) : (
          <>
            <span>{typeInfo.emoji}</span>
            {typeInfo.label}
          </>
        )}
      </button>
    </div>
  );
}
