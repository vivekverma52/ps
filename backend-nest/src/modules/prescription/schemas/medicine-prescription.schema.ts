import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MedicinePrescriptionDocument = MedicinePrescription & Document;

@Schema({
  timestamps: true,
  collection: 'medicine_prescription',
})
export class MedicinePrescription {
  @Prop({ required: true, trim: true })
  medicine_name: string;

  @Prop({ required: true, trim: true })
  generic_name: string;

  @Prop({ default: null })
  medicine_image: string;

  @Prop({ default: null })
  medicine_image_2: string;

  @Prop({ default: null })
  medicine_image_3: string;

  @Prop({ required: true, trim: true })
  common_usage: string;

  @Prop({ type: [String], default: [] })
  alternative_medicines: string[];

  @Prop({ required: true, trim: true })
  drug_category: string;

  @Prop({ default: null, trim: true })
  color: string;

  @Prop({ default: null, trim: true })
  manufacturer_name: string;

  @Prop({ default: null, trim: true })
  marketer_name: string;

  @Prop({ default: null, trim: true })
  salt_composition: string;

  @Prop({ default: null, trim: true })
  tablet_color: string;

  @Prop({ default: null, trim: true })
  appearance: string;
}

export const MedicinePrescriptionSchema = SchemaFactory.createForClass(MedicinePrescription);
