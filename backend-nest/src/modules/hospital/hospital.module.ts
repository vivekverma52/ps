import { Module } from '@nestjs/common';
import { HospitalService } from './hospital.service';
import { HospitalRepository } from './hospital.repository';
import { HospitalsController, DoctorProfilesController, PharmacistProfilesController } from './hospital.controller';

@Module({
  controllers: [HospitalsController, DoctorProfilesController, PharmacistProfilesController],
  providers: [HospitalRepository, HospitalService],
  exports: [HospitalService],
})
export class HospitalModule {}
