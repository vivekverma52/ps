import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Coerces null → undefined so @IsOptional() skips the field cleanly. */
const AllowNull = () => Transform(({ value }) => (value === null ? undefined : value));

class MedicineEntryDto {
  // Fields added manually via the pharmacist UI
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() quantity?: string;
  @IsOptional() @IsString() frequency?: string;
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsString() description?: string;

  // Fields sent by the OCR / AI service — types vary (string | array | object | boolean | null)
  // No type validators: data goes straight to MongoDB as-is.
  @IsOptional() @AllowNull() medicine_name?: any;
  @IsOptional() @AllowNull() dosage?: any;
  @IsOptional() @AllowNull() instructions?: any;
  @IsOptional() @AllowNull() duration?: any;
  @IsOptional() @AllowNull() time_of_day?: any;
  @IsOptional() @AllowNull() with_food?: any;
  @IsOptional() @AllowNull() text?: any;
}

class InterpretedDataInnerDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicineEntryDto)
  medicines?: MedicineEntryDto[];

  @IsOptional() @IsObject() doctor_details?: Record<string, unknown>;
  @IsOptional() @IsObject() patient_details?: Record<string, unknown>;

  // OCR service extras
  @IsOptional() @IsObject() hospital_details?: Record<string, unknown>;
  @IsOptional() @IsString() raw_text_preview?: string;
}

export class SaveInterpretedDataDto {
  // Nested interpreted_data block (sent by OCR service)
  @IsOptional()
  @ValidateNested()
  @Type(() => InterpretedDataInnerDto)
  interpreted_data?: InterpretedDataInnerDto;

  // Flat medicines array (used when saving directly)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicineEntryDto)
  medicines?: MedicineEntryDto[];

  // OCR service top-level fields — types vary, no strict validation
  @IsOptional() @AllowNull() ocr_source?: any;
  @IsOptional() @AllowNull() status?: any;
  @IsOptional() @AllowNull() metadata?: any;
  @IsOptional() @AllowNull() processing_summary?: any;
}
