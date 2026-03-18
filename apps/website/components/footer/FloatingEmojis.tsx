"use client";

import { useEffect } from "react";
import Image from "next/image";

interface FloatingEmoji {
  emoji: string;
  sender: string;
  id: number;
  position: number;
  fontSize: string;
}

interface FloatingEmojisProps {
  emojis: FloatingEmoji[];
}

export default function FloatingEmojis({ emojis }: FloatingEmojisProps) {
  const styles = `
  @keyframes float {
    0% {
      transform: translateY(-15vh);
    }
    100% {
      transform: translateY(-75vh);
    }
  }

  @keyframes fade {
    0% {
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  `;

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <>
      {emojis.map((floatingEmoji) => (
        <div
          key={floatingEmoji.id}
          className="absolute bottom-0 animate-float z-50"
          style={{
            right: `${floatingEmoji.position}%`,
            transform: "translateX(-50%)",
            animation: "float 7s ease-out forwards",
          }}
        >
          <div style={{animation: "fade 5s ease-out forwards"}} className="flex flex-col pointer-events-none items-center relative justify-center rounded-full p-[0.1rem] aspect-square">
            <span
              style={{
                fontSize: `${floatingEmoji.fontSize}rem`,
              }}
            >
              {floatingEmoji.emoji}
            </span>
            <Image
              src={floatingEmoji.sender || "/default-pfp.png"}
              className="w-5 h-5 rounded-full border-2 border-black/50 absolute -bottom-[0.4rem] -right-[0.4rem]"
              alt={floatingEmoji.sender ? floatingEmoji.sender : "Default Avatar"}
              width={32}
              height={32}
            />
          </div>
        </div>
      ))}
    </>
  );
}
