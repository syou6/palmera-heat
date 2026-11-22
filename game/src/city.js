// The city of Palmera, built once from a seed: a grid of avenues, pastel blocks, a central park,
// a beach promenade on the east edge, and the named places the story uses. Everything the rest of
// the game needs to know about the map — where the buildings stand, where the roads run, where a
// circle body may not go — is answered here.
import { WORLD } from './config.js';

/** Road centrelines on both axes: five avenues each way across the 3300px city. */
export const ROAD_CENTRES = [330, 990, 1650, 2310, 2970];

const ROOF_COLORS = ['#e5989b', '#ffb4a2', '#ffcdb2', '#b5838d', '#84a98c', '#90be6d', '#f9c74f', '#f9844a', '#43aa8b', '#577590', '#e07a5f', '#81b29a'];
const FLAVOUR_NAMES = ['Hotel Coral', 'Club Marea', 'Mercado Central', 'Apartamentos Brisa', 'Oficinas del Puerto', 'Tienda Sol', 'Farmacia Luz', 'Hotel Palma Real', 'Cine Sol', 'Bar La Ola', 'Libreria Marea', 'Hotel Miramar'];

/** The four plots of one block, as [dx, dy, w, h] inside its 520px square. */
const PLOTS_FOUR = [
  [10, 10, 240, 240],
  [270, 10, 240, 240],
  [10, 270, 240, 240],
  [270, 270, 240, 240],
];
const PLOTS_TWO = [
  [10, 10, 500, 240],
  [10, 270, 500, 240],
];

function blockOrigin(index) {
  return 400 + index * WORLD.pitch;
}

function addBuilding(city, x, y, w, h, color, name) {
  const building = { x, y, w, h, color, name: name ?? null, crate: false };
  city.buildings.push(building);
  return building;
}

/**
 * Build the whole city from `random` (a seeded generator, so screenshots and saves agree).
 * Landmarks carry a marker point on the road in front of them: the spot missions send you to.
 */
