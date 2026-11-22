// The screenshot scenes behind ?shot=cover|foot|chase|mission. Each one builds a real game state
// — the actual city, traffic, police and mission systems — plays it forward with scripted input
// for a few seconds, and leaves the frame exactly where a player's frame would be. Nothing is
// drawn here that the game does not draw in play; the same seed always gives the same scene.
import { STEP, WANTED } from './config.js';
import { addHeat } from './police.js';
import { currentObjective } from './missions.js';

/** A keyboard that holds the given keys down forever: enough to drive a staged scene. */
export function scriptedInput(held) {
  return {
    held: { up: false, down: false, left: false, right: false, sprint: false, handbrake: false, ...held },
    moveVector() {
      return {
        x: (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0),
        y: (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0),
      };
    },
    takeActions() { return 0; },
  };
}

function run(state, game, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.step(state, input, STEP);
  state.objectiveCache = currentObjective(state);
}

function putPlayerInCar(state, car, x, y, angle, vx) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.vx = vx;
  car.vy = 0;
  car.driver = 'player';
  state.player.mode = 'car';
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  if (state.traffic.includes(car)) state.traffic.splice(state.traffic.indexOf(car), 1);
}

/**
 * Stage the named scene on a fresh game and return where the camera looks and which screen the
 * frame wears. `game` is { state, step } from main.js.
 */
export function stageShot(name, game) {
  const state = game.state;
  const idle = scriptedInput({});
  if (name === 'foot') {
    // On foot outside Cafe Brisa, walking the kerb toward Marisol, traffic rolling past.
    state.player.x = 2380;
    state.player.y = 1010;
    run(state, game, scriptedInput({ right: true, sprint: true }), 1.6);
    return { screen: 'play', focus: { x: state.player.x, y: state.player.y } };
  }
  if (name === 'chase') {
    // Three stars on the avenue: the package is in the car and every patrol knows it.
    const car = state.markedCar;
    putPlayerInCar(state, car, 1180, 1685, 0, 300);
    state.missions.index = 2;
    state.missions.stage = 1;
    state.missions.started = true;
    state.missions.timerLeft = 96;
    addHeat(state, WANTED.thresholds[2] + 30);
    run(state, game, scriptedInput({ up: true }), 3.4);
    // Bring the two nearest patrols into frame behind the player for the shot.
    const p = state.player;
    state.copCars.slice(0, 2).forEach((cop, i) => {
      cop.x = p.x - 150 - i * 95;
      cop.y = p.y + (i === 0 ? -26 : 30);
      cop.angle = p.angle;
      cop.vx = p.vx * 0.96;
      cop.vy = 0;
    });
    run(state, game, scriptedInput({ up: true }), 0.5);
    return { screen: 'play', focus: { x: p.x + 60, y: p.y } };
  }
  if (name === 'mission') {
    // The Palmera Trust job, seconds after the vault: four stars, the docks marker burning gold.
    const car = state.allCars.find((c) => c.model === 'pickup' && c.driver === null) ?? state.markedCar;
    putPlayerInCar(state, car, 1355, 1690, Math.PI / 2, 0);
    car.vy = 210;
    state.missions.index = 4;
    state.missions.stage = 2;
    state.missions.started = true;
    state.missions.loot = 1200;
    state.money = 1610;
    addHeat(state, WANTED.thresholds[3] + 60);
    run(state, game, scriptedInput({ up: true }), 2.8);
    const p = state.player;
    state.copCars.slice(0, 2).forEach((cop, i) => {
      cop.x = p.x + (i === 0 ? -120 : 60);
      cop.y = p.y - 150 - i * 70;
      cop.angle = Math.PI / 2;
      cop.vx = 0;
      cop.vy = p.vy * 0.95;
    });
    run(state, game, scriptedInput({ up: true }), 0.4);
    return { screen: 'play', focus: { x: p.x, y: p.y + 40 } };
  }
  // Cover: the title over a living city — traffic crossing Parque Central at golden hour.
  state.attract = true;
  run(state, game, idle, 5);
  state.objectiveCache = null;
  return { screen: 'title', focus: { x: 1980, y: 1330 } };
}
