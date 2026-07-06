import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Manrope, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import '../styles/betting-theme.css';
import AppShell from '../components/AppShell';
import Footer from '../components/Footer';
import UserMenu from '../components/UserMenu';
import AdminNavLink from '../components/AdminNavLink';
import BottomNav from '../components/BottomNav';
import MobileCoupon from '../components/MobileCoupon';
import IdleTimer from '../components/IdleTimer';
import Toast from '../components/Toast';
import LayoutToggle, { LayoutProvider } from '../components/LayoutToggle';
import OddsNotifications from '../components/OddsNotifications';

export const metadata: Metadata = {
  title: 'BigBet365 Sportsbook',
  description: 'Piattaforma sportsbook premium con prematch, live, casino e verifica schedine.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05080d',
};

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['500', '600', '700', '800'],
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='it'>
      <body className={`${manrope.variable} ${barlowCondensed.variable}`}>
        <div className='sb-bg-layer' />

        <LayoutProvider>
          <div className='sb-root betting-text'>
            <div className='sb-topline'>
              <span className='sb-18'>18+</span>
              <span>Gioca responsabilmente</span>
              <span className='sb-dot'>•</span>
              <Link href='/gioco-responsabile'>Informazioni</Link>
              <span className='sb-dot'>•</span>
              <Link href='/faq'>FAQ</Link>
              <div className='sb-topline-right'>
                <span>Licenza internazionale</span>
              </div>
            </div>

            <header className='sb-header'>
              <div className='sb-header-main'>
                <Link href='/' className='sb-brand'>
                  <span className='sb-brand-mark'>
                    <Image src='/logo.png' alt='BigBet365' width={34} height={34} priority />
                  </span>
                  <span className='sb-brand-copy'>
                    <span className='sb-brand-name'>BigBet365</span>
                    <span className='sb-brand-sub'>Sportsbook elite experience</span>
                  </span>
                </Link>

                <nav className='sb-primary-nav'>
                  <Link href='/' className='sb-nav-pill'>Home</Link>
                  <Link href='/prematch' className='sb-nav-pill'>Prematch</Link>
                  <Link href='/live' className='sb-nav-pill sb-nav-live'>Live</Link>
                  <Link href='/casino' className='sb-nav-pill'>Casino</Link>
                  <Link href='/verifica' className='sb-nav-pill'>Verifica</Link>
                  <Link href='/dashboard' className='sb-nav-pill'>Dashboard</Link>
                  <AdminNavLink />
                </nav>

                <div className='sb-header-status'>
                  <span className='chip sb-chip-gold'>Quote top</span>
                  <span className='chip'>Live data ready</span>
                </div>

                <div className='sb-user-area'>
                  <UserMenu />
                </div>
              </div>
            </header>

            <main className='sb-main'>
              <AppShell>{children}</AppShell>
            </main>

            <Footer />
            <BottomNav />
            <MobileCoupon />
            <IdleTimer />
            <Toast />
            <OddsNotifications />
            <LayoutToggle />
          </div>
        </LayoutProvider>
      </body>
    </html>
  );
}
