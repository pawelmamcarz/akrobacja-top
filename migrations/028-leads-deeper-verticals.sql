-- Migration 028: leads - 5 nowych pionow (deeper verticals 2026-05-21).
--
-- Dodaje leady z badan agentow dla kategorii:
--   private_banking     - bankowosc prywatna PL (dzialy concierge/lifestyle)
--   stag_hen            - agencje wieczoru kawalerskiego/panienskiego
--   car_club            - kluby samochodow luksusowych
--   film_production     - domy produkcyjne film/reklama
--   foreign_marketplace - zagraniczne platformy prezentow/przezyjgrafika
--
-- Format: INSERT OR IGNORE; klucz unikalnosci (name, category).
-- Uruchom dokladnie raz:
--   npx wrangler d1 execute akrobacja-db --remote --file=migrations/028-leads-deeper-verticals.sql

-- =============================================================
-- PRIVATE BANKING (11 leadow)
-- =============================================================

INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-pb-001','mBank Private Banking Concierge','private_banking',NULL,NULL,'+48 22 300 63 00','https://www.mbank.pl/private-banking/bankowosc-codzienna/uslugi/concierge/','Warszawa','high','research-agent','24h concierge dla klientow PB. Kontakt przez formularz pb lub biezacy opiekun klienta. Pitch: lot akrobacyjny jako gotowe doswiadczenie VIP dla klientow.'),
('l-pb-002','Citi Handlowy Citigold Private Client','private_banking',NULL,NULL,'+48 22 657 72 00','https://www.citibank.pl/en/accounts/citigold-private-client/','Warszawa','high','research-agent','Segment HNW, lifestyle management wbudowany. Kontakt: Senatorska 16, Warszawa. Pitch: unikalne doswiadczenie premium dla klientow Citigold.'),
('l-pb-003','BNP Paribas Wealth Management PL','private_banking',NULL,NULL,NULL,'https://www.bnpparibas.pl/wealthmanagement/kontakt','Warszawa','high','research-agent','Centra WM w 7 miastach. Formularz na bnpparibas.pl/wealthmanagement/kontakt. Pitch: lot akrobacyjny jako benefit dla klientow Wealth Management.'),
('l-pb-004','Pekao Private Banking','private_banking',NULL,NULL,'+48 22 591 20 10','https://www.pekao.com.pl/private-banking/','Warszawa','high','research-agent','Infolinia 24h dla klientow PB z aktywami 1 mln+. Concierge asystent w standardzie. Pitch: exkluzywna atrakcja dla top segmentu.'),
('l-pb-005','PKO BP Bankowosc Prywatna','private_banking',NULL,NULL,'+48 22 563 11 18','https://www.pkobp.pl/bankowosc-prywatna/','Warszawa','high','research-agent','Konto Platynowe II z pakietem Concierge. Lifestyle Manager dla Mastercard World Elite. Oddzial PB: ul. Piekna 18, Warszawa.'),
('l-pb-006','ING Private Banking','private_banking',NULL,NULL,NULL,'https://www.ing.pl/private-banking','Katowice','high','research-agent','Dedykowany opiekun PB + concierge w ramach premium karty. Kontakt przez formularze ing.pl/private-banking. Pitch: nowatorska atrakcja w ofercie zycia.'),
('l-pb-007','Santander/Erste Private Banking PL','private_banking',NULL,'kontakt@santander.pl',NULL,'https://www.erste.pl/private-banking','Warszawa','medium','research-agent','Santander Bank Polska przeszedl pod Erste. PB na Placu Europejskim 3A. Concierge Work Cafe Prime.'),
('l-pb-008','Quintessentially Poland','private_banking','Pawel Lazowski (CEO)',NULL,'+48 22 104 50 38','https://quintessentially.com/locations/poland','Warszawa','high','research-agent','Globalny lider concierge lifestyle management, biuro w Warszawie od 2013. Lazowski CEO mowi po PL/DE/EN. Bezposredni kanal do HNW klientow wielu bankow jednoczesnie. Najwyzszy priorytet w pionie PB.'),
('l-pb-009','Supreme Concierge Poland','private_banking',NULL,NULL,NULL,'https://supremeconcierge.pl','Warszawa','medium','research-agent','20+ lat doswiadczenia concierge. Obsluguje klientow korporacyjnych i prywatnych. Pitch: lot jako ready-to-deliver experience w ich katalogu.'),
('l-pb-010','JS Private Banking','private_banking',NULL,NULL,NULL,'https://jsprivatebanking.com/concierge-services/','Warszawa','low','research-agent','Niezalezna firma concierge skierowana do UHNW. Dopasowany do modelu partnerskiego.'),
('l-pb-011','Hospitality Warsaw (ECC)','private_banking',NULL,NULL,NULL,'https://www.exclusiveconciergeclub.com/cities/warsaw-76','Warszawa','low','research-agent','Premium concierge dla korporacji i VIP w Warszawie. Potencjal jako reseller doswiadczen.');

