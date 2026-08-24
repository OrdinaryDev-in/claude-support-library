// Hand-written to match supabase/migrations/20260815025000_init.sql + 20260815025500_rls.sql,
// in the shape @supabase/postgrest-js's GenericSchema expects (each table
// needs Row/Insert/Update/Relationships; the schema needs Tables/Views/
// Functions). Once a live Supabase project is linked, regenerate with:
//   supabase gen types typescript --linked > lib/types/database.types.ts
// and re-apply this file's structure if the generator's shape differs.
//
// prompts.status/reviewed_by/reviewed_at/rejection_reason added, is_published
// removed, by 20260816090111_prompt_review_workflow.sql (prompt review workflow).
//
// `categories` table + prompts.category_id added by
// 20260824130000_categories.sql / 20260824130100_sync_prompt_category_id.sql.
// Prompts now reads/writes category_id (an admin-managed table row, not a
// fixed enum) — see lib/validation/prompt-schema.ts and app/actions/prompts.ts.
// The old `category` enum column is left in place, nullable, unwritten by
// the app going forward; sync_prompt_category_id() still derives
// category_id from it if anything else ever sets `category` directly.

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
          // Legacy column, kept nullable — the app no longer writes it (see
          // category_id below); still present on every pre-cutover row for
          // reference/rollback, and sync_prompt_category_id()
          // (20260824130100_sync_prompt_category_id.sql) still derives
          // category_id from it if some other caller ever sets it directly.
          category: PromptCategory | null;
          category_id: string;
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
          // Exactly one of these two is required at the DB level: either
          // works, since sync_prompt_category_id()
          // (20260824130100_sync_prompt_category_id.sql) derives category_id
          // from category when only the latter is given (old-style callers,
          // e.g. test/integration/prompt-review-guard.test.ts) — app write
          // paths (app/actions/prompts.ts) always set category_id directly.
          category?: PromptCategory | null;
          category_id?: string;
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
          {
            foreignKeyName: "prompts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      // Added by 20260824130000_categories.sql — shared, admin-managed
      // category taxonomy across resource types (prompts now; skills/
      // connectors reuse it via their own resource_type rows).
      categories: {
        Row: {
          id: string;
          resource_type: "prompt" | "skill" | "connector";
          key: string;
          label: string;
          color: string;
          sort_order: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_type: "prompt" | "skill" | "connector";
          key: string;
          label: string;
          color: string;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey";
            columns: ["created_by"];
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
      // Added by 20260818110500_error_logs.sql.
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
          // Added by 20260824130000_categories.sql — additive overload
          // param, sits after the original params so old callers passing
          // only p_category are unaffected.
          p_category_id?: string | null;
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
