export const APP_NAME = 'UCP Commerce';
export const APP_DESCRIPTION = 'Optimisez la visibilité de vos produits sur les LLMs';

export const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  NEEDS_WORK: 40,
} as const;

export const PLANS = {
  FREE: { name: 'Starter', products: 50, analyses: 5, price: 0 },
  STARTER: { name: 'Starter', products: 50, analyses: 100, price: 0 },
  PRO: { name: 'Pro', products: 500, analyses: Infinity, price: 49 },
  ENTERPRISE: { name: 'Enterprise', products: Infinity, analyses: Infinity, price: 199 },
} as const;

export const PLATFORMS = [
  { id: 'shopify', name: 'Shopify', logo: '🛍️' },
  { id: 'woocommerce', name: 'WooCommerce', logo: '🔌' },
  { id: 'prestashop', name: 'PrestaShop', logo: '🏪' },
  { id: 'magento', name: 'Magento', logo: '🔶' },
  { id: 'custom', name: 'API Custom', logo: '⚙️' },
] as const;

export const UCP_SCHEMA_VERSION = '1.0';
export const UCP_VERSION = '1.0.0';

export const MAX_PRODUCT_NAME_LENGTH = 500;
export const MAX_DESCRIPTION_LENGTH = 10000;
export const MAX_PRODUCTS_PER_PAGE = 100;
export const DEFAULT_CURRENCY = 'EUR';
