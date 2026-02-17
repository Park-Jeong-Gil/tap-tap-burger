import { NextRequest, NextResponse } from 'next/server';
import type { Locale } from '@/lib/translations';

export function middleware(request: NextRequest) {
  const existing = request.cookies.get('locale')?.value as Locale | undefined;

  if (existing === 'ko' || existing === 'en') {
    // 이미 쿠키가 있으면 그대로 유지
    const response = NextResponse.next();
    response.headers.set('x-locale', existing);
    return response;
  }

  // Vercel Geo: x-vercel-ip-country 헤더로 국가 감지
  const country = request.headers.get('x-vercel-ip-country');

  const locale: Locale = country === 'KR' ? 'ko' : 'en';

  const response = NextResponse.next();
  response.cookies.set('locale', locale, {
    maxAge: 60 * 60 * 24 * 365, // 1년
    path: '/',
    sameSite: 'lax',
  });
  response.headers.set('x-locale', locale);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
