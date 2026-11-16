import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import React from 'react';
import { HeroBand } from '@/components/layout/HeroBand';
import { KpiGrid } from '@/components/layout/KpiGrid';
import { Topbar } from '@/components/layout/Topbar';
import { SmartChainProvider } from '@/hooks/useSmartChainMode';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'SmartChain — Kendali Rantai Pasok PT Nusantara Manufacturing',
  description:
    'Platform terpadu SRM, Procurement/PO, WMS Offline-First, Order Anomaly Guard, TMS, dan Business Analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <SmartChainProvider>
          <Topbar />
          <HeroBand />
          <main className="sc-container" style={{ paddingTop: 24, paddingBottom: 48 }}>
            <KpiGrid />
            {children}
          </main>
        </SmartChainProvider>
      </body>
    </html>
  );
}
