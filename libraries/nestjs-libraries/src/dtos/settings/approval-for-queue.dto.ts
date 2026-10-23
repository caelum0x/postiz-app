import { IsBoolean } from 'class-validator';

export class ApprovalForQueueDto {
  @IsBoolean()
  requireApprovalForQueue: boolean;
}
