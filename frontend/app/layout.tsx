import type { Metadata } from 'next';
import './globals.css';
import RootLayoutWrapper from './layout-wrapper';

export const metadata: Metadata = {
  title: 'piTech Route Optimization',
  description: 'Route optimization powered by piTech',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <RootLayoutWrapper>
          {children}
        </RootLayoutWrapper>
      </body>
    </html>
  );
}
