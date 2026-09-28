const TZ = 'Europe/Lisbon';

export function day(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso));
}

export function dayTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function monthName(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'long' }).format(date);
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export const PRODUCTS = {
  snapshot: 'Snapshot', snapshot_skate: 'Surfskate Snapshot', diagnostic: 'Diagnostic',
  single: 'Single session', block: '12-week block', classes: 'Surfskate classes',
  retreat: 'Retreat', cert: 'Coach certification', workshop: 'Workshop', unsure: 'Not sure yet',
};

export const STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'clip_received', label: 'Clip received' },
  { id: 'in_review', label: 'In review' },
  { id: 'sent', label: 'Sent' },
];

export const DETAIL_LABELS = {
  session_type: 'Session type', which_retreat: 'Retreat', room_preference: 'Room',
  class_location: 'Class location', class_kit: 'Board and protection', city: 'City',
  current_role: 'Current role', selected_level: 'Level picked on the page',
};
