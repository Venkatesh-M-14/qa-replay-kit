import { heatmapClicks, heatmapPageViews } from './db.js';

// below this, the page warns that the heatmap is not representative
export const MIN_SESSIONS_FOR_CONCLUSIONS = 3;
const SCROLL_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * Share of page views that scrolled at least this far down the page.
 * Views without a known page height (older recordings) are left out.
 */
export function scrollDistribution(views) {
  const measured = views.filter((v) => v.page_height > 0);
  const depths = measured.map((v) =>
    Math.min(100, (v.max_depth / v.page_height) * 100),
  );
  return {
    views: views.length,
    measured: measured.length,
    container: measured.some((v) => v.container),
    steps: SCROLL_STEPS.map((step) => ({
      depth: step,
      // a tiny tolerance so a view that reached the very bottom counts as 100%
      share: depths.length
        ? depths.filter((d) => d >= step - 0.5).length / depths.length
        : null,
    })),
  };
}

/** Clicks grouped by the element that was clicked. */
export function elementTable(clicks) {
  const groups = new Map();
  for (const click of clicks) {
    const group = groups.get(click.element) || {
      element: click.element,
      clicks: 0,
      sessions: new Set(),
      example: click,
    };
    group.clicks += 1;
    group.sessions.add(click.session_id);
    groups.set(click.element, group);
  }
  return [...groups.values()]
    .map((g) => ({
      element: g.element,
      clicks: g.clicks,
      sessions: g.sessions.size,
      share: g.clicks / clicks.length,
      example: {
        session_id: g.example.session_id,
        offset_ms: g.example.offset_ms,
      },
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

/**
 * Picks the recording whose page snapshot is drawn under the heatmap: the most
 * recent session with a click on this page, shown at the moment of that click.
 */
function pickBackground(clicks, views) {
  const click = clicks[0];
  if (!click) {
    const view = views[views.length - 1];
    return view
      ? {
          session_id: view.session_id,
          offset_ms: view.offset_ms + 1000,
          viewport_w: view.viewport_w,
        }
      : null;
  }
  const view = views.find((v) => v.session_id === click.session_id);
  return {
    session_id: click.session_id,
    offset_ms: click.offset_ms,
    viewport_w: click.viewport_w,
    viewport_h: click.viewport_h,
    page_height: view?.page_height ?? null,
    container: Boolean(view?.container),
  };
}

export function buildHeatmap(db, filters) {
  const clicks = heatmapClicks(db, filters);
  const views = heatmapPageViews(db, filters);
  const sessions = new Set([
    ...clicks.map((c) => c.session_id),
    ...views.map((v) => v.session_id),
  ]);
  return {
    page: filters.page,
    device: filters.device || 'all',
    sessions: sessions.size,
    enoughData: sessions.size >= MIN_SESSIONS_FOR_CONCLUSIONS,
    clicks: clicks.map((c) => ({
      x: c.x_ratio,
      y: c.page_y,
      session: c.session_id,
      t: c.offset_ms,
      element: c.element,
    })),
    elements: elementTable(clicks),
    scroll: scrollDistribution(views),
    background: pickBackground(clicks, views),
    viewportWidths: [...new Set(clicks.map((c) => c.viewport_w))],
  };
}
