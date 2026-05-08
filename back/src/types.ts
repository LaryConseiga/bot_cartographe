export type Profile = {
  id: string; // auth.users.id
  full_name: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  field_of_study: string | null;
  school: string | null;
  graduation_year: number | null;
  target_role: string | null;
  target_country: string | null;
  target_sector: string | null;
  willing_to_relocate: boolean | null;
  preferred_lang: string | null;
  cv_text?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ChatSession = {
  id: string;
  student_id: string;
  session_ref: string;
  started_at: string;
  last_active: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

