// The wanted level and the Palmera police who answer it. Crimes add heat; heat buys stars; stars
// decide how many patrol cars and foot officers the city sends, and how fast they come. Heat only
// cools while nobody in uniform can see you — break line of sight, swap cars unseen, or pay
// Tito's to repaint yours, and the stars go out one by one. Hold still next to an officer or a
// patrol car for two seconds and you are busted.
import { POLICE_BY_STARS, WANTED } from './config.js';
import { clampToWorld, isOnRoad, resolveCircle, ROAD_CENTRES } from './city.js';
import { createCar, forwardSpeed, speedOf, steerToward, stepCar } from './vehicles.js';

export function createWanted() {
  return { heat: 0, stars: 0, seenFor: 0, bust: 0, lastCrimeAt: -99 };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (const threshold of WANTED.thresholds) if (heat >= threshold) stars += 1;
  return stars;
}

/** Record a crime. Witnessed crimes cost full heat; quiet ones cost the listed amount as given. */
export function addHeat(state, amount) {
  const wanted = state.wanted;
  wanted.heat = Math.min(950, wanted.heat + amount);
  wanted.stars = starsForHeat(wanted.heat);
  wanted.lastCrimeAt = state.time;
}

/** Swapping cars while nobody watches halves the heat: the description no longer matches. */
export function noteCarChanged(state) {
  if (state.wanted.seenFor === 0 && state.wanted.heat > 0) {
    state.wanted.heat *= 0.55;
    state.wanted.stars = starsForHeat(state.wanted.heat);
  }
}

function randomRoadPointNear(state, minDist, maxDist) {
  const { player, city, random } = state;
  for (let tries = 0; tries < 12; tries += 1) {
    const cx = ROAD_CENTRES[Math.floor(random() * ROAD_CENTRES.length)];
    const cy = ROAD_CENTRES[Math.floor(random() * ROAD_CENTRES.length)];
    const x = cx + (random() - 0.5) * 300;
    const y = cy + (random() - 0.5) * 300;
    const dist = Math.hypot(x - player.x, y - player.y);
    if (dist >= minDist && dist <= maxDist) return { x, y };
  }
  return { x: player.x + maxDist, y: player.y };
}

function spawnCopCar(state) {
  const spot = randomRoadPointNear(state, 640, 920);
  const car = createCar('police', spot.x, spot.y, Math.atan2(state.player.y - spot.y, state.player.x - spot.x), '#f4f6f7');
  car.driver = 'police';
  state.copCars.push(car);
  state.allCars.push(car);
}

function spawnOfficer(state) {
  const spot = randomRoadPointNear(state, 420, 640);
  state.officers.push({
    x: spot.x, y: spot.y, angle: 0, down: 0, shirt: '#1d3557',
    phase: state.random() * Math.PI * 2,
  });
}

/** Any uniform within sight range of the player? Drives both heat decay and the HUD eye icon. */
export function policeCanSee(state) {
  const p = state.player;
  for (const car of state.copCars) if (Math.hypot(car.x - p.x, car.y - p.y) < 620) return true;
  for (const officer of state.officers) if (Math.hypot(officer.x - p.x, officer.y - p.y) < 480) return true;
  return false;
}

/** Advance the wanted level itself: sight, decay, star changes. */
export function updateWanted(state, dt) {
  const wanted = state.wanted;
  if (policeCanSee(state)) wanted.seenFor += dt;
  else wanted.seenFor = 0;
  if (wanted.seenFor === 0 && state.time - wanted.lastCrimeAt > WANTED.sightGrace && !state.repainting) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decay * dt);
    wanted.stars = starsForHeat(wanted.heat);
  }
}

