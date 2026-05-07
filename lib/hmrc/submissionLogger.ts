import { supabaseAdmin } from "../supabaseAdmin";

interface LogInput {
  firm_id: string;
  client_id: string;
  tax_year_id: string;
  quarter_id: string;
  obligation_id: string | null;
  submission_id: string | null;
  business_type: string;
  hmrc_endpoint: string;
  hmrc_method: string;
  request_payload: any;
  response_payload: any;
  status_code: number;
  correlation_id?: string | null;
  hmrc_submission_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  attempt_number?: number;
  is_retry?: boolean;
  is_amendment?: boolean;
  created_by?: string | null;
}

export async function logHMRCSubmission(input: LogInput) {
  const { error } = await supabaseAdmin
    .from("hmrc_submission_logs")
    .insert({
      ...input,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error("HMRC submission log failed:", error);
  }
}