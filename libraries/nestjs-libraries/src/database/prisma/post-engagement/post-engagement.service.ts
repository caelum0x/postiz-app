import { Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import { PostEngagementRepository } from '@gitroom/nestjs-libraries/database/prisma/post-engagement/post-engagement.repository';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import {
  BestTimeSuggestion,
  EngagementBucket,
  MATURE_AFTER_DAYS,
  MAX_LOOKBACK_DAYS,
  SNAPSHOT_ANALYTICS_WINDOW_DAYS,
  computeEngagementScore,
  getBatchCap,
  rankBuckets,
  toTimeBucket,
} from '@gitroom/nestjs-libraries/database/prisma/post-engagement/post-engagement.util';

export interface CaptureBatchResult {
  attempted: number;
  captured: number;
  skipped: number;
}

export interface BestTimesResult {
  hasData: boolean;
  suggestions: BestTimeSuggestion[];
}

@Injectable()
export class PostEngagementService {
  constructor(
    private _postEngagementRepository: PostEngagementRepository,
    private _postsService: PostsService,
    private _integrationService: IntegrationService
  ) {}

  // Called once per scheduled run by bestTimeToPostWorkflow (daily cadence).
  // Bounded: at most getBatchCap() provider calls.
  //
  // A post is only ever upserted (permanently excluded from future runs) when
  // checkPostAnalytics returns cleanly - including a "no data" result, e.g. no
  // postAnalytics capability or an unavailable release, which really is
  // permanent. A thrown error (provider timeout/rate-limit/5xx) is treated as
  // transient: the post is left as a candidate and retried on a later run,
  // instead of a momentary blip permanently excluding it from its channel's
  // recommendation. captureBatch is still bounded because the per-run
  // candidate count is capped regardless of outcome.
  //
  // Candidates whose integration token is already expired are skipped
  // entirely (no checkPostAnalytics call) rather than forcing a refresh here:
  // checkPostAnalytics force-refreshes expired tokens and disconnects the
  // channel if that refresh doesn't yield a usable token - a real,
  // user-visible action that belongs to the publish/analytics-view flows the
  // user actually triggered, not to this background backfill job. Those
  // integrations naturally refresh (or get disconnected) through normal
  // usage, and become candidates again once the integration is next
  // published through or stored with a non-expired token.
  async captureBatch(): Promise<CaptureBatchResult> {
    const now = dayjs();
    const matureBefore = now.subtract(MATURE_AFTER_DAYS, 'day').toDate();
    const lookbackAfter = now.subtract(MAX_LOOKBACK_DAYS, 'day').toDate();

    const candidates =
      await this._postEngagementRepository.findSnapshotCandidates(
        getBatchCap(),
        matureBefore,
        lookbackAfter
      );

    let captured = 0;
    let skipped = 0;
    for (const post of candidates) {
      if (
        post.integration.tokenExpiration &&
        dayjs(post.integration.tokenExpiration).isBefore(now)
      ) {
        skipped++;
        continue;
      }

      let analytics: unknown;
      try {
        analytics = await this._postsService.checkPostAnalytics(
          post.organizationId,
          post.id,
          SNAPSHOT_ANALYTICS_WINDOW_DAYS
        );
      } catch (err) {
        // Transient failure - do not upsert, retry on a later run.
        skipped++;
        continue;
      }

      const score = computeEngagementScore(
        Array.isArray(analytics) ? analytics : null
      );
      const { dayOfWeek, hourOfDay } = toTimeBucket(post.publishDate);

      try {
        await this._postEngagementRepository.upsertSnapshot({
          postId: post.id,
          organizationId: post.organizationId,
          integrationId: post.integrationId,
          providerIdentifier: post.integration.providerIdentifier,
          publishDate: post.publishDate,
          dayOfWeek,
          hourOfDay,
          engagementScore: score,
        });
        if (score !== null) {
          captured++;
        }
      } catch (err) {
        // Best-effort snapshot persistence - one failed write must not stop
        // the rest of the batch. Left as a candidate, will retry later.
      }
    }

    return { attempted: candidates.length, captured, skipped };
  }

  // Read path for the UI: pure DB aggregation, no live provider calls.
  async getBestTimes(
    orgId: string,
    integrationId: string
  ): Promise<BestTimesResult> {
    const integration = await this._integrationService.getIntegrationById(
      orgId,
      integrationId
    );
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const rows = await this._postEngagementRepository.getBucketsForIntegration(
      integrationId
    );

    const buckets: EngagementBucket[] = rows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      hourOfDay: row.hourOfDay,
      avgEngagement: row._avg.engagementScore ?? 0,
      sampleSize: row._count._all,
    }));

    const suggestions = rankBuckets(buckets);

    return {
      hasData: suggestions.length > 0,
      suggestions,
    };
  }
}
