import AdsOverlay from "./AdsOverlay";
import TipOverlay from "./TipOverlay";

export default function Overlays({ roomId }: { roomId: string }) {
    return(
        <div className="w-full flex-col gap-2">
            
            <AdsOverlay roomId={roomId} />
            <TipOverlay />
        </div>
    )
}