import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsString,
} from 'class-validator';

// Caps match the dashboard's own bulk-schedule limit (BulkScheduleDto) -
// same "don't let one request block the event loop for minutes" reasoning.
const MAX_BULK_CREATE = 25;
const MAX_BULK_IDS = 50;

// Each entry is the exact same shape the single `POST /posts` body takes
// (type/date/tags/posts[]) - validated per-item downstream by the same
// validatePosts/mapTypeToPost pipeline the single endpoint uses, not
// re-specified here, so the two never drift.
export class BulkCreatePostsDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_CREATE)
  posts: any[];
}

export class BulkPostIdsDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsString({ each: true })
  ids: string[];
}

export interface BulkCreateResult {
  index: number;
  success: boolean;
  postId?: string;
  error?: string;
}

export interface BulkDeleteResult {
  id: string;
  success: boolean;
  error?: string;
}
