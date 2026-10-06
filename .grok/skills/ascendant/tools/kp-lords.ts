import { Chart } from "astro-ascendant";

const STAR_LORD_CYCLE = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
] as const;

export type KpLord = (typeof STAR_LORD_CYCLE)[number];

const VIMSHOTTARI_YEARS: Record<KpLord, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const STAR_SPAN = 360 / 27;

const STARS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

export type StarName = (typeof STARS)[number];

const SIGN_LORDS = [
  "Mars",
  "Venus",
  "Mercury",
  "Moon",
  "Sun",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Saturn",
  "Jupiter",
] as const;

export type SignLord = (typeof SIGN_LORDS)[number];

export interface KpLordChain {
  readonly signLord: SignLord;
  readonly starLord: KpLord;
  readonly subLord: KpLord;
  readonly subSubLord: KpLord;
}

function normalizeLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

function lordFromProportion(position: number, startLord: KpLord): KpLord {
  const start = STAR_LORD_CYCLE.indexOf(startLord);
  let elapsed = 0;
  for (let index = 0; index < STAR_LORD_CYCLE.length; index++) {
    const planet = STAR_LORD_CYCLE[(start + index) % STAR_LORD_CYCLE.length];
    if (planet === undefined) return startLord;
    const span = VIMSHOTTARI_YEARS[planet] / 120;
    if (position < elapsed + span) return planet;
    elapsed += span;
  }
  return startLord;
}

export function signLordOf(longitude: number): SignLord {
  const signIndex = Math.floor(normalizeLongitude(longitude) / 30);
  return SIGN_LORDS[signIndex] ?? "Mars";
}

export function starNameOf(longitude: number): StarName {
  const index = Math.floor(normalizeLongitude(longitude) / STAR_SPAN);
  return STARS[index % STARS.length] ?? "Ashwini";
}

export function padaOf(longitude: number): 1 | 2 | 3 | 4 {
  const offset = normalizeLongitude(longitude) % STAR_SPAN;
  return Math.floor((offset / STAR_SPAN) * 4 + 1) as 1 | 2 | 3 | 4;
}

export function starLordOf(longitude: number): KpLord {
  const index = Math.floor(normalizeLongitude(longitude) / STAR_SPAN);
  return STAR_LORD_CYCLE[index % STAR_LORD_CYCLE.length] ?? "Ketu";
}

export function subLordOf(longitude: number): KpLord {
  const offset = normalizeLongitude(longitude) % STAR_SPAN;
  return lordFromProportion(offset / STAR_SPAN, starLordOf(longitude));
}

export function subSubLordOf(longitude: number): KpLord {
  const offsetInStar = (normalizeLongitude(longitude) % STAR_SPAN) / STAR_SPAN;
  const starLord = starLordOf(longitude);
  const start = STAR_LORD_CYCLE.indexOf(starLord);
  let elapsed = 0;
  for (let index = 0; index < STAR_LORD_CYCLE.length; index++) {
    const planet = STAR_LORD_CYCLE[(start + index) % STAR_LORD_CYCLE.length];
    if (planet === undefined) return starLord;
    const span = VIMSHOTTARI_YEARS[planet] / 120;
    if (offsetInStar < elapsed + span) {
      return lordFromProportion((offsetInStar - elapsed) / span, planet);
    }
    elapsed += span;
  }
  return starLord;
}

export function kpLordChain(longitude: number): KpLordChain {
  return {
    signLord: signLordOf(longitude),
    starLord: starLordOf(longitude),
    subLord: subLordOf(longitude),
    subSubLord: subSubLordOf(longitude),
  };
}

export interface NamedKpLordChain extends KpLordChain {
  readonly name: string;
}

export interface CuspLordDetails extends NamedKpLordChain {
  readonly house: Chart.Houses;
  readonly longitude: number;
  /** Degrees within the sign, 0 <= d < 30. */
  readonly signDegree: number;
  /** Human-readable D°M'S" within the sign, for table lookup. */
  readonly dms: string;
  readonly sign: string;
  readonly star: StarName;
  readonly pada: 1 | 2 | 3 | 4;
}

export interface PlanetLordDetails extends NamedKpLordChain {
  readonly house: Chart.Houses;
  readonly longitude: number;
  /** Degrees within the sign, 0 <= d < 30. */
  readonly signDegree: number;
  /** Human-readable D°M'S" within the sign, for table lookup. */
  readonly dms: string;
  readonly sign: string;
  readonly star: StarName;
  readonly pada: 1 | 2 | 3 | 4;
}

export function signDegreeOf(longitude: number): number {
  return normalizeLongitude(longitude) % 30;
}

export function dmsOf(longitude: number): string {
  const d = signDegreeOf(longitude);
  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  return `${String(deg).padStart(2, "0")}°${String(min).padStart(2, "0")}'${String(sec).padStart(2, "0")}"`;
}

export function kpCuspAndPlanetLords(chart: Chart.Chart): {
  readonly cuspLords: ReadonlyArray<CuspLordDetails>;
  readonly planetLords: ReadonlyArray<PlanetLordDetails>;
} {
  const cuspLords = Chart.Houses.literals.flatMap((house) => {
    const chartHouse = chart.houses[house];
    const cusp = chartHouse.cusp;
    if (cusp === undefined) return [];
    return [
      {
        house,
        name: `House ${house}`,
        longitude: cusp,
        signDegree: signDegreeOf(cusp),
        dms: dmsOf(cusp),
        sign: chartHouse.sign,
        star: starNameOf(cusp),
        pada: padaOf(cusp),
        ...kpLordChain(cusp),
      },
    ];
  });

  const planetLords = Chart.Houses.literals.flatMap((house) => {
    const chartHouse = chart.houses[house];
    const planets = chartHouse.planets.map((planet) => ({
      house,
      name: planet.name,
      longitude: planet.longitude,
      signDegree: signDegreeOf(planet.longitude),
      dms: dmsOf(planet.longitude),
      sign: planet.sign.name,
      star: starNameOf(planet.longitude),
      pada: padaOf(planet.longitude),
      ...kpLordChain(planet.longitude),
    }));
    const lagna =
      chartHouse.lagna === null
        ? []
        : [
            {
              house,
              name: "Lagna" as const,
              longitude: chartHouse.lagna.longitude,
              signDegree: signDegreeOf(chartHouse.lagna.longitude),
              dms: dmsOf(chartHouse.lagna.longitude),
              sign: chartHouse.lagna.sign.name,
              star: starNameOf(chartHouse.lagna.longitude),
              pada: padaOf(chartHouse.lagna.longitude),
              ...kpLordChain(chartHouse.lagna.longitude),
            },
          ];
    return [...lagna, ...planets];
  });

  return { cuspLords, planetLords };
}
