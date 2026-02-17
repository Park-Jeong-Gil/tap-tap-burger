import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getRoomHostNickname } from '@/lib/supabase';
import { translations } from '@/lib/translations';
import type { Locale } from '@/lib/translations';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const hostNickname = await getRoomHostNickname(roomId);
  const cookieStore = await cookies();
  const locale = (cookieStore.get('locale')?.value ?? 'en') as Locale;
  const t = translations[locale];

  const description =
    locale === 'ko'
      ? `${hostNickname}님이 당신에게 승부를 걸어왔습니다.`
      : `${hostNickname} has challenged you to a match!`;

  return {
    title: t.versusLayoutTitle,
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
