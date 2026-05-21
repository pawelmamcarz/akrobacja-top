-- Migration 026: leads table + cold-lead-scraper infrastructure.
--
-- Schema:
--   leads             - centralna tabela leadow (event agencies, marketplaces,
--                       corporates, fundacje, etc.) z workflow new -> won/lost.
--   scraper_sources   - rejestr zrodel do scrapowania (e-Zamowienia, TED,
--                       eGospodarka RSS). Cron iteruje, pobiera, dopasowuje
--                       slowa kluczowe, wpisuje hity jako leady.
--   scraper_runs      - log uruchomien scrapera (kto, kiedy, ile hitów).
--
-- Seed:
--   - ~110 leadow z research agentow 2026-05 (priorytetowe podmioty
--     z 11 kategorii biznesowych). UNIQUE(name, category) chroni przed
--     duplikatami przy ponownym uruchomieniu.
--   - 3 default sources w scraper_sources (e-Zamowienia API, TED, eGospodarka RSS).
--
-- Uruchom dokladnie raz:
--   npx wrangler d1 execute akrobacja-db --remote --file=migrations/026-leads-and-scraper.sql

-- =============================================================
-- SCHEMA
-- =============================================================

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  url TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT,
  source TEXT,
  value_estimate_pln INTEGER,
  notes TEXT,
  next_action_at TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, category)
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads(next_action_at);

CREATE TABLE IF NOT EXISTS scraper_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  search_template TEXT,
  category TEXT NOT NULL DEFAULT 'scraped_tender',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_hit_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scraper_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  ran_at TEXT NOT NULL DEFAULT (datetime('now')),
  hits_found INTEGER DEFAULT 0,
  leads_created INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  FOREIGN KEY (source_id) REFERENCES scraper_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_source ON scraper_runs(source_id, ran_at DESC);

-- =============================================================
-- SCRAPER SOURCES (3 default sources from research 2026-05)
-- =============================================================

INSERT OR IGNORE INTO scraper_sources (id, name, url, source_type, search_template, category) VALUES
('src-ezam', 'e-Zamowienia BZP', 'https://ezamowienia.gov.pl/mo-client-board/api/notices/', 'api',
 '{"keywords":["pokaz lotniczy","lot akrobacyjny","atrakcja eventowa","piknik firmowy","integracja firmowa"],"cpv":["79952000","92622000","60440000"]}',
 'scraped_tender'),
('src-ted', 'TED Tenders Electronic Daily', 'https://api.ted.europa.eu/v3/notices/search', 'api',
 '{"keywords":["pokaz lotniczy","aerobatic","airshow"],"cpv":["79952000","92622000"],"country":"PL"}',
 'scraped_tender'),
('src-egos', 'eGospodarka RSS', 'http://www.partner.egospodarka.pl/rss/rss_advanced.php?name=auctions&cpv=79952000,92622000,60440000&kat=3', 'rss',
 '{"keywords":["lot","pokaz","akrobat","integracja","team building","atrakcja"]}',
 'scraped_tender');

-- =============================================================
-- LEADS SEED (research 2026-05)
-- =============================================================
-- Format: INSERT OR IGNORE with stable (name, category) key.
-- Status 'new' for everything; priority from research; source 'research-agent'.

