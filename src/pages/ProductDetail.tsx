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
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                    >
                      <ChevronRight className="w-6 h-6" />
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
                <div className="overflow-x-auto px-4 py-2 flex space-x-2">
                  {product.images.map((img: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        index === currentImageIndex
                          ? 'border-surface-900'
                          : 'border-surface-300 dark:border-surface-600'
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

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex-1">
              {getLocalizedValue(product.name, language)}
            </h1>
            <button
              onClick={handleShare}
              className="ml-2 p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>

          {rating && rating.count > 0 && (
            <div className="flex items-center space-x-2 mb-3">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(rating.average)
                        ? 'text-yellow-400 fill-current'
                        : 'text-surface-300 dark:text-surface-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-surface-600 dark:text-surface-400">
                {rating.average.toFixed(1)} ({rating.count} {language === 'ru' ? 'отзывов' : 'sharh'})
              </span>
            </div>
          )}

          <p className="text-3xl font-bold text-surface-900 mb-4">
            {formatPrice(product.price as number)}
          </p>

          {product.stock > 0 ? (
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600 dark:text-green-400">
                {t('in_stock')}
                {product.stock < 10 && ` (${language === 'ru' ? 'осталось' : 'qoldi'}: ${product.stock})`}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-600 dark:text-red-400">{t('out_of_stock')}</span>
            </div>
          )}

          {product.sizes.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('select_size')}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size: string) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      selectedSize === size
                        ? 'bg-surface-900 text-white border-surface-900'
                        : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-white border-surface-300 dark:border-surface-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.colors.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('select_color')}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color: { name: string; hex: string }) => {
                  const col = color;
                  return (
                    <button
                      key={col.hex}
                      onClick={() => setSelectedColor(col)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
                        selectedColor?.hex === col.hex
                          ? 'border-surface-900 bg-surface-100'
                          : 'border-surface-300 dark:border-surface-600'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full border border-surface-300"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="text-sm text-surface-900 dark:text-white">{col.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              {t('quantity')}
            </p>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center hover:bg-surface-300 dark:hover:bg-surface-600"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-xl font-semibold min-w-[2rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center hover:bg-surface-300 dark:hover:bg-surface-600"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
              {t('description')}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 whitespace-pre-line">
              {getLocalizedValue(product.description, language)}
            </p>
          </div>

          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
                {t('specifications')}
              </h2>
              <div className="space-y-2">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between py-2 border-b border-surface-200 dark:border-surface-700"
                  >
                    <span className="text-surface-600 dark:text-surface-400">{key}</span>
                    <span className="text-surface-900 dark:text-white font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviews.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
                {language === 'ru' ? 'Отзывы' : 'Sharhlar'} ({reviews.length})
              </h2>
              <div className="space-y-4">
                {reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-surface-900 dark:text-white">
                          {review.user_name}
                        </span>
                        {review.is_verified_purchase && (
                          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                            {language === 'ru' ? 'Проверено' : 'Tasdiqlangan'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? 'text-yellow-400 fill-current'
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
