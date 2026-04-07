# TODO — sobota

## Wdrożenie realnych ID trackingu (wymaga akcji właściciela)

**Priorytet:** wysoki
**Czas:** ~20 min

### Co podstawić

W `public/assets/site-enhancements.js` jest placeholder:

```js
var GTM_ID = window.__GTM_ID__ || 'GTM-XXXXXXX';
```

### Kroki

1. Założyć kontener GTM na https://tagmanager.google.com (jeśli jeszcze nie ma)
2. W GTM wpiąć:
   - Google Analytics 4 (GA4 Configuration Tag z Measurement ID `G-XXXXXXXX`)
   - Meta Pixel (Custom HTML Tag z base code Pixela)
   - Microsoft Clarity (Custom HTML Tag z kodem Clarity)
3. Skonfigurować triggery na eventach z dataLayer:
   - `cta_click` → GA4 event `select_content`
   - `exit_intent_show` → GA4 event `exit_intent_show`
   - `page_view_enhanced` → GA4 event `page_view`
4. Podstawić realny ID `GTM-XXXXXXX` w `public/assets/site-enhancements.js` (jeden string).
5. Opublikować kontener w GTM.
6. Weryfikacja: GA4 DebugView + GTM Preview na 3 URL: `/`, `/lot-akrobacyjny`, `/blog/lot-akrobacyjny-cena-2026`.
7. Test konwersji: pełny flow od blog → `/kalendarz` → `/sukces` z GTM Preview włączonym.

### Po wdrożeniu
- Dodać kontener Meta Pixel Events Manager → event `Purchase` na `/sukces`
- Dodać heatmapę Clarity na `/lot-akrobacyjny` i `/kalendarz` (monitor 7 dni)
- Zweryfikować Rich Results Test dla wszystkich nowych blogów
