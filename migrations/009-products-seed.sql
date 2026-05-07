-- Seed: merch products
-- prices in grosze (PLN * 100)
-- variants JSON: array of sizes; empty = brak wyboru rozmiaru
-- printful_data: NULL until configured in Printful store

INSERT OR IGNORE INTO products (id, name, slug, category, description, price, image_url, variants, sort_order, active) VALUES
  ('tshirt-akrobacja-v1',   'T-Shirt Akrobacja',         'tshirt-akrobacja',    'odzież',     'Koszulka z grafiką samolotu Extra 300L. Bawełna 190g, druk DTG.', 14900, '/merch/tshirt-akrobacja.jpg',  '["XS","S","M","L","XL","XXL"]',   10, 1),
  ('tshirt-navy-v1',        'T-Shirt Granat',             'tshirt-navy',         'odzież',     'Granatowa koszulka z logo akrobacja.com. Bawełna 190g, druk DTG.', 14900, '/merch/tshirt-navy.jpg',       '["XS","S","M","L","XL","XXL"]',   20, 1),
  ('tshirt-cyan-v1',        'T-Shirt Cyan',               'tshirt-cyan',         'odzież',     'Koszulka w kolorze cyan z grafiką SP-EKS. Bawełna 190g, druk DTG.', 14900, '/merch/tshirt-cyan.jpg',       '["XS","S","M","L","XL","XXL"]',   30, 1),
  ('hoodie-navy-v1',        'Hoodie Granat',              'hoodie-navy',         'odzież',     'Bluza z kapturem w granacie. Wewnętrzna strona szczotkowana, 320g.', 24900, '/merch/hoodie-navy.jpg',       '["XS","S","M","L","XL","XXL"]',   40, 1),
  ('hoodie-cyan-v1',        'Hoodie Cyan',                'hoodie-cyan',         'odzież',     'Bluza z kapturem w cyan. Wewnętrzna strona szczotkowana, 320g.', 24900, '/merch/hoodie-cyan.jpg',        '["XS","S","M","L","XL","XXL"]',   50, 1),
  ('polo-navy-v1',          'Polo Granat',                'polo-navy',           'odzież',     'Eleganckie polo z haftem logo akrobacja.com. Piqué 220g.', 17900, '/merch/polo-navy.jpg',           '["XS","S","M","L","XL","XXL"]',   60, 1),
  ('jacket-softshell-v1',   'Kurtka Softshell',           'kurtka-softshell',    'odzież',     'Kurtka softshell z logo na plecach i piersi. Wiatroszczelna, wodoodporna.', 34900, '/merch/jacket-softshell.jpg',   '["XS","S","M","L","XL","XXL"]',   70, 1),
  ('softshell-bluza-v1',    'Bluza Softshell',            'bluza-softshell',     'odzież',     'Lekka bluza softshell z logo. Idealna do kokpitu i przy samolotach.', 29900, '/merch/softshell-bluza.jpg',   '["XS","S","M","L","XL","XXL"]',   80, 1),
  ('snapback-v1',           'Czapka Snapback',            'snapback',            'akcesoria',  'Czapka snapback z haftem AKROBACJA. Regulowana, materiał 6-panelowy.', 9900, '/merch/snapback-cap.jpg',      '[]',                              90, 1),
  ('czapka-pilot-v1',       'Czapka Pilot',               'czapka-pilot',        'akcesoria',  'Czapka w stylu pilota z logo akrobacja.com. Regulowana.', 8900, '/merch/czapka-pilot.jpg',       '[]',                              100, 1),
  ('sticker-pack-v1',       'Sticker Pack (4 szt.)',      'sticker-pack',        'akcesoria',  'Zestaw 4 naklejek: logo, samolot SP-EKS, AKROBACJA.TOP, znaki rejestracji. Wodoodporne.', 3900, '/merch/sticker-pack.jpg',       '[]',                              110, 1),
  ('brelok-alu-v1',         'Brelok Aluminiowy',          'brelok-alu',          'akcesoria',  'Brelok z grawerowaną sylwetką Extra 300L. Anodowany aluminium.', 4900, '/merch/aluchain.jpg',           '[]',                              120, 1),
  ('remove-before-flight-v1','Remove Before Flight',      'remove-before-flight','akcesoria',  'Zawieszka „Remove Before Flight" — ikona lotnicza na klucze i plecak.', 2900, '/merch/zawieszka-remove.jpg',  '[]',                              130, 1);
