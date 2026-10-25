// practice.js: the 练习场's partner. Four behaviours to learn the buttons on: a dummy that stands still (combos), one that keeps its guard
// up (crush it with a heavy, or wear its ki down), one that fights back (a sparring bot's own program), and one that answers your beam with
// its own so you can practise pushing a clash. Each is a decide(view) like a contestant's; the rules here are looser than a match's (no
// clock, health refills, ki on tap), so nothing learned here is a result.
import { RULES } from '../src/rules.js';

export const DRILL_RULES = Object.freeze({ ...RULES, maxTicks: 60 * 60 * 60 });   // an hour: no clock to speak of

export const MODES = {
  stand: { label: '木桩', tip: '站着不动：练连段，轻拳打中后马上接下一招' },
  guard: { label: '格挡', tip: '一直格挡：重击能破防；轻拳打在格挡上会耗它的气' },
  spar: { label: '还手', tip: '会乱出招：练格挡、后撤和瞬移', bot: 'sparring/mixer' },
  clash: { label: '对波', tip: '你一放气功波它就跟着放：撞上以后按住轻拳推回去' },
};

// the dummies that need no program of their own
export function dummy(mode) {
  if (mode === 'stand') return () => 'idle';
  if (mode === 'guard') return v => (v.me.free ? 'guard' : 'idle');
  if (mode === 'clash') return v => {
    if (v.clash) return Math.random() < 0.4 ? 'push' : 'idle';            // pushes back now and then: hold yours and you win
    if (v.opp.state === 'beam' && v.opp.phase === 'startup' && v.me.ki >= RULES.beam.cost) return 'beam';
    return v.me.free ? (v.me.ki < RULES.kiMax ? 'charge' : 'idle') : 'idle';
  };
  return null;
}
