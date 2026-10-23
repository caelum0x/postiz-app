import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { WebhooksDto } from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

const DELIVERIES_PAGE_SIZE = 25;

@Injectable()
export class WebhooksRepository {
  constructor(
    private _webhooks: PrismaRepository<'webhooks'>,
    private _webhookDeliveries: PrismaRepository<'webhookDelivery'>
  ) {}

  getTotal(orgId: string) {
    return this._webhooks.model.webhooks.count({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
    });
  }

  getWebhooks(orgId: string) {
    return this._webhooks.model.webhooks.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        url: true,
        secret: true,
        events: true,
        createdAt: true,
        updatedAt: true,
        integrations: {
          select: {
            integration: {
              select: {
                id: true,
                picture: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  deleteWebhook(orgId: string, id: string) {
    return this._webhooks.model.webhooks.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async createWebhook(orgId: string, body: WebhooksDto) {
    const webhookId = body.id || uuidv4();
    const existing = body.id
      ? await this._webhooks.model.webhooks.findFirst({
          where: { id: webhookId, organizationId: orgId },
          select: { id: true },
        })
      : null;

    const { id } = await this._webhooks.model.webhooks.upsert({
      where: {
        id: webhookId,
        organizationId: orgId,
      },
      create: {
        id: webhookId,
        organizationId: orgId,
        url: body.url,
        name: body.name,
        events: body.events || [],
        secret: randomBytes(32).toString('hex'),
      },
      update: {
        url: body.url,
        name: body.name,
        events: body.events || [],
      },
    });

    await this._webhooks.model.webhooks.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        integrations: {
          deleteMany: {},
          create: body.integrations.map((integration) => ({
            integrationId: integration.id,
          })),
        },
      },
    });

    // Only surface the signing secret the moment it's generated (new webhook).
    // Existing webhooks keep their secret private; use regenerateSecret to rotate it.
    if (existing) {
      return { id };
    }

    const created = await this._webhooks.model.webhooks.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, secret: true },
    });

    return { id, secret: created?.secret };
  }

  async regenerateSecret(orgId: string, id: string) {
    const secret = randomBytes(32).toString('hex');
    await this._webhooks.model.webhooks.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: { secret },
    });

    return { secret };
  }

  async getWebhookForOrg(orgId: string, id: string) {
    return this._webhooks.model.webhooks.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
    });
  }

  async getDeliveries(orgId: string, webhookId: string, page = 1) {
    const webhook = await this.getWebhookForOrg(orgId, webhookId);
    if (!webhook) {
      return { total: 0, deliveries: [] };
    }

    const [total, deliveries] = await Promise.all([
      this._webhookDeliveries.model.webhookDelivery.count({
        where: { webhookId },
      }),
      this._webhookDeliveries.model.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(page, 1) - 1) * DELIVERIES_PAGE_SIZE,
        take: DELIVERIES_PAGE_SIZE,
        select: {
          id: true,
          event: true,
          postId: true,
          url: true,
          statusCode: true,
          success: true,
          attempts: true,
          error: true,
          durationMs: true,
          createdAt: true,
        },
      }),
    ]);

    return { total, deliveries };
  }

  async getDeliveryForRedelivery(orgId: string, deliveryId: string) {
    const delivery = await this._webhookDeliveries.model.webhookDelivery.findFirst({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery || delivery.webhook.organizationId !== orgId || delivery.webhook.deletedAt) {
      return null;
    }

    return delivery;
  }

  createDelivery(data: {
    webhookId: string;
    event: string;
    postId?: string;
    url: string;
    requestBody: string;
    statusCode?: number;
    success: boolean;
    attempts: number;
    error?: string;
    durationMs: number;
  }) {
    return this._webhookDeliveries.model.webhookDelivery.create({
      data,
    });
  }
}
