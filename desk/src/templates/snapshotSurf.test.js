import { describe, it, expect } from 'vitest';
import { buildReport, missing, internalWords, FIELDS } from './snapshotSurf.js';
import { toSeconds, timestampLink } from '../lib/video.js';

const full = {
  moments: [{ time: '0:12', note: 'pop-up' }, { time: '', note: '' }],
  breakdown: 'The bottom turn', cause: 'Eyes drop to the board', before: 'Late pop-up',
  doing_well: 'Paddle and wave choice', priority: 'Look where you want to go',
  limits: 'How it looks in bigger surf', can_help: 'yes', can_help_note: 'Yes, this is fixable.',
};

describe('surf Snapshot report', () => {
  it('never carries internal fields, even if they sneak into the input', () => {
    const r = buildReport({ ...full, internal_classification: 'C3', private_notes: 'secret' },
      { firstName: 'Ana', clipLink: 'https://drive.google.com/x', date: '2026-09-28' });
    const text = JSON.stringify(r);
    expect(text).not.toContain('secret');
    expect(text).not.toContain('C3');
    expect(text).not.toMatch(/internal_classification|private_notes/);
  });

  it('keeps the field order and drops empty moments', () => {
    const r = buildReport(full, { firstName: 'Ana', clipLink: 'https://youtu.be/abc', date: 'd' });
    expect(r.sections.map((s) => s.heading)).toEqual(
      FIELDS.filter((f) => f.heading).map((f) => f.heading));
    expect(r.sections[0].moments).toEqual([
      { time: '0:12', note: 'pop-up', href: 'https://www.youtube.com/watch?v=abc&t=12s' }]);
  });

  it('adds the Diagnostic button only when the answer is yes', () => {
    const yes = buildReport(full, {}).sections.at(-1);
    const no = buildReport({ ...full, can_help: 'no' }, {}).sections.at(-1);
    expect(yes.cta).toBeTruthy();
    expect(no.cta).toBeNull();
    expect(no.body).toBe('Yes, this is fixable.');
  });

  it('lists what is still empty', () => {
    expect(missing(full)).toEqual([]);
    expect(missing({ ...full, priority: '  ' })).toEqual(['One priority']);
  });

  it('flags internal labels in client text', () => {
    expect(internalWords({ ...full, cause: 'classic late rail' }, 'late rail')).toEqual(['late rail']);
    expect(internalWords({ ...full, cause: 'a TR-2 pattern' }, '')).toEqual(['TR-2']);
    expect(internalWords(full, 'C3')).toEqual([]);
  });
});

describe('timestamps', () => {
  it('reads times', () => {
    expect(toSeconds('1:23')).toBe(83);
    expect(toSeconds('83s')).toBe(83);
    expect(toSeconds('1:02:03')).toBe(3723);
    expect(toSeconds('soon')).toBeNull();
  });
  it('links YouTube only', () => {
    expect(timestampLink('https://www.youtube.com/watch?v=XyZ&feature=share', '0:05')).toBe('https://www.youtube.com/watch?v=XyZ&t=5s');
    expect(timestampLink('https://youtube.com/shorts/Ab1', '10')).toBe('https://www.youtube.com/watch?v=Ab1&t=10s');
    expect(timestampLink('https://drive.google.com/file/d/1', '0:05')).toBeNull();
    expect(timestampLink('https://www.instagram.com/p/x', '0:05')).toBeNull();
  });
});
