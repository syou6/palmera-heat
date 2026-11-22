// The living city: the player on foot and in cars, the traffic that drives itself around the
// grid, the pedestrians on the kerbs, and every collision and crime that ties them to the police
// and mission systems. One fixed-step function advances it all; rendering and sound only read it.
import { AMBIENT, CAR_MODELS, FOOT, PALETTE, WANTED } from './config.js';
import { buildCity, clampToWorld, resolveCircle, ROAD_CENTRES } from './city.js';
import { createRandom } from './random.js';
import { createCar, forwardSpeed, speedOf, steerToward, stepCar } from './vehicles.js';
import { addHeat, createWanted, noteCarChanged, updatePolice, updateWanted } from './police.js';
import { createMissions, updateMissions } from './missions.js';

const TRAFFIC_MODELS = ['sedan', 'sedan', 'sedan', 'sport', 'pickup', 'taxi'];

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function makeCar(state, modelKey, x, y, angle) {
  const model = CAR_MODELS[modelKey];
  const car = createCar(modelKey, x, y, angle, pick(state.random, model.colors));
  state.allCars.push(car);
  return car;
}

/** A point on a road at ring distance from the player: where ambient life fades in. */
function roadPointAtRing(state, minDist, maxDist) {
  const { random, player } = state;
  for (let tries = 0; tries < 14; tries += 1) {
    const vertical = random() < 0.5;
    const centre = pick(random, ROAD_CENTRES);
    const along = 80 + random() * 3140;
    const x = vertical ? centre : along;
    const y = vertical ? along : centre;
    const dist = Math.hypot(x - player.x, y - player.y);
    if (dist >= minDist && dist <= maxDist) return { x, y, vertical };
  }
  return null;
}

function spawnTraffic(state) {
  const spot = roadPointAtRing(state, 500, AMBIENT.spawnRadius);
  if (!spot) return;
  const modelKey = pick(state.random, TRAFFIC_MODELS);
  const dirSign = state.random() < 0.5 ? 1 : -1;
  const angle = spot.vertical ? (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirSign > 0 ? 0 : Math.PI);
  const lane = spot.vertical ? (dirSign > 0 ? -35 : 35) : (dirSign > 0 ? 35 : -35);
  const car = makeCar(state, modelKey, spot.x + (spot.vertical ? lane : 0), spot.y + (spot.vertical ? 0 : lane), angle);
  car.driver = 'traffic';
  car.ai.dirX = spot.vertical ? 0 : dirSign;
  car.ai.dirY = spot.vertical ? dirSign : 0;
  car.ai.turnCd = 0;
  state.traffic.push(car);
}

function spawnPed(state) {
  const spot = roadPointAtRing(state, 380, AMBIENT.spawnRadius);
  if (!spot) return;
  const side = state.random() < 0.5 ? -1 : 1;
  const offset = side * 58;
  const ped = {
    x: spot.x + (spot.vertical ? offset : 0),
    y: spot.y + (spot.vertical ? 0 : offset),
    angle: 0, down: 0, flee: 0, fleeX: 0, fleeY: 0,
    dirX: spot.vertical ? 0 : (state.random() < 0.5 ? 1 : -1),
    dirY: spot.vertical ? (state.random() < 0.5 ? 1 : -1) : 0,
    speed: 62 + state.random() * 34,
    shirt: pick(state.random, PALETTE.pedShirt),
    phase: state.random() * Math.PI * 2,
  };
  ped.targetX = ped.x + ped.dirX * 300;
  ped.targetY = ped.y + ped.dirY * 300;
  state.peds.push(ped);
}

export function createGame(seed, saved) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const state = {
    random,
    city,
    time: 0,
    money: saved && Number.isFinite(saved.money) ? saved.money : 120,
    health: 100,
    player: null,
    allCars: [],
    traffic: [],
    copCars: [],
    officers: [],
    peds: [],
    markedCar: null,
    wanted: createWanted(),
    missions: null,
    toasts: [],
    fx: [],
    particles: [],
    skids: [],
    stats: { missionsDone: 0, jobsDone: 0, carsStolen: 0 },
    over: null,
    attract: false,
    repaint: { progress: 0, warnedAt: -99, engaged: false },
    flags: {},
  };
  state.missions = createMissions(saved);
  // Parked cars from the city's kerbs, including Marisol's Ciclon GT.
  for (const parked of city.parked) {
    const car = makeCar(state, parked.model, parked.x, parked.y, parked.angle);
    car.driver = null;
    if (parked.special === 'firstWheels') state.markedCar = car;
  }
  const home = city.landmarks.hideout;
  state.player = {
    x: home.x, y: home.y + 26, angle: -Math.PI / 2, vx: 0, vy: 0,
    mode: 'foot', car: null, punchCd: 0, hurtAt: -99,
  };
  for (let i = 0; i < AMBIENT.traffic; i += 1) spawnTraffic(state);
  for (let i = 0; i < AMBIENT.peds; i += 1) spawnPed(state);
  return state;
}

