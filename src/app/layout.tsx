import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vibewise',
  description: 'The hotel that learns you before you arrive.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
