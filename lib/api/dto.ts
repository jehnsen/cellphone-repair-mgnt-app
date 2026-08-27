/**
 * The wire shapes, exactly as the Laravel resources emit them.
 *
 * Kept separate from `lib/types.ts` on purpose: the domain model is what the
 * screens speak, these are what the server speaks, and `mappers.ts` is the
 * only place the two meet. When the API adds a field, it lands here first.
 */

export interface BranchDto {
  ulid: string;
  name: string;
  code: string;
  legal_name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
  } | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  tin?: string | null;
  bir_permit_no?: string | null;
  vat_registered?: boolean;
  receipt_header_text?: string | null;
  receipt_footer_text?: string | null;
  timezone?: string | null;
  is_active?: boolean;
}

export interface UserDto {
  ulid: string;
  employee_code?: string | null;
  name: string;
  email: string;
  roles?: string[];
  branch?: BranchDto | null;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
}

export interface CustomerDto {
  ulid: string;
  name: string;
  mobile: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_blacklisted?: boolean;
  blacklist_reason?: string | null;
  branch?: BranchDto | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DeviceBrandDto {
  ulid: string;
  name: string;
  is_active?: boolean;
}

export interface DeviceModelDto {
  ulid: string;
  name: string;
  release_year?: number | null;
  aliases?: string[] | null;
  is_active?: boolean;
  brand?: DeviceBrandDto | null;
}

export interface CustomerDeviceDto {
  ulid: string;
  imei?: string | null;
  serial_number?: string | null;
  color?: string | null;
  notes?: string | null;
  device_model?: DeviceModelDto | null;
  customer?: CustomerDto | null;
  created_at?: string | null;
}

export interface RepairTicketDto {
  ulid: string;
  ticket_number: string;
  claim_code: string;
  status: string;
  device: {
    brand?: string | null;
    model?: string | null;
    color?: string | null;
  };
  reported_problem?: string | null;
  problem_tags?: string[] | null;
  /** Only present for staff with tickets.update. */
  unlock_method?: string | null;
  unlock_value?: string | null;
  accessories_turned_over?: string[] | null;
  intake_condition_checklist?: string[] | null;
  estimated_cost?: number | string | null;
  approved_amount?: number | string | null;
  downpayment?: number | string | null;
  balance?: number | string | null;
  /** Only present for staff with reports.margin.view, and only on show. */
  margin?: number | null;
  promised_date?: string | null;
  warranty_days_offered?: number | null;
  terms_accepted?: boolean;
  terms_accepted_at?: string | null;
  customer?: CustomerDto | null;
  customer_device?: CustomerDeviceDto | null;
  assigned_technician?: UserDto | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TicketEventDto {
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: UserDto | null;
  created_at?: string | null;
}

export interface TicketLineDto {
  line_type: "part" | "labor";
  description?: string | null;
  quantity: number | string;
  unit_cost?: number | string | null;
  unit_price: number | string;
  amount: number | string;
  product?: ProductDto | null;
  service?: ServiceDto | null;
  created_at?: string | null;
}

export interface TicketPhotoDto {
  ulid: string;
  phase: string;
  sha256_hash?: string | null;
  captured_at?: string | null;
  captured_by?: UserDto | null;
  url?: string | null;
}

export interface TicketQuoteDto {
  ulid: string;
  quoted_amount: number | string;
  sent_at?: string | null;
  channel?: string | null;
  responded_at?: string | null;
  decision?: "approved" | "declined" | null;
  responder_note?: string | null;
}

export interface ProductCategoryDto {
  ulid: string;
  name: string;
  is_active?: boolean;
}

export interface ProductDto {
  ulid: string;
  sku: string;
  barcode?: string | null;
  name: string;
  type: "handset" | "accessory" | "part";
  /** Permission-gated: absent entirely for a cashier. */
  cost?: number | string | null;
  selling_price: number | string;
  is_serialized?: boolean;
  reorder_point?: number | null;
  track_inventory?: boolean;
  is_active?: boolean;
  category?: ProductCategoryDto | null;
  brand?: DeviceBrandDto | null;
  compatible_device_models?: DeviceModelDto[];
  created_at?: string | null;
}

export interface ServiceDto {
  ulid: string;
  name: string;
  category?: string | null;
  default_price: number | string;
  default_duration_minutes?: number | null;
  warranty_days?: number | null;
  is_active?: boolean;
}

export interface TokenDto {
  token: string;
  token_type: string;
}
