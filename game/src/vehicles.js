// Cars: their shape, and the one arcade driving model every car in Palmera uses — the player's,
// the traffic's and the police's alike. Velocity is kept as a vector and split into forward and
// lateral parts each step; the lateral part bleeds away at the model's grip rate, which is what
// makes a handbrake turn slide. Buildings are solid: two probe circles, nose and tail, are pushed
// out of them, and a hard push reports itself as an impact.
import { CAR_MODELS } from './config.js';
import { clampToWorld, resolveCircle } from './city.js';

let nextCarId = 1;

export function createCar(modelKey, x, y, angle, color) {
  const model = CAR_MODELS[modelKey];
  return {
    id: nextCarId++,
    model: modelKey,
    x, y, angle,
    vx: 0, vy: 0,
    color,
    health: model.health,
    driver: null, // null = parked, else 'traffic', 'player' or 'police'
    ai: { targetX: x, targetY: y, wait: 0, lane: 1 },
    wrecked: false,
  };
}

/** Speed along the car's nose, signed (negative in reverse). */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/** Total speed, for the speedometer and the crash maths. */
export function speedOf(car) {
  return Math.hypot(car.vx, car.vy);
}

/**
 * Advance one car one step. `throttle` is -1..1, `steer` is -1..1, `handbrake` a boolean.
 * Returns the impact depth of the worst building hit this step (0 = none).
 */
export function stepCar(car, dt, throttle, steer, handbrake, city) {
  const model = CAR_MODELS[car.model];
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let along = car.vx * fx + car.vy * fy;
  let latX = car.vx - fx * along;
  let latY = car.vy - fy * along;

  // Steering bites in proportion to speed, and flips in reverse, as a real wheel does.
  const steerAuthority = Math.max(-1, Math.min(1, along / 130));
  car.angle += steer * 2.1 * steerAuthority * dt * (handbrake ? 1.35 : 1);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  // Re-split the old velocity on the new heading so a turn keeps the slide it earned.
  const keptAlong = car.vx * nfx + car.vy * nfy;
  latX = car.vx - nfx * keptAlong;
  latY = car.vy - nfy * keptAlong;
  along = keptAlong;

  if (throttle > 0) {
    if (along < model.topSpeed) along += model.accel * throttle * dt;
  } else if (throttle < 0) {
    if (along > -model.reverse) along -= model.accel * 0.8 * -throttle * dt;
  }
  // Rolling drag and a soft top-speed cap.
  along -= along * 0.35 * dt;
  if (along > model.topSpeed) along = model.topSpeed;
  if (along < -model.reverse) along = -model.reverse;
  const grip = handbrake ? model.grip * 0.22 : model.grip;
  const latDecay = Math.exp(-grip * dt);
  latX *= latDecay;
  latY *= latDecay;

  car.vx = nfx * along + latX;
  car.vy = nfy * along + latY;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Solid buildings: nose and tail probes, pushed out; a deep push is a crash.
  let impact = 0;
  const probeOffset = model.length * 0.36;
  for (const sign of [1, -1]) {
    const probe = { x: car.x + nfx * probeOffset * sign, y: car.y + nfy * probeOffset * sign };
    const depth = resolveCircle(city, probe, model.width * 0.52);
    if (depth > 0) {
      car.x += probe.x - (car.x + nfx * probeOffset * sign);
      car.y += probe.y - (car.y + nfy * probeOffset * sign);
      if (depth > impact) impact = depth;
    }
  }
  if (impact > 1.2) {
    // Kill the velocity component that drove into the wall; keep a scrape of the rest.
    const into = car.vx * nfx + car.vy * nfy;
    if ((impact > 3 && into > 0) || into > 60) {
      car.vx -= nfx * into * 1.4;
      car.vy -= nfy * into * 1.4;
    } else {
      car.vx *= 0.6;
      car.vy *= 0.6;
    }
    car.health -= impact * 2.2;
    if (car.health <= 0) car.wrecked = true;
  }
  clampToWorld(car, model.length * 0.6);
  return impact;
}

/** Angle a car should steer toward to face a point, as a -1..1 steering input. */
export function steerToward(car, targetX, targetY) {
  const wanted = Math.atan2(targetY - car.y, targetX - car.x);
  let diff = wanted - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { steer: Math.max(-1, Math.min(1, diff * 2.2)), diff };
}