-- =============================================================
-- STAG / HEN AGENCIES (12 leadow)
-- =============================================================

INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-sh-001','Kawalerskie.pl','stag_hen',NULL,'info@kawalerski.pl','+48 693 778 801','https://kawalerskie.pl','Warszawa','high','research-agent','Najwiekszy organizator wieczoru kawalerskiego w PL (od 2006, 10+ miast, 4.9/5 na 1266+ opiniach, czesc Corpoland Group). Oferta 72 pomysly. Brak lotu akrobacyjnego w katalogu - okazja first-mover.'),
('l-sh-002','CrazyKawalerski.pl (Crazy Weekend)','stag_hen',NULL,NULL,'+48 500 166 756','https://www.crazykawalerski.pl','Warszawa','high','research-agent','12 miast PL + CZ + HU. Juz oferuja skok ze spadochronem i lot smiglopcem. Lot akrobacyjny Extra 300L naturalnie pasuje do ich katalogu adrenaliny.'),
('l-sh-003','Feel Event','stag_hen',NULL,'info@feelevent.pl','+48 791 475 554','https://feelevent.pl','Warszawa','high','research-agent','3400+ zorganizowanych imprez. ul. Jana Kazimierza 12, Warszawa. Szeroka oferta atrakcji Mazowsze. Pitch: lot akrobacyjny na lotnisko Piastow/Radom.'),
('l-sh-004','SzalonyPanienski-Kawalerski.pl','stag_hen',NULL,NULL,NULL,'https://szalonypanienski-kawalerski.pl','Warszawa','medium','research-agent','Specjalizacja atrakcje Warszawa. Agregator pomyslow + organizacja. Potencjal listingu lotu akrobacyjnego.'),
('l-sh-005','WieczorKawalerski24.pl','stag_hen',NULL,NULL,NULL,'https://wieczorkawalerski24.pl','Warszawa','medium','research-agent','Serwis aggregacyjny z organicznym ruchem SEO na frazy kawalerski Warszawa. Listing i partnerstwo afiliacyjne.'),
('l-sh-006','EventForYou.com.pl','stag_hen',NULL,NULL,NULL,'https://eventforyou.com.pl','Warszawa','medium','research-agent','Wieczory kawalerskie Warszawa. Agregator z katalogiem uslug.'),
('l-sh-007','KlubJednorozec.pl','stag_hen',NULL,NULL,NULL,'https://klubjednorozec.pl','Warszawa','low','research-agent','Top wyniki SEO Warszawa wieczor kawalerski. Listing lub partnerstwo.'),
('l-sh-008','Adrenalina Team Rzeszow (kawalerskie)','stag_hen',NULL,NULL,NULL,'https://www.wieczorykawalerskie.rzeszow.pl','Rzeszow','low','research-agent','Specjalizacja adrenaline activities. Potencjal jako odrebny rynek wschodniej PL.'),
('l-sh-009','Formacja Bojowa','stag_hen',NULL,NULL,NULL,'https://formacjabojowa.pl','Warszawa','low','research-agent','Adrenalina + military-themed. Lot akrobacyjny pasuje do DNA marki.'),
('l-sh-010','PartyBus.net.pl','stag_hen',NULL,'biuro@prywatny-kierowca.pl','+48 608 063 855','https://www.partybus.net.pl','Warszawa','low','research-agent','Transport premium + atrakcje kawalerskie. Crossell: lot jako kulminacja wieczoru.'),
('l-sh-011','PamietnyWieczor.pl','stag_hen',NULL,NULL,NULL,'https://pamietnywieczor.pl','Warszawa','medium','research-agent','Platforma organizacji wieczoru kawalerskiego, ogolnopolska. Wyszukaj kontakt przez strone.'),
('l-sh-012','CrazyKawalerski.pl Krakow','stag_hen',NULL,NULL,'+48 500 166 756','https://www.crazykawalerski.pl/Krakow/','Krakow','medium','research-agent','Oddzial krakowski - rynek dla EPRP rozszerzony. Baza klientow z Malopolski wyjezdza do Radomia.');

