// CF Email Routing Worker - fanout do wielu destinations.
//
// Email przychodzacy na alias skonfigurowany w CF Dashboard (np. voucher@) trafia
// tutaj zamiast bezposrednio do skrzynki. forward() musi byc na adres zweryfikowany
// w "Destination Addresses" w CF Email Routing.
//
// Routing per recipient: rozpoznajemy do ktorego aliasu maila trafil i forwardujemy
// do odpowiedniej listy. Domyslnie (gdy nie pasuje zaden) forward do Pawla zeby nic
// nie zginelo.

export interface Env {}

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
  reply(message: any): Promise<void>;
}

const ROUTING: Record<string, string[]> = {
  // alias -> lista destination addresses (musza byc zweryfikowane w CF)
  'voucher@akrobacja.com': ['pawel@mamcarz.com', 'maciej.kulaszewski@gmail.com'],
  // Mozna dorzucic kolejne aliasy w przyszlosci, np:
  // 'maciej@akrobacja.com': ['maciej.kulaszewski@gmail.com', 'pawel@mamcarz.com'],
};

const DEFAULT_FALLBACK = ['pawel@mamcarz.com'];

export default {
  async email(message: ForwardableEmailMessage, _env: Env, _ctx: ExecutionContext): Promise<void> {
    const recipient = (message.to || '').toLowerCase().trim();
    const destinations = ROUTING[recipient] || DEFAULT_FALLBACK;

    // Forward do wszystkich rownolegle. Jezeli ktorys forward sie sypnie, pozostale
    // i tak dotra - nie chcemy zeby jeden niedzialajacy destination blokowal pozostale.
    const results = await Promise.allSettled(destinations.map((dest) => message.forward(dest)));

    const failures = results
      .map((r, i) => ({ r, dest: destinations[i] }))
      .filter(({ r }) => r.status === 'rejected');

    if (failures.length === destinations.length) {
      // Wszystkie forwardy padly - reject zeby SMTP wrocil bounce do nadawcy.
      message.setReject(`All forwards failed for ${recipient}`);
    } else if (failures.length > 0) {
      // Czesc zadzialala - log do CF Workers logs (wrangler tail).
      console.warn(
        `[email-fanout] ${recipient}: ${failures.length}/${destinations.length} forwards failed:`,
        failures.map((f) => f.dest).join(', '),
      );
    }
  },
};
