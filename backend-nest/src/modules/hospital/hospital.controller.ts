import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { HospitalService } from './hospital.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { UpsertAddressDto } from './dto/upsert-address.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateHospitalMemberDto } from './dto/create-hospital-member.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { UpdatePharmacistProfileDto } from './dto/update-pharmacist-profile.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

// ── Hospitals Controller ──────────────────────────────────────────────────────

@Controller('api/organizations/me/hospitals')
@UseGuards(JwtAuthGuard)
export class HospitalsController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.hospitalService.listHospitals(user.orgId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.hospitalService.getHospitalById(user.orgId, id);
  }

  @Get(':id/staff')
  getStaff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.hospitalService.getStaff(user.orgId, id);
  }

  @Post()
  @UseGuards(OrgAdminGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHospitalDto) {
    return this.hospitalService.createHospital(user.orgId, dto);
  }

  @Put(':id')
  @UseGuards(OrgAdminGuard)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.hospitalService.updateHospital(user.orgId, id, dto);
  }

  @Delete(':id')
  @UseGuards(OrgAdminGuard)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.hospitalService.removeHospital(user.orgId, id);
  }

  @Put(':id/address')
  @UseGuards(OrgAdminGuard)
  upsertAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpsertAddressDto) {
    return this.hospitalService.upsertAddress(user.orgId, id, dto);
  }

  @Post(':id/members')
  @UseGuards(OrgAdminGuard)
  createMember(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: CreateHospitalMemberDto) {
    return this.hospitalService.createMemberForHospital(user.orgId, id, body);
  }

  @Post(':id/staff')
  @UseGuards(OrgAdminGuard)
  assignStaff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { user_id: string }) {
    return this.hospitalService.assignStaffToHospital(user.orgId, id, body.user_id);
  }

  @Delete(':id/staff/:userId')
  @UseGuards(OrgAdminGuard)
  removeStaff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.hospitalService.removeStaffFromHospital(user.orgId, id, userId);
  }
}

// ── Doctor Profiles Controller ────────────────────────────────────────────────

@Controller('api/profiles/doctors')
@UseGuards(JwtAuthGuard)
export class DoctorProfilesController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.hospitalService.getDoctorProfile(user.userId);
  }

  @Put('me')
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateDoctorProfileDto) {
    return this.hospitalService.updateDoctorProfile(user.userId, dto);
  }

  @Get('hospital/:hospitalId')
  @UseGuards(OrgAdminGuard)
  getByHospital(@Param('hospitalId') hospitalId: string) {
    return this.hospitalService.getDoctorsByHospital(hospitalId);
  }
}

// ── Pharmacist Profiles Controller ────────────────────────────────────────────

@Controller('api/profiles/pharmacists')
@UseGuards(JwtAuthGuard)
export class PharmacistProfilesController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.hospitalService.getPharmacistProfile(user.userId);
  }

  @Put('me')
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePharmacistProfileDto) {
    return this.hospitalService.updatePharmacistProfile(user.userId, dto);
  }

  @Get('hospital/:hospitalId')
  @UseGuards(OrgAdminGuard)
  getByHospital(@Param('hospitalId') hospitalId: string) {
    return this.hospitalService.getPharmacistsByHospital(hospitalId);
  }
}
