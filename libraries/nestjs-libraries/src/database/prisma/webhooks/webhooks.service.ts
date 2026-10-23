import { Injectable } from '@nestjs/common';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksDto } from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(private _webhooksRepository: WebhooksRepository) {}

  getTotal(orgId: string) {
    return this._webhooksRepository.getTotal(orgId);
  }

  // Includes the raw signing secret - for internal use (delivery) only.
  // Controllers must use getWebhooksForDisplay instead.
  getWebhooks(orgId: string) {
    return this._webhooksRepository.getWebhooks(orgId);
  }

  async getWebhooksForDisplay(orgId: string) {
    const webhooks = await this._webhooksRepository.getWebhooks(orgId);
    // The signing secret is only ever surfaced right after it's (re)generated;
    // the list view only needs to know whether one exists.
    return webhooks.map(({ secret, ...webhook }) => ({
      ...webhook,
      hasSecret: !!secret,
    }));
  }

  createWebhook(orgId: string, body: WebhooksDto) {
    return this._webhooksRepository.createWebhook(orgId, body);
  }

  regenerateSecret(orgId: string, id: string) {
    return this._webhooksRepository.regenerateSecret(orgId, id);
  }

  deleteWebhook(orgId: string, id: string) {
    return this._webhooksRepository.deleteWebhook(orgId, id);
  }

  async getDeliveries(orgId: string, webhookId: string, page = 1) {
    return this._webhooksRepository.getDeliveries(orgId, webhookId, page);
  }

  async redeliver(orgId: string, deliveryId: string) {
    const delivery = await this._webhooksRepository.getDeliveryForRedelivery(
      orgId,
      deliveryId
    );

    if (!delivery) {
      return null;
    }

    return this.sendWithRetry({
      webhookId: delivery.webhookId,
      url: delivery.webhook.url,
      secret: delivery.webhook.secret,
      event: delivery.event,
      postId: delivery.postId || undefined,
      requestBody: delivery.requestBody,
    });
  }

  /**
   * Signs and delivers a webhook payload, retrying transient failures with
   * backoff, and always persists the outcome to the delivery log.
   */
  async sendWithRetry(params: {
    webhookId: string;
    url: string;
    secret?: string | null;
    event: string;
    postId?: string;
    requestBody: string;
    dispatcher?: unknown;
    maxAttempts?: number;
  }) {
    const { webhookId, url, secret, event, postId, requestBody, dispatcher } =
      params;
    const maxAttempts = params.maxAttempts ?? 3;
    const started = Date.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Postiz-Event': event,
    };
    if (secret) {
      headers['X-Postiz-Signature'] = this.sign(secret, requestBody);
    }

    let lastStatusCode: number | undefined;
    let lastError: string | undefined;
    let success = false;
    let attempt = 0;

    for (attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: requestBody,
          // @ts-ignore — undici dispatcher option, not in lib.dom fetch types
          ...(dispatcher ? { dispatcher } : {}),
        });
        lastStatusCode = response.status;
        // 2xx = delivered. 4xx (other than 429) is a client-side rejection
        // that a retry won't fix, so don't burn attempts on it.
        if (response.status >= 200 && response.status < 300) {
          success = true;
          break;
        }
        if (
          response.status < 500 &&
          response.status !== 429 &&
          response.status !== 408
        ) {
          lastError = `Received HTTP ${response.status}`;
          break;
        }
        lastError = `Received HTTP ${response.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown delivery error';
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(3, attempt - 1))
        );
      }
    }

    await this._webhooksRepository.createDelivery({
      webhookId,
      event,
      postId,
      url,
      requestBody,
      statusCode: lastStatusCode,
      success,
      attempts: Math.min(attempt, maxAttempts),
      error: success ? undefined : lastError,
      durationMs: Date.now() - started,
    });

    return { success, statusCode: lastStatusCode, attempts: attempt };
  }

  sign(secret: string, body: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  verifySignature(secret: string, body: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(secret, body));
    const provided = Buffer.from(signature);
    if (expected.length !== provided.length) {
      return false;
    }
    return timingSafeEqual(expected, provided);
  }
}
