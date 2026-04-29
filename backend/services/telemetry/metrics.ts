interface MetricEvent {
  type: string;
  timestamp: string;
  details?: Record<string, string | number | boolean>;
}

const events: MetricEvent[] = [];

export function trackEvent(type: string, details?: Record<string, string | number | boolean>): void {
  events.push({
    type,
    timestamp: new Date().toISOString(),
    details,
  });
}

export function listEvents(limit = 100): MetricEvent[] {
  return events.slice(-limit);
}
