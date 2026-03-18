import Link from 'next/link';
import { IoIosArrowBack } from 'react-icons/io';
import { fetchAPI } from '@/utils/serverActions';

interface Props {
	params: { username: string };
}

export default async function UserProfilePage({ params }: Props) {
	const { username } = params;
	const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
	// Fetch user and rooms via API
	const response = await fetchAPI(`${URL}/api/users/public/username/${username}`);
	if (!response.ok) {
		return <div className="text-center py-10 text-fireside-red">User not found</div>;
	}
	const { user, rooms } = response.data;

	return (
		<div className="max-w-2xl mx-auto p-4 text-white min-h-screen">
			<div className="mb-4 flex items-center">
				<Link href="/" className="mr-2 p-2 text-white bg-white/20 rounded-full"><IoIosArrowBack/></Link>
			</div>
			<div className="flex items-center gap-4 mb-6">
				<img src={user.pfp_url} alt={user.displayName} className="w-20 h-20 rounded-full object-cover border-2 border-pink-400" />
				<div>
					<div className="text-xl font-semibold">{user.displayName}</div>
					<div className="text-gray-400">@{user.username}</div>
				</div>
			</div>
			<div>
				<h2 className="text-lg font-semibold mb-2 text-gray-400">Hosted Rooms</h2>
				{rooms.length === 0 ? (
					<div className="text-gray-400">No rooms hosted yet.</div>
				) : (
					<ul className="space-y-3">
						{rooms.map((room: any) => (
							<li key={room.roomId} className="p-4 bg-gray-800 rounded-lg">
								<div className="font-bold text-white">{room.name}</div>
								<div className="text-gray-400 text-sm mb-1">{room.description}</div>
								<div className="text-xs text-pink-400 mb-1">Tags: {room.topics.join(', ')}</div>
								<div className="text-xs text-orange-400">Status: {room.status}</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
