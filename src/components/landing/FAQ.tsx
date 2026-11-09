
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiPlus, FiMinus } from 'react-icons/fi';

gsap.registerPlugin(ScrollTrigger);

const faqItems = [
  {
    question: 'Does Arixcall include an auto dialer?',
    answer:
      'No. Arixcall is a cloud phone and messaging platform — calling, SMS, IVR, campaigns, recording, analytics, team chat and AI Receptionist — and does not include an auto dialer.',
  },
  {
    question: 'What do I need before sending bulk SMS?',
    answer:
      'KYC verification: business registration documents, owner ID, proof of address, and a use-case declaration — plus consent from every recipient. See the Acceptable Use & KYC tab above.',
  },
  {
    question: 'Can I keep my existing number?',
    answer:
      "Ask our team during setup — we'll confirm what's possible for your number before you commit to anything.",
  },
  {
    question: 'How does billing work?',
    answer:
      'Per user, monthly or yearly (yearly saves up to 20%). SMS usage is billed separately. AI Receptionist is an optional paid add-on. Refunds are case-by-case.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const sectionRef = useRef<HTMLElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // ANIMATION 1: Support label and heading enter from the left.
  // ANIMATION 2: Description enters from the right.
  // ANIMATION 3: FAQ accordion cards reveal alternately from left and right.
  // ANIMATION 4: Open answers smoothly fade and slide upward.
  // ANIMATION 5: Bottom support section enters from the bottom.

  // MAIN SCROLL ANIMATIONS
  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const context = gsap.context(() => {
      const heading = section.querySelector('[data-faq-heading]');
      const description = section.querySelector('[data-faq-description]');
      const questions = gsap.utils.toArray<HTMLElement>(
        '[data-faq-card]',
        section,
      );
      const support = section.querySelector('[data-faq-support]');

      // ANIMATION 1: Heading enters from the left.
      gsap.fromTo(
        heading,
        {
          x: -65,
          autoAlpha: 0,
        },
        {
          x: 0,
          autoAlpha: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: heading,
            start: 'top 85%',
            once: true,
          },
        },
      );

      // ANIMATION 2: Description enters from the right.
      gsap.fromTo(
        description,
        {
          x: 65,
          autoAlpha: 0,
        },
        {
          x: 0,
          autoAlpha: 1,
          duration: 0.95,
          delay: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: description,
            start: 'top 88%',
            once: true,
          },
        },
      );

      // ANIMATION 3: FAQ cards alternate between left and right.
      const faqTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: questions[0],
          start: 'top 88%',
          once: true,
        },
      });

      questions.forEach((card, index) => {
        faqTimeline.fromTo(
          card,
          {
            x: index % 2 === 0 ? -55 : 55,
            y: 15,
            autoAlpha: 0,
          },
          {
            x: 0,
            y: 0,
            autoAlpha: 1,
            duration: 0.8,
            ease: 'power3.out',
          },
          index * 0.13,
        );
      });

      // ANIMATION 4: Bottom support section enters from below.
      gsap.fromTo(
        support,
        {
          y: 30,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: support,
            start: 'top 92%',
            once: true,
          },
        },
      );
    }, section);

    return () => context.revert();
  }, []);

  // ANIMATION 5: Animates the currently opened accordion answer.
  useEffect(() => {
    if (!answerRef.current) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    gsap.fromTo(
      answerRef.current,
      {
        opacity: 0,
        y: 12,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power3.out',
      },
    );
  }, [openIndex]);

  // Opens or closes the selected FAQ item.
  const handleToggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="relative overflow-hidden bg-[#101011] py-24 text-white sm:py-28"
    >
      <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-[#ff4d00]/10 blur-[130px]" />

      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-[#e81e2b]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">

        {/* FAQ HEADING SECTION */}
        <div className="mb-14 max-w-3xl">

          {/* Label and heading: left to right */}
          <div data-faq-heading>
            <div className="mb-5 flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff7838]">
                Support
              </p>
            </div>

            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Got questions?
              <br />
              <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
                We've got answers.
              </span>
            </h2>
          </div>

          {/* Description: right to left */}
          <p
            data-faq-description
            className="mt-6 max-w-2xl text-base leading-8 text-[#a1a1aa] sm:text-lg"
          >
            Find answers to common questions about ArixCall, account
            verification, phone numbers and billing.
          </p>
        </div>

        {/* FAQ ACCORDION: alternating card animations */}
        <div className="max-w-4xl">

          <div className="mb-5 flex items-center justify-between border-b border-[#2a2a2e] pb-4">
            <p className="text-sm font-bold text-white">
              Frequently asked questions
            </p>

            <span className="text-xs font-semibold text-[#77777f]">
              {faqItems.length} QUESTIONS
            </span>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <div
                  key={item.question}
                  data-faq-card
                  className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
                    isOpen
                      ? 'border-[#71331e] bg-[#1b1715]'
                      : 'border-[#2d2d31] bg-[#171719] hover:border-[#49494e]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left sm:px-7 sm:py-6"
                  >
                    <span className="flex items-center gap-4">
                      <span
                        className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold sm:flex ${
                          isOpen
                            ? 'bg-[#ff6a00]/15 text-[#ff7838]'
                            : 'bg-[#252528] text-[#77777f]'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <span
                        className={`text-sm font-bold leading-7 transition-colors sm:text-base ${
                          isOpen ? 'text-white' : 'text-[#d4d4d8]'
                        }`}
                      >
                        {item.question}
                      </span>
                    </span>

                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                        isOpen
                          ? 'rotate-180 bg-gradient-to-r from-[#ff7a00] to-[#e81e2b] text-white'
                          : 'bg-[#252528] text-[#a1a1aa]'
                      }`}
                    >
                      {isOpen ? <FiMinus size={16} /> : <FiPlus size={16} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      ref={answerRef}
                      id={`faq-answer-${index}`}
                      className="px-5 pb-6 sm:pl-[76px] sm:pr-7"
                    >
                      <div className="border-t border-[#383034] pt-5">
                        <p className="text-sm leading-8 text-[#a1a1aa] sm:text-[15px]">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SUPPORT FOOTER: bottom to top animation */}
          <div
            data-faq-support
            className="mt-10 flex flex-col gap-3 border-t border-[#2a2a2e] pt-7 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-bold text-white">
                Still have questions?
              </p>

              <p className="mt-1 text-sm text-[#888890]">
                Our team is here to help you.
              </p>
            </div>

            <a
              href="mailto:support@arixcall.com"
              className="w-fit text-sm font-bold text-[#ff7838] transition-colors hover:text-[#ff9b65]"
            >
              support@arixcall.com →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
