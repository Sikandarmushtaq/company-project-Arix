
/**
 * Landing-page section routing.
 *
 * The landing is a single scrolling page, but each major section has its own
 * real URL path. Scrolling to Pricing shows /pricing, loading /pricing directly
 * scrolls there, and unknown paths 404.
 *
 * @module lib/landing/sections
 */

export interface SectionRoute {
  path: string;
  id: string;
}

export const SECTION_ROUTES: readonly SectionRoute[] = [
  { path: 'features', id: 'channels' },
  { path: 'ai-dialer', id: 'ai' },
  { path: 'how-it-works', id: 'how-it-works' },
  { path: 'compare', id: 'compare' },
  { path: 'pricing', id: 'pricing' },
  { path: 'legal', id: 'legal' },
  { path: 'faq', id: 'faq' },
] as const;

export const SECTION_PATHS = SECTION_ROUTES.map((s) => s.path);

const idToPath = new Map(SECTION_ROUTES.map((s) => [s.id, s.path]));
const pathToId = new Map(SECTION_ROUTES.map((s) => [s.path, s.id]));

/** Section DOM id → clean URL path. */
export function sectionIdToHref(id: string): string | null {
  const path = idToPath.get(id);
  return path ? `/${path}` : null;
}

/** URL pathname → section DOM id. */
export function pathnameToSectionId(pathname: string): string | null {
  const slug = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return pathToId.get(slug) ?? null;
}

/** Checks whether the pathname belongs to the landing page. */
export function isLandingPath(pathname: string): boolean {
  return pathname === '/' || pathnameToSectionId(pathname) !== null;
}

let programmaticFlag = false;

/** Marks the next pathname change as a programmatic URL update. */
export function markProgrammaticPath(): void {
  programmaticFlag = true;
}

/** Consumes the programmatic navigation flag once. */
export function consumeProgrammaticNav(): boolean {
  if (programmaticFlag) {
    programmaticFlag = false;
    return true;
  }

  return false;
}
