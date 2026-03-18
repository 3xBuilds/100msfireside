"use client";
import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "./UI/drawer";
import { MdError } from "react-icons/md";
import { FaTools } from "react-icons/fa";

export default function HighTrafficDrawer() {
  const [open, setOpen] = useState(true);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="bg-black">
        <DrawerHeader>
          <DrawerTitle className="text-center gradient-text text-2xl">
            Temporarily Down for Maintenance
          </DrawerTitle>
          <DrawerDescription className="text-center text-white/70">
            We&apos;re working to improve your experience
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <MdError className="text-orange-500 text-2xl flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-white mb-1">High Traffic Detected</h3>
              <p className="text-sm text-white/70">
                We&apos;re experiencing higher than usual traffic and are temporarily down to strengthen our infrastructure.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FaTools className="text-fireside-blue text-xl flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-white mb-1">Improving Our Services</h3>
              <p className="text-sm text-white/70">
                Our team is working hard to enhance our systems to provide you with the best possible experience. We&apos;ll be back shortly!
              </p>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <button className="w-full px-6 py-3 gradient-fire text-white rounded-md transition hover:opacity-90 font-bold">
              I Understand
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
