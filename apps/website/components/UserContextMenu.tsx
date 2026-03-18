'use client'

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAgoraContext } from '@/contexts/AgoraContext';
import { ChevronDown, Mic, MicOff } from 'lucide-react';
import { updateParticipantRole, transferHostRole, fetchAPI } from '@/utils/serverActions';
import { Card } from './UI/Card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from './UI/drawer';
import { toast } from 'react-toastify';
import { useAccount, useSendCalls } from 'wagmi';
import { useAuthToken } from '@/hooks/useAuthToken';
import { encodeFunctionData } from 'viem';
import { contractAdds } from '@/utils/contract/contractAdds';
import { firebaseTipsAbi } from '@/utils/contract/abis/firebaseTipsAbi';
import { erc20Abi } from '@/utils/contract/abis/erc20abi';
import { executeTransaction, type TransactionCall } from '@/utils/transactionHelpers';
import { useTipEvent } from '@/utils/events';
import { useGlobalContext } from '@/utils/providers/globalContext';
import Image from 'next/image';

interface UserContextMenuProps {
  peer: any;
  isVisible: boolean;
  onClose: () => void;
  position: { x: number; y: number }; // We won't use this anymore
  onViewProfile?: () => void;
}

export default function UserContextMenu({ peer, isVisible, onClose, onViewProfile }: UserContextMenuProps) {
  const { localPeer, sendCustomEvent } = useAgoraContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Tip drawer state
  const [isTipDrawerOpen, setIsTipDrawerOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<string>('');
  const [isTipping, setIsTipping] = useState(false);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [firePrice, setFirePrice] = useState<number | null>(null);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const FIRE_ADDRESS = '0x9e68E029cBDe7513620Fcb537A44abff88a56186';
  
  const { user } = useGlobalContext();
  const { getToken } = useAuthToken();
  const { address } = useAccount();
  const { sendCalls, isSuccess, status } = useSendCalls();
  const lastCurrencyRef = useRef<string>('ETH');
  const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '';

  // Role-based permissions
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  const canRemoteMute = isHostOrCoHost;
  const canRemovePeer = localPeer?.roleName === 'host';
  
  // Check if this is the local user
  const isLocalUser = peer.uid === localPeer?.uid;
  
  // Check if target peer is a host (to prevent co-hosts from accessing host's context menu)
  const isTargetPeerHost = peer.roleName === 'host';
  
  // Check if local user is co-host trying to access host's menu (not allowed)
  const isCoHostTryingToAccessHost = localPeer?.roleName === 'co-host' && isTargetPeerHost;

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Listen for incoming tips
  useTipEvent((msg) => {
    // Check if the local peer is one of the recipients by uid
    const isRecipient = msg.recipients.some(
      recipient => String(recipient.id) === String(localPeer?.uid)
    );
    if (isRecipient) {
      toast.success(`${msg.tipper.username} tipped you $${msg.amount.usd} in ${msg.amount.currency}! 🎉`);
    }
  });
  
  // Send tip notification
  const { sendTipNotification } = useTipEvent();

  // Fetch token prices
  const fetchTokenPrices = async () => {
    try {
      setIsFetchingPrices(true);
      
      // Fetch ETH price from CoinGecko
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
          const ethData = await response.json();
          const ethPriceUsd = ethData?.ethereum?.usd;
          if (ethPriceUsd) {
            setEthPrice(ethPriceUsd);
          }
        }
      } catch (ethError) {
        console.error('Error fetching ETH price:', ethError);
      }

      // Fetch FIRE price from DexScreener
      try {
        const fireResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${FIRE_ADDRESS}`
        );
        
        if (fireResponse.ok) {
          const fireData = await fireResponse.json();
          const firePriceUsd = fireData?.pairs?.[0]?.priceUsd;
          if (firePriceUsd) {
            setFirePrice(parseFloat(firePriceUsd));
          }
        }
      } catch (fireError) {
        console.error('Error fetching FIRE price:', fireError);
      }
    } catch (error) {
      console.error('Error fetching token prices:', error);
    } finally {
      setIsFetchingPrices(false);
    }
  };
  
  // Monitor transaction status
  useEffect(() => {
    const handleTransactionStatus = async () => {
      if (isSuccess) {
        await processSuccess(lastCurrencyRef.current);
      } else if (status === 'error') {
        toast.error('Transaction failed. Please try again.');
        setIsTipping(false);
      }
    };
    handleTransactionStatus();
  }, [isSuccess, status]);
  
  // Fetch prices when tip drawer opens
  useEffect(() => {
    if (isTipDrawerOpen) {
      fetchTokenPrices();
    }
  }, [isTipDrawerOpen]);

  useEffect(() => {
    if (isVisible && !isCoHostTryingToAccessHost) {
      setIsOpen(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      setIsOpen(false);
      document.body.style.overflow = 'unset';
    }
  }, [isVisible, isCoHostTryingToAccessHost]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Restore body scroll when modal is not open
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Restore body scroll when component unmounts
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleRoleChange = async (newRole: string) => {
    const env = process.env.NEXT_PUBLIC_ENV;
        
    var token: any = "";
    if (env !== "DEV") {
      token = await getToken();
    };
    
    try {
      setIsLoading(true);
      
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      
      if (userFid) {
        const pathParts = window.location.pathname.split('/');
        const roomId = pathParts[pathParts.length - 1];

        // Update role via backend API (updates Redis)
        await updateParticipantRole(roomId, userFid, newRole, token);
        
        // Notify the peer to rejoin with new role
        sendCustomEvent('ROLE_UPDATED', {
          targetFid: String(userFid),
          newRole,
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTransferHost = async () => {
    if (!localPeer) {
      console.error('Local peer not found');
      return;
    }
    
    try {
      setIsLoading(true);
      const pathParts = window.location.pathname.split('/');
      const roomId = pathParts[pathParts.length - 1];
      
      const peerMetadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const peerFid = peerMetadata?.fid;
      
      let localFid = null;
      if (localPeer.metadata) {
        const localMetadata = JSON.parse(localPeer.metadata);
        localFid = localMetadata?.fid;
      }
      
      if (!peerFid || !localFid) {
        console.error('Missing user FIDs, cannot transfer host role');
        return;
      }
      
      // Promote the co-host to host using API
      const promoteResponse = await transferHostRole(roomId, peerFid, 'host');
      if (!promoteResponse.ok) {
        throw new Error('Failed to promote user to host');
      }
      
      // Demote the current host to co-host
      const demoteResponse = await transferHostRole(roomId, localFid, 'co-host');
      if (!demoteResponse.ok) {
        console.error('Failed to demote current host to co-host');
      }
      
      // Notify both peers to rejoin with new roles
      sendCustomEvent('ROLE_UPDATED', {
        targetFid: String(peerFid),
        newRole: 'host',
      });
      sendCustomEvent('ROLE_UPDATED', {
        targetFid: String(localFid),
        newRole: 'co-host',
      });
      
      onClose();
    } catch (error) {
      console.error('Error transferring host role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuteToggle = async () => {
    if (!canRemoteMute) return;
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const peerFid = metadata?.fid;
      if (peerFid) {
        sendCustomEvent('REMOTE_MUTE', { peerId: peerFid });
      }
      onClose();
    } catch (err) {
      console.error('Remote mute failed:', err);
    }
  };

  const handleRemoveUser = async () => {
    if (!canRemovePeer) return;
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const peerFid = metadata?.fid;
      if (peerFid) {
        const pathParts = window.location.pathname.split('/');
        const roomId = pathParts[pathParts.length - 1];
        // Remove via backend API
        await fetchAPI(`/rooms/${roomId}/leave`, {
          method: 'POST',
          body: JSON.stringify({ participantId: peerFid, kicked: true }),
        });
        sendCustomEvent('PEER_REMOVED', { peerId: peerFid, reason: 'Host removed you from the room!' });
      }
      onClose();
    } catch (err) {
      console.error('Remove peer failed:', err);
    }
  };

  const handleViewProfile = async () => {
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      
      if (userFid) {
        window.open(`/user/${userFid}`, '_blank');
        onClose();
      } else {
        console.error('User FID not found in peer metadata');
      }
    } catch (error) {
      console.error('Error viewing profile:', error);
    }
  };
  
  const processSuccess = async (currency: string) => {
    const tipAmountUSD = parseFloat(tipAmount);
    const tipper = user?.username || 'Someone';
    const recipient = peer.name || 'User';
    const recipientId = String(peer.uid) || '';
    
    // Send tip notification to recipient
    sendTipNotification({
      roomId: roomId,
      tipper: {
        username: tipper,
        pfp_url: user?.pfp_url || '',
      },
      recipients: [{
        username: recipient,
        pfp_url: peer.pfp_url || '',
        role: peer.roleName,
        id: recipientId,
      }],
      amount: {
        usd: tipAmountUSD,
        currency: currency,
        native: parseFloat(tipAmount),
      },
      timestamp: new Date().toISOString(),
    });
    
    // No longer broadcasting via HMS — tip notifications are handled via custom events
    
    toast.success('Tip sent successfully!');
    setIsTipDrawerOpen(false);
    setTipAmount('');
    setIsTipping(false);
    onClose();
  };
  
  const handleETHTip = async () => {
    const token = await getToken();
    
    try {
      setIsTipping(true);
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        toast.error('Please enter a valid tip amount');
        setIsTipping(false);
        return;
      }
      
      if (!ethPrice) {
        toast.error('ETH price not available. Please try again.');
        setIsTipping(false);
        return;
      }
      
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const recipientWallet = metadata?.wallet || peer.wallet;
      
      if (!recipientWallet) {
        toast.error('Recipient wallet not found');
        setIsTipping(false);
        return;
      }
      
      lastCurrencyRef.current = 'ETH';
      
      const tipAmountUSD = parseFloat(tipAmount);
      const tipAmountETH = tipAmountUSD / ethPrice;
      const ethValueInWei = BigInt(Math.floor(tipAmountETH * 1e18));
      
      const sendingCalls: TransactionCall[] = [{
        to: contractAdds.tipping as `0x${string}`,
        value: ethValueInWei,
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: 'distributeETH',
          args: [[recipientWallet]],
        }),
      }];
      
      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: undefined,
        sendCalls,
        onSuccess: async () => {
          await processSuccess('ETH');
        },
      });
      
      if (!result.success) {
        setIsTipping(false);
      }
    } catch (error) {
      console.error('Error tipping with ETH:', error);
      toast.error(`Failed to process tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTipping(false);
    }
  };
  
  const handleTokenTip = async (tokenAddress: string, tokenSymbol: string) => {
    try {
      setIsTipping(true);
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        toast.error('Please enter a valid tip amount');
        setIsTipping(false);
        return;
      }
      
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const recipientWallet = metadata?.wallet || peer.wallet;
      
      if (!recipientWallet) {
        toast.error('Recipient wallet not found');
        setIsTipping(false);
        return;
      }
      
      lastCurrencyRef.current = tokenSymbol;
      
      const tipAmountUSD = parseFloat(tipAmount);
      let tokenAmount: bigint;
      
      if (tokenSymbol === 'USDC') {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      } else if (tokenSymbol === 'FIRE') {
        if (!firePrice) {
          toast.error('FIRE price not available. Please try again.');
          setIsTipping(false);
          return;
        }
        const tipAmountFIRE = tipAmountUSD / firePrice;
        tokenAmount = BigInt(Math.floor(tipAmountFIRE * 1e18));
      } else {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      }
      
      const approveCall = {
        to: tokenAddress as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [contractAdds.tipping, tokenAmount],
        }),
      };
      
      const distributeCall = {
        to: contractAdds.tipping as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: 'distributeToken',
          args: [tokenAddress, [recipientWallet], tokenAmount],
        }),
      };
      
      const sendingCalls: TransactionCall[] = [approveCall, distributeCall];
      
      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: undefined,
        sendCalls,
        onSuccess: async () => {
          await processSuccess(tokenSymbol);
        },
      });
      
      if (!result.success) {
        setIsTipping(false);
      }
    } catch (error) {
      console.error(`Error tipping with ${tokenSymbol}:`, error);
      toast.error('Failed to process tip. Please try again.');
      setIsTipping(false);
    }
  };

  if ((!isVisible && !isTipDrawerOpen) || isLocalUser) {
    return null;
  }

  const currentRole = peer.roleName;
  const isMuted = !peer.audioTrack;

  // Check if user has role management permissions
  const canManageRoles = isHostOrCoHost && !isCoHostTryingToAccessHost;

  const modalContent = (
    <>
      {/* Backdrop */}
      {isVisible && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          onClick={onClose}
        />
      )}
      
      {/* Modal */}
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <Card
          ref={menuRef}
          className="bg-[#000000] rounded-xl shadow-2xl w-full max-w-sm mx-4 transform transition-all duration-200 ease-out"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* User Info Header */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                {peer.metadata ? <><Image unoptimized src={JSON.parse(peer.metadata).avatar} alt={`${peer.name}'s avatar`} width={48} height={48} className="rounded-full w-full h-full" /></> : <><span className="text-white text-lg font-medium">
                  {peer.name?.charAt(0)?.toUpperCase() || 'U'}
                </span></>}
                
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{peer.name}</p>
                <p className="text-gray-400 text-sm capitalize">{currentRole}</p>
              </div>
            </div>
          </div>

          {/* View Profile Option */}
          <div className="py-2">
            <button
              onClick={handleViewProfile}
              className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
            >
              <span className="w-5 h-5">👤</span>
              <span className="font-medium">View Profile</span>
            </button>
            
            {/* Tip User Option */}
            <button
              onClick={() => {
                setIsTipDrawerOpen(true);
                onClose();
              }}
              className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
            >
              <span className="w-5 h-5">💸</span>
              <span className="font-medium">Tip User</span>
            </button>
          </div>

          {/* Role Management Options - Only show if user can manage roles */}
          {canManageRoles && (
            <div className="py-2 border-t border-gray-600">
              {/* Make Speaker */}
              {currentRole !== 'speaker' && (
              <button
                onClick={() => handleRoleChange('speaker')}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <Mic className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Speaker'}</span>
              </button>
            )}

            {/* Make Co-host */}
            {currentRole !== 'co-host' && (
              <button
                onClick={() => handleRoleChange('co-host')}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Co-host'}</span>
              </button>
            )}

            {/* Make Host - only when local user is host and peer is co-host */}
            {localPeer?.roleName === 'host' && currentRole === 'co-host' && (
              <button
                onClick={handleTransferHost}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Transferring...' : 'Make Host'}</span>
              </button>
            )}

            {/* Make Listener */}
            {currentRole !== 'listener' && (
              <button
                onClick={() => handleRoleChange('listener')}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <Mic className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Listener'}</span>
              </button>
            )}

            {/* Mute - only show for speakers and co-hosts who are NOT muted */}
            {(currentRole === 'speaker' || currentRole === 'co-host') && canRemoteMute && !isMuted && (
              <button
                onClick={handleMuteToggle}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
              >
                <MicOff className="w-5 h-5" />
                <span className="font-medium">Mute</span>
              </button>
            )}

              {/* Remove User (only for host) */}
              {canRemovePeer && (
                <div className="border-t border-gray-600 mt-2 pt-2">
                  <button
                    onClick={handleRemoveUser}
                    className="w-full px-6 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center space-x-3 transition-colors"
                  >
                    <span className="w-5 h-5">🚫</span>
                    <span className="font-medium">Remove User</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="px-6 py-3 border-t border-gray-600">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-full px-4 py-2 text-center text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </Card>
      </div>
      )}
      
      {/* Tip Drawer */}
      <Drawer open={isTipDrawerOpen} onOpenChange={setIsTipDrawerOpen}>
        <DrawerContent className="bg-black/95 backdrop-blur-lg text-white border-fireside-orange/30">
          <DrawerHeader className="border-b border-orange-500/30">
            <DrawerTitle className="text-2xl font-bold text-center text-white">
              Tip <span className='gradient-fire-text'>{peer.name}</span>
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="px-4 py-6 space-y-6">
            {/* Recipient Info */}
            <Card className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                {peer.metadata ? <><Image unoptimized src={JSON.parse(peer.metadata).avatar} alt={`${peer.name}'s avatar`} width={48} height={48} className="rounded-full w-full h-full" /></> : <><span className="text-white text-lg font-medium">
                  {peer.name?.charAt(0)?.toUpperCase() || 'U'}
                </span></>}
              </div>
              <div>
                <p className="text-white font-semibold">{peer.name}</p>
                <p className="text-gray-400 text-sm capitalize">{peer.roleName}</p>
              </div>
            </Card>
            
            {/* Tip Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tip Amount (USD)
              </label>
              <input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="Enter amount in USD"
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fireside-orange"
                min="0"
                step="0.01"
                disabled={isTipping}
              />
            </div>
            
            {/* Token Price Info */}
            {isFetchingPrices ? (
              <div className="text-center text-gray-400 text-sm">
                Fetching token prices...
              </div>
            ) : (
              <div className="text-sm text-gray-400 space-y-1">
                {ethPrice && <p>ETH: ${ethPrice.toFixed(2)}</p>}
                {firePrice && <p>FIRE: ${firePrice.toFixed(6)}</p>}
                <p>USDC: $1.00</p>
              </div>
            )}
          </div>
          
          <DrawerFooter className="border-t border-fireside-orange/30">
            <div className="space-y-3">
              {/* ETH Button */}
              <button
                onClick={handleETHTip}
                disabled={isTipping || !tipAmount || !ethPrice || isFetchingPrices}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isTipping && lastCurrencyRef.current === 'ETH' ? 'Processing...' : 'Tip in ETH'}
              </button>
              
              {/* USDC Button */}
              <button
                onClick={() => handleTokenTip(USDC_ADDRESS, 'USDC')}
                disabled={isTipping || !tipAmount || isFetchingPrices}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isTipping && lastCurrencyRef.current === 'USDC' ? 'Processing...' : 'Tip in USDC'}
              </button>
              
              {/* FIRE Button */}
              <button
                onClick={() => handleTokenTip(FIRE_ADDRESS, 'FIRE')}
                disabled={isTipping || !tipAmount || !firePrice || isFetchingPrices}
                className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isTipping && lastCurrencyRef.current === 'FIRE' ? 'Processing...' : 'Tip in FIRE'}
              </button>
              
              {/* Cancel Button */}
              <button
                onClick={() => {
                  setIsTipDrawerOpen(false);
                  setTipAmount('');
                }}
                disabled={isTipping}
                className="w-full px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
