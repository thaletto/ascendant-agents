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

export function kpCuspAndPlanetLords(chart: Chart.Chart): {
  readonly cuspLords: ReadonlyArray<NamedKpLordChain & { readonly house: Chart.Houses }>;
  readonly planetLords: ReadonlyArray<NamedKpLordChain>;
} {
  const cuspLords = Chart.Houses.literals.flatMap((house) => {
    const cusp = chart.houses[house].cusp;
    if (cusp === undefined) return [];
    return [{ house, name: `House ${house}`, ...kpLordChain(cusp) }];
  });

  const planetLords = Chart.Houses.literals.flatMap((house) => {
    const chartHouse = chart.houses[house];
    const planets = chartHouse.planets.map((planet) => ({
      name: planet.name,
      ...kpLordChain(planet.longitude),
    }));
    const lagna =
      chartHouse.lagna === null
        ? []
        : [{ name: "Lagna", ...kpLordChain(chartHouse.lagna.longitude) }];
    return [...lagna, ...planets];
  });

  return { cuspLords, planetLords };
}
