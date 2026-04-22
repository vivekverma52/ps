import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformService } from './platform.service';
import { PlatformRepository } from './platform.repository';
import { SuperadminController, PlansController } from './platform.controller';
import { Prescription, PrescriptionSchema } from '../prescription/schemas/prescription.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Prescription.name, schema: PrescriptionSchema }])],
  controllers: [SuperadminController, PlansController],
  providers: [PlatformRepository, PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
