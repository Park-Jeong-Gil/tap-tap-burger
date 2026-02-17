import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@/styles/globals.scss";
import { LocaleProvider } from "@/providers/LocaleProvider";
import { translations } from "@/lib/translations";
import type { Locale } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("locale")?.value ?? "en") as Locale;
  const t = translations[locale];

  return {
    title: "Tap Tap Burger",
    description: t.metaDesc,
    icons: {
      icon: [{ url: "/favicon.ico" }, { url: "/favicon.png", type: "image/png" }],
    },
    openGraph: {
      title: "Tap Tap Burger",
      description: t.metaDesc,
      images: [
        {
          url: "/thumbnail.jpg",
          width: 1200,
          height: 630,
          alt: "Tap Tap Burger",
        },
      ],
      type: "website",
      locale: locale === "ko" ? "ko_KR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "Tap Tap Burger",
      description: t.metaDesc,
      images: ["/thumbnail.jpg"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("locale")?.value ?? "en") as Locale;

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <div className="container">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
