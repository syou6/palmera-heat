// The story of Palmera Heat, and the work it gives you. Marisol Vega, a fixer who works out of
// Cafe Brisa, takes Dario Solano from nobody to the man who emptied the Palmera Trust — five jobs,
// each a chain of stages with one live objective and one gold marker. When the story is done the
// city keeps offering odd jobs: a pickup here, a drop-off there, paid by the distance.
import { WANTED } from './config.js';
import { addHeat } from './police.js';

const LANDMARK_JOBS = ['diner', 'bank', 'repaint', 'garage', 'hideout', 'docks'];

/**
 * One stage of one job. `kind` says what finishing means:
 * goto — be at the marker; steal — be driving the marked car; deliver — bring the marked car to
 * the marker; hold — stay at the marker while the bar fills; loseheat — have no stars, then the
 * next stage's marker matters; timer counts down and failing restarts the job's timed leg.
 */
export const STORY_MISSIONS = [
  {
    id: 'welcome', title: 'Welcome to Palmera', reward: 50,
    brief: 'Marisol: "Dario. You are back in Palmera with nothing but a bus ticket. Come to Cafe Brisa, north-east corner. We will fix that."',
    stages: [
      { kind: 'goto', at: 'diner', text: 'Meet Marisol at Cafe Brisa' },
    ],
  },
  {
    id: 'firstWheels', title: 'First Wheels', reward: 250,
    brief: 'Marisol: "A Ciclon GT sits by my diner, and its owner owes me. Take it. Bring it to Vega Motors, east side. Try not to be seen."',
    stages: [
      { kind: 'steal', text: 'Steal the Ciclon GT by the diner (walk up, press E)' },
      { kind: 'deliver', at: 'garage', text: 'Deliver the Ciclon GT to Vega Motors' },
    ],
  },
  {
    id: 'package', title: 'The Package Run', reward: 400,
    brief: 'Marisol: "A package waits at Muelle Sur docks. The moment you touch it, every patrol in Palmera will know. Drop it at Vega Motors, fast."',
    stages: [
      { kind: 'goto', at: 'docks', text: 'Pick up the package at Muelle Sur docks', onDone: 'pickup' },
      { kind: 'goto', at: 'garage', text: 'Deliver the package to Vega Motors — hurry!', timer: 150, onDone: 'deliver' },
    ],
  },
  {
    id: 'cooling', title: 'Cooling Off', reward: 450,
    brief: 'Marisol: "Half the city saw your face on that run. The patrols are coming — lose them, then lie low at your safehouse."',
    stages: [
      { kind: 'loseheat', text: 'Lose the police (break sight, swap cars, or repaint)', onStart: 'ambush' },
      { kind: 'goto', at: 'hideout', text: 'Lie low at the Solano safehouse' },
    ],
  },
  {
    id: 'bank', title: 'The Palmera Trust Job', reward: 0,
    brief: 'Marisol: "One last job, Dario. The Palmera Trust vault, centre of the city. Hold your nerve inside, take the money, and run for the docks. Do not get caught with it."',
    stages: [
      { kind: 'goto', at: 'bank', text: 'Go to the Palmera Trust Bank' },
      { kind: 'hold', at: 'bank', text: 'Empty the vault — stay in the circle!', holdSeconds: 5, onDone: 'robbery' },
      { kind: 'goto', at: 'docks', text: 'Escape! Reach the Muelle Sur docks with the money' },
    ],
  },
];

export function createMissions(saved) {
  const index = saved && Number.isInteger(saved.missionIndex) ? saved.missionIndex : 0;
  return {
    index,
    stage: 0,
    timerLeft: 0,
    hold: 0,
    started: false,
    storyDone: index >= STORY_MISSIONS.length,
    job: null,
    jobCooldown: 4,
    loot: 0,
  };
}

function stageDef(state) {
  const ms = state.missions;
  if (ms.storyDone) return null;
  const mission = STORY_MISSIONS[ms.index];
  return mission ? mission.stages[ms.stage] : null;
}

function markerFor(state, stage) {
  if (stage.kind === 'steal') {
    return state.markedCar ? { x: state.markedCar.x, y: state.markedCar.y } : null;
  }
  if (!stage.at) return null;
  const lm = state.city.landmarks[stage.at];
  return lm ? { x: lm.x, y: lm.y } : null;
}

/** The live objective for the HUD: its text and where its gold marker stands, if anywhere. */
export function currentObjective(state) {
  const ms = state.missions;
  const stage = stageDef(state);
  if (stage) {
    const marker = markerFor(state, stage);
    let text = stage.text;
    if (stage.kind === 'hold') text = `${stage.text} ${Math.ceil(stage.holdSeconds - ms.hold)}s`;
    if (ms.timerLeft > 0 && stage.timer) text = `${stage.text} (${Math.ceil(ms.timerLeft)}s)`;
    return { text, x: marker?.x ?? null, y: marker?.y ?? null, story: true };
  }
  if (ms.job) {
    const lm = state.city.landmarks[ms.job.at];
    return { text: ms.job.text, x: lm.x, y: lm.y, story: false };
  }
  return { text: 'Free roam — Marisol will text you work', x: null, y: null, story: false };
}

function toast(state, title, body) {
  state.toasts.push({ title, body, t: 0, ttl: 6 });
}

