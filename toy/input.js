// input.js: the player's hands. The keyboard and the on-screen buttons feed the same seven buttons plus left/right: a held button holds
// a state (walk, guard, charge, push in a clash), a pressed one starts a move within the next 8 ticks, so mashing works and a press made
// a moment early is not lost. intent() turns them into the action the engine asks for, like a bot's decide().
export const pad = {
  down: new Set(), presses: [],
  reset() { this.down.clear(); this.presses = []; },
  press(b, tick) { this.down.add(b); this.presses.push({ b, at: tick }); },
  release(b) { this.down.delete(b); },
  take(b, tick) { const i = this.presses.findIndex(p => p.b === b && tick - p.at <= 8); if (i < 0) return false; this.presses.splice(i, 1); return true; },
  intent(v, tick) {
    this.presses = this.presses.filter(p => tick - p.at <= 8);
    // the engine turns a fighter to the opponent just before it acts, so 'toward' comes from where the opponent stands, not from the
    // facing in the view (that can still be the old one right after a dash through): right is always right on the screen
    const left = this.down.has('left'), right = this.down.has('right');
    const oppRight = v.opp.x !== v.me.x ? v.opp.x > v.me.x : v.me.facing > 0;
    const toward = oppRight ? right : left, away = oppRight ? left : right;
    if (v.clash) return this.down.has('light') ? 'push' : 'idle';
    const move = () => this.take('light', tick) ? 'light' : this.take('heavy', tick) ? 'heavy' : this.take('blast', tick) ? 'blast' : this.take('beam', tick) ? 'beam' : null;
    if (v.me.canCancel) return move() || 'none';
    if (!v.me.free) return 'idle';
    const mv = move(); if (mv) return mv;
    if (this.take('dash', tick)) return away ? 'dash_back' : 'dash_forward';
    if (this.down.has('guard')) return 'guard';
    if (this.down.has('charge')) return 'charge';
    return toward ? 'forward' : away ? 'back' : 'idle';
  },
};

export const KEYS = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyS: 'guard', ArrowDown: 'guard', KeyW: 'charge', ArrowUp: 'charge',
  KeyJ: 'light', KeyK: 'heavy', KeyL: 'blast', KeyI: 'beam', Space: 'dash' };

// listen while live() is true; tick() is the match tick a press belongs to
export function bindKeys(live, tick) {
  addEventListener('keydown', e => {
    const b = KEYS[e.code]; if (!b || !live()) return;
    e.preventDefault();
    if (!e.repeat) pad.press(b, tick());
  });
  addEventListener('keyup', e => { const b = KEYS[e.code]; if (b) pad.release(b); });
  addEventListener('blur', () => pad.reset());
}

// every element with data-b="light" etc. under root is a button; several can be held at once (one finger each)
export function bindButtons(root, live, tick) {
  for (const el of root.querySelectorAll('[data-b]')) {
    const b = el.dataset.b, up = e => { pad.release(b); el.classList.remove('on'); if (e.pointerId != null && el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId); };
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!live()) return;
      el.setPointerCapture?.(e.pointerId); el.classList.add('on'); pad.press(b, tick());
      navigator.vibrate?.(8);
    });
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
}
