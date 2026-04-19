import { Module } from '@nestjs/common';
import { HospitalService } from './hospital.service';
import { HospitalsController, DoctorProfilesController, PharmacistProfilesController } from './hospital.controller';

@Module({
  controllers: [HospitalsController, DoctorProfilesController, PharmacistProfilesController],
  providers: [HospitalService],
  exports: [HospitalService],
})
export class HospitalModule {}
