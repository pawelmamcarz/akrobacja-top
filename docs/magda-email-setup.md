# magda@akrobacja.com, setup

## Stan po tej turze (gotowe automatycznie)

1. **email-worker zaktualizowany** (`email-worker/src/index.ts`):
   ```ts
   'magda@akrobacja.com': ['pawel@mamcarz.com'],
   ```
   Tymczasowo maile leca do Pawla zeby nic nie zginelo.

2. **email-worker deployed** do CF (`akrobacja-email-fanout`, current version
   `4ee90a89-8f4d-4e14-bf78-bb5090120284`). Logika fanout aktywna.

## Co Pawel musi zrobic w CF Dashboard (30 sekund)

Wrangler nie ma scope-u `email_routing:write`, wiec sam routing aliasu nie da
sie wgrac z CLI. Trzeba klikniec.

1. CF Dashboard -> akrobacja.com zone -> **Email -> Email Routing**.
2. Zakladka **Routes** (Custom addresses).
3. **Create Address**:
   - Custom address: `magda@akrobacja.com`
   - Action: **Send to a Worker**
   - Worker: `akrobacja-email-fanout` (juz na liscie z deploymentu krok wczesniejszy)
4. Save.

Test: wyslac z prywatnego maila wiadomosc na magda@akrobacja.com. Powinna
przyjsc na pawel@mamcarz.com z naglowkiem `Forwarded-To: pawel@mamcarz.com`.

## Gdy Magda potwierdzi swoj prywatny destination

1. Pawel: CF Dashboard -> Email Routing -> **Destination Addresses** -> Add ->
   wpisuje prywatny mail Magdy -> Verify (CF wysle link weryfikacyjny).
2. Magda klika link w mailu i potwierdza.
3. Edycja `email-worker/src/index.ts`:
   ```ts
   'magda@akrobacja.com': ['magda-prywatny@example.com'],
   ```
   (mozna tez zostawic Pawla jako CC: `['magda@...', 'pawel@mamcarz.com']`).
4. Redeploy: `cd email-worker && npx wrangler deploy --config wrangler.toml`.

## Wysylanie z magda@akrobacja.com (out-of-scope dla CF Email Routing)

CF Email Routing **tylko forwarduje**, nie pozwala wysylac z aliasu. Zeby Magda
mogla wysylac jako magda@akrobacja.com, opcje:

- **Gmail Send-as**: w jej Gmailu dodac alias magda@akrobacja.com z SMTP relay
  (Resend lub Mailgun jako relay z DKIM dla akrobacja.com).
- **Resend Inbox** (nowe Resend feature 2026): pelne zarzadzanie inboxem z
  poziomu Resend. Wymaga nowego planu.
- **Worker-side smtp send**: napisac nowy endpoint /api/admin/send-as-magda
  z Resend API uzywajacym domain DKIM. Tylko jezeli to bedzie czesto uzywane.

Decyzja Pawla. Domyslnie zostaje **forward-only**, magda odpowiada ze swojego
prywatnego konta.
