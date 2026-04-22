import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrescriptionService } from './prescription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdateRenderDto } from './dto/update-render.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SaveInterpretedDataDto } from './dto/save-interpreted-data.dto';
import { CreateMedicineLibraryDto } from './dto/create-medicine-library.dto';
import { UpdateMedicineLibraryDto } from './dto/update-medicine-library.dto';
import { AddMedicineDto } from './dto/add-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { ListPrescriptionsQueryDto } from './dto/list-prescriptions-query.dto';
import { UpdatePatientDetailsDto } from './dto/update-patient-details.dto';
import { MedicineLibraryQueryDto } from './dto/medicine-library-query.dto';

const imageFileInterceptor = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'), false);
    }
  },
});

// ── Prescriptions Controller ──────────────────────────────────────────────────

@Controller('api/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @UseInterceptors(imageFileInterceptor)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreatePrescriptionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const prescription = await this.prescriptionService.uploadAndCreatePrescription({
      userId:       user.userId,
      userName:     user.name,
      orgId:        user.orgId,
      hospitalId:   user.hospitalId ?? null,
      patient_name:  body.patient_name,
      patient_phone: body.patient_phone,
      language:     body.language,
      notes:        body.notes,
      file,
    });
    return prescription;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListPrescriptionsQueryDto) {
    return this.prescriptionService.listPrescriptions({
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId,
      hospitalId: user.hospitalId ?? null,
      page:       query.page,
      limit:      query.limit,
      search:     query.search,
      status:     query.status,
    });
  }

  @Get('public/:token')
  async getPublic(@Param('token') token: string) {
    return this.prescriptionService.getPublicPrescription(token);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.prescriptionService.getPrescriptionById(id, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId,
      hospitalId: user.hospitalId ?? null,
    });
  }

  @Get(':id/download-video')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async downloadVideo(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.prescriptionService.getVideoDownloadUrl(id, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    });
  }

  @Put(':id/render')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updateRender(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateRenderDto,
  ) {
    const prescription = await this.prescriptionService.updateRender(id, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    }, body.video_url);
    return prescription;
  }

  @Put(':id/patient-details')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updatePatientDetails(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdatePatientDetailsDto,
  ) {
    return this.prescriptionService.updatePatientDetails(id, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    }, body);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateStatusDto,
  ) {
    return this.prescriptionService.updateStatus(id, {
      userId:     user.userId,
      role:       user.role,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
      status:     body.status,
    });
  }

  @Put(':id/interpreted-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async saveInterpretedData(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SaveInterpretedDataDto,
  ) {
    return this.prescriptionService.saveInterpretedData(id, body, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    });
  }

  @Get('medicines/search')
  @UseGuards(JwtAuthGuard)
  async searchMedicines(@Query('q') q: string) {
    return this.prescriptionService.searchMedicines(q || '');
  }

  @Post(':id/medicines')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async addMedicine(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AddMedicineDto,
  ) {
    const result = await this.prescriptionService.addMedicineToRx(id, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    }, body);
    return result;
  }

  @Put(':id/medicines/:medId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async updateMedicine(
    @Param('id') id: string,
    @Param('medId') medId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateMedicineDto,
  ) {
    const result = await this.prescriptionService.updateMedicineInRx(id, medId, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    }, body);
    return result;
  }

  @Delete(':id/medicines/:medId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async deleteMedicine(
    @Param('id') id: string,
    @Param('medId') medId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.prescriptionService.deleteMedicineFromRx(id, medId, {
      role:       user.role,
      userId:     user.userId,
      orgId:      user.orgId      ?? null,
      hospitalId: user.hospitalId ?? null,
    });
    return null;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.prescriptionService.removePrescription(id, user.userId);
    return null;
  }
}

// ── Medicine Prescriptions Controller (Library) ───────────────────────────────

@Controller('api/medicine-prescriptions')
@UseGuards(JwtAuthGuard)
export class MedicinePrescriptionsController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('ORG_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST')
  async create(@Body() body: CreateMedicineLibraryDto) {
    return this.prescriptionService.createMedicineLibraryEntry(body);
  }

  @Get()
  async list(@Query() query: MedicineLibraryQueryDto) {
    return this.prescriptionService.listMedicineLibrary(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.prescriptionService.getMedicineLibraryById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ORG_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST')
  async update(@Param('id') id: string, @Body() body: UpdateMedicineLibraryDto) {
    return this.prescriptionService.updateMedicineLibraryEntry(id, body);
  }

  @Post(':id/image')
  @UseGuards(RolesGuard)
  @Roles('ORG_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST')
  @UseInterceptors(imageFileInterceptor)
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('field') field: string | undefined,
  ) {
    return this.prescriptionService.uploadAndSaveMedicineImage(id, file, field);
  }

  @Delete(':id')
  @UseGuards(OrgAdminGuard)
  async remove(@Param('id') id: string) {
    await this.prescriptionService.removeMedicineLibraryEntry(id);
    return null;
  }
}
