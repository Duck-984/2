import { Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/useAppStore';
import { useOrders } from '../lib/supabase/hooks';
import { formatPrice, getLocalizedValue } from '../lib/utils';
import { getTelegramUser } from '../lib/telegram';
import { getStatusColor, getStatusLabel } from '../lib/orderStatuses';
import type { OrderItem } from '../lib/supabase';

export const Orders = () => {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const getUserId = useAppStore((state) => state.getUserId);

  const user = getTelegramUser();
  const userId = user?.id || getUserId();

  const { data: orders = [], isLoading } = useOrders(userId);

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, { ru: string; uz: string }> = {
      cash: { ru: 'Наличные', uz: 'Naqd pul' },
      payme: { ru: 'Payme', uz: 'Payme' },
      click: { ru: 'Click', uz: 'Click' },
      uzum: { ru: 'Uzum Bank', uz: 'Uzum Bank' },
    };
    return labels[method]?.[language] || method;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-surface-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-surface-500 dark:text-surface-400 mt-2">{t('loading')}</p>
        </div>
      </Layout>
    );
  }

  if (orders.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Package className="w-24 h-24 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
            {t('no_orders')}
          </h2>
          <p className="text-surface-600 dark:text-surface-400 mb-6">
            {t('continue_shopping')}
          </p>
          <button
            onClick={() => navigate('/catalog')}
            className="bg-surface-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-surface-800 transition-colors"
          >
            {t('catalog')}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-4">
          {t('order_history')}
        </h1>

        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-surface-800 rounded-2xl overflow-hidden shadow-card"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      {t('order_number')}: <span className="font-mono font-semibold text-surface-900 dark:text-white">{order.id.slice(0, 8)}</span>
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-500 mt-1">
                      {new Date(order.created_at).toLocaleDateString(
                        language === 'ru' ? 'ru-RU' : 'uz-UZ',
                        {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {getStatusLabel(order.status, language)}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  {(Array.isArray(order.items) ? order.items as OrderItem[] : []).slice(0, 2).map((item: OrderItem, index: number) => (
                    <div key={index} className="flex items-center space-x-3">
          <div className="w-14 h-14 bg-surface-100 dark:bg-surface-700 rounded-xl overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={getLocalizedValue(item.name, language)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-surface-400 text-xs">
                            {t('no_image')}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                          {getLocalizedValue(item.name, language)}
                        </p>
                        <p className="text-xs text-surface-600 dark:text-surface-400">
                          {item.quantity} × {formatPrice(item.price)}
                          {item.size && ` • ${t('size')}: ${item.size}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(Array.isArray(order.items) ? order.items as OrderItem[] : []).length > 2 && (
                    <p className="text-xs text-surface-500 dark:text-surface-500 pl-15">
                      {t('and_more')} {(order.items as OrderItem[]).length - 2}{' '}
                      {t('items_count')}
                    </p>
                  )}
                </div>

                <div className="border-t border-surface-200 dark:border-surface-700 pt-3 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-surface-600 dark:text-surface-400">
                      {t('payment_method')}:
                    </span>
                    <span className="font-medium text-surface-900 dark:text-white">
                      {getPaymentMethodLabel(order.payment_method)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-surface-600 dark:text-surface-400">
                      {t('delivery')}:
                    </span>
                    <span className="font-medium text-surface-900 dark:text-white">
                      {order.delivery_type === 'express'
                        ? language === 'ru'
                          ? 'Экспресс'
                          : 'Ekspress'
                        : language === 'ru'
                        ? 'Стандарт'
                        : 'Standart'}{' '}
                      ({formatPrice(order.delivery_cost as number)})
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-surface-200 dark:border-surface-700">
                    <span className="font-semibold text-surface-900 dark:text-white">
                      {t('total')}:
                    </span>
                    <span className="text-lg font-bold text-surface-900">
                      {formatPrice(order.total_amount as number)}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};
