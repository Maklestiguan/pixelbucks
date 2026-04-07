import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Public()
  @Get()
  get() {
    return this.settings.get();
  }
}
