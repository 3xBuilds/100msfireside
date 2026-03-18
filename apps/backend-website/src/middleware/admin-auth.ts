import config from '../config';

/**
 * Admin Authentication Middleware
 * 
 * Checks for a simple admin token in the Authorization header
 */
export const adminAuthMiddleware = async ({ set, headers }: { set: any, headers: any }) => {
  console.log('🔐 ADMIN AUTH MIDDLEWARE HIT');
  
  try {
    // In development mode, allow all requests if no admin token is set
    if (config.isDevelopment && !config.adminToken) {
      console.log("🛠️  Development mode: allowing admin access without authentication");
      return;
    }

    // Check for Bearer token
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("❌ Missing or invalid authorization header");
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized - Bearer token required"
      };
    }

    const token = authHeader.slice(7);
    
    if (!config.adminToken) {
      console.log("❌ No ADMIN_TOKEN configured");
      set.status = 500;
      return {
        success: false,
        error: "Admin authentication not configured"
      };
    }

    if (token !== config.adminToken) {
      console.log("❌ Invalid admin token");
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized - Invalid admin token"
      };
    }

    console.log("✅ Admin authentication successful");

  } catch (error) {
    console.error('💥 ADMIN AUTH MIDDLEWARE ERROR:', error);
    set.status = 500;
    return {
      success: false,
      error: "Internal server error during admin authentication",
      ...(config.isDevelopment && error instanceof Error && { details: error.message })
    };
  }
};