-- Event agencies (airshow producers + corporate event)
INSERT OR IGNORE INTO leads (id, name, category, email, phone, url, city, priority, source, notes) VALUES
('l-evt-001','Aeropact','event_agency','biuro@aeropact.pl',NULL,'https://aeropact.pl','Poznan','high','research-agent','Produces Gdynia Aerobaltic, Poznan Air Show, Zielona Gora Air Festival. Active 2026 booking.'),
('l-evt-002','Eventify Group','event_agency','info@eventify.group','+48 502 268 999','https://eventify.group','Wroclaw','high','research-agent','Sells air shows as a product line. Need bookable aerobatic act.'),
('l-evt-003','FSWO Agencja Eventowa','event_agency','info@fswo.pl','+48 500 685 523','https://fswo.pl','Leszno','high','research-agent','Amazon, Heineken, AON, KION roster. Big budgets.'),
('l-evt-004','Fundacja Navigator / Sky Show Sobienie','event_agency',NULL,NULL,'http://skyshow.com.pl','Warszawa','high','research-agent','Warsaw-area show, 20+ year history, 50 km z EPRP.'),
('l-evt-005','Agencja Power','event_agency','power@agencjapower.pl','+48 22 224 59 83','https://agencjapower.pl','Warszawa','high','research-agent','Olga Krzeminska-Zasadzka CEO. Incentive travel + F1 specialist.'),
('l-evt-006','MotoKreacja','event_agency','biuro@motokreacja.pl','+48 22 535 33 34','https://motokreacja.pl','Warszawa','high','research-agent','Automotive event agency, Porsche/Ferrari fleet, racing simulators.'),
('l-evt-007','CORSE Agencja Reklamowa','event_agency','biuro@corse.pl','+48 22 649 08 39','http://corse.pl','Warszawa','high','research-agent','BMW M Festival + Motorrad Days partner. CEO Slawomir Saniewski.'),
('l-evt-008','Tytani Eventow','event_agency','biuro@tytanieventow.pl','+48 577 977 855','https://tytanieventow.pl','Wroclaw','medium','research-agent','Budimex, WAGO, Mitsui, City of Wroclaw.'),
('l-evt-009','Argentum Event','event_agency','biuro@argentum-event.pl','+48 884 321 119','https://www.argentum-event.pl','Wroclaw','medium','research-agent','B2B integration trips, multi-city.'),
('l-evt-010','Grupa Focus','event_agency','biuro@grupafocus.pl','+48 509 920 178','https://grupafocus.pl','Warszawa','medium','research-agent','TVN, LEGO Polska, Bank Handlowy, DPD.');

-- Airshow events 2026
INSERT OR IGNORE INTO leads (id, name, category, email, phone, url, city, priority, source, notes) VALUES
('l-air-001','ANTIDOTUM Airshow Leszno 2026','airshow','antidotum@lotniskoleszno.pl',NULL,'https://antidotumairshow.pl','Leszno','high','research-agent','19-20 czerwca 2026. National tier.'),
('l-air-002','Mazury AirShow 2026 (25 ed)','airshow','biuro@mazuryairshow.pl','+48 503 172 816','https://mazuryairshow.pl','Ketrzyn','high','research-agent','1-2 sierpnia 2026. A. Piorkowska kontakt.'),
('l-air-003','Poznan Air Show 2026','airshow','lukasz.wolonkiewicz@mtp.pl','+48 61 869 2426','https://poznanairshow.pl','Poznan','high','research-agent','Grupy MTP producent.'),
('l-air-004','Swidnik Air Festival 2026','airshow','mok@mok.swidnik.pl','+48 81 468 67 80','https://air-festival.swidnik.pl','Swidnik','high','research-agent','13-14 czerwca 2026. Edge 540, Yak-55 precedent.'),
('l-air-005','Odlotowe Suwalki Air Show 2026','airshow',NULL,NULL,'https://odlotowesuwalki.pl','Suwalki','high','research-agent','27-28 czerwca 2026. City + OSiR funded.'),
('l-air-006','AirShow Rudniki 2026','airshow','info@grupafalco.com','+48 56 654 33 25','https://www.grupafalco.com','Rudniki','high','research-agent','31 lipca - 1 sierpnia 2026. Grupa Falco + Gmina Rodziny.'),
('l-air-007','Plocki Piknik Lotniczy 2026','airshow','kontakt@plockipikniklotniczy.pl',NULL,'https://www.plockipikniklotniczy.pl','Plock','high','research-agent','9 sierpnia 2026, night show. Procurement via Plock przetarg.'),
('l-air-008','XV Nowotarski Piknik Lotniczy','airshow','piknik@aeroklubnowytarg.pl','+48 727 451 879','https://pikniknowotarski.pl','Nowy Targ','medium','research-agent','4-5 lipca 2026.'),
('l-air-009','Fly Fest Piotrkow','airshow','aeroklub@azp.com.pl','+48 44 647 74 73','https://azp.com.pl','Piotrkow Tryb.','medium','research-agent','4-5 lipca 2026. Aeroklub Ziemi Piotrkowskiej.'),
('l-air-010','Rodzinny Piknik Lotniczy Gryzliny','airshow','piknik@pikniklotniczygryzliny.pl','+48 510 030 320','https://pikniklotniczygryzliny.pl','Gryzliny','medium','research-agent','XII edycja 2026. Adam Sternicki.');

