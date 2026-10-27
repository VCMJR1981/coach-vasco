// Surf Snapshot: the coach form and the client report it produces.
//
// Hardcoded on purpose for now. After a few real reports, the headings and
// wording that get changed here become the template editor.
//
// The report is built only from what the coach typed. Internal fields
// (classification, private notes) are not part of `input` at all: they live
// in their own database columns, so nothing here can copy them out.

import { timestampLink } from '../lib/video.js';

export const TEMPLATE = { key: 'snapshot_surf', version: 1 };

// Client-facing fields, in the order they appear in the report.
export const FIELDS = [
  { id: 'moments', kind: 'moments', label: 'Key moments in the clip',
    help: 'Time and what happens there, e.g. 0:12, the pop-up.', heading: 'Key moments' },
  { id: 'breakdown', label: 'Where in the wave it breaks down', heading: 'Where it breaks down', required: true },
  { id: 'cause', label: 'The cause, in plain language', heading: 'Why it happens', required: true },
  { id: 'before', label: 'What happened before it', help: 'The link: what set it up.',
    heading: 'What happens just before', required: true },
  { id: 'doing_well', label: 'What they are doing well', heading: "What you're already doing well", required: true },
  { id: 'priority', label: 'One priority', heading: 'Your one priority', required: true, highlight: true },
  { id: 'limits', label: 'What one clip cannot show', heading: "What one clip can't show", required: true },
  { id: 'can_help', kind: 'yesno', label: 'Can we help?', heading: 'Can we help?', required: true },
  { id: 'can_help_note', label: 'Can we help: one sentence', required: true },
];

export const DIAGNOSTIC_URL = 'https://concrete-surfers.com/diagnostic.html';

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

export function missing(input) {
  return FIELDS.filter((f) => f.required && blank(input[f.id])).map((f) => f.label);
}

// Anything in the client text that looks like an internal label: the
// classification itself, or a short code like "C3" or "TR-2".
export function internalWords(input, classification) {
  const hits = new Set();
  const texts = FIELDS.filter((f) => !f.kind).map((f) => String(input[f.id] ?? ''));
  (input.moments || []).forEach((m) => texts.push(String(m.note ?? '')));
  const cls = String(classification ?? '').trim();
  for (const t of texts) {
    if (cls.length >= 2 && t.toLowerCase().includes(cls.toLowerCase())) hits.add(cls);
    for (const m of t.matchAll(/\b[A-Z]{1,3}-?\d{1,3}\b/g)) hits.add(m[0]);
  }
  return [...hits];
}

// Turns the coach's input into the frozen, client-facing report.
export function buildReport(input, { firstName, clipLink, date }) {
  const sections = [];
  for (const f of FIELDS) {
    if (f.id === 'moments') {
      const moments = (input.moments || [])
        .filter((m) => !blank(m.time) || !blank(m.note))
        .map((m) => ({ time: String(m.time ?? '').trim(), note: String(m.note ?? '').trim(),
          href: timestampLink(clipLink, m.time) }));
      if (moments.length) sections.push({ heading: f.heading, moments });
    } else if (f.id === 'can_help') {
      const yes = input.can_help === 'yes';
      sections.push({ heading: f.heading, body: String(input.can_help_note ?? '').trim(),
        cta: yes ? { label: 'The Diagnostic', href: DIAGNOSTIC_URL } : null });
    } else if (f.id !== 'can_help_note' && !blank(input[f.id])) {
      sections.push({ heading: f.heading, body: String(input[f.id]).trim(),
        ...(f.highlight ? { highlight: true } : {}) });
    }
  }
  return { title: 'Your Snapshot', name: firstName || '', date, sections };
}
