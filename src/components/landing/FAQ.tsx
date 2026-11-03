
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiPlus, FiMinus } from 'react-icons/fi';
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

  // Reveals the FAQ section when it enters the viewport.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap.fromTo(
        '.faq-reveal',
        {
          opacity: 0,
          y: 30,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  // Animates an answer when its accordion item opens.
  useEffect(() => {
    if (!answerRef.current) return;

    gsap.fromTo(
      answerRef.current,
      {
        opacity: 0,
        y: 10,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power2.out',
      }
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
        <div className="faq-reveal mb-14 max-w-3xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-9 bg-gradient-to-r from-[#ff7a00] to-[#e81e2b]" />

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

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#a1a1aa] sm:text-lg">
            Find answers to common questions about ArixCall, account
            verification, phone numbers and billing.
          </p>
        </div>

        <div className="faq-reveal max-w-4xl">
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

          <div className="mt-10 flex flex-col gap-3 border-t border-[#2a2a2e] pt-7 sm:flex-row sm:items-center sm:justify-between">
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
