# akrobacja-email-fanout

CF Email Routing Worker - workaround na ograniczenie Email Routing dashboard
(tylko 1 destination per custom address). Forwarduje przychodzace maile na
`voucher@akrobacja.com` rownolegle do **Pawla i Macieja**.

Mapowanie aliasow w `src/index.ts` -> `ROUTING`.

## Deploy

```bash
cd email-worker
npx wrangler deploy
```

(globalne `wrangler` z `package.json` rodzica wystarczy - nie ma osobnego
`package.json` tutaj.)

## Konfiguracja w CF Dashboard

Po deployu:

1. CF Dashboard -> Email Routing -> Custom Addresses
2. `voucher@akrobacja.com` -> **Edit**
3. Action: zmien z "Send to an email" na **"Send to a Worker"**
4. Wybierz: `akrobacja-email-fanout`
5. Save

Od teraz kazdy mail na voucher@ idzie przez Workera ktory forwarduje do
obu skrzynek (Pawel + Maciej). Bouncey z destination addresses widoczne
w CF Email Routing -> Activity.

## Dodawanie kolejnych aliasow

Edytuj `ROUTING` w `src/index.ts`:

```ts
const ROUTING: Record<string, string[]> = {
  'voucher@akrobacja.com': ['pawel@mamcarz.com', 'maciej.kulaszewski@gmail.com'],
  'info@akrobacja.com': ['pawel@mamcarz.com', 'maciej.kulaszewski@gmail.com'],
  // ...
};
```

Potem `npx wrangler deploy` + w CF Dashboard zmien Action dla nowego aliasu
na "Send to a Worker".

## Destinations musza byc zweryfikowane

CF Email Routing wymaga zeby kazdy `forward(dest)` adres byl zweryfikowany.
Sprawdz: CF Dashboard -> Email Routing -> Destination Addresses. Jezeli `dest`
nie jest na liscie (zielona galka), forward sie wywali.

Aktualnie zweryfikowane:
- pawel@mamcarz.com
- maciej.kulaszewski@gmail.com

## Logi

```bash
npx wrangler tail akrobacja-email-fanout
```

Pokazuje console.warn z czesciowymi failures forwardow.
