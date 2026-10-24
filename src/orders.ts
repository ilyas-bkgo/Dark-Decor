import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DbStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'canceled';
export type DbOrder = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  city: string;
  address: string;
  offer: 'one' | 'two';
  quantity: 1 | 2;
  total_dh: number;
  note: string | null;
  status: DbStatus;
  admin_note: string | null;
};
type OrderInsert = Pick<DbOrder, 'full_name' | 'phone' | 'city' | 'address' | 'offer' | 'quantity' | 'note'> & {
  id?: string;
  created_at?: string;
  total_dh?: number;
  status?: DbStatus;
  admin_note?: string | null;
};
type Database = {
  public: {
    Tables: { orders: { Row: DbOrder; Insert: OrderInsert; Update: Partial<Pick<DbOrder, 'status' | 'admin_note'>>; Relationships: [] } };
    Views: Record<string, never>;
    Functions: { is_admin: { Args: Record<string, never>; Returns: boolean } };
    Enums: { order_status: DbStatus };
    CompositeTypes: Record<string, never>;
  };
};

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export type OrderFilters = { status?: DbStatus; city?: string; from?: string; to?: string; search?: string; page?: number; pageSize?: number };
const client = (): SupabaseClient<Database> => {
  if (!supabase) throw new Error('إعدادات قاعدة البيانات غير مكتملة. أضيفي رابط Supabase والمفتاح العام في إعدادات النشر.');
  return supabase;
};

export async function createOrder(
  order: Pick<OrderInsert, 'full_name' | 'phone' | 'city' | 'address' | 'offer' | 'quantity' | 'note'>,
): Promise<void> {
  const { error } = await client().from('orders').insert(order);
  if (error) throw error;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await client().rpc('is_admin');
  if (error) throw error;
  return data;
}

export async function listOrders(filters: OrderFilters = {}): Promise<{ rows: DbOrder[]; count: number }> {
  const db = client();
  const pageSize = Math.min(filters.pageSize ?? 50, 100);
  const page = Math.max(filters.page ?? 0, 0);
  let query = db.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.city) query = query.eq('city', filters.city);
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`);
  if (filters.to) {
    const nextDay = new Date(`${filters.to}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt('created_at', nextDay.toISOString());
  }
  const search = filters.search?.trim().replace(/[(),%_\\]/g, '');
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  const { data, count, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function listAllFilteredOrders(filters: OrderFilters): Promise<DbOrder[]> {
  const db = client();
  const result: DbOrder[] = [];
  const chunkSize = 1000;
  for (let start = 0; ; start += chunkSize) {
    let query = db.from('orders').select('*').order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.city) query = query.eq('city', filters.city);
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`);
    if (filters.to) {
      const nextDay = new Date(`${filters.to}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query = query.lt('created_at', nextDay.toISOString());
    }
    const search = filters.search?.trim().replace(/[(),%_\\]/g, '');
    if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await query.range(start, start + chunkSize - 1);
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < chunkSize) return result;
  }
}

export async function countOrdersByStatus(): Promise<Record<DbStatus, number>> {
  const statuses: DbStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'canceled'];
  const result = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await client().from('orders').select('id', { count: 'exact', head: true }).eq('status', status);
    if (error) throw error;
    return [status, count ?? 0] as const;
  }));
  return Object.fromEntries(result) as Record<DbStatus, number>;
}

export async function updateOrderStatus(id: string, status: DbStatus): Promise<void> {
  const { error } = await client().from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateAdminNote(id: string, admin_note: string): Promise<void> {
  const { error } = await client().from('orders').update({ admin_note }).eq('id', id);
  if (error) throw error;
}
