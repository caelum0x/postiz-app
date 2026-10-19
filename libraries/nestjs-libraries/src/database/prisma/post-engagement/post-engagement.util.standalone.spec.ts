import {
  computeEngagementScore,
  toTimeBucket,
  rankBuckets,
  getBatchCap,
  EngagementBucket,
  MIN_SAMPLE_SIZE_FOR_SUGGESTION,
} from './post-engagement.util';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

describe('computeEngagementScore', () => {
  it('sums the latest value of every metric series', () => {
    const data: AnalyticsData[] = [
      {
        label: 'Impressions',
        percentageChange: 0,
        data: [{ total: '100', date: '2026-10-01' }],
      },
      {
        label: 'Likes',
        percentageChange: 0,
        data: [{ total: '20', date: '2026-10-01' }],
      },
    ];

    expect(computeEngagementScore(data)).toBe(120);
  });

  it('uses only the most recent point of a multi-point series', () => {
    const data: AnalyticsData[] = [
      {
        label: 'Impressions',
        percentageChange: 0,
        data: [
          { total: '10', date: '2026-10-01' },
          { total: '50', date: '2026-10-02' },
        ],
      },
    ];

    expect(computeEngagementScore(data)).toBe(50);
  });

  it('ignores series with no usable numeric value', () => {
    const data: AnalyticsData[] = [
      {
        label: 'Impressions',
        percentageChange: 0,
        data: [{ total: 'not-a-number', date: '2026-10-01' }],
      },
      {
        label: 'Likes',
        percentageChange: 0,
        data: [{ total: '5', date: '2026-10-01' }],
      },
    ];

    expect(computeEngagementScore(data)).toBe(5);
  });

  it('returns null for an empty array (no usable metrics)', () => {
    expect(computeEngagementScore([])).toBeNull();
  });

  it('returns null for the {missing: true} shape', () => {
    expect(computeEngagementScore({ missing: true })).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(computeEngagementScore(null)).toBeNull();
    expect(computeEngagementScore(undefined)).toBeNull();
  });

  it('returns null when every series has an empty data array', () => {
    const data: AnalyticsData[] = [
      { label: 'Impressions', percentageChange: 0, data: [] },
    ];
    expect(computeEngagementScore(data)).toBeNull();
  });
});

describe('toTimeBucket', () => {
  it('derives UTC day-of-week and hour-of-day from a publish date', () => {
    // 2026-10-22 is a Thursday
    expect(toTimeBucket('2026-10-22T14:30:00.000Z')).toEqual({
      dayOfWeek: 4,
      hourOfDay: 14,
    });
  });

  it('is based on UTC, not the host machine timezone', () => {
    // 23:30 UTC on a Sunday must stay day 0, hour 23, regardless of local TZ
    expect(toTimeBucket('2026-10-25T23:30:00.000Z')).toEqual({
      dayOfWeek: 0,
      hourOfDay: 23,
    });
  });

  it('accepts a Date instance as well as a string', () => {
    expect(toTimeBucket(new Date('2026-10-22T00:00:00.000Z'))).toEqual({
      dayOfWeek: 4,
      hourOfDay: 0,
    });
  });
});

describe('rankBuckets', () => {
  const bucket = (
    dayOfWeek: number,
    hourOfDay: number,
    avgEngagement: number,
    sampleSize: number
  ): EngagementBucket => ({ dayOfWeek, hourOfDay, avgEngagement, sampleSize });

  it('sorts by average engagement descending', () => {
    const buckets = [
      bucket(1, 9, 10, 5),
      bucket(2, 10, 50, 5),
      bucket(3, 11, 30, 5),
    ];

    expect(rankBuckets(buckets).map((b) => b.avgEngagement)).toEqual([
      50, 30, 10,
    ]);
  });

  it('drops buckets below the minimum sample size so one lucky post cannot drive a suggestion', () => {
    const buckets = [
      bucket(1, 9, 1000, 1),
      bucket(2, 10, 20, MIN_SAMPLE_SIZE_FOR_SUGGESTION),
    ];

    const ranked = rankBuckets(buckets);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].hourOfDay).toBe(10);
  });

  it('caps the result at topN', () => {
    const buckets = Array.from({ length: 10 }, (_, i) =>
      bucket(i % 7, i, i, MIN_SAMPLE_SIZE_FOR_SUGGESTION)
    );

    expect(rankBuckets(buckets, 3)).toHaveLength(3);
  });

  it('returns an empty array when nothing meets the sample-size threshold', () => {
    const buckets = [bucket(1, 9, 1000, 1), bucket(2, 10, 500, 2)];
    expect(rankBuckets(buckets)).toEqual([]);
  });
});

describe('getBatchCap', () => {
  const originalEnv = process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE;

  afterEach(() => {
    process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE = originalEnv;
  });

  it('falls back to the default when unset', () => {
    delete process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE;
    expect(getBatchCap()).toBe(300);
  });

  it('honors a positive override', () => {
    process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE = '50';
    expect(getBatchCap()).toBe(50);
  });

  it('falls back to the default for an invalid override, so the batch job is never accidentally unbounded', () => {
    process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE = '-5';
    expect(getBatchCap()).toBe(300);
    process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE = 'not-a-number';
    expect(getBatchCap()).toBe(300);
  });
});
