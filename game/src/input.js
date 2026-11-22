// Keyboard input for Palmera Heat. Held keys are read as a live state every step (drive and walk
// in any direction), and one-shot presses are queued as bit flags and taken once by the loop, so
// a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_ENTER = 2;
export const ACTION_PUNCH = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;

const HELD = {
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
  sprint: new Set(['ShiftLeft', 'ShiftRight']),
  handbrake: new Set(['Space']),
};
const ONE_SHOT = new Map([
  ['Enter', ACTION_CONFIRM],
  ['KeyE', ACTION_ENTER],
  ['KeyF', ACTION_PUNCH],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyM', ACTION_MUTE],
]);

export function createInput() {
  const held = { up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
  const downCodes = new Set();
  let actions = 0;

  function refreshHeld() {
    for (const name of Object.keys(HELD)) {
      held[name] = [...HELD[name]].some((code) => downCodes.has(code));
    }
  }

  window.addEventListener('keydown', (event) => {
    const tracked = Object.values(HELD).some((set) => set.has(event.code)) || ONE_SHOT.has(event.code);
    if (!tracked) return;
    event.preventDefault();
    downCodes.add(event.code);
    if (!event.repeat && ONE_SHOT.has(event.code)) actions |= ONE_SHOT.get(event.code);
    refreshHeld();
  });
  window.addEventListener('keyup', (event) => {
    downCodes.delete(event.code);
    refreshHeld();
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    downCodes.clear();
    refreshHeld();
  });

  return {
    held,
    /** Take the queued one-shot actions; each press is delivered exactly once. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Foot movement as a vector from the held keys (not normalised; the world does that). */
    moveVector() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
  };
}
