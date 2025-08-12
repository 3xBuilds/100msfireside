import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import sdk from '@farcaster/miniapp-sdk';
import { createClient } from '@farcaster/quick-auth';

// This middleware runs on every request
export async function middleware(request: NextRequest) {
  

  if(process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }
  else{
    const authorization = request.headers.get("Authorization");
  
    if (!authorization) {
      return NextResponse.json({ status: 401, statusText: "Unauthorized" });
    }
  
    const user = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/me`, {
      headers: {
        "Authorization": authorization,
      },
    });

    const userJson = await user.json();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-fid', userJson.user.fid.toString());

    // Create a new response with modified headers
    return NextResponse.next({
        request: {
            headers: requestHeaders
        }
    });
  }
}

// Define the paths where the middleware should run
export const config = {
  matcher: ["/api/protected/:path*"],
};

