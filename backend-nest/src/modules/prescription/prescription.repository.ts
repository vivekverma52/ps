import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prescription, PrescriptionDocument } from './schemas/prescription.schema';

@Injectable()
export class PrescriptionRepository {
  private readonly logger = new Logger(PrescriptionRepository.name);

  constructor(
    @InjectModel(Prescription.name)
    private readonly model: Model<PrescriptionDocument>,
  ) {}

  async create(data: Partial<Prescription>) {
    this.logger.debug(`[create] doctor_id=${data.doctor_id} patient=${data.patient_name}`);
    const doc = await this.model.create(data);
    return doc.toObject({ versionKey: false });
  }

  async findOne(filter: Record<string, any>) {
    this.logger.debug(`[findOne] filter=${JSON.stringify(filter)}`);
    return this.model.findOne(filter).lean();
  }

  async findMany(filter: Record<string, any>) {
    this.logger.debug(`[findMany] filter=${JSON.stringify(filter)}`);
    return this.model.find(filter).sort({ created_at: -1 }).lean();
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>) {
    this.logger.debug(`[updateOne] filter=${JSON.stringify(filter)}`);
    return this.model.updateOne(filter, update);
  }

  async deleteOne(filter: Record<string, any>) {
    this.logger.debug(`[deleteOne] filter=${JSON.stringify(filter)}`);
    return this.model.deleteOne(filter);
  }

  async countDocuments(filter: Record<string, any>): Promise<number> {
    return this.model.countDocuments(filter);
  }
}
