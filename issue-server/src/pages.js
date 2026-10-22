/**
 * Page identifiers shared by heatmaps, sessions and feedback. Query strings are
 * dropped everywhere because they may contain personal data or tokens.
 * Must match pageKey() in the extension's report builder.
 */
export function pageKey(href) {
  try {
    const url = new URL(href);
    const hashRoute = url.hash.startsWith('#/') ? url.hash.split('?')[0] : '';
    return `${url.pathname}${hashRoute}`;
  } catch {
    return String(href).split('?')[0];
  }
}

export function stripQuery(href) {
  try {
    const url = new URL(href);
    const hashRoute = url.hash.startsWith('#/') ? url.hash.split('?')[0] : '';
    return `${url.origin}${url.pathname}${hashRoute}`;
  } catch {
    return String(href).split('?')[0];
  }
}

export const DEVICE_LABELS = {
  desktop: 'Desktop (1024px and wider)',
  tablet: 'Tablet (768–1023px)',
  mobile: 'Mobile (under 768px)',
};

export function deviceOf(viewportWidth) {
  if (viewportWidth >= 1024) return 'desktop';
  if (viewportWidth >= 768) return 'tablet';
  return 'mobile';
}
