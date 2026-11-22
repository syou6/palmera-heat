// Everything drawn over the world: the HUD (money, health, wanted stars, the live objective,
// toasts), the minimap of Palmera with its blips, and the full-screen panels — title, pause,
// busted, wasted. Screen space only; the world itself is render.js's job.
import { FONT, PALETTE, WORLD } from './config.js';
import { STORY_MISSIONS } from './missions.js';
import { forwardSpeed } from './vehicles.js';

function panel(ctx, x, y, w, h, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function text(ctx, value, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function wrap(ctx, value, maxWidth, size) {
  ctx.font = `500 ${size}px ${FONT}`;
  const words = value.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawMinimap(ctx, state, W, H) {
  const size = 196;
  const x = W - size - 16;
  const y = H - size - 16;
  const s = size / WORLD.size;
  panel(ctx, x - 6, y - 6, size + 12, size + 12, 0.9);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#3a332c';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x + 3110 * s, y, 190 * s, size);
  ctx.fillStyle = PALETTE.park;
  for (const park of state.city.parks) {
    if (park.kind === 'park') ctx.fillRect(x + park.x * s, y + park.y * s, park.w * s, park.h * s);
  }
  ctx.strokeStyle = '#6e6257';
  ctx.lineWidth = Math.max(2, WORLD.road * s);
  for (const c of state.city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x + c * s, y);
    ctx.lineTo(x + c * s, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + c * s);
    ctx.lineTo(x + size, y + c * s);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(240, 230, 210, 0.5)';
  for (const b of state.city.buildings) ctx.fillRect(x + b.x * s, y + b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
  // Blips: police in flashing blue-red, the objective in gold, the player a white arrow.
  const flash = Math.floor(state.time * 3) % 2 === 0;
  ctx.fillStyle = flash ? '#2e7bff' : '#ff2e4d';
  for (const car of state.copCars) {
    ctx.beginPath();
    ctx.arc(x + car.x * s, y + car.y * s, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const officer of state.officers) {
    ctx.beginPath();
    ctx.arc(x + officer.x * s, y + officer.y * s, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const objective = state.objectiveCache;
  if (objective && objective.x !== null && objective.x !== undefined) {
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + objective.x * s, y + objective.y * s, 5 + Math.sin(state.time * 5) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  const p = state.player;
  ctx.save();
  ctx.translate(x + p.x * s, y + p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'PALMERA', x + 4, y + 14, 10, PALETTE.hudMuted, 'left', 700);
  text(ctx, 'N', x + size - 5, y + 14, 10, PALETTE.hudMuted, 'right', 700);
}

/** The in-play HUD. `objective` is missions.currentObjective(state), cached by the caller. */
export function drawHUD(ctx, state, W, H) {
  // Money and health, top-left.
  panel(ctx, 14, 14, 208, 74);
  text(ctx, `$${state.money.toLocaleString('en-US')}`, 28, 52, 30, PALETTE.hudText, 'left', 800);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(28, 62, 150, 10);
  ctx.fillStyle = state.health > 35 ? PALETTE.ok : PALETTE.danger;
  ctx.fillRect(28, 62, 150 * Math.max(0, state.health) / 100, 10);
  text(ctx, 'DARIO SOLANO', 28, 30, 10, PALETTE.hudMuted, 'left', 700);

  // Wanted stars and the bust meter, top-right.
  const wanted = state.wanted;
  if (wanted.stars > 0 || wanted.bust > 0) {
    panel(ctx, W - 216, 14, 202, wanted.bust > 0.02 ? 84 : 62);
    for (let i = 0; i < 5; i += 1) {
      const on = i < wanted.stars;
      const pulse = on && wanted.seenFor > 0 && Math.floor(state.time * 4) % 2 === 0;
      text(ctx, '★', W - 196 + i * 38, 52, 30, on ? (pulse ? PALETTE.danger : PALETTE.gold) : 'rgba(255,255,255,0.22)', 'left', 800);
    }
    text(ctx, wanted.seenFor > 0 ? 'IN SIGHT' : 'HIDDEN', W - 28, 30, 10, wanted.seenFor > 0 ? PALETTE.danger : PALETTE.ok, 'right', 700);
    if (wanted.bust > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(W - 196, 66, 168, 9);
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(W - 196, 66, 168 * wanted.bust, 9);
      text(ctx, 'BUSTED', W - 28, 90, 10, PALETTE.danger, 'right', 800);
    }
  }

  // The live objective, top-centre.
  const objective = state.objectiveCache;
  if (objective) {
    const mission = STORY_MISSIONS[state.missions.index];
    const tag = objective.story && mission ? `STORY — ${mission.title.toUpperCase()}` : 'PALMERA';
    let body = objective.text;
    if (objective.x !== null && objective.x !== undefined) {
      const dist = Math.round(Math.hypot(state.player.x - objective.x, state.player.y - objective.y) / 10);
      body = `${body}  ·  ${dist}m`;
    }
    const w = Math.min(600, W - 480);
    if (w > 240) {
      panel(ctx, (W - w) / 2, 14, w, 58);
      text(ctx, tag, W / 2, 36, 10, PALETTE.gold, 'center', 800);
      text(ctx, body, W / 2, 60, 16, PALETTE.hudText, 'center', 600);
    }
  }

  // Toasts under the objective: Marisol's texts and the city's news.
  let toastY = 84;
  for (const toast of state.toasts) {
    const fade = Math.min(1, (toast.ttl - toast.t) / 0.8, toast.t / 0.25 + 0.2);
    const lines = wrap(ctx, toast.body, 470, 14);
    const h = 34 + lines.length * 18;
    const w = 510;
    panel(ctx, (W - w) / 2, toastY, w, h, 0.92 * Math.max(0, fade));
    ctx.globalAlpha = Math.max(0, fade);
    text(ctx, toast.title, W / 2, toastY + 22, 13, PALETTE.gold, 'center', 800);
    lines.forEach((line, i) => text(ctx, line, W / 2, toastY + 42 + i * 18, 14, PALETTE.hudText, 'center', 500));
    ctx.globalAlpha = 1;
    toastY += h + 8;
  }

  // Bottom-left: what you are driving, and the keys that matter right now.
  const player = state.player;
  if (player.mode === 'car') {
    const kmh = Math.round(Math.abs(forwardSpeed(player.car)) * 0.42);
    panel(ctx, 14, H - 86, 250, 72);
    text(ctx, player.car.model === 'police' ? 'Patrulla Interceptor' : carName(player.car), 28, H - 58, 16, PALETTE.hudText, 'left', 700);
    text(ctx, `${kmh} km/h`, 28, H - 30, 22, PALETTE.gold, 'left', 800);
    const dmg = Math.max(0, 1 - player.car.health / 150);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(150, H - 40, 100, 8);
    ctx.fillStyle = dmg > 0.6 ? PALETTE.danger : PALETTE.ok;
    ctx.fillRect(150, H - 40, 100 * (1 - dmg), 8);
    text(ctx, 'E exit · SPACE handbrake', 14, H - 100, 12, PALETTE.hudMuted, 'left', 500);
  } else {
    text(ctx, 'WASD move · SHIFT run · E enter car · F punch', 14, H - 18, 12, PALETTE.hudMuted, 'left', 500);
  }

  // Repainting progress, centre-bottom.
  if (state.flags.repainting > 0) {
    const w = 300;
    panel(ctx, (W - w) / 2, H - 120, w, 46);
    text(ctx, "REPAINTING AT TITO'S…", W / 2, H - 96, 13, PALETTE.hudText, 'center', 700);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect((W - w) / 2 + 20, H - 88, w - 40, 7);
    ctx.fillStyle = '#2a9d8f';
    ctx.fillRect((W - w) / 2 + 20, H - 88, (w - 40) * state.flags.repainting, 7);
  }

  // Low health: the screen's edge closes in.
  if (state.health < 32 && !state.over) {
    const pulse = 0.25 + 0.15 * Math.sin(state.time * 6);
    ctx.strokeStyle = `rgba(239, 71, 111, ${pulse})`;
    ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, W, H);
  }

  drawMinimap(ctx, state, W, H);
}

const CAR_NAMES = { sedan: 'Brisas Sedan', sport: 'Ciclon GT', pickup: 'Mula Pickup', taxi: 'Taxi Sol', police: 'Patrulla Interceptor' };
function carName(car) {
  return CAR_NAMES[car.model] ?? 'Car';
}

/** A centred splash (job complete, story beat): big title, one line under it, fades with age. */
export function drawSplash(ctx, W, H, splash) {
  const age = splash.age;
  const alpha = age < 0.2 ? age / 0.2 : age > 2.4 ? Math.max(0, 1 - (age - 2.4) / 0.6) : 1;
  ctx.globalAlpha = alpha;
  text(ctx, splash.title, W / 2, H * 0.34, 54, PALETTE.gold, 'center', 900);
  if (splash.sub) text(ctx, splash.sub, W / 2, H * 0.34 + 44, 22, PALETTE.hudText, 'center', 600);
  ctx.globalAlpha = 1;
}

/** The full-screen panels. `menu` is [{label, selected}] for the title; `lines` for the endings. */
export function drawScreen(ctx, state, W, H, screen, menu, lines) {
  ctx.fillStyle = screen === 'over-busted' ? 'rgba(60, 8, 18, 0.62)' : 'rgba(14, 10, 8, 0.62)';
  ctx.fillRect(0, 0, W, H);
  if (screen === SCREEN_KIND.title) {
    text(ctx, 'PALMERA', W / 2, H * 0.3, 96, PALETTE.gold, 'center', 900);
    text(ctx, 'H E A T', W / 2, H * 0.3 + 74, 44, PALETTE.hudText, 'center', 900);
    text(ctx, 'An open-world crime story in the city of Palmera', W / 2, H * 0.3 + 116, 19, PALETTE.hudMuted, 'center', 500);
    text(ctx, 'Dario Solano came home with a bus ticket and a name the patrols still remember.', W / 2, H * 0.3 + 146, 16, PALETTE.hudMuted, 'center', 500);
    text(ctx, 'Marisol Vega has work. The Palmera Trust has money. The city has both — take them.', W / 2, H * 0.3 + 170, 16, PALETTE.hudMuted, 'center', 500);
    let y = H * 0.3 + 226;
    for (const item of menu) {
      text(ctx, item.selected ? `▶ ${item.label}` : item.label, W / 2, y, 24, item.selected ? PALETTE.gold : PALETTE.hudText, 'center', 800);
      y += 38;
    }
    text(ctx, 'WASD / arrows — move & drive · E — enter/exit car · F — punch · SPACE — handbrake · SHIFT — run · P — pause · M — sound', W / 2, H - 54, 14, PALETTE.hudMuted, 'center', 500);
    text(ctx, 'Steal cars, run Marisol\u2019s jobs, and stay ahead of the Patrulla. Tito\u2019s repaint shop wipes the heat — for $150.', W / 2, H - 30, 14, PALETTE.hudMuted, 'center', 500);
    return;
  }
  if (screen === SCREEN_KIND.paused) {
    text(ctx, 'PAUSED', W / 2, H * 0.42, 56, PALETTE.hudText, 'center', 900);
    text(ctx, 'Press P or Enter to keep driving', W / 2, H * 0.42 + 48, 18, PALETTE.hudMuted, 'center', 500);
    return;
  }
  const busted = screen === SCREEN_KIND.busted;
  text(ctx, busted ? 'BUSTED' : 'WASTED', W / 2, H * 0.4, 76, busted ? PALETTE.danger : '#e8e3d9', 'center', 900);
  let y = H * 0.4 + 52;
  for (const line of lines) {
    text(ctx, line, W / 2, y, 18, PALETTE.hudText, 'center', 500);
    y += 28;
  }
  text(ctx, 'Press Enter to carry on', W / 2, y + 14, 17, PALETTE.gold, 'center', 700);
}

export const SCREEN_KIND = { title: 'title', paused: 'paused', busted: 'over-busted', wasted: 'over-wasted' };
