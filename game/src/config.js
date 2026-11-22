// Every tuning number, name and colour for Palmera Heat in one place. The world is a fixed
// 3300x3300 city of square blocks; the renderer scales a camera view of it to the window, so no
// rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = {
  size: 3300,
  /** Distance between neighbouring road centrelines. */
  pitch: 660,
  /** Full width of a road, kerb to kerb. */
  road: 140,
};

/** The player on foot. */
export const FOOT = {
  radius: 13,
  walkSpeed: 155,
  runSpeed: 258,
  punchRange: 36,
  punchCooldown: 0.45,
  punchHeat: 60,
};

/**
 * The drivable cars of Palmera. Lengths and widths are the body's, in pixels; speeds are pixels
 * a second. `heat` is not here: what a crime is worth lives in WANTED.
 */
export const CAR_MODELS = {
  sedan: { name: 'Brisas Sedan', length: 52, width: 26, topSpeed: 305, reverse: 120, accel: 250, grip: 7.5, health: 100, colors: ['#7fb3d5', '#a9cce3', '#f5cba7', '#a3e4db', '#d5dbdb', '#f1948a'] },
  sport: { name: 'Ciclon GT', length: 54, width: 27, topSpeed: 430, reverse: 140, accel: 380, grip: 8.5, health: 90, colors: ['#ec7063', '#f39c12', '#af7ac5', '#48c9b0', '#f7dc6f'] },
  pickup: { name: 'Mula Pickup', length: 58, width: 29, topSpeed: 255, reverse: 110, accel: 210, grip: 6.5, health: 150, colors: ['#a04000', '#616a6b', '#7d6608', '#1a5276', '#784212'] },
  taxi: { name: 'Taxi Sol', length: 52, width: 26, topSpeed: 300, reverse: 120, accel: 245, grip: 7.5, health: 100, colors: ['#f4d03f'] },
  police: { name: 'Patrulla Interceptor', length: 54, width: 27, topSpeed: 395, reverse: 140, accel: 350, grip: 8.5, health: 140, colors: ['#f4f6f7'] },
};

/** How the wanted level works: heat points buy stars, and stars decide the response. */
export const WANTED = {
  /** Heat at which each star (1 to 5) switches on. */
  thresholds: [100, 220, 360, 520, 700],
  /** Heat lost a second while no witness or officer can see the player. */
  decay: 9,
  /** Seconds of being watched before decay is fully blocked. */
  sightGrace: 1.2,
  heatCarjack: 100,
  heatCarjackQuiet: 45,
  heatHitPed: 110,
  heatHitPolice: 160,
  heatHitCar: 25,
  heatRobbery: 260,
  /** Seconds an officer or a patrol car must hold the player still to bust them. */
  bustTime: 2.0,
  repaintCost: 150,
  repaintSeconds: 1.6,
};

/** How many ambient cars and walkers the city keeps around the player. */
export const AMBIENT = {
  traffic: 16,
  parked: 26,
  peds: 26,
  keepRadius: 1250,
  spawnRadius: 1050,
};

/** Police strength by wanted stars: patrol cars, foot officers, top speed factor. */
export const POLICE_BY_STARS = [
  { cars: 0, officers: 0, speed: 0 },
  { cars: 1, officers: 1, speed: 0.82 },
  { cars: 2, officers: 1, speed: 0.88 },
  { cars: 3, officers: 2, speed: 0.94 },
  { cars: 4, officers: 2, speed: 1.0 },
  { cars: 6, officers: 3, speed: 1.06 },
];

/** Sun-soaked Palmera: warm asphalt, pastel roofs, teal sea light. */
export const PALETTE = {
  sidewalk: '#cbb59a',
  road: '#4a423e',
  roadEdge: '#e8dcc8',
  lane: '#e9c46a',
  park: '#7fb069',
  sand: '#eed9a4',
  sea: '#2a9d8f',
  buildingShadow: 'rgba(59, 38, 24, 0.35)',
  roofTrim: 'rgba(255,255,255,0.25)',
  palmTrunk: '#8a5a33',
  palmLeaf: '#2e933c',
  playerBody: '#ffd23f',
  playerSkin: '#8d5524',
  pedShirt: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#e8e8e8', '#6d8ea0', '#bc6c25'],
  officerBody: '#1d3557',
  hudPanel: 'rgba(20, 16, 14, 0.72)',
  hudText: '#fff7e6',
  hudMuted: '#d8c9ae',
  gold: '#ffb703',
  danger: '#ef476f',
  ok: '#06d6a0',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'palmera-heat.save.v1';

/** The people and places of the story, all invented for this game. */
export const STORY = {
  playerName: 'Dario Solano',
  fixerName: 'Marisol Vega',
  cityName: 'Palmera',
};
