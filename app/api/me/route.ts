import { createClient } from "@farcaster/quick-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const client = createClient();
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return NextResponse.json({ status: 401, statusText: "Unauthorized" });
  }

  const payload = await client.verifyJwt({
    token: authorization?.split(" ")[1] as string,
    domain: process.env.HOSTNAME as string,
  });

  const fidParam = payload.sub;
  if (!fidParam) {
    return NextResponse.json(
      { error: "Missing fid parameter" },
      { status: 401 }
    );
  }
  const fid = Number(fidParam);
  if (Number.isNaN(fid)) {
    return NextResponse.json(
      { error: "Invalid fid parameter" },
      { status: 401 }
    );
  }

  // Return the FID which is what the middleware expects
  return NextResponse.json({ 
    user: { 
      fid: fid.toString(),
      address: null // We can add address later if needed
    } 
  });
}
