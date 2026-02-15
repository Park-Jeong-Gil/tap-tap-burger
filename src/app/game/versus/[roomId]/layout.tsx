import type { Metadata } from 'next';
import { getRoomHostNickname } from '@/lib/supabase';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const hostNickname = await getRoomHostNickname(roomId);
  const description = `${hostNickname}님이 당신에게 승부를 걸어왔습니다.`;
  return {
    title: 'Tap Tap Burger: 대전 모드',
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
