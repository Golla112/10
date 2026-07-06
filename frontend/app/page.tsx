import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <section className='sb-home sb-home-compact'>
      <div className='sb-home-hero sb-enter'>
        <div className='sb-home-overlay' />
        <div className='sb-home-content sb-home-content-premium'>
          <div className='sb-home-copy'>
            <div className='neon-badge'>BigBet365</div>
            <h1 className='sb-home-title'>Sportsbook prematch e live</h1>
            <p className='sb-home-lead'>
              Palinsesto completo, quote aggiornate e coupon rapido. Scegli dove giocare.
            </p>
            <div className='sb-home-actions'>
              <Link href='/prematch' className='sb-home-cta sb-home-cta-primary'>
                Prematch
              </Link>
              <Link href='/live' className='sb-home-cta sb-home-cta-live'>
                Live
              </Link>
              <Link href='/verifica' className='sb-home-cta sb-home-cta-ghost'>
                Verifica schedina
              </Link>
            </div>
          </div>
          <div className='sb-home-poster-wrap'>
            <div className='sb-home-poster-panel compact'>
              <Image
                src='/homepage-foto.png'
                alt='BigBet365'
                fill
                priority
                className='sb-home-poster-image'
                sizes='(max-width: 900px) 100vw, 38vw'
              />
            </div>
          </div>
        </div>
      </div>

      <div className='sb-home-grid compact'>
        <Link href='/prematch' className='sb-home-card sb-panel'>
          <h2>Prematch</h2>
          <p>Tutti i campionati, filtri mercato e quote complete.</p>
        </Link>
        <Link href='/live' className='sb-home-card sb-panel live'>
          <h2>Live</h2>
          <p>Eventi in corso con aggiornamento realtime.</p>
        </Link>
        <Link href='/verifica' className='sb-home-card sb-panel'>
          <h2>Verifica</h2>
          <p>Controlla codice schedina ed esito.</p>
        </Link>
      </div>
    </section>
  );
}
