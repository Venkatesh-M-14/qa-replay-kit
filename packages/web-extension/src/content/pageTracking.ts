import { record } from 'rrweb';
import { CustomTag } from '~/types';

/**
 * Adds two kinds of custom events to the recording, from the top window only:
 * - navigation: route changes made by single-page apps without a page load
 *   (rrweb itself only records full page loads)
 * - page-metrics: page size and scroll position, needed for scroll-depth heatmaps
 */

const METRICS_THROTTLE_MS = 500;
const SETTLE_AFTER_NAVIGATION_MS = 800;

type Metrics = {
  href: string;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  documentHeight: number;
  // true when the page scrolls inside a panel instead of the document
  container: boolean;
};

/** The element that actually scrolls the page content. */
function mainScroller(target?: EventTarget | null): Element {
  const root = document.scrollingElement || document.documentElement;
  if (
    target instanceof Element &&
    target !== root &&
    target.scrollHeight > target.clientHeight &&
    // only large panels count; small scrolling widgets are not the page
    target.clientHeight >= window.innerHeight * 0.5
  )
    return target;
  return root;
}

export function startPageTracking(): () => void {
  if (window !== window.top) return () => undefined;

  let lastHref = location.href;
  let scroller: Element = mainScroller();
  let throttle: ReturnType<typeof setTimeout> | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const emitMetrics = () => {
    const root = document.scrollingElement || document.documentElement;
    const container = scroller !== root;
    const metrics: Metrics = {
      href: location.href,
      scrollY: Math.round(scroller.scrollTop),
      viewportWidth: window.innerWidth,
      viewportHeight: container ? scroller.clientHeight : window.innerHeight,
      documentHeight: scroller.scrollHeight,
      container,
    };
    record.addCustomEvent(CustomTag.PageMetrics, metrics);
  };

  const scheduleMetrics = () => {
    if (throttle) return;
    throttle = setTimeout(() => {
      throttle = undefined;
      emitMetrics();
    }, METRICS_THROTTLE_MS);
  };

  const onRouteChange = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    record.addCustomEvent(CustomTag.Navigation, { href: location.href });
    scroller = mainScroller();
    clearTimeout(settle);
    // single-page apps render the new route after the URL changes
    settle = setTimeout(emitMetrics, SETTLE_AFTER_NAVIGATION_MS);
  };

  const onScroll = (event: Event) => {
    const target =
      event.target === document ? document.scrollingElement : event.target;
    const candidate = mainScroller(target);
    // switch to a panel only once it is clearly the main scroll area
    if (candidate !== scroller && candidate !== document.scrollingElement)
      scroller = candidate;
    scheduleMetrics();
  };

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<History['pushState']>) => {
    originalPush(...args);
    onRouteChange();
  };
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    originalReplace(...args);
    onRouteChange();
  };
  window.addEventListener('popstate', onRouteChange);
  window.addEventListener('hashchange', onRouteChange);
  document.addEventListener('scroll', onScroll, {
    capture: true,
    passive: true,
  });
  // rrweb reports scrolling up to 100ms late; recording the exact position just
  // before each click keeps heatmap clicks where they happened
  document.addEventListener('pointerdown', emitMetrics, {
    capture: true,
    passive: true,
  });
  window.addEventListener('resize', scheduleMetrics, { passive: true });
  settle = setTimeout(emitMetrics, 0);

  return () => {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    window.removeEventListener('popstate', onRouteChange);
    window.removeEventListener('hashchange', onRouteChange);
    document.removeEventListener('scroll', onScroll, { capture: true });
    document.removeEventListener('pointerdown', emitMetrics, { capture: true });
    window.removeEventListener('resize', scheduleMetrics);
    clearTimeout(throttle);
    clearTimeout(settle);
  };
}
