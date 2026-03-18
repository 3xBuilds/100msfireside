'use client'

import Image from "next/image";
import { useEffect, useState } from "react";

const loadingMessages = [
  "Summoning the vibes…",
  "Untangling the internet cables…",
  "Convincing the server to let you in…",
  "Tuning the mic, just for you…",
  "Spilling some virtual coffee…",
  "Sharpening your profile picture…",
  "Feeding the hamsters that power the servers…",
  "Whispering your name to the blockchain…",
  "Downloading the latest gossip…",
  "Charging up the conversation…",
  "Minting your seat in the room…",
  "Syncing your aura with the metaverse…",
  "Pinging the validators for a VIP pass…",
  "Decrypting the banter…",
  "Polishing the smart contracts…",
  "Fueling the space with good vibes only…",
  "Finding the perfect soundwave…",
  "Adjusting your social frequency…",
  "Tokenizing your entrance…",
  "Warming up the stage lights…",
  "Hashing out the intro…",
  "Loading your charisma…",
  "Wrapping your words in NFTs…",
  "Streaming quantum jokes…",
  "Bribing the latency gremlins…",
  "Aligning the digital chakras…"
];

export const Loader = () => {
  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * loadingMessages.length);
    setLoadingMessage(loadingMessages[randomIndex]);
  }, []);

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br">
      <div className="bg-white/5 rounded-lg p-8 text-center border-[1px] border-white/10 shadow-xl">
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
          <Image 
            src={'/fireside-logo.svg'}
            alt="Fireside" 
            className="w-10 h-10 object-contain"
            width={40}
            height={40}
          />
        </div>
        
        {/* <div className="mb-6">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div> */}
        
        <h2 className="text-xl font-semibold text-white mb-2">Connecting...</h2>
        <p className="text-gray-300 text-sm">{loadingMessage}</p>
        
        <div className="mt-6 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};