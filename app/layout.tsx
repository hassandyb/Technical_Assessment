import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Atlas Fresh — Daily export plan',
  description:
    'Decision support for the daily Production and Commercial committee: plan versus actual receipts, the export allocation, and the value falling back to the local market.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Keyboard users land here first and can jump past the header. */}
        <a
          href="#workspace"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-sky-600"
        >
          Skip to the plan
        </a>
        {children}
      </body>
    </html>
  );
}
