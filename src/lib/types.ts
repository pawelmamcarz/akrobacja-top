// Cloudflare bindings
export interface Env {
  DB: D1Database;
  VOUCHER_BUCKET: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  WFIRMA_ACCESS_KEY: string;
  WFIRMA_SECRET_KEY: string;
  WFIRMA_LOGIN: string;
  WFIRMA_PASSWORD: string;
  WFIRMA_APP_KEY: string;
  WFIRMA_COMPANY_ID: string;
  RESEND_API_KEY: string;
  SITE_URL: string;
  ADMIN_PASSWORD: string;
  SMSAPI_TOKEN: string;
  PRINTFUL_TOKEN: string;
  GEMINI_API_KEY: string;
  META_PIXEL_ID?: string;
  META_CAPI_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
  CRON_SECRET?: string;
  AI: Ai;
}

// Voucher packages
export const PACKAGES = {
  pierwszy_lot: {
    id: 'pierwszy_lot',
    name: 'Pierwszy Lot',
    subtitle: 'Twoje pierwsze spotkanie z Extra 300L',
    price: 199900, // grosze
    duration: 'do 15 min lotu + 20 min briefing',
    features: ['Do 15 minut w powietrzu', 'Do +4G / -2G', 'Lot zapoznawczy z podstawowymi figurami'],
  },
  adrenalina: {
    id: 'adrenalina',
    name: 'Adrenalina',
    subtitle: 'Pelen program akrobacyjny z Mistrzem',
    price: 299900,
    duration: '20 min lotu + 40 min briefing + 15 min debriefing',
    features: ['20 minut w powietrzu', 'Do +6G / -4G', 'Pelny program: petle, beczki, roll, lot odwrocony'],
  },
  masterclass: {
    id: 'masterclass',
    name: 'Masterclass',
    subtitle: 'Sesja szkoleniowa dla pilotow PPL(A)',
    price: 499900,
    duration: 'do 50 min w powietrzu + briefing + debriefing',
    features: ['Do 50 minut w powietrzu', 'Wyprowadzanie z korkociagu, figury zaawansowane', 'Wymagana licencja PPL(A)'],
  },
  // Test-only product — niewidoczne w publicznym UI, dostępne tylko z /test-konwersji.
  // Webhook NIE generuje vouchera PDF i NIE wystawia faktury wfirma dla tego packageId.
  // Cena 200 gr = 2 PLN (minimum Stripe Checkout dla PLN).
  test_naklejka: {
    id: 'test_naklejka',
    name: 'Naklejka testowa',
    subtitle: 'Produkt testowy 2 zl — do weryfikacji konwersji Google Ads / Meta Pixel',
    price: 200,
    duration: 'n/a',
    features: ['Test live checkoutu Stripe', 'Test conversion na /sukces', 'Brak vouchera PDF i faktury'],
  },
} as const;

export const VIDEO_ADDON_PRICE = 29900; // 299 PLN

export type PackageId = keyof typeof PACKAGES;

export interface Order {
  id: string;
  voucher_code: string;
  package_id: PackageId;
  video_addon: boolean;
  customer_name: string;
  customer_email: string;
  customer_nip?: string;
  amount: number;
  stripe_session_id: string;
  status: 'pending' | 'processing' | 'paid' | 'cancelled' | 'failed' | 'expired';
  invoice_id?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
  // Personalizacja vouchera (migration 007)
  recipient_name?: string;   // imię obdarowanego, fallback do customer_name w PDF
  dedication?: string;       // tekst dedykacji (max 200 znaków)
  send_at?: string;          // ISO datetime — kiedy wysłać voucher email (cron)
  email_sent_at?: string;    // kiedy faktycznie wysłaliśmy voucher email (idempotency)
}
