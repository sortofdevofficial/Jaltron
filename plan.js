'use strict';
// JALTRON plans. Staff activate Lite by creating the Firestore doc s/<uid> = { p: 'lite', e: <expiry in ms, optional> } (clients can only read it).
(function (root) {
  const PLANS = {
    free: { name: 'Free', tasks: 25, cats: 3, repeat: false, img: false, pet: false, insights: false },
    lite: { name: 'Lite', tasks: Infinity, cats: 12, repeat: true, img: true, pet: true, insights: true }
  };
  const NEED = { tasks: 'The Free plan holds 25 tasks.', cats: 'The Free plan allows 3 categories.', repeat: 'Repeating tasks and streaks', img: 'Pictures', pet: 'The growing pet', insights: 'Insights' };
  let id = 'free', until = 0;
  function set(s) {
    until = (s && s.e) || 0;
    id = s && s.p === 'lite' && (!until || until > Date.now()) ? 'lite' : 'free';
    document.documentElement.dataset.plan = id;
  }
  const limit = (f) => PLANS[id][f];
  const can = (f) => !!PLANS[id][f];
  // Message shown when a Free account hits a Lite feature
  const msg = (f) => `${NEED[f]}${f === 'tasks' || f === 'cats' ? '' : ' is a Lite feature.'} Talk to staff on Discord to get Lite.`;
  root.Plan = { set, limit, can, msg, get id() { return id; }, get name() { return PLANS[id].name; }, get until() { return until; } };
  set(null);
})(window);
