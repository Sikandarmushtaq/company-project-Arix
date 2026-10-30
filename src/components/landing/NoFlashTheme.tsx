// Blocking inline script rendered at the very top of <body> in the ROOT layout,
// so it runs on EVERY page (marketing, dialer, admin) before React hydrates —
// eliminating the brief flash of the wrong theme on load/refresh.
//
// Ships as a small inline script via dangerouslySetInnerHTML. Reads the saved
// theme from localStorage ('theme' for the app, 'nuxcall:theme' for marketing),
// falls back to OS preference, and toggles the `dark` class on <html>.

const SCRIPT = `(() => {
  try {
    // The app (admin/dialer) toggle stores under 'theme'; marketing under
    // 'nuxcall:theme'. Read either so the choice is restored site-wide on load.
    var t = localStorage.getItem('theme') || localStorage.getItem('nuxcall:theme');
    // Default is LIGHT: go dark only if explicitly chosen, or 'system' + OS dark.
    var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', d);
  } catch (e) {}
})();`;

export default function NoFlashTheme() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
      // suppress hydration warning since this runs before React
      suppressHydrationWarning
    />
  );
}
