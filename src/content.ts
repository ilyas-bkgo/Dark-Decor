export const OFFERS = [
  { quantity: 1 as const, price: 149, label: 'قطعة واحدة', description: 'حصيرة تجفيف واحدة' },
  { quantity: 2 as const, price: 249, label: 'قطعتان', description: 'حصيرتا تجفيف', saving: 49 },
];

export const INTRO_BENEFIT = 'امتصاص الماء';

export const FACTS = [
  { value: '149', unit: 'درهم', label: 'لحصيرة واحدة' },
  { value: '249', unit: 'درهم', label: 'لحصيرتين · وفّري 49 درهم' },
  { value: 'نقدًا', unit: '', label: 'الدفع عند الاستلام' },
  { value: 'كل المدن', unit: '', label: 'التوصيل لجميع المدن' },
];

export const PHOTOS = {
  hero: 'hero',
  kitchenDark: 'kitchen-dark',
  kitchenLight: 'kitchen-light',
  kitchenDetail: 'kitchen-detail',
} as const;

export const ORDER_STEPS = [
  { title: 'اختاري العرض', body: 'قطعة واحدة أو قطعتان بسعر أوفر.' },
  { title: 'نؤكد معك الطلب', body: 'نتصل بك لتأكيد العنوان والتفاصيل.' },
  { title: 'استلمي وادفعي', body: 'يصلك الطلب وتدفعين عند الاستلام.' },
];
