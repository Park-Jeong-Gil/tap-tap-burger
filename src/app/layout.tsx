import type { Metadata } from "next";
import "@/styles/globals.scss";

export const metadata: Metadata = {
  title: "Tap Tap Burger",
  description: "Stack ingredients in the exact order to fulfill every order!",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Tap Tap Burger",
    description: "Stack ingredients in the exact order to fulfill every order!",
    images: [
      {
        url: "/thumbnail.jpg",
        width: 1200,
        height: 630,
        alt: "Tap Tap Burger",
      },
    ],
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tap Tap Burger",
    description: "Stack ingredients in the exact order to fulfill every order!",
    images: ["/thumbnail.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
