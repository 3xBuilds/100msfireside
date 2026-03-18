'use client';

import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { MdClose } from 'react-icons/md';
import { RiLoader5Fill } from "react-icons/ri";
import { FaEthereum } from "react-icons/fa";
import { BiSolidDollarCircle } from "react-icons/bi";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import Button from "@/components/UI/Button";
import Input from "@/components/UI/Input";
import { fetchRoomParticipants, fetchRoomParticipantsByRole, sendChatMessage, fetchActivePeers, fetchRoomDetails, saveTipRecord } from "@/utils/serverActions";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useAccount, useSendCalls, useSignTypedData, useWriteContract } from "wagmi";
import { encodeFunctionData, numberToHex } from "viem";
import { contractAdds } from "@/utils/contract/contractAdds";
import { firebaseTipsAbi } from "@/utils/contract/abis/firebaseTipsAbi";
import { erc20Abi } from "@/utils/contract/abis/erc20abi";
import { CiMoneyBill } from "react-icons/ci";
import { useTipEvent } from "@/utils/events";
import { useTipNotificationContext } from "@/contexts/TipNotificationContext";

import { base, createBaseAccountSDK, getCryptoKeyAccount } from "@base-org/account";
import { getAuthToken } from '@/utils/auth';
import { checkStatus } from "@/utils/checkStatus";
import { executeTransaction, type TransactionCall } from "@/utils/transactionHelpers";


interface TippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

interface Participant {
  userId: string;
  username: string;
  pfp_url: string;
  customDomain?: string;
  wallet: string;
  status: string;
  role: string;
}