/** Advance every patrol car and officer, and the bust meter they feed. */
export function updatePolice(state, dt) {
  const wanted = state.wanted;
  const plan = POLICE_BY_STARS[wanted.stars];
  const player = state.player;

  // No stars: the show is over. Patrols pull away and are gone by the next block; officers
  // melt into the crowd. Nobody rams a driver the city is not looking for.
  if (wanted.stars === 0) {
    wanted.bust = 0;
    for (let i = state.copCars.length - 1; i >= 0; i -= 1) {
      const car = state.copCars[i];
      const away = steerToward(car, car.x + (car.x - player.x), car.y + (car.y - player.y));
      stepCar(car, dt, 0.85, away.steer, false, state.city);
      if (Math.hypot(car.x - player.x, car.y - player.y) > 620) {
        state.copCars.splice(i, 1);
        state.allCars.splice(state.allCars.indexOf(car), 1);
      }
    }
    for (let i = state.officers.length - 1; i >= 0; i -= 1) {
      const officer = state.officers[i];
      const dx = officer.x - player.x;
      const dy = officer.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      officer.x += (dx / dist) * 120 * dt;
      officer.y += (dy / dist) * 120 * dt;
      if (dist > 340) state.officers.splice(i, 1);
    }
    return;
  }

  // Reinforce or stand down to the strength the stars call for.
  if (wanted.stars > 0) {
    if (state.copCars.length < plan.cars) spawnCopCar(state);
    if (state.officers.length < plan.officers && player.mode === 'foot') spawnOfficer(state);
  }
  for (let i = state.copCars.length - 1; i >= 0; i -= 1) {
    const car = state.copCars[i];
    if (Math.hypot(car.x - player.x, car.y - player.y) > 1700) {
      state.copCars.splice(i, 1);
      state.allCars.splice(state.allCars.indexOf(car), 1);
    }
  }
  for (let i = state.officers.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(state.officers[i].x - player.x, state.officers[i].y - player.y) > 1500) state.officers.splice(i, 1);
  }

  let bustPressure = 0;

  // Tito's bay is neutral ground: with the car inside and the shutters coming down, patrols
  // hold at the kerb and wait rather than pile in. The repaint can always be finished.
  const bay = state.city.landmarks.repaint;
  const playerInBay = state.repaint.engaged
    || (player.mode === 'car' && Math.hypot(player.x - bay.x, player.y - bay.y) < 95);

  // Patrol cars hunt the player's position, predicted a little along their motion.
  for (const car of state.copCars) {
    const lead = 0.35;
    const tx = player.x + player.vx * lead;
    const ty = player.y + player.vy * lead;
    const dist = Math.hypot(tx - car.x, ty - car.y);
    const { steer, diff } = steerToward(car, tx, ty);
    let throttle = Math.abs(diff) < 1.15 ? 1 : 0.25;
    if (player.mode === 'foot' && dist < 70) throttle = 0; // cars do not run a suspect down
    if (player.mode === 'car' && dist < 75) throttle *= 0.35; // alongside: block and box, not ram
    if (player.mode === 'car' && dist < 46) throttle = Math.min(throttle, 0.1); // at the door: stop grinding in
    if (playerInBay && dist < 165) throttle = 0; // held at the kerb outside Tito's
    if (dist < 34 && !playerInBay) throttle = -0.4;
    // Momentum is braked hard near the bay, so a patrol arriving hot stops at the kerb
    // instead of coasting in and shoving the car under the shutters out of the zone.
    if (playerInBay && Math.hypot(car.x - bay.x, car.y - bay.y) < 215) {
      const brake = Math.exp(-7 * dt);
      car.vx *= brake;
      car.vy *= brake;
    }
    const speedScale = plan.speed;
    const impact = stepCar(car, dt, throttle * speedScale, steer, false, state.city);
    if (impact > 2.5 && speedOf(car) > 40) state.fx.push({ type: 'crash', x: car.x, y: car.y, strength: Math.min(1, impact / 9) });
    if (playerInBay) {
      // No arrest is made inside the bay.
    } else if (player.mode === 'car' && player.car) {
      // A car bust needs a patrol right at the door of a car that has stopped fighting.
      if (dist < 47 && Math.abs(forwardSpeed(player.car)) < 26) bustPressure = Math.max(bustPressure, 0.65);
    } else if (dist < 52) {
      bustPressure = Math.max(bustPressure, 0.5);
    }
  }

  // Officers chase on foot; a punched officer stays down for a few seconds.
  for (const officer of state.officers) {
    if (officer.down > 0) {
      officer.down -= dt;
      continue;
    }
    const dx = player.x - officer.x;
    const dy = player.y - officer.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = player.mode === 'car' ? 268 : 238;
    officer.angle = Math.atan2(dy, dx);
    if (!(playerInBay && dist < 90)) {
      officer.x += (dx / dist) * speed * dt;
      officer.y += (dy / dist) * speed * dt;
    }
    resolveCircle(state.city, officer, 12);
    clampToWorld(officer, 12);
    if (playerInBay) {
      // Officers wait outside the bay with the cars.
    } else if (player.mode === 'foot' && dist < 30) bustPressure = 1;
    else if (player.mode === 'car' && dist < 40 && Math.abs(forwardSpeed(player.car)) < 26) bustPressure = 1;
    // An officer beside a moving car hurts the player a little: dragged, not arrested.
    if (player.mode === 'foot' && dist < 24 && state.time - (officer.lastHitAt ?? -9) > 0.8) {
      officer.lastHitAt = state.time;
      state.fx.push({ type: 'playerHurt', amount: 6 });
    }
  }

  // The bust meter: hold the player still under pressure and it fills; move and it drains.
  // While Tito's crew has the car in the bay (repainting), nobody makes an arrest.
  if (bustPressure > 0 && wanted.stars > 0 && !state.flags.repainting) {
    wanted.bust = Math.min(1, wanted.bust + (dt / WANTED.bustTime) * bustPressure);
  } else {
    wanted.bust = Math.max(0, wanted.bust - dt * 0.7);
  }
  if (wanted.bust >= 1 && !state.over) {
    state.over = 'busted';
    state.fx.push({ type: 'busted' });
  }
}
