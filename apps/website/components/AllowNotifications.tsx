"use client";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "./UI/drawer";
import { updateUserNotificationToken } from "@/utils/serverActions";
import { IoMdNotifications } from "react-icons/io";
import { FaBell } from "react-icons/fa";
import { toast } from "react-toastify";

export default function AllowNotifications() {
  const { user } = useGlobalContext();
  const { getToken } = useAuthToken();

  // Show drawer if user doesn't have token
  const shouldShowDrawer = user && (!user.token || user.token === "");
  const [open, setOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  // Update open state when shouldShowDrawer changes
  useEffect(() => {
    if (shouldShowDrawer) {
      setOpen(true);
    }
  }, [shouldShowDrawer]);

  const handleEnableNotifications = useCallback(async () => {
    setIsEnabling(true);
    try {
      // Request browser notification permission
      if (!("Notification" in window)) {
        toast.error("Your browser does not support notifications.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied.");
        return;
      }

      const token = await getToken();

      // Save a notification token to the backend
      const notificationToken = `web-${Date.now()}`;
      const res = await updateUserNotificationToken(notificationToken, token);

      if (!res.ok) {
        const errorMsg = res.data?.error || "Failed to save notification details";
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      toast.success("Notifications enabled successfully.");
      setOpen(false);
    } catch (error: any) {
      console.error("Error enabling notifications:", error);
      const errorMessage = error?.message || "Failed to enable notifications. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsEnabling(false);
    }
  }, [getToken]);

  if (shouldShowDrawer)
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-black">
          <DrawerHeader>
            <DrawerTitle className="text-center gradient-text text-2xl">
              Enable Notifications
            </DrawerTitle>
            <DrawerDescription className="text-center text-white/70">
              Stay updated on your conversations
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <IoMdNotifications className="text-fireside-blue text-2xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-white mb-1">Get Real-time Updates</h3>
                <p className="text-sm text-white/70">
                  Receive instant notifications about room reminders, when speakers join your favorite conversations, or when important events happen in your rooms.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaBell className="text-green-500 text-xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-white mb-1">Never Miss Out</h3>
                <p className="text-sm text-white/70">
                  Be the first to know about scheduled rooms going live and join conversations with your favorite speakers.
                </p>
              </div>
            </div>
          </div>
          <DrawerFooter>
            <button 
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="w-full px-6 py-3 gradient-fire flex gap-2 items-center justify-center text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IoMdNotifications className="text-xl"/> 
              {isEnabling ? "Enabling..." : "Enable Notifications"}
            </button>
            <DrawerClose asChild>
              <button className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-md transition">
                Maybe Later
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
}