/** Did anyone close enough see that? Witnesses decide whether a crime costs full heat. */
function witnessed(state, x, y, radius) {
  for (const car of state.copCars) if (Math.hypot(car.x - x, car.y - y) < radius + 180) return true;
  for (const officer of state.officers) if (Math.hypot(officer.x - x, officer.y - y) < radius) return true;
  for (const ped of state.peds) if (ped.down <= 0 && Math.hypot(ped.x - x, ped.y - y) < radius) return true;
  return false;
}

function sparks(state, x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const a = state.random() * Math.PI * 2;
    const speed = 40 + state.random() * 130;
    state.particles.push({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.35 + state.random() * 0.3, maxLife: 0.65, color, size: 2 + state.random() * 2,
    });
  }
  if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
}

/** E beside a car: get in, or get out. Stealing is a crime when it is seen. */
export function enterExitCar(state) {
  const player = state.player;
  if (player.mode === 'car') {
    const car = player.car;
    car.driver = null;
    player.mode = 'foot';
    player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 24;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 24;
    resolveCircle(state.city, player, FOOT.radius);
    player.vx = 0;
    player.vy = 0;
    return;
  }
  let best = null;
  let bestDist = 52;
  for (const car of state.allCars) {
    if (car.driver === 'police') continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < bestDist) { best = car; bestDist = dist; }
  }
  if (!best) return;
  const wasTraffic = best.driver === 'traffic';
  if (wasTraffic) {
    state.traffic.splice(state.traffic.indexOf(best), 1);
    // The driver is thrown out and runs for it.
    state.peds.push({
      x: best.x + 20, y: best.y, angle: 0, down: 0, flee: 2.5, fleeX: best.x + 200, fleeY: best.y + 60,
      dirX: 1, dirY: 0, targetX: best.x + 300, targetY: best.y, speed: 150,
      shirt: pick(state.random, PALETTE.pedShirt), phase: 0,
    });
  }
  if (wasTraffic) {
    addHeat(state, witnessed(state, best.x, best.y, 430) ? WANTED.heatCarjack : WANTED.heatCarjackQuiet);
    state.stats.carsStolen += 1;
    state.fx.push({ type: 'carjack' });
  } else if (!best.everDriven) {
    // First time taking a parked car: quiet if nobody saw, dearer if they did.
    if (witnessed(state, best.x, best.y, 430)) addHeat(state, WANTED.heatCarjackQuiet);
    state.stats.carsStolen += 1;
  }
  best.everDriven = true;
  best.driver = 'player';
  player.mode = 'car';
  player.car = best;
  noteCarChanged(state);
}

/** F on foot: a punch. It drops a walker or an officer, and it is a crime when seen. */
export function playerPunch(state) {
  const player = state.player;
  if (player.mode !== 'foot' || player.punchCd > 0) return;
  player.punchCd = FOOT.punchCooldown;
  state.fx.push({ type: 'punch' });
  const reach = FOOT.punchRange;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.down <= 0 && Math.hypot(ped.x - player.x, ped.y - player.y) < reach + 8) {
      ped.down = 3.2;
      hit = true;
    }
  }
  for (const officer of state.officers) {
    if (officer.down <= 0 && Math.hypot(officer.x - player.x, officer.y - player.y) < reach + 8) {
      officer.down = 3.5;
      hit = true;
      addHeat(state, 80);
    }
  }
  if (hit && witnessed(state, player.x, player.y, 430)) addHeat(state, FOOT.punchHeat);
}

function hurtPlayer(state, amount) {
  if (amount <= 0) return;
  state.health = Math.max(0, state.health - amount);
  state.player.hurtAt = state.time;
  if (state.health <= 0 && !state.over) {
    state.over = 'wasted';
    state.fx.push({ type: 'wasted' });
  }
}

