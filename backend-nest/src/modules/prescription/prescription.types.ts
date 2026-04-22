// ── Shared actor context ──────────────────────────────────────────────────────

export interface ActorContext {
  role: string;
  userId: string;
  orgId: string | null;
  hospitalId?: string | null;
}

// ── Medicine types ────────────────────────────────────────────────────────────

/** Pharmacist-added medicine, stored in interpreted_data.medicines */
export interface ManualMedicine {
  id: string;
  name: string;
  quantity: string;
  frequency: string;
  course: string;
  description: string | null;
}

/** OCR-extracted medicine from the AI service */
export interface OcrMedicine {
  medicine_name: string;
  dosage: string | null;
  instructions: string | null;
  duration: string | null;
  time_of_day: string[] | null;
  with_food: boolean | null;
  text?: Record<string, string>;
}

// ── OCR SQS message payload ───────────────────────────────────────────────────

export interface OcrExtractedData {
  medicines?: OcrMedicine[];
  doctor_details?: {
    name?: string;
    qualifications?: string;
    contact?: string;
    clinic?: string;
  };
  hospital_details?: {
    name?: string;
    address?: string;
  };
  patient_details?: {
    name?: string;
    phone?: string;
    contact?: string;
    date?: string;
    age?: string | null;
    gender?: string | null;
  };
  raw_text_preview?: string;
  summary?: string | null;
  follow_up?: string | null;
  emergency_contact?: string | null;
}

export interface OcrResultMessage {
  imageUrl: string;
  patientId: string;
  status: string;
  processedAt: string;
  extractedData: OcrExtractedData;
  processingSummary: { medicinesFound?: number } & Record<string, unknown>;
  errorMessage: string | null;
}

// ── interpreted_data field shape ──────────────────────────────────────────────

export interface InterpretedData {
  medicines: ManualMedicine[];
  ocr_source?: boolean;
  interpreted_data?: OcrExtractedData;
  metadata?: {
    processed_at: string;
    processing_summary: Record<string, unknown>;
  };
  status?: string;
}

// ── Access-control helpers ────────────────────────────────────────────────────

/** Minimal prescription fields required for access-control checks */
export interface PrescriptionAccessFields {
  doctor_id: string;
  org_id: string | null;
  hospital_id: string | null;
}

// ── Render SQS payload ────────────────────────────────────────────────────────

export interface RenderMedicine {
  medicine_name: string;
  dosage: string | null;
  instructions: string | null;
  duration: string | null;
  time_of_day: string[] | null;
  with_food: boolean | null;
  text: Record<string, string>;
}

export interface RenderPayload {
  status: 'success';
  request_id: string;
  language: string;
  interpreted_data: {
    patient_details: {
      name: string;
      contact: string;
      date: string;
      age: string | null;
      gender: string | null;
    };
    doctor_details: {
      name: string;
      specialization: string | null;
      clinic: string | null;
      registration: string | null;
    };
    medicines: RenderMedicine[];
    summary: string | null;
    follow_up: string | null;
    emergency_contact: string | null;
  };
}
