import { PrivyClient } from "@privy-io/node";
import config from "../config";

const privy = new PrivyClient({
  appId: config.privyAppId,
  appSecret: config.privyAppSecret,
});

/**
 * Authentication middleware that validates Privy access tokens
 * Sets the x-user-privyid header for downstream use
 */
export const authMiddleware = async ({
  set,
  headers,
}: {
  set: any;
  headers: any;
}) => {
  console.log("🔐 AUTH MIDDLEWARE HIT");

  // Sanitize: never trust a client-supplied x-user-privyid header.
  delete headers["x-user-privyid"];

  try {
    let privyUserId: string | null = null;

    if (config.isDevelopment) {
      privyUserId = config.localPrivyId;
    } else {
      const authorization = headers.authorization || null;

      if (!authorization) {
        console.log("❌ No authorization header found");
        set.status = 401;
        return {
          success: false,
          error: "Unauthorized - Missing authorization header",
        };
      }

      const token = authorization.split(" ")[1];
      if (!token) {
        console.log("❌ Invalid authorization header format");
        set.status = 401;
        return {
          success: false,
          error: "Unauthorized - Invalid authorization header format",
        };
      }

      const verifiedClaims = await privy.verifyAuthToken(
        token,
        config.privyVerificationKey || undefined
      );

      privyUserId = verifiedClaims.userId;
    }

    if (!privyUserId) {
      console.log("❌ Missing userId in Privy token");
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized - Missing userId in token",
      };
    }

    headers["x-user-privyid"] = privyUserId;
  } catch (error) {
    console.error("💥 AUTH MIDDLEWARE ERROR:", error);
    if (error instanceof Error) {
      console.error("🚨 Error message:", error.message);
    }
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized - Invalid or expired token",
      ...(config.isDevelopment &&
        error instanceof Error && { details: error.message }),
    };
  }
};
