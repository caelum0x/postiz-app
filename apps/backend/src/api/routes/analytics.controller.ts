import { Controller, Get, Param, Query } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { PostEngagementService } from '@gitroom/nestjs-libraries/database/prisma/post-engagement/post-engagement.service';

@ApiTags('Analytics')
@Controller('/analytics')
export class AnalyticsController {
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _postEngagementService: PostEngagementService
  ) {}

  @Get('/:integration')
  async getIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('date') date: string
  ) {
    return this._integrationService.checkAnalytics(org, integration, date);
  }

  @Get('/post/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string,
    @Query('date') date: string
  ) {
    return this._postsService.checkPostAnalytics(org.id, postId, +date);
  }

  // Reads only from the pre-aggregated PostEngagementSnapshot table (see
  // PostEngagementService) - no live provider calls on this path, so it is
  // safe to call on every composer/calendar render.
  @Get('/best-time/:integration')
  async getBestTimeToPost(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string
  ) {
    return this._postEngagementService.getBestTimes(org.id, integration);
  }
}
