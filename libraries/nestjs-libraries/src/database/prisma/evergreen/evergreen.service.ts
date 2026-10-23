import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import { CreationMethod } from '@prisma/client';
import {
  EvergreenRepository,
  DueEvergreenRecycle,
} from '@gitroom/nestjs-libraries/database/prisma/evergreen/evergreen.repository';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { CreateEvergreenRecycleDto } from '@gitroom/nestjs-libraries/dtos/posts/evergreen.recycle.dto';

// Hard cap on how many posts get created per daily batch run - same
// reasoning as PostEngagementService's getBatchCap: bound the background
// job's write volume regardless of backlog size.
const BATCH_CAP = 25;

export interface RecycleBatchResult {
  attempted: number;
  recycled: number;
  failed: number;
}

@Injectable()
export class EvergreenService {
  constructor(
    private _evergreenRepository: EvergreenRepository,
    private _postsService: PostsService
  ) {}

  async createRecycle(
    orgId: string,
    postId: string,
    dto: CreateEvergreenRecycleDto
  ) {
    const post = await this._postsService.getPostById(postId, orgId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.state !== 'PUBLISHED') {
      throw new BadRequestException(
        'Only already-published posts can be set up for evergreen recycling'
      );
    }

    const nextRecycleAt = dayjs().add(dto.intervalDays, 'day').toDate();
    return this._evergreenRepository.create(
      orgId,
      postId,
      dto.intervalDays,
      dto.maxRecycles ?? null,
      nextRecycleAt
    );
  }

  listForPost(orgId: string, postId: string) {
    return this._evergreenRepository.getForPost(orgId, postId);
  }

  async setActive(orgId: string, id: string, active: boolean) {
    const entry = await this._evergreenRepository.getById(orgId, id);
    if (!entry) {
      throw new NotFoundException('Evergreen recycle entry not found');
    }
    return this._evergreenRepository.setActive(id, active);
  }

  async remove(orgId: string, id: string) {
    const entry = await this._evergreenRepository.getById(orgId, id);
    if (!entry) {
      throw new NotFoundException('Evergreen recycle entry not found');
    }
    return this._evergreenRepository.delete(id);
  }

  // Called once per scheduled run by evergreenRecycleWorkflow (daily
  // cadence). Bounded: at most BATCH_CAP new posts created per run. A
  // per-entry failure never aborts the batch - same "schedule what's valid,
  // report the rest" spirit as PostsService.bulkSchedule.
  async runDueBatch(): Promise<RecycleBatchResult> {
    const due = await this._evergreenRepository.findDue(BATCH_CAP, new Date());

    let recycled = 0;
    let failed = 0;
    for (const entry of due) {
      try {
        await this.recycleOne(entry);
        recycled++;
      } catch (err) {
        failed++;
        // Don't hot-loop a broken entry (bad settings, missing media,
        // disabled integration) - push it one interval out and let the
        // next run try again, same reasoning as a transient provider
        // failure anywhere else in this codebase.
        await this._evergreenRepository
          .pushBack(
            entry.id,
            dayjs().add(entry.intervalDays, 'day').toDate()
          )
          .catch(() => {});
      }
    }

    return { attempted: due.length, recycled, failed };
  }

  private async recycleOne(entry: DueEvergreenRecycle) {
    const post = await this._postsService.getPostById(
      entry.postId,
      entry.organizationId
    );

    if (!post) {
      // Original was deleted - nothing left to recycle from, stop for good.
      await this._evergreenRepository.setActive(entry.id, false);
      return;
    }

    const rawPosts = [
      {
        integration: { id: post.integrationId },
        value: [
          {
            content: post.content,
            image: JSON.parse(post.image || '[]'),
          },
        ],
        settings: JSON.parse(post.settings || '{}'),
      },
    ];

    const validation = await this._postsService.validatePosts(
      entry.organizationId,
      rawPosts
    );
    for (const item of validation) {
      if (item.emptyContent || !item.valid || item.errors !== true || item.tooLong) {
        throw new Error(
          'Original post no longer validates for its provider (settings, length, or content changed upstream)'
        );
      }
    }

    const mapped = await this._postsService.mapTypeToPost(
      {
        type: 'schedule',
        shortLink: false,
        date: dayjs().format('YYYY-MM-DDTHH:mm:00'),
        tags: [],
        posts: rawPosts,
      } as unknown as CreatePostDto,
      entry.organizationId
    );

    const created = await this._postsService.createPost(
      entry.organizationId,
      mapped,
      CreationMethod.RECYCLE
    );

    if (!created?.length) {
      throw new Error('Could not create the recycled post');
    }

    const totalRecycles = entry.totalRecycles + 1;
    const reachedMax =
      entry.maxRecycles != null && totalRecycles >= entry.maxRecycles;
    const nextRecycleAt = dayjs().add(entry.intervalDays, 'day').toDate();

    await this._evergreenRepository.markRecycled(
      entry.id,
      nextRecycleAt,
      totalRecycles,
      !reachedMax
    );
  }
}
