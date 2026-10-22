import { EventType, type eventWithTime } from '@rrweb/types';
import { CustomTag } from '~/types';
import type { SessionReport } from './report';

/** Colours of timeline markers in the replay player. */
export const MARKER_COLORS = {
  error: '#e53e3e',
  [CustomTag.Navigation]: '#3182ce',
  [CustomTag.Feedback]: '#38a169',
};

/**
 * Events for the replay player: page metrics are dropped (they would show as
 * hundreds of markers) and each error gets a red timeline marker.
 */
export function eventsForReplay(
  events: eventWithTime[],
  report: SessionReport,
): eventWithTime[] {
  const visible = events.filter(
    (e) =>
      !(e.type === EventType.Custom && e.data.tag === CustomTag.PageMetrics),
  );
  const markers: eventWithTime[] = report.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => ({
      type: EventType.Annotation,
      data: {
        type: 'timelineMarker',
        text:
          issue.count > 1 ? `${issue.title} (×${issue.count})` : issue.title,
      },
      timestamp: report.startTimestamp + issue.offset,
    }));
  return [...visible, ...markers].sort((a, b) => a.timestamp - b.timestamp);
}
