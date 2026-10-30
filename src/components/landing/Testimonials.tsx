'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatar: string;
}

// Populate with real, attributed testimonials before re-enabling this section
// on the landing page. The component is wired and ready; leaving fake data
// here would be a compliance risk (FTC / ASA require genuine testimonials).
const testimonials: Testimonial[] = [];

export default function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (testimonials.length === 0) {
    return null;
  }

  const scrollByCard = (direction: 'prev' | 'next') => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const card = container.querySelector<HTMLElement>('[data-testimonial-card]');
    const cardWidth = card?.offsetWidth ?? container.clientWidth;
    const gap = 24;
    const delta = direction === 'next' ? cardWidth + gap : -(cardWidth + gap);

    container.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const updateActiveIndex = () => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const card = container.querySelector<HTMLElement>('[data-testimonial-card]');
    const cardWidth = card?.offsetWidth ?? container.clientWidth;
    const gap = 24;
    const rawIndex = Math.round(container.scrollLeft / (cardWidth + gap));
    const clampedIndex = Math.max(0, Math.min(rawIndex, testimonials.length - 1));

    setActiveIndex(clampedIndex);
  };

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden bg-gradient-to-b from-white via-[#f7f5f3]/70 to-white py-20 dark:from-[#121212] dark:via-[#121212]/60 dark:to-[#121212] sm:py-24"
    >
      <div
        className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.18),_rgba(99,102,241,0)_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
            Testimonials
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
            Trusted by Teams Worldwide
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            See why revenue leaders and support teams rely on ArixCall to power every conversation.
          </p>
        </div>

        <div className="relative mt-12">
          <button
            type="button"
            onClick={() => scrollByCard('prev')}
            aria-label="Previous testimonial"
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 p-2 text-slate-700 shadow-lg shadow-slate-300/30 backdrop-blur transition hover:scale-105 hover:bg-white dark:border-white/10 dark:bg-[#1e1e1e]/70 dark:text-white md:hidden"
          >
            <FiChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard('next')}
            aria-label="Next testimonial"
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 p-2 text-slate-700 shadow-lg shadow-slate-300/30 backdrop-blur transition hover:scale-105 hover:bg-white dark:border-white/10 dark:bg-[#1e1e1e]/70 dark:text-white md:hidden"
          >
            <FiChevronRight size={18} />
          </button>
          <motion.div
            ref={scrollRef}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            onScroll={updateActiveIndex}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 pr-4 pt-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:gap-6 md:overflow-visible md:pb-0 md:pr-0 md:pt-0 md:[scrollbar-width:auto] lg:grid-cols-4 md:grid-cols-2"
          >
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                data-testimonial-card
                className="flex h-full min-w-[85vw] snap-center flex-col rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm shadow-black/5 backdrop-blur transition hover:-translate-y-1 hover:shadow-lg hover:shadow-black/15 dark:border-white/10 dark:bg-[#1e1e1e]/60 sm:min-w-[70vw] md:min-w-0"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    width={48}
                    height={48}
                    className="rounded-full ring-2 ring-white/70 dark:ring-white/10"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{testimonial.role}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-4 flex gap-1 text-[var(--warning)]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <FaStar key={index} size={14} />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
          <div className="mt-4 flex items-center justify-center gap-2 md:hidden">
            {testimonials.map((testimonial, index) => (
              <span
                key={testimonial.name}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex
                    ? 'w-6 bg-[var(--primary-600)]'
                    : 'w-2 bg-slate-300/80 dark:bg-slate-700/70'
                }`}
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">
              Slide {activeIndex + 1} of {testimonials.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
