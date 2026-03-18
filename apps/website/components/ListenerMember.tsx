import { ScrollingName } from "./experimental";

interface ListenerMemberProps {
  id: string;
  name: string;
  img?: string;
  onClick: (id: string) => void;
}

export default function ListenerMember({ id, name, img, onClick }: ListenerMemberProps) {
  return (
    <div 
      className="flex flex-col items-center gap-2 cursor-pointer" 
      onClick={() => onClick(id)}
    >
      <div
        className="rounded-full overflow-hidden relative"
        style={{
          width: '48px',
          height: '48px',
        }}
      >
        <img
          src={img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
      <ScrollingName 
        name={name}
        className="text-[10px] w-full text-center" 
        style={{ color: 'rgba(255,255,255,.65)' }}
      />
    </div>
  );
}
