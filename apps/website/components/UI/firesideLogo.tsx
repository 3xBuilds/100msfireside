import Image from "next/image";
import { twMerge } from "tailwind-merge";

interface FiresideLogoProps {
  className?: string;
}

export default function FiresideLogo({ className }: FiresideLogoProps){
    return (
<div className={twMerge("flex items-center justify-center", className)}>
        <Image
                src={`${process.env.NEXT_PUBLIC_URL}/fireside-logo.svg`}
                width={1080}
                height={1080}
                alt="Fireside Logo"
                className="aspect-square w-[15%]"
              />
              <Image
                src={`${process.env.NEXT_PUBLIC_URL}/fireside-name.png`}
                width={1920}
                height={1080}
                alt="Fireside Logo"
                className="w-[70%]"
               
              />
    </div>
    )
    
}