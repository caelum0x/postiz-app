import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateEvergreenRecycleDto {
  // How many days after the last recycle (or after creation, for the first
  // run) before this post is republished again.
  @IsInt()
  @Min(1)
  @Max(365)
  intervalDays: number;

  // Unlimited if omitted - see Organization.EvergreenRecycle.maxRecycles.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxRecycles?: number;
}

export class UpdateEvergreenRecycleDto {
  @IsBoolean()
  active: boolean;
}
