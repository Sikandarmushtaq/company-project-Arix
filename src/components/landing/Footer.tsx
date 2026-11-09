
'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { FaApple, FaGooglePlay } from 'react-icons/fa';
import { pathnameToSectionId } from '@/lib/landing/sections';
import { ArixMark } from '../ui';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'AI Receptionist', href: '/ai-dialer' },
      { label: 'Bulk SMS', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Industry', href: '/compare' },
      { label: 'Ivr and Auto Attendent', href: '/ai-dialer' },
      { label: 'Call Recording & Analytics', href: '/ai-dialer' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'FAQ', href: '/faq' },
      { label: 'Security', href: '/security' },
      { label: 'Legal & KYC', href: '/legal' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

const socials = [
  {
    href: 'https://instagram.com/bitnextechnologies',
    Icon: FaInstagram,
    label: 'Instagram',
  },
  {
    href: 'https://www.linkedin.com/company/bitnex-technologies/',
    Icon: FaLinkedinIn,
    label: 'LinkedIn',
  },
  {
    href: 'https://facebook.com/bitnextechnologies',
    Icon: FaFacebookF,
    label: 'Facebook',
  },
];

const appLinks = [
  {
    label: 'Download on the App Store',
    store: 'App Store',
    href: 'https://apps.apple.com/us/app/arixcall/id6813129875',
    Icon: FaApple,
  },
  {
    label: 'Get it on Google Play',
    store: 'Google Play',
    href: 'https://play.google.com/store/apps/details?id=com.arixcall.dialer',
    Icon: FaGooglePlay,
  },
];

const FLINK =
  'text-[15px] text-[#d0d0d0] underline decoration-transparent decoration-2 underline-offset-[6px] transition hover:text-bone hover:decoration-ember';

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  // Reveals the brand, footer columns and bottom bar with a smooth stagger.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 88%',
          once: true,
        },
      });

      timeline
        .fromTo(
          '.footer-brand',
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: 'power3.out',
          },
        )
        .fromTo(
          '.footer-column',
          { opacity: 0, y: 25 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.12,
            ease: 'power3.out',
          },
          '-=0.45',
        )
        .fromTo(
          '.footer-social',
          { opacity: 0, y: 12, scale: 0.85 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.45,
            stagger: 0.1,
            ease: 'back.out(1.5)',
          },
          '-=0.35',
        )
        .fromTo(
          '.footer-bottom',
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
          },
          '-=0.2',
        );
    }, footerRef);

    return () => context.revert();
  }, []);

  return (
    <footer ref={footerRef} className="bg-[#050505] font-body">
      <div className="mx-auto w-full max-w-[1240px] px-7 pt-12 pb-9">
        <div className="grid grid-cols-2 gap-10 min-[880px]:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          {/* Brand information and social links. */}
          <div className="footer-brand col-span-2 min-[880px]:col-span-1 min-[880px]:pr-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <ArixMark size={34} />

              <span className="text-3xl font-bold tracking-tight leading-none">
                <span className="text-[var(--coral)]">Arix</span>
                <span className="text-white">Call</span>
              </span>
            </Link>

            <p className="mt-4 max-w-[34ch] text-[15px] leading-[1.55] text-[#9a9a9a]">
              The professional cloud dialer for revenue teams. Carrier-grade
              calls, an AI auto-dialer, bulk SMS and compliance recording — all
              in one softphone.
            </p>

            <a
              href="mailto:support@arixcall.com"
              className={`mt-4 inline-block ${FLINK}`}
            >
              support@arixcall.com
            </a>

            <div className="mt-6 flex items-center gap-2">
              {socials.map((s) => {
                const Icon = s.Icon;

                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="footer-social flex h-9 w-9 items-center justify-center rounded-full border border-line text-[#9a9a9a] transition hover:border-ember hover:text-ember"
                  >
                    <Icon size={14} />
                  </a>
                );
              })}
            </div>

            {/* Mobile app download links. */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {appLinks.map((app) => {
                const Icon = app.Icon;

                return (
                  <a
                    key={app.store}
                    href={app.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={app.label}
                    className="footer-social flex items-center gap-2 rounded-lg border border-[#353535] bg-[#111111] px-3 py-2.5 text-white transition hover:border-ember hover:bg-[#1b1b1b]"
                  >
                    <Icon size={21} />
                    <span className="flex flex-col">
                      <span className="text-[9px] leading-tight text-[#999999]">
                        {app.label}
                      </span>
                      <span className="text-[13px] font-semibold leading-tight">
                        {app.store}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Footer navigation columns. */}
          {columns.map((col) => (
            <div key={col.title} className="footer-column">
              <h4 className="mb-4 font-display text-[22px] font-extrabold leading-none text-fog">
                {col.title}
              </h4>

              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      scroll={
                        pathnameToSectionId(link.href) ? false : undefined
                      }
                      className={FLINK}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright and footer closing text. */}
        <div className="footer-bottom mt-14 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-[13.5px] text-[#7d7d7d] sm:flex-row">
          <p>©2026 arixcall.com All rights reserved.</p>
          <p>Built for revenue teams. Made with care.</p>
        </div>
      </div>
    </footer>
  );
}