-- Voucher / experience marketplaces
INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, url, priority, source, notes) VALUES
('l-vou-001','Prezent Marzen','voucher_channel','Rafal Zamojski','r.zamojski@prezentmarzen.com','https://prezentmarzen.com','high','research-agent','Historyczna wspolpraca. AKTUALNIE listing konkurenta z EPRP pod Aeroklub Warszawski. Priorytet reaktywacji.'),
('l-vou-002','Katalog Marzen','voucher_channel',NULL,NULL,'https://katalogmarzen.pl','high','research-agent','1200+ partnerow, 8300+ SKUs. /pl/wspolpraca aplikacja.'),
('l-vou-003','Wyjatkowy Prezent','voucher_channel',NULL,'partner@wyjatkowyprezent.pl','https://wyjatkowyprezent.pl','high','research-agent','Tel 22 66 88 272. JUZ listing konkurenta Piastow.'),
('l-vou-004','Super Prezenty','voucher_channel',NULL,'partner@superprezenty.pl','https://superprezenty.pl','high','research-agent','Tel 22 395 57 20. 700 PL partnerow.'),
('l-vou-005','Prezent Zycia','voucher_channel',NULL,'kontakt@prezentzycia.pl','https://prezentzycia.pl','high','research-agent','+48 530 219 808.'),
('l-vou-006','Tinggly','voucher_channel',NULL,NULL,'https://tinggly.com','medium','research-agent','Global aggregator. Brak konkurenta PL aerobatic = okazja first-mover.'),
('l-vou-007','Prezentokracja','voucher_channel',NULL,NULL,'https://prezentokracja.pl','medium','research-agent','Affiliate webepartners.pl.'),
('l-vou-008','GoldenGift','voucher_channel',NULL,NULL,'https://goldengift.pl','medium','research-agent','Smaller curator, regional.');

-- B2B benefit platforms
INSERT OR IGNORE INTO leads (id, name, category, email, phone, url, priority, source, notes) VALUES
('l-b2b-001','MyBenefit','b2b_benefit',NULL,NULL,'https://mybenefit.pl','high','research-agent','Najwiekszy w PL, thousands of employer clients.'),
('l-b2b-002','Worksmile','b2b_benefit',NULL,NULL,'https://worksmile.com','high','research-agent','180k+ users, 30+ krajow. Calendly partner.'),
('l-b2b-003','Nais','b2b_benefit',NULL,NULL,'https://nais.co/pl','high','research-agent','12000+ offers, enterprise focus.'),
('l-b2b-004','Medicover Benefits','b2b_benefit','info@medicoverbenefits.pl','+48 22 290 34 90','https://medicoverbenefits.pl','high','research-agent','Otwarty partner program /partner/.'),
('l-b2b-005','Multivoucher','b2b_benefit','b2b@multivoucher.pl','+48 727 777 770','https://multivoucher.pl','medium','research-agent','/program-partnerski/.'),
('l-b2b-006','Benefit Systems (Multibilet)','b2b_benefit',NULL,'+48 22 242 42 42','https://corp.benefitsystems.pl','medium','research-agent','MultiSport operator. Hard onboarding.'),
('l-b2b-007','Motivizer','b2b_benefit',NULL,'+48 515 113 130','https://motivizer.pl','medium','research-agent','SME + enterprise wellbeing.');

-- Municipal festivals (within ~200 km of EPRP)
INSERT OR IGNORE INTO leads (id, name, category, email, url, city, priority, source, notes) VALUES
('l-mun-001','Lublin Starostwo - Lotniczy Dzien Dziecka','municipal','starostwo@powiat.lublin.pl','https://www.powiat.lublin.pl','Lublin','high','research-agent','Tel 81 528 66 03. ~90 km z EPRP, ciagly piknik lotniczy z Aeroklubem Lubelskim.'),
('l-mun-002','MOK Swidnik','municipal',NULL,'https://mok.swidnik.pl/kontakt','Swidnik','high','research-agent','Dyr. Monika Wojcik. Leonardo PZL strategiczny partner.'),
('l-mun-003','Plock UM (przetarg piknik)','municipal',NULL,'https://plock.eu','Plock','high','research-agent','Co roku przetarg na piknik. Monitor BIP Plock w marcu-maju.'),
('l-mun-004','UM Suwalki','municipal',NULL,'https://um.suwalki.pl','Suwalki','medium','research-agent','Air Show ~100k+ PLN budget.'),
('l-mun-005','UM Lublin Wydzial Kultury','municipal','kultura@lublin.eu','https://lublin.eu','Lublin','medium','research-agent','Dni Lublina, czerwiec.'),
('l-mun-006','UM Radomsko','municipal',NULL,'https://um.radomsko.pl','Radomsko','low','research-agent','Dni Radomska, brak aviation precedent.');

