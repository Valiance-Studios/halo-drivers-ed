import type {Faction, Vehicle} from '@hde/shared';

export interface RouteStop {
  vehicle: Vehicle;
  /** The stop's center, as fractions of the map's width and height. */
  x: number;
  y: number;
}

export interface RouteLayout {
  stops: RouteStop[];
  /** SVG path data in `ROUTE_WIDTH` by `ROUTE_HEIGHT` units: one line per prerequisite. */
  path: string;
  rows: number;
}

export const ROUTE_WIDTH = 1000;
export const ROUTE_HEIGHT = 300;

/**
 * Places vehicles along their prerequisites, left to right. The column is how many courses come before it; each
 * branch that ends gets its own row, and a vehicle sits midway between the branches it opens.
 */
export function layoutRoute(vehicles: Vehicle[], faction: Faction): RouteLayout {
  const slugs = new Set(vehicles.map(({slug}) => slug));
  // With several prerequisites, the first one places the vehicle; every one still gets a line.
  const parentOf = (vehicle: Vehicle): string | undefined => vehicle.prerequisites.find((slug) => slugs.has(slug));
  const cells = new Map<string, {column: number; row: number}>();
  let rows = 0;
  let columns = 0;

  function place(vehicle: Vehicle, column: number): number {
    columns = Math.max(columns, column + 1);
    const childRows = vehicles
      .filter((child) => parentOf(child) === vehicle.slug)
      .map((child) => place(child, column + 1));
    const row = childRows.length > 0 ? (Math.min(...childRows) + Math.max(...childRows)) / 2 : rows++;
    cells.set(vehicle.slug, {column, row});

    return row;
  }

  for (const vehicle of vehicles) {
    if (!parentOf(vehicle)) {
      place(vehicle, 0);
    }
  }

  const stops = vehicles.flatMap((vehicle): RouteStop[] => {
    const cell = cells.get(vehicle.slug);

    return cell ? [{vehicle, x: (cell.column + 0.5) / columns, y: (cell.row + 0.5) / rows}] : [];
  });
  const lines = stops.flatMap((stop) =>
    stops
      .filter(({vehicle}) => stop.vehicle.prerequisites.includes(vehicle.slug))
      .map((from) => linePath(from, stop, faction)),
  );

  return {stops, path: lines.join(''), rows};
}

/** UNSC roads turn at angles; Covenant conduits curve. */
function linePath(from: RouteStop, to: RouteStop, faction: Faction): string {
  const [x1, y1, x2, y2] = [from.x * ROUTE_WIDTH, from.y * ROUTE_HEIGHT, to.x * ROUTE_WIDTH, to.y * ROUTE_HEIGHT].map(
    Math.round,
  ) as [number, number, number, number];
  const middle = Math.round((x1 + x2) / 2);

  if (faction === 'covenant') {
    return `M${x1} ${y1}C${middle} ${y1} ${middle} ${y2} ${x2} ${y2}`;
  }

  return `M${x1} ${y1}H${middle - 20}L${middle + 20} ${y2}H${x2}`;
}
