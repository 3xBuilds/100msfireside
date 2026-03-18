import { ethers } from "ethers";
import { HydratedDocument, Types } from "mongoose";
import connectDB from "../../config/database";
import AdView from "../../models/AdView";
import Advertisement from "../../models/Advertisement";
import User from "../../models/User";
import Room from "../../models/Room";
import AdPayout, { IAdPayout } from "../../models/AdPayout";
import { AdDistributionDetail, AdPayoutData } from "../../types/ads";
import batchTransferAbi from "../../utils/contracts/batchTransferAbi";
import { contractAdds } from "../../utils/contracts/contractAdds";
import { erc20Abi } from "../../utils/contracts/erc20abi";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TARGET_TOKEN = "0x9e68E029cBDe7513620Fcb537A44abff88a56186"; // FIRE
const BASE_CHAIN_ID = "8453";
const distributorAddress = "0x9beCa8af462c6fcf80D079D8a6cD4060fB2866E3"

type AdRevDistributeOptions = {
  roomId: string;
  triggeredByFid?: string;
  triggeredByUserId?: string;
};

type AdRevDistributeResult = {
  success: boolean;
  data?: AdPayoutData;
  payoutId?: string;
  source?: 'existing' | 'fresh' | 'skipped' | 'pending';
  message?: string;
};

type AdPayoutDoc = HydratedDocument<IAdPayout>;

function normalizeOptions(input: string | AdRevDistributeOptions): AdRevDistributeOptions {
  if (typeof input === 'string') {
    return { roomId: input };
  }
  return input;
}