-- Corporates (B2B / sponsoring / VIP gifting)
INSERT OR IGNORE INTO leads (id, name, category, contact_person, url, priority, source, notes) VALUES
('l-corp-001','Orlen','corp_b2b','Lidia Kolucka (Sponsoring) / Michal Rutkowski (Sports)','https://www.orlen.pl','high','research-agent','Title sponsor Grupa Akrobacyjna Zelazny. Strategic partner Air Show Radom 2023.'),
('l-corp-002','Tauron Polska Energia','corp_b2b',NULL,'https://www.tauron.pl','high','research-agent','Title sponsor Mistrzostwa Polski Akrobacja Szybowcowa 2024.'),
('l-corp-003','PKO Bank Polski','corp_b2b','Dawid Korzen / Mateusz Nowak','https://www.pkobp.pl','high','research-agent','Sponsoring leadership 2024.'),
('l-corp-004','PZU','corp_b2b','Sylwia Matusiak (MD Marketing)','https://www.pzu.pl','high','research-agent','Sponsoring + sport portfolio.'),
('l-corp-005','BGK','corp_b2b',NULL,'https://www.bgk.pl','high','research-agent','Strategic partner Air Show Radom 2023.'),
('l-corp-006','Porsche Polska','corp_b2b','Jakub Kessler / Pawel Mazurek','https://porsche.pl','high','research-agent','contact@pl.porsche.com, 800 800 911. Events Manager Pawel Mazurek.'),
('l-corp-007','BMW Group Polska','corp_b2b','Kacper Studencki','https://bmw.pl','high','research-agent','Press: press.bmwgroup.com/poland. M Festival 2025.'),
('l-corp-008','Mercedes-Benz Polska','corp_b2b','Luiza Jakubowska (Head of Marketing)','https://mercedes-benz.pl','high','research-agent','S-Class PL premiere 2025 precedent.'),
('l-corp-009','Hyundai Motor Poland','corp_b2b','Lukasz Borak (Marketing Director od 2024-05)','https://hyundai.com/pl','high','research-agent','Ciszewski MSL retained PR.'),
('l-corp-010','mBank','corp_b2b',NULL,'https://www.mbank.pl','medium','research-agent','Fintech-forward, premium budget.'),
('l-corp-011','PGE','corp_b2b',NULL,'https://www.gkpge.pl','medium','research-agent','Sponsoring cluster (Orlen, BGK, Tauron).'),
('l-corp-012','Orange Polska','corp_b2b',NULL,'https://www.orange.pl','medium','research-agent','Orange Warsaw Festival, aviation =untapped.'),
('l-corp-013','PLL LOT','corp_b2b',NULL,'https://www.lot.com','medium','research-agent','Aviation brand naturalny fit.'),
('l-corp-014','Maspex Wadowice','corp_b2b','Anna Barabasz-Sawinska / Kamil Gebski','https://www.maspex.com','medium','research-agent','Spirits division (Soplica) - trade gifting angle.'),
('l-corp-015','Allegro','corp_b2b',NULL,'https://allegro.pl','medium','research-agent','Brand Experience Agency rosnaca 50% w 2024.');

-- Premium wedding planners
INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-wed-001','Izabela Janachowska','wedding','Izabela Janachowska',NULL,NULL,'https://portal.janachowska.pl','Warszawa','high','research-agent','502K IG. Luxury wedding curator.'),
('l-wed-002','One&Only Luxury Wedding','wedding','Karolina Pawelec-Sambor','kontakt@oneandonlyluxury.wedding','+48 509 423 178','https://oneandonlyluxury.wedding',NULL,'high','research-agent','Ogolnopolski luxury.'),
('l-wed-003','Zwadowski Weddings & Events','wedding','Dariusz Zwadowski','dariusz@zwadowski.pl','+48 730 731 751','https://zwadowski.pl','Warszawa','high','research-agent','Europa zasieg.'),
('l-wed-004','Wytwornia Slubow','wedding','Agnieszka Kudela','agnieszka@wytworniaslubow.pl','+48 602 250 204','https://wytworniaslubow.pl','Warszawa','high','research-agent','Warszawa + Gdansk.'),
('l-wed-005','Dorota Nowakowska Weddings','wedding','Dorota Nowakowska',NULL,NULL,'https://dorotanowakowska.pl','Krakow','high','research-agent','Krakow + Warszawa luxury.'),
('l-wed-006','SENSAR Agencja Slubna','wedding','Asia','sensar@sensar.pl','+48 603 048 535','https://www.sensar.pl',NULL,'high','research-agent','Ogolnopolski luxury.'),
('l-wed-007','Bride Side Wedding Planner','wedding','Karolina Piekara',NULL,NULL,'https://bridesidewedding.com','Krakow','medium','research-agent','Mid-premium Krakow.'),
('l-wed-008','Aspire Wedding Planner','wedding','Katarzyna Gajek',NULL,NULL,'https://aspire.pl','Krakow','medium','research-agent','Krakow + Warszawa.');

