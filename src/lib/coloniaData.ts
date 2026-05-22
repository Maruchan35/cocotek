// Catálogo oficial de colonias de Zihuatanejo de Azueta
// Fuente: Datos del Ayuntamiento

export interface ColoniaInfo {
  nombre: string
  habitantes: number
  viviendas: number
  personasPorLote: number
  lat?: number
  lng?: number
}

export const COLONIAS_ZIHUA: ColoniaInfo[] = [
  { nombre: '12 de Marzo',               habitantes: 1250, viviendas: 335,  personasPorLote: 3.7, lat: 17.65054, lng: -101.55921 },
  { nombre: '12 de Marzo Parte Alta',    habitantes: 860,  viviendas: 232,  personasPorLote: 3.7, lat: 17.64515, lng: -101.56405 },
  { nombre: '16 de Mayo',                habitantes: 1480, viviendas: 400,  personasPorLote: 3.7, lat: 17.64020, lng: -101.54982 },
  { nombre: '16 de Septiembre',          habitantes: 2150, viviendas: 580,  personasPorLote: 3.7, lat: 17.63444, lng: -101.54764 },
  { nombre: '20 de Noviembre',           habitantes: 1720, viviendas: 465,  personasPorLote: 3.7, lat: 17.63661, lng: -101.56133 },
  { nombre: '24 de Abril',               habitantes: 1050, viviendas: 285,  personasPorLote: 3.7, lat: 17.63257, lng: -101.55401 },
  { nombre: '6 de Enero',                habitantes: 780,  viviendas: 210,  personasPorLote: 3.7, lat: 17.64843, lng: -101.54687 },
  { nombre: 'Aeropuerto',                habitantes: 1340, viviendas: 362,  personasPorLote: 3.7, lat: 17.64015, lng: -101.55167 },
  { nombre: 'Agua de Correa',            habitantes: 5850, viviendas: 1580, personasPorLote: 3.7, lat: 17.64580, lng: -101.55049 },
  { nombre: 'Amuzgos',                   habitantes: 920,  viviendas: 248,  personasPorLote: 3.7, lat: 17.63420, lng: -101.54980 },
  { nombre: 'Aquiles Serdán',            habitantes: 1640, viviendas: 443,  personasPorLote: 3.7, lat: 17.64911, lng: -101.55137 },
  { nombre: 'Barrio Nuevo',              habitantes: 2760, viviendas: 746,  personasPorLote: 3.7, lat: 17.63750, lng: -101.55826 },
  { nombre: 'Barrio Viejo',              habitantes: 3950, viviendas: 1068, personasPorLote: 3.7, lat: 17.63849, lng: -101.55504 },
  { nombre: 'Benito Juárez',             habitantes: 2440, viviendas: 659,  personasPorLote: 3.7, lat: 17.64157, lng: -101.55158 },
  { nombre: 'Buenavista',                habitantes: 1180, viviendas: 319,  personasPorLote: 3.7, lat: 17.64460, lng: -101.56147 },
  { nombre: 'Club de Golf',              habitantes: 740,  viviendas: 190,  personasPorLote: 3.9, lat: 17.64383, lng: -101.55539 },
  { nombre: 'Coacoyul',                  habitantes: 8950, viviendas: 2419, personasPorLote: 3.7, lat: 17.63717, lng: -101.56090 },
  { nombre: 'Convergencia',              habitantes: 690,  viviendas: 186,  personasPorLote: 3.7, lat: 17.65014, lng: -101.55716 },
  { nombre: 'CTM',                       habitantes: 1210, viviendas: 327,  personasPorLote: 3.7, lat: 17.64040, lng: -101.56016 },
  { nombre: 'Cuauhtémoc',                habitantes: 1760, viviendas: 476,  personasPorLote: 3.7, lat: 17.64744, lng: -101.54916 },
  { nombre: 'Darío Galeana',             habitantes: 1040, viviendas: 281,  personasPorLote: 3.7, lat: 17.63885, lng: -101.55593 },
  { nombre: 'El Almacén',               habitantes: 580,  viviendas: 157,  personasPorLote: 3.7, lat: 17.63745, lng: -101.55030 },
  { nombre: 'El Barril',                 habitantes: 960,  viviendas: 259,  personasPorLote: 3.7, lat: 17.63621, lng: -101.54994 },
  { nombre: 'El Barril I',               habitantes: 640,  viviendas: 173,  personasPorLote: 3.7, lat: 17.64682, lng: -101.56413 },
  { nombre: 'El Barril II',              habitantes: 710,  viviendas: 192,  personasPorLote: 3.7, lat: 17.64402, lng: -101.56351 },
  { nombre: 'El Barril III',             habitantes: 760,  viviendas: 205,  personasPorLote: 3.7, lat: 17.64779, lng: -101.56520 },
  { nombre: 'El Calabazal',              habitantes: 2380, viviendas: 643,  personasPorLote: 3.7, lat: 17.64733, lng: -101.55967 },
  { nombre: 'El Calabazalito',           habitantes: 590,  viviendas: 159,  personasPorLote: 3.7, lat: 17.64455, lng: -101.54693 },
  { nombre: 'El Calechoso',              habitantes: 420,  viviendas: 114,  personasPorLote: 3.7, lat: 17.64988, lng: -101.55544 },
  { nombre: 'El Embalse',               habitantes: 6750, viviendas: 1824, personasPorLote: 3.7, lat: 17.64035, lng: -101.56524 },
  { nombre: 'El Hujal',                  habitantes: 4420, viviendas: 1195, personasPorLote: 3.7, lat: 17.63739, lng: -101.54554 },
  { nombre: 'El Limón',                  habitantes: 760,  viviendas: 205,  personasPorLote: 3.7, lat: 17.64567, lng: -101.55833 },
  { nombre: 'El Mirador',               habitantes: 1110, viviendas: 300,  personasPorLote: 3.7, lat: 17.63778, lng: -101.55227 },
  { nombre: 'El Paraíso',               habitantes: 680,  viviendas: 184,  personasPorLote: 3.7, lat: 17.63467, lng: -101.55560 },
  { nombre: 'El Posquelite',             habitantes: 410,  viviendas: 111,  personasPorLote: 3.7, lat: 17.64956, lng: -101.56437 },
  { nombre: 'El Zarco',                  habitantes: 540,  viviendas: 146,  personasPorLote: 3.7, lat: 17.64976, lng: -101.55443 },
  { nombre: 'Emiliano Zapata',           habitantes: 5420, viviendas: 1465, personasPorLote: 3.7, lat: 17.64983, lng: -101.55564 },
  { nombre: 'FOVISSSTE',                 habitantes: 1880, viviendas: 510,  personasPorLote: 3.7, lat: 17.64749, lng: -101.55830 },
  { nombre: 'Golondrinas',               habitantes: 1320, viviendas: 357,  personasPorLote: 3.7, lat: 17.63872, lng: -101.55692 },
  { nombre: 'Infonavit El Hujal',        habitantes: 2940, viviendas: 795,  personasPorLote: 3.7, lat: 17.63239, lng: -101.54579 },
  { nombre: 'Infonavit La Boquita',      habitantes: 1720, viviendas: 465,  personasPorLote: 3.7, lat: 17.64160, lng: -101.55570 },
  { nombre: 'Infonavit La Noria',        habitantes: 1280, viviendas: 346,  personasPorLote: 3.7, lat: 17.64441, lng: -101.55451 },
  { nombre: 'Infonavit La Parota',       habitantes: 1040, viviendas: 281,  personasPorLote: 3.7, lat: 17.63801, lng: -101.56449 },
  { nombre: 'Ixtapa',                    habitantes: 6950, viviendas: 1780, personasPorLote: 3.9, lat: 17.64298, lng: -101.55638 },
  { nombre: 'Ixtapa las Palmas',         habitantes: 1260, viviendas: 340,  personasPorLote: 3.7, lat: 17.63303, lng: -101.56051 },
  { nombre: 'Ixtapa Zihuatanejo',        habitantes: 8850, viviendas: 2270, personasPorLote: 3.9, lat: 17.63868, lng: -101.56260 },
  { nombre: 'José María Morelos',        habitantes: 2140, viviendas: 578,  personasPorLote: 3.7, lat: 17.64774, lng: -101.56255 },
  { nombre: 'La Esperanza',              habitantes: 980,  viviendas: 265,  personasPorLote: 3.7, lat: 17.63821, lng: -101.55208 },
  { nombre: 'La Joya',                   habitantes: 1260, viviendas: 340,  personasPorLote: 3.7, lat: 17.63702, lng: -101.56065 },
  { nombre: 'La Laja',                   habitantes: 2350, viviendas: 635,  personasPorLote: 3.7, lat: 17.64908, lng: -101.54684 },
  { nombre: 'La Madera',                 habitantes: 1180, viviendas: 300,  personasPorLote: 3.9, lat: 17.63526, lng: -101.55770 },
  { nombre: 'La Moraleja',               habitantes: 720,  viviendas: 195,  personasPorLote: 3.7, lat: 17.64333, lng: -101.54710 },
  { nombre: 'La Presa',                  habitantes: 890,  viviendas: 241,  personasPorLote: 3.7, lat: 17.63258, lng: -101.56328 },
  { nombre: 'La Puerta',                 habitantes: 2420, viviendas: 654,  personasPorLote: 3.7, lat: 17.64636, lng: -101.55583 },
  { nombre: 'La Ropa',                   habitantes: 960,  viviendas: 245,  personasPorLote: 3.9, lat: 17.65091, lng: -101.55197 },
  { nombre: 'La Salitrera',              habitantes: 1180, viviendas: 319,  personasPorLote: 3.7, lat: 17.63460, lng: -101.55349 },
  { nombre: 'Las Huertas',               habitantes: 1060, viviendas: 286,  personasPorLote: 3.7, lat: 17.63349, lng: -101.55918 },
  { nombre: 'Las Mesas',                 habitantes: 520,  viviendas: 141,  personasPorLote: 3.7, lat: 17.64907, lng: -101.55740 },
  { nombre: 'Las Ollas',                 habitantes: 430,  viviendas: 116,  personasPorLote: 3.7, lat: 17.63325, lng: -101.56521 },
  { nombre: 'Las Pozas',                 habitantes: 640,  viviendas: 173,  personasPorLote: 3.7, lat: 17.64977, lng: -101.55102 },
  { nombre: 'Lázaro Cárdenas',           habitantes: 2860, viviendas: 773,  personasPorLote: 3.7, lat: 17.63877, lng: -101.56362 },
  { nombre: 'Loma Bonita',               habitantes: 1820, viviendas: 492,  personasPorLote: 3.7, lat: 17.64373, lng: -101.54748 },
  { nombre: 'Lomas del Riscal',          habitantes: 1120, viviendas: 303,  personasPorLote: 3.7, lat: 17.63237, lng: -101.55093 },
  { nombre: 'Los Achotes',               habitantes: 2050, viviendas: 554,  personasPorLote: 3.7, lat: 17.64875, lng: -101.56415 },
  { nombre: 'Los Almendros',             habitantes: 860,  viviendas: 232,  personasPorLote: 3.7, lat: 17.64933, lng: -101.56128 },
  { nombre: 'Los Electricistas',         habitantes: 620,  viviendas: 168,  personasPorLote: 3.7, lat: 17.63729, lng: -101.55901 },
  { nombre: 'Marina Ixtapa',             habitantes: 1050, viviendas: 270,  personasPorLote: 3.9, lat: 17.63661, lng: -101.55696 },
  { nombre: 'Miramar',                   habitantes: 1260, viviendas: 340,  personasPorLote: 3.7, lat: 17.63511, lng: -101.56298 },
  { nombre: 'Nuevo Amanecer',            habitantes: 840,  viviendas: 227,  personasPorLote: 3.7, lat: 17.64852, lng: -101.56471 },
  { nombre: 'Pantla Centro',             habitantes: 2260, viviendas: 611,  personasPorLote: 3.7, lat: 17.64570, lng: -101.55120 },
  { nombre: 'Pelícanos',                 habitantes: 1180, viviendas: 319,  personasPorLote: 3.7, lat: 17.64536, lng: -101.54669 },
  { nombre: 'Pelícanos II',              habitantes: 760,  viviendas: 205,  personasPorLote: 3.7, lat: 17.64273, lng: -101.54867 },
  { nombre: 'Plan de Hernández',         habitantes: 520,  viviendas: 141,  personasPorLote: 3.7, lat: 17.63176, lng: -101.54783 },
  { nombre: 'Primer Paso Cardenista',    habitantes: 1320, viviendas: 357,  personasPorLote: 3.7, lat: 17.65028, lng: -101.55346 },
  { nombre: 'Progreso',                  habitantes: 3620, viviendas: 978,  personasPorLote: 3.7, lat: 17.64688, lng: -101.55023 },
  { nombre: 'Progreso Parte Alta',       habitantes: 1420, viviendas: 384,  personasPorLote: 3.7, lat: 17.63710, lng: -101.55086 },
  { nombre: 'Rabo de Iguana',            habitantes: 390,  viviendas: 105,  personasPorLote: 3.7, lat: 17.64760, lng: -101.54872 },
  { nombre: 'Real de Guadalupe',         habitantes: 1080, viviendas: 292,  personasPorLote: 3.7, lat: 17.63727, lng: -101.55320 },
  { nombre: 'San Ignacio',               habitantes: 820,  viviendas: 222,  personasPorLote: 3.7, lat: 17.63568, lng: -101.54757 },
  { nombre: 'San Miguelito',             habitantes: 1240, viviendas: 335,  personasPorLote: 3.7, lat: 17.63444, lng: -101.55440 },
  { nombre: 'Vallecitos de Zaragoza',    habitantes: 2480, viviendas: 670,  personasPorLote: 3.7, lat: 17.63786, lng: -101.56187 },
  { nombre: 'Vaso de Miraflores',        habitantes: 540,  viviendas: 146,  personasPorLote: 3.7, lat: 17.64585, lng: -101.56213 },
  { nombre: 'Vicente Guerrero',          habitantes: 2740, viviendas: 741,  personasPorLote: 3.7, lat: 17.63869, lng: -101.55256 },
  { nombre: 'Villas del Pacifico',       habitantes: 1020, viviendas: 261,  personasPorLote: 3.9, lat: 17.63164, lng: -101.56088 },
  { nombre: 'Villas del Valle',          habitantes: 940,  viviendas: 240,  personasPorLote: 3.9, lat: 17.63834, lng: -101.55885 },
  { nombre: 'Villas las Garzas',         habitantes: 780,  viviendas: 200,  personasPorLote: 3.9, lat: 17.63112, lng: -101.55268 },
  { nombre: 'Zihuatanejo Centro',        habitantes: 7850, viviendas: 2010, personasPorLote: 3.9, lat: 17.64785, lng: -101.55214 },
  { nombre: 'Zona Hotelera I',           habitantes: 620,  viviendas: 170,  personasPorLote: 3.6, lat: 17.64811, lng: -101.56137 },
  { nombre: 'Zona Hotelera II',          habitantes: 510,  viviendas: 142,  personasPorLote: 3.6, lat: 17.63482, lng: -101.56224 },
  { nombre: 'Zona Industrial',           habitantes: 1340, viviendas: 362,  personasPorLote: 3.7, lat: 17.63134, lng: -101.55905 },
]

// Lookup rápido por nombre
export const getColoniaInfo = (nombre: string): ColoniaInfo | null =>
  COLONIAS_ZIHUA.find(c => c.nombre === nombre) ?? null

// Estima personas beneficiadas a partir de viviendas y la colonia seleccionada
export const estimarPersonas = (viviendas: number, coloniaInfo: ColoniaInfo | null): number => {
  const ppl = coloniaInfo?.personasPorLote ?? 3.7
  return Math.round(viviendas * ppl)
}