-- =============================================================
-- CAR CLUBS (11 leadow)
-- =============================================================

INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-cc-001','Porsche Club Poland (Klub Polska)','car_club',NULL,'club@porscheclub.pl','+48 502 111 991','https://cms.porsche-clubs.com/PorscheClubs/pc_poland/pc_main.nsf/web/home','Warszawa','high','research-agent','Oficjalny klub certyfikowany przez Porsche AG. ul. Polczynska 107, Warszawa. Organizuje track days i jazdy sportowe. Pitch: lot Extra 300L jako alternatywna "Porsche Experience" przy wspolpracy Porsche Polska.'),
('l-cc-002','BMW Klub Polska','car_club',NULL,'auto@bmw-klub.pl',NULL,'https://www.bmw-klub.pl','Warszawa','high','research-agent','Jedyny ogolnopolski autoryzowany klub BMW. Czlonkostwo: czlonkostwo@bmw-klub.pl. Skrytka pocztowa 17, 02-741 Warszawa. Organizuje BMW M Festival, eventy torowe.'),
('l-cc-003','Ferrari Owners Club Poland','car_club','Luis Scarpaccio (Prezes)','luis.scarpaccio@md.net.pl',NULL,'https://www.ferrari.com/en-EN/auto/owners-club-poland','Katowice','high','research-agent','Zal. 2017, Bockenskiego 109, Katowice. Organizuje Corsa Baltica, track days, gale. Dealer Warszawa: info@ferrariwarszawa.com, +48 22 627 76 70.'),
('l-cc-004','Lamborghini Club Poland','car_club',NULL,NULL,NULL,'https://en.lamborghini-club.net/country/poland-42','Warszawa','high','research-agent','Czlonkowie w Wroclawiu, Poznaniu, Radomiu, Warszawie. Dealer Warszawa: ul. Polczynska 120B, +48 22 258 96 60. Dealer Katowice kontakt: Dawid Zabicki dawid.zabicki@lamborghini-katowice.com, +48 888 364 621.'),
('l-cc-005','Aston Martin Owners Club Poland','car_club',NULL,'poland@amoc.org',NULL,'https://www.amoc.org/poland','Warszawa','medium','research-agent','Zal. marzec 2019. Nieliczny klub, organizuje do 6 spotkan rocznie, preferuja track days i szkolenia. Naturalnie otwarci na lotnicze doswiadczenia premium.'),
('l-cc-006','Supercar Club Poland','car_club',NULL,NULL,NULL,'https://www.supercarclub.pl/en/','Warszawa','medium','research-agent','Mix marek: Ferrari, Lamborghini, McLaren, Porsche. Klub supercars z eventami regularnymi. Kontakt przez strone.'),
('l-cc-007','BMW M Club PL (nieformalna spolecznosc)','car_club',NULL,NULL,NULL,'https://www.bmwklubpolska.pl/forum/','Warszawa','low','research-agent','Forum i spolecznosc wlascicieli M. Duzy zasieg organiczny. Pitch przez posty sponsorowane lub ambasadora.'),
('l-cc-008','Lamborghini Warszawa (dealer events)','car_club',NULL,NULL,'+48 22 258 96 60','https://www.lamborghini-warszawa.com','Warszawa','medium','research-agent','Dealer prowadzi wlasne eventy dla klientow. Pitch: lot akrobacyjny jako atrakcja przy launch nowego modelu lub urodziny klienta VIP.'),
('l-cc-009','Ferrari Warszawa (dealer events)','car_club',NULL,'info@ferrariwarszawa.com','+48 22 627 76 70','https://warszawa.ferraridealers.com','Warszawa','medium','research-agent','Dealer ul. Wirazowa 21. Organizuje Corsa Baltica wspolnie z Katowicami. Pitch: lot jako ekskluzywna atrakcja po odbiorze nowego Ferrari.'),
('l-cc-010','Porsche Centrum Warszawa (dealer events)','car_club',NULL,NULL,'+48 22 577 99 00','https://www.porsche.com/poland/locations-and-contact/','Warszawa','medium','research-agent','Dealer + Experience Center. Wspolpraca Porsche Polska - patrz l-corp-006. Pitch przez Pawla Mazurka (Events Manager).'),
('l-cc-011','McLaren Warszawa','car_club',NULL,NULL,NULL,'https://www.mclarenwarsaw.com','Warszawa','low','research-agent','Dealer McLaren w Warszawie. Niszowy segment UHNW. Pitch przez oficjalny kanal dealerski jako doswiadczenie G-force po zakupie.');

