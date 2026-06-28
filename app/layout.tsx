import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DFP 2.0',
  description: 'DFP 2.0 internal discovery system'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
