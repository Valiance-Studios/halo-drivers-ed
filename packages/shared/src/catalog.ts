/** The two sides of the war, each with its own vehicles and instructors. */
export const FACTIONS = ['unsc', 'covenant'] as const;
export type Faction = (typeof FACTIONS)[number];

export const FACTION_NAMES: Record<Faction, string> = {
  unsc: 'UNSC',
  covenant: 'Covenant',
};

/** Where a vehicle operates, which groups the course list. */
export const VEHICLE_DOMAINS = ['ground', 'air'] as const;
export type VehicleDomain = (typeof VEHICLE_DOMAINS)[number];

export interface Vehicle {
  slug: string;
  name: string;
  faction: Faction;
  domain: VehicleDomain;
  description: string;
  /** How long one lesson takes. */
  lessonMinutes: number;
  /** How many lessons complete the course. */
  lessonsRequired: number;
  /** Slugs of the vehicles whose courses must be completed first. */
  prerequisites: string[];
}

export interface Instructor {
  slug: string;
  name: string;
  /** Rank or title, e.g. "Sergeant Major". */
  title: string;
  faction: Faction;
  bio: string;
  /** Slugs of the vehicles this instructor teaches, all from the instructor's own faction. */
  vehicles: string[];
}
