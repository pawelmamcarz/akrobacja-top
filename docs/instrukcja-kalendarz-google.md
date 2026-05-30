# Jak dodać lot / serwis do kalendarza (Paweł + Maciej)

Mamy **jeden wspólny kalendarz Google** „Loty akrobacja.com". Wszystko, co w nim
wpiszecie, w ciągu ~15 minut **pojawia się na stronie** i **blokuje wolne terminy
dla klientów** (klient nie zarezerwuje lotu, gdy samolot jest zajęty lub w serwisie).

> Dzięki temu klienci widzą realną dostępność SP-EKS i nie dzwonią z pytaniami.

---

## Najważniejsze w 30 sekund

1. Dodaj wydarzenie **w kalendarzu „Loty akrobacja.com"** (nie w swoim prywatnym!).
2. Ustaw **poprawną godzinę OD–DO** — to ona blokuje terminy klientów.
3. Nazwa zaczyna się od słowa kluczowego, jeśli to **nie** zwykły lot (patrz tabela niżej).
4. Gotowe. Po ~15 min termin znika ze strony jako wolny.

---

## Jak dodać wydarzenie (telefon lub komputer)

**Telefon (Google Kalendarz):**
1. Otwórz aplikację Google Kalendarz.
2. „+" → **Wydarzenie**.
3. **WAŻNE:** u góry, przy nazwie kalendarza, wybierz **„Loty akrobacja.com"**
   (domyślnie podpowiada Twój prywatny — zmień!).
4. Wpisz nazwę, ustaw datę i **godzinę rozpoczęcia i zakończenia**.
5. Zapisz.

**Komputer (calendar.google.com):**
1. Kliknij na siatce kalendarza w wybraną godzinę (albo „Utwórz").
2. W okienku wydarzenia, w polu kalendarza, wybierz **„Loty akrobacja.com"**.
3. Nazwa + godziny OD–DO → **Zapisz**.

---

## Nazwa decyduje o typie (i kolorze blokady)

System rozpoznaje typ po **pierwszych słowach nazwy**:

| Jeśli w nazwie jest… | Typ | Przykład nazwy |
|---|---|---|
| (nic szczególnego) | **Lot** | `Lot voucher`, `Adrenalina`, `Lot prywatny` |
| `serwis`, `przegląd`, `naprawa`, `konserwacja`, `usterka` | **Serwis** | `Serwis 100h`, `Przegląd okresowy` |
| `trening`, `szkolenie`, `nauka`, `lekcja` | **Trening** | `Trening przed zawodami` |
| `pokaz`, `airshow`, `show`, `event` | **Pokaz** | `Pokaz Radom` |

Każdy z tych typów **blokuje** termin dla klienta. Jeśli nie wiesz — zostaw zwykłą
nazwę, będzie potraktowane jako lot (i tak zablokuje).

---

## Godziny = blokada

Blokujemy **terminy klienta (sloty 1-godzinne)**, które nachodzą na Twoje wydarzenie.

- Wydarzenie **10:00–12:00** → klient nie zarezerwuje slotów **10:00** i **11:00**.
- Czas liczony **po polsku** (Europe/Warsaw) — Google sam o to dba.
- Jeśli lot to „cały dzień" — zaznacz „Cały dzień", wtedy blokuje cały dzień.

Daj realny zakres (z buforem na tankowanie/kołowanie), żeby klient nie wpadł w okno,
gdy samolot jeszcze lata.

---

## Odwołanie / zwolnienie terminu

- **Usuń** wydarzenie albo **zmień godzinę** w kalendarzu Google.
- Po najbliższej synchronizacji (~15 min) termin znów jest **wolny** na stronie.

---

## Zasady (ważne)

- ✅ Dodawaj **tylko** w kalendarzu „Loty akrobacja.com" — prywatny się nie synchronizuje.
- 🔒 Kalendarz jest **publiczny** (technicznie). **Nie wpisuj danych klienta**
  (nazwisko, telefon, e-mail) w nazwie ani opisie. Wystarczy np. `Lot voucher` albo
  `Adrenalina – para`.
- ⏱️ Synchronizacja co ~15 min — to nie jest natychmiastowe.
- 📆 Synchronizujemy okno od 7 dni wstecz do 12 miesięcy w przód.

---

## Pytania / nie działa?

Jeśli wydarzenie nie pojawia się na stronie po ~20 min:
- sprawdź, czy dodane jest w kalendarzu **„Loty akrobacja.com"** (nie prywatnym),
- sprawdź, czy ma ustawioną **godzinę** (nie jest puste),
- napisz do Pawła.

---

### (Dla Pawła — jednorazowe włączenie)

**0) Najpierw utwórz kalendarz** (tylko na komputerze — telefon nie pozwala utworzyć):
1. Wejdź na **calendar.google.com**.
2. Przy „Inne kalendarze" (lewa kolumna) kliknij **„+"** → **„Utwórz nowy kalendarz"**.
3. Nazwa: **`Loty akrobacja.com`**, strefa **(GMT+01:00) Warszawa** → **„Utwórz kalendarz"**.

Potem są **dwie osobne rzeczy** w ustawieniach tego kalendarza:

> Uwaga na „dam mu link": **link = tylko podgląd** — Maciej zobaczy, ale nie doda lotu.
> Żeby mógł dodawać, użyj punktu **A** poniżej (dodanie jego Gmaila z prawem edycji);
> kalendarz pojawi się u niego sam, bez linku.

**A) Żeby Maciej (i każdy inny) mógł DODAWAĆ loty:**
- „Udostępnij konkretnym osobom" → dodaj e-mail Macieja → uprawnienie
  **„Wprowadzanie zmian w wydarzeniach"**. Maciej zobaczy kalendarz u siebie w
  aplikacji i dodaje loty tak jak Ty.

**B) Żeby STRONA mogła CZYTAĆ kalendarz (read-only):**
1. „Uprawnienia dostępu" → zaznacz **„Udostępnij publicznie”**.
2. „Zintegruj kalendarz" → skopiuj **„Tajny adres w formacie iCal”**.
3. Wklej ten URL w czacie z asystentem (Claude Code) — reszta dzieje się sama:
   secret `GOOGLE_CALENDAR_ICS_URL` + harmonogram crona `/api/cron/sync-google-calendar` (~15 min).
   Pod maską: `npx wrangler pages secret put GOOGLE_CALENDAR_ICS_URL --project-name=akrobacja-top`.
