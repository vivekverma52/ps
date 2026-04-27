/**
 * PrescriptionService — Level 3 (Medical)
 * Prescriptions stored in MongoDB · Medicine Library in MongoDB · Org limits in MySQL
 */

const LANG_NAME_TO_CODE: Record<string, string> = {
  hindi: 'hi', english: 'en', marathi: 'mr', tamil: 'ta',
  telugu: 'te', bengali: 'bn', gujarati: 'gu', kannada: 'kn',
  punjabi: 'pa', odia: 'or', bhojpuri: 'bho',
};

function normaliseLang(lang: string): string {
  const key = lang.trim().toLowerCase();
  return LANG_NAME_TO_CODE[key] ?? lang;
}

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import * as mongoose from 'mongoose';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
import { ConfigService } from '@nestjs/config';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';
import { S3Service } from '../../common/s3/s3.service';
import { SqsService } from '../../common/sqs/sqs.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';
import { Prescription, PrescriptionDocument } from './schemas/prescription.schema';
import {
  MedicinePrescription,
  MedicinePrescriptionDocument,
} from './schemas/medicine-prescription.schema';
import { CreateMedicineLibraryDto } from './dto/create-medicine-library.dto';
import { UpdateMedicineLibraryDto } from './dto/update-medicine-library.dto';
import { SaveInterpretedDataDto } from './dto/save-interpreted-data.dto';
import { UpdatePatientDetailsDto } from './dto/update-patient-details.dto';
import {
  ActorContext,
  InterpretedData,
  ManualMedicine,
  OcrExtractedData,
  OcrMedicine,
  OcrResultMessage,
  PrescriptionAccessFields,
  RenderMedicine,
  RenderPayload,
} from './prescription.types';

// ── Module-level constants ────────────────────────────────────────────────────

const VALID_STATUSES = ['UPLOADED', 'CLAIMED', 'PROCESSING', 'RENDERED', 'SENT'] as const;
type PrescriptionStatus = typeof VALID_STATUSES[number];

interface OrgRow extends RowDataPacket {
  id: string;
  plan: string;
  prescription_limit: number;
}

type WithUrls<T> = T & { image_url: string | null; video_url: string | null };

