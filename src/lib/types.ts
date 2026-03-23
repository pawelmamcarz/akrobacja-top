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
  status: 'pending' | 'paid' | 'cancelled';
  invoice_id?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
}
