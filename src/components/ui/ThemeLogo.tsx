'use client';

import React, { useState, useEffect } from 'react';

interface ThemeLogoProps {
  /** Logo for light mode (dark logo) */
  lightSrc?: string;
  /** Logo for dark mode (light/bright logo) */
  darkSrc?: string;
  alt: string;
  className?: string;
}

/**
 * ThemeLogo - Automatically switches between light and dark mode logos
 *
 * Place your logos in /public:
 * - /logo.png - for light mode (dark colored logo)
 * - /logo-light.png - for dark mode (light colored logo)
 */
export function ThemeLogo({
  lightSrc = '/logo.png?v=3',
  darkSrc = '/logo-light.png?v=3',
  alt,
  className,
}: ThemeLogoProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check initial theme
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    // Watch for theme changes using MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Also listen for storage changes (theme changed in another tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        checkTheme();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Prevent hydration mismatch by showing nothing until mounted
  if (!mounted) {
    return <div className={className} style={{ visibility: 'hidden' }} />;
  }

  return <img src={isDark ? darkSrc : lightSrc} alt={alt} className={className} />;
}

export default ThemeLogo;
