import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformRepository } from './platform.repository';
import { SuperadminController, PlansController } from './platform.controller';

@Module({
  controllers: [SuperadminController, PlansController],
  providers: [PlatformRepository, PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