-- Automotive activation agencies
INSERT OR IGNORE INTO leads (id, name, category, email, url, priority, source, notes) VALUES
('l-auto-001','Porsche Centrum Poznan','automotive',NULL,'https://porschepoznan.com.pl','high','research-agent','Porsche Experience 2024/25 track days + RS fleet.'),
('l-auto-002','Audi Polska / VW Group','automotive',NULL,'https://audi.pl','high','research-agent','Milena Sitarska Marketing, Przemyslaw Schwarz Sales Audi.'),
('l-auto-003','Toyota Motor Poland','automotive',NULL,'https://toyota.pl','medium','research-agent','GR Yaris/GR86 track events. Gazoo Racing.'),
('l-auto-004','Volvo Car Poland','automotive',NULL,'https://volvocars.com/pl','medium','research-agent','EX90 launch events 2025.'),
('l-auto-005','Volkswagen Poznan','automotive',NULL,'https://volkswagen-poznan.pl','medium','research-agent','Manufacturing plant local events.'),
('l-auto-006','Stellantis Polska','automotive',NULL,'https://media.stellantis.com/pl','low','research-agent','Alfa Romeo + Jeep performance angle.'),
('l-auto-007','Tesla Polska','automotive',NULL,'https://tesla.com/pl_PL','low','research-agent','Brak PL marketing head, central EMEA.');

-- Influencer marketing agencies
INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, city, priority, source, notes) VALUES
('l-inf-001','LTTM / LifeTube','influencer_agency','Krystian Botko / Pawel Stano / Kamil Bolek',NULL,NULL,'https://lttm-group.com','Warszawa','high','research-agent','Najwiekszy CEE YT partner network, 1000+ creators.'),
('l-inf-002','GetHero','influencer_agency','Alicja Stefaniak / Lukasz Walczak',NULL,'+48 733 103 806','https://gethero.pl','Wroclaw','high','research-agent','Gaming, automotive, lifestyle.'),
('l-inf-003','Tigers','influencer_agency','Franciszek Georgiew / Karolina Kawska',NULL,NULL,'https://tigers.pl','Warszawa','high','research-agent','XXII Ventures group.'),
('l-inf-004','DDOB','influencer_agency','Bartlomiej Sibiga',NULL,NULL,'https://agencja.ddob.com','Warszawa','high','research-agent','Oldest PL influencer agency (2013).'),
('l-inf-005','indaHash','influencer_agency','Barbara Soltysinska',NULL,NULL,'https://indahash.com','Warszawa','high','research-agent','Adidas, Danone, Coca-Cola, McDonalds, Samsung, IKEA roster.'),
('l-inf-006','Hash.fm','influencer_agency','Konrad Traczyk','kontakt@hash.fm',NULL,'https://hash.fm','Warszawa','high','research-agent','First PL influencer agency (2014).'),
('l-inf-007','Lettly','influencer_agency','Jakub Orlowski / Zuzanna Sleszynska','hello@lettly.com','+48 535 940 156','https://lettly.com','Warszawa','high','research-agent','Forbes 30u30 founder.'),
('l-inf-008','Warsaw/Creatives','influencer_agency','Pawel Walicki / Sonia Hotimsky','hello@warsawcreatives.com',NULL,'https://warsawcreatives.com','Warszawa','high','research-agent','Peter Lindbergh estate, Kate Moss Cosmoss.');

