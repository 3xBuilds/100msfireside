import { readFile } from 'fs/promises';
import path from 'path';
import { Types } from 'mongoose';
import connectDB from '../config/database';
import Room from '../models/Room';
import AdPayout from '../models/AdPayout';
import User from '../models/User';
import { AdDistributionDetail, AdPayoutData } from '../types/ads';

async function updateUserEarningsFromDetails(
  details: AdDistributionDetail[],
  usdAmount: number,
  fireAmount: number,
  roomId: string,
  payoutId: Types.ObjectId
) {
  if (!details?.length) {
    return;
  }

  const now = new Date();
  const bulk = details.map((detail) => {
    const parsedFid = Number(detail.fid);
    const fidQuery = Number.isNaN(parsedFid) ? detail.fid : parsedFid;
    const usdShare = fireAmount > 0 ? (detail.amount / fireAmount) * usdAmount : 0;

    return {
      updateOne: {
        filter: { fid: fidQuery },
        update: {
          $inc: {
            'adEarnings.totalFire': detail.amount,
            'adEarnings.totalUsd': usdShare,
            'adEarnings.payoutCount': 1
          },
          $set: {
            'adEarnings.lastPayoutAt': now,
            'adEarnings.lastRoomId': roomId,
            'adEarnings.lastPayoutRef': payoutId
          }
        }
      }
    };
  });

  if (bulk.length) {
    await User.bulkWrite(bulk, { ordered: false });
  }
}

async function main() {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error('Usage: bun run src/scripts/backfillAdPayout.ts <path-to-payout-json>');
    process.exit(1);
  }

  const filePath = path.isAbsolute(argPath) ? argPath : path.resolve(process.cwd(), argPath);
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const payload: AdPayoutData = parsed.data ?? parsed;

  if (!payload?.roomId) {
    throw new Error('Payload must include roomId');
  }

  await connectDB();

  if (!Types.ObjectId.isValid(payload.roomId)) {
    throw new Error(`Invalid roomId: ${payload.roomId}`);
  }

  const room = await Room.findById(payload.roomId).select('_id');
  if (!room) {
    throw new Error(`Room not found for id ${payload.roomId}`);
  }

  const existing = await AdPayout.findOne({ room: room._id });

  const payoutDoc = await AdPayout.findOneAndUpdate(
    { room: room._id },
    {
      room: room._id,
      roomId: room._id.toString(),
      status: 'completed',
      payload,
      swapTxHash: payload.swapTxHash,
      transferTxHashes: payload.transferTxHashes,
      approveTxHash: payload.approveTxHash,
      usdAmountSwapped: payload.usdAmountSwapped,
      fireAmountToDistribute: payload.fireAmountToDistribute,
      fireBalanceRaw: payload.fireBalanceRaw,
      uniqueAds: payload.uniqueAds,
      uniqueUsers: payload.uniqueUsers,
      totalRecipients: payload.totalRecipients,
      totalBatches: payload.totalBatches,
      distributionDetails: payload.distribution.details
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (existing?.status === 'completed') {
    console.log('ℹ️ Payout already existed — skipped user earnings update to avoid double counting.');
  } else {
    await updateUserEarningsFromDetails(
      payload.distribution.details,
      payload.usdAmountSwapped,
      payload.fireAmountToDistribute,
      payload.roomId,
      payoutDoc._id
    );
  }

  console.log('✅ Backfill complete', {
    payoutId: payoutDoc._id.toString(),
    roomId: payload.roomId,
    recipients: payload.totalRecipients
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});

