const recurrenceKinds = new Set(["none", "daily", "weekly", "monthly"]);

export function addMonths(date, amount) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + amount);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function nextOccurrence(date, recurrence) {
  const next = new Date(date);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  if (recurrence === "monthly") return addMonths(next, 1);
  return next;
}

export function expandRecurringEvents(events, { from = new Date(), months = 12 } = {}) {
  const start = new Date(from);
  const until = addMonths(start, months);
  return events.flatMap((event) => {
    const recurrence = recurrenceKinds.has(event.recurrence) ? event.recurrence : "none";
    const base = new Date(event.starts_at);
    if (Number.isNaN(base.getTime()) || recurrence === "none") return [event];
    const occurrences = [];
    let occurrence = base;
    while (occurrence < until) {
      if (occurrence >= start) occurrences.push({ ...event, id: `${event.id}-${occurrence.toISOString()}`, source_id: event.id, occurrence_start: occurrence.toISOString(), starts_at: occurrence.toISOString() });
      occurrence = nextOccurrence(occurrence, recurrence);
    }
    return occurrences;
  }).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}
