/**
 * database.ts — Tipos do schema Supabase.
 *
 * Este arquivo é um stub MANUAL inicial. Após aplicar as migrations no
 * Supabase, REGENERE com:
 *
 *   npx supabase gen types typescript --project-id wtovivsmvenjbuhdemzv > src/types/database.ts
 *
 * Enquanto isso, mantemos um tipo permissivo para destravar o cliente.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole =
  | 'owner'
  | 'diretor'
  | 'gerente'
  | 'engenheiro'
  | 'qualidade'
  | 'planejador'
  | 'comprador'
  | 'visualizador'

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type OrgPlan      = 'free' | 'pro' | 'team' | 'enterprise'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id:             string
          name:           string
          slug:           string
          plan:           OrgPlan
          max_users:      number
          max_projects:   number
          owner_id:       string | null
          settings:       Json
          created_at:     string
          updated_at:     string
          deleted_at:     string | null
        }
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & {
          name: string
          slug: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Row']>
      }
      profiles: {
        Row: {
          id:                string
          organization_id:   string
          full_name:         string
          email:             string
          role:              UserRole
          job_title:         string | null
          phone:             string | null
          avatar_url:        string | null
          mfa_enrolled:      boolean
          invited_by:        string | null
          activated_at:      string | null
          created_at:        string
          updated_at:        string
          deleted_at:        string | null
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id:              string
          organization_id: string
          full_name:       string
          email:           string
          role:            UserRole
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      audit_log: {
        Row: {
          id:               string
          organization_id:  string
          actor_id:         string | null
          action:           string
          table_name:       string
          record_id:        string | null
          before:           Json | null
          after:            Json | null
          ip:               string | null
          user_agent:       string | null
          created_at:       string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: never
      }
      pending_actions: {
        Row: {
          id:               string
          organization_id:  string
          requested_by:     string
          action_type:      string
          target_table:     string
          target_id:        string | null
          payload:          Json
          required_role:    UserRole
          status:           ActionStatus
          approved_by:      string | null
          approved_at:      string | null
          rejected_reason:  string | null
          expires_at:       string
          created_at:       string
        }
        Insert: Partial<Database['public']['Tables']['pending_actions']['Row']> & {
          organization_id: string
          requested_by:    string
          action_type:     string
          target_table:    string
          payload:         Json
          required_role:   UserRole
        }
        Update: Partial<Database['public']['Tables']['pending_actions']['Row']>
      }
      invitations: {
        Row: {
          id:               string
          organization_id:  string
          email:            string
          role:             UserRole
          invited_by:       string
          token:            string
          accepted_at:      string | null
          expires_at:       string
          created_at:       string
        }
        Insert: Partial<Database['public']['Tables']['invitations']['Row']> & {
          organization_id: string
          email:           string
          role:            UserRole
          invited_by:      string
          token:           string
        }
        Update: Partial<Database['public']['Tables']['invitations']['Row']>
      }
      fvs: {
        Row: {
          id:                  string
          organization_id:     string
          number:              number
          document_code:       string
          revision:            string
          identification_no:   string
          contract_no:         string
          date:                string
          nc_required:         boolean
          nc_number:           string | null
          responsible_leader:  string | null
          weld_tracking_no:    string | null
          welder_signature:    string | null
          quality_signature:   string | null
          logo_id:             string | null
          payload:             Json   // items + problems serializados (denormalizado v1)
          created_by:          string
          created_at:          string
          updated_at:          string
          deleted_at:          string | null
        }
        Insert: Partial<Database['public']['Tables']['fvs']['Row']> & {
          organization_id: string
          document_code:   string
          contract_no:     string
          date:            string
          payload:         Json
          created_by:      string
        }
        Update: Partial<Database['public']['Tables']['fvs']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: {
      user_org:                   { Args: Record<string, never>; Returns: string }
      user_role:                  { Args: Record<string, never>; Returns: UserRole }
      has_role:                   { Args: { roles: UserRole[] }; Returns: boolean }
      required_approver_for:      { Args: { action: string }; Returns: UserRole }
      request_action:             { Args: { p_action_type: string; p_target_table: string; p_target_id: string | null; p_payload: Json }; Returns: string }
      approve_pending_action:     { Args: { p_action_id: string }; Returns: void }
      reject_pending_action:      { Args: { p_action_id: string; p_reason: string }; Returns: void }
      export_organization_data:   { Args: { p_org_id: string }; Returns: Json }
      signup_with_org:            { Args: { p_org_name: string; p_full_name: string }; Returns: string }
    }
    Enums: {
      user_role:     UserRole
      action_status: ActionStatus
      org_plan:      OrgPlan
    }
  }
}