function applyOnDone(state, tag) {
  if (tag === 'pickup') {
    addHeat(state, WANTED.heatRobbery - 40);
    toast(state, 'Package picked up', 'Every patrol in Palmera just heard your name. Move!');
    state.fx.push({ type: 'pickup' });
  } else if (tag === 'robbery') {
    addHeat(state, WANTED.heatRobbery);
    state.missions.loot = 1200;
    toast(state, 'Vault emptied — $1,200 in the bag', 'Now run. The docks, and do not get caught.');
    state.fx.push({ type: 'alarm' });
  }
}

function applyOnStart(state, tag) {
  if (tag === 'ambush') {
    state.wanted.heat = Math.max(state.wanted.heat, WANTED.thresholds[2] + 40);
    state.wanted.stars = 3;
    state.wanted.lastCrimeAt = state.time;
  }
}

function startStage(state) {
  const ms = state.missions;
  const stage = stageDef(state);
  ms.hold = 0;
  ms.timerLeft = stage && stage.timer ? stage.timer : 0;
  if (stage && stage.onStart) applyOnStart(state, stage.onStart);
}

function completeStage(state) {
  const ms = state.missions;
  const mission = STORY_MISSIONS[ms.index];
  const stage = mission.stages[ms.stage];
  if (stage.onDone) applyOnDone(state, stage.onDone);
  ms.stage += 1;
  if (ms.stage < mission.stages.length) {
    startStage(state);
    return;
  }
  // Mission complete: pay out, tell the player, move the story on.
  let reward = mission.reward;
  if (mission.id === 'bank') reward = ms.loot;
  ms.loot = 0;
  state.money += reward;
  state.stats.missionsDone += 1;
  state.fx.push({ type: 'missionDone', reward });
  ms.index += 1;
  ms.stage = 0;
  if (ms.index >= STORY_MISSIONS.length) {
    ms.storyDone = true;
    toast(state, 'Story complete — the Palmera Trust Job is done', 'Marisol: "You are somebody now, Dario. The city is yours. Odd jobs will keep coming."');
  } else {
    toast(state, `Job done: ${mission.title} (+$${reward})`, STORY_MISSIONS[ms.index].brief);
  }
  startStage(state);
}

function failTimedStage(state) {
  const ms = state.missions;
  toast(state, 'Too slow — the job is blown', 'Marisol: "Again. And this time, drive like you mean it."');
  state.fx.push({ type: 'fail' });
  ms.stage = Math.max(0, ms.stage - 1);
  startStage(state);
}

function makeJob(state) {
  const from = LANDMARK_JOBS[Math.floor(state.random() * LANDMARK_JOBS.length)];
  let to = from;
  while (to === from) to = LANDMARK_JOBS[Math.floor(state.random() * LANDMARK_JOBS.length)];
  return { at: from, then: to, leg: 0, pay: 0, text: '' };
}

function refreshJobText(state) {
  const job = state.missions.job;
  const lm = state.city.landmarks[job.leg === 0 ? job.at : job.then];
  job.text = job.leg === 0 ? `Odd job: pick up at ${lm.name}` : `Odd job: deliver to ${lm.name} (+$${job.pay})`;
}

/** Advance the story and the odd-job board by one step. */
export function updateMissions(state, dt) {
  const ms = state.missions;
  if (!ms.started) {
    ms.started = true;
    if (!ms.storyDone) toast(state, STORY_MISSIONS[ms.index].title, STORY_MISSIONS[ms.index].brief);
    startStage(state);
  }
  const player = state.player;
  const stage = stageDef(state);
  if (stage) {
    if (ms.timerLeft > 0) {
      ms.timerLeft -= dt;
      if (ms.timerLeft <= 0) {
        failTimedStage(state);
        return;
      }
    }
    const marker = markerFor(state, stage);
    const atMarker = marker ? Math.hypot(player.x - marker.x, player.y - marker.y) < 62 : false;
    switch (stage.kind) {
      case 'goto':
        if (atMarker) completeStage(state);
        break;
      case 'steal':
        if (player.mode === 'car' && player.car === state.markedCar) completeStage(state);
        break;
      case 'deliver':
        if (atMarker && player.mode === 'car' && player.car === state.markedCar) completeStage(state);
        break;
      case 'hold':
        if (atMarker && player.mode === 'foot') {
          ms.hold += dt;
          if (ms.hold >= stage.holdSeconds) completeStage(state);
        } else {
          ms.hold = Math.max(0, ms.hold - dt * 2);
        }
        break;
      case 'loseheat':
        if (state.wanted.stars === 0) completeStage(state);
        break;
      default:
        break;
    }
    return;
  }
  // Story done: the odd-job board.
  if (!ms.job) {
    ms.jobCooldown -= dt;
    if (ms.jobCooldown <= 0) {
      ms.job = makeJob(state);
      const a = state.city.landmarks[ms.job.at];
      const b = state.city.landmarks[ms.job.then];
      ms.job.pay = Math.round(60 + Math.hypot(a.x - b.x, a.y - b.y) * 0.09);
      refreshJobText(state);
      toast(state, 'Odd job posted', ms.job.text);
    }
    return;
  }
  const target = state.city.landmarks[ms.job.leg === 0 ? ms.job.at : ms.job.then];
  if (Math.hypot(player.x - target.x, player.y - target.y) < 62) {
    if (ms.job.leg === 0) {
      ms.job.leg = 1;
      refreshJobText(state);
      state.fx.push({ type: 'pickup' });
    } else {
      state.money += ms.job.pay;
      state.stats.jobsDone += 1;
      state.fx.push({ type: 'missionDone', reward: ms.job.pay });
      toast(state, 'Odd job done', `+$${ms.job.pay}. Marisol always has more work.`);
      ms.job = null;
      ms.jobCooldown = 8;
    }
  }
}
