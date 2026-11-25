import type { Metadata } from 'next';
import { Instrument_Serif, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/hooks/useTheme';
import { ToastProvider } from '@/hooks/useToast';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastContainer } from '@/components/ui/ToastContainer';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap'
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'CollabNotes — Real-Time Collaborative Atelier (OCC · RLS · JSONB)',
  description:
    'Editorial real-time collaborative writing environment powered by Next.js 15, PostgreSQL Row Level Security, Hybrid JSONB storage, and Optimistic Concurrency Control.'
};

const FOUC_FREE_THEME_SCRIPT = `
(function() {
  try {
    var sp = new URLSearchParams(window.location.search);
    var qt = sp.get('theme');
    var st = sessionStorage.getItem('collabnotes.theme.tab.v1');
    var lt = localStorage.getItem('collabnotes.theme.v1');
    var mode = (qt === 'dark' || qt === 'light') ? qt : ((st === 'dark' || st === 'light') ? st : (lt === 'dark' ? 'dark' : 'light'));
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOUC_FREE_THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              {children}
              <ToastContainer />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
