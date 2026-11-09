'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const WRAP = 'mx-auto w-full max-w-[1240px] px-7';

const BTN_PRIMARY =
  'inline-flex items-center justify-center rounded-full border border-[#ff5a00] bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] px-7 py-4 font-bold text-white shadow-[0_8px_22px_rgba(255,77,0,0.25)] transition-transform duration-300 hover:scale-[1.04]';

const BTN_SECONDARY =
  'inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-7 py-4 font-bold text-[#111] transition-all duration-300 hover:border-[#ff6a00] hover:bg-[#ff6a00] hover:text-white';

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);

  // Animates the CTA content and background glows when the section enters view.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          once: true,
        },
      });

      timeline
        .fromTo(
          '.cta-label',
          {
            opacity: 0,
            y: 15,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
          }
        )
        .fromTo(
          '.cta-heading',
          {
            opacity: 0,
            x: -35,
          },
          {
            opacity: 1,
            x: 0,
            duration: 0.85,
            ease: 'power3.out',
          },
          '-=0.25'
        )
        .fromTo(
          '.cta-description',
          {
            opacity: 0,
            x: 30,
          },
          {
            opacity: 1,
            x: 0,
            duration: 0.75,
            ease: 'power3.out',
          },
          '-=0.4'
        )
        .fromTo(
          '.cta-buttons',
          {
            opacity: 0,
            y: 25,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
          },
          '-=0.3'
        )
        .fromTo(
          '.cta-note',
          {
            opacity: 0,
            y: 12,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power2.out',
          },
          '-=0.2'
        );

      // Adds a slow, subtle movement to the decorative background glows.
      gsap.to('.cta-glow', {
        scale: 1.12,
        opacity: 0.8,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: 0.5,
      });
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="bg-black py-12 font-body text-bone sm:py-16"
    >
      <div className={WRAP}>
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#121214] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="cta-glow pointer-events-none absolute -left-32 -top-40 h-80 w-80 rounded-full bg-[#ff5a00]/15 blur-[110px]"
          />

          <div
            aria-hidden="true"
            className="cta-glow pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full bg-[#e81e2b]/10 blur-[110px]"
          />

          <div className="relative mx-auto max-w-3xl">
            <p className="cta-label mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#ff7838]">
              Get Started With ArixCall
            </p>

            <h2 className="cta-heading font-display text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Never miss a customer call again.
            </h2>

            <p className="cta-description mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9c9ce] sm:text-lg">
              Start your 14-day free trial today — no credit card, no
              obligation. Add the AI Receptionist whenever you're ready.
            </p>

            <div className="cta-buttons mt-9 flex flex-wrap items-center justify-center gap-3">
              <a href="/signup/start" className={BTN_PRIMARY}>
                Start free trial
              </a>

              <a
                href="mailto:sales@arixcall.com?subject=Demo%20Request"
                className={BTN_SECONDARY}
              >
                Start a demo
              </a>
            </div>

            <p className="cta-note mt-6 text-xs font-medium tracking-wide text-[#85858d]">
              14-day free trial · No credit card required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
