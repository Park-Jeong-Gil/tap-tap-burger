import type { Metadata } from 'next';
import { getRoomHostNickname } from '@/lib/supabase';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const hostNickname = await getRoomHostNickname(roomId);
  const description = `${hostNickname} has challenged you to a match!`;
  return {
    title: 'Tap Tap Burger: Versus',
    description,
    openGraph: { description },
  };
}

export default function VersusRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