function updatePlayer(state, input, dt) {
  const player = state.player;
  player.punchCd = Math.max(0, player.punchCd - dt);
  if (player.mode === 'foot') {
    const move = input.moveVector();
    const length = Math.hypot(move.x, move.y);
    const speed = input.held.sprint ? FOOT.runSpeed : FOOT.walkSpeed;
    if (length > 0) {
      player.vx = (move.x / length) * speed;
      player.vy = (move.y / length) * speed;
      player.angle = Math.atan2(player.vy, player.vx);
    } else {
      player.vx = 0;
      player.vy = 0;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    resolveCircle(state.city, player, FOOT.radius);
    clampToWorld(player, FOOT.radius);
    return;
  }
  // Driving.
  const car = player.car;
  const throttle = (input.held.up ? 1 : 0) - (input.held.down ? 1 : 0);
  const steer = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  const impact = stepCar(car, dt, car.wrecked ? throttle * 0.3 : throttle, steer, input.held.handbrake, state.city);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.vx = car.vx;
  player.vy = car.vy;
  if (impact > 2.2) {
    state.fx.push({ type: 'crash', x: car.x, y: car.y, strength: Math.min(1, impact / 9) });
    sparks(state, car.x, car.y, Math.floor(impact * 2), '#ffd166');
    // The car takes the hit, not the body: only a truly huge impact hurts the driver.
    if (impact > 9) hurtPlayer(state, (impact - 9) * 0.5);
  }
  // Skid marks when the car slides hard.
  const fxv = Math.cos(car.angle);
  const fyv = Math.sin(car.angle);
  const lateral = Math.abs(car.vx * -fyv + car.vy * fxv);
  if ((lateral > 65 && speedOf(car) > 130) || (input.held.handbrake && speedOf(car) > 150)) {
    state.skids.push({ x: car.x - fxv * 16, y: car.y - fyv * 16, life: 5 });
    if (state.skids.length > 380) state.skids.shift();
  }
  updateRepaint(state, dt);
}

/**
 * Tito's: roll into the garage circle slow and the shutters come down — the job is engaged.
 * While engaged the car is inside: patrols cannot touch it, cannot arrest it, and the work
 * finishes on the clock however hot the street outside gets. Roll out and it disengages.
 */
function updateRepaint(state, dt) {
  const rp = state.repaint;
  const spot = state.city.landmarks.repaint;
  const player = state.player;
  const dist = player.mode === 'car' ? Math.hypot(player.x - spot.x, player.y - spot.y) : Infinity;
  if (!rp.engaged) {
    state.flags.repainting = 0;
    if (dist >= 74 || state.wanted.stars === 0 || Math.abs(forwardSpeed(player.car)) > 80) return;
    if (state.money < WANTED.repaintCost) {
      if (state.time - rp.warnedAt > 6) {
        rp.warnedAt = state.time;
        state.toasts.push({ title: "Tito's Repaint & Body", body: `A respray costs $${WANTED.repaintCost}. You do not have it.`, t: 0, ttl: 4 });
      }
      return;
    }
    rp.engaged = true;
    rp.progress = 0;
  }
  if (dist > 120) {
    rp.engaged = false;
    rp.progress = 0;
    state.flags.repainting = 0;
    return;
  }
  rp.progress += dt;
  state.flags.repainting = rp.progress / WANTED.repaintSeconds;
  if (rp.progress >= WANTED.repaintSeconds) {
    rp.engaged = false;
    rp.progress = 0;
    state.money -= WANTED.repaintCost;
    state.wanted.heat = 0;
    state.wanted.stars = 0;
    state.wanted.bust = 0;
    player.car.color = pick(state.random, CAR_MODELS[player.car.model].colors);
    state.toasts.push({ title: "Tito's Repaint & Body", body: `Fresh paint, clean plates. -$${WANTED.repaintCost}. The patrols lost you.`, t: 0, ttl: 5 });
    state.fx.push({ type: 'cash' });
  }
}

function nearestCentre(value) {
  let best = ROAD_CENTRES[0];
  for (const c of ROAD_CENTRES) if (Math.abs(c - value) < Math.abs(best - value)) best = c;
  return best;
}

function updateTrafficCar(state, car, dt) {
  const ai = car.ai;
  ai.turnCd = Math.max(0, ai.turnCd - dt);
  // The lane point ahead: along the current heading, snapped to this road's driving lane.
  let targetX = car.x + ai.dirX * 320;
  let targetY = car.y + ai.dirY * 320;
  if (ai.dirX !== 0) targetY = nearestCentre(car.y) + (ai.dirX > 0 ? 35 : -35);
  if (ai.dirY !== 0) targetX = nearestCentre(car.x) + (ai.dirY > 0 ? -35 : 35);
  // Near an intersection, sometimes turn.
  const nearX = Math.abs(car.x - nearestCentre(car.x)) < 46;
  const nearY = Math.abs(car.y - nearestCentre(car.y)) < 46;
  if (nearX && nearY && ai.turnCd <= 0) {
    ai.turnCd = 2.5;
    if (state.random() < 0.32) {
      const oldX = ai.dirX;
      ai.dirX = ai.dirY !== 0 ? (state.random() < 0.5 ? 1 : -1) : 0;
      ai.dirY = oldX !== 0 ? (state.random() < 0.5 ? 1 : -1) : 0;
      if (ai.dirX === 0 && ai.dirY === 0) ai.dirY = 1;
    }
  }
  // Company ahead? Match its pace; a walker ahead? Stop.
  let throttle = 0.72;
  for (const other of state.allCars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 88 && dx * ai.dirX + dy * ai.dirY > dist * 0.6) {
      throttle = dist < 56 ? 0 : Math.min(throttle, 0.3);
    }
  }
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 60 && dx * ai.dirX + dy * ai.dirY > dist * 0.55) throttle = 0;
  }
  if (car.wrecked) throttle = 0;
  const { steer } = steerToward(car, targetX, targetY);
  const impact = stepCar(car, dt, throttle, steer, false, state.city);
  if (impact > 3) state.fx.push({ type: 'crash', x: car.x, y: car.y, strength: Math.min(0.7, impact / 10) });
}

