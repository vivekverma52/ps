import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrescriptionService } from './prescription.service';
import {
  PrescriptionsController,
  MedicinePrescriptionsController,
} from './prescription.controller';
import {
  MedicinePrescription,
  MedicinePrescriptionSchema,
} from './schemas/medicine-prescription.schema';
import { Prescription, PrescriptionSchema } from './schemas/prescription.schema';
import { PrescriptionRepository } from './prescription.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prescription.name,         schema: PrescriptionSchema },
      { name: MedicinePrescription.name, schema: MedicinePrescriptionSchema },
    ]),
  ],
  controllers: [PrescriptionsController, MedicinePrescriptionsController],
  providers: [PrescriptionRepository, PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