-- =============================================================
-- FILM PRODUCTION (12 leadow)
-- =============================================================

INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-fp-001','Papaya Films','film_production','Marta Spychalska (Executive Producer)','office@papaya-films.com','+48 731 770 077','https://papaya-films.com','Warszawa','high','research-agent','Nagradzana agencja kreatywna (2006), biura Warszawa/Londyn/Lizbona/Nowy Jork. ul. Wislana 8. Producent klipow muzycznych i reklam premium dla marek globalnych. Lot akrobacyjny Extra 300L: ujecia z powietrza lub jako hero-shot dla contentu.'),
('l-fp-002','Akson Studio','film_production','Jan Kwiecinski (Producer)','jan.kwiecinski@aksonstudio.pl','+48 22 840 68 30','https://aksonstudio.pl','Warszawa','high','research-agent','Zalozony 1992, ul. Piekna 44a. Producent filmow fabularnych i dokumentalnych. PR: Katarzyna Zielinska katarzyna.zielinska@aksonstudio.pl. Ogolny kontakt: akson@aksonstudio.pl.'),
('l-fp-003','FlyXpress Warszawa (dron/aerial)','film_production',NULL,NULL,NULL,'https://flyxpress.pl','Warszawa','high','research-agent','Specjalisci filmowania dronem z Warszawy. Potencjal wspolpracy: dron towarzyszacy Extra 300L tworzy materialy marketingowe dla akrobacja.com i dla klientow FlyXpress.'),
('l-fp-004','FlyRecord.pl (aerial 6K/4K)','film_production',NULL,NULL,NULL,'https://www.flyrecord.pl','Warszawa','high','research-agent','Filmowanie dronem 6K/4K, Warszawa/Krakow/Wroclaw/Poznan. Profesjonalny partner do sesji aerial akrobacyjnych.'),
('l-fp-005','DronXVision Warszawa','film_production',NULL,NULL,NULL,'https://www.dronexvision.pl','Warszawa','medium','research-agent','Profesjonalne uslugi dronem w Warszawie. Mozliwosc pracy w poblizy EPRP z PANSA zezwoleniem.'),
('l-fp-006','DRON Media / Stamp Dron','film_production',NULL,NULL,NULL,'https://www.dron.media.pl','Warszawa','medium','research-agent','Profesjonalne media lotnicze PL. Pitch: sesja foto/video Extra 300L jako wspolne portfolio.'),
('l-fp-007','TVN Discovery Polska (produkcja)','film_production',NULL,NULL,NULL,'https://www.tvn.pl','Warszawa','medium','research-agent','Producent programow TVN. Potencjal: segment przygodowy, feature lifestyle. Kontakt przez dlapilota.pl lub redakcje programow.'),
('l-fp-008','Opus Film','film_production',NULL,NULL,NULL,'https://www.opus-film.pl','Lodz','low','research-agent','Wiodacy producent filmowy Lodz. Filmy fabularne z eventami plenerowymi. Potencjal: scenki lotnicze, specyficzny brief.'),
('l-fp-009','OTO Film','film_production',NULL,NULL,NULL,'https://otofilm.pl','Warszawa','low','research-agent','Dom produkcyjny PL. Reklamy i content. Kontakt przez strone.'),
('l-fp-010','Studio Rondo Warszawa','film_production',NULL,NULL,NULL,'https://studiorondo.pl','Warszawa','low','research-agent','Warszawskie studio filmowe z aerial. Pitch: wspolna realizacja ujec z Extra 300L.'),
('l-fp-011','Cutaway.pl','film_production',NULL,NULL,NULL,'https://cutaway.pl','Warszawa','medium','research-agent','Specjalista aerial cinematography PL (strona nie odpowiada bezposrednio, szukac alternatywnie). Wbudowany potencjal jako partner do ujecc lotniczych nad Extra 300L.'),
('l-fp-012','Munk Studio (PISF)','film_production',NULL,NULL,NULL,'https://www.munkstudio.pl','Warszawa','low','research-agent','Studio Munka PISF - debiu fabularni. Pitch przez PISF network dla projektow z motywem lotniczym.');

