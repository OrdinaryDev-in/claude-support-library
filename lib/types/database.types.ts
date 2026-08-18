// Hand-written to match supabase/migrations/0001_init.sql + 0002_rls.sql,
// in the shape @supabase/postgrest-js's GenericSchema expects (each table
// needs Row/Insert/Update/Relationships; the schema needs Tables/Views/
// Functions). Once a live Supabase project is linked, regenerate with:
//   supabase gen types typescript --linked > lib/types/database.types.ts
// and re-apply this file's structure if the generator's shape differs.
//
// prompts.status/reviewed_by/reviewed_at/rejection_reason added, is_published
// removed, by 0009_prompt_review_workflow.sql (prompt review workflow).

export type PromptCategory =
  | "new_app"
  | "module_feature"
  | "debugging"
  | "frontend"
  | "backend";

export type PromptStatus = "pending_review" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          avatar_url: string | null;
          role: "user" | "admin";
          created_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          avatar_url?: string | null;
          role?: "user" | "admin";
          created_at?: string;
          last_login_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      prompts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          slug: string;
          description: string;
          category: PromptCategory;
          status: PromptStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          base_instructions: string;
          fill_in_details_guidance: string;
          reference_projects_guidance: string;
          reference_links_guidance: string;
          expected_output_notes: string;
          view_count: number;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          slug: string;
          description: string;
          category: PromptCategory;
          status?: PromptStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          base_instructions: string;
          fill_in_details_guidance: string;
          reference_projects_guidance: string;
          reference_links_guidance: string;
          expected_output_notes: string;
          view_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["prompts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "prompts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompts_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: { id: string; name: string; slug: string };
        Insert: { id?: string; name: string; slug: string };
        Update: Partial<Database["public"]["Tables"]["tags"]["Insert"]>;
        Relationships: [];
      };
      prompt_tags: {
        Row: { prompt_id: string; tag_id: string };
        Insert: { prompt_id: string; tag_id: string };
        Update: Partial<Database["public"]["Tables"]["prompt_tags"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "prompt_tags_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "prompts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      // Added by 0021_error_logs.sql.
      error_logs: {
        Row: {
          id: string;
          created_at: string;
          context: string;
          message: string;
          digest: string | null;
          path: string | null;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          context: string;
          message: string;
          digest?: string | null;
          path?: string | null;
          user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["error_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_prompts: {
        Args: {
          p_category?: PromptCategory | null;
          p_tags?: string[] | null;
          p_query?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Database["public"]["Tables"]["prompts"]["Row"][];
      };
      is_admin: {
        Args: { uid: string };
        Returns: boolean;
      };
    };
  };
}
