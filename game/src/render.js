// Drawing the world of Palmera: warm streets, pastel roofs, palms, traffic, walkers, patrol cars
// with flashing lightbars, skid marks and sparks — all of it flat canvas shapes, culled to the
// camera's view. The camera follows a focus point (the player, or a staged scene's) and shows
// 720 world pixels of height whatever the window's shape.
import { CAR_MODELS, FONT, PALETTE, WORLD } from './config.js';
import { ROAD_CENTRES } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_HEIGHT = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;
  let scale = 1;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    scale = canvas.height / VIEW_HEIGHT;
    viewW = canvas.width / scale;
    viewH = VIEW_HEIGHT;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCar(car, state) {
    const model = CAR_MODELS[car.model];
    const { length, width } = model;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow, then body.
    ctx.fillStyle = 'rgba(40, 24, 16, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-length / 2 + 3, -width / 2 + 4, length, width, 7);
    ctx.fill();
    ctx.fillStyle = car.wrecked ? '#5d5650' : car.color;
    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, length, width, 7);
    ctx.fill();
    // Glasshouse: windscreen and rear window.
    ctx.fillStyle = 'rgba(23, 42, 58, 0.9)';
    ctx.fillRect(length * 0.08, -width * 0.36, length * 0.2, width * 0.72);
    ctx.fillRect(-length * 0.3, -width * 0.34, length * 0.14, width * 0.68);
    // Roof.
    ctx.fillStyle = car.wrecked ? '#4c463f' : shade(car.color, 18);
    ctx.fillRect(-length * 0.14, -width * 0.38, length * 0.2, width * 0.76);
    // Wheels.
    ctx.fillStyle = '#17130f';
    const wy = width / 2 - 2;
    for (const [wx, sy] of [[length * 0.32, -1], [length * 0.32, 1], [-length * 0.32, -1], [-length * 0.32, 1]]) {
      ctx.fillRect(wx - 6, sy * wy - 2, 12, 5);
    }
    if (car.model === 'taxi') {
      ctx.fillStyle = '#17130f';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-5, -3, 10, 6);
    }
    if (car.model === 'police') {
      ctx.fillStyle = '#17130f';
      ctx.fillRect(-length * 0.05, -width / 2, length * 0.16, width);
      // Lightbar: the two lamps trade places twice a second.
      const phase = Math.floor(state.time * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e4d' : '#7a1020';
      ctx.fillRect(-4, -width * 0.32, 8, width * 0.28);
      ctx.fillStyle = phase ? '#123a7a' : '#2e7bff';
      ctx.fillRect(-4, width * 0.04, 8, width * 0.28);
    }
    ctx.restore();
    // The marked car (Marisol's Ciclon) wears a gold ring so the eye finds it.
    if (car === state.markedCar && state.player.mode === 'foot') {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(state.time * 5);
      ctx.beginPath();
      ctx.arc(car.x, car.y, length * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (car.wrecked && Math.random() < 0.3) {
      state.particles.push({
        x: car.x + (Math.random() - 0.5) * 16, y: car.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 8, vy: -22 - Math.random() * 16,
        life: 0.9, maxLife: 0.9, color: 'rgba(90,84,78,0.5)', size: 5 + Math.random() * 5,
      });
    }
  }

  function drawPerson(x, y, angle, bodyColor, down, isPlayer, time, phase) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40, 24, 16, 0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (down) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c68642';
      ctx.beginPath();
      ctx.arc(13, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(time * 10 + phase) * 1.2;
    ctx.rotate(angle);
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isPlayer ? '#5b3a1e' : '#3b2f2f';
    ctx.fillRect(-2, -8 + bob, 10, 4.5);
    ctx.fillRect(-2, 3.5 - bob, 10, 4.5);
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.arc(2.5, 0, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (isPlayer) {
      // A small gold chevron floats over Dario so he is never lost in a crowd.
      ctx.fillStyle = PALETTE.gold;
      const bounce = Math.sin(time * 4) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 24 + bounce);
      ctx.lineTo(x - 6, y - 32 + bounce);
      ctx.lineTo(x + 6, y - 32 + bounce);
      ctx.closePath();
      ctx.fill();
    }
  }

  function shade(hex, amt) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  /** Paint the world. `focus` is the camera centre in world pixels. */
  function drawWorld(state, focus) {
    const city = state.city;
    const camX = Math.max(viewW / 2, Math.min(WORLD.size - viewW / 2, focus.x));
    const camY = Math.max(viewH / 2, Math.min(WORLD.size - viewH / 2, focus.y));
    const left = camX - viewW / 2;
    const top = camY - viewH / 2;
    const right = left + viewW;
    const bottom = top + viewH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#171310';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);

    // Ground: sidewalks everywhere, then the beach and the sea on the east edge.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(left, top, viewW, viewH);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(3110, top, 190, viewH);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(3252, top, 48, viewH);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(3246, top, 4, viewH);

    // Parks and the docks yard.
    for (const park of city.parks) {
      if (park.x > right || park.x + park.w > left || park.y > bottom || park.y + park.h > top) continue;
      ctx.fillStyle = park.kind === 'park' ? PALETTE.park : '#6f6357';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      if (park.kind === 'park') {
        ctx.strokeStyle = 'rgba(238, 217, 164, 0.7)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(park.x, park.y + park.h / 2);
        ctx.lineTo(park.x + park.w, park.y + park.h / 2);
        ctx.moveTo(park.x + park.w / 2, park.y);
        ctx.lineTo(park.x + park.w / 2, park.y + park.h);
        ctx.stroke();
      }
    }

    // Roads: asphalt, kerb lines, dashed centre lines.
    ctx.fillStyle = PALETTE.road;
    for (const c of ROAD_CENTRES) {
      if (c + WORLD.road / 2 > left && c - WORLD.road / 2 < right) ctx.fillRect(c - WORLD.road / 2, top, WORLD.road, viewH);
      if (c + WORLD.road / 2 > top && c - WORLD.road / 2 < bottom) ctx.fillRect(left, c - WORLD.road / 2, viewW, WORLD.road);
    }
    ctx.fillStyle = PALETTE.lane;
    for (const c of ROAD_CENTRES) {
      for (let d = Math.floor(top / 52) * 52; d < bottom; d += 52) {
        if (c > left && c < right) ctx.fillRect(c - 2, d, 4, 26);
      }
      for (let d = Math.floor(left / 52) * 52; d < right; d += 52) {
        if (c > top && c < bottom) ctx.fillRect(d, c - 2, 26, 4);
      }
    }

    // Tito's repaint bay: a calm teal ring, always open.
    const repaint = city.landmarks.repaint;
    ctx.strokeStyle = '#2a9d8f';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(repaint.x, repaint.y, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Buildings: shadow, pastel roof, trim, a name where the city gave one.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of city.buildings) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      ctx.fillStyle = PALETTE.buildingShadow;
      ctx.fillRect(b.x + 9, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.roofTrim;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
      if (!b.crate) {
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        const rx = b.x + ((b.x * 7 + b.y * 13) % Math.max(40, b.w - 90));
        const ry = b.y + ((b.x * 11 + b.y * 5) % Math.max(40, b.h - 80));
        ctx.fillRect(rx, ry, 34, 24);
      }
      if (b.name) {
        ctx.font = `600 17px ${FONT}`;
        ctx.fillStyle = 'rgba(38, 26, 18, 0.75)';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2, b.w - 26);
      }
    }

    // Palms: a short trunk and a star of leaves.
    for (const palm of city.palms) {
      if (palm.x < left - 30 || palm.x > right + 30 || palm.y < top - 30 || palm.y > bottom + 30) continue;
      ctx.strokeStyle = PALETTE.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x - 5, palm.y + 6);
      ctx.lineTo(palm.x, palm.y);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palmLeaf;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + palm.x;
        ctx.beginPath();
        ctx.ellipse(palm.x + Math.cos(a) * 9, palm.y + Math.sin(a) * 9, 11, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Skid marks, fading where they were laid.
    ctx.fillStyle = '#241d18';
    for (const skid of state.skids) {
      ctx.globalAlpha = Math.min(0.5, skid.life * 0.12);
      ctx.beginPath();
      ctx.arc(skid.x, skid.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cars, walkers, officers, then the player.
    for (const car of state.allCars) {
      if (car.x < left - 80 || car.x > right + 80 || car.y < top - 80 || car.y > bottom + 80) continue;
      drawCar(car, state);
    }
    for (const ped of state.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.down > 0, false, state.time, ped.phase);
    }
    for (const officer of state.officers) {
      drawPerson(officer.x, officer.y, officer.angle, PALETTE.officerBody, officer.down > 0, false, state.time, officer.phase);
    }
    const player = state.player;
    if (player.mode === 'foot') {
      const hurtFlash = state.time - player.hurtAt < 0.25;
      drawPerson(player.x, player.y, player.angle, hurtFlash ? PALETTE.danger : PALETTE.playerBody, false, true, state.time, 0);
    } else {
      // A gold chevron over the player's car, too.
      ctx.fillStyle = PALETTE.gold;
      const bounce = Math.sin(state.time * 4) * 2;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 34 + bounce);
      ctx.lineTo(player.x - 7, player.y - 43 + bounce);
      ctx.lineTo(player.x + 7, player.y - 43 + bounce);
      ctx.closePath();
      ctx.fill();
    }

    // The objective marker: a pillar of gold light on the world.
    const objective = state.objectiveCache;
    if (objective && objective.x !== null && objective.x !== undefined) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      const grad = ctx.createLinearGradient(0, objective.y - 190, 0, objective.y);
      grad.addColorStop(0, 'rgba(255, 183, 3, 0)');
      grad.addColorStop(1, `rgba(255, 183, 3, ${0.35 + pulse * 0.2})`);
      ctx.fillStyle = grad;
      ctx.fillRect(objective.x - 13, objective.y - 190, 26, 190);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(objective.x, objective.y, 34 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particles last: sparks and smoke over everything.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { left, top, viewW, viewH, scale };
  }

  return { canvas, ctx, drawWorld, get viewW() { return viewW; }, get viewH() { return viewH; } };
}