function updatePed(state, ped, dt) {
  if (ped.down > 0) {
    ped.down -= dt;
    return;
  }
  // Danger sends a walker running: a fast car close by is reason enough.
  let danger = null;
  for (const car of state.allCars) {
    if (speedOf(car) > 120 && Math.hypot(car.x - ped.x, car.y - ped.y) < 95) { danger = car; break; }
  }
  if (danger) {
    ped.flee = 1.6;
    ped.fleeX = ped.x - (danger.x - ped.x);
    ped.fleeY = ped.y - (danger.y - ped.y);
  }
  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.flee > 0) {
    ped.flee -= dt;
    tx = ped.fleeX;
    ty = ped.fleeY;
    speed = 168;
  } else {
    tx = ped.targetX;
    ty = ped.targetY;
    if (Math.hypot(tx - ped.x, ty - ped.y) < 26) {
      // At the end of a stretch: mostly carry on, sometimes turn down the crossing street.
      if (state.random() < 0.4) {
        const swap = ped.dirX;
        ped.dirX = ped.dirY !== 0 ? (state.random() < 0.5 ? 1 : -1) : 0;
        ped.dirY = swap !== 0 ? (state.random() < 0.5 ? 1 : -1) : 0;
        if (ped.dirX === 0 && ped.dirY === 0) ped.dirX = 1;
      }
      ped.targetX = ped.x + ped.dirX * 320;
      ped.targetY = ped.y + ped.dirY * 320;
      tx = ped.targetX;
      ty = ped.targetY;
    }
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy) || 1;
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / dist) * speed * dt;
  ped.y += (dy / dist) * speed * dt;
  resolveCircle(state.city, ped, 9);
  clampToWorld(ped, 9);
}

