import Link from 'next/link';
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { pathnameToSectionId } from '@/lib/landing/sections';
import { ArixMark, ArixWordmark } from '../ui';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'AI Dialer', href: '/ai-dialer' },
      { label: 'Bulk SMS', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Compare', href: '/compare' },
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
      { label: 'ArixCall vs Aircall', href: '/vs/aircall' },
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
  { href: 'https://instagram.com/bitnextechnologies', Icon: FaInstagram, label: 'Instagram' },
  {
    href: 'https://www.linkedin.com/company/bitnex-technologies/',
    Icon: FaLinkedinIn,
    label: 'LinkedIn',
  },
  { href: 'https://facebook.com/bitnextechnologies', Icon: FaFacebookF, label: 'Facebook' },
];

/* footer link (design: .fg a — bone-grey, ember underline on hover) */
const FLINK =
  'text-[15px] text-[#d0d0d0] underline decoration-transparent decoration-2 underline-offset-[6px] transition hover:text-bone hover:decoration-ember';

export default function Footer() {
  return (
    <footer className="bg-[#050505] font-body">
      <div className="mx-auto w-full max-w-[1240px] px-7 pt-12 pb-9">
        <div className="grid grid-cols-2 gap-10 min-[880px]:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="col-span-2 min-[880px]:col-span-1 min-[880px]:pr-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <ArixMark size={34} />
              <ArixWordmark className="text-3xl" />
            </Link>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-[1.55] text-[#9a9a9a]">
              The professional cloud dialer for revenue teams. Carrier-grade calls, an AI
              auto-dialer, bulk SMS and compliance recording — all in one softphone.
            </p>
            <a href="mailto:support@arixcall.com" className={`mt-4 inline-block ${FLINK}`}>
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
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-[#9a9a9a] transition hover:border-ember hover:text-ember"
                  >
                    <Icon size={14} />
                  </a>
                );
              })}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 font-display text-[22px] font-extrabold leading-none text-fog">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      scroll={pathnameToSectionId(link.href) ? false : undefined}
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

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-[13.5px] text-[#7d7d7d] sm:flex-row">
          <p>© {new Date().getFullYear()} Bitnex Technologies. All rights reserved.</p>
          <p>Built for revenue teams. Made with care.</p>
        </div>
      </div>
    </footer>
  );
}
