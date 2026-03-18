export async function GET() {

  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://firesidebase.vercel.app";
  const header = process.env.NEXT_PUBLIC_FARCASTER_HEADER;
  const payload = process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD;
  const signature = process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE;
  return Response.json({
    frame: {
      name: baseUrl == "https://firesidebase.vercel.app" ? "Fireside" : "Fireside-test",
      version: "1",
      iconUrl: `${baseUrl}/app-icon2.png`,
      homeUrl: baseUrl,
      imageUrl: `${baseUrl}/fireside_banner.png`,
      buttonTitle: "Tune in!",
      splashImageUrl: `${baseUrl}/app-icon.png`,
      splashBackgroundColor: "#000000",
      webhookUrl: `${baseUrl}/api/webhook`,
      subtitle: "Sparking conversations on Base",
      description: "The ultimate miniapp for connecting people.",
      primaryCategory: "entertainment",
      tags: ["social", "base", "calls", "spaces"],
      heroImageUrl: `${baseUrl}/app-icon2.png`,
      ogTitle: "Fireside"
    },
     accountAssociation: {
    header: header,
    payload: payload,
    signature: signature
  },
  baseBuilder: {
    allowedAddresses: ["0x2E6bcE51aDCF88E58fe8276a210508D6c4085121", "0x3FF23652c47477B69B6b7bc90A79a515860b7165"]
  }
  });
}