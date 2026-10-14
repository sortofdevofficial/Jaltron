'use strict';
(function () {
// JALTRON's built-in assistant: no API, no model. It knows the site and returns { reply, actions }
// that the web UI executes (add, complete, delete, priority, clear, optimize, filter).

const W = { high: 3, medium: 2, low: 1 };
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const days = (d) => Math.round((new Date(d + 'T00:00') - new Date(dateStr() + 'T00:00')) / 864e5);
const nextDay = (n) => { const i = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(n.toLowerCase()); return dateStr(((i - new Date().getDay() + 7) % 7) || 7); };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

const clean = (t) => ({
  id: Number(t.id) || 0, title: String(t.title || '').slice(0, 140),
  prio: W[t.prio] ? t.prio : 'medium',
  tag: ['Dev', 'Bug', 'Study', 'General'].includes(t.tag) ? t.tag : 'General',
  due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '', done: !!t.done
});

function score(t) {
  let s = W[t.prio] * 10;
  if (t.due) { const d = days(t.due); s += d < 0 ? 25 : d === 0 ? 20 : d <= 2 ? 14 : d <= 7 ? 7 : 2; }
  return s + (t.tag === 'Bug' ? 6 : 0);
}
function why(t) {
  const b = [`${t.prio} priority`];
  if (t.due) { const d = days(t.due); b.push(d < 0 ? `${-d}d overdue` : d === 0 ? 'due today' : `due in ${d}d`); }
  if (t.tag === 'Bug') b.push('bugs block other work');
  return b.join(', ');
}
const STEPS = {
  Bug: ['Reproduce it and note the exact steps', 'Find the cause in logs or code', 'Fix it', 'Test the fix and nearby features'],
  Dev: ['Define what "done" looks like', 'Build the smallest working version', 'Test it', 'Clean up and ship'],
  Study: ['Pick one topic to cover', 'Study it for 25 focused minutes', 'Write a summary from memory', 'Test yourself'],
  General: ['Write down the exact outcome', 'List what you need first', 'Do the first small step now', 'Review and finish']
};

const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'task', 'tasks', 'please', 'it', 'that', 'this', 'as', 'is', 'for', 'of', 'on', 'priority', 'one', 'called']);
const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
function find(list, text) {
  const q = words(text);
  if (!q.length) return null;
  let best = null, bs = 0;
  for (const t of list) {
    const tw = words(t.title);
    const s = q.filter(w => tw.some(x => x === w || (w.length > 3 && x.startsWith(w)))).length;
    if (s > bs) { bs = s; best = t; }
  }
  return best;
}

function parseTask(raw) {
  let s = ' ' + raw.trim() + ' ', due = '', prio = 'medium', tag = '', m;
  if ((m = s.match(/\b(\d{4}-\d{2}-\d{2})\b/))) { due = m[1]; s = s.replace(m[0], ' '); }
  else if (/\btomorrow\b/i.test(s)) { due = dateStr(1); s = s.replace(/\b(?:by|due|for)?\s*tomorrow\b/i, ' '); }
  else if (/\btoday\b/i.test(s)) { due = dateStr(0); s = s.replace(/\b(?:by|due|for)?\s*today\b/i, ' '); }
  else if (/\bnext week\b/i.test(s)) { due = dateStr(7); s = s.replace(/\bnext week\b/i, ' '); }
  else if ((m = s.match(/\b(?:by|on|due|next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) { due = nextDay(m[1]); s = s.replace(m[0], ' '); }
  else if ((m = s.match(/\b(?:in|within)\s+(\d{1,2})\s+days?\b/i))) { due = dateStr(+m[1]); s = s.replace(m[0], ' '); }
  if (/\b(high|urgent|important|asap)\b/i.test(s)) prio = 'high';
  else if (/\blow\b/i.test(s)) prio = 'low';
  s = s.replace(/\b(?:high|medium|low|urgent|important|asap)\b(?:\s+priority)?|\bpriority\s+(?:high|medium|low)\b/gi, ' ');
  if ((m = s.match(/(?:category|tag|#)\s*(dev|bug|study|general)\b/i))) { tag = cap(m[1].toLowerCase()); s = s.replace(m[0], ' '); }
  else if (/\b(bug|fix|error|crash|broken)\b/i.test(s)) tag = 'Bug';
  else if (/\b(study|learn|read|revise|homework|exam)\b/i.test(s)) tag = 'Study';
  else if (/\b(code|build|implement|deploy|feature|plugin|api|script)\b/i.test(s)) tag = 'Dev';
  let t = s.replace(/\s+/g, ' ').replace(/\b(?:by|due|on|for|at|as|with)\s*$/i, '').trim();
  t = t.replace(/^(?:a\s+|new\s+)?(?:task\s+)?(?:for|about|on|regarding)\s+(?:my\s+|the\s+)?/i, '').replace(/^my\s+/i, '').replace(/\s+tasks?$/i, '').trim();
  const GEN = { study: ['Study session', 'Study'], studies: ['Study session', 'Study'], studying: ['Study session', 'Study'], homework: ['Do homework', 'Study'], bug: ['Fix a bug', 'Bug'], bugs: ['Fix bugs', 'Bug'], coding: ['Coding session', 'Dev'], code: ['Coding session', 'Dev'], dev: ['Dev work', 'Dev'], work: ['Work task', 'General'] };
  const g = GEN[t.toLowerCase()];
  if (g) { t = g[0]; tag = g[1]; }
  return { title: cap(t), prio, tag: tag || 'General', due };
}

const FAQ = [
  [/on-?device|real ai|llm|language model|which model/, 'I work in two layers: fast built-in commands for exact requests, and an optional on-device AI model (tap "Enable real AI" in this chat) that understands free-form requests. It runs in your browser, so your tasks are not sent to any AI service.'],
  [/drag|reorder|move (a )?task/, 'Drag a task up or down in the All view to reorder it. Dragging is off while a search or filter is active.'],
  [/edit|rename|change (the )?(name|title)/, 'Double-click a task title, or press the pencil button. Enter saves and Esc cancels.'],
  [/undo|restore|deleted by mistake/, 'After you delete a task, an Undo button appears for a few seconds at the bottom.'],
  [/search|shortcut|keyboard|hotkey/, 'Press / anywhere to jump to the search box. You can also filter by category next to it.'],
  [/optimi[sz]|score|rank/, 'The optimizer ranks open tasks by priority, deadline pressure (overdue counts most) and category (bugs get a boost), then puts completed tasks last.'],
  [/dark|light|theme|mode/, 'Use the moon or sun button in the header to switch themes.'],
  [/save|persist|lost|refresh|storage|backup/, 'Nothing is stored in your browser. When the header says AI ONLINE, tasks are saved on the server. In DEMO MODE they reset on refresh.'],
  [/status|online|offline|demo/, 'Header status: AI ONLINE means the server is connected and saving. DEMO MODE means no server address is set. SERVER OFFLINE or SERVER LOST means it cannot be reached.'],
  [/categor|tag/, 'Categories are Dev, Bug, Study and General. Say "add fix login bug" and I will pick Bug automatically.'],
  [/due|deadline|date/, 'Set a due date when adding a task. Badges show Due today, Due tomorrow or how many days overdue. You can tell me too: "add pay hosting tomorrow".']
];

const ADD_RE = /^(?:please\s+|pls\s+|can you\s+|could you\s+)?(?:add|create|put|new task|todo|remind me to|i need to|i have to|i must|i should|i gotta|lets|let's)\b\s*(?:a\s+|an\s+|new\s+)?(?:task\s*)?(?:to\s+|called\s+|named\s+|:)?\s*(.+)$/i;
const SPLIT_RE = /\s*(?:,|;|\bthen\b|\balso\b)\s*|\s+and\s+(?=(?:add|fix|study|read|learn|finish|write|build|call|buy|do|make|clean|review|prepare|practice)\b)/i;
const LIST_TAIL = /\s+(?:to|on|in|into)\s+(?:my\s+)?(?:list|plan|tasks?|to-?do(?: list)?)$/i;
const ASK_TITLE = 'What should the task say? Try "add fix login bug tomorrow high".';
const say = (reply, actions = []) => ({ reply, actions });

function respond(msg, tasksIn, history) {
  const tasks = (Array.isArray(tasksIn) ? tasksIn : []).slice(0, 500).map(clean).filter(t => t.title);
  const open = tasks.filter(t => !t.done).sort((a, b) => score(b) - score(a));
  const m = String(msg || '').trim().replace(/[.!?]+$/, ''), l = m.toLowerCase();
  let r;

  if (!m) return say('Ask me something, for example "plan my day".');
  const hist = Array.isArray(history) ? history : [];
  let lastAi = '';
  for (let i = hist.length - 2; i >= 0; i--) if (hist[i] && hist[i].role === 'assistant') { lastAi = String(hist[i].content); break; }
  if (/^(?:cancel|never ?mind|forget it|no)$/.test(l) && /^(What should the task|This will delete all)/.test(lastAi)) return say('Okay, cancelled.');
  if (/^(?:yes|y|confirm|do it|sure)$/.test(l) && /^This will delete all/.test(lastAi)) return say('All tasks deleted.', [{ type: 'clear_all' }]);
  const pendingAdd = /^What should the task/.test(lastAi) && l.split(/\s+/).length <= 10 && !/^(plan|show|what|how|summary|help|overdue|break|optimi|complete|delete)/.test(l);
  if (/^(hi|hello|hey|yo|sup)\b/.test(l)) return say('Hey! I can add, complete, delete and re-prioritize tasks, or tell you what to do first. Say "what can you do" for the full list.');

  if (/\b(clear|remove|delete)\b.*\b(completed|done|finished)\b/.test(l)) {
    const n = tasks.filter(t => t.done).length;
    return n ? say(`Cleared ${n} completed task${n > 1 ? 's' : ''}.`, [{ type: 'clear_done' }]) : say('There are no completed tasks to clear.');
  }
  if ((r = m.match(/^(?:please\s+)?(?:make|set|change|mark)\s+(.+?)\s+(?:as\s+|to\s+)?(high|medium|low)(?:\s+priority)?$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Set "${t.title}" to ${r[2].toLowerCase()} priority.`, [{ type: 'prio', id: t.id, prio: r[2].toLowerCase() }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if (/^(?:complete|finish|mark)\s+(?:all|everything)(?:\s+tasks?)?(?:\s+(?:as\s+)?(?:done|complete|completed))?$/.test(l))
    return open.length ? say(`Marked all ${open.length} open tasks as done.`, [{ type: 'complete_all' }]) : say('Nothing is open right now.');
  if (/^(?:delete|remove|clear|wipe)\s+(?:all|everything)(?:\s+(?:my\s+)?tasks?)?$/.test(l))
    return tasks.length ? say(`This will delete all ${tasks.length} tasks. Reply "yes" to confirm.`) : say('Your plan is already empty.');
  if ((r = m.match(/^(?:reopen|uncheck|restore)\s+(.+)$/i))) {
    const t = find(tasks.filter(x => x.done), r[1]);
    return t ? say(`Reopened "${t.title}".`, [{ type: 'reopen', id: t.id }]) : say(`I could not find a completed task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:rename|change)\s+(.+?)\s+to\s+(.+)$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Renamed "${t.title}" to "${cap(r[2].trim())}".`, [{ type: 'rename', id: t.id, title: cap(r[2].trim()) }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:tag|categori[sz]e|move|set)\s+(.+?)\s+(?:as|to|under|category)\s+(dev|bug|study|general)$/i))) {
    const t = find(tasks, r[1]), c = cap(r[2].toLowerCase());
    return t ? say(`Moved "${t.title}" to ${c}.`, [{ type: 'tag', id: t.id, tag: c }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:move|reschedule|postpone|push|delay)\s+(.+?)\s+(?:to|until|till|for|by|on)\s+(.+)$/i))) {
    const t = find(tasks, r[1]), due = parseTask(r[2]).due;
    if (!t) return say(`I could not find a task matching "${r[1]}".`);
    return due ? say(`"${t.title}" is now due ${due}.`, [{ type: 'due', id: t.id, due }]) : say('I could not read that date. Try "tomorrow", "friday", "in 3 days" or 2026-10-20.');
  }
  if ((r = m.match(/^(?:find|search(?:\s+for)?|look\s+for)\s+(.+)$/i))) return say(`Showing tasks matching "${r[1]}".`, [{ type: 'search', q: r[1] }]);
  if (/^(?:clear|reset)\s+(?:the\s+)?(?:filters?|search)$/.test(l)) return say('Filters cleared.', [{ type: 'filter', status: 'all', cat: 'all' }, { type: 'search', q: '' }]);
  if (/^(thanks|thank you|thx|ty)\b/.test(l)) return say('Anytime. Tell me when you want the next step.');

  if ((r = m.match(ADD_RE)) || pendingAdd) {
    const text = (r ? r[1] : m).replace(LIST_TAIL, '').trim();
    if (!text || /^(?:a\s+|new\s+)?tasks?$/i.test(text)) return say(ASK_TITLE);
    const added = text.split(SPLIT_RE).filter(x => x && x.trim().length > 1).slice(0, 8).map(parseTask).filter(p => p.title);
    if (!added.length) return say(ASK_TITLE);
    const fmt = (p) => `"${p.title}" (${p.prio}, ${p.tag}${p.due ? ', due ' + p.due : ''})`;
    return say(added.length === 1 ? `Added ${fmt(added[0])}.` : `Added ${added.length} tasks:\n` + added.map(p => '- ' + fmt(p)).join('\n'), added.map(p => ({ type: 'add', ...p })));
  }
  if ((r = m.match(/^(?:please\s+)?(?:i\s+)?(?:complete|completed|finish|finished|done with|check off|tick off|mark)\s+(.+?)(?:\s+(?:as\s+)?(?:done|complete|completed|finished))?$/i))) {
    const t = find(open, r[1]) || find(tasks, r[1]);
    if (!t) return say(`I could not find a task matching "${r[1]}".`);
    return t.done ? say(`"${t.title}" is already done.`) : say(`Marked "${t.title}" as done. Nice work.`, [{ type: 'complete', id: t.id }]);
  }
  if ((r = m.match(/^(?:please\s+)?(?:delete|remove|drop|cancel)\s+(.+)$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Deleted "${t.title}".`, [{ type: 'delete', id: t.id }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if (/^(?:please\s+|can you\s+|go\s+)?(?:optimi[sz]e|re-?order|re-?sort|organi[sz]e|sort)\b/.test(l))
    return say('Optimized your plan by priority, deadlines and category.', [{ type: 'optimize' }]);
  if ((r = l.match(/^show\s+(?:me\s+)?(?:only\s+)?(?:the\s+)?(all|everything|pending|active|open|completed|done|finished|bugs?|dev|study|general)\b/))) {
    const k = r[1];
    const a = /^(all|everything)$/.test(k) ? { type: 'filter', status: 'all', cat: 'all' }
      : /^(pending|active|open)$/.test(k) ? { type: 'filter', status: 'pending' }
      : /^(completed|done|finished)$/.test(k) ? { type: 'filter', status: 'done' }
      : { type: 'filter', cat: k.startsWith('bug') ? 'Bug' : cap(k) };
    return say('Done. Filter updated.', [a]);
  }

  if (/\b(summary|status of my|progress|how many|stats|overview|how am i doing|how's my day)\b/.test(l)) {
    const done = tasks.filter(t => t.done).length, late = open.filter(t => t.due && days(t.due) < 0).length;
    return say(`You have ${tasks.length} tasks: ${open.length} open, ${done} done (${tasks.length ? Math.round(done / tasks.length * 100) : 0}%). ${open.filter(t => t.prio === 'high').length} high priority, ${late} overdue.` + (open[0] ? ` Next up: "${open[0].title}".` : ''));
  }
  if (/\bdue\b/.test(l) && /\b(today|tomorrow|this week|soon|next)\b/.test(l) && /^(?:what|which|anything|any|show|list|tasks)/.test(l)) {
    const lst = open.filter(t => t.due && (/tomorrow/.test(l) ? days(t.due) === 1 : /today/.test(l) ? days(t.due) <= 0 : days(t.due) <= 7));
    return say(lst.length ? 'Due:\n' + lst.map(t => `- ${t.title} (${t.due})`).join('\n') : 'Nothing is due in that window.');
  }
  if (/\b(overdue|late|behind)\b/.test(l)) {
    const late = open.filter(t => t.due && days(t.due) < 0);
    return say(late.length ? 'Overdue:\n' + late.map(t => `- ${t.title} (${-days(t.due)}d late)`).join('\n') : 'Nothing is overdue. Nice.');
  }
  if (/\b(break|split|steps|how (do|to) i (finish|do))\b/.test(l)) {
    const named = find(open, l.replace(/.*?\b(?:break down|break|split|steps (?:for|to))\b/, ''));
    const t = named || open[0];
    return t ? say(`To finish "${t.title}":\n` + STEPS[t.tag].map((s, i) => `${i + 1}. ${s}`).join('\n')) : say('Add a task first and I will break it down.');
  }
  if (/\b(plan|schedule|today|my day)\b/.test(l))
    return open.length ? say('Suggested order:\n' + open.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} (${why(t)})`).join('\n')) : say('Your plan is empty. Add a task and I will plan around it.');
  if (/\b(first|next|start|focus|priorit)/.test(l))
    return open.length ? say(`Do this first: "${open[0].title}" (${why(open[0])}).` + (open[1] ? `\nThen: "${open[1].title}".` : '')) : say('Your plan is empty. Add a task and I will tell you what to do first.');
  if (/\b(help|what can you|commands|features|how do you work)\b/.test(l))
    return say('I can:\n- add tasks: "add task for my study", "add fix login bug tomorrow high", or several at once with commas\n- complete / reopen / delete: "complete login", "complete all", "delete old task"\n- edit: "rename login to fix auth", "move login to friday", "make login low priority", "tag docs as study"\n- find and filter: "find login", "show pending", "show bugs", "clear filters"\n- think: "plan my day", "what\'s due today", "summary", "overdue", "break down login"\n- explain the site: drag, edit, themes, saving, status');
  for (const [re, ans] of FAQ) if (re.test(l)) return say(ans);

  return Object.assign(say('I did not get that. Try "add fix login bug tomorrow", "complete login", "plan my day" or "what can you do".'), { unknown: true });
}

const api = { respond, clean, parseTask, find };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.Brain = api;
})();