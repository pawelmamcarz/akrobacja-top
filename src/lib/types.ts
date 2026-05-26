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
  META_PIXEL_ID?: string;
  META_CAPI_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
  CRON_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  GOOGLE_PLACES_API_KEY?: string;
  GOOGLE_PLACE_ID?: string;
  KSEF_TOKEN?: string;          // KSeF API token (uprawnienia: przegladanie faktur)
  KSEF_NIP?: string;            // NIP firmy 10 cyfr (kontekst sesji KSeF)
  // Bielik 11B v2.3 GPU box przez CF Tunnel - https://llm.akrobacja.com (OpenAI-compatible).
  // Default endpoint = llm.akrobacja.com, override przez LLAMA_ENDPOINT.
  LLAMA_API_KEY?: string;
  LLAMA_ENDPOINT?: string;
  RAG_API_KEY?: string;         // https://rag.akrobacja.com - sentence-transformers + CLIP
  RAG_ENDPOINT?: string;
  BROWSERLESS_TOKEN?: string;   // https://scrape.akrobacja.com - headless Chromium
  BROWSERLESS_ENDPOINT?: string;
  AI: Ai;
  RATE_LIMIT_KV: KVNamespace;
  // R2 S3-compatible API credentials - used by direct-to-R2 multipart upload
  // (flight-media presign endpoint) for raw video files above the Pages
  // Functions 500 MB body limit. Set these once: wrangler pages secret put.
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
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
    subtitle: 'Pełen program akrobacyjny z Mistrzem',
    price: 299900,
    duration: '20 min lotu + 40 min briefing + 15 min debriefing',
    features: ['20 minut w powietrzu', 'Do +6G / -4G', 'Pełny program: pętle, beczki, roll, lot odwrócony'],
  },
  // 2x Pierwszy Lot dla pary, oba loty osobno (kazdy partner leci sam w przednim fotelu).
  // Cena = 2×1999 - 221 zł rabatu = 3777 zł. PDF generuje jeden voucher na 2 loty, klient
  // ustala 2 terminy przy rezerwacji. second_seat addon nie ma sensu (juz sa 2 loty).
  para: {
    id: 'para',
    name: 'Para',
    subtitle: '2 loty Pierwszy Lot dla dwojga, oszczędność 221 zł',
    price: 377700,
    duration: '2× (do 15 min lotu + 20 min briefing)',
    features: [
      '2 osobne loty (każdy partner leci sam)',
      'Do 15 minut w powietrzu na osobę',
      'Do +4G / -2G',
      'Podstawowe figury akrobacyjne',
      'Terminy ustalacie niezależnie, oszczędność 221 zł vs 2× pakiet osobno',
    ],
  },
  masterclass: {
    id: 'masterclass',
    name: 'Masterclass',
    subtitle: 'Sesja szkoleniowa dla pilotów PPL(A)',
    price: 499900,
    duration: 'do 50 min w powietrzu + briefing + debriefing',
    features: ['Do 50 minut w powietrzu', 'Wyprowadzanie z korkociągu, figury zaawansowane', 'Wymagana licencja PPL(A)'],
  },
  // Test-only product - niewidoczne w publicznym UI, dostępne tylko z /test-konwersji.
  // Webhook NIE generuje vouchera PDF i NIE wystawia faktury wfirma dla tego packageId.
  // Cena 200 gr = 2 PLN (minimum Stripe Checkout dla PLN).
  test_naklejka: {
    id: 'test_naklejka',
    name: 'Naklejka testowa',
    subtitle: 'Produkt testowy 2 zl - do weryfikacji konwersji Google Ads / Meta Pixel',
    price: 200,
    duration: 'n/a',
    features: ['Test live checkoutu Stripe', 'Test conversion na /sukces', 'Brak vouchera PDF i faktury'],
  },
} as const;

export const VIDEO_ADDON_PRICE = 29900; // 299 PLN

// Cross-sell addons available in the voucher checkout modal. Each addon is a separate
// Stripe line item, a separate wFirma invoice line and persisted in orders.addons as a
// JSON array of ids. Names are ASCII-safe because they end up in Stripe metadata and
// product_data.name (CLAUDE.md § Conventions). The `video` entry keeps parity with the
// legacy `video_addon` boolean column so older orders render correctly.
//
// applicablePackages restricts which packages can pick the addon (analog do
// DISCOUNTS.applicablePackages in checkout.ts). Omitted = any package.
export interface AddonSpec {
  id: string;
  price: number;              // grosze
  name: string;               // ASCII-safe - Stripe product_data.name
  invoiceName: string;        // PL z diakrytykami - wFirma invoicecontent.name
  applicablePackages?: PackageId[];
}

