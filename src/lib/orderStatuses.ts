export const ORDER_STATUSES = [
  { value: 'new',              label_ru: 'Новый',         label_uz: 'Yangi',                  color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',                   dot: 'bg-gray-400' },
  { value: 'processing',       label_ru: 'В обработке',   label_uz: "Ko'rib chiqilmoqda",     color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',                  dot: 'bg-blue-500' },
  { value: 'assembling',       label_ru: 'В сборке',      label_uz: "Yig'ilmoqda",            color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',           dot: 'bg-yellow-500' },
  { value: 'assembled',        label_ru: 'Собран',        label_uz: "Yig'ildi",               color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',               dot: 'bg-amber-500' },
  { value: 'shipping',         label_ru: 'В доставке',    label_uz: 'Yetkazilmoqda',          color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',           dot: 'bg-orange-500' },
  { value: 'delivered',        label_ru: 'Доставлен',     label_uz: 'Yetkazildi',             color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',       dot: 'bg-emerald-500' },
  { value: 'cancelled',        label_ru: 'Отменён',       label_uz: 'Bekor qilindi',          color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',                      dot: 'bg-red-500' },
  { value: 'return_requested', label_ru: 'Возврат',       label_uz: 'Qaytarish',              color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',                   dot: 'bg-rose-500' },
  { value: 'returned',         label_ru: 'Возвращён',     label_uz: 'Qaytarildi',             color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',                  dot: 'bg-slate-400' },
  { value: 'paid',             label_ru: 'Оплачен',       label_uz: "To'langan",              color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',               dot: 'bg-green-500' },
  { value: 'shipped',          label_ru: 'Отправлен',     label_uz: 'Yuborilgan',             color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',                   dot: 'bg-blue-400' },
] as const;

export type OrderStatusValue = typeof ORDER_STATUSES[number]['value'];

export const getStatusInfo = (value: string) =>
  ORDER_STATUSES.find((s) => s.value === value) ?? ORDER_STATUSES[0];

export const getStatusLabel = (status: string, lang: 'ru' | 'uz') => {
  const info = getStatusInfo(status);
  return lang === 'ru' ? info.label_ru : info.label_uz;
};

export const getStatusColor = (status: string) => getStatusInfo(status).color;
