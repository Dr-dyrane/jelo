import type { Metadata, Viewport } from 'next';
import { Italiana, Manrope } from 'next/font/google';
import '../globals.css';

const display = Italiana({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Sign in · JeloCare Ops',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { colorScheme: 'light dark' };

const themeScript = `(function(){try{var t=localStorage.getItem('jelo-theme');var m=t==='dark'?'dark':'light';var e=document.documentElement;e.setAttribute('data-theme',m);e.style.colorScheme=m;}catch(err){var e=document.documentElement;e.setAttribute('data-theme','light');e.style.colorScheme='light';}})();`;

// A minimal, unguarded root layout for the operator sign-in surface. It carries no
// public chrome and no console chrome — an operator must be able to reach it while
// signed out (the /ops tree 404s until they are an allowlisted, signed-in operator).
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
