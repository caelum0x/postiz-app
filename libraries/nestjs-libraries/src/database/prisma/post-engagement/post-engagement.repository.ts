import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

export interface SnapshotCandidate {
  id: string;
  organizationId: string;
  integrationId: string;
  publishDate: Date;
  integration: {
    providerIdentifier: string;
    tokenExpiration: Date | null;
  };
}

export interface UpsertSnapshotParams {
  postId: string;
  organizationId: string;
  integrationId: string;
  providerIdentifier: string;
  publishDate: Date;
  dayOfWeek: number;
  hourOfDay: number;
  engagementScore: number | null;
}

@Injectable()
export class PostEngagementRepository {
  constructor(
    private _post: PrismaRepository<'post'>,
    private _postEngagementSnapshot: PrismaRepository<'postEngagementSnapshot'>
  ) {}

  // Bounded by `limit` (the batch job's hard cap on provider calls per run).
  // Oldest-unprocessed-first so a large backlog drains in FIFO order instead
  // of starving old posts forever. `postEngagementSnapshot: null` excludes
  // any post already attempted - every post is only ever attempted once.
  findSnapshotCandidates(
    limit: number,
    matureBefore: Date,
    lookbackAfter: Date
  ): Promise<SnapshotCandidate[]> {
    return this._post.model.post.findMany({
      where: {
        state: 'PUBLISHED',
        deletedAt: null,
        releaseId: { not: null },
        NOT: { releaseId: 'missing' },
        publishDate: {
          gte: lookbackAfter,
          lte: matureBefore,
        },
        integration: {
          disabled: false,
          deletedAt: null,
        },
        postEngagementSnapshot: null,
      },
      orderBy: { publishDate: 'asc' },
      take: limit,
      select: {
        id: true,
        organizationId: true,
        integrationId: true,
        publishDate: true,
        integration: {
          select: {
            providerIdentifier: true,
            tokenExpiration: true,
          },
        },
      },
    });
  }

  upsertSnapshot(data: UpsertSnapshotParams) {
    return this._postEngagementSnapshot.model.postEngagementSnapshot.upsert({
      where: { postId: data.postId },
      create: {
        postId: data.postId,
        organizationId: data.organizationId,
        integrationId: data.integrationId,
        providerIdentifier: data.providerIdentifier,
        publishDate: data.publishDate,
        dayOfWeek: data.dayOfWeek,
        hourOfDay: data.hourOfDay,
        engagementScore: data.engagementScore,
      },
      update: {
        dayOfWeek: data.dayOfWeek,
        hourOfDay: data.hourOfDay,
        engagementScore: data.engagementScore,
      },
    });
  }

  // Aggregated server-side (groupBy), never pulls raw rows to the app - the
  // query itself is the bound, so this stays cheap no matter how many
  // snapshots a channel has accumulated over time.
  getBucketsForIntegration(integrationId: string) {
    return this._postEngagementSnapshot.model.postEngagementSnapshot.groupBy({
      by: ['dayOfWeek', 'hourOfDay'],
      where: {
        integrationId,
        engagementScore: { not: null },
      },
      _avg: { engagementScore: true },
      _count: { _all: true },
    });
  }
}
