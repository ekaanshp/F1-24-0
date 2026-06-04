import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'F1 TeamBuilder — The 24-0 Challenge',
  description:
    'Build your ultimate F1 team through randomized spins across iconic eras and race a 24-race season. Can you go 24-0?',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
