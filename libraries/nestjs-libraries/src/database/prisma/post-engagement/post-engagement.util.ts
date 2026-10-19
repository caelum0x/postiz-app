import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

// Pure helpers for the best-time-to-post aggregation, kept free of NestJS/DB
// imports so they stay cheap to unit test (see
// post-engagement.service.standalone.spec.ts). All orchestration (DI,
// Prisma, provider calls) lives in post-engagement.service.ts.

export interface TimeBucket {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday), UTC
  hourOfDay: number; // 0 - 23, UTC
}

export interface EngagementBucket extends TimeBucket {
  avgEngagement: number;
  sampleSize: number;
}

export type BestTimeSuggestion = EngagementBucket;

// A bucket needs at least this many real snapshots before it is suggested,
// so a single lucky/unlucky post never drives a recommendation.
export const MIN_SAMPLE_SIZE_FOR_SUGGESTION = 3;
export const MAX_SUGGESTIONS = 5;

// A post needs this many days to accrue realistic engagement before it is
// snapshotted - capturing right after publish would understate it.
export const MATURE_AFTER_DAYS = 3;
// Only posts published within this window are candidates at all, so the
// recommendation reflects recent audience behaviour, not years-old history.
export const MAX_LOOKBACK_DAYS = 60;
// How many days of post-level analytics to request per capture. The post
// analytics providers return current cumulative totals regardless of this
// window, so any small value works; kept consistent with the UI's default.
export const SNAPSHOT_ANALYTICS_WINDOW_DAYS = 7;
// Hard cap on provider analytics calls per batch run, across the whole
// platform - this is what makes the job bounded instead of the unbounded
// "call every post live" design that was deliberately rejected. Every
// candidate post is attempted at most once ever (see captureBatch), so a
// backlog drains at this rate per run and steady-state load stays flat.
const DEFAULT_BATCH_CAP = 300;

export function getBatchCap(): number {
  const fromEnv = Number(process.env.BEST_TIME_SNAPSHOT_BATCH_SIZE);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_BATCH_CAP;
}

// Sums the latest reported value of every metric series a provider returns
// (impressions, likes, clicks, ...). Deliberately generic - it must not
// special-case any platform's label names.
export function computeEngagementScore(
  data: AnalyticsData[] | { missing: true } | null | undefined
): number | null {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  let total = 0;
  let sawValue = false;

  for (const entry of data) {
    const points = entry?.data;
    if (!Array.isArray(points) || points.length === 0) {
      continue;
    }

    const latest = points[points.length - 1];
    const value = Number(latest?.total);
    if (!Number.isFinite(value)) {
      continue;
    }

    total += value;
    sawValue = true;
  }

  return sawValue ? total : null;
}

export function toTimeBucket(publishDate: Date | string): TimeBucket {
  const date = new Date(publishDate);
  return {
    dayOfWeek: date.getUTCDay(),
    hourOfDay: date.getUTCHours(),
  };
}

export function rankBuckets(
  buckets: EngagementBucket[],
  topN: number = MAX_SUGGESTIONS,
  minSampleSize: number = MIN_SAMPLE_SIZE_FOR_SUGGESTION
): BestTimeSuggestion[] {
  return [...buckets]
    .filter((bucket) => bucket.sampleSize >= minSampleSize)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, topN);
}