-- =============================================================
-- FOREIGN MARKETPLACES (11 leadow)
-- =============================================================

INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-fm-001','Adrop.cz','foreign_marketplace',NULL,'info@adrop.cz',NULL,'https://www.adrop.cz/en','Praha','high','research-agent','Juz w TOP 10 SERP akrobacja.com dla fraz czeskich. Listuja loty akrobacyjne (kategoria Aerial: Letin Pribram, Brno). Brak oferty z EPRP/Polska. Najpilniejszy lead - jeden email moze dac listing w istniejacym ruchu.'),
('l-fm-002','Zazitky.cz','foreign_marketplace',NULL,'info@zazitky.cz','+420 222 313 010','https://www.zazitky.cz','Praha','high','research-agent','500+ doswiadczen, 1390+ lokalizacji, 87 000+ zrealizowanych, 110 000+ recenzji. Siedziba: Lidicka 20, Praha 5. NIP CZ28228634. Program afiliacyjny/partnerski - zapytac przez info@zazitky.cz.'),
('l-fm-003','Jochen Schweizer mydays Group (DE)','foreign_marketplace',NULL,NULL,'+49 89 21 12 90 20 (B2B)','https://b2b.mydays.de/kontakt/','Munchen','high','research-agent','Europejski lider - 10 000+ doswiadczen, czesc ProSiebenSat.1. Onboarding przez Regiondo: zaloguj, Channel Manager, JSMD. Kontakt B2B na b2b.mydays.de/kontakt/. Affiliate: 11% PPS przez AWIN.'),
('l-fm-004','Jochen Schweizer (DE, samodzielna marka)','foreign_marketplace',NULL,NULL,NULL,'https://www.jochen-schweizer.de','Munchen','medium','research-agent','Oddzielna marka w grupie JSMD, silna pozycja w DE. Lot akrobacyjny pasuje do DNA marki (Jochen Schweizer = ekstremalne doswiadczenia). Onboarding przez JSMD Group.'),
('l-fm-005','Mydays.de','foreign_marketplace',NULL,NULL,'+49 89 21 12 90 20','https://www.mydays.de','Munchen','medium','research-agent','Druga marka JSMD, fokus na regalo romantyczne i grupowe. B2B: b2b.mydays.de. Listing doswiadczen lotniczych z PL mozliwy jesli JSMD akceptuje zagranicznych dostawcow.'),
('l-fm-006','Xperience Slovakia','foreign_marketplace',NULL,NULL,NULL,'https://xperienceslovakia.com','Bratislava','medium','research-agent','Platforma prezentow/doswiadczen SK. Brak lotu akrobacyjnego z PL w ofercie. Pitch: lot Extra 300L dla klientow slowackich przylatujacych do Radomia.'),
('l-fm-007','Zlavomat.sk','foreign_marketplace',NULL,NULL,NULL,'https://www.zlavomat.sk','Bratislava','low','research-agent','Slowacki lider kuponow i voucherow. Duzy zasieg. Pitch: lot akrobacyjny z EPRP jako cross-border experience.'),
('l-fm-008','Slevomat.cz','foreign_marketplace',NULL,NULL,NULL,'https://www.slevomat.cz','Praha','medium','research-agent','Wiodacy czeski agregator kuponow i doswiadczen. Duzy ruch organiczny. Kategoria sport/adrenalina. Bezposredni konkurent Adrop.cz w CZ.'),
('l-fm-009','Tinggly (global)','foreign_marketplace',NULL,NULL,NULL,'https://tinggly.com','Dublin','low','research-agent','Globalny agregator doswiadczen na vouchery podroznicze (135 krajow). Brak polskiego lotu akrobacyjnego = first-mover w niszy. Onboarding przez strone dla partnerow.'),
('l-fm-010','Erlebnisgeschenke.de','foreign_marketplace',NULL,NULL,NULL,'https://www.erlebnisgeschenke.de','Munchen','low','research-agent','Platforma prezentow przezyciem DE. Moze wylistowac lot Extra 300L dla klientow D-A-CH. Kontakt przez formularz partnerski na stronie.'),
('l-fm-011','Regiondo.com (dystrybucja)','foreign_marketplace',NULL,NULL,NULL,'https://regiondo.com','Monachium','medium','research-agent','Channel manager dla JSMD i innych platform EU. Registracja jako dostawca daje automatyczny dostep do kilkunastu kanalow jednoczesnie. Najszybsza droga do EU listings.');
