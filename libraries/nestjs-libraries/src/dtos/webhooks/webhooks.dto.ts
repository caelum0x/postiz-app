import {
  IsArray,
  IsDefined,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsSafeWebhookUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

// Every event a webhook can subscribe to. A webhook with an empty `events`
// array (the default - every webhook created before this list existed)
// still gets everything, see WebhooksService / sendWithRetry callers.
export const WEBHOOK_EVENT_TYPES = ['post.published', 'post.failed'] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export class WebhooksIntegrationDto {
  @IsString()
  @IsDefined()
  id: string;
}

export class WebhooksDto {
  id: string;

  @IsString()
  @IsDefined()
  name: string;

  @IsString()
  @IsUrl()
  @IsDefined()
  @IsSafeWebhookUrl({
    message:
      'Webhook URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;

  @Type(() => WebhooksIntegrationDto)
  @IsDefined()
  integrations: WebhooksIntegrationDto[];

  // Empty/omitted = every event (backward compatible default).
  @IsOptional()
  @IsArray()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  events?: WebhookEventType[];
}

export class OnlyURL {
  @IsString()
  @IsUrl()
  @IsDefined()
  @IsSafeWebhookUrl({
    message:
      'URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;
}

export class DeliveriesPageDto {
  @IsOptional()
  @IsNumberString()
  page?: string;
}

export class UpdateDto {
  @IsString()
  @IsDefined()
  id: string;

  @IsString()
  @IsDefined()
  name: string;

  @IsString()
  @IsUrl()
  @IsDefined()
  @IsSafeWebhookUrl({
    message:
      'Webhook URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;

  @Type(() => WebhooksIntegrationDto)
  @IsDefined()
  integrations: WebhooksIntegrationDto[];

  @IsOptional()
  @IsArray()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  events?: WebhookEventType[];
}