export async function adRevDistribute(input: string | AdRevDistributeOptions): Promise<AdRevDistributeResult> {
  let payoutRecord: AdPayoutDoc | null = null;
  try {
    const { roomId, triggeredByFid, triggeredByUserId } = normalizeOptions(input);

    if (!roomId) {
      throw new Error('roomId is required');
    }

    console.log('🚀 Starting ad revenue distribution for roomId:', roomId);
    
    const pvtKey = process.env.AD_DISTRIBUTOR_PVT_KEY;
    if (!pvtKey) {
      throw new Error("Ad distributor private key not set");
    }
    console.log('✅ Ad distributor private key found');

    const zeroXApiKey = process.env.ZERO_X_API_KEY;
    if (!zeroXApiKey) {
      throw new Error("0x API key not set");
    }
    console.log('✅ 0x API key found');

    await connectDB();
    console.log('✅ Database connected');

    if (!Types.ObjectId.isValid(roomId)) {
      throw new Error(`Invalid roomId provided: ${roomId}`);
    }

    const roomObjectId = new Types.ObjectId(roomId);
    const room = await Room.findById(roomObjectId).select('_id');
    if (!room) {
      throw new Error(`Room not found for id: ${roomId}`);
    }

    payoutRecord = await AdPayout.findOne({ room: room._id }) as AdPayoutDoc | null;

    if (payoutRecord?.status === 'completed' && payoutRecord.payload) {
      console.log('ℹ️ Payout already exists for room, returning cached data');
      return {
        success: true,
        data: payoutRecord.payload,
        payoutId: payoutRecord._id.toString(),
        source: 'existing'
      };
    }

    if (payoutRecord?.status === 'pending') {
      console.log('⏳ A payout is already running for this room');
      return {
        success: false,
        payoutId: payoutRecord._id.toString(),
        source: 'pending',
        message: 'Ad payout already in progress for this room'
      };
    }

    if (!payoutRecord) {
      payoutRecord = await AdPayout.create({
        room: room._id,
        roomId: room._id.toString(),
        status: 'pending'
      }) as AdPayoutDoc;
    } else {
      payoutRecord.status = 'pending';
      payoutRecord.payload = undefined;
      payoutRecord.swapTxHash = undefined;
      payoutRecord.transferTxHashes = [];
      payoutRecord.approveTxHash = undefined;
      payoutRecord.usdAmountSwapped = undefined;
      payoutRecord.fireAmountToDistribute = undefined;
      payoutRecord.fireBalanceRaw = undefined;
      payoutRecord.uniqueAds = undefined;
      payoutRecord.uniqueUsers = undefined;
      payoutRecord.totalRecipients = undefined;
      payoutRecord.totalBatches = undefined;
      payoutRecord.distributionDetails = [];
      payoutRecord.errorMessage = undefined;
      payoutRecord.errorStack = undefined;
    }

    if (!payoutRecord) {
      throw new Error('Failed to initialize payout record');
    }

    if (triggeredByFid) {
      payoutRecord.triggeredByFid = triggeredByFid;
    }

    if (triggeredByUserId && Types.ObjectId.isValid(triggeredByUserId)) {
      payoutRecord.triggeredByUser = new Types.ObjectId(triggeredByUserId);
    }

    payoutRecord.room = room._id;
    payoutRecord.roomId = room._id.toString();
    await payoutRecord.save();

    const provider = new ethers.JsonRpcProvider(
      "https://base-mainnet.g.alchemy.com/v2/CA4eh0FjTxMenSW3QxTpJ7D-vWMSHVjq"
    );
    console.log('✅ Provider setup complete');

    const wallet = new ethers.Wallet(
      pvtKey as string,
      provider
    );
    console.log('✅ Wallet initialized:', wallet.address);

    const usdcContract = new ethers.Contract(
      USDC_BASE,
      [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
      ],
      provider
    );

    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    console.log('💰 USDC Balance:', ethers.formatUnits(usdcBalance, 6), 'USDC');

    if (usdcBalance === 0n) {
      console.log("❌ No USDC balance to distribute");
      if (payoutRecord) {
        payoutRecord.status = 'skipped';
        payoutRecord.errorMessage = 'No USDC balance to distribute';
        await payoutRecord.save();
      }
      return {
        success: false,
        payoutId: payoutRecord?._id.toString(),
        source: 'skipped',
        message: 'No USDC balance to distribute'
      };
    }

    let amountToSend: number = 0;

    const adViews = await AdView.find({
        roomId: roomId
    })
    console.log('📊 Found', adViews.length, 'ad views for room:', roomId);

    // 1. Get unique adIds
    const uniqueAdIds = [...new Set(adViews.map(view => view.adId))];
    console.log('🎯 Unique Ad IDs:', uniqueAdIds);
    console.log('📈 Total unique ads:', uniqueAdIds.length);

    // 2. Get unique userFids
    const uniqueUserFids = [...new Set(adViews.map(view => view.userFid))];
    console.log('👥 Unique User FIDs:', uniqueUserFids);
    console.log('📈 Total unique users:', uniqueUserFids.length);

    // 3. Calculate total amount to distribute for each adId
    for (const adId of uniqueAdIds) {
      console.log('🔍 Processing ad:', adId);
      const ad = await Advertisement.findById(adId);
      
      if (ad) {
        // Formula: (minutesPerRoom * (Math.floor(minParticipants/10)+1)) * $1 * 50%
        // Must use Math.floor to match advertiser pricing formula
        const revenuePerAd = parseFloat(((ad.minutesPerRoom * (Math.floor(ad.minParticipants / 10) + 1) * 1)/2).toFixed(4));
        console.log('  - minutesPerRoom:', ad.minutesPerRoom);
        console.log('  - minParticipants:', ad.minParticipants);
        console.log('  - Revenue per room for this ad:', revenuePerAd, 'USD');
        amountToSend += revenuePerAd;
      } else {
        console.log('  ⚠️ Advertisement not found for id:', adId);
      }
    }

    console.log('💵 Total amount to distribute:', amountToSend, 'USD');

    if (amountToSend === 0) {
      console.log("❌ No amount to distribute");
      if (payoutRecord) {
        payoutRecord.status = 'skipped';
        payoutRecord.errorMessage = 'Calculated payout amount is zero';
        await payoutRecord.save();
      }
      return {
        success: false,
        payoutId: payoutRecord?._id.toString(),
        source: 'skipped',
        message: 'No amount to distribute for this room'
      };
    }

    // SWAP USDC TO FIRE
        console.log('🔄 Preparing to swap USDC to FIRE...');
        const priceParams = new URLSearchParams({
        chainId: BASE_CHAIN_ID,
        sellToken: USDC_BASE,
        buyToken: TARGET_TOKEN,
        sellAmount: String(ethers.parseUnits(String(amountToSend), 6)),
        taker: wallet.address,
        slippagePercentage: "0.5", // 0.5% slippage protection
        gasless: "false", // Optimize for lower gas
        intentOnFilling: "true", // Signal intent for better routing
        enableSlippageProtection: "true", // Enable slippage protection
        });

        console.log('📡 Fetching price from 0x API...');
        const priceResponse = await fetch(
        `https://api.0x.org/swap/allowance-holder/price?${priceParams.toString()}`,
        {
            headers: {
            "0x-api-key": zeroXApiKey!,
            "0x-version": "v2",
            },
        }
        );

        const priceData = await priceResponse.json();
        console.log('💹 Price data received:', JSON.stringify(priceData, null, 2));

        // // Check if allowance is needed
        if (priceData.issues?.allowance) {
        console.log("🔐 Approving token allowance...");
        const tokenContract = new ethers.Contract(
            TARGET_TOKEN,
            [
            "function approve(address spender, uint256 amount) external returns (bool)",
            ],
            wallet
        );

        const approveTx = await tokenContract.approve(
            priceData.issues.allowance.spender,
            ethers.MaxUint256
        );
        await approveTx.wait();
        console.log(
            "✅ Token allowance approved for spender:",
            priceData.issues.allowance.spender
        );
        } else {
        console.log("ℹ️ No token allowance needed");
        }

        // // Get firm quote
        // console.log('📋 Getting firm quote from 0x API...');
        const quoteResponse = await fetch(
        `https://api.0x.org/swap/allowance-holder/quote?${priceParams.toString()}`,
        {
            headers: {
            "0x-api-key": zeroXApiKey!,
            "0x-version": "v2",
            },
        }
        );

        const quoteData = await quoteResponse.json();

        // Get current gas price and set a reasonable gas limit
        const feeData = await provider.getFeeData();
        const currentGasPrice = feeData.gasPrice || 0n;
        console.log(
        "Current network gas price:",
        ethers.formatUnits(currentGasPrice, "gwei"),
        "gwei"
        );

        // Use a more conservative gas price multiplier based on current conditions
        const gasPriceGwei = parseFloat(
        ethers.formatUnits(currentGasPrice, "gwei")
        );
        const multiplier = BigInt(gasPriceGwei > 20 ? 105 : 110); // Lower multiplier if gas is already high
        const swapOptimizedGasPrice = (currentGasPrice * multiplier) / 100n;

        console.log(
        "Optimized gas price:",
        ethers.formatUnits(swapOptimizedGasPrice, "gwei"),
        "gwei"
        );

        // Estimate gas limit with buffer
        const swapEstimatedGas = quoteData.transaction.gas
        ? (BigInt(quoteData.transaction.gas) * 120n) / 100n // 20% buffer
        : 250000n; // fallback gas limit for token swaps

        console.log('📤 Sending swap transaction...');
        const swapTx = await wallet.sendTransaction({
        to: quoteData.transaction.to,
        data: quoteData.transaction.data,
        value: quoteData.transaction.value
            ? BigInt(quoteData.transaction.value)
            : undefined,
        gasLimit: swapEstimatedGas,
        gasPrice: swapOptimizedGasPrice,
        });
        console.log('⏳ Transaction sent, hash:', swapTx.hash);

        console.log('⏳ Waiting for transaction confirmation...');
        const receipt = await swapTx.wait();
        if (!receipt) {
        throw new Error("Transaction receipt is null");
        }

        const swapTxHash = receipt.hash;
        console.log('✅ Swap completed successfully! Tx hash:', swapTxHash);

        // Get FIRE token balance after swap
        console.log('🔍 Checking FIRE token balance after swap...');

        //add a 5 sec wait here to ensure blockchain state is updated
        await new Promise(resolve => setTimeout(resolve, 5000));

        const fireContract = new ethers.Contract(
          TARGET_TOKEN,
          [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
          ],
          provider
        );

        const fireBalance = await fireContract.balanceOf(wallet.address);
        const fireDecimals = Number(await fireContract.decimals());
        const fireAmountToDistribute = Number(ethers.formatUnits(fireBalance, fireDecimals));
        
        console.log('💰 FIRE Token Balance:', fireAmountToDistribute, 'FIRE');
        console.log('💰 FIRE Token Balance (raw):', fireBalance.toString());

        if (fireBalance === 0n) {
          console.log("❌ No FIRE tokens to distribute");
          if (payoutRecord) {
            payoutRecord.status = 'skipped';
            payoutRecord.errorMessage = 'No FIRE tokens in wallet after swap';
            payoutRecord.swapTxHash = swapTxHash;
            await payoutRecord.save();
          }
          return {
            success: false,
            payoutId: payoutRecord?._id.toString(),
            source: 'skipped',
            message: 'No FIRE tokens in wallet after swap'
          };
        }

        // 1. Calculate amount to be received by each user based on watch time
        console.log('💰 Calculating individual user distributions...');
        
        // First, get all ad durations
        const adDurations = new Map<string, number>();
        for (const adId of uniqueAdIds) {
          const ad = await Advertisement.findById(adId);
          if (ad) {
            adDurations.set(adId, ad.minutesPerRoom * 60 * 1000); // Convert to milliseconds
          }
        }

        // Calculate total watch weight (watchedMs / durationMs) for each user
        const userAmounts: number[] = [];
        let totalWatchWeight = 0;

        // First pass: calculate total watch weight
        for (const userFid of uniqueUserFids) {
          const userViews = adViews.filter(view => view.userFid === userFid);
          let userWatchWeight = 0;
          
          for (const view of userViews) {
            const adDuration = adDurations.get(view.adId) || 1;
            const watchPercentage = view.watchedMs / adDuration;
            userWatchWeight += watchPercentage;
          }
          
          totalWatchWeight += userWatchWeight;
        }

        console.log('📊 Total watch weight:', totalWatchWeight);

        // Second pass: calculate actual amounts
        for (const userFid of uniqueUserFids) {
          const userViews = adViews.filter(view => view.userFid === userFid);
          let userWatchWeight = 0;
          
          for (const view of userViews) {
            const adDuration = adDurations.get(view.adId) || 1;
            const watchPercentage = view.watchedMs / adDuration;
            userWatchWeight += watchPercentage;
          }
          
          // Calculate user's share of total FIRE tokens (from actual balance after swap)
          const userAmount = totalWatchWeight > 0 
            ? (userWatchWeight / totalWatchWeight) * fireAmountToDistribute 
            : 0;
          
          userAmounts.push(userAmount);
          
          console.log(`  💵 User FID ${userFid}: Watch weight = ${userWatchWeight.toFixed(4)}, Amount = ${userAmount.toFixed(6)} FIRE`);
        }

        // 2. Fetch wallet addresses from Neynar API
        console.log('🔍 Fetching wallet addresses from Neynar API...');
        
        const neynarApiKey = process.env.NEYNAR_API_KEY;
        if (!neynarApiKey) {
          throw new Error("Neynar API key not set");
        }

        const neynarResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk?fids=${uniqueUserFids.join(',')}`,
          {
            headers: {
              "x-api-key": neynarApiKey,
            },
          }
        );

        if (!neynarResponse.ok) {
          throw new Error(`Neynar API request failed: ${neynarResponse.status} ${neynarResponse.statusText}`);
        }

        const neynarData = await neynarResponse.json();
        console.log('✅ Neynar API response received for', neynarData.users?.length || 0, 'users');

        // Create a map of fid to eth address
        const fidToAddressMap = new Map<string, string>();
        for (const user of neynarData.users || []) {
          const ethAddress = user.verified_addresses?.primary?.eth_address || 
                            user.verified_addresses?.eth_addresses?.[0] ||
                            user.custody_address;
          if (ethAddress) {
            fidToAddressMap.set(String(user.fid), ethAddress);
          }
        }

        // 3. Build ordered arrays maintaining the order of uniqueUserFids
        const recipientAddresses: string[] = [];
        const recipientAmounts: number[] = [];
        const distributionDetails: Array<{
          fid: string;
          address: string;
          amount: number;
          watchWeight?: number;
        }> = [];

        for (let i = 0; i < uniqueUserFids.length; i++) {
          const fid = uniqueUserFids[i];
          const amount = userAmounts[i];
          const address = fidToAddressMap.get(fid);

          if (!address) {
            console.warn(`⚠️ No wallet address found for FID ${fid}, skipping...`);
            continue;
          }

          recipientAddresses.push(address);
          recipientAmounts.push(amount);
          
          const userViews = adViews.filter(view => view.userFid === fid);
          let userWatchWeight = 0;
          for (const view of userViews) {
            const adDuration = adDurations.get(view.adId) || 1;
            userWatchWeight += view.watchedMs / adDuration;
          }

          distributionDetails.push({
            fid,
            address,
            amount,
            watchWeight: userWatchWeight
          });
        }

        if (recipientAddresses.length === 0) {
          console.log('❌ No wallet addresses found for eligible recipients, aborting distribution');
          if (payoutRecord) {
            payoutRecord.status = 'skipped';
            payoutRecord.errorMessage = 'No wallet addresses available for recipients';
            payoutRecord.swapTxHash = swapTxHash;
            payoutRecord.fireAmountToDistribute = fireAmountToDistribute;
            payoutRecord.fireBalanceRaw = fireBalance.toString();
            payoutRecord.distributionDetails = distributionDetails;
            await payoutRecord.save();
          }
          return {
            success: false,
            payoutId: payoutRecord?._id.toString(),
            source: 'skipped',
            message: 'No eligible wallet addresses for payout recipients'
          };
        }

        // Log the distribution details
        console.log('\n📋 ===== DISTRIBUTION DETAILS =====');
        console.log(`Room ID: ${roomId}`);
        console.log(`Total FIRE Tokens to Distribute: ${fireAmountToDistribute} FIRE`);
        console.log(`Number of Recipients: ${recipientAddresses.length}`);
        console.log(`Swap Transaction Hash: ${swapTxHash}`);
        console.log('\n👥 Individual Distributions (in order):');
        
        distributionDetails.forEach((detail, index) => {
          console.log(`\n${index + 1}. FID: ${detail.fid}`);
          console.log(`   Address: ${detail.address}`);
          console.log(`   Amount: ${detail.amount.toFixed(6)} FIRE`);
          console.log(`   Watch Weight: ${detail.watchWeight?.toFixed(4)}`);
        });
        
        console.log('\n📊 Summary Arrays:');
        console.log('FIDs:', uniqueUserFids);
        console.log('Addresses:', recipientAddresses);
        console.log('Amounts:', recipientAmounts.map(a => a.toFixed(6)));
        console.log('================================\n');

        // 1. Create batch transfer contract instance
        console.log('📦 Creating batch transfer contract instance...');
        const batchTransferContract = new ethers.Contract(
          contractAdds.batchTransfer,
          batchTransferAbi,
          wallet
        );
        console.log('✅ Batch transfer contract initialized:', contractAdds.batchTransfer);

        // 2. Approve batch transfer contract to spend FIRE tokens
        console.log('🔓 Approving batch transfer contract to spend FIRE tokens...');
        const fireTokenContract = new ethers.Contract(
          TARGET_TOKEN,
          erc20Abi,
          wallet
        );

        const distributionApproveTx = await fireTokenContract.approve(
          contractAdds.batchTransfer,
          ethers.parseUnits(String(fireBalance), fireDecimals) // Approve the full balance
        );
        console.log('⏳ Approval transaction sent:', distributionApproveTx.hash);
        await distributionApproveTx.wait();
        console.log('✅ Approval transaction confirmed');

        // 3. Execute batch transfers (max 10 recipients at a time) in parallel
        console.log('\n💸 Starting batch transfers in parallel...');
        const BATCH_SIZE = 20;

        // Prepare all batches
        const batches: Array<{
          addresses: string[];
          amounts: number[];
          amountsWei: bigint[];
          batchNumber: number;
        }> = [];

        for (let i = 0; i < recipientAddresses.length; i += BATCH_SIZE) {
          const batchAddresses = recipientAddresses.slice(i, i + BATCH_SIZE);
          const batchAmounts = recipientAmounts.slice(i, i + BATCH_SIZE);
          
          // Convert amounts to wei (with proper decimals)
          const batchAmountsWei = batchAmounts.map(amount => 
            ethers.parseUnits(amount.toFixed(fireDecimals), fireDecimals)
          );

          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

          batches.push({
            addresses: batchAddresses,
            amounts: batchAmounts,
            amountsWei: batchAmountsWei,
            batchNumber
          });
        }

        const totalBatches = batches.length;
        console.log(`📦 Prepared ${totalBatches} batches for parallel execution`);

        // Validate total distribution doesn't exceed balance
        const totalAmountWei = batches.reduce((sum, batch) => {
          return sum + batch.amountsWei.reduce((batchSum, amount) => batchSum + amount, 0n);
        }, 0n);
        
        console.log('💰 Total amount to send (wei):', totalAmountWei.toString());
        console.log('💰 FIRE balance (wei):', fireBalance.toString());
        console.log('💰 Total amount to send (FIRE):', ethers.formatUnits(totalAmountWei, fireDecimals));
        
        if (totalAmountWei > fireBalance) {
          const deficit = totalAmountWei - fireBalance;
          console.warn('⚠️ Total amount exceeds balance, adjusting distribution...');
          console.warn(`   Total to send: ${ethers.formatUnits(totalAmountWei, fireDecimals)} FIRE`);
          console.warn(`   Wallet balance: ${ethers.formatUnits(fireBalance, fireDecimals)} FIRE`);
          console.warn(`   Deficit: ${ethers.formatUnits(deficit, fireDecimals)} FIRE`);
          
          // Deduct deficit from the last recipient of the last batch
          const lastBatch = batches[batches.length - 1];
          const lastRecipientIndex = lastBatch.amountsWei.length - 1;
          const lastAmount = lastBatch.amountsWei[lastRecipientIndex];
          
          console.log(`   Original last recipient amount: ${ethers.formatUnits(lastAmount, fireDecimals)} FIRE`);
          
          const adjustedLastAmount = lastAmount - deficit;
          if (adjustedLastAmount < 0n) {
            throw new Error(`Cannot adjust: last recipient amount (${ethers.formatUnits(lastAmount, fireDecimals)} FIRE) is less than deficit (${ethers.formatUnits(deficit, fireDecimals)} FIRE)`);
          }
          
          lastBatch.amountsWei[lastRecipientIndex] = adjustedLastAmount;
          lastBatch.amounts[lastRecipientIndex] = Number(ethers.formatUnits(adjustedLastAmount, fireDecimals));
          
          console.log(`   Adjusted last recipient amount: ${ethers.formatUnits(adjustedLastAmount, fireDecimals)} FIRE`);
          
          // Recalculate total after adjustment
          const adjustedTotal = batches.reduce((sum, batch) => {
            return sum + batch.amountsWei.reduce((batchSum, amount) => batchSum + amount, 0n);
          }, 0n);
          
          console.log(`   ✅ Adjusted total: ${ethers.formatUnits(adjustedTotal, fireDecimals)} FIRE`);
          console.log(`   Remaining balance: ${ethers.formatUnits(fireBalance - adjustedTotal, fireDecimals)} FIRE`);
        } else {
          console.log('✅ Balance check passed. Remaining after distribution:', ethers.formatUnits(fireBalance - totalAmountWei, fireDecimals), 'FIRE');
        }

        // Get current nonce and prepare nonces for each batch
        let currentNonce = await provider.getTransactionCount(wallet.address, 'pending');
        console.log(`🔢 Starting nonce: ${currentNonce}`);

        // Execute all batches in parallel with sequential nonces
        const batchPromises = batches.map(async (batch, index) => {
          const batchNonce = currentNonce + index;
          
          console.log(`\n📤 Sending batch ${batch.batchNumber}/${totalBatches}:`);
          console.log(`   Nonce: ${batchNonce}`);
          console.log(`   Recipients: ${batch.addresses.length}`);
          console.log(`   Addresses:`, batch.addresses);
          console.log(`   Amounts (FIRE):`, batch.amounts.map(a => a.toFixed(6)));

          try {
            const transferTx = await batchTransferContract.multiTransfer(
              TARGET_TOKEN,
              batch.addresses,
              batch.amountsWei,
              { nonce: batchNonce }
            );
            
            console.log(`   ⏳ Batch ${batch.batchNumber} transaction sent: ${transferTx.hash} (nonce: ${batchNonce})`);
            const transferReceipt = await transferTx.wait();
            console.log(`   ✅ Batch ${batch.batchNumber} confirmed: ${transferReceipt.hash}`);
            
            return transferReceipt.hash;
          } catch (batchError) {
            console.error(`   ❌ Batch ${batch.batchNumber} failed:`, batchError);
            throw new Error(`Batch transfer ${batch.batchNumber} failed: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
          }
        });

        console.log('\n⏳ Waiting for all batch transfers to complete...');
        const transferTxHashes = await Promise.all(batchPromises);

        console.log('\n🎉 All batch transfers completed successfully!');
        console.log('Transfer transaction hashes:', transferTxHashes);

        const totalBatchesCount = Math.ceil(recipientAddresses.length / BATCH_SIZE);
        const resultPayload: AdPayoutData = {
          success: true,
          swapTxHash,
          transferTxHashes,
          approveTxHash: distributionApproveTx.hash,
          usdAmountSwapped: amountToSend,
          fireAmountToDistribute,
          fireBalanceRaw: fireBalance.toString(),
          uniqueAds: uniqueAdIds.length,
          uniqueUsers: uniqueUserFids.length,
          totalRecipients: recipientAddresses.length,
          totalBatches: totalBatchesCount,
          roomId,
          distribution: {
            fids: uniqueUserFids,
            addresses: recipientAddresses,
            amounts: recipientAmounts,
            details: distributionDetails
          }
        };

        if (payoutRecord) {
          payoutRecord.status = 'completed';
          payoutRecord.payload = resultPayload;
          payoutRecord.swapTxHash = swapTxHash;
          payoutRecord.transferTxHashes = transferTxHashes;
          payoutRecord.approveTxHash = distributionApproveTx.hash;
          payoutRecord.usdAmountSwapped = amountToSend;
          payoutRecord.fireAmountToDistribute = fireAmountToDistribute;
          payoutRecord.fireBalanceRaw = fireBalance.toString();
          payoutRecord.uniqueAds = uniqueAdIds.length;
          payoutRecord.uniqueUsers = uniqueUserFids.length;
          payoutRecord.totalRecipients = recipientAddresses.length;
          payoutRecord.totalBatches = totalBatchesCount;
          payoutRecord.distributionDetails = distributionDetails;
          await payoutRecord.save();
        }

        try {
          await updateUserEarnings(distributionDetails, amountToSend, fireAmountToDistribute, roomId, payoutRecord?._id);
        } catch (userStatsError) {
          console.error('⚠️ Failed to update user earnings stats:', userStatsError);
        }

        return {
          success: true,
          data: resultPayload,
          payoutId: payoutRecord?._id.toString(),
          source: 'fresh'
        };

    // return {
    //   success: false,
    //   payoutId: payoutRecord?._id.toString(),
    //   source: 'skipped',
    //   message: 'Ad revenue distribution logic is currently disabled'
    // }

    
  } catch (err) {
    console.error('❌ Error in adRevDistribute:', err);
    if (payoutRecord) {
      payoutRecord.status = 'failed';
      payoutRecord.errorMessage = err instanceof Error ? err.message : 'Unknown error';
      payoutRecord.errorStack = err instanceof Error ? err.stack : undefined;
      try {
        await payoutRecord.save();
      } catch (saveError) {
        console.error('Failed to persist payout failure status:', saveError);
      }
    }
    throw err;
  }
}

