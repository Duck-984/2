import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  productQueries,
  categoryQueries,
  orderQueries,
  reviewQueries,
  promotionQueries,
  referralQueries,
  paymentQueries,
  bannerQueries,
  deliveryZoneQueries,
  inventoryQueries,
  userQueries,
  type ProductFilters,
  type ProductSort,
  PAGE_SIZE,
} from './queries';
import type { Database } from '../supabase';

export { userQueries } from './queries';

// Products
export const useProducts = (filters?: ProductFilters, sort?: ProductSort) => {
  return useInfiniteQuery({
    queryKey: ['products', filters, sort],
    queryFn: ({ pageParam = 0 }) => productQueries.getAll(filters, sort, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
};

export const useProduct = (slug: string) => {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => productQueries.getBySlug(slug),
    enabled: !!slug,
  });
};

export const useIncrementViews = () => {
  return useMutation({
    mutationFn: (productId: string) => productQueries.incrementViews(productId),
  });
};

export const useUploadProductImages = () => {
  return useMutation({
    mutationFn: (files: File[]) => productQueries.uploadImages(files),
  });
};

// Users
export const useUserProfile = (telegramId: number) => {
  return useQuery({
    queryKey: ['user_profile', telegramId],
    queryFn: () => userQueries.getByTelegramId(telegramId),
    enabled: telegramId > 0,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ telegramId, updates }: { telegramId: number; updates: { phone?: string; address?: string; first_name?: string } }) =>
      userQueries.updateProfile(telegramId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user_profile', variables.telegramId] });
    },
  });
};

// Categories
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryQueries.getAll(),
  });
};

// Orders
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderData: Database['public']['Tables']['orders']['Insert']) =>
      orderQueries.create(orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

export const useOrders = (telegramUserId: number) => {
  return useQuery({
    queryKey: ['orders', telegramUserId],
    queryFn: () => orderQueries.getByTelegramUserId(telegramUserId),
    enabled: telegramUserId > 0,
  });
};

export const useOrder = (orderId: string) => {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderQueries.getById(orderId),
    enabled: !!orderId,
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, changedBy, note }: { id: string; status: string; changedBy?: string; note?: string }) =>
      orderQueries.updateStatus(id, status, changedBy, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

// Inventory
export const useInventoryProducts = () => {
  return useQuery({
    queryKey: ['inventory_products'],
    queryFn: () => inventoryQueries.getAllWithStock(),
  });
};

export const useUpdateStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, newStock }: { productId: string; newStock: number }) =>
      inventoryQueries.updateStock(productId, newStock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, delta }: { productId: string; delta: number }) =>
      inventoryQueries.adjustStock(productId, delta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// Reviews
export const useProductReviews = (productId: string) => {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => reviewQueries.getByProductId(productId),
    enabled: !!productId,
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewData: Database['public']['Tables']['reviews']['Insert']) =>
      reviewQueries.create(reviewData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', data.product_id] });
    },
  });
};

export const useProductRating = (productId: string) => {
  return useQuery({
    queryKey: ['rating', productId],
    queryFn: () => reviewQueries.getAverageRating(productId),
    enabled: !!productId,
  });
};

// Promotions
export const usePromotions = (type?: 'new_arrival' | 'sale' | 'featured') => {
  return useQuery({
    queryKey: ['promotions', type],
    queryFn: () => promotionQueries.getActive(type),
  });
};

export const usePromotionProducts = (promotionId: string) => {
  return useQuery({
    queryKey: ['promotion-products', promotionId],
    queryFn: () => promotionQueries.getProductsByPromotion(promotionId),
    enabled: !!promotionId,
  });
};

// Referrals
export const useReferralByCode = (code: string) => {
  return useQuery({
    queryKey: ['referral', code],
    queryFn: () => referralQueries.getByCode(code),
    enabled: !!code,
  });
};

export const useCreateReferral = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (telegramId: number) => referralQueries.create(telegramId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
};

export const useUserReferrals = (telegramId: number) => {
  return useQuery({
    queryKey: ['referrals', telegramId],
    queryFn: () => referralQueries.getByReferrer(telegramId),
    enabled: !!telegramId,
  });
};

export const useRedeemReferral = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ referralId, telegramId }: { referralId: string; telegramId: number }) =>
      referralQueries.redeem(referralId, telegramId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
};

// Delivery Zones
export const useDeliveryZones = (activeOnly = true) => {
  return useQuery({
    queryKey: ['delivery_zones', activeOnly],
    queryFn: () => activeOnly ? deliveryZoneQueries.getActive() : deliveryZoneQueries.getAll(),
  });
};

export const useCreateDeliveryZone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deliveryZoneQueries.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_zones'] });
    },
  });
};

export const useUpdateDeliveryZone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Database['public']['Tables']['delivery_zones']['Update']> }) => deliveryZoneQueries.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_zones'] });
    },
  });
};

export const useDeleteDeliveryZone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deliveryZoneQueries.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_zones'] });
    },
  });
};

// Banners
export const useBanners = (activeOnly = true) => {
  return useQuery({
    queryKey: ['banners', activeOnly],
    queryFn: () => activeOnly ? bannerQueries.getActive() : bannerQueries.getAll(),
  });
};

export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bannerQueries.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Database['public']['Tables']['banners']['Update']> }) => bannerQueries.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bannerQueries.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });
};

// Payments
export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount, paymentMethod }: {
      orderId: string;
      amount: number;
      paymentMethod: 'payme' | 'click' | 'uzum';
    }) => paymentQueries.createPayment(orderId, amount, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
