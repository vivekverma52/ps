/**
 * PrescriptionService — Level 3 (Medical)
 * Prescriptions stored in MongoDB · Medicine Library in MongoDB · Org limits in MySQL
 */
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'mysql2/promise';
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

const VALID_STATUSES = ['UPLOADED', 'CLAIMED', 'PROCESSING', 'RENDERED', 'SENT'];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePagination(page?: string, limit?: string): { pageNum: number; limitNum: number } {
  const pageNum  = Math.max(1, parseInt(page  || '1',  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
  return { pageNum, limitNum };
}

function generatePatientUid(orgId: string | null, hospitalId: string | null, doctorId: string, rxId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seg  = (val: string | null, fallback: string) =>
    (val ?? fallback).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${seg(orgId, 'NORG')}-${seg(hospitalId, 'NOHOSP')}-${seg(doctorId, 'NODOC')}-${seg(rxId, rxId)}-${date}`;
}

@Injectable()
export class PrescriptionService implements OnModuleInit {
  private readonly logger = new Logger(PrescriptionService.name);

  // ── Upload concurrency guard ──────────────────────────────────────────────
  // Each upload (~10MB typical) lives in Node.js heap during S3 transfer.
  // Cap at 20 simultaneous uploads (~200MB peak) — safe for a 512MB ECS task.
  // Raise to 40 if your ECS task is 1GB, 80 for 2GB.
  private activeUploads = 0;
  private readonly MAX_CONCURRENT_UPLOADS = 20;

  acquireUploadSlot(): void {
    if (this.activeUploads >= this.MAX_CONCURRENT_UPLOADS) {
      this.logger.warn(`[UPLOAD] Concurrency limit reached — activeUploads=${this.activeUploads}`);
      throw AppError.tooManyRequests('Server is busy processing uploads. Please try again in a moment.');
    }
    this.activeUploads++;
    this.logger.log(`[UPLOAD] Slot acquired — activeUploads=${this.activeUploads}`);
  }

  releaseUploadSlot(): void {
    this.activeUploads = Math.max(0, this.activeUploads - 1);
    this.logger.log(`[UPLOAD] Slot released — activeUploads=${this.activeUploads}`);
  }

  constructor(
    // MySQL pool — used only for org/plan limit checks (orgs live in MySQL)
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    // MongoDB — prescriptions
    @InjectModel(Prescription.name)
    private readonly prescriptionModel: Model<PrescriptionDocument>,
    // MongoDB — medicine library
    @InjectModel(MedicinePrescription.name)
    private readonly medicineLibraryModel: Model<MedicinePrescriptionDocument>,
    private readonly s3Service: S3Service,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  onModuleInit() {
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

  /**
   * SQS consumer — OCR result queue handler.
   *
   * Incoming shape:
   * {
   *   imageUrl: string,          // full S3 URL
   *   patientId: string,         // patient_uid (fallback lookup)
   *   status: "success" | ...,
   *   processedAt: string,
   *   extractedData: {
   *     medicines: [{ medicine_name, dosage, instructions, duration }],
   *     doctor_details: { name, qualifications, contact },
   *     hospital_details: { name, address },
   *     patient_details: { name, phone, date },
   *     raw_text_preview: string,
   *   },
   *   processingSummary: { medicinesFound, ... },
   *   errorMessage: string | null,
   * }
   */
  private async handleResultMessage(body: Record<string, unknown>): Promise<void> {
    this.logger.log(`[SQS Consumer] Received: ${JSON.stringify(body)}`);

    const { imageUrl, patientId, status, processedAt, extractedData, processingSummary, errorMessage } = body as {
      imageUrl: string;
      patientId: string;
      status: string;
      processedAt: string;
      extractedData: Record<string, any>;
      processingSummary: Record<string, any>;
      errorMessage: string | null;
    };

    if (!imageUrl) {
      this.logger.warn('[SQS Consumer] Skipping — missing imageUrl');
      return;
    }

    if (status !== 'success') {
      this.logger.warn(`[SQS Consumer] OCR status=${status} error=${errorMessage} — skipping save`);
      return;
    }

    // Extract short S3 key from full URL for DB lookup
    const urlMatch = imageUrl.match(/\.amazonaws\.com\/(.+)$/);
    const dbImageKey = urlMatch ? urlMatch[1] : null;
    this.logger.log(`[SQS Consumer] imageUrl=${imageUrl}`);
    this.logger.log(`[SQS Consumer] Extracted DB key=${dbImageKey}, patientId=${patientId}`);

    // Find prescription by image_key, fall back to patient_uid
    let prescription: any = null;
    if (dbImageKey) {
      prescription = await this.prescriptionModel.findOne({ image_key: dbImageKey }).lean();
    }
    if (!prescription && patientId) {
      prescription = await this.prescriptionModel.findOne({ patient_uid: patientId }).lean();
      if (prescription) this.logger.log(`[SQS Consumer] Matched via patient_uid fallback`);
    }
    if (!prescription) {
      this.logger.warn(`[SQS Consumer] No prescription found for image_key=${dbImageKey} or patientId=${patientId}`);
      return;
    }
    this.logger.log(`[SQS Consumer] Matched prescription id=${prescription.id}`);

    // Preserve pharmacist-added medicines, merge OCR data into interpreted_data
    const existingMedicines = prescription.interpreted_data?.medicines ?? [];

    const newInterpretedData = {
      medicines: existingMedicines,          // pharmacist-added medicines (preserved)
      ocr_source: true,                      // flag: data came from OCR
      interpreted_data: {                    // OCR extracted fields
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

    // ── Back-fill patient_name / patient_phone from OCR if still placeholders ──
    // When a doctor does a "quick upload" they leave name="Quick Upload" and
    // phone="0000000000".  OCR often extracts the real values — write them back
    // to the top-level fields so the list view and WhatsApp dispatch use real data.
    const patientDetails = extractedData?.patient_details ?? {};
    const ocrName  = (patientDetails.name    as string | undefined)?.trim();
    const ocrPhone = ((patientDetails.phone ?? patientDetails.contact) as string | undefined)?.trim();

    const topLevel: Record<string, string> = {};
    if (ocrName  && prescription.patient_name  === 'Quick Upload')  topLevel.patient_name  = ocrName;
    if (ocrPhone && prescription.patient_phone === '0000000000')    topLevel.patient_phone = ocrPhone;

    const updateDoc: Record<string, any> = { interpreted_data: newInterpretedData, ...topLevel };
    await this.prescriptionModel.updateOne(
      { id: prescription.id },
      { $set: updateDoc },
    );

    if (Object.keys(topLevel).length > 0) {
      this.logger.log(`[SQS Consumer] Patient details back-filled from OCR — ${JSON.stringify(topLevel)}`);
    }
    this.logger.log(`[SQS Consumer] OCR data saved — ${processingSummary?.medicinesFound ?? 0} medicines found`);
  }

  /**
   * SQS consumer — video-processing-receive-queue handler.
   *
   * Accepts any of these field name variants (sent by video processing service):
   *   request_id | id | prescriptionId | prescription_id
   *   video_url  | videoUrl | url | video_key | videoKey
   *   status     — optional; if present and not "success"/"completed", skipped
   */
  private async handleVideoResultMessage(body: Record<string, unknown>): Promise<void> {
    this.logger.log(`[Video Consumer] Received raw: ${JSON.stringify(body)}`);

    // ── status check (skip only hard error statuses, accept missing status) ──
    const status = (body.status as string | undefined)?.toLowerCase();
    if (status && status !== 'success' && status !== 'completed' && status !== 'done') {
      const errMsg = body.errorMessage ?? body.error ?? body.message ?? '';
      this.logger.warn(`[Video Consumer] status=${status} error=${errMsg} — skipping`);
      return;
    }

    // ── resolve prescription id (try multiple field names) ──────────────────
    const prescriptionId = (
      body.request_id ?? body.id ?? body.prescriptionId ?? body.prescription_id
    ) as string | undefined;

    if (!prescriptionId?.trim()) {
      this.logger.warn(`[Video Consumer] Cannot resolve prescription id — keys: ${Object.keys(body).join(', ')}`);
      return;
    }

    // ── resolve video url (try multiple field names) ─────────────────────────
    const rawVideoUrl = (
      body.s3_url ?? body.video_url ?? body.videoUrl ?? body.url ?? body.video_key ?? body.videoKey
    ) as string | undefined;

    if (!rawVideoUrl?.trim()) {
      this.logger.warn(`[Video Consumer] Cannot resolve video URL for id=${prescriptionId} — keys: ${Object.keys(body).join(', ')}`);
      return;
    }

    // ── find prescription ───────────────────────────────────────────────────
    const prescription = await this.prescriptionModel.findOne({ id: prescriptionId.trim() }).lean();
    if (!prescription) {
      this.logger.warn(`[Video Consumer] No prescription found for id=${prescriptionId}`);
      return;
    }

    // ── extract S3 key — prefer explicit s3_key field, then strip URL ────────
    const explicitKey = body.s3_key as string | undefined;
    let videoKey: string;
    if (explicitKey?.trim()) {
      videoKey = explicitKey.trim();
    } else {
      // Strip presigned query params and bucket hostname from full URL
      const stripped = rawVideoUrl.trim().split('?')[0];
      const urlMatch = stripped.match(/\.amazonaws\.com\/(.+)$/);
      videoKey = urlMatch ? urlMatch[1] : stripped;
    }

    await this.prescriptionModel.updateOne(
      { id: prescription.id },
      { $set: { video_key: videoKey, status: 'RENDERED' } },
    );
    this.logger.log(`[Video Consumer] Video saved — prescription=${prescription.id} key=${videoKey}`);

    // ── WhatsApp notification ─────────────────────────────────────────────────
    // Skip placeholder phones (quick-upload before OCR/manual edit fills the real number)
    const phone = prescription.patient_phone as string | undefined;
    if (phone && phone !== '0000000000') {
      try {
        const videoShareUrl = await this.s3Service.getPresignedViewUrl(videoKey);
        const waResult = await this.whatsAppService.sendVideoReady(
          phone,
          (prescription.patient_name as string | undefined) ?? 'Patient',
          videoShareUrl,
        );
        if (waResult.success) {
          this.logger.log(`[Video Consumer] WhatsApp sent to ${phone}`);
        } else {
          this.logger.warn(`[Video Consumer] WhatsApp skipped/failed — reason=${waResult.error}`);
        }
      } catch (err: any) {
        // Non-fatal — video is already saved; only WhatsApp notification failed
        this.logger.error(`[Video Consumer] WhatsApp dispatch error: ${err.message}`);
      }
    } else {
      this.logger.log(`[Video Consumer] Skipping WhatsApp — phone is placeholder or missing`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION LIMIT (org data lives in MySQL)
  // ═══════════════════════════════════════════════════════════════════════

  async assertSubscriptionLimit(orgId: string | null) {
    if (!orgId) return;
    const [orgRows]: any = await this.pool.execute(
      'SELECT * FROM organizations WHERE id = ?', [orgId],
    );
    const org = orgRows[0];
    if (!org || org.plan === 'ENTERPRISE' || org.plan === 'ENT') return;

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
        403, 'LIMIT_EXCEEDED',
      );
      (err as any).current = count;
      (err as any).limit   = org.prescription_limit;
      (err as any).plan    = org.plan;
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private withUrls(doc: any): any {
    if (!doc) return doc;
    return {
      ...doc,
      image_url: doc.image_key ? this.s3Service.getObjectUrl(doc.image_key) : null,
      video_url: doc.video_key ? this.s3Service.getObjectUrl(doc.video_key) : null,
    };
  }

  private toPlain(doc: any): any {
    if (!doc) return doc;
    const obj = doc.toObject ? doc.toObject({ versionKey: false }) : { ...doc };
    // Expose string id, remove mongo _id
    if (obj._id) {
      delete obj._id;
    }
    return obj;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRESCRIPTIONS — MongoDB
  // ═══════════════════════════════════════════════════════════════════════

  async createPrescription(params: {
    userId: string; userName: string; orgId: string | null; hospitalId: string | null;
    patient_name?: string; patient_phone?: string;
    language?: string; notes?: string; imageKey?: string | null;
  }) {
    const { userId, userName, orgId, hospitalId, language, notes, imageKey } = params;
    // Quick-upload flow sends no patient details — use placeholder so pharmacist/OCR can fill later
    const patient_name  = params.patient_name?.trim()  || 'Quick Upload';
    const patient_phone = params.patient_phone?.trim() || '0000000000';

    const id           = uuidv4();
    const access_token = crypto.randomBytes(32).toString('hex'); // 256-bit token
    const patient_uid  = generatePatientUid(orgId, hospitalId, userId, id);

    const created = await this.prescriptionModel.create({
      id,
      doctor_id:    userId,
      doctor_name:  userName,
      org_id:       orgId   ?? null,
      hospital_id:  hospitalId ?? null,
      patient_name: patient_name.trim(),
      patient_phone: patient_phone.trim(),
      language:     language || 'English',
      image_key:    imageKey ?? null,
      access_token,
      notes:        notes?.trim() || null,
      patient_uid,
    });

    return this.withUrls(this.toPlain(created));
  }

  async listPrescriptions(params: {
    role: string; userId: string; orgId: string | null; hospitalId?: string | null;
    page?: string; limit?: string; search?: string; status?: string;
  }) {
    const { role, userId, orgId, hospitalId } = params;
    const { pageNum, limitNum } = parsePagination(params.page, params.limit);

    let filter: any = {};
    if (role === 'DOCTOR')           filter = { doctor_id: userId };
    else if (role === 'PHARMACIST')  filter = hospitalId ? { hospital_id: hospitalId } : (orgId ? { org_id: orgId } : {});
    else if (orgId)                  filter = { org_id: orgId };

    if (params.search?.trim()) {
      const safe = escapeRegex(params.search.trim());
      filter.$or = [
        { patient_name:  { $regex: safe, $options: 'i' } },
        { patient_phone: { $regex: safe, $options: 'i' } },
        { doctor_name:   { $regex: safe, $options: 'i' } },
      ];
    }
    if (params.status?.trim()) {
      filter.status = params.status.trim();
    }

    const skip = (pageNum - 1) * limitNum;
    const [docs, total] = await Promise.all([
      this.prescriptionModel.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
      this.prescriptionModel.countDocuments(filter),
    ]);

    return { data: docs.map((d) => this.withUrls(d)), total, page: pageNum, limit: limitNum };
  }

  async getPrescriptionById(id: string, params: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }) {
    if (!id) throw AppError.badRequest('Prescription ID is required');

    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean();

    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, params);

    return this.withUrls(prescription);
  }

  async saveInterpretedData(id: string, data: any, actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }) {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] }).lean();
    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, actor);

    await this.prescriptionModel.updateOne({ id: prescription.id }, { $set: { interpreted_data: data } });
    return { message: 'Interpreted data saved' };
  }

  async updateRender(id: string, actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }, video_url?: string) {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean();
    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, actor);

    let videoKey: string | null = null;
    if (video_url?.trim()) {
      const trimmed = video_url.trim();
      const match   = trimmed.match(/\.amazonaws\.com\/(.+)$/);
      videoKey      = match ? match[1] : trimmed;
    }

    await this.prescriptionModel.updateOne(
      { id: prescription.id },
      { $set: { video_key: videoKey, status: 'RENDERED' } },
    );

    // ── Build render payload and send to render queue ─────────────────────
    const renderQueueUrl = this.configService.get<string>('SQS_RENDER_QUEUE_URL');

    const ocr            = (prescription.interpreted_data as any)?.interpreted_data ?? {};
    const ocrMedicines: any[]    = ocr.medicines ?? [];
    const manualMedicines: any[] = (prescription.interpreted_data as any)?.medicines ?? [];

    this.logger.log(
      `[RENDER] prescriptionId=${prescription.id}` +
      ` interpreted_data_exists=${!!prescription.interpreted_data}` +
      ` ocr_source=${!!(prescription.interpreted_data as any)?.ocr_source}` +
      ` ocrMedicines=${ocrMedicines.length}` +
      ` manualMedicines=${manualMedicines.length}`,
    );

    // Convert manual medicines (pharmacist-added) to OCR payload format
    const manualAsOcr = manualMedicines.map((m: any) => ({
      medicine_name: m.name,
      dosage:        m.quantity ? `${m.quantity} tablet(s)` : null,
      instructions:  [m.frequency, m.description].filter(Boolean).join(' — ') || null,
      duration:      m.course ?? null,
      time_of_day:   m.frequency ? m.frequency.split(', ') : null,
      with_food:     null,
      text:          { en: m.name },
    }));

    // Merge: OCR medicines first, then manual ones
    const allMedicines = [...ocrMedicines, ...manualAsOcr];

    if (allMedicines.length === 0) {
      this.logger.warn(`[RENDER] WARNING — zero medicines in render payload for prescription=${prescription.id}. Render may produce empty video.`);
    } else {
      this.logger.log(`[RENDER] Total medicines in payload=${allMedicines.length} (ocr=${ocrMedicines.length} manual=${manualMedicines.length})`);
      allMedicines.forEach((m, i) => {
        this.logger.log(`[RENDER]   [${i + 1}] name="${m.medicine_name}" dosage="${m.dosage}" duration="${m.duration}" time_of_day="${JSON.stringify(m.time_of_day)}"`);
      });
    }

    if (renderQueueUrl) {
      const payload = {
        status:     'success',
        request_id: prescription.id,
        language:   prescription.language ?? 'en',
        interpreted_data: {
          patient_details: {
            name:    prescription.patient_name,
            contact: prescription.patient_phone,
            date:    new Date(prescription.created_at).toISOString().slice(0, 10),
            age:     ocr.patient_details?.age    ?? null,
            gender:  ocr.patient_details?.gender ?? null,
          },
          doctor_details: {
            name:           prescription.doctor_name,
            specialization: ocr.doctor_details?.qualifications ?? null,
            clinic:         (ocr.hospital_details?.name ?? ocr.doctor_details?.clinic) ?? null,
            registration:   ocr.doctor_details?.contact ?? null,
          },
          medicines: allMedicines.map((m: any) => ({
            medicine_name: m.medicine_name,
            dosage:        m.dosage        ?? null,
            instructions:  m.instructions  ?? null,
            duration:      m.duration      ?? null,
            time_of_day:   m.time_of_day   ?? null,
            with_food:     m.with_food     ?? null,
            text:          m.text          ?? { en: m.medicine_name },
          })),
          summary:           ocr.summary           ?? null,
          follow_up:         ocr.follow_up         ?? null,
          emergency_contact: ocr.emergency_contact ?? null,
        },
      };

      this.logger.log(`[RENDER] Sending SQS payload to queue=${renderQueueUrl} prescriptionId=${prescription.id} totalMedicines=${allMedicines.length}`);
      await this.sqsService.sendMessage(renderQueueUrl, payload);
      this.logger.log(`[RENDER] SQS message enqueued successfully prescriptionId=${prescription.id}`);
    } else {
      this.logger.warn('[RENDER] SQS_RENDER_QUEUE_URL not set — skipping render queue send');
    }

    const updated = await this.prescriptionModel.findOne({ id: prescription.id }).lean();
    return this.withUrls(updated);
  }

  async updatePatientDetails(prescriptionId: string, actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }, body: { patient_name?: string; patient_phone?: string }) {
    this.logger.log(`[PATIENT:UPDATE] prescriptionId=${prescriptionId} orgId=${actor.orgId} hospitalId=${actor.hospitalId}`);
    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);

    const updates: Record<string, string> = {};
    if (body.patient_name?.trim())  updates.patient_name  = body.patient_name.trim();
    if (body.patient_phone?.trim()) updates.patient_phone = body.patient_phone.trim();
    if (Object.keys(updates).length === 0) throw AppError.badRequest('No fields to update');

    await this.prescriptionModel.updateOne({ id: prescriptionId }, { $set: updates });
    this.logger.log(`[PATIENT:UPDATE] Done — prescriptionId=${prescriptionId} updated=${JSON.stringify(updates)}`);
    const updated = await this.prescriptionModel.findOne({ id: prescriptionId }).lean();
    return this.withUrls(updated);
  }

  async updateStatus(id: string, params: { userId: string; role: string; orgId: string | null; hospitalId?: string | null; status: string }) {
    const { role, status } = params;
    if (!status) throw AppError.validation('Status is required');

    const upperStatus = status.toUpperCase();
    if (!VALID_STATUSES.includes(upperStatus))
      throw AppError.validation(`Status must be one of: ${VALID_STATUSES.join(', ')}`);

    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean();
    if (!prescription) throw AppError.notFound('Prescription');

    if (role === 'PHARMACIST' && upperStatus !== 'SENT')
      throw AppError.forbidden('Pharmacist can only mark a prescription as SENT');

    this.assertPrescriptionAccess(prescription, params);

    await this.prescriptionModel.updateOne({ id: prescription.id }, { $set: { status: upperStatus } });
    return { message: 'Status updated' };
  }

  async removePrescription(id: string, doctorId: string) {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean();
    if (!prescription) throw AppError.notFound('Prescription');
    if (prescription.doctor_id !== doctorId) throw AppError.forbidden();

    await this.prescriptionModel.deleteOne({ id: prescription.id });
    return { message: 'Prescription deleted' };
  }

  async getPublicPrescription(token: string) {
    if (!token) throw AppError.badRequest('Access token is required');

    const p = await this.prescriptionModel.findOne({ access_token: token }).lean();
    if (!p) throw AppError.notFound('Prescription');

    const withUrls = this.withUrls(p);
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

  async getVideoDownloadUrl(id: string, params: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }) {
    const prescription = await this.prescriptionModel
      .findOne({ $or: [{ id }, { access_token: id }] })
      .lean();
    if (!prescription) throw AppError.notFound('Prescription');
    this.assertPrescriptionAccess(prescription, params);
    if (!prescription.video_key) throw AppError.badRequest('Video not ready yet');

    const filename = `rx-${prescription.patient_name.replace(/\s+/g, '-')}.mp4`;
    const url = await this.s3Service.getPresignedDownloadUrl(prescription.video_key, filename);
    return { url, filename };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PER-PRESCRIPTION MEDICINES (stored inside interpreted_data.medicines)
  // ═══════════════════════════════════════════════════════════════════════

  private async getPrescriptionRaw(id: string) {
    const doc = await this.prescriptionModel.findOne({ id }).lean();
    if (!doc) throw AppError.notFound('Prescription');
    return doc;
  }

  /**
   * Central access-control check for every prescription mutation/read.
   *
   * Rules:
   *  DOCTOR      — must own the prescription (doctor_id match)
   *  PHARMACIST  — if the JWT carries a hospitalId, the prescription must
   *                belong to that hospital.  Hospital A pharmacist can NEVER
   *                touch Hospital B prescriptions, even within the same org.
   *                Org-level pharmacists (no hospitalId) fall back to org check.
   *  Everything  — org_id must match (catches ORG_ADMIN, HOSPITAL_ADMIN, etc.)
   */
  private assertPrescriptionAccess(
    doc: any,
    actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null },
  ): void {
    if (actor.role === 'DOCTOR') {
      if (doc.doctor_id !== actor.userId) throw AppError.forbidden();
      return;
    }

    if (actor.role === 'PHARMACIST') {
      if (actor.hospitalId) {
        // Hospital-scoped pharmacist — strict hospital match
        if (doc.hospital_id !== actor.hospitalId) throw AppError.forbidden();
      } else {
        // Org-level pharmacist — org match
        if (actor.orgId && doc.org_id !== actor.orgId) throw AppError.forbidden();
      }
      return;
    }

    // ORG_ADMIN, HOSPITAL_ADMIN and any other role — org-level check
    if (actor.orgId && doc.org_id !== actor.orgId) throw AppError.forbidden();
  }

  async addMedicineToRx(prescriptionId: string, actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }, body: { name: string; quantity?: string; frequency: string; course: string; description?: string }) {
    this.logger.log(`[MEDICINE:ADD] prescriptionId=${prescriptionId} orgId=${actor.orgId} hospitalId=${actor.hospitalId} name="${body.name}"`);
    if (!body.name?.trim() || !body.frequency?.trim() || !body.course?.trim())
      throw AppError.badRequest('name, frequency and course are required');

    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);

    const hasInterpretedData = !!doc.interpreted_data;
    this.logger.log(`[MEDICINE:ADD] interpreted_data exists=${hasInterpretedData} prescriptionId=${prescriptionId}`);

    const medicines: any[] = Array.isArray(doc.interpreted_data?.medicines)
      ? doc.interpreted_data.medicines : [];

    const med = {
      id:          uuidv4(),
      name:        body.name.trim(),
      quantity:    body.quantity || '1',
      frequency:   body.frequency.trim(),
      course:      body.course.trim(),
      description: body.description?.trim() || null,
    };
    medicines.push(med);

    // interpreted_data may be null when OCR never ran — dot-notation $set fails on null,
    // so initialize the whole object in that case.
    const update = hasInterpretedData
      ? { $set: { 'interpreted_data.medicines': medicines } }
      : { $set: { interpreted_data: { medicines } } };
    await this.prescriptionModel.updateOne({ id: prescriptionId }, update);
    this.logger.log(`[MEDICINE:ADD] Done — medId=${med.id} name="${med.name}" totalMeds=${medicines.length}`);
    return med;
  }

  async updateMedicineInRx(prescriptionId: string, medicineId: string, actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }, body: { name?: string; quantity?: string; frequency?: string; course?: string; description?: string }) {
    this.logger.log(`[MEDICINE:UPDATE] prescriptionId=${prescriptionId} medicineId=${medicineId} orgId=${actor.orgId} hospitalId=${actor.hospitalId}`);
    if (Object.keys(body).length === 0) throw AppError.badRequest('No fields provided to update');

    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);
    const medicines: any[] = Array.isArray(doc.interpreted_data?.medicines)
      ? doc.interpreted_data.medicines : [];

    const idx = medicines.findIndex((m: any) => m.id === medicineId);
    if (idx === -1) {
      this.logger.warn(`[MEDICINE:UPDATE] Medicine not found — medicineId=${medicineId} prescriptionId=${prescriptionId}`);
      throw AppError.notFound('Medicine');
    }

    medicines[idx] = {
      ...medicines[idx],
      ...(body.name        !== undefined && { name:        body.name.trim() }),
      ...(body.quantity    !== undefined && { quantity:    body.quantity }),
      ...(body.frequency   !== undefined && { frequency:   body.frequency.trim() }),
      ...(body.course      !== undefined && { course:      body.course.trim() }),
      ...(body.description !== undefined && { description: body.description.trim() }),
    };

    const updateU = doc.interpreted_data
      ? { $set: { 'interpreted_data.medicines': medicines } }
      : { $set: { interpreted_data: { medicines } } };
    await this.prescriptionModel.updateOne({ id: prescriptionId }, updateU);
    this.logger.log(`[MEDICINE:UPDATE] Done — medicineId=${medicineId} name="${medicines[idx].name}"`);
    return medicines[idx];
  }

  async deleteMedicineFromRx(prescriptionId: string, medicineId: string, actor: { role: string; userId: string; orgId: string | null; hospitalId?: string | null }) {
    this.logger.log(`[MEDICINE:DELETE] prescriptionId=${prescriptionId} medicineId=${medicineId} orgId=${actor.orgId} hospitalId=${actor.hospitalId}`);
    const doc = await this.getPrescriptionRaw(prescriptionId);
    this.assertPrescriptionAccess(doc, actor);
    const medicines: any[] = Array.isArray(doc.interpreted_data?.medicines)
      ? doc.interpreted_data.medicines : [];

    const idx = medicines.findIndex((m: any) => m.id === medicineId);
    if (idx === -1) {
      this.logger.warn(`[MEDICINE:DELETE] Medicine not found — medicineId=${medicineId} prescriptionId=${prescriptionId}`);
      throw AppError.notFound('Medicine');
    }
    const removedName = medicines[idx].name;
    medicines.splice(idx, 1);

    const updateD = doc.interpreted_data
      ? { $set: { 'interpreted_data.medicines': medicines } }
      : { $set: { interpreted_data: { medicines } } };
    await this.prescriptionModel.updateOne({ id: prescriptionId }, updateD);
    this.logger.log(`[MEDICINE:DELETE] Done — removed "${removedName}" remainingMeds=${medicines.length}`);
    return { message: 'Medicine removed' };
  }

  async searchMedicines(query: string): Promise<string[]> {
    const q = (query || '').trim();

    // Empty query → return first 20 medicines alphabetically (for initial dropdown load)
    const filter = q.length > 0
      ? { medicine_name: { $regex: escapeRegex(q), $options: 'i' } }
      : {};

    this.logger.log(`[MEDICINE:SEARCH] query="${q}" filter=${q.length > 0 ? 'regex' : 'all'}`);

    const docs = await this.medicineLibraryModel
      .find(filter, { medicine_name: 1, _id: 0 })
      .sort({ medicine_name: 1 })
      .limit(20)
      .lean();

    const results = docs.map((d: any) => d.medicine_name);
    this.logger.log(`[MEDICINE:SEARCH] query="${q}" results=${results.length}`);
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MEDICINE LIBRARY (MongoDB)
  // ═══════════════════════════════════════════════════════════════════════

  async createMedicineLibraryEntry(data: any) {
    const { medicine_name, common_usage, drug_category } = data;
    if (!medicine_name || !common_usage || !drug_category)
      throw AppError.badRequest('medicine_name, common_usage and drug_category are required');

    return this.medicineLibraryModel.create({
      medicine_name:         data.medicine_name.trim(),
      generic_name:          data.generic_name?.trim() || '',
      common_usage:          data.common_usage.trim(),
      drug_category:         data.drug_category.trim(),
      alternative_medicines: Array.isArray(data.alternative_medicines)
        ? data.alternative_medicines.map((s: string) => s.trim()).filter(Boolean) : [],
      manufacturer_name:     data.manufacturer_name?.trim() || null,
      marketer_name:         data.marketer_name?.trim()     || null,
      salt_composition:      data.salt_composition?.trim()  || null,
      tablet_color:          data.tablet_color?.trim()      || null,
      appearance:            data.appearance?.trim()        || null,
    });
  }

  async listMedicineLibrary(query: { page?: string; limit?: string; search?: string; drug_category?: string }) {
    const { pageNum, limitNum } = parsePagination(query.page, query.limit);
    const filter: any = {};
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

  async getMedicineLibraryById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const doc = await this.medicineLibraryModel.findById(id);
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async updateMedicineLibraryEntry(id: string, data: any) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const allowed = [
      'medicine_name', 'generic_name', 'common_usage', 'drug_category',
      'alternative_medicines', 'medicine_image', 'medicine_image_2', 'medicine_image_3',
      'color', 'manufacturer_name', 'marketer_name', 'salt_composition', 'tablet_color', 'appearance',
    ];
    const required = ['medicine_name', 'common_usage', 'drug_category'];
    const patch: any = {};
    for (const key of allowed) {
      if (data[key] === undefined) continue;
      if (key === 'alternative_medicines') {
        patch[key] = Array.isArray(data[key])
          ? data[key].map((s: string) => s.trim()).filter(Boolean) : [];
      } else {
        const trimmed = data[key]?.trim() || null;
        if (trimmed === null && required.includes(key))
          throw AppError.validation(`${key} cannot be empty`);
        patch[key] = trimmed;
      }
    }
    if (!Object.keys(patch).length) throw AppError.badRequest('No valid fields provided for update');
    const doc = await this.medicineLibraryModel.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async updateMedicineLibraryImage(id: string, imageUrl: string, imageField: 'medicine_image' | 'medicine_image_2' | 'medicine_image_3' = 'medicine_image') {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    if (!imageUrl) throw AppError.badRequest('Image URL is required');
    const allowed = ['medicine_image', 'medicine_image_2', 'medicine_image_3'];
    if (!allowed.includes(imageField)) throw AppError.badRequest('Invalid image field');
    const doc = await this.medicineLibraryModel.findByIdAndUpdate(id, { [imageField]: imageUrl }, { new: true });
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async removeMedicineLibraryEntry(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const doc = await this.medicineLibraryModel.findByIdAndDelete(id);
    if (!doc) throw AppError.notFound('Medicine');
    return { message: 'Medicine deleted' };
  }
}
