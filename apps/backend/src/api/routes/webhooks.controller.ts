import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  DeliveriesPageDto, OnlyURL, UpdateDto, WebhooksDto
} from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

@ApiTags('Webhooks')
@Controller('/webhooks')
export class WebhookController {
  constructor(private _webhooksService: WebhooksService) {}

  @Get('/')
  async getStatistics(@GetOrgFromRequest() org: Organization) {
    return this._webhooksService.getWebhooksForDisplay(org.id);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  async createAWebhook(
    @GetOrgFromRequest() org: Organization,
    @Body() body: WebhooksDto
  ) {
    return this._webhooksService.createWebhook(org.id, body);
  }

  @Put('/')
  async updateWebhook(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UpdateDto
  ) {
    return this._webhooksService.createWebhook(org.id, body);
  }

  @Delete('/:id')
  async deleteWebhook(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._webhooksService.deleteWebhook(org.id, id);
  }

  @Post('/:id/secret')
  async regenerateSecret(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._webhooksService.regenerateSecret(org.id, id);
  }

  @Get('/:id/deliveries')
  async getDeliveries(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Query() query: DeliveriesPageDto
  ) {
    return this._webhooksService.getDeliveries(
      org.id,
      id,
      Number(query.page) || 1
    );
  }

  @Post('/deliveries/:deliveryId/redeliver')
  async redeliver(
    @GetOrgFromRequest() org: Organization,
    @Param('deliveryId') deliveryId: string
  ) {
    const result = await this._webhooksService.redeliver(org.id, deliveryId);
    if (!result) {
      return { success: false, error: 'Delivery not found' };
    }
    return result;
  }

  @Post('/send')
  async sendWebhook(@Body() body: any, @Query() query: OnlyURL) {
    try {
      const response = await fetch(query.url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        // @ts-ignore — undici dispatcher option, not in lib.dom fetch types
        dispatcher: getSsrfSafeDispatcher(),
      });
      return {
        send: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (err) {
      return {
        send: false,
        error: err instanceof Error ? err.message : 'Unknown delivery error',
      };
    }
  }
}
