# Magda, onboarding 1-pager

Krotki przewodnik co masz w rece, czym sie zajmujesz, gdzie patrzysz.

## Twoja rola, w trzech zdaniach

Pilnujesz, zeby pieniadze i samolot dzialaly: sprzedaz voucherow leci, partnerstwa
nie zostawiaja nieotwartych spraw, samolot ma swieze przeglady, a wszystkie eventy
i pokazy maja kto, kiedy, ile. Szefem jest Pawel, on decyduje o wydatkach, cenach,
kampaniach i wszystkim co dotyczy spolki. Maciej Kulaszewski odpowiada za operacje
lotnicze, jego zadania to latanie, briefingi, pokazy, FCL.800, wszystko po stronie
samolotu i pilotow.

Masz pelny dostep do `/admin` (te same uprawnienia co Pawel). System nie ma trybu
ograniczonego, mozesz robic wszystko: dodawac przeglady, wystawiac faktury,
oznaczac zamowienia, blokowac kalendarz, wszystko. Z tej swobody korzystaj
odpowiedzialnie i potwierdzaj wieksze ruchy (np. wystawienie duzej FV na event)
z Pawlem.

## Dostep do /admin

1. Wejdz na `https://akrobacja.com/admin`.
2. Wpisz haslo (dostajesz osobno od Pawla, NIE udostepniaj nikomu).
3. Wszystkie taby sa Twoje: Zamowienia, Kalendarz, Piloci, Kursy, Blokady,
   Samolot, Merch, SMS Lista, WA Klikniecia, Maile, SEO, Leady.

## Codzienne / cotygodniowe zadania

### 1. Sprzedaz voucherow (codziennie 10 min)

`/admin` -> taba **Zamowienia**.

- Sprawdz nowe zamowienia z ostatniej doby (kolumna Status: `paid`).
- Jezeli ktores wisi w `pending` > 24h, zgloss Pawlowi (mogla nie zaskoczyc platnosc).
- Odpowiadaj na pytania klientow (info@akrobacja.com, voucher@akrobacja.com)
  o terminy lotu (taba **Kalendarz** pokazuje dostepne sloty), o pakiety, o czas
  waznosci vouchera.
- Faktura VAT na zamowienie z systemu: w tabie Zamowienia dla pozycji `paid`
  jest przycisk "Wystaw FV", on woala wFirme integracja i wystawia automatycznie.
- Faktura na event / pokaz / non-voucher: rob to recznie po stronie wFirma na razie
  (taby Zamowienia w admin nie obejmuja eventow). Dodanie przycisku do wystawiania
  recznej FV eventowej z poziomu admina jest na liscie TODO Pawla. Powiedz mu
  jezeli to potrzebujesz pilnie.

### 2. Partnerzy do uregulowania (priorytet pierwsze 4 tygodnie)

Dwa stare watki czekaja na zamkniecie:

**Prezent Marzeń**
- Co to jest: marketplace z prezentami emocjonalnymi. Sprzedawal nasze vouchery
  przez wlasny katalog. Wspolpraca historyczna, zostalo nieuregulowane.
- Co dodatkowo wiemy: ich katalog AKTUALNIE wystawia konkurujacy lot Extra 300
  z naszego lotniska (EPRP) pod firma Aeroklubu Warszawskiego. To znaczy ze ich
  kanal sprzedazy "naszego" produktu lata przez kogos innego. Reaktywacja
  kontraktu jest priorytetem biznesowym.
- Kontakt: Rafal Zamojski, r.zamojski@prezentmarzen.com (informacja z research
  agencji 2026-05).
- Co masz zrobic: skontaktuj sie z Rafalem, ustal: ile niezrealizowanych
  voucherow z PM krazy w obiegu, jakie sa nasze zobowiazania finansowe,
  czy wznawiamy wspolprace (i jesli tak, w jakich warunkach). Konkurujacy
  listing musi byc rozmowa.
- Co raportujesz Pawlowi: stan na pismie, kazdy nieotwarty voucher z PM ma kod
  i kwote, oczekujemy ich potwierdzenia.

**Aeroklub Warszawski**
- Co to jest: historyczny aeroklub przy ktorym kiedys operowal Extra 300L SP-EKS
  (lata ~2020-2022). Obecnie operujemy z Radomia (EPRP, Aeroklub Radomski).
- Co dodatkowo wiemy: Aeroklub Warszawski (lub ktos pod ich szyldem) ma teraz
  listing na Prezent Marzen / Super Prezenty z lotem akrobacyjnym z EPRP. Trzeba
  zrozumiec relacje i ustalic kto faktycznie wykonuje te loty (czy maja inny
  samolot, czy uzywaja naszego pod stara umowa, czy to falszywy listing).
- Co masz zrobic: ustal stan faktyczny, lista otwartych spraw, propozycja jak
  je zamknac (uregulowac, sprostowac, zglosic do marketplace'ow jezeli nie maja
  prawa do listingu).

Notuj wszystko w taba **Leady** w `/admin` (status: contacted / responded / won).
Druga opcja to Drive / Notion - czemu chcesz, tylko zeby Pawel mial dostep.

### 3. Pozyskiwanie nowych eventow na samolot (ciagle)

Extra 300L SP-EKS lata komercyjnie w trzech trybach:
- Loty pasazerskie z voucherow (sprzedaz online, masz w `/admin`).
- Pokazy lotnicze (festyny, airshow, otwarcia firm, eventy korporacyjne, slubu).
- Filmowe / reklamowe (rzadziej, krotsze umowy).