export default function TippingModal({
  isOpen,
  onClose,
  roomId,
}: TippingModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customTip, setCustomTip] = useState<string>("");
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Record<string, boolean>>({
    host: false,
    "co-host": false,
    speaker: false,
    listener: false,
  });
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [firePrice, setFirePrice] = useState<number | null>(null);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  const batchSize = parseInt(process.env.NEXT_PUBLIC_BATCH_SIZE || "20");
  const { user } = useGlobalContext();
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const FIRE_ADDRESS = "0x9e68E029cBDe7513620Fcb537A44abff88a56186";
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();
  const { sendCalls, isSuccess, status  } = useSendCalls();
  const { sendTipNotification } = useTipEvent();
  const { addTipNotification } = useTipNotificationContext();

  const splitIntoBatches = (array: any[]) => {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  };

  const fetchTokenPrices = async () => {
    try {
      setIsFetchingPrices(true);
      
      // Try fetching from CoinGecko Pro API (free tier)
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );
        
        if (response.ok) {
          const ethData = await response.json();
          const ethPriceUsd = ethData?.ethereum?.usd;
          
          if (ethPriceUsd) {
            setEthPrice(ethPriceUsd);
            console.log('ETH Price fetched:', ethPriceUsd);
          }
        } else {
          console.error('CoinGecko API error:', response.status, await response.text());
        }
      } catch (ethError) {
        console.error('Error fetching ETH price from CoinGecko:', ethError);
      }

      // Try fetching FIRE price from DexScreener (more reliable for smaller tokens)
      try {
        const fireResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${FIRE_ADDRESS}`
        );
        
        if (fireResponse.ok) {
          const fireData = await fireResponse.json();
          // Get the first pair's price (usually the most liquid)
          const firePriceUsd = fireData?.pairs?.[0]?.priceUsd;
          
          if (firePriceUsd) {
            setFirePrice(parseFloat(firePriceUsd));
            console.log('FIRE Price fetched:', firePriceUsd);
          }
        } else {
          console.error('DexScreener API error:', fireResponse.status);
        }
      } catch (fireError) {
        console.error('Error fetching FIRE price from DexScreener:', fireError);
      }
    } catch (error) {
      console.error('Error fetching token prices:', error);
    } finally {
      setIsFetchingPrices(false);
    }
  };

  const lastCurrencyRef = useRef<string>("ETH");

  useEffect(() => {
    const handleTransactionStatus = async () => {
      // When transaction succeeds
      if (isSuccess) {
        
          toast.success("Transaction successful!");
        
        await processSuccess(lastCurrencyRef.current);
      }
      // When transaction fails (status === 'error')
      else if (status === "error") {
        
          toast.error("Transaction failed. Please try again.");
        
        setIsLoading(false);
        console.error("Transaction failed");
      }
    };

    handleTransactionStatus();
  }, [isSuccess, status]);

  useEffect(() => {
    if (isOpen) {
      // Fetch token prices when modal opens
      fetchTokenPrices();
    }
  }, [isOpen]);

  useEffect(() => {
    // if (showUserDropdown) {
      console.log("Dropdown opened, fetching participants...");
      setIsLoadingUsers(true);
      fetchRoomParticipants(roomId)
        .then(async (response) => {
          if (response.ok && response.data?.data?.participants) {
            const activeParticipants: Participant[] = response.data.data.participants
              .map((p: any) => ({
                userId: String(p.fid),
                username: p.username || 'Anonymous',
                pfp_url: p.avatar || '/default-avatar.png',
                wallet: p.wallet || '',
                status: 'active',
                role: p.role
              }));
            
              setParticipants(activeParticipants);

              const rolePresence: Record<string, boolean> = {
                host: false,
                "co-host": false,
                speaker: false,
                listener: false,
              };

              activeParticipants.forEach((participant: Participant) => {
                if (participant.role && rolePresence.hasOwnProperty(participant.role)) {
                  rolePresence[participant.role] = true;
                }
              });

              setAvailableRoles(rolePresence);
          }
        })
        .catch((error) => console.error("Error fetching participants:", error))
        .finally(() => setIsLoadingUsers(false));
    // }
  }, [showUserDropdown, roomId]);

  const sendTipMessage = async (
    tipper: string,
    recipients: string,
    amount: number,
    currency: string,
    userFid: string
  ) => {
    const emoji = amount >= 100 ? "💸" : amount >= 25 ? "🎉" : "👍";
    const message = `${emoji} ${tipper} tipped ${recipients} $${amount} in ${currency}!`;

    // No longer broadcasting via HMS — tip messages are stored via Redis chat

    try {
      const token = getAuthToken() || '';
      const response = await sendChatMessage(roomId, { message, userFid }, token);
      if (!response.data.success) {
        console.error("Failed to store tip message in Redis:", response.data.error);
      }
    } catch (error) {
      console.error("Error saving tip message to Redis:", error);
      // Non-critical error, don't show toast to user
    }
  };

  const processSuccess = async (currency: string = "ETH", nativeAmount: number = 0) => {
    const tipAmountUSD = selectedTip ? selectedTip : parseFloat(customTip);
    const tipper = user?.username || "Someone";
    const recipients = selectedUsers.length
      ? selectedUsers.map((user) => user.username).join(", ")
      : selectedRoles.map((role) => (role === "host" ? role : `${role}s`)).join(", ");
    
    
    // Prepare tip data for Redis
    const tipData = {
      tipper: {
        userId: user?.fid || "unknown",
        username: user?.username || "Someone",
        pfp_url: user?.pfp_url || "",
      },
      recipients: selectedUsers.length
        ? selectedUsers.map((u) => ({
            userId: u.userId,
            username: u.username,
            pfp_url: u.pfp_url,
          }))
        : selectedRoles.map((role) => ({ role })),
      amount: {
        usd: tipAmountUSD,
        currency,
        native: nativeAmount,
      },
    };

    try {
      // Save to Redis
      const token = getAuthToken() || '';
      await saveTipRecord(roomId, tipData, token);

      // Emit tip event
      const tipEventData = {
        roomId,
        tipper: {
          username: tipData.tipper.username,
          pfp_url: tipData.tipper.pfp_url,
        },
        recipients: tipData.recipients,
        amount: tipData.amount,
        timestamp: new Date().toISOString(),
      };
      sendTipNotification(tipEventData);
      
      // Add to local context so the tipper sees the animation
      addTipNotification(tipEventData);
    } catch (error) {
      console.error("Error saving tip record:", error);
      // Non-critical error, don't interrupt the flow
    }

    onClose();
    setSelectedUsers([]);
    setSelectedRoles([]);
    setSelectedTip(null);
    setCustomTip("");
    setIsLoading(false);
  };

  const handleETHTip = async () => {
    let loadingToast: any = null;
    
    try {
      setIsLoading(true);
      
      if (!selectedUsers.length && !selectedRoles.length) {
        toast.error("Please select users or roles to tip");
        setIsLoading(false);
        return;
      }
      if (!selectedTip && !customTip) {
        toast.error("Please specify a tip amount");
        setIsLoading(false);
        return;
      }

      loadingToast = toast.loading("Processing your tip...");

      let usersToSend: any = [];

      if (selectedUsers.length > 0) {
        usersToSend = selectedUsers.map((user) => user.wallet).filter((wallet: string) => wallet !== '' && wallet !== undefined && wallet !== null);
      } else {
        try {
        const response = await fetchRoomParticipants(roomId);
        if (response.ok && response.data?.data?.participants) {
            const activePeers = response.data.data.participants
              .filter((p: any) => selectedRoles.includes(p.role))
              .map((p: any) => p.wallet || '')
              .filter((wallet: string) => wallet !== '' && wallet !== undefined && wallet !== null);
            
            usersToSend.push(...activePeers);
          }
        } catch (err) {
          console.error('Error fetching room participants:', err);
          toast.dismiss(loadingToast);
          toast.error('Failed to fetch participants. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      if (usersToSend.length === 0) {
        toast.dismiss(loadingToast);
        toast.error("No users found for tipping");
        setIsLoading(false);
        return;
      }

      lastCurrencyRef.current = "ETH";
      
      const tipAmountUSD = selectedTip ? selectedTip : parseFloat(customTip);
      
      // Check if ETH price is available
      if (!ethPrice) {
        toast.dismiss(loadingToast);
        toast.error('ETH price not available. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Convert USD to ETH
      const tipAmountETH = tipAmountUSD / ethPrice;
      
      const splitArr = splitIntoBatches(usersToSend);
      
      // Convert ETH to Wei and divide by number of batches
      const totalEthValueInWei = BigInt(Math.floor(tipAmountETH * 1e18));
      const ethValuePerBatch = totalEthValueInWei / BigInt(splitArr.length);
      
      const sendingCalls: TransactionCall[] = splitArr.map((batch) => ({
        to: contractAdds.tipping as `0x${string}`,
        value: ethValuePerBatch,
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: "distributeETH",
          args: [batch],
        }),
      }));

      const result = await executeTransaction({
        calls: sendingCalls,
        sendCalls,
        onSuccess: async () => {
          await processSuccess("ETH", tipAmountETH);
        },
      });

      if (!result.success) {
        setIsLoading(false);
      }

      toast.dismiss(loadingToast);
    } catch (error) {
      console.error("Error tipping users:", error);
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
      toast.error(`Failed to process tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUSDCTip = async (tokenAddress: string, tokenSymbol: string) => {
    let loadingToast: any = null;
    
    try {
      setIsLoading(true);
      if (!selectedUsers.length && !selectedRoles.length) {
        toast.error("Please select users or roles to tip");
        setIsLoading(false);
        return;
      }
      if (!selectedTip && !customTip) {
        toast.error("Please specify a tip amount");
        setIsLoading(false);
        return;
      }

      loadingToast = toast.loading("Processing your tip...");

      let usersToSend: any = [];

      if (selectedUsers.length > 0) {
        usersToSend = selectedUsers.map((user) => user.wallet).filter((wallet: string) => wallet !== '' && wallet !== undefined && wallet !== null);
      } else {
        try {
        const response = await fetchRoomParticipants(roomId);
        if (response.ok && response.data?.data?.participants) {
            const activePeers = response.data.data.participants
              .filter((p: any) => selectedRoles.includes(p.role))
              .map((p: any) => p.wallet || '')
              .filter((wallet: string) => wallet !== '' && wallet !== undefined && wallet !== null);
            
            usersToSend.push(...activePeers);
          }
        } catch (err) {
          console.error('Error fetching room participants:', err);
          toast.dismiss(loadingToast);
          toast.error('Failed to fetch participants. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      console.log("Users to send tip to:", usersToSend);

      if (usersToSend.length === 0) {
        toast.dismiss(loadingToast);
        toast.error("No users found for tipping");
        setIsLoading(false);
        return;
      }

      console.log(`Users to send ${tokenSymbol} tip to:`, usersToSend);

      lastCurrencyRef.current = tokenSymbol;
      
      const tipAmountUSD = selectedTip ? selectedTip : parseFloat(customTip);
      let tokenAmount: bigint;
      
      if (tokenSymbol === "USDC") {
        // USDC is 1:1 with USD
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      } else if (tokenSymbol === "FIRE") {
        // Check if FIRE price is available
        if (!firePrice) {
          toast.dismiss(loadingToast);
          toast.error('FIRE price not available. Please try again.');
          setIsLoading(false);
          return;
        }
        // Convert USD to FIRE tokens
        const tipAmountFIRE = tipAmountUSD / firePrice;
        tokenAmount = BigInt(Math.floor(tipAmountFIRE * 1e18)); // FIRE has 18 decimals
      } else {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      }
      
      const splitArr = splitIntoBatches(usersToSend);

      console.log(`Tipping a total of ${tokenAmount.toString()} ${tokenSymbol} to ${usersToSend.length} users in ${splitArr.length} batches.`);
      
      // Calculate amount per user based on TOTAL users, not batch size
      const amountPerUser = BigInt(Math.floor(Number(tokenAmount) / usersToSend.length));

      console.log(`Each user will receive approximately ${amountPerUser.toString()} ${tokenSymbol}.`);

      const approveCall = {
        to: tokenAddress as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [contractAdds.tipping, tokenAmount],
        }),
      };

      const distributeCalls = splitArr.map((batch) => {
        // Calculate total amount for this batch (amountPerUser * number of users in batch)
        const batchAmount = amountPerUser * BigInt(batch.length);
        console.log(`Batch with ${batch.length} users will receive ${batchAmount.toString()} ${tokenSymbol} total`);
        
        return {
          to: contractAdds.tipping as `0x${string}`,
          value: BigInt(0),
          data: encodeFunctionData({
            abi: firebaseTipsAbi,
            functionName: "distributeToken",
            args: [tokenAddress, batch, batchAmount],
          }),
        };
      });

      const sendingCalls: TransactionCall[] = [approveCall, ...distributeCalls];

      let nativeTokenAmount = tipAmountUSD;
      if (tokenSymbol === "FIRE" && firePrice) {
        nativeTokenAmount = tipAmountUSD / firePrice;
      }

      const result = await executeTransaction({
        calls: sendingCalls,
        sendCalls,
        onSuccess: async () => {
          await processSuccess(tokenSymbol, nativeTokenAmount);
        },
      });

      if (!result.success) {
        setIsLoading(false);
      }

      toast.dismiss(loadingToast);
    } catch (error) {
      console.error("Error tipping users:", error);
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
      toast.error(`Failed to process tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelection = (role: string) => {
    if (!availableRoles[role]) return;
    if (selectedRoles.includes(role)) {
      setSelectedRoles((prev) => prev.filter((r) => r !== role));
    } else {
      setSelectedRoles((prev) => [...prev, role]);
    }
    setSelectedUsers([]);
  };

  const handleUserSelection = (user: any) => {
    if (selectedUsers.some((u) => u.userId === user.userId)) {
      setSelectedUsers((prev) => prev.filter((u) => u.userId !== user.userId));
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
    setSelectedRoles([]);
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="gradient-green-bg border-fireside-green/20 text-white ">
        <DrawerHeader className="border-b border-fireside-lightWhite">
          <div className="flex items-center gap-3">
            <CiMoneyBill className="text-fireside-green text-xl"/>
            <DrawerTitle className="text-xl font-semibold text-white">
              Send a Tip
            </DrawerTitle>
            
          </div>
        </DrawerHeader>

        <div className="px-4 py-6 max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            {/* User Selection */}
            <div>
              <label className="block text-lg font-bold text-fireside-green mb-3">
                Select recipients
              </label>
              
              {/* Role Selection Buttons */}
              <div className="space-y-3">
                <div className="text-sm text-gray-300 mb-2">Select by role:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(availableRoles)
                    .filter(([role, hasParticipants]) => hasParticipants)
                    .map(([role, _]) => (
                      <button
                        key={role}
                        onClick={() => handleRoleSelection(role)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedRoles.includes(role)
                            ? 'bg-fireside-green text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                </div>
              </div>
              
              {/* User Selection Button */}
              <div className="mt-4">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="w-full bg-white/10 text-white p-3 rounded-lg border border-fireside-green/30 hover:bg-white/20 transition-colors text-left flex items-center justify-between"
                >
                  <span className="text-sm text-gray-300">Or select individual users</span>
                  <span className="text-fireside-green">{showUserDropdown ? '▲' : '▼'}</span>
                </button>
                
                {showUserDropdown && (
                  <div className="mt-2">
                    <Input
                      type="text"
                      placeholder="Search participants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mb-2 focus:ring-0"
                    />
                    
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white/5 rounded-lg p-2">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-4">
                          <RiLoader5Fill className="animate-spin text-fireside-green" size={24} />
                        </div>
                      ) : (
                        participants
                          .filter(p => 
                            searchQuery 
                              ? p.username.toLowerCase().includes(searchQuery.toLowerCase())
                              : true
                          )
                          .slice(0, 20)
                          .map((participant) => (
                            <button
                              key={participant.userId}
                              onClick={() => handleUserSelection(participant)}
                              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                selectedUsers.some(u => u.userId === participant.userId)
                                  ? 'bg-fireside-green/20 text-fireside-green'
                                  : 'hover:bg-white/10'
                              }`}
                            >
                              <img
                                src={participant.pfp_url}
                                alt={participant.username}
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="text-left flex-1">{participant.username}</span>
                            </button>
                          ))
                      )}
                      {!isLoadingUsers && participants.length === 0 && (
                        <div className="text-center text-gray-400 py-4">
                          No participants found
                        </div>
                      )}
                      {!isLoadingUsers && searchQuery && participants.filter(p => 
                        p.username.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length > 20 && (
                        <div className="text-center text-gray-400 text-sm py-2">
                          Showing first 20 results
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Selected Recipients Display */}
              {(selectedUsers.length > 0 || selectedRoles.length > 0) && (
                <div className="mt-4 p-3 bg-white/10 rounded-lg">
                  <div className="text-sm text-gray-300 mb-2">Selected:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoles.map(role => (
                      <span
                        key={role}
                        className="bg-fireside-green text-white px-2 py-1 rounded text-sm"
                      >
                        {role}
                      </span>
                    ))}
                    {selectedUsers.map(user => (
                      <span
                        key={user.userId}
                        className="bg-fireside-green text-white px-2 py-1 rounded text-sm"
                      >
                        {user.username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tip Amount Selection */}
            <div>
              <label className="block text-lg font-bold text-fireside-green mb-3">
                Tip Amount
              </label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[0.1, 0.5, 1, 5, 10, 25].map(amount => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedTip(amount);
                      setCustomTip('');
                    }}
                    className={`p-3 rounded-lg border transition-colors font-bold ${
                      selectedTip === amount
                        ? 'bg-fireside-green text-white border-fireside-green'
                        : 'gradient-green-bg text-fireside-green border-fireside-green/30 hover:bg-white/20'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                placeholder="Custom amount"
                label="Amount"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  setSelectedTip(null);
                }}
                className="focus:ring-fireside-green"
                labelClassName="text-fireside-green"
              />
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t border-white/20">
          <div className="flex gap-3">
            <Button
              variant="action"
              onClick={handleETHTip}
              disabled={isLoading || (!selectedUsers.length && !selectedRoles.length) || (!selectedTip && !customTip)}
              className=" gradient-indigo-bg bg-fireside-indigo/10 border-[1px] border-fireside-indigo/10 flex-1 flex items-center justify-center gap-1 text-lg font-bold"
            >
              {isLoading ? <RiLoader5Fill className="animate-spin w-6 h-6" /> : <><img src="/ethereum.svg" alt="ETH" className="w-6 h-6" /><span>ETH</span></>}
            </Button>
            <Button
            variant="action"
              onClick={() => handleUSDCTip(USDC_ADDRESS, "USDC")}
              disabled={isLoading || (!selectedUsers.length && !selectedRoles.length) || (!selectedTip && !customTip)}
              className=" flex-1 gradient-blue-bg bg-fireside-blue/30 border-[1px] border-fireside-blue/30 flex items-center justify-center text-lg gap-1 font-bold"
            >
              {isLoading ? <RiLoader5Fill className="animate-spin w-6 h-6" /> : <><img src="/usdc.svg" alt="USDC" className="w-6 h-6" /><span>USDC</span></>}
            </Button>
            <Button
            variant="action"
              onClick={() => handleUSDCTip(FIRE_ADDRESS, "FIRE")}
              disabled={isLoading || (!selectedUsers.length && !selectedRoles.length) || (!selectedTip && !customTip)}
              className="flex-1 gradient-orange-bg border-[1px] border-fireside-orange/10 bg-fireside-orange/10 text-white flex items-center justify-center text-lg font-bold"
            >
              {isLoading ? <RiLoader5Fill className="animate-spin w-6 h-6" /> : <><img src="/fireside-logo.svg" alt="FIRE" className="w-6 h-6" /><span>$FIRE</span></>}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}