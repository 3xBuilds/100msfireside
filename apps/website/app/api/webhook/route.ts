import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Webhook handler - Farcaster-specific webhook parsing removed
  // This endpoint can be repurposed for other webhook integrations
  return NextResponse.json({ message: "Webhook received successfully" }, { status: 200 });
}
  