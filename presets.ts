export interface ScadPreset {
  id: string;
  title: string;
  titleEn: string;
  category: string;
  description: string;
  descriptionEn: string;
  scadCode: string;
}

export const PRESETS: ScadPreset[] = [
  {
    id: 'organizer',
    title: 'Parametrický organizér / krabička',
    titleEn: 'Parametric Organizer Bin',
    category: 'Practical & 3D Print',
    description: 'Čistá parametrická krabička s volitelným počtem přihrádek a nastavitelnou tloušťkou stěn.',
    descriptionEn: 'Clean parametric organizer tray with configurable compartment dividers and wall thickness.',
    scadCode: `/* [Organizer Dimensions] */
width = 80; // [40:5:160]
length = 60; // [30:5:140]
height = 28; // [15:5:80]
wall_thickness = 2.4; // [1.0:0.2:5.0]
bottom_thickness = 2.4; // [1.0:0.2:6.0]

/* [Compartments] */
compartments_x = 2; // [1:1:4]
compartments_y = 2; // [1:1:4]

/* [Appearance] */
box_color = "#38bdf8"; // [color]

color(box_color) {
  difference() {
    // Outer solid bin sitting on print bed
    translate([0, 0, height/2])
      cube([width, length, height], center = true);

    // Compartment cavities
    for (ix = [0 : compartments_x - 1]) {
      for (iy = [0 : compartments_y - 1]) {
        translate([
          -width/2 + wall_thickness + ((width - wall_thickness * (compartments_x + 1)) / compartments_x)/2 + ix * (((width - wall_thickness * (compartments_x + 1)) / compartments_x) + wall_thickness),
          -length/2 + wall_thickness + ((length - wall_thickness * (compartments_y + 1)) / compartments_y)/2 + iy * (((length - wall_thickness * (compartments_y + 1)) / compartments_y) + wall_thickness),
          bottom_thickness + height/2
        ])
          cube([
            (width - wall_thickness * (compartments_x + 1)) / compartments_x,
            (length - wall_thickness * (compartments_y + 1)) / compartments_y,
            height
          ], center = true);
      }
    }
  }
}
`,
  },
  {
    id: 'gear',
    title: 'Parametrické ozubené kolo',
    titleEn: 'Parametric Spur Gear',
    category: 'Mechanika',
    description: 'Mechanické ozubené kolo s nastavitelným počtem zubů, hřídelovou dírou, klínkem a odlehčovacími otvory.',
    descriptionEn: 'Mechanical gear with customizable tooth count, shaft bore, keyway, and lightening holes.',
    scadCode: `/* [Geometrie kola] */
pocet_zubu = 18; // [8:1:40]
polomer_kola = 32; // [15:1:70]
tloustka_kola = 8; // [3:1:25]
vyska_zubu = 4.5; // [2:0.5:10]
sirka_zubu = 3.2; // [1.5:0.5:8]

/* [Hřídel a odlehčení] */
prumer_hridele = 8; // [3:1:20]
ma_odlehcovaci_otvory = true;
pocet_odlehceni = 4; // [3:1:8]
prumer_odlehceni = 7; // [3:1:15]

/* [Vzhled] */
barva = "#f59e0b"; // [color]

color(barva) {
  translate([0, 0, tloustka_kola/2]) {
    difference() {
      union() {
        // Základní válec ozubeného kola
        cylinder(h = tloustka_kola, r = polomer_kola, center = true, $fn = 64);

        // Jednotlivé zuby rozmístěné po obvodu
        for (i = [0 : 360 / pocet_zubu : 359]) {
          rotate([0, 0, i])
            translate([polomer_kola + vyska_zubu/2 - 0.5, 0, 0])
              cube([vyska_zubu, sirka_zubu, tloustka_kola], center = true);
        }
      }

      // Středový otvor pro hřídel
      cylinder(h = tloustka_kola + 2, r = prumer_hridele / 2, center = true, $fn = 32);

      // Drážka pro pero / klínek
      translate([prumer_hridele/2 + 0.5, 0, 0])
        cube([2, 2.5, tloustka_kola + 2], center = true);

      // Odlehčovací otvory po kružnici
      if (ma_odlehcovaci_otvory) {
        for (j = [0 : 360 / pocet_odlehceni : 359]) {
          rotate([0, 0, j + 45])
            translate([polomer_kola * 0.58, 0, 0])
              cylinder(h = tloustka_kola + 2, r = prumer_odlehceni / 2, center = true, $fn = 24);
        }
      }
    }
  }
}
`,
  },
  {
    id: 'phone-stand',
    title: 'Stojánek na smartphone',
    titleEn: 'Smartphone Stand',
    category: 'Praktické & 3D tisk',
    description: 'Ergonomický stolní stojánek na telefon s otvorem pro nabíjecí kabel a opěrnou drážkou.',
    descriptionEn: 'Ergonomic desk phone stand with charging cable cutout and support lip.',
    scadCode: `/* [Stand Dimensions] */
width = 60; // [40:5:100]
base_length = 70; // [50:5:110]
stand_height = 75; // [50:5:120]
wall_thickness = 4.5; // [3:0.5:8]
tilt_angle = 68; // [50:2:80]

/* [Phone Cradle & Cable] */
shelf_depth = 16; // [10:1:25]
lip_height = 12; // [8:1:20]
cable_slot_width = 16; // [10:2:28]

/* [Appearance] */
stand_color = "#10b981"; // [color]

color(stand_color) {
  difference() {
    union() {
      // 1. Spodní základna na stole
      translate([0, base_length/2, wall_thickness/2])
        cube([width, base_length, wall_thickness], center = true);

      // 2. Šikmá zadní opěrka
      translate([0, 10, 0])
        rotate([90 - tilt_angle, 0, 0])
          translate([0, stand_height/2, wall_thickness/2])
            cube([width, stand_height, wall_thickness], center = true);

      // 3. Vodorovná police pro telefon s výškou pro kabel
      translate([0, 10 + shelf_depth/2, 14 + wall_thickness/2])
        cube([width, shelf_depth, wall_thickness], center = true);

      // 4. Přední pojistná lišta proti sesunutí
      translate([0, 10 + shelf_depth - wall_thickness/2, 14 + wall_thickness + lip_height/2])
        cube([width, wall_thickness, lip_height], center = true);

      // 5. Levá boční výztužná stěna
      translate([-width/2 + wall_thickness/2, base_length * 0.45, stand_height * 0.22])
        cube([wall_thickness, base_length * 0.65, stand_height * 0.4], center = true);

      // 6. Pravá boční výztužná stěna
      translate([width/2 - wall_thickness/2, base_length * 0.45, stand_height * 0.22])
        cube([wall_thickness, base_length * 0.65, stand_height * 0.4], center = true);
    }

    // Průchozí otvor pro nabíjecí kabel v polici
    translate([0, 10 + shelf_depth/2, 14])
      cube([cable_slot_width, shelf_depth + 6, 25], center = true);

    // Průchozí otvor pro kabel v šikmé opěrce
    translate([0, 10, 0])
      rotate([90 - tilt_angle, 0, 0])
        translate([0, 20, 0])
          cube([cable_slot_width, 24, 30], center = true);
  }
}
`,
  },
  {
    id: 'flange',
    title: 'Mechanická příruba se šrouby',
    titleEn: 'Mechanical Pipe Flange',
    category: 'Mechanika',
    description: 'Průmyslová příruba s centrálním průchodem, kružnicí šroubových spojů a nákružkem.',
    descriptionEn: 'Industrial flange with central bore, bolt circle pattern, and neck collar.',
    scadCode: `/* [Rozměry příruby] */
vnejsi_prumer = 90; // [50:5:160]
vnitrni_vrtani = 36; // [15:2:80]
tloustka_disku = 8; // [4:1:20]

/* [Nákružek / krček] */
ma_nakruzek = true;
vyska_krcku = 14; // [5:1:35]
prumer_krcku = 52; // [30:2:90]

/* [Šroubové otvory] */
pocet_sroubu = 6; // [3:1:12]
prumer_roztecne_kruznice = 68; // [35:2:120]
prumer_otvoru_sroubu = 6.5; // [3:0.5:12]

/* [Vzhled] */
barva_kovu = "#94a3b8"; // [color]

color(barva_kovu) {
  translate([0, 0, tloustka_disku/2]) {
    difference() {
      union() {
        // Hlavní disk příruby
        cylinder(h = tloustka_disku, r = vnejsi_prumer / 2, center = true, $fn = 64);

        // Zvýšený středový nákružek
        if (ma_nakruzek) {
          translate([0, 0, tloustka_disku/2 + vyska_krcku/2])
            cylinder(h = vyska_krcku, r = prumer_krcku / 2, center = true, $fn = 48);
        }
      }

      // Centrální průchozí otvor trubky
      cylinder(h = 60, r = vnitrni_vrtani / 2, center = true, $fn = 48);

      // Šroubové otvory po roztečné kružnici
      for (i = [0 : 360 / pocet_sroubu : 359]) {
        rotate([0, 0, i])
          translate([prumer_roztecne_kruznice / 2, 0, 0])
            cylinder(h = 50, r = prumer_otvoru_sroubu / 2, center = true, $fn = 24);
      }
    }
  }
}
`,
  },
  {
    id: 'twisted-vase',
    title: 'Spirálová točená váza',
    titleEn: 'Twisted Spiral Vase',
    category: 'Dekorativní & 3D tisk',
    description: 'Váza vytvořená pomocí linear_extrude se zkroucením (twist), změnou měřítka (scale) a vnitřní dutinou.',
    descriptionEn: 'Vase generated using linear_extrude with twist rotation, top scaling, and hollow cavity.',
    scadCode: `/* [Rozměry vázy] */
vyska_vazy = 75; // [30:5:150]
polomer_zakladny = 22; // [10:2:50]
uhel_zkrouceni = 120; // [0:15:360]
meritko_horni = 1.4; // [0.6:0.1:2.2]
tloustka_dna = 4; // [2:1:10]

/* [Barva] */
barva_vazy = "#ec4899"; // [color]

color(barva_vazy) {
  difference() {
    // Vnější točené tělo vázy
    linear_extrude(height = vyska_vazy, twist = uhel_zkrouceni, scale = meritko_horni, slices = 40) {
      circle(r = polomer_zakladny, $fn = 32);
    }

    // Vnitřní vybrání / dutina
    translate([0, 0, tloustka_dna]) {
      linear_extrude(height = vyska_vazy + 2, twist = uhel_zkrouceni, scale = meritko_horni, slices = 40) {
        circle(r = polomer_zakladny - 2.8, $fn = 32);
      }
    }
  }
}
`,
  },
  {
    id: 'openscad-logo',
    title: 'Ikonické OpenSCAD Logo',
    titleEn: 'Iconic OpenSCAD Logo',
    category: 'CSG Ukázka',
    description: 'Klasický CSG demonstrátor: průnik krychle a koule s odečtením tří vzájemně kolmých válců.',
    descriptionEn: 'The classic CSG benchmark: intersection of cube and sphere minus three perpendicular cylinders.',
    scadCode: `/* [Parametry loga] */
velikost_krychle = 32; // [15:1:60]
polomer_koule = 20; // [10:1:40]
polomer_valcu = 8; // [4:0.5:18]

/* [Materiál] */
barva_loga = "#f59e0b"; // [color]

color(barva_loga) {
  translate([0, 0, velikost_krychle/2]) {
    difference() {
      // Průnik krychle a koule
      intersection() {
        cube(velikost_krychle, center = true);
        sphere(r = polomer_koule, $fn = 40);
      }

      // Tři vzájemně kolmé válce
      cylinder(h = velikost_krychle + 4, r = polomer_valcu, center = true, $fn = 32);

      rotate([90, 0, 0])
        cylinder(h = velikost_krychle + 4, r = polomer_valcu, center = true, $fn = 32);

      rotate([0, 90, 0])
        cylinder(h = velikost_krychle + 4, r = polomer_valcu, center = true, $fn = 32);
    }
  }
}
`,
  },
];
