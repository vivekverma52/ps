import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { OrganizationsController, RolesController } from './organization.controller';
import { Prescription, PrescriptionSchema } from '../prescription/schemas/prescription.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Prescription.name, schema: PrescriptionSchema }])],
  controllers: [OrganizationsController, RolesController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
