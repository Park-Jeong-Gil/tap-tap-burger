import type { Metadata } from 'next';
import { getRoomHostNickname } from '@/lib/supabase';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const hostNickname = await getRoomHostNickname(roomId);
  const description = `${hostNickname}님이 당신에게 협동을 요청합니다.`;
  return {
    title: 'Tap Tap Burger: 협동 모드',
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
