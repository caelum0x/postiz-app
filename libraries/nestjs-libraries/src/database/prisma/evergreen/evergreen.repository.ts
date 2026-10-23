import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

export interface DueEvergreenRecycle {
  id: string;
  organizationId: string;
  postId: string;
  intervalDays: number;
  maxRecycles: number | null;
  totalRecycles: number;
}

@Injectable()
export class EvergreenRepository {
  constructor(
    private _evergreenRecycle: PrismaRepository<'evergreenRecycle'>
  ) {}

  create(
    organizationId: string,
    postId: string,
    intervalDays: number,
    maxRecycles: number | null,
    nextRecycleAt: Date
  ) {
    return this._evergreenRecycle.model.evergreenRecycle.create({
      data: {
        organizationId,
        postId,
        intervalDays,
        maxRecycles,
        nextRecycleAt,
      },
    });
  }

  getForPost(organizationId: string, postId: string) {
    return this._evergreenRecycle.model.evergreenRecycle.findMany({
      where: {
        organizationId,
        postId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getById(organizationId: string, id: string) {
    return this._evergreenRecycle.model.evergreenRecycle.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });
  }

  setActive(id: string, active: boolean) {
    return this._evergreenRecycle.model.evergreenRecycle.update({
      where: { id },
      data: { active },
    });
  }

  delete(id: string) {
    return this._evergreenRecycle.model.evergreenRecycle.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  // Bounded by `limit` (the batch job's hard cap on new posts created per
  // run, same reasoning as PostEngagementRepository.findSnapshotCandidates).
  // Oldest-due-first so a backlog drains in FIFO order.
  findDue(limit: number, now: Date): Promise<DueEvergreenRecycle[]> {
    return this._evergreenRecycle.model.evergreenRecycle.findMany({
      where: {
        active: true,
        deletedAt: null,
        nextRecycleAt: { lte: now },
      },
      orderBy: { nextRecycleAt: 'asc' },
      take: limit,
      select: {
        id: true,
        organizationId: true,
        postId: true,
        intervalDays: true,
        maxRecycles: true,
        totalRecycles: true,
      },
    });
  }

  // Advances the schedule after a successful recycle. Deactivates once
  // maxRecycles is hit so findDue naturally stops returning it (no separate
  // "is this entry exhausted" check needed anywhere else).
  markRecycled(
    id: string,
    nextRecycleAt: Date,
    totalRecycles: number,
    active: boolean
  ) {
    return this._evergreenRecycle.model.evergreenRecycle.update({
      where: { id },
      data: {
        lastRecycledAt: new Date(),
        nextRecycleAt,
        totalRecycles,
        active,
      },
    });
  }

  // A run that failed to create the new post (provider/validation error)
  // is pushed one interval out instead of retried immediately next run -
  // same "don't hot-loop a broken entry" reasoning as the publish retry
  // paths elsewhere, without burning through maxRecycles.
  pushBack(id: string, nextRecycleAt: Date) {
    return this._evergreenRecycle.model.evergreenRecycle.update({
      where: { id },
      data: { nextRecycleAt },
    });
  }
}
