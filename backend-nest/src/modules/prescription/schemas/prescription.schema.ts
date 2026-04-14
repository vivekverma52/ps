import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PrescriptionDocument = Prescription & Document;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'prescriptions',
})
export class Prescription {
  @Prop({ required: true, unique: true, index: true })
  id: string; // UUID — kept as string to match existing API contracts

  @Prop({ default: null, index: true })
  org_id: string | null;

  @Prop({ default: null })
  hospital_id: string | null;

  @Prop({ required: true, index: true })
  doctor_id: string;

  @Prop({ required: true })
  doctor_name: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop({ required: true })
  patient_phone: string;

  @Prop({ default: null, unique: true, sparse: true })
  patient_uid: string | null;

  @Prop({ default: null, index: true })
  image_key: string | null;

  @Prop({ default: null })
  video_key: string | null;

  @Prop({ required: true, unique: true, index: true })
  access_token: string;

  @Prop({
    type: String,
    enum: ['UPLOADED', 'CLAIMED', 'PROCESSING', 'RENDERED', 'SENT'],
    default: 'UPLOADED',
  })
  status: string;

  @Prop({ default: 'English' })
  language: string;

  @Prop({ default: null })
  notes: string | null;

  @Prop({ default: null })
  rx_year: number | null;

  @Prop({ default: null })
  rx_month: number | null;

  @Prop({ default: null })
  whatsapp_message_id: string | null;

  @Prop({ type: Object, default: null })
  interpreted_data: Record<string, any> | null;

  // Declared explicitly so TypeScript knows about them (values set by Mongoose timestamps option)
  @Prop()
  created_at: Date;

  @Prop()
  updated_at: Date;
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription);
