import * as jose from 'jose';
import config from '../config';

/**
 * Wallet authentication middleware that validates JWT tokens issued by the SIWE verify endpoint.
 * Sets the x-user-address header for downstream use, making it compatible with route patterns.
 */
export const walletAuthMiddleware = async ({
  set,
  headers,
}: {
  set: any;
  headers: any;
}) => {
  console.log("🔐 WALLET AUTH MIDDLEWARE HIT");

  // Sanitize: never trust a client-supplied x-user-address header.
  delete headers["x-user-address"];

  try {
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

    // Verify JWT using jose
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const walletAddress = payload.sub;
    if (!walletAddress) {
      console.log("❌ Missing wallet address in JWT payload");
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized - Missing wallet address in token",
      };
    }

    // Set the x-user-address header for downstream use
    headers["x-user-address"] = walletAddress.toLowerCase();
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      console.log("❌ JWT token expired");
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized - Token expired",
      };
    }
    console.error("💥 WALLET AUTH MIDDLEWARE ERROR:", error);
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized - Invalid token",
    };
  }
};
