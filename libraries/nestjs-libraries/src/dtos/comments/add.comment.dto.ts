import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class CreatePublicCommentDto extends AddCommentDto {
  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  anchorStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  anchorEnd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  anchorQuote?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  // Resolved team-member user ids picked from a mention picker - only
  // honored when the comment is created by an authenticated team member
  // (userId set), never from the public no-auth preview link. See
  // PostsService.createPublicComment.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  mentions?: string[];

  // Directs this root comment to one team member. Same authenticated-only
  // restriction as mentions above.
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class ResolveCommentDto {
  @IsBoolean()
  resolved: boolean;
}

export class AssignCommentDto {
  // Empty string/undefined clears the assignment.
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class ApprovePostDto {
  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
