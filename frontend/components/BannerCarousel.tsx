'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';

const BANNER = {
  image: '/homepage-foto.png',
  link: '/prematch',
  title: 'Prematch',
};

export default function BannerCarousel() {
  return (
    <div className='sb-hero-banner'>
      <Link href={BANNER.link} className='sb-hero-banner-link'>
        <img src={BANNER.image} alt={BANNER.title} className='sb-hero-banner-img' />
        <span className='sb-hero-banner-cta'>Apri prematch</span>
      </Link>
    </div>
  );
}
