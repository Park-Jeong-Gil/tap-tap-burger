import type { Metadata } from 'next';
import { getRoomHostNickname } from '@/lib/supabase';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const hostNickname = await getRoomHostNickname(roomId);
  const description = `${hostNickname} is inviting you to co-op!`;
  return {
    title: 'Tap Tap Burger: Co-op',
    description,
    openGraph: { description },
  };
}

export default function CoopRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
