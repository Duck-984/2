import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Share2, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';
import { useCartStore } from '../store/useCartStore';
import { useProduct, useIncrementViews, useProductReviews, useProductRating } from '../lib/supabase/hooks';
import { formatPrice, getLocalizedValue } from '../lib/utils';
import { hapticNotification, tg } from '../lib/telegram';
import { toast } from '../components/Toast';

export const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);

  const { data: product, isLoading } = useProduct(slug!);
  const incrementViews = useIncrementViews();
  const { data: reviews = [] } = useProductReviews(product?.id || '');
  const { data: rating } = useProductRating(product?.id || '');

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | undefined>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    if (product) {
      if (product.sizes && product.sizes.length > 0) {
        setSelectedSize(product.sizes[0]);
      }
      if (product.colors && product.colors.length > 0) {
        setSelectedColor(product.colors[0] as { name: string; hex: string });
      }
      incrementViews.mutate(product.id);
    }
  }, [product?.id, incrementViews, product]);

  const handleShare = async () => {
    if (!product) return;

    const shareUrl = `${window.location.origin}/product/${product.slug}`;
    const shareText = `${getLocalizedValue(product.name, language)} - ${formatPrice(product.price as number)}`;

    if (tg) {
      (tg as { openTelegramLink?: (url: string) => void }).openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: getLocalizedValue(product.name, language),
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success(language === 'ru' ? 'Ссылка скопирована' : 'Havola nusxalandi');
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (product.sizes.length > 0 && !selectedSize) {
      toast.warning(t('select_size'));
      return;
    }

    if (product.colors.length > 0 && !selectedColor) {
      toast.warning(t('select_color'));
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price as number,
      image: product.images[0] || '',
      quantity,
      size: selectedSize,
      color: selectedColor,
    });

    hapticNotification('success');
    toast.success(t('add_to_cart'));
    navigate('/cart');
  };

  const nextImage = () => {
    if (!product) return;
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    if (!product) return;
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextImage();
    }
    if (isRightSwipe) {
      prevImage();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-surface-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-surface-500 dark:text-surface-400 mt-2">{t('loading')}</p>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-surface-500 dark:text-surface-400">
            {language === 'ru' ? 'Товар не найден' : 'Mahsulot topilmadi'}
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showBottomNav={false}>
      <div className="bg-white dark:bg-surface-900 pb-24">
        <div className="relative">
          {product.images.length > 0 ? (
            <>
              <div
                className="aspect-square bg-surface-100 dark:bg-surface-800 relative overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={product.images[currentImageIndex]}
                  alt={getLocalizedValue(product.name, language)}
                  className="w-full h-full object-cover"
                />

                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5 text-surface-900" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5 text-surface-900" />
                    </button>

                    <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
                      {product.images.map((_: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentImageIndex
                              ? 'bg-white w-6'
                              : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide bg-white dark:bg-surface-900">
                  {product.images.map((img: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        index === currentImageIndex
                          ? 'border-surface-900'
                          : 'border-transparent hover:border-surface-300'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <span className="text-surface-400">{t('no_image')}</span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-1">
            <h1 className="text-xl font-bold text-surface-900 dark:text-white flex-1 leading-tight">
              {getLocalizedValue(product.name, language)}
            </h1>
            <button
              onClick={handleShare}
              className="ml-3 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition text-surface-500 hover:text-surface-900"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {rating && rating.count > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.round(rating.average)
                        ? 'text-surface-900 fill-current'
                        : 'text-surface-300 dark:text-surface-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-surface-500 dark:text-surface-400">
                {rating.average.toFixed(1)} · {rating.count} {language === 'ru' ? 'отзывов' : 'sharh'}
              </span>
            </div>
          )}

          <p className="text-2xl font-extrabold text-surface-900 mb-4">
            {formatPrice(product.price as number)}
          </p>

          {product.stock > 0 ? (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
              <span className="text-sm text-success font-medium">
                {t('in_stock')}
                {product.stock < 10 && ` — ${language === 'ru' ? 'осталось' : 'qoldi'}: ${product.stock}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-danger rounded-full"></div>
              <span className="text-sm text-danger font-medium">{t('out_of_stock')}</span>
            </div>
          )}

          {product.sizes.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2.5">
                {t('select_size')}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size: string) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[44px] h-11 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      selectedSize === size
                        ? 'bg-surface-900 text-white border-surface-900'
                        : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-white border-surface-200 dark:border-surface-600 hover:border-surface-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.colors.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2.5">
                {t('select_color')}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((color: { name: string; hex: string }) => {
                  const col = color;
                  return (
                    <button
                      key={col.hex}
                      onClick={() => setSelectedColor(col)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm transition-all ${
                        selectedColor?.hex === col.hex
                          ? 'border-surface-900 bg-surface-50 dark:bg-surface-800'
                          : 'border-surface-200 dark:border-surface-600 hover:border-surface-400'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full border border-surface-200 flex-shrink-0"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="text-surface-900 dark:text-white font-medium">{col.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2.5">
              {t('quantity')}
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-11 h-11 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 flex items-center justify-center hover:border-surface-400 transition active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xl font-bold min-w-[2rem] text-center text-surface-900 dark:text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="w-11 h-11 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 flex items-center justify-center hover:border-surface-400 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
              {t('description')}
            </h2>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed whitespace-pre-line">
              {getLocalizedValue(product.description, language)}
            </p>
          </div>

          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
                {t('specifications')}
              </h2>
              <div className="bg-surface-50 dark:bg-surface-800 rounded-xl overflow-hidden">
                {Object.entries(product.specs).map(([key, value], i) => (
                  <div
                    key={key}
                    className={`flex justify-between py-2.5 px-4 text-sm ${i > 0 ? 'border-t border-surface-100 dark:border-surface-700' : ''}`}
                  >
                    <span className="text-surface-500 dark:text-surface-400">{key}</span>
                    <span className="text-surface-900 dark:text-white font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviews.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
                {language === 'ru' ? 'Отзывы' : 'Sharhlar'} ({reviews.length})
              </h2>
              <div className="space-y-3">
                {reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-surface-900 dark:text-white">
                          {review.user_name}
                        </span>
                        {review.is_verified_purchase && (
                          <span className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-0.5 rounded-full">
                            {language === 'ru' ? 'Проверено' : 'Tasdiqlangan'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < review.rating
                                ? 'text-surface-900 fill-current'
                                : 'text-surface-300 dark:text-surface-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-surface-600 dark:text-surface-400">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 glass dark:glass-dark border-t border-surface-100/50 dark:border-surface-700/50 px-4 py-3 pb-safe shadow-elevated z-40">
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="w-full btn-brand py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:bg-surface-300 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>{product.stock === 0 ? t('out_of_stock') : t('add_to_cart')}</span>
          </button>
        </div>
      </div>
    </Layout>
  );
};