async function updateUserEarnings(
  details: AdDistributionDetail[],
  usdAmountSwapped: number,
  fireAmountToDistribute: number,
  roomId: string,
  payoutId?: Types.ObjectId
) {
  if (!details.length) {
    return;
  }

  const now = new Date();
  const bulkOperations = details.map(detail => {
    const parsedFid = Number(detail.fid);
    const fidQuery = Number.isNaN(parsedFid) ? detail.fid : parsedFid;
    const usdShare = fireAmountToDistribute > 0
      ? (detail.amount / fireAmountToDistribute) * usdAmountSwapped
      : 0;

    const updateData: Record<string, unknown> = {
      $inc: {
        'adEarnings.totalFire': detail.amount,
        'adEarnings.totalUsd': usdShare,
        'adEarnings.payoutCount': 1
      },
      $set: {
        'adEarnings.lastPayoutAt': now,
        'adEarnings.lastRoomId': roomId
      }
    };

    if (payoutId) {
      (updateData.$set as Record<string, unknown>)['adEarnings.lastPayoutRef'] = payoutId;
    }

    return {
      updateOne: {
        filter: { fid: fidQuery },
        update: updateData
      }
    };
  });

  if (bulkOperations.length === 0) {
    return;
  }

  await User.bulkWrite(bulkOperations, { ordered: false });
}
