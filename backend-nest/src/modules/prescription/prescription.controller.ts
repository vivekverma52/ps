import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { PrescriptionService } from './prescription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { S3Service } from '../../common/s3/s3.service';
import { SqsService } from '../../common/sqs/sqs.service';
import { AppError } from '../../common/errors/app.error';
import { ConfigService } from '@nestjs/config';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdateRenderDto } from './dto/update-render.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SaveInterpretedDataDto } from './dto/save-interpreted-data.dto';
import { CreateMedicineLibraryDto } from './dto/create-medicine-library.dto';
import { UpdateMedicineLibraryDto } from './dto/update-medicine-library.dto';
import { AddMedicineDto } from './dto/add-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { IsOptional, IsString } from 'class-validator';

class MedicineLibraryQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() drug_category?: string;
}

// ── Prescriptions Controller ──────────────────────────────────────────────────

@Controller('api/prescriptions')
export class PrescriptionsController {
  private readonly logger = new Logger(PrescriptionsController.name);

  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly s3Service: S3Service,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only images and PDFs are allowed'), false);
        }
      },
    }),
  )
  async create(
    @CurrentUser() user: any,
    @Body() body: CreatePrescriptionDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    this.logger.log(`[UPLOAD] START doctor=${user.userId} orgId=${user.orgId} patient="${body.patient_name}" language=${body.language}`);

    this.logger.log(`[UPLOAD] Checking subscription limit orgId=${user.orgId}`);
    await this.prescriptionService.assertSubscriptionLimit(user.orgId);
    this.logger.log(`[UPLOAD] Subscription limit OK`);

    // Acquire upload slot — rejects if MAX_CONCURRENT_UPLOADS already in-flight
    if (file) this.prescriptionService.acquireUploadSlot();

    let imageKey: string | null = null;
    let imageUrl: string | null = null;
    try {
      if (file) {
        const fileSizeKB = (file.size / 1024).toFixed(1);
        this.logger.log(`[UPLOAD] Image received — name="${file.originalname}" size=${fileSizeKB}KB type=${file.mimetype}`);
        imageKey = await this.s3Service.uploadToS3(file.buffer, file.originalname, file.mimetype);
        imageUrl = this.s3Service.getObjectUrl(imageKey);
        this.logger.log(`[UPLOAD] S3 upload complete — key=${imageKey}`);
      } else {
        this.logger.warn(`[UPLOAD] No image file attached — prescription will have no image`);
      }

      this.logger.log(`[UPLOAD] Saving prescription to DB — imageKey=${imageKey ?? 'none'}`);
      const prescription = await this.prescriptionService.createPrescription({
        userId: user.userId,
        userName: user.name,
        orgId: user.orgId,
        hospitalId: user.hospitalId ?? null,
        patient_name: body.patient_name,
        patient_phone: body.patient_phone,
        language: body.language,
        notes: body.notes,
        imageKey,
      });
      this.logger.log(`[UPLOAD] DB record created — prescriptionId=${prescription.id} patient_uid=${prescription.patient_uid}`);

      if (imageKey && imageUrl) {
        const uploadQueueUrl = this.configService.get<string>('SQS_UPLOAD_QUEUE_URL');
        if (!uploadQueueUrl) {
          this.logger.warn(`[UPLOAD] SQS_UPLOAD_QUEUE_URL not configured — OCR will NOT run for prescriptionId=${prescription.id}`);
        } else {
          this.logger.log(`[UPLOAD] Sending to OCR queue — prescriptionId=${prescription.id} patientId=${prescription.patient_uid} imageUrl=${imageUrl}`);
          await this.sqsService.sendMessage(uploadQueueUrl, {
            imageKey: imageUrl,
            patientId: prescription.patient_uid,
          });
          this.logger.log(`[UPLOAD] OCR queue message sent — prescriptionId=${prescription.id}`);
        }
      } else {
        this.logger.log(`[UPLOAD] No image — skipping OCR queue send prescriptionId=${prescription.id}`);
      }

      this.logger.log(`[UPLOAD] DONE prescriptionId=${prescription.id} hasImage=${!!imageKey}`);
      return res.status(201).json({ success: true, message: 'Prescription created', data: prescription });
    } finally {
      if (file) this.prescriptionService.releaseUploadSlot();
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: any, @Res() res: Response) {
    const rows = await this.prescriptionService.listPrescriptions({
      role: user.role,
      userId: user.userId,
      orgId: user.orgId,
    });
    return res.status(200).json({ success: true, data: rows });
  }

  @Get('public/:token')
  async getPublic(@Param('token') token: string, @Res() res: Response) {
    const prescription = await this.prescriptionService.getPublicPrescription(token);
    return res.status(200).json({ success: true, data: prescription });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const prescription = await this.prescriptionService.getPrescriptionById(id, {
      role: user.role,
      userId: user.userId,
      orgId: user.orgId,
    });
    return res.status(200).json({ success: true, data: prescription });
  }

  @Get(':id/download-video')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async downloadVideo(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.getVideoDownloadUrl(id, {
      role: user.role, userId: user.userId, orgId: user.orgId ?? null,
    });
    return res.status(200).json({ success: true, data: result });
  }

  @Put(':id/render')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updateRender(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: UpdateRenderDto,
    @Res() res: Response,
  ) {
    this.logger.log(`[RENDER] Triggered by userId=${user.userId} role=${user.role} prescriptionId=${id}`);
    const prescription = await this.prescriptionService.updateRender(id, user.userId, body.video_url);
    this.logger.log(`[RENDER] Complete prescriptionId=${id} status=${prescription?.status}`);
    return res.status(200).json({ success: true, message: 'Prescription updated', data: prescription });
  }

  @Put(':id/patient-details')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updatePatientDetails(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { patient_name?: string; patient_phone?: string },
    @Res() res: Response,
  ) {
    this.logger.log(`[PATIENT:UPDATE] userId=${user.userId} prescriptionId=${id}`);
    const result = await this.prescriptionService.updatePatientDetails(id, user.orgId, body);
    return res.status(200).json({ success: true, message: 'Patient details updated', data: result });
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: UpdateStatusDto,
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.updateStatus(id, {
      userId: user.userId,
      role: user.role,
      orgId: user.orgId,
      status: body.status,
    });
    return res.status(200).json({ success: true, message: result.message, data: result });
  }

  @Put(':id/interpreted-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async saveInterpretedData(
    @Param('id') id: string,
    @Body() body: SaveInterpretedDataDto,
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.saveInterpretedData(id, body);
    return res.status(200).json({ success: true, message: result.message });
  }

  @Get('medicines/search')
  @UseGuards(JwtAuthGuard)
  async searchMedicines(@Query('q') q: string, @Res() res: Response) {
    const results = await this.prescriptionService.searchMedicines(q || '');
    return res.status(200).json({ success: true, data: results });
  }

  @Post(':id/medicines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async addMedicine(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: AddMedicineDto,
    @Res() res: Response,
  ) {
    this.logger.log(`[MEDICINE:ADD] pharmacist=${user.userId} orgId=${user.orgId} prescriptionId=${id} medicine="${body.name}"`);
    const result = await this.prescriptionService.addMedicineToRx(id, user.orgId, body);
    this.logger.log(`[MEDICINE:ADD] Success — medId=${result.id} prescriptionId=${id}`);
    return res.status(201).json({ success: true, message: 'Medicine added', data: result });
  }

  @Put(':id/medicines/:medId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async updateMedicine(
    @Param('id') id: string,
    @Param('medId') medId: string,
    @CurrentUser() user: any,
    @Body() body: UpdateMedicineDto,
    @Res() res: Response,
  ) {
    this.logger.log(`[MEDICINE:UPDATE] pharmacist=${user.userId} orgId=${user.orgId} prescriptionId=${id} medId=${medId}`);
    const result = await this.prescriptionService.updateMedicineInRx(id, medId, user.orgId, body);
    this.logger.log(`[MEDICINE:UPDATE] Success — medId=${medId} prescriptionId=${id}`);
    return res.status(200).json({ success: true, message: 'Medicine updated', data: result });
  }

  @Delete(':id/medicines/:medId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async deleteMedicine(
    @Param('id') id: string,
    @Param('medId') medId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    this.logger.log(`[MEDICINE:DELETE] pharmacist=${user.userId} orgId=${user.orgId} prescriptionId=${id} medId=${medId}`);
    await this.prescriptionService.deleteMedicineFromRx(id, medId, user.orgId);
    this.logger.log(`[MEDICINE:DELETE] Success — medId=${medId} prescriptionId=${id}`);
    return res.status(200).json({ success: true, message: 'Medicine removed', data: null });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  async remove(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    await this.prescriptionService.removePrescription(id, user.userId);
    return res.status(200).json({ success: true, message: 'Prescription deleted', data: null });
  }
}

// ── Medicine Prescriptions Controller (Library) ───────────────────────────────

@Controller('api/medicine-prescriptions')
@UseGuards(JwtAuthGuard)
export class MedicinePrescriptionsController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ORG_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST')
  async create(@Body() body: CreateMedicineLibraryDto, @Res() res: Response) {
    const doc = await this.prescriptionService.createMedicineLibraryEntry(body);
    return res.status(201).json({ success: true, message: 'Medicine prescription created', data: doc });
  }

  @Get()
  async list(@Query() query: MedicineLibraryQueryDto, @Res() res: Response) {
    const result = await this.prescriptionService.listMedicineLibrary(query);
    return res.status(200).json({ success: true, data: result });
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.prescriptionService.getMedicineLibraryById(id);
    return res.status(200).json({ success: true, data: doc });
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ORG_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST')
  async update(@Param('id') id: string, @Body() body: UpdateMedicineLibraryDto, @Res() res: Response) {
    const doc = await this.prescriptionService.updateMedicineLibraryEntry(id, body);
    return res.status(200).json({ success: true, message: 'Medicine prescription updated', data: doc });
  }

  @Post(':id/image')
  @UseGuards(RolesGuard)
  @Roles('ORG_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only images and PDFs are allowed'), false);
        }
      },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('field') field: string,
    @Res() res: Response,
  ) {
    if (!file) throw AppError.badRequest('No image file provided');
    const validFields = ['medicine_image', 'medicine_image_2', 'medicine_image_3'];
    const imageField = validFields.includes(field) ? field as any : 'medicine_image';
    const key = await this.s3Service.uploadToS3(file.buffer, file.originalname, file.mimetype);
    const imageUrl = this.s3Service.getObjectUrl(key);
    const doc = await this.prescriptionService.updateMedicineLibraryImage(id, imageUrl, imageField);
    return res.status(200).json({ success: true, message: 'Image uploaded', data: doc });
  }

  @Delete(':id')
  @UseGuards(OrgAdminGuard)
  async remove(@Param('id') id: string, @Res() res: Response) {
    await this.prescriptionService.removeMedicineLibraryEntry(id);
    return res.status(200).json({ success: true, message: 'Medicine prescription deleted', data: null });
  }
}
