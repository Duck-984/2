import { supabase, isSupabaseConfigured, Database, type StatusHistoryEntry } from '../supabase';
import {
  mockProducts, mockCategories, mockOrders, mockBanners, mockDeliveryZones,
} from './mock';

export type Product = Database['public']['Tables']['products']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type Referral = Database['public']['Tables']['referrals']['Row'];

export interface ProductFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  inStock?: boolean;
  search?: string;
}

export interface ProductSort {
  field: 'created_at' | 'price' | 'views';
  order: 'asc' | 'desc';
}

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export const productQueries = {
  getAll: async (filters?: ProductFilters, sort?: ProductSort) => {
    if (!isSupabaseConfigured) {
      await delay();
      let items = [...mockProducts].filter((p) => p.is_active);
      if (filters?.categoryId) items = items.filter((p) => p.category_id === filters.categoryId);
      if (filters?.minPrice !== undefined) items = items.filter((p) => p.price >= filters.minPrice!);
      if (filters?.maxPrice !== undefined) items = items.filter((p) => p.price <= filters.maxPrice!);
      if (filters?.inStock) items = items.filter((p) => p.stock > 0);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        items = items.filter((p) => p.name.ru.toLowerCase().includes(q) || p.name.uz.toLowerCase().includes(q));
      }
      if (filters?.sizes?.length) items = items.filter((p) => p.sizes.some((s) => filters.sizes!.includes(s)));
      if (filters?.colors?.length) items = items.filter((p) => p.colors.some((c) => filters.colors!.includes(c.hex)));
      if (sort) items.sort((a, b) => sort.order === 'asc' ? (a[sort.field] as number) - (b[sort.field] as number) : (b[sort.field] as number) - (a[sort.field] as number));
      return items;
    }

    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters?.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const sanitized = filters.search.replace(/[%_()]/g, '\\$&');
      query = query.or(`name->ru.ilike.%${sanitized}%,name->uz.ilike.%${sanitized}%,description->ru.ilike.%${sanitized}%,description->uz.ilike.%${sanitized}%`);
    }

    if (filters?.inStock) {
      query = query.gt('stock', 0);
    }

    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    // Client-side filtering for arrays
    let filteredData = data || [];

    if (filters?.sizes && filters.sizes.length > 0) {
      filteredData = filteredData.filter(product =>
        product.sizes.some((size: string) => filters.sizes!.includes(size))
      );
    }

    if (filters?.colors && filters.colors.length > 0) {
      filteredData = filteredData.filter(product =>
        product.colors.some((color: { name: string; hex: string }) => filters.colors!.includes(color.hex))
      );
    }

    return filteredData;
  },

  getBySlug: async (slug: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockProducts.find((p) => p.slug === slug) ?? null;
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  incrementViews: async (id: string) => {
    if (!isSupabaseConfigured) return;
    const { data: product } = await supabase
      .from('products')
      .select('views')
      .eq('id', id)
      .maybeSingle();

    if (product) {
      await supabase
        .from('products')
        .update({ views: (product.views || 0) + 1 })
        .eq('id', id);
    }
  },

  uploadImages: async (files: File[]) => {
    if (!isSupabaseConfigured) return files.map(() => 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80');
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  },
};

export const inventoryQueries = {
  updateStock: async (productId: string, newStock: number) => {
    if (!isSupabaseConfigured) { await delay(); const p = mockProducts.find((p) => p.id === productId); if (p) p.stock = newStock; return { id: productId, stock: newStock }; }
    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('id, stock')
      .single();
    if (error) throw error;
    return data;
  },

  adjustStock: async (productId: string, delta: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      const p = mockProducts.find((p) => p.id === productId);
      if (p) p.stock = Math.max(0, p.stock + delta);
      return { id: productId, stock: p?.stock ?? 0 };
    }
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_product_id: productId,
      p_delta: delta,
    }).maybeSingle();
    if (error) {
      const { data: current, error: fetchErr } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!current) throw new Error(`Product ${productId} not found`);
      const newStock = Math.max(0, (current?.stock ?? 0) + delta);
      const { data: updated, error: updateErr } = await supabase
        .from('products')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select('id, stock')
        .single();
      if (updateErr) throw updateErr;
      return updated;
    }
    return data;
  },

  getAllWithStock: async () => {
    if (!isSupabaseConfigured) { await delay(); return mockProducts; }
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, price, stock, images, is_active, category_id')
      .order('stock', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};

export const userQueries = {
  getByTelegramId: async (telegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return { id: `${telegramId}`, telegram_id: telegramId, first_name: 'Гость', username: null, language: 'ru', phone: null, address: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  upsert: async (telegramId: number, userData: { first_name: string; username?: string | null; language?: string }) => {
    if (!isSupabaseConfigured) { await delay(); return { id: `${telegramId}`, telegram_id: telegramId, first_name: userData.first_name, username: userData.username ?? null, language: userData.language ?? 'ru', phone: null, address: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('users')
      .upsert(
        { telegram_id: telegramId, ...userData, updated_at: new Date().toISOString() },
        { onConflict: 'telegram_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateProfile: async (telegramId: number, updates: { phone?: string; address?: string; first_name?: string }) => {
    if (!isSupabaseConfigured) { await delay(); return { id: `${telegramId}`, telegram_id: telegramId, first_name: updates.first_name || 'Гость', username: null, language: 'ru', phone: updates.phone ?? null, address: updates.address ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    // First ensure user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (!existing) {
      // Create the user first
      const { data, error } = await supabase
        .from('users')
        .insert({ telegram_id: telegramId, first_name: updates.first_name || '', ...updates })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('telegram_id', telegramId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const categoryQueries = {
  getAll: async () => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockCategories;
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name->ru');

    if (error) throw error;
    return data;
  },
};

export const orderQueries = {
  create: async (orderData: Database['public']['Tables']['orders']['Insert']) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { ...orderData, id: `ord-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status_history: [], transaction_id: null, paid_at: null } as Order;
    }
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getByTelegramUserId: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockOrders;
    }
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockOrders.find((o) => o.id === id) ?? null;
    }
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  updateStatus: async (id: string, status: string, changedBy = 'admin', note?: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      const order = mockOrders.find((o) => o.id === id);
      if (order) order.status = status;
      return order as Order;
    }
    const { data: current, error: fetchErr } = await supabase
      .from('orders')
      .select('status_history')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const history: StatusHistoryEntry[] = Array.isArray((current as { status_history?: StatusHistoryEntry[] })?.status_history)
      ? (current as { status_history: StatusHistoryEntry[] }).status_history
      : [];

    const newEntry = {
      status,
      changed_at: new Date().toISOString(),
      changed_by: changedBy,
      ...(note ? { note } : {}),
    };

    const { data, error } = await supabase
      .from('orders')
      .update({
        status,
        status_history: [...history, newEntry],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  subscribeToOrders: (callback: (payload: { new: Record<string, unknown>; old: Record<string, unknown>; eventType: string }) => void) => {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} } as ReturnType<typeof supabase.channel>;
    return supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        callback
      )
      .subscribe();
  },
};

export const reviewQueries = {
  getByProductId: async (productId: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return [];
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  create: async (reviewData: Database['public']['Tables']['reviews']['Insert']) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { ...reviewData, id: `rev-${Date.now()}`, created_at: new Date().toISOString(), is_approved: true } as Review;
    }
    const { data, error } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getAverageRating: async (productId: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { average: 0, count: 0 };
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('is_approved', true);

    if (error) throw error;

    if (!data || data.length === 0) return { average: 0, count: 0 };

    const sum = data.reduce((acc, review) => acc + review.rating, 0);
    return {
      average: sum / data.length,
      count: data.length,
    };
  },
};

export const promotionQueries = {
  getActive: async (type?: 'new_arrival' | 'sale' | 'featured') => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    let query = supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  getProductsByPromotion: async (promotionId: string) => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data: promotion } = await supabase
      .from('promotions')
      .select('product_ids')
      .eq('id', promotionId)
      .maybeSingle();

    if (!promotion || !promotion.product_ids?.length) return [];

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', promotion.product_ids)
      .eq('is_active', true);

    if (error) throw error;
    return data;
  },
};

export const referralQueries = {
  getByCode: async (code: string) => {
    if (!isSupabaseConfigured) { await delay(); return null; }
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  create: async (telegramId: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { id: `ref-${Date.now()}`, referrer_telegram_id: telegramId, referral_code: `REF${telegramId}${Math.random().toString(36).substring(7).toUpperCase()}`, bonus_amount: 50000, is_redeemed: false, redeemed_at: null, created_at: new Date().toISOString() } as Referral;
    }
    const code = `REF${telegramId}${Math.random().toString(36).substring(7).toUpperCase()}`;

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_telegram_id: telegramId,
        referral_code: code,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getByReferrer: async (telegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_telegram_id', telegramId);

    if (error) throw error;
    return data;
  },

  redeem: async (referralId: string, referredTelegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return null; }
    const { data, error } = await supabase
      .from('referrals')
      .update({
        referred_telegram_id: referredTelegramId,
        is_redeemed: true,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', referralId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export type Banner = {
  id: string;
  title: { ru: string; uz: string };
  subtitle: { ru: string; uz: string };
  image_url: string;
  link_url: string | null;
  link_label: { ru: string; uz: string } | null;
  bg_color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryZone = {
  id: string;
  city_ru: string;
  city_uz: string;
  region_ru: string;
  region_uz: string;
  standard_price: number;
  express_price: number;
  standard_days_min: number;
  standard_days_max: number;
  express_days_min: number;
  express_days_max: number;
  free_threshold: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const deliveryZoneQueries = {
  getActive: async (): Promise<DeliveryZone[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockDeliveryZones.filter((z) => z.is_active); }
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DeliveryZone[];
  },

  getAll: async (): Promise<DeliveryZone[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockDeliveryZones; }
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DeliveryZone[];
  },

  create: async (zone: Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryZone> => {
    if (!isSupabaseConfigured) { await delay(); return { ...zone, id: `zone-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert(zone)
      .select()
      .single();
    if (error) throw error;
    return data as DeliveryZone;
  },

  update: async (id: string, zone: Partial<Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'>>): Promise<DeliveryZone> => {
    if (!isSupabaseConfigured) { await delay(); const z = mockDeliveryZones.find((z) => z.id === id); if (z) Object.assign(z, zone); return z as DeliveryZone; }
    const { data, error } = await supabase
      .from('delivery_zones')
      .update({ ...zone, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as DeliveryZone;
  },

  delete: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) { await delay(); return; }
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) throw error;
  },
};

export const bannerQueries = {
  getActive: async (): Promise<Banner[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockBanners.filter((b) => b.is_active); }
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Banner[];
  },

  getAll: async (): Promise<Banner[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockBanners; }
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Banner[];
  },

  create: async (banner: Omit<Banner, 'id' | 'created_at' | 'updated_at'>): Promise<Banner> => {
    if (!isSupabaseConfigured) { await delay(); return { ...banner, id: `banner-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('banners')
      .insert(banner)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  update: async (id: string, banner: Partial<Omit<Banner, 'id' | 'created_at' | 'updated_at'>>): Promise<Banner> => {
    if (!isSupabaseConfigured) { await delay(); return mockBanners[0] as Banner; }
    const { data, error } = await supabase
      .from('banners')
      .update({ ...banner, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  delete: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) { await delay(); return; }
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;
  },
};

export const paymentQueries = {
  createPayment: async (orderId: string, amount: number, paymentMethod: 'payme' | 'click' | 'uzum') => {
    if (!isSupabaseConfigured) { await delay(); return { paymentUrl: null, orderId }; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'Apikey': anonKey,
      },
      body: JSON.stringify({ orderId, amount, paymentMethod }),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment');
    }

    return response.json();
  },
};
