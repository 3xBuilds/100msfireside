"use client";
import Image from "next/image";
import FiresideLogo from "./firesideLogo";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { usePathname } from "next/navigation";

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
      <button
        onClick={handleProfileClick}
        className={`flex flex-col absolute right-4 items-center transition-colors ${
          isProfilePage ? "text-white" : "text-gray-300 hover:text-white"
        }`}
      >
        {user ? (
          <>
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
            </div>{" "}
          </>
        ) : (
          <div className="bg-white/10 animate-pulse w-6 aspect-square rounded-md"></div>
        )}
      </button>
    </header>
  );
}
