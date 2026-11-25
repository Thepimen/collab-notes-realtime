import type { AppRole, CollaboratorPermission, DocumentContentDTO } from './domain.types';

export type DatabaseProfileRow = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export type DatabaseDocumentRow = {
  id: string;
  title: string;
  content: DocumentContentDTO;
  owner_id: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type DatabaseCollaboratorRow = {
  document_id: string;
  user_id: string;
  permission: CollaboratorPermission;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: DatabaseProfileRow;
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: DatabaseDocumentRow;
        Insert: {
          id?: string;
          title: string;
          content: DocumentContentDTO;
          owner_id: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: DocumentContentDTO;
          owner_id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_collaborators: {
        Row: DatabaseCollaboratorRow;
        Insert: {
          document_id: string;
          user_id: string;
          permission: CollaboratorPermission;
          created_at?: string;
        };
        Update: {
          document_id?: string;
          user_id?: string;
          permission?: CollaboratorPermission;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_document_occ: {
        Args: {
          p_document_id: string;
          p_title: string;
          p_content: DocumentContentDTO;
          p_expected_version: number;
        };
        Returns: Array<{
          success: boolean;
          current_version: number;
          current_title: string;
          current_content: DocumentContentDTO;
          updated_at: string;
        }>;
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
