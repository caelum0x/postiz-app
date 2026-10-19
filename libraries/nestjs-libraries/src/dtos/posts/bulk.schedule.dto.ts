import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ValidContent } from '@gitroom/helpers/utils/valid.images';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';
import { Integration } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';

// Bulk CSV scheduling only supports a bare date + content per row (no media,
// no per-provider settings), the same intentional scope Buffer's own bulk
// upload ships with. See providerNeedsSettings() for which providers can
// actually accept that.
export class BulkScheduleRowDto {
  @IsDefined()
  @IsDateString()
  date: string;

  @IsDefined()
  @IsString()
  @Validate(ValidContent)
  @Transform(({ value }) => sanitizePostContent(value))
  content: string;
}

const MAX_ROWS_PER_UPLOAD = 100;

export class BulkScheduleDto {
  @IsDefined()
  @Type(() => Integration)
  @ValidateNested()
  integration: Integration;

  @IsOptional()
  @IsBoolean()
  shortLink?: boolean;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ROWS_PER_UPLOAD)
  @Type(() => BulkScheduleRowDto)
  @ValidateNested({ each: true })
  posts: BulkScheduleRowDto[];
}

export interface BulkScheduleRowResult {
  row: number;
  success: boolean;
  postId?: string;
  error?: string;
}
