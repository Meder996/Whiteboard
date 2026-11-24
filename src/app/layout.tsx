import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/kalam/400.css';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Whiteboard Studio — think together, visually',
  description:
    'A fast, accessible collaborative whiteboard for brainstorming, flowcharts, kanban boards, mind maps and meeting notes. Export to PNG, SVG and JSON.',
  applicationName: 'Whiteboard Studio',
  keywords: ['whiteboard', 'collaboration', 'brainstorming', 'mind map', 'flowchart', 'kanban'],
  authors: [{ name: 'Whiteboard Studio' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
  ],
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('whiteboard-studio:theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <div aria-hidden className="sr-only" id="a11y-announcer" role="status" aria-live="polite" />
      </body>
    </html>
  );
}
