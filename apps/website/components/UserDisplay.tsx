"use client";

import { useGlobalContext } from "@/utils/providers/globalContext";

export default function UserDisplay() {
  const { user } = useGlobalContext();
  
  if(user)
  return <span className="gradient-fire-text">{user?.displayName}</span>

  else return <span className="w-40 rounded-md bg-white/20 h-6 animate-pulse inline-block"></span>
}
