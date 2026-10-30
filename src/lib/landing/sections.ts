/**
 * Landing-page section routing.
 *
 * The landing is a single scrolling page, but each major section has its own
 * real URL path (no `#`): scrolling to Pricing shows `/pricing`, loading
 * `/pricing` directly scrolls there, and unknown paths 404. This map is the
 * single source of truth linking a clean URL slug to the section's DOM id.
 *
 * IMPORTANT: slugs must NOT collide with real marketing routes. The landing has
 * a Stats block with id="about" and a CTA with id="contact", but `/about` and
 * `/contact` are separate real pages — so those two sections are deliberately
 * NOT given a path (they resolve to `/`).
 *
 * When adding a slug here, also add it to the section rewrite in next.config.ts
 * (the `source` alternation) so direct-load / refresh serves the landing.
 *
 * @module lib/landing/sections
 */

export interface SectionRoute {
  /** URL slug, e.g. "pricing" → /pricing */
  path: string;
  /** The section's DOM element id on the landing page. */
  id: string;
}

export const SECTION_ROUTES: readonly SectionRoute[] = [
  { path: 'features', id: 'channels' },
  { path: 'ai-dialer', id: 'ai' },
  { path: 'how-it-works', id: 'how-it-works' },
  { path: 'compare', id: 'compare' },
  { path: 'pricing', id: 'pricing' },
  { path: 'faq', id: 'faq' },
] as const;

/** Slugs only — reuse for the next.config rewrite + validation. */
export const SECTION_PATHS = SECTION_ROUTES.map((s) => s.path);

const idToPath = new Map(SECTION_ROUTES.map((s) => [s.id, s.path]));
const pathToId = new Map(SECTION_ROUTES.map((s) => [s.path, s.id]));

/** Section DOM id → clean URL path (e.g. "pricing" → "/pricing"). Null if the id has no route (about/contact/hero). */
export function sectionIdToHref(id: string): string | null {
  const path = idToPath.get(id);
  return path ? `/${path}` : null;
}

/** URL pathname → section DOM id (e.g. "/pricing" → "pricing"). Null if not a section path. */
export function pathnameToSectionId(pathname: string): string | null {
  const slug = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return pathToId.get(slug) ?? null;
}

/** True when the pathname is the landing root or one of its section paths. */
export function isLandingPath(pathname: string): boolean {
  return pathname === '/' || pathnameToSectionId(pathname) !== null;
}

// ---------------------------------------------------------------------------
// ScrollSpy ↔ SectionScroller coordination
//
// ScrollSpy rewrites the URL as you scroll (history.replaceState). Next's router
// observes that and updates usePathname — which SectionScroller watches to scroll
// on real navigation. Without coordination the spy's own URL writes would make
// SectionScroller yank the page mid-scroll. So whenever we write the URL
// programmatically (spy on scroll, or a nav click that already scrolled), we
// record that path; SectionScroller skips a pathname it recognises as our own
// write and only scrolls for genuine navigations (direct load, cross-page, a
// plain link click).
// ---------------------------------------------------------------------------
let programmaticFlag = false;

/**
 * Mark the NEXT pathname change as our own programmatic write (the scroll spy, or
 * a nav click that already scrolled). Call this ONLY when the path actually
 * changes, so it pairs 1:1 with the single SectionScroller run that consumes it —
 * otherwise the flag could go stale and swallow a later genuine navigation.
 */
export function markProgrammaticPath(): void {
  programmaticFlag = true;
}

/**
 * Consumed once per pathname change by SectionScroller: `true` → we wrote this
 * URL (skip the scroll), `false` → a genuine navigation (scroll to the section).
 */
export function consumeProgrammaticNav(): boolean {
  if (programmaticFlag) {
    programmaticFlag = false;
    return true;
  }
  return false;
}
