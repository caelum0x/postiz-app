import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { PostEngagementService } from '@gitroom/nestjs-libraries/database/prisma/post-engagement/post-engagement.service';

@Injectable()
@Activity()
export class PostEngagementActivity {
  constructor(private _postEngagementService: PostEngagementService) {}

  @ActivityMethod()
  async captureEngagementSnapshotBatch() {
    return this._postEngagementService.captureBatch();
  }
}
