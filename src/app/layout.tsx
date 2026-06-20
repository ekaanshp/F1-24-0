import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'F1 TeamBuilder — Build Your Ultimate Team',
  description:
    'Draft legendary F1 drivers, engineers, and chassis from across decades. Build your ultimate team and compete on the global leaderboard.',
  keywords: ['F1', 'Formula 1', 'team builder', 'draft', 'arcade', 'racing'],
  openGraph: {
    title: 'F1 TeamBuilder',
    description: 'Build your ultimate F1 team from any decade in history.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* TODO(security): Add CSP headers via next.config.ts headers() */}
        <meta name="theme-color" content="#0D0D0D" />
      </head>
      <body className="antialiased">
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