**Twoja czesc, sprzedaz B2B:**
- Sledz w `/admin` -> **WA Klikniecia** -> tabela "wg numeru naszego". Kazde
  klikniecie w numer Pawla lub Macieja z pozyczki/dotacji to potencjalny lead
  szkoleniowy. Jezeli widzisz tam tez klikniecia z `/pokazy-lotnicze`, to
  potencjalny lead eventowy. Sprawdz w "Ostatnie 200 klikniec" co napisali w
  prefilled text.
- W tabie **Leady** masz juz wstepna baze (zasilona przez nasze badania 2026-05):
  agencje eventowe, marketplace'y voucherowe, B2B platformy benefitowe, eventy
  airshow 2026, agencje slubu, branza motoryzacyjna, fundacje, media lifestyle.
  Pracujesz nad nimi systematycznie: kontakt, status, notatki.
- Cold-lead-scraper (taba **Scraper** lub w **Leady**) automatycznie poluje
  przetargi z e-Zamowienia.gov.pl i BZP zawierajace nasze slowa kluczowe.
  Wpisuje znaleziska jako leady z kategoria "scraped_tender". Sprawdzaj raz
  na 2 dni.
- Mailing do agencji eventowych w sezonie pre-festynowym (marzec-kwiecien).

W `/admin` -> **SMS Lista** widzisz osoby z newslettera. Wysylanie blastow
omawiajsz z Pawlem zanim wcisniesz.

### 4. Pilnowanie cash flow (cotygodniowo, ~30 min)

W `/admin`:
- **Zamowienia** -> u dolu statystyki: liczba zamowien, ile aktywnych, ile
  wykorzystanych voucherow, suma PLN. Notuj sobie tygodniowo, zobaczysz trend.
- **Maile** -> sprawdz czy nie ma bounce / complaint / failed > 0 w 7 dni
  (pokazuje sie czerwone alert pole na gorze taba). Jak jest, daj znac Pawlowi,
  bo to znaczy ze klient nie dostal vouchera.
- **WA Klikniecia** -> ile leadow w 7 dniach, ktora strona generuje, ktory numer.
- **SEO** -> raz na tydzien sprawdz czy nie ma czerwonych alertow przy
  destynacjach redirectow (oznacza zerwany link).

Raz na 2 tygodnie krotki raport do Pawla na Slacku / mailu: ile sprzedazy, ile
leadow, czy cos sie psuje.

### 5. Przeglady samolotu (raz na tydzien)

Przeglady techniczne robi nasz partner: **Milik / Ibex Aviation**. Nasze zadanie
to koordynacja terminow, nie samo wykonanie. Potrzebujesz dostepu PDT (pulpit
zdalny) do ich systemu, zaaranzujemy to z Pawlem.

`/admin` -> **Samolot**. Trzy sekcje do monitoringu:
- **Harmonogram przegladow**: lista nadchodzacych terminow (50h, 100h, roczny,
  silnik, smiglo, awionika). Sprawdzaj czy nie ma terminow w nadchodzacych 14
  dniach. Jezeli sa, koordynuj z Milikiem date i miejsce.
- **Dokumenty**: CofA, ARC, polisa OC, polisa NNW. Kazdy ma date waznosci.
  Krytyczne pilnowanie: polisa OC i ARC, bo ich brak = uziemiony samolot.
- **Piloci w polisie**: lista uprawnionych do latania SP-EKS. Tutaj tylko czytasz.

Reguly: 30 dni przed konczacym sie dokumentem -> alert do Pawla. 14 dni przed
przegladem -> drugi alert + kontakt do Milika.

## Kogo pytasz

- **Pawel Mamcarz**, wlasciciel + szef, +48 535 535 221, pawel@akrobacja.com
  - WSZYSTKO, w tym faktury, decyzje sprzedazowe, dostep, hasla, finanse,
    kampanie, partnerstwa, dostepy do narzedzi (Milik PDT, wFirma).
- **Maciej Kulaszewski**, pilot, +48 739 158 131, IG @bullet.aerobatics
  - Tylko stricte operacyjne kwestie lotnicze: dostepnosc samolotu w dany dzien,
    techniczna ocena czy lot jest mozliwy, pokazy lotnicze i ich kalendarz
    sportowy, FCL.800 / UPRT / Camp Akrobacyjny i pytania kursantow.

Default: pytaj Pawla. Maciej dostaje pytanie tylko jak musi (latanie / samolot).

## Pierwsze 7 dni, plan

1. Dzien 1-2: Zaloguj sie do `/admin`, klikaj wszystkie taby, zorientuj sie co
   widzisz. Otworz taba **Leady** i przegladnij baze (ok. 200+ kontaktow
   z research 2026-05). Zadaj pytania Pawlowi.
2. Dzien 3: Wez kontakt do Rafala z Prezent Marzen, wyslij pierwszy mail
   ustalajacy stan voucherow + nowa wspolprace.
3. Dzien 4-5: Skontaktuj sie z 5 najwyzszymi priorytetami z **Leady** kategoria
   `event_agency` (Aeropact, Eventify, ANTIDOTUM, Mazury AirShow, FSWO).
4. Dzien 6: Sprawdz przeglady samolotu, zrob liste dat granicznych na nastepne
   3 miesiace, skontaktuj sie z Milikiem.
5. Dzien 7: Krotki raport do Pawla: co wiesz, czego nie wiesz, co potrzebujesz.