-- Luxury media + premium brands
INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, priority, source, notes) VALUES
('l-med-001','Vogue Polska','media','Ina Lekiewicz (EiC) / Dominika Jozwiak (sales)','dominika.jozwiak@vogue.pl','+48 694 460 016','https://vogue.pl','high','research-agent','Premium 15-25k full page.'),
('l-med-002','Harpers Bazaar Polska','media','Zuzanna Krzatala (EiC)','kontakt@harpersbazaar.pl',NULL,'https://harpersbazaar.pl','high','research-agent','Premium relaunch 2025.'),
('l-med-003','Forbes Polska','media','Katarzyna Debek (EiC)',NULL,NULL,'https://forbes.pl','high','research-agent','Business premium HNW reach.'),
('l-med-004','K MAG','media','Mikolaj Komar',NULL,NULL,'https://kmag.pl','medium','research-agent','Menswear/culture/design crowd.'),
('l-med-005','Wprost','media','Michal Kobosko / Katarzyna Horzela (reklama)','k.horzela@pmpg.pl',NULL,'https://wprost.pl','medium','research-agent','National weekly.'),
('l-med-006','Wyborowa Pernod Ricard PL','automotive','Karine Madelrieu (Marketing) / Anna Staszewska (press)','Anna.Staszewska@pernod-ricard.com',NULL,'https://www.pernod-ricard.com/pl','high','research-agent','Spirits + premium event activation. Belvedere co-brand.'),
('l-med-007','Raffles Europejski Warszawa','corp_b2b','Anna Czajkowska','warsaw@raffles.com',NULL,'https://raffles.com/warsaw','high','research-agent','Ultra-luxury hotel.'),
('l-med-008','Galeon Yachts','corp_b2b','Paulina Marwinska',NULL,NULL,'https://galeon.pl','high','research-agent','PL luxury yacht builder, sea+sky cross-marketing.'),
('l-med-009','Jet Story','corp_b2b',NULL,'sales@jetstory.com','+48 22 609 63 44','https://jetstory.com','high','research-agent','Najwiekszy CEE biz-jet operator. Cross-referral HNW.');

-- Foundations / CSR + PWD influencers
INSERT OR IGNORE INTO leads (id, name, category, contact_person, email, phone, url, priority, source, notes) VALUES
('l-csr-001','Fundacja Mam Marzenie','foundation','Aleksandra Ludew (Prezeska)','aleksandra.ludew@mammarzenie.org','+48 792 705 567','https://www.mammarzenie.org','high','research-agent','Spelnia marzenia dzieci 3-18 lat, polski odpowiednik Make-A-Wish.'),
('l-csr-002','Fundacja Spelnionych Marzen','foundation',NULL,'fundacja@spelnionemarzenia.org.pl','+48 607 775 776','https://www.spelnionemarzenia.org.pl','high','research-agent','Dzieci onkologiczne, psychoonkologia.'),
('l-csr-003','Fundacja TVN "Nie jestes sam"','foundation','Zuzanna Lewandowska (Prezes)','fundacja@tvn.pl','+48 22 856 66 74','https://fundacja.tvn.pl','high','research-agent','Warner Bros Discovery umbrella, big PR reach.'),
('l-csr-004','Fundacja PODAJ DALEJ','foundation',NULL,'fundacja@podajdalej.org.pl','+48 63 211 22 19','https://podajdalej.org.pl','high','research-agent','Aktywny program szybowcowy/lotniczy dla PWD, Cumulus 2024.'),
('l-csr-005','Fundacja Anny Dymnej Mimo Wszystko','foundation',NULL,'fundacja@mimowszystko.org',NULL,'https://mimowszystko.org','medium','research-agent','PWD intelektualne. Cisco PL + Auchan partnerzy.'),
('l-csr-006','Fundacja Hospicyjna','foundation',NULL,'biuro@hospicja.pl',NULL,'https://fundacjahospicyjna.pl','medium','research-agent','Siec 60 hospicjow, zbiera marzenia + sponsorow.'),
('l-csr-007','Fundacja Onkologiczna Rakiety','foundation','Mateusz Karczewski','m.karczewski@fundacjarakiety.pl','+48 575 969 111','https://fundacjarakiety.pl','medium','research-agent','Platforma B2B fundacjarakiety.biz.'),
('l-csr-008','Fundacja Sprzymierzeni z GROM','foundation','Grzegorz Wydrowski','biuro@fundacja-sprzymierzeni.pl','+48 22 115 80 38','https://fundacja-sprzymierzeni.pl','medium','research-agent','Weterani sil specjalnych.'),
('l-csr-009','Life on Wheelz (Wojtek & Agata Sawiccy)','csr_influencer','Wojtek Sawicki','lifeonwhlz@gmail.com',NULL,NULL,'high','research-agent','IG 123k, Duchenne. Niesamowita historia narracyjna.'),
('l-csr-010','Sebastian Grzywacz @odlotowyniewidomy','csr_influencer','Sebastian Grzywacz',NULL,NULL,NULL,'high','research-agent','IG 500k, aktywny lead (barter Adrenalina + 360, oczekuje terminu).');
