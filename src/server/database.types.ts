
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "landing_reviews": {
              Row: { id: string; position: number; author: string; body: string; image: Json; image_path: string | null }
              Insert: { id?: string; position?: never; author: string; body: string; image: Json; image_path?: string | null }
              Update: { id?: string; position?: never; author?: string; body?: string; image?: Json; image_path?: string | null }
              Relationships: []
            },
            "chapters": {
                  Row: {
                    "active": boolean,"id": string,"position": number,"product_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id": string,"position": number,"product_id": string,"title": string
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"position"?: number,"product_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapters_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_course_assets": {
                  Row: { "checksum": string,"content_type": string,"created_at": string,"height": number | null,"id": string,"name": string,"owner_id": string,"path": string,"size_bytes": number,"slot": string,"width": number | null }
                  ComputedFields: never
                  Insert: { "checksum": string,"content_type": string,"created_at"?: string,"height"?: number | null,"id"?: string,"name": string,"owner_id": string,"path": string,"size_bytes": number,"slot": string,"width"?: number | null }
                  Update: { "checksum"?: string,"content_type"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"name"?: string,"owner_id"?: string,"path"?: string,"size_bytes"?: number,"slot"?: string,"width"?: number | null }
                  Relationships: []
                },"course_drafts": {
                  Row: { "course_id": string | null,"document": Json,"id": string,"owner_id": string,"published": boolean,"revision": number,"saved_at": string,"slug": string | null }
                  ComputedFields: never
                  Insert: { "course_id"?: string | null,"document": Json,"id"?: string,"owner_id": string,"published"?: boolean,"revision"?: number,"saved_at"?: string,"slug"?: string | null }
                  Update: { "course_id"?: string | null,"document"?: Json,"id"?: string,"owner_id"?: string,"published"?: boolean,"revision"?: number,"saved_at"?: string,"slug"?: string | null }
                  Relationships: []
                },"product_assets": {
                  Row: { "asset_id": string,"position": number,"product_id": string,"role": string }
                  ComputedFields: never
                  Insert: { "asset_id": string,"position"?: number,"product_id": string,"role": string }
                  Update: { "asset_id"?: string,"position"?: number,"product_id"?: string,"role"?: string }
                  Relationships: []
                },"verified_videos": {
                  Row: { "duration_seconds": number,"embed_url": string,"owner_id": string,"url": string,"verified_at": string }
                  ComputedFields: never
                  Insert: { "duration_seconds": number,"embed_url": string,"owner_id": string,"url": string,"verified_at"?: string }
                  Update: { "duration_seconds"?: number,"embed_url"?: string,"owner_id"?: string,"url"?: string,"verified_at"?: string }
                  Relationships: []
                },"consent_events": {
                  Row: {
                    "accepted": boolean,"created_at": string,"id": number,"kind": string,"user_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted": boolean,"created_at"?: string,"id"?: never,"kind": string,"user_id": string,"version"?: string
                  }
                  Update: {
                    "accepted"?: boolean,"created_at"?: string,"id"?: never,"kind"?: string,"user_id"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"download_events": {
                  Row: {
                    "created_at": string,"id": string,"order_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"order_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"order_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "download_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlements": {
                  Row: {
                    "expires_at": string,"hidden": boolean,"id": string,"order_id": string,"product_id": string,"revoked": boolean,"starts_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"hidden"?: boolean,"id"?: string,"order_id": string,"product_id": string,"revoked"?: boolean,"starts_at": string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"hidden"?: boolean,"id"?: string,"order_id"?: string,"product_id"?: string,"revoked"?: boolean,"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlements_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed": boolean,"lesson_id": string,"order_id": string,"position": number,"updated_at": string,"user_id": string,"watched": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "completed"?: boolean,"lesson_id": string,"order_id": string,"position"?: number,"updated_at"?: string,"user_id": string,"watched"?: unknown
                  }
                  Update: {
                    "completed"?: boolean,"lesson_id"?: string,"order_id"?: string,"position"?: number,"updated_at"?: string,"user_id"?: string,"watched"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "active": boolean,"chapter_id": string,"duration_seconds": number,"id": string,"position": number,"preview": boolean,"product_id": string,"title": string,"vimeo_id": string | null,"vimeo_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"chapter_id": string,"duration_seconds": number,"id": string,"position": number,"preview"?: boolean,"product_id": string,"title": string,"vimeo_id"?: string | null,"vimeo_url"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"chapter_id"?: string,"duration_seconds"?: number,"id"?: string,"position"?: number,"preview"?: boolean,"product_id"?: string,"title"?: string,"vimeo_id"?: string | null,"vimeo_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_same_product"
      columns: ["chapter_id","product_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id","product_id"]
    },{
      foreignKeyName: "lessons_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"nicepay_attempts": {
                  Row: {
                    "auth_token_hash": string | null,"claimed_at": string | null,"environment": string,"id": string,"order_id": string,"status": string,"tid": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_token_hash"?: string | null,"claimed_at"?: string | null,"environment": string,"id"?: string,"order_id": string,"status"?: string,"tid"?: string | null
                  }
                  Update: {
                    "auth_token_hash"?: string | null,"claimed_at"?: string | null,"environment"?: string,"id"?: string,"order_id"?: string,"status"?: string,"tid"?: string | null
                  }
                  Relationships: [{
                    foreignKeyName: "nicepay_attempts_order_id_fkey"
                    columns: ["order_id"]
                    isOneToOne: false
                    referencedRelation: "orders"
                    referencedColumns: ["id"]
                  }]
                },"order_lessons": {
                  Row: {
                    "duration_seconds": number,"lesson_id": string,"order_id": string,"preview": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_seconds": number,"lesson_id": string,"order_id": string,"preview": boolean,"user_id": string
                  }
                  Update: {
                    "duration_seconds"?: number,"lesson_id"?: string,"order_id"?: string,"preview"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_lessons_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_lessons_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"kind": string,"paid_at": string | null,"payment_key": string | null,"policy_version": string,"product_id": string,"request_key": string,"status": string,"title": string,"total_paid_seconds": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"kind": string,"paid_at"?: string | null,"payment_key"?: string | null,"policy_version"?: string,"product_id": string,"request_key": string,"status"?: string,"title": string,"total_paid_seconds": number,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"kind"?: string,"paid_at"?: string | null,"payment_key"?: string | null,"policy_version"?: string,"product_id"?: string,"request_key"?: string,"status"?: string,"title"?: string,"total_paid_seconds"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"playback_sessions": {
                  Row: {
                    "expires_at": string,"id": string,"last_seen": string,"lesson_id": string,"order_id": string,"position": number,"sequence": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: string,"id"?: string,"last_seen"?: string,"lesson_id": string,"order_id": string,"position"?: number,"sequence"?: number,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"id"?: string,"last_seen"?: string,"lesson_id"?: string,"order_id"?: string,"position"?: number,"sequence"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playback_sessions_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playback_sessions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "base_price": number | null,"id": string,"image": string,"kind": string,"license_days": number,"pdf_path": string | null,"poster": string,"price": number,"published_at": string,"selling": boolean,"slug": string,"tags": (string)[],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_price"?: number | null,"id": string,"image": string,"kind": string,"license_days"?: number,"pdf_path"?: string | null,"poster"?: string,"price": number,"published_at"?: string,"selling"?: boolean,"slug": string,"tags"?: (string)[],"title": string
                  }
                  Update: {
                    "base_price"?: number | null,"id"?: string,"image"?: string,"kind"?: string,"license_days"?: number,"pdf_path"?: string | null,"poster"?: string,"price"?: number,"published_at"?: string,"selling"?: boolean,"slug"?: string,"tags"?: (string)[],"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "birthday": string,"image_path": string,"marketing": boolean,"name": string,"phone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday": string,"image_path"?: string,"marketing"?: boolean,"name": string,"phone": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "birthday"?: string,"image_path"?: string,"marketing"?: boolean,"name"?: string,"phone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"completed_at": string | null,"nicepay_cancel_started": boolean,"nicepay_cancel_tid": string | null,"order_id": string,"reason": string | null,"request_key": string,"requested_at": string,"status": string,"used_seconds": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"completed_at"?: string | null,"nicepay_cancel_started"?: boolean,"nicepay_cancel_tid"?: string | null,"order_id": string,"reason"?: string | null,"request_key": string,"requested_at"?: string,"status": string,"used_seconds": number,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"completed_at"?: string | null,"nicepay_cancel_started"?: boolean,"nicepay_cancel_tid"?: string | null,"order_id"?: string,"reason"?: string | null,"request_key"?: string,"requested_at"?: string,"status"?: string,"used_seconds"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"request_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count": number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "author": string,"body": string,"created_at": string,"id": string,"product_id": string,"rating": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author": string,"body": string,"created_at"?: string,"id"?: string,"product_id": string,"rating": number
                  }
                  Update: {
                    "author"?: string,"body"?: string,"created_at"?: string,"id"?: string,"product_id"?: string,"rating"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "role": string,"user_id": string
                  }
                  Update: {
                    "role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "publish_course_draft":
{ Args: { "p_draft": string,"p_owner": string,"p_revision": number }; Returns: { "course_id": string,"slug": string }[]
                           },
"save_course_draft":
{ Args: { "p_document": Json,"p_draft": string,"p_owner": string,"p_revision": number }; Returns: {
              "course_id": string | null,
"document": Json,
"id": string,
"owner_id": string,
"published": boolean,
"revision": number,
"saved_at": string,
"slug": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "course_drafts"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_nicepay_payment":
{ Args: { "p_amount": number,"p_attempt": string,"p_paid": string,"p_tid": string }; Returns: boolean },
"create_nicepay_attempt":
{ Args: { "p_environment": string,"p_key": string,"p_product": string,"p_user": string }; Returns: { "amount": number,"attempt_id": string,"title": string }[] },
            "complete_payment":
{ Args: { "p_amount": number,"p_order": string,"p_paid": string,"p_payment": string }; Returns: undefined
                           },
"complete_refund":
{ Args: { "p_amount": number,"p_order": string }; Returns: undefined
                           },
"consume_limit":
{ Args: { "p_key": string,"p_limit": number,"p_seconds": number }; Returns: boolean
                           },
"create_order":
{ Args: { "p_key": string,"p_product": string,"p_user": string }; Returns: {
              "amount": number,
"created_at": string,
"id": string,
"kind": string,
"paid_at": string | null,
"payment_key": string | null,
"policy_version": string,
"product_id": string,
"request_key": string,
"status": string,
"title": string,
"total_paid_seconds": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"external_cancellation":
{ Args: { "p_amount": number,"p_order": string }; Returns: undefined
                           },
"prepare_payment":
{ Args: { "p_order": string,"p_payment": string,"p_user": string }; Returns: {
              "amount": number,
"created_at": string,
"id": string,
"kind": string,
"paid_at": string | null,
"payment_key": string | null,
"policy_version": string,
"product_id": string,
"request_key": string,
"status": string,
"title": string,
"total_paid_seconds": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"prepare_refund":
{ Args: { "p_amount": number,"p_expires": string,"p_key": string,"p_order": string,"p_used": number,"p_user": string }; Returns: {
              "amount": number,
"completed_at": string | null,
"nicepay_cancel_started": boolean,
"nicepay_cancel_tid": string | null,
"order_id": string,
"reason": string | null,
"request_key": string,
"requested_at": string,
"status": string,
"used_seconds": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "refunds"
        isOneToOne: true
        isSetofReturn: false
      } },
"withdrawal_ready":
{ Args: Record<string, never>; Returns: boolean },
"order_download":
{ Args: { "p_order": string,"p_user": string }; Returns: Json },
"record_download":
{ Args: { "p_order": string,"p_user": string }; Returns: string
                           },
"record_progress":
{ Args: { "p_playing": boolean,"p_position": number,"p_sequence": number,"p_session": string,"p_user": string }; Returns: undefined
                           },
"refund_quote":
{ Args: { "p_order": string,"p_user": string }; Returns: Json
                           },
"review_refund":
{ Args: { "p_amount": number,"p_approve": boolean,"p_order": string,"p_reason": string }; Returns: {
              "amount": number,
"completed_at": string | null,
"nicepay_cancel_started": boolean,
"nicepay_cancel_tid": string | null,
"order_id": string,
"reason": string | null,
"request_key": string,
"requested_at": string,
"status": string,
"used_seconds": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "refunds"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_profile":
{ Args: { "p_birthday": string,"p_image": string,"p_marketing": boolean,"p_name": string,"p_phone": string,"p_revision": string,"p_user": string }; Returns: undefined
                           },
"session_active":
{ Args: { "p_session": string }; Returns: boolean
                           },
"start_playback":
{ Args: { "p_lesson": string,"p_order": string,"p_user": string }; Returns: string
                           },
"used_seconds":
{ Args: { "p_order": string }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
