// Palmera Heat: boot, the screen state machine, the fixed-step loop, sound, and saving.
// Screens: title (over a living, attract-mode city), play, paused, and the two endings a bad
// day can have — busted and wasted — each with its price, paid once, before you walk out of the
// safehouse and start again.
//
// ?seed=N fixes the city. ?shot=cover|foot|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createGame, enterExitCar, playerPunch, stepGame } from './world.js';
import { currentObjective } from './missions.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH } from './input.js';
import { createRenderer } from './render.js';
import { drawHUD, drawScreen, drawSplash, SCREEN_KIND } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Number.isFinite(parsed.money) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      missionIndex: state.missions.index,
    }));
  } catch { /* storage can be off; the run simply is not kept */ }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* nothing to clear */ }
}

function announce(message) {
  status.textContent = message;
}

/** The price of an ending, paid once: a fine and a cell, or a hospital bill and a headache. */
function applyAftermath(state, kind) {
  const player = state.player;
  if (player.car) {
    player.car.driver = null;
    player.car = null;
  }
  player.mode = 'foot';
  const home = state.city.landmarks.hideout;
  player.x = home.x;
  player.y = home.y + 26;
  player.vx = 0;
  player.vy = 0;
  state.copCars.length = 0;
  state.officers.length = 0;
  state.allCars = state.allCars.filter((car) => car.driver !== 'police');
  state.wanted.heat = 0;
  state.wanted.stars = 0;
  state.wanted.bust = 0;
  if (kind === 'busted') {
    const fine = Math.min(state.money, 200);
    state.money -= fine;
    state.health = 70;
    return [`The Patrulla held you at the kerb and the court took $${fine} in fines.`, 'Your wheels and your record are gone. The safehouse couch is free.'];
  }
  const bill = Math.min(state.money, Math.max(50, Math.round(state.money * 0.1)));
  state.money -= bill;
  state.health = 100;
  return [`You wake up outside the safehouse with a $${bill} hospital bill and no memory of the ambulance.`, 'Marisol left a note: "Try not to die on company time."'];
}

