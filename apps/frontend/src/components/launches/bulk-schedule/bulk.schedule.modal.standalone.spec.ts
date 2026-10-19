import { parseBulkScheduleCsv, rowsToBulkSchedule } from './bulk.schedule.modal';

describe('parseBulkScheduleCsv', () => {
  it('parses a simple header + rows CSV', () => {
    const csv = 'date,content\n2026-11-01 09:00,Hello world\n2026-11-02 09:00,Second post';
    expect(parseBulkScheduleCsv(csv)).toEqual([
      ['date', 'content'],
      ['2026-11-01 09:00', 'Hello world'],
      ['2026-11-02 09:00', 'Second post'],
    ]);
  });

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    const csv = 'date,content\n2026-11-01 09:00,"Hello, ""world"""';
    expect(parseBulkScheduleCsv(csv)).toEqual([
      ['date', 'content'],
      ['2026-11-01 09:00', 'Hello, "world"'],
    ]);
  });

  it('handles CRLF line endings', () => {
    const csv = 'date,content\r\n2026-11-01 09:00,One\r\n2026-11-02 09:00,Two';
    expect(parseBulkScheduleCsv(csv)).toEqual([
      ['date', 'content'],
      ['2026-11-01 09:00', 'One'],
      ['2026-11-02 09:00', 'Two'],
    ]);
  });

  it('skips blank lines', () => {
    const csv = 'date,content\n\n2026-11-01 09:00,One\n\n';
    expect(parseBulkScheduleCsv(csv)).toEqual([
      ['date', 'content'],
      ['2026-11-01 09:00', 'One'],
    ]);
  });
});

describe('rowsToBulkSchedule', () => {
  it('drops a recognized date,content header row', () => {
    const rows = [
      ['date', 'content'],
      ['2026-11-01T09:00:00Z', 'Hello'],
    ];
    const parsed = rowsToBulkSchedule(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].error).toBeUndefined();
    expect(parsed[0].content).toBe('Hello');
  });

  it('treats every row as data when there is no header', () => {
    const rows = [['2026-11-01T09:00:00Z', 'Hello']];
    const parsed = rowsToBulkSchedule(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].error).toBeUndefined();
  });

  it('flags a row with an invalid date', () => {
    const rows = [
      ['date', 'content'],
      ['not-a-date', 'Hello'],
    ];
    const parsed = rowsToBulkSchedule(rows);
    expect(parsed[0].error).toMatch(/date/i);
  });

  it('flags a row with no content', () => {
    const rows = [
      ['date', 'content'],
      ['2026-11-01T09:00:00Z', ''],
    ];
    const parsed = rowsToBulkSchedule(rows);
    expect(parsed[0].error).toMatch(/content/i);
  });
});
