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
      ? `${hostNickname}님이 당신에게 협동을 요청합니다.`
      : `${hostNickname} is inviting you to co-op!`;

  return {
    title: t.coopLayoutTitle,
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