function runShot(name) {
  const state = createGame(seed, null);
  const scene = stageShot(name, { state, step: stepGame });
  let painted = 0;
  function paint() {
    const focus = scene.focus;
    renderer.drawWorld(state, focus);
    const { ctx } = renderer;
    const hudScale = canvas.height / 720;
    ctx.setTransform(hudScale, 0, 0, hudScale, 0, 0);
    if (scene.screen === 'title') {
      drawScreen(ctx, state, renderer.viewW, renderer.viewH, SCREEN_KIND.title, [{ label: 'New Game', selected: true }], []);
    } else {
      drawHUD(ctx, state, renderer.viewW, renderer.viewH);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  let saved = readSave();
  let state = createGame(seed, saved);
  let screen = 'title';
  let menuIndex = 0;
  let splash = null;
  let aftermathLines = [];
  let accumulator = 0;
  let last = performance.now();
  let prevUp = false;
  let prevDown = false;

  state.attract = true;
  window.__palmera = { get state() { return state; } };

  function menuItems() {
    const items = [];
    if (saved) items.push({ id: 'continue', label: `Continue — $${saved.money.toLocaleString('en-US')}, job ${Math.min(saved.missionIndex + 1, 5)} of 5` });
    items.push({ id: 'new', label: 'New Game' });
    return items;
  }

  function startPlay(fresh) {
    if (fresh) {
      clearSave();
      saved = null;
      state = createGame(seed, null);
      window.__palmera = { get state() { return state; } };
    }
    state.attract = false;
    screen = 'play';
    audio.unlock();
    announce('Playing Palmera Heat.');
  }

  function handleFx() {
    let crashPlayed = false;
    for (const event of state.fx) {
      if (event.type === 'crash' && !crashPlayed) {
        audio.crash(event.strength ?? 0.5);
        crashPlayed = true;
      } else if (event.type === 'punch' || event.type === 'thud') audio.punch();
      else if (event.type === 'pickup') audio.pickup();
      else if (event.type === 'cash') audio.cash();
      else if (event.type === 'alarm') audio.alarm();
      else if (event.type === 'carjack') audio.blip();
      else if (event.type === 'fail') audio.fail();
      else if (event.type === 'missionDone') {
        audio.cash();
        splash = { title: 'JOB COMPLETE', sub: event.reward > 0 ? `+$${event.reward}` : '', age: 0 };
        writeSave(state);
      }
    }
    state.fx.length = 0;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === 'title') {
      const items = menuItems();
      if (input.held.up && !prevUp) menuIndex = (menuIndex + items.length - 1) % items.length;
      if (input.held.down && !prevDown) menuIndex = (menuIndex + 1) % items.length;
      if (actions & ACTION_CONFIRM) {
        startPlay(items[menuIndex].id === 'new');
      }
    } else if (screen === 'play') {
      if (actions & ACTION_PAUSE) {
        screen = 'paused';
        announce('Paused.');
      } else {
        if (actions & ACTION_ENTER) enterExitCar(state);
        if (actions & ACTION_PUNCH) playerPunch(state);
      }
    } else if (screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = 'play';
        announce('Playing.');
      }
    } else if (screen === 'busted' || screen === 'wasted') {
      if (actions & ACTION_CONFIRM) {
        screen = 'play';
        announce('Back on the street.');
      }
    }
    prevUp = input.held.up;
    prevDown = input.held.down;
  }

  function checkEndings() {
    if (!state.over || screen !== 'play') return;
    const kind = state.over;
    state.over = null;
    aftermathLines = applyAftermath(state, kind);
    screen = kind;
    audio.fail();
    audio.siren(false);
    audio.engine(0, false);
    announce(kind === 'busted' ? 'Busted.' : 'Wasted.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'play' || screen === 'title') {
      while (accumulator >= STEP) {
        stepGame(state, input, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    handleFx();
    checkEndings();
    state.objectiveCache = screen === 'title' ? null : currentObjective(state);
    if (splash) {
      splash.age += 1 / 60;
      if (splash.age > 3.1) splash = null;
    }

    // Camera: on the player in play, drifting around Parque Central behind the title.
    let focus;
    if (screen === 'title') {
      const t = now / 1000;
      focus = { x: 1980 + Math.cos(t * 0.07) * 260, y: 1330 + Math.sin(t * 0.07) * 200 };
    } else {
      focus = { x: state.player.x + state.player.vx * 0.32, y: state.player.y + state.player.vy * 0.32 };
    }
    renderer.drawWorld(state, focus);
    const { ctx } = renderer;
    const hudScale = canvas.height / 720;
    ctx.setTransform(hudScale, 0, 0, hudScale, 0, 0);
    const W = renderer.viewW;
    const H = renderer.viewH;
    if (screen === 'title') {
      const items = menuItems().map((item, i) => ({ label: item.label, selected: i === menuIndex }));
      drawScreen(ctx, state, W, H, SCREEN_KIND.title, items, []);
    } else if (screen === 'paused') {
      drawHUD(ctx, state, W, H);
      drawScreen(ctx, state, W, H, SCREEN_KIND.paused, [], []);
    } else if (screen === 'busted' || screen === 'wasted') {
      drawHUD(ctx, state, W, H);
      drawScreen(ctx, state, W, H, screen === 'busted' ? SCREEN_KIND.busted : SCREEN_KIND.wasted, [], aftermathLines);
    } else {
      drawHUD(ctx, state, W, H);
      if (splash) drawSplash(ctx, W, H, splash);
    }

    // Sound follows the world: engine while driving, sirens while wanted.
    if (screen === 'play' && state.player.mode === 'car') {
      audio.engine(Math.min(1, Math.hypot(state.player.vx, state.player.vy) / 430), true);
    } else {
      audio.engine(0, false);
    }
    audio.siren(screen === 'play' && state.wanted.stars > 0);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Palmera Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