export function buildCity(random) {
  const city = {
    buildings: [],
    palms: [],
    parks: [],
    landmarks: {},
    parked: [],
    roadsX: ROAD_CENTRES,
    roadsY: ROAD_CENTRES,
  };
  let flavour = 0;
  const nextFlavour = () => FLAVOUR_NAMES[flavour++ % FLAVOUR_NAMES.length];

  // The named places, each on its own block; the marker sits on the road south of the block.
  const named = [
    { id: 'diner', bi: 3, bj: 0, name: "Cafe Brisa — Marisol's Diner", color: '#f28482' },
    { id: 'bank', bi: 1, bj: 1, name: 'Palmera Trust Bank', color: '#577590' },
    { id: 'repaint', bi: 0, bj: 1, name: "Tito's Repaint & Body", color: '#43aa8b' },
    { id: 'garage', bi: 3, bj: 1, name: 'Vega Motors Garage', color: '#f9c74f' },
    { id: 'hideout', bi: 0, bj: 3, name: 'Solano Safehouse', color: '#b5838d' },
  ];
  const namedBlocks = new Set(named.map((n) => `${n.bi},${n.bj}`));
  for (const place of named) {
    const x0 = blockOrigin(place.bi);
    const y0 = blockOrigin(place.bj);
    addBuilding(city, x0 + 10, y0 + 10, 500, 500, place.color, place.name);
    city.landmarks[place.id] = { id: place.id, name: place.name, x: x0 + 260, y: y0 + 590 };
  }
  // The docks: an open yard in the south-east block, crates for cover, marker at its heart.
  {
    const x0 = blockOrigin(3);
    const y0 = blockOrigin(3);
    city.landmarks.docks = { id: 'docks', name: 'Muelle Sur Docks', x: x0 + 260, y: y0 + 260 };
    city.parks.push({ x: x0, y: y0, w: 520, h: 520, kind: 'yard' });
    for (let i = 0; i < 7; i += 1) {
      const crate = addBuilding(city, x0 + 30 + random() * 380, y0 + 30 + random() * 380, 52, 52, '#bc6c25', null);
      crate.crate = true;
    }
  }
  // Parque Central: the green heart of the city, palms and paths, nothing to crash into but trees.
  {
    const x0 = blockOrigin(2);
    const y0 = blockOrigin(1);
    city.parks.push({ x: x0, y: y0, w: 520, h: 520, kind: 'park' });
    for (let gx = 0; gx < 4; gx += 1) {
      for (let gy = 0; gy < 4; gy += 1) {
        city.palms.push({ x: x0 + 70 + gx * 130 + random() * 30, y: y0 + 70 + gy * 130 + random() * 30 });
      }
    }
  }
  const parkBlock = '2,1';
  const docksBlock = '3,3';

  // Ordinary blocks: four towers, two slabs, or one big pastel block, by the seed's say.
  for (let bi = 0; bi < 4; bi += 1) {
    for (let bj = 0; bj < 4; bj += 1) {
      const key = `${bi},${bj}`;
      if (namedBlocks.has(key) || key === parkBlock || key === docksBlock) continue;
      const x0 = blockOrigin(bi);
      const y0 = blockOrigin(bj);
      const roll = random();
      if (roll < 0.45) {
        for (const [dx, dy, w, h] of PLOTS_FOUR) {
          addBuilding(city, x0 + dx, y0 + dy, w, h, ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)], null);
        }
      } else if (roll < 0.75) {
        for (const [dx, dy, w, h] of PLOTS_TWO) {
          const name = random() < 0.4 ? nextFlavour() : null;
          addBuilding(city, x0 + dx, y0 + dy, w, h, ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)], name);
        }
      } else {
        addBuilding(city, x0 + 20, y0 + 20, 480, 480, ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)], nextFlavour());
      }
      // A palm or two on the block's corners.
      if (random() < 0.7) city.palms.push({ x: x0 + 6, y: y0 + 6 });
      if (random() < 0.7) city.palms.push({ x: x0 + 514, y: y0 + 514 });
    }
  }
  // Slim buildings along the west edge, so the map border is city, not void.
  for (let bj = 0; bj < 4; bj += 1) {
    const y0 = blockOrigin(bj);
    addBuilding(city, 24, y0 + 30, 210, 210, ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)], null);
    addBuilding(city, 24, y0 + 280, 210, 210, ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)], null);
  }
  // Palms along the east promenade, above the beach.
  for (let y = 120; y < WORLD.size - 80; y += 190) {
    city.palms.push({ x: 3085, y: y + random() * 40 });
  }

  // Parked cars: along the kerbs of the avenues, plus one guaranteed Ciclon GT near the diner —
  // the car Marisol will ask you to lift in your first real job.
  const parkedModels = ['sedan', 'sedan', 'sedan', 'pickup', 'sport', 'taxi'];
  for (let i = 0; i < 26; i += 1) {
    const vertical = random() < 0.5;
    const centre = ROAD_CENTRES[Math.floor(random() * ROAD_CENTRES.length)];
    const along = 120 + random() * (WORLD.size - 240);
    const side = random() < 0.5 ? -1 : 1;
    const offset = side * (WORLD.road / 2 - 17);
    city.parked.push({
      x: vertical ? centre + offset : along,
      y: vertical ? along : centre + offset,
      angle: vertical ? Math.PI / 2 : 0,
      model: parkedModels[Math.floor(random() * parkedModels.length)],
    });
  }
  city.parked.push({ x: 2565, y: 905, angle: 0, model: 'sport', special: 'firstWheels' });
  return city;
}

/** True when (x, y) is on a road, either an avenue or a street. */
export function isOnRoad(city, x, y) {
  const half = WORLD.road / 2;
  for (const c of city.roadsX) if (Math.abs(x - c) <= half) return true;
  for (const c of city.roadsY) if (Math.abs(y - c) <= half) return true;
  return false;
}

/**
 * Push a circle body at (body.x, body.y) out of every building it overlaps. Returns the deepest
 * penetration found (0 when it touched nothing), which callers read as a collision's strength.
 */
export function resolveCircle(city, body, radius) {
  let deepest = 0;
  for (const b of city.buildings) {
    const nearX = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nearX;
    const dy = body.y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      body.x += (dx / dist) * push;
      body.y += (dy / dist) * push;
      if (push > deepest) deepest = push;
    } else {
      // Centre inside the building: leave by the nearest face.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - radius;
      else if (min === right) body.x = b.x + b.w + radius;
      else if (min === top) body.y = b.y - radius;
      else body.y = b.y + b.h + radius;
      deepest = Math.max(deepest, radius);
    }
  }
  return deepest;
}

/** Clamp a point into the world, with a margin for the body's radius. */
export function clampToWorld(body, radius) {
  body.x = Math.max(radius, Math.min(WORLD.size - radius, body.x));
  body.y = Math.max(radius, Math.min(WORLD.size - radius, body.y));
}
