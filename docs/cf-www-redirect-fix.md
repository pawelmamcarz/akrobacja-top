# Fix podwojnego 301 dla http://www.akrobacja.com/

## Problem

`http://www.akrobacja.com/` aktualnie idzie przez DWA przekierowania zamiast
jednego:

1. CF edge "Always Use HTTPS": `http://www.akrobacja.com/` -> `https://www.akrobacja.com/`
2. Middleware `_middleware.ts` strip www: `https://www.akrobacja.com/` -> `https://akrobacja.com/`

Google traktuje multi-hop 301 jako mniej efektywny (crawl budget + nieco mniej
PageRank). Cel: jeden hop bezposrednio z `http://www.akrobacja.com/*` na
`https://akrobacja.com/*`.

## Dlaczego nie da sie tego zrobic przez `wrangler`

`npx wrangler whoami` na koncie pokazuje OAuth token bez scope'u
`Zone:Rulesets:Edit`. Wrangler nie ma tez wbudowanego polecenia do tworzenia
Single Redirect / Bulk Redirect rules. Dodatkowo Worker zdeployowany na
`www.akrobacja.com/*` nie pomaga, bo CF "Always Use HTTPS" odpala sie zanim
Worker zobaczy request, wiec http -> https hop pozostaje.

Musi byc zrobione albo (a) recznie w dashboardzie albo (b) przez CF API z
nowym tokenem.

## Opcja A: Cloudflare Dashboard (zalecane, 30 sekund)

1. Otworz dashboard, wejdz w zone `akrobacja.com`.
2. Lewe menu: **Rules -> Redirect Rules**.
3. Klik **Create rule**. Nazwij: `www-to-apex`.
4. **If incoming requests match**:
   - Field: `Hostname`
   - Operator: `equals`
   - Value: `www.akrobacja.com`
5. **Then**:
   - Type: `Dynamic`
   - Expression: `concat("https://akrobacja.com", http.request.uri.path)`
   - Status code: `301`
   - Preserve query string: `On`
6. Deploy.
7. Weryfikacja: `curl -sI http://www.akrobacja.com/` powinien zwrocic jeden
   301 z `Location: https://akrobacja.com/` (zamiast dwoch 301 jak teraz).

Po tej regule blok www-strip w `functions/_middleware.ts` (sprawdza
`hostname !== PRIMARY_HOST`) staje sie redundantny dla `www.`, ale zostawiamy
go jako fallback dla `akrobacja.top` i innych potencjalnych domen.

## Opcja B: CF API + curl (gdy chcesz zautomatyzowac)

Wymaga utworzenia nowego tokena API w CF (dashboard -> My Profile -> API
Tokens -> Create Token -> Custom token z uprawnieniem
`Zone:Zone WAF:Edit` + `Zone:Read` dla `akrobacja.com`).

```bash
export CF_API_TOKEN="..."           # nowy token z dashboardu
export CF_ZONE_ID="..."             # akrobacja.com zone ID (Overview -> API)

# 1. Znajdz ruleset dla http_request_dynamic_redirect (zwykle istnieje jeden
#    "Default" lub trzeba go stworzyc).
curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rulesets" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result[] | select(.phase=="http_request_dynamic_redirect") | {id,name,phase}'

# 2. Dodaj regule (zastap RULESET_ID wynikiem z punktu 1, lub stworz nowy
#    ruleset jezeli zwraca pusta liste).
RULESET_ID="..."
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rulesets/$RULESET_ID/rules" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "action": "redirect",
    "action_parameters": {
      "from_value": {
        "status_code": 301,
        "target_url": {
          "expression": "concat(\"https://akrobacja.com\", http.request.uri.path)"
        },
        "preserve_query_string": true
      }
    },
    "expression": "(http.host eq \"www.akrobacja.com\")",
    "description": "www-to-apex single hop",
    "enabled": true
  }'
```

## Po fixie

Sprawdz wszystkie cztery warianty - kazdy musi byc jednym 301:

```bash
curl -sI http://akrobacja.com/           # 301 -> https://akrobacja.com/ (CF Always Use HTTPS)
curl -sI http://www.akrobacja.com/       # 301 -> https://akrobacja.com/ (nowa regula)
curl -sI https://www.akrobacja.com/      # 301 -> https://akrobacja.com/ (nowa regula lub middleware)
curl -sI https://akrobacja.com/          # 200 OK
```

GSC "Page with redirect" dla `http://www.akrobacja.com/` powinno zniknac
z indexu w ciagu kilku tygodni - Google zwykle ponownie crawl'uje i zauwaza
zmiane redirect chain.
