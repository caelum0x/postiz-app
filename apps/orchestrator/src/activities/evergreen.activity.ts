import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { EvergreenService } from '@gitroom/nestjs-libraries/database/prisma/evergreen/evergreen.service';

@Injectable()
@Activity()
export class EvergreenActivity {
  constructor(private _evergreenService: EvergreenService) {}

  @ActivityMethod()
  async recycleDueBatch() {
    return this._evergreenService.runDueBatch();
  }
}
