// import { Redis } from "ioredis";
import Redis from "ioredis";

export const queue_redis = new Redis(`${process.env.REDIS_QUEUE_URL}`, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  offlineQueue: true,
});

try {
  queue_redis.on("error", (error) => {
    console.error("[ERROR] Queue Redis: ", error);
  });

  queue_redis.on("connect", () => {
    // console.log("Connected to Redis Queue");
  });
} catch {
  console.error("Error connecting to Redis Queue");
}