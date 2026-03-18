"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Fireside",
  projectId:"5d10af3027c340310f3a3da64cbcedac",
  chains: [base],
  ssr: true,
});
