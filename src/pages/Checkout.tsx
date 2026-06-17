import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, Smartphone, Truck, Zap, Tag } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';
import { useCartStore } from '../store/useCartStore';
import { useAppStore } from '../store/useAppStore';
import { useCreateOrder, useCreatePayment, useDeliveryZones, useAdjustStock } from '../lib/supabase/hooks';
import { formatPrice } from '../lib/utils';
import { hapticNotification, getTelegramUser } from '../lib/telegram';
import { toast } from '../components/Toast';
import type { DeliveryZone } from '../lib/supabase/queries';

export const Checkout = () => {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const getUserId = useAppStore((state) => state.getUserId);

  const createOrderMutation = useCreateOrder();
  const createPaymentMutation = useCreatePayment();
  const adjustStockMutation = useAdjustStock();
  const { data: deliveryZones = [], isLoading: zonesLoading } = useDeliveryZones(true);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    zoneId: '',
    address: '',
    deliveryType: 'standard' as 'standard' | 'express',
    paymentMethod: 'payme' as 'payme' | 'click' | 'uzum' | 'cash',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (items.length === 0 && !orderPlaced) {
      navigate('/cart');
    }
  }, [items.length, orderPlaced, navigate]);

  const selectedZone: DeliveryZone | undefined = useMemo(() => {
    if (!formData.zoneId && deliveryZones.length > 0) return deliveryZones[0];
    return deliveryZones.find((z) => z.id === formData.zoneId) ?? deliveryZones[0];
  }, [formData.zoneId, deliveryZones]);

  const subtotal = getTotalPrice();

  const deliveryCost = useMemo(() => {
    if (!selectedZone) return 20000;
    const price = formData.deliveryType === 'express'
      ? selectedZone.express_price
      : selectedZone.standard_price;
    if (
      formData.deliveryType === 'standard' &&
      selectedZone.free_threshold &&
      selectedZone.free_threshold > 0 &&
      subtotal >= selectedZone.free_threshold
    ) {
      return 0;
    }
    return price;
  }, [selectedZone, formData.deliveryType, subtotal]);

  const totalAmount = subtotal + deliveryCost;
  const isFree = deliveryCost === 0 && formData.deliveryType === 'standard';

  const cityLabel = (zone: DeliveryZone) =>
    language === 'uz' ? zone.city_uz : zone.city_ru;

  const validateForm = (): string | null => {
    const name = formData.fullName.trim();
    const phone = formData.phone.trim();
    const address = formData.address.trim();

    if (name.length < 2) {
      return language === 'ru' ? 'Введите ваше имя (минимум 2 символа)' : 'Ismingizni kiriting (kamida 2 belgi)';
    }
    const phoneClean = phone.replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{9,13}$/.test(phoneClean)) {
      return language === 'ru' ? 'Введите корректный номер телефона' : "To'g'ri telefon raqam kiriting";
    }
    if (address.length < 5) {
      return language === 'ru' ? 'Введите адрес доставки (минимум 5 символов)' : "Yetkazib berish manzilini kiriting (kamida 5 belgi)";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      submittingRef.current = false;
      return;
    }

    setLoading(true);

    try {
      const user = getTelegramUser();
      const userId = user?.id || getUserId();

      if (!userId) {
        toast.error(language === 'ru' ? 'Ошибка идентификации пользователя' : 'Foydalanuvchini aniqlashda xatolik');
        setLoading(false);
        return;
      }

      const city = selectedZone
        ? (language === 'uz' ? selectedZone.city_uz : selectedZone.city_ru)
        : '';

      const order = await createOrderMutation.mutateAsync({
        telegram_user_id: userId,
        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          color: item.color?.name,
          image: item.image,
        })),
        total_amount: totalAmount,
        status: formData.paymentMethod === 'cash' ? 'new' : 'processing',
        customer_info: {
          name: formData.fullName,
          phone: formData.phone,
          city,
          address: formData.address,
          zone_id: selectedZone?.id,
          region: selectedZone
            ? (language === 'uz' ? selectedZone.region_uz : selectedZone.region_ru)
            : '',
        },
        delivery_type: formData.deliveryType,
        delivery_cost: deliveryCost,
        payment_method: formData.paymentMethod,
        notes: formData.notes,
      });

      setOrderId(order.id);

      // Decrement stock for each item in the order
      for (const item of items) {
        try {
          await adjustStockMutation.mutateAsync({ productId: item.productId, delta: -item.quantity });
        } catch {
          // Non-critical: don't block order if stock update fails
        }
      }

      if (formData.paymentMethod !== 'cash') {
        try {
          const paymentData = await createPaymentMutation.mutateAsync({
            orderId: order.id,
            amount: totalAmount,
            paymentMethod: formData.paymentMethod,
          });
          if (paymentData.paymentUrl) {
            localStorage.setItem('pending_order_id', order.id);
            clearCart();
            window.location.href = paymentData.paymentUrl;
            return;
          }
        } catch (paymentError) {
          console.error('Payment error:', paymentError);
          toast.error(language === 'ru' ? 'Ошибка создания платежа' : "To'lov yaratishda xatolik");
        }
      }

      setOrderPlaced(true);
      clearCart();
      hapticNotification('success');
      toast.success(t('order_success'));
    } catch (error) {
      console.error('Error placing order:', error);
      hapticNotification('error');
      toast.error(t('error'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (items.length === 0 && !orderPlaced) {
    return null;
  }

  if (orderPlaced) {
    return (
      <Layout showBottomNav={false}>
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-surface-900 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">{t('order_success')}</h2>
          <p className="text-surface-500 dark:text-surface-400 mb-1">
            {t('order_number')}: <span className="font-mono font-semibold text-surface-900 dark:text-white">{orderId.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-surface-500 dark:text-surface-400 mb-8">
            {language === 'ru' ? 'Мы свяжемся с вами в ближайшее время' : "Tez orada siz bilan bog'lanamiz"}
          </p>
          <div className="space-y-3 max-w-md mx-auto">
            <button
              onClick={() => navigate('/orders')}
              className="w-full bg-surface-900 text-white py-3.5 rounded-xl font-semibold hover:bg-surface-800 transition-colors"
            >
              {t('order_history')}
            </button>
            <button
              onClick={() => navigate('/catalog')}
              className="w-full bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-white py-3.5 rounded-xl font-semibold hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
            >
              {t('continue_shopping')}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const daysLabel = (min: number, max: number) =>
    `${min}${min !== max ? `–${max}` : ''} ${language === 'ru' ? (max === 1 ? 'день' : 'дн.') : 'kun'}`;

  return (
    <Layout showBottomNav={false}>
      <div className="container mx-auto px-4 py-4 pb-32">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-6">{t('checkout')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer info */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm border border-surface-100 dark:border-surface-700">
            <h2 className="text-base font-semibold text-surface-900 dark:text-white mb-4">{t('customer_info')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">{t('full_name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-surface-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">{t('phone')} *</label>
                <input
                  type="tel"
                  required
                  placeholder="+998 90 123 45 67"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-surface-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">{t('address')} *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-surface-900 text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm border border-surface-100 dark:border-surface-700">
            <h2 className="text-base font-semibold text-surface-900 dark:text-white mb-4">{t('delivery')}</h2>

            {/* City selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                {language === 'ru' ? 'Город доставки' : 'Yetkazib berish shahri'} *
              </label>
              {zonesLoading ? (
                <div className="h-11 bg-surface-100 dark:bg-surface-700 rounded-xl animate-pulse" />
              ) : (
                <select
                  value={formData.zoneId || (deliveryZones[0]?.id ?? '')}
                  onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-surface-900 text-sm"
                >
                  {deliveryZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {cityLabel(zone)} — {language === 'uz' ? zone.region_uz : zone.region_ru}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Free shipping notice */}
            {selectedZone?.free_threshold && selectedZone.free_threshold > 0 && (
              <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 mb-3 ${
                subtotal >= selectedZone.free_threshold
                  ? 'bg-surface-900 text-white'
                  : 'bg-surface-50 dark:bg-surface-700 text-surface-700 dark:text-surface-300'
              }`}>
                <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                {subtotal >= selectedZone.free_threshold ? (
                  <span>
                    {language === 'ru'
                      ? 'Бесплатная доставка!'
                      : 'Bepul yetkazib berish!'}
                  </span>
                ) : (
                  <span>
                    {language === 'ru'
                      ? `Бесплатно от ${formatPrice(selectedZone.free_threshold)} (+${formatPrice(selectedZone.free_threshold - subtotal)})`
                      : `${formatPrice(selectedZone.free_threshold)} dan bepul (+${formatPrice(selectedZone.free_threshold - subtotal)})`}
                  </span>
                )}
              </div>
            )}

            {/* Delivery type cards */}
            <div className="grid grid-cols-1 gap-2.5">
              {/* Standard */}
              <label className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-colors ${
                formData.deliveryType === 'standard'
                  ? 'border-surface-900 bg-surface-100 dark:bg-surface-700'
                  : 'border-surface-200 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    formData.deliveryType === 'standard'
                      ? 'bg-surface-100 dark:bg-surface-700'
                      : 'bg-surface-100 dark:bg-surface-700'
                  }`}>
                    <Truck className={`w-4 h-4 ${formData.deliveryType === 'standard' ? 'text-surface-900' : 'text-surface-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white text-sm">{t('delivery_standard')}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {selectedZone
                        ? daysLabel(selectedZone.standard_days_min, selectedZone.standard_days_max)
                        : language === 'ru' ? '3–5 дн.' : '3–5 kun'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {isFree && formData.deliveryType === 'standard' ? (
                      <span className="text-sm font-bold text-surface-900 dark:text-white">
                        {language === 'ru' ? 'Бесплатно' : 'Bepul'}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-surface-900 dark:text-white">
                        {selectedZone ? formatPrice(selectedZone.standard_price) : formatPrice(20000)}
                      </span>
                    )}
                  </div>
                  <input type="radio" name="delivery" value="standard"
                    checked={formData.deliveryType === 'standard'}
                    onChange={() => setFormData({ ...formData, deliveryType: 'standard' })}
                    className="w-4 h-4 text-surface-900" />
                </div>
              </label>

      {/* Express */}
              <label className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-colors ${
                formData.deliveryType === 'express'
                  ? 'border-surface-900 bg-surface-100 dark:bg-surface-700'
                  : 'border-surface-200 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-100 dark:bg-surface-700">
                    <Zap className={`w-4 h-4 ${formData.deliveryType === 'express' ? 'text-surface-900' : 'text-surface-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white text-sm">{t('delivery_express')}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {selectedZone
                        ? daysLabel(selectedZone.express_days_min, selectedZone.express_days_max)
                        : language === 'ru' ? '1–2 дн.' : '1–2 kun'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-surface-900 dark:text-white">
                    {selectedZone ? formatPrice(selectedZone.express_price) : formatPrice(50000)}
                  </span>
                  <input type="radio" name="delivery" value="express"
                    checked={formData.deliveryType === 'express'}
                    onChange={() => setFormData({ ...formData, deliveryType: 'express' })}
                    className="w-4 h-4 text-surface-900" />
                </div>
              </label>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm border border-surface-100 dark:border-surface-700">
            <h2 className="text-base font-semibold text-surface-900 dark:text-white mb-4">{t('payment_method')}</h2>
            <div className="space-y-2">
              {[
                { id: 'payme', icon: CreditCard, label: 'Payme', color: 'text-surface-900' },
                { id: 'click', icon: CreditCard, label: 'Click', color: 'text-surface-900' },
                { id: 'uzum', icon: Smartphone, label: 'Uzum Bank', color: 'text-surface-900' },
                { id: 'cash', icon: CreditCard, label: t('payment_cash'), color: 'text-surface-900' },
              ].map(({ id, icon: Icon, label, color }) => (
                <label
                  key={id}
                  className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${
                    formData.paymentMethod === id
                      ? 'border-surface-900 bg-surface-100 dark:bg-surface-700'
                      : 'border-surface-200 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <span className="font-medium text-surface-900 dark:text-white text-sm">{label}</span>
                  </div>
                  <input
                    type="radio"
                    name="payment"
                    value={id}
                    checked={formData.paymentMethod === id}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as 'payme' | 'click' | 'uzum' | 'cash' })}
                    className="w-4 h-4 text-surface-900"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700">
            <h2 className="text-base font-semibold text-surface-900 dark:text-white mb-3">
              {language === 'ru' ? 'Итого' : 'Jami'}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-surface-600 dark:text-surface-400">
                <span>{language === 'ru' ? 'Товары' : 'Mahsulotlar'}:</span>
                <span className="font-semibold text-surface-900 dark:text-white">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-surface-600 dark:text-surface-400">
                <span>
                  {language === 'ru' ? 'Доставка' : 'Yetkazib berish'}
                  {selectedZone && (
                    <span className="text-xs ml-1 text-surface-400">
                      ({language === 'uz' ? selectedZone.city_uz : selectedZone.city_ru})
                    </span>
                  )}:
                </span>
                {isFree ? (
                  <span className="font-semibold text-surface-900 dark:text-white">
                    {language === 'ru' ? 'Бесплатно' : 'Bepul'}
                  </span>
                ) : (
                  <span className="font-semibold text-surface-900 dark:text-white">{formatPrice(deliveryCost)}</span>
                )}
              </div>
              <div className="border-t border-surface-200 dark:border-surface-600 pt-2 flex justify-between">
                <span className="font-bold text-surface-900 dark:text-white">{t('total')}:</span>
                <span className="text-lg font-bold text-surface-900">{formatPrice(totalAmount)}</span>
              </div>
            </div>
          </div>
        </form>

        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 p-4 shadow-lg">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-surface-900 text-white py-4 rounded-xl font-semibold hover:bg-surface-800 transition-colors disabled:bg-surface-400 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('loading')}</span>
              </>
            ) : (
              <span>
                {formData.paymentMethod === 'cash'
                  ? t('place_order')
                  : language === 'ru'
                  ? 'Перейти к оплате'
                  : "To'lovga o'tish"}
                {' '}— {formatPrice(totalAmount)}
              </span>
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
};