/** Car meets car, car meets walker: the shoves, the damage and the crimes. */
function updateCollisions(state) {
  const cars = state.allCars;
  // Inside Tito's bay the player's car sits behind bollards: shoves move the other car only.
  const bay = state.city.landmarks.repaint;
  const playerInBay = state.repaint.engaged || (state.player.mode === 'car'
    && Math.hypot(state.player.x - bay.x, state.player.y - bay.y) < 95);
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 40;
      if (dist === 0 || dist >= minDist) continue;
      const push = (minDist - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      // The player's car is authoritative: contact moves the other car, never it. A scrum of
      // patrols can box the player in, but it cannot carry the car across the map.
      if (a === state.player.car) {
        b.x += nx * push * 2;
        b.y += ny * push * 2;
      } else if (b === state.player.car) {
        a.x -= nx * push * 2;
        a.y -= ny * push * 2;
      } else {
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
      const relAlong = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      const relSpeed = Math.abs(relAlong);
      // Behind the bollards, a shove spends itself on the other car: no impulse, no crime.
      if (playerInBay && (a === state.player.car || b === state.player.car)) continue;
      if (relSpeed > 30) {
        const impulse = relAlong * 0.4;
        a.vx += nx * impulse;
        a.vy += ny * impulse;
        b.vx -= nx * impulse;
        b.vy -= ny * impulse;
      }
      if (relSpeed > 90) {
        state.fx.push({ type: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, strength: Math.min(1, relSpeed / 320) });
        sparks(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#ffd166');
        const playerCar = state.player.car;
        if ((a === playerCar || b === playerCar) && state.time - (state.flags.lastCarCrimeAt ?? -9) > 1.5) {
          state.flags.lastCarCrimeAt = state.time;
          const other = a === playerCar ? b : a;
          if (other.driver === 'police') addHeat(state, WANTED.heatHitPolice);
          else if (witnessed(state, other.x, other.y, 430)) addHeat(state, WANTED.heatHitCar);
        }
      }
    }
  }
  // Cars and walkers.
  for (const car of cars) {
    if (speedOf(car) < 55) continue;
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
        ped.down = 6;
        ped.flee = 3;
        state.fx.push({ type: 'thud', x: ped.x, y: ped.y });
        sparks(state, ped.x, ped.y, 6, '#ef476f');
        if (car === state.player.car) {
          addHeat(state, witnessed(state, ped.x, ped.y, 430) ? WANTED.heatHitPed : WANTED.heatHitPed * 0.5);
        }
      }
    }
    // Traffic can run the player down, too.
    const player = state.player;
    if (player.mode === 'foot' && car.driver !== 'player' && Math.hypot(player.x - car.x, player.y - car.y) < 28
      && state.time - player.hurtAt > 0.7) {
      hurtPlayer(state, 14);
      player.x += car.vx * 0.04;
      player.y += car.vy * 0.04;
    }
  }
}

/** Keep the ambient city full near the player and empty far away. */
function updateAmbient(state) {
  const player = state.player;
  for (let i = state.traffic.length - 1; i >= 0; i -= 1) {
    const car = state.traffic[i];
    if (Math.hypot(car.x - player.x, car.y - player.y) > AMBIENT.keepRadius) {
      state.traffic.splice(i, 1);
      state.allCars.splice(state.allCars.indexOf(car), 1);
    }
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(state.peds[i].x - player.x, state.peds[i].y - player.y) > AMBIENT.keepRadius) state.peds.splice(i, 1);
  }
  if (state.traffic.length < AMBIENT.traffic) spawnTraffic(state);
  if (state.peds.length < AMBIENT.peds) spawnPed(state);
}

/** Advance the whole city one fixed step. Input is the live keyboard state from input.js. */
export function stepGame(state, input, dt) {
  state.time += dt;
  for (const toast of state.toasts) toast.t += dt;
  state.toasts = state.toasts.filter((toast) => toast.t < toast.ttl);
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }
  if (!state.attract && !state.over) updatePlayer(state, input, dt);
  for (const car of state.traffic) updateTrafficCar(state, car, dt);
  for (const ped of state.peds) updatePed(state, ped, dt);
  if (!state.attract) {
    updateCollisions(state);
    updateWanted(state, dt);
    updatePolice(state, dt);
    updateMissions(state, dt);
    // Slow recovery while the city is calm.
    if (state.wanted.stars === 0 && state.health > 0) state.health = Math.min(100, state.health + 2.4 * dt);
    updateAmbient(state);
  }
  // Internal events the world itself must act on, consumed here so they fire exactly once;
  // the rest of the queue is sound-and-picture material for the caller.
  for (let i = state.fx.length - 1; i >= 0; i -= 1) {
    const event = state.fx[i];
    if (event.type === 'crash' && event.x !== undefined) sparks(state, event.x, event.y, 5, '#ffd166');
    if (event.type === 'playerHurt') {
      hurtPlayer(state, event.amount);
      state.fx.splice(i, 1);
    }
  }
}