// ── Pure helpers ──────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePagination(page?: string, limit?: string): { pageNum: number; limitNum: number } {
  const pageNum  = Math.max(1, parseInt(page  || '1',  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
  return { pageNum, limitNum };
}

function generatePatientUid(
  orgId: string | null,
  hospitalId: string | null,
  doctorId: string,
  rxId: string,
): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seg  = (val: string | null, fallback: string) =>
    (val ?? fallback).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${seg(orgId, 'NORG')}-${seg(hospitalId, 'NOHOSP')}-${seg(doctorId, 'NODOC')}-${seg(rxId, rxId)}-${date}`;
}

function extractS3Key(url: string): string {
  const match = url.split('?')[0].match(/\.amazonaws\.com\/(.+)$/);
  return match ? match[1] : url;
}

function manualMedicineToOcr(m: ManualMedicine): OcrMedicine {
  return {
    medicine_name: m.name,
    dosage:        m.quantity || null,
    instructions:  m.description || null,
    duration:      m.course || null,
    time_of_day:   m.frequency || null,
    with_food:     m.with_food || null,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PrescriptionService implements OnModuleInit {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    @InjectModel(Prescription.name)
    private readonly prescriptionModel: Model<PrescriptionDocument>,
    @InjectModel(MedicinePrescription.name)
    private readonly medicineLibraryModel: Model<MedicinePrescriptionDocument>,
    private readonly s3Service: S3Service,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  onModuleInit(): void {
    const resultQueueUrl = this.configService.get<string>('SQS_RESULT_QUEUE_URL');
    if (!resultQueueUrl) {
      this.logger.warn('SQS_RESULT_QUEUE_URL not set — OCR result polling disabled');
    } else {
      this.sqsService.startPolling(resultQueueUrl, (body) => this.handleResultMessage(body));
    }

    const videoResultQueueUrl = this.configService.get<string>('SQS_VIDEO_RESULT_QUEUE_URL');
    if (!videoResultQueueUrl) {
      this.logger.warn('SQS_VIDEO_RESULT_QUEUE_URL not set — video result polling disabled');
    } else {
      this.sqsService.startPolling(videoResultQueueUrl, (body) => this.handleVideoResultMessage(body));
    }

  }

  // ═══════════════════════════════════════════════════════════════════════
  // SQS CONSUMERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * OCR result queue handler.
   *
   * Incoming shape (OcrResultMessage):
   *   imageUrl, patientId, status, processedAt, extractedData, processingSummary, errorMessage
   */
  private async handleResultMessage(body: Record<string, unknown>): Promise<void> {
    this.logger.log(`[SQS Consumer] Received: ${JSON.stringify(body)}`);

    const {
      imageUrl, patientId, status, processedAt,
      extractedData, processingSummary, errorMessage,
    } = body as unknown as OcrResultMessage;

    if (!imageUrl) {
      this.logger.warn('[SQS Consumer] Skipping — missing imageUrl');
      return;
    }
    if (status !== 'success') {
      this.logger.warn(`[SQS Consumer] OCR status=${status} error=${errorMessage} — skipping save`);
      return;
    }

    const dbImageKey = extractS3Key(imageUrl);
    this.logger.log(`[SQS Consumer] imageUrl=${imageUrl} dbKey=${dbImageKey} patientId=${patientId}`);

    let prescription = dbImageKey
      ? await this.prescriptionModel.findOne({ image_key: dbImageKey }).lean<Prescription>()
      : null;

    if (!prescription && patientId) {
      prescription = await this.prescriptionModel.findOne({ patient_uid: patientId }).lean<Prescription>();
      if (prescription) this.logger.log('[SQS Consumer] Matched via patient_uid fallback');
    }
    if (!prescription) {
      this.logger.warn(`[SQS Consumer] No prescription found for image_key=${dbImageKey} or patientId=${patientId}`);
      return;
    }
    this.logger.log(`[SQS Consumer] Matched prescription id=${prescription.id}`);

    const existing = (prescription.interpreted_data as InterpretedData | null);
    const existingMedicines: ManualMedicine[] = Array.isArray(existing?.medicines)
      ? existing.medicines : [];

    const newInterpretedData: InterpretedData = {
      medicines:        existingMedicines,
      ocr_source:       true,
      interpreted_data: {
        medicines:        extractedData?.medicines        ?? [],
        doctor_details:   extractedData?.doctor_details   ?? {},
        hospital_details: extractedData?.hospital_details ?? {},
        patient_details:  extractedData?.patient_details  ?? {},
        raw_text_preview: extractedData?.raw_text_preview ?? '',
      },
      metadata: {
        processed_at:       processedAt,
        processing_summary: processingSummary,
      },
      status,
    };

    // Back-fill patient name/phone from OCR when doctor used "Quick Upload" placeholders
    const pd = extractedData?.patient_details ?? {};
    const ocrName  = pd.name?.trim();
    const ocrPhone = (pd.phone ?? pd.contact)?.trim();

    const topLevel: Record<string, string> = {};
    if (ocrName  && prescription.patient_name  === 'Quick Upload')  topLevel.patient_name  = ocrName;
    if (ocrPhone && prescription.patient_phone === '0000000000')    topLevel.patient_phone = ocrPhone;

    await this.prescriptionModel.updateOne(
      { id: prescription.id },
      { $set: { interpreted_data: newInterpretedData, ...topLevel } },
    );

    if (Object.keys(topLevel).length > 0) {
      this.logger.log(`[SQS Consumer] Patient details back-filled from OCR — ${JSON.stringify(topLevel)}`);
    }
    this.logger.log(`[SQS Consumer] OCR data saved — ${processingSummary?.medicinesFound ?? 0} medicines found`);
  }

  /**
   * Video-processing result queue handler.
   * Accepts multiple field name variants from the video processing service.
   */
  private async handleVideoResultMessage(body: Record<string, unknown>): Promise<void> {
    this.logger.log(`[Video Consumer] Received raw: ${JSON.stringify(body)}`);

    const status = (body.status as string | undefined)?.toLowerCase();
    if (status && status !== 'success' && status !== 'completed' && status !== 'done') {
      this.logger.warn(`[Video Consumer] status=${status} error=${body.errorMessage ?? body.error ?? ''} — skipping`);
      return;
    }

    const prescriptionId = (
      body.request_id ?? body.id ?? body.prescriptionId ?? body.prescription_id
    ) as string | undefined;

    if (!prescriptionId?.trim()) {
      this.logger.warn(`[Video Consumer] Cannot resolve prescription id — keys: ${Object.keys(body).join(', ')}`);
      return;
    }

    const rawVideoUrl = (
      body.s3_url ?? body.video_url ?? body.videoUrl ?? body.url ?? body.video_key ?? body.videoKey
    ) as string | undefined;

    if (!rawVideoUrl?.trim()) {
      this.logger.warn(`[Video Consumer] Cannot resolve video URL for id=${prescriptionId}`);
      return;
    }

    const prescription = await this.prescriptionModel
      .findOne({ id: prescriptionId.trim() })
      .lean<Prescription>();
    if (!prescription) {
      this.logger.warn(`[Video Consumer] No prescription found for id=${prescriptionId}`);
      return;
    }

    const explicitKey = body.s3_key as string | undefined;
    const videoKey = explicitKey?.trim() ?? extractS3Key(rawVideoUrl.trim());

    await this.prescriptionModel.updateOne(
      { id: prescription.id },
      { $set: { video_key: videoKey, status: 'RENDERED' } },
    );
    this.logger.log(`[Video Consumer] Video saved — prescription=${prescription.id} key=${videoKey}`);

    const phone = prescription.patient_phone;
    if (phone && phone !== '0000000000') {
      try {
        const videoShareUrl = await this.s3Service.getPresignedViewUrl(videoKey);
        const waResult = await this.whatsAppService.sendVideoReady(
          phone,
          prescription.patient_name ?? 'Patient',
          videoShareUrl,
        );
        if (waResult.success) {
          this.logger.log(`[Video Consumer] WhatsApp sent to ${phone}`);
        } else {
          this.logger.warn(`[Video Consumer] WhatsApp skipped/failed — reason=${waResult.error}`);
        }
      } catch (err) {
        // Non-fatal — video is already saved; only WhatsApp notification failed
        this.logger.error(`[Video Consumer] WhatsApp dispatch error: ${(err as Error).message}`);
      }
    } else {
      this.logger.log('[Video Consumer] Skipping WhatsApp — phone is placeholder or missing');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION LIMIT
  // ═══════════════════════════════════════════════════════════════════════

  async assertSubscriptionLimit(orgId: string | null): Promise<void> {
    if (!orgId) return;

    const [orgRows] = await this.pool.execute<OrgRow[]>(
      `SELECT o.id, COALESCE(p.name, 'FREE') AS plan, p.max_prescriptions_per_month AS prescription_limit
       FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
      [orgId],
    );
    const org = orgRows[0];
    // No org, no plan assigned, zero/null limit, or enterprise — all skip the check
    if (!org || !org.prescription_limit || org.prescription_limit <= 0) return;
    if (org.plan === 'ENTERPRISE' || org.plan === 'ENT') return;

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const count = await this.prescriptionModel.countDocuments({
      org_id:     orgId,
      created_at: { $gte: start, $lt: end },
    });

    if (count >= org.prescription_limit) {
      const err = new AppError(
        `Monthly limit of ${org.prescription_limit} prescriptions reached on your ${org.plan} plan. Please upgrade.`,
        403,
        'LIMIT_EXCEEDED',
      );
      err.current = count;
      err.limit   = org.prescription_limit;
      err.plan    = org.plan;
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private addUrls<T extends { image_key?: string | null; video_key?: string | null }>(
    doc: T,
  ): WithUrls<T> {
    return {
      ...doc,
      image_url: doc.image_key ? this.s3Service.getObjectUrl(doc.image_key) : null,
      video_url: doc.video_key ? this.s3Service.getObjectUrl(doc.video_key) : null,
    };
  }

  private toPlain(doc: PrescriptionDocument): Prescription {
    const obj = doc.toObject<Prescription>({ versionKey: false });
    delete (obj as Prescription & { _id?: unknown })._id;
    return obj;
  }

  private async getPrescriptionRaw(id: string): Promise<Prescription> {
    const doc = await this.prescriptionModel.findOne({ id }).lean<Prescription>();
    if (!doc) throw AppError.notFound('Prescription');
    return doc;
  }

  /**
   * Central access-control check for every prescription mutation/read.
   *
   * DOCTOR      — must own the prescription (doctor_id match)
   * PHARMACIST  — hospital-scoped: strict hospital match; org-level: org match
   * Others      — org-level check (ORG_ADMIN, HOSPITAL_ADMIN, etc.)
   */
  private assertPrescriptionAccess(
    doc: PrescriptionAccessFields,
    actor: ActorContext,
  ): void {
    if (actor.role === 'DOCTOR') {
      if (doc.doctor_id !== actor.userId) throw AppError.forbidden();
      return;
    }

    if (actor.role === 'PHARMACIST') {
      if (actor.hospitalId) {
        if (doc.hospital_id !== actor.hospitalId) throw AppError.forbidden();
      } else if (actor.orgId && doc.org_id !== actor.orgId) {
        throw AppError.forbidden();
      }
      return;
    }

    if (actor.orgId && doc.org_id !== actor.orgId) throw AppError.forbidden();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRESCRIPTIONS — MongoDB
  // ═══════════════════════════════════════════════════════════════════════

  async createPrescription(params: {
    userId: string; userName: string; orgId: string | null; hospitalId: string | null;
    patient_name?: string; patient_phone?: string;
    language?: string; notes?: string; imageKey?: string | null;
  }): Promise<WithUrls<Prescription>> {
    const { userId, userName, orgId, hospitalId, language, notes, imageKey } = params;
    const patient_name  = params.patient_name?.trim()  || 'Quick Upload';
    const patient_phone = params.patient_phone?.trim() || '0000000000';

    const id           = uuidv4();
    const access_token = crypto.randomBytes(32).toString('hex');
    const patient_uid  = generatePatientUid(orgId, hospitalId, userId, id);

    const created = await this.prescriptionModel.create({
      id,
      doctor_id:     userId,
      doctor_name:   userName,
      org_id:        orgId        ?? null,
      hospital_id:   hospitalId  ?? null,
      patient_name:  patient_name.trim(),
      patient_phone: patient_phone.trim(),
      language:      language || 'English',
      image_key:     imageKey ?? null,
      access_token,
      notes:         notes?.trim() || null,
      patient_uid,
    });

    return this.addUrls(this.toPlain(created));
  }

  async listPrescriptions(params: {
    role: string; userId: string; orgId: string | null; hospitalId?: string | null;
    page?: string; limit?: string; search?: string; status?: string; date?: string;
  }): Promise<{ data: WithUrls<Prescription>[]; total: number; page: number; limit: number }> {
    const { role, userId, orgId, hospitalId } = params;
    const { pageNum, limitNum } = parsePagination(params.page, params.limit);

    let filter: FilterQuery<PrescriptionDocument> = {};
    if (role === 'DOCTOR')          filter = { doctor_id: userId };
    else if (role === 'PHARMACIST') filter = hospitalId ? { hospital_id: hospitalId } : (orgId ? { org_id: orgId } : {});
    else if (orgId)                 filter = { org_id: orgId };

    if (params.search?.trim()) {
      const safe = escapeRegex(params.search.trim());
      filter.$or = [
        { patient_name:  { $regex: safe, $options: 'i' } },
        { patient_phone: { $regex: safe, $options: 'i' } },
        { doctor_name:   { $regex: safe, $options: 'i' } },
      ];
    }
    if (params.status?.trim()) {
      filter.status = params.status.trim().toUpperCase() as PrescriptionStatus;
    }

    // Date filter — IST (UTC+05:30)
    if (params.date === 'today' || params.date === 'week') {
      const IST_MS = 5.5 * 60 * 60 * 1000;
      const nowIst = new Date(Date.now() + IST_MS);
      const y = nowIst.getUTCFullYear(), m = nowIst.getUTCMonth(), d = nowIst.getUTCDate();
      const startIst = new Date(Date.UTC(y, m, d));         // midnight IST as UTC Date
      const startUtc = new Date(startIst.getTime() - IST_MS);
      if (params.date === 'today') {
        filter.created_at = { $gte: startUtc, $lt: new Date(startUtc.getTime() + 86_400_000) };
      } else {
        filter.created_at = { $gte: new Date(startUtc.getTime() - 6 * 86_400_000) };
      }
    }

    const skip = (pageNum - 1) * limitNum;
    const [docs, total] = await Promise.all([
      this.prescriptionModel.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean<Prescription[]>(),
      this.prescriptionModel.countDocuments(filter),
    ]);

    return { data: docs.map(d => this.addUrls(d)), total, page: pageNum, limit: limitNum };
  }

  async getPrescriptionById(
    id: string,
    actor: ActorContext,
  ): Promise<WithUrls<Prescription>> {
    if (!id) throw AppError.badRequest('Prescription ID is required');

    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean<Prescription>();

    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, actor);

    return this.addUrls(prescription);
  }

  async saveInterpretedData(
    id: string,
    data: SaveInterpretedDataDto,
    actor: ActorContext,
  ): Promise<{ message: string }> {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean<Prescription>();
    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, actor);

    await this.prescriptionModel.updateOne({ id: prescription.id }, { $set: { interpreted_data: data } });
    return { message: 'Interpreted data saved' };
  }

  async updateRender(
    id: string,
    actor: ActorContext,
    video_url?: string,
  ): Promise<WithUrls<Prescription> | null> {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean<Prescription>();
    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, actor);

    const videoKey = video_url?.trim() ? extractS3Key(video_url.trim()) : null;

    await this.prescriptionModel.updateOne(
      { id: prescription.id },
      { $set: { video_key: videoKey, status: 'RENDERED' } },
    );

    const renderQueueUrl = this.configService.get<string>('SQS_RENDER_QUEUE_URL');
    const interpreted   = prescription.interpreted_data as InterpretedData | null;
    const ocr           = interpreted?.interpreted_data ?? ({} as OcrExtractedData);
    const ocrMedicines  = ocr.medicines ?? [];
    const manualMeds    = Array.isArray(interpreted?.medicines) ? interpreted.medicines : [];

    this.logger.log(
      `[RENDER] prescriptionId=${prescription.id}` +
      ` ocr_source=${!!interpreted?.ocr_source}` +
      ` ocrMedicines=${ocrMedicines.length}` +
      ` manualMedicines=${manualMeds.length}`,
    );

    const allMedicines: OcrMedicine[] = [
      ...ocrMedicines,
      ...manualMeds.map(manualMedicineToOcr),
    ];

    if (allMedicines.length === 0) {
      this.logger.warn(`[RENDER] WARNING — zero medicines in payload for prescription=${prescription.id}`);
    } else {
      this.logger.log(`[RENDER] Total medicines=${allMedicines.length} (ocr=${ocrMedicines.length} manual=${manualMeds.length})`);
      allMedicines.forEach((m, i) =>
        this.logger.log(`[RENDER]   [${i + 1}] name="${m.medicine_name}" dosage="${m.dosage}" duration="${m.duration}"`),
      );
    }

    if (renderQueueUrl) {
      const payload: RenderPayload = {
        request_id: prescription.id,
        language:   normaliseLang(prescription.language ?? 'en'),
        interpreted_data: {
          patient_details: {
            name: prescription.patient_name,
            age:  ocr.patient_details?.age ?? null,
          },
          doctor_details: {
            name:           prescription.doctor_name,
            specialization: ocr.doctor_details?.qualifications ?? null,
          },
          medicines: allMedicines.map((m): RenderMedicine => ({
            medicine_name: m.medicine_name,
            dosage:        m.dosage        ?? null,
            instructions:  m.instructions  ?? null,
            duration:      m.duration      ?? null,
            time_of_day:   m.time_of_day ?? null,
            with_food:     m.with_food   ?? null,
          })),
        },
      };

      this.logger.log(`[RENDER] SQS payload:\n${JSON.stringify(payload, null, 2)}`);

      try {
        await this.withRetry(
          () => this.sqsService.sendMessage(renderQueueUrl, payload as unknown as Record<string, unknown>),
          'SQS render enqueue',
        );
        this.logger.log(`[RENDER] SQS message enqueued — prescriptionId=${prescription.id} medicines=${allMedicines.length}`);
      } catch (sqsErr) {
        // Non-fatal: prescription status is already RENDERED in DB with video_key set.
        // Video generation won't start automatically — re-queue manually if needed.
        this.logger.error(
          `[RENDER] SQS render enqueue failed — prescriptionId=${prescription.id}: ${(sqsErr as Error).message}`,
        );
      }
    } else {
      this.logger.warn('[RENDER] SQS_RENDER_QUEUE_URL not set — skipping render queue send');
    }

    const updated = await this.prescriptionModel.findOne({ id: prescription.id }).lean<Prescription>();
    return updated ? this.addUrls(updated) : null;
  }

  async updatePatientDetails(
    prescriptionId: string,
    actor: ActorContext,
    body: UpdatePatientDetailsDto,
  ): Promise<WithUrls<Prescription> | null> {
    this.logger.log(`[PATIENT:UPDATE] prescriptionId=${prescriptionId} orgId=${actor.orgId}`);
    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);

    const updates: Partial<Record<'patient_name' | 'patient_phone', string>> = {};
    if (body.patient_name?.trim())  updates.patient_name  = body.patient_name.trim();
    if (body.patient_phone?.trim()) updates.patient_phone = body.patient_phone.trim();
    if (Object.keys(updates).length === 0) throw AppError.badRequest('No fields to update');

    await this.prescriptionModel.updateOne({ id: prescriptionId }, { $set: updates });
    this.logger.log(`[PATIENT:UPDATE] Done — prescriptionId=${prescriptionId} updated=${JSON.stringify(Object.keys(updates))}`);
    const updated = await this.prescriptionModel.findOne({ id: prescriptionId }).lean<Prescription>();
    return updated ? this.addUrls(updated) : null;
  }

  async updateStatus(
    id: string,
    params: ActorContext & { status: string },
  ): Promise<{ message: string }> {
    const { role, status } = params;
    if (!status) throw AppError.validation('Status is required');

    const upperStatus = status.toUpperCase();
    if (!(VALID_STATUSES as readonly string[]).includes(upperStatus)) {
      throw AppError.validation(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean<Prescription>();
    if (!prescription) throw AppError.notFound('Prescription');

    if (role === 'PHARMACIST' && upperStatus !== 'SENT') {
      throw AppError.forbidden('Pharmacist can only mark a prescription as SENT');
    }

    this.assertPrescriptionAccess(prescription, params);
    await this.prescriptionModel.updateOne({ id: prescription.id }, { $set: { status: upperStatus } });

    if (upperStatus === 'SENT') {
      const whatsappQueueUrl = this.configService.get<string>('SQS_WHATSAPP_QUEUE_URL');
      const phone = prescription.patient_phone;

      if (!whatsappQueueUrl) {
        this.logger.warn(`[SEND:STATUS] SQS_WHATSAPP_QUEUE_URL not configured — WhatsApp skipped for prescription=${prescription.id}`);
      } else if (!prescription.video_key) {
        this.logger.warn(`[SEND:STATUS] No video_key on prescription=${prescription.id} — WhatsApp skipped`);
      } else if (!phone || phone === '0000000000') {
        this.logger.warn(`[SEND:STATUS] No valid phone on prescription=${prescription.id} — WhatsApp skipped`);
      } else {
        const bucket = this.configService.get<string>('AWS_S3_BUCKET');
        const region = this.configService.get<string>('AWS_REGION');
        const videoUrl = `https://${bucket}.s3.${region}.amazonaws.com/${prescription.video_key}`;
        const digits = phone.replace(/\D/g, '');
        const to = digits.startsWith('91') && digits.length >= 12 ? `+${digits}` : `+91${digits}`;
        try {
          await this.sqsService.sendMessage(whatsappQueueUrl, { to, videoUrl });
          this.logger.log(`[SEND:STATUS] WhatsApp queued — prescription=${prescription.id} to=${to}`);
        } catch (err) {
          // Non-fatal: status is already SENT in DB — log and continue so the API call succeeds
          this.logger.error(
            `[SEND:STATUS] Failed to enqueue WhatsApp — prescription=${prescription.id} to=${to} error=${(err as Error).message}`,
          );
        }
      }
    }

    return { message: 'Status updated' };
  }

  async removePrescription(id: string, doctorId: string): Promise<{ message: string }> {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean<Prescription>();
    if (!prescription) throw AppError.notFound('Prescription');
    if (prescription.doctor_id !== doctorId) throw AppError.forbidden();

    await this.prescriptionModel.deleteOne({ id: prescription.id });
    return { message: 'Prescription deleted' };
  }

  async getPublicPrescription(token: string): Promise<Partial<WithUrls<Prescription>>> {
    if (!token) throw AppError.badRequest('Access token is required');

    const p = await this.prescriptionModel.findOne({ access_token: token }).lean<Prescription>();
    if (!p) throw AppError.notFound('Prescription');

    const withUrls = this.addUrls(p);
    return {
      doctor_name:      p.doctor_name,
      patient_name:     p.patient_name,
      language:         p.language,
      patient_uid:      p.patient_uid,
      image_url:        withUrls.image_url,
      video_url:        withUrls.video_url,
      created_at:       p.created_at,
      interpreted_data: p.interpreted_data ?? null,
    };
  }

  async getVideoDownloadUrl(
    id: string,
    actor: ActorContext,
  ): Promise<{ url: string; filename: string }> {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean<Prescription>();
    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, actor);
    if (!prescription.video_key) throw AppError.badRequest('Video not ready yet');

    const filename = `rx-${prescription.patient_name.replace(/\s+/g, '-')}.mp4`;
    const url = await this.s3Service.getPresignedDownloadUrl(prescription.video_key, filename);
    return { url, filename };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PER-PRESCRIPTION MEDICINES
  // Stored inside interpreted_data.medicines — writes use atomic MongoDB
  // operators ($concatArrays pipeline, $pull, $[elem] arrayFilters) to
  // eliminate read-modify-write race conditions under concurrent edits.
  // ═══════════════════════════════════════════════════════════════════════

  async addMedicineToRx(
    prescriptionId: string,
    actor: ActorContext,
    body: { name: string; quantity?: string; frequency: string; course: string; description?: string; with_food?: string },
  ): Promise<ManualMedicine> {
    this.logger.log(`[MEDICINE:ADD] prescriptionId=${prescriptionId} name="${body.name}"`);

    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);

    const med: ManualMedicine = {
      id:          uuidv4(),
      name:        body.name.trim(),
      quantity:    body.quantity || '1',
      frequency:   body.frequency.trim(),
      course:      body.course.trim(),
      description: body.description?.trim() || null,
      with_food:   body.with_food?.trim() || null,
    };

    // Atomic pipeline: initialise interpreted_data if null, then append — no lost-update race
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prescriptionModel.updateOne as any)(
      { id: prescriptionId },
      [
        {
          $set: {
            interpreted_data: {
              $cond: [{ $eq: ['$interpreted_data', null] }, { medicines: [] }, '$interpreted_data'],
            },
          },
        },
        {
          $set: {
            'interpreted_data.medicines': {
              $concatArrays: [{ $ifNull: ['$interpreted_data.medicines', []] }, [med]],
            },
          },
        },
      ],
    );

    this.logger.log(`[MEDICINE:ADD] Done — medId=${med.id} name="${med.name}"`);
    return med;
  }

  async updateMedicineInRx(
    prescriptionId: string,
    medicineId: string,
    actor: ActorContext,
    body: { name?: string; quantity?: string; frequency?: string; course?: string; description?: string; with_food?: string },
  ): Promise<ManualMedicine> {
    this.logger.log(`[MEDICINE:UPDATE] prescriptionId=${prescriptionId} medicineId=${medicineId}`);
    if (Object.keys(body).length === 0) throw AppError.badRequest('No fields provided to update');

    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);

    const medicines: ManualMedicine[] = Array.isArray(
      (doc.interpreted_data as InterpretedData | null)?.medicines,
    ) ? (doc.interpreted_data as InterpretedData).medicines : [];

    const existing = medicines.find(m => m.id === medicineId);
    if (!existing) {
      this.logger.warn(`[MEDICINE:UPDATE] Medicine not found — medicineId=${medicineId}`);
      throw AppError.notFound('Medicine');
    }

    const updated: ManualMedicine = {
      ...existing,
      ...(body.name        !== undefined && { name:        body.name.trim() }),
      ...(body.quantity    !== undefined && { quantity:    body.quantity }),
      ...(body.frequency   !== undefined && { frequency:   body.frequency.trim() }),
      ...(body.course      !== undefined && { course:      body.course.trim() }),
      ...(body.description !== undefined && { description: body.description.trim() }),
      ...(body.with_food   !== undefined && { with_food:   body.with_food.trim() || null }),
    };

    // Atomic positional update — only touches the matched array element
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prescriptionModel.updateOne as any)(
      { id: prescriptionId },
      { $set: { 'interpreted_data.medicines.$[elem]': updated } },
      { arrayFilters: [{ 'elem.id': medicineId }] },
    );

    this.logger.log(`[MEDICINE:UPDATE] Done — medicineId=${medicineId} name="${updated.name}"`);
    return updated;
  }

  async deleteMedicineFromRx(
    prescriptionId: string,
    medicineId: string,
    actor: ActorContext,
  ): Promise<{ message: string }> {
    this.logger.log(`[MEDICINE:DELETE] prescriptionId=${prescriptionId} medicineId=${medicineId}`);

    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);

    const medicines: ManualMedicine[] = Array.isArray(
      (doc.interpreted_data as InterpretedData | null)?.medicines,
    ) ? (doc.interpreted_data as InterpretedData).medicines : [];

    const med = medicines.find(m => m.id === medicineId);
    if (!med) {
      this.logger.warn(`[MEDICINE:DELETE] Medicine not found — medicineId=${medicineId}`);
      throw AppError.notFound('Medicine');
    }

    // Atomic pull — no lost-update race with concurrent edits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prescriptionModel.updateOne as any)(
      { id: prescriptionId },
      { $pull: { 'interpreted_data.medicines': { id: medicineId } } },
    );

    this.logger.log(`[MEDICINE:DELETE] Done — removed "${med.name}"`);
    return { message: 'Medicine removed' };
  }

  async searchMedicines(query: string): Promise<string[]> {
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const docs = await this.medicineLibraryModel
      .find(
        { medicine_name: { $regex: escapeRegex(q), $options: 'i' } },
        { medicine_name: 1, _id: 0 },
      )
      .sort({ medicine_name: 1 })
      .limit(20)
      .lean<Pick<MedicinePrescription, 'medicine_name'>[]>();

    return docs.map(d => d.medicine_name);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MEDICINE LIBRARY
  // ═══════════════════════════════════════════════════════════════════════

  async createMedicineLibraryEntry(data: CreateMedicineLibraryDto): Promise<MedicinePrescriptionDocument> {
    return this.medicineLibraryModel.create({
      medicine_name:         data.medicine_name.trim(),
      generic_name:          data.generic_name?.trim()      || '',
      common_usage:          data.common_usage.trim(),
      drug_category:         data.drug_category.trim(),
      alternative_medicines: Array.isArray(data.alternative_medicines)
        ? data.alternative_medicines.map(s => s.trim()).filter(Boolean) : [],
      manufacturer_name:     data.manufacturer_name?.trim() || null,
      marketer_name:         data.marketer_name?.trim()     || null,
      salt_composition:      data.salt_composition?.trim()  || null,
      tablet_color:          data.tablet_color?.trim()      || null,
      appearance:            data.appearance?.trim()        || null,
    });
  }

  async listMedicineLibrary(
    query: { page?: string; limit?: string; search?: string; drug_category?: string },
  ): Promise<{ data: MedicinePrescriptionDocument[]; total: number; page: number; limit: number }> {
    const { pageNum, limitNum } = parsePagination(query.page, query.limit);
    const filter: FilterQuery<MedicinePrescriptionDocument> = {};

    if (query.search?.trim()) {
      const safe = escapeRegex(query.search.trim());
      filter.$or = [
        { medicine_name: { $regex: safe, $options: 'i' } },
        { generic_name:  { $regex: safe, $options: 'i' } },
      ];
    }
    if (query.drug_category?.trim()) {
      filter.drug_category = { $regex: escapeRegex(query.drug_category.trim()), $options: 'i' };
    }

    const skip = (pageNum - 1) * limitNum;
    const [docs, total] = await Promise.all([
      this.medicineLibraryModel.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }),
      this.medicineLibraryModel.countDocuments(filter),
    ]);
    return { data: docs, total, page: pageNum, limit: limitNum };
  }

  async getMedicineLibraryById(id: string): Promise<MedicinePrescriptionDocument> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const doc = await this.medicineLibraryModel.findById(id);
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async updateMedicineLibraryEntry(
    id: string,
    data: UpdateMedicineLibraryDto,
  ): Promise<MedicinePrescriptionDocument> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');

    const ALLOWED_KEYS = [
      'medicine_name', 'generic_name', 'common_usage', 'drug_category',
      'alternative_medicines', 'medicine_image', 'medicine_image_2', 'medicine_image_3',
      'color', 'manufacturer_name', 'marketer_name', 'salt_composition', 'tablet_color', 'appearance',
    ] as const satisfies readonly (keyof UpdateMedicineLibraryDto)[];

    const REQUIRED_KEYS = new Set<keyof UpdateMedicineLibraryDto>(['medicine_name', 'common_usage', 'drug_category']);

    const patch: Record<string, string | string[] | null> = {};

    for (const key of ALLOWED_KEYS) {
      const val = data[key];
      if (val === undefined) continue;

      if (key === 'alternative_medicines') {
        patch[key] = Array.isArray(val) ? (val as string[]).map(s => s.trim()).filter(Boolean) : [];
      } else {
        const trimmed = (val as string)?.trim() || null;
        if (trimmed === null && REQUIRED_KEYS.has(key)) throw AppError.validation(`${key} cannot be empty`);
        patch[key] = trimmed;
      }
    }

    if (!Object.keys(patch).length) throw AppError.badRequest('No valid fields provided for update');

    const doc = await this.medicineLibraryModel.findByIdAndUpdate(
      id, patch, { new: true, runValidators: true },
    );
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async updateMedicineLibraryImage(
    id: string,
    imageUrl: string,
    imageField: 'medicine_image' | 'medicine_image_2' | 'medicine_image_3' = 'medicine_image',
  ): Promise<MedicinePrescriptionDocument> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    if (!imageUrl) throw AppError.badRequest('Image URL is required');
    const doc = await this.medicineLibraryModel.findByIdAndUpdate(
      id, { [imageField]: imageUrl }, { new: true },
    );
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async removeMedicineLibraryEntry(id: string): Promise<{ message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const doc = await this.medicineLibraryModel.findByIdAndDelete(id);
    if (!doc) throw AppError.notFound('Medicine');
    return { message: 'Medicine deleted' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ORCHESTRATION — pre-signed upload flow
  //
  // Step 1: Client calls getUploadUrl() → receives a pre-signed S3 PUT URL + key.
  // Step 2: Client uploads file directly to S3 (server never sees the bytes).
  // Step 3: Client calls uploadAndCreatePrescription() with the key from step 1.
  //
  // Result: zero memory pressure on Node.js, unlimited concurrent uploads.
  // ═══════════════════════════════════════════════════════════════════════

  async getUploadUrl(params: {
    userId: string;
    orgId: string | null;
    filename: string;
    mimetype: string;
  }): Promise<{ upload_url: string; key: string; expires_in: number }> {
    await this.assertSubscriptionLimit(params.orgId);
    const { key, upload_url } = await this.s3Service.getPresignedUploadUrl(
      params.filename,
      params.mimetype,
    );
    this.logger.log(`[UPLOAD_URL] Generated — key=${key} userId=${params.userId}`);
    return { upload_url, key, expires_in: 300 };
  }

  async uploadAndCreatePrescription(params: {
    userId: string;
    userName: string;
    orgId: string | null;
    hospitalId: string | null;
    patient_name?: string;
    patient_phone?: string;
    language?: string;
    notes?: string;
    imageKey?: string | null;
  }): Promise<WithUrls<Prescription>> {
    this.logger.log(`[UPLOAD] START doctor=${params.userId} orgId=${params.orgId} patient="${params.patient_name}"`);
    await this.assertSubscriptionLimit(params.orgId);

    const prescription = await this.withRetry(
      () => this.createPrescription({
        userId:        params.userId,
        userName:      params.userName,
        orgId:         params.orgId,
        hospitalId:    params.hospitalId,
        patient_name:  params.patient_name,
        patient_phone: params.patient_phone,
        language:      params.language,
        notes:         params.notes,
        imageKey:      params.imageKey ?? null,
      }),
      'DB prescription create',
    );

    this.logger.log(`[UPLOAD] DB record created — prescriptionId=${prescription.id}`);

    if (params.imageKey) {
      try {
        await this.s3Service.verifyUpload(params.imageKey);
      } catch (err: any) {
        this.logger.warn(
          `[UPLOAD] S3 object not found after client upload — key=${params.imageKey} error=${err.message}`,
        );
      }

      const uploadQueueUrl = this.configService.get<string>('SQS_UPLOAD_QUEUE_URL');
      if (!uploadQueueUrl) {
        this.logger.warn(`[UPLOAD] SQS_UPLOAD_QUEUE_URL not set — OCR skipped prescriptionId=${prescription.id}`);
      } else {
        try {
          await this.withRetry(
            () => this.sqsService.sendMessage(uploadQueueUrl, {
              imageKey:  this.s3Service.getObjectUrl(params.imageKey!),
              patientId: prescription.patient_uid,
            }),
            'SQS OCR enqueue',
          );
          this.logger.log(`[UPLOAD] OCR queue message sent — prescriptionId=${prescription.id}`);
        } catch (sqsErr) {
          // Non-fatal — prescription is saved, OCR won't run automatically.
          // Re-queue manually or via a sweep job if needed.
          this.logger.error(
            `[UPLOAD] SQS OCR enqueue failed — prescriptionId=${prescription.id}: ${(sqsErr as Error).message}`,
          );
        }
      }
    }

    this.logger.log(`[UPLOAD] DONE prescriptionId=${prescription.id} hasImage=${!!params.imageKey}`);
    return prescription;
  }

  async uploadAndSaveMedicineImage(
    id: string,
    file: Express.Multer.File | undefined,
    field: string | undefined,
  ): Promise<MedicinePrescriptionDocument> {
    if (!file) throw AppError.badRequest('No image file provided');

    const VALID_FIELDS = ['medicine_image', 'medicine_image_2', 'medicine_image_3'] as const;
    const imageField = VALID_FIELDS.includes(field as typeof VALID_FIELDS[number])
      ? (field as typeof VALID_FIELDS[number])
      : 'medicine_image';

    const key = await this.withRetry(
      () => this.s3Service.uploadToS3(file.buffer, file.originalname, file.mimetype),
      'S3 medicine image upload',
    );
    const imageUrl = this.s3Service.getObjectUrl(key);
    return this.updateMedicineLibraryImage(id, imageUrl, imageField);
  }

  // ── Selective retry — only transient infrastructure errors ──────────────────
  //
  // Do NOT retry:
  //   • AppError           — our own business logic (400/403/404); deterministic,
  //                          will never succeed on retry
  //   • AWS 4xx (not 429)  — bad credentials, wrong bucket, invalid params; also
  //                          deterministic
  //
  // DO retry:
  //   • Network errors, ETIMEDOUT, ECONNREFUSED  — transient
  //   • AWS 429 throttling                       — back off and retry
  //   • AWS 5xx / service unavailable            — transient

  private isRetryable(err: unknown): boolean {
    if (err instanceof AppError) return false;

    const httpStatus =
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) {
      return false;
    }

    return true;
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!this.isRetryable(err)) {
          this.logger.warn(`[RETRY] ${label} — non-retryable error, failing fast`);
          throw err;
        }
        if (attempt < maxAttempts) {
          const delayMs = 300 * attempt;
          this.logger.warn(`[RETRY] ${label} attempt=${attempt}/${maxAttempts} retrying in ${delayMs}ms`);
          await new Promise<void>(r => setTimeout(r, delayMs));
        }
      }
    }
    throw lastErr;
  }
}
