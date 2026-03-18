"use client";
import Image from "next/image";
import FiresideLogo from "./firesideLogo";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function MainHeader() {
  const pathname = usePathname();
  const isProfilePage = pathname === "/profile";
  const navigate = useNavigateWithLoader();
  const { user } = useGlobalContext();

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleCleanClick = () => {
    navigate("/clean");
  };

  return (
    <header className=" absolute top-0 left-0 right-0 bg-fireside-darkOrange border-b border-orange-950/50 text-white py-4 w-screen flex items-center justify-center">
      
      <FiresideLogo className="w-32" />
      <div className="absolute right-4">
        {user ? (
          <button
            onClick={handleProfileClick}
            className={`flex flex-col items-center transition-colors ${
              isProfilePage ? "text-white" : "text-gray-300 hover:text-white"
            }`}
          >
            <div>
              <Image
                src={user.pfp_url}
                alt={user.displayName}
                width={120}
                height={120}
                className={`w-6 aspect-square rounded-md ring-2 ${
                  isProfilePage ? " ring-orange-500" : "ring-white"
                }`}
              />
            </div>
          </button>
        ) : (
          <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
        )}
      </div>
    </header>
  );
}