export const ADDONS: Record<string, AddonSpec> = {
  video: {
    id: 'video',
    price: VIDEO_ADDON_PRICE,
    name: 'Video 360 z lotu akrobacyjnego',
    invoiceName: 'Video 360° z lotu akrobacyjnego (montaż + MP4)',
  },
  second_seat: {
    id: 'second_seat',
    price: 79900,
    name: 'Drugi pasazer w samolocie',
    invoiceName: 'Drugi pasażer w Extra 300L (ten sam lot, briefing wspólny)',
    applicablePackages: ['pierwszy_lot', 'adrenalina'],
  },
  ground_photo: {
    id: 'ground_photo',
    price: 24900,
    name: 'Fotograf z ziemi (5 JPG w 48h)',
    invoiceName: 'Fotograf z ziemi - minimum 5 zdjęć JPG (dostarczone w 48h)',
  },
  framed_print: {
    id: 'framed_print',
    price: 19900,
    name: 'Wydruk + rama A3 najlepszego ujecia',
    invoiceName: 'Wydruk A3 + rama drewniana (wysyłka 7-14 dni po locie)',
  },
};

export type AddonId = keyof typeof ADDONS;

export function sumAddons(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (ADDONS[id]?.price ?? 0), 0);
}

export function validAddonIds(ids: readonly string[], packageId: PackageId): string[] {
  const seen = new Set<string>();
  return ids.filter(id => {
    if (seen.has(id)) return false;
    seen.add(id);
    const a = ADDONS[id];
    if (!a) return false;
    if (a.applicablePackages && !a.applicablePackages.includes(packageId)) return false;
    return true;
  });
}

// Google Search URL for the akrobacja.com business profile. Clicking "Napisz opinię"
// on this page opens the proper write-review dialog for the Google Business Profile
// of "akrobacja.com - Loty akrobacyjne Extra 300L". Used in every customer-facing
// review CTA (post-purchase, email, footer, post-flight follow-up).
export const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=akrobacja.com+%E2%80%94+Loty+akrobacyjne+Extra+300L&stick=H4sIAAAAAAAA_-NgU1I1qDAxN7RIMzc1NTYwtDAzMLK0MqhItrA0NTAzTLY0MDI1S00xWcSqm5hdlJ-UmJyVqJecn6vwqGGKgk9-SaUCVLgyKy9VwbWipChRwdjAwAcAB12ArlkAAAA&hl=pl&authuser=0';

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
  status: 'pending' | 'processing' | 'paid' | 'cancelled' | 'failed' | 'expired' | 'refunded';
  invoice_id?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
  // Personalizacja vouchera (migration 007)
  recipient_name?: string;   // imię obdarowanego, fallback do customer_name w PDF
  dedication?: string;       // tekst dedykacji (max 200 znaków)
  send_at?: string;          // ISO datetime - kiedy wysłać voucher email (cron)
  email_sent_at?: string;    // kiedy faktycznie wysłaliśmy voucher email (idempotency)
  addons?: string | null;    // JSON array of AddonId stringów (np. '["second_seat","ground_photo"]')
}

export interface Pilot {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  license_type?: string | null;
  license_number?: string | null;
  balance_minutes: number;
  insurance_status: string;
  verified: number;
  session_token?: string | null;
  session_expires_at?: string | null;
  last_login?: string | null;
  calendar_token?: string | null;
  is_instructor?: number;
  created_at: string;
}

export interface Aircraft {
  id: string;
  tail: string;
  type: string;
  notes?: string | null;
  active: number;
  created_at: string;
}

export type CalendarEventType = 'flight' | 'training' | 'maintenance' | 'show' | 'other';
export type CalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled';

export interface CalendarEvent {
  id: string;
  pilot_id: string;
  aircraft_id?: string | null;
  type: CalendarEventType;
  title?: string | null;
  notes?: string | null;
  start_at: string;                // ISO UTC z 'Z'
  end_at: string;
  status: CalendarEventStatus;
  source: 'manual' | 'booking';
  booking_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
