// JALTRON knowledge base. Each entry teaches the AI both the QUESTIONS (phrases) and the ANSWER.
// To add knowledge: copy an entry, change id, phrases and answer, then redeploy. No other code changes needed.
// answer can be a string, an array of strings (random pick), or a function (text, tasks) => string.
(function (root) {
  function evalExpr(src) {
    let i = 0; const s = src.replace(/\s+/g, '');
    const num = () => { if (s[i] === '(') { i++; const v = add(); if (s[i] !== ')') throw 0; i++; return v; } const m = s.slice(i).match(/^\d+(?:\.\d+)?/); if (!m) throw 0; i += m[0].length; return +m[0]; };
    const un = () => { if (s[i] === '-') { i++; return -un(); } return num(); };
    const pow = () => { const b = un(); if (s[i] === '^') { i++; return Math.pow(b, pow()); } return b; };
    const mul = () => { let v = pow(); while (s[i] === '*' || s[i] === '/') { const o = s[i++], r = pow(); v = o === '*' ? v * r : v / r; } return v; };
    const add = () => { let v = mul(); while (s[i] === '+' || s[i] === '-') { const o = s[i++], r = mul(); v = o === '+' ? v + r : v - r; } return v; };
    const v = add(); if (i !== s.length) throw 0; return v;
  }
  function calc(text) {
    const s = text.toLowerCase().replace(/,/g, '')
      .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)')
      .replace(/\bto the power of\b/g, '^').replace(/\bsquared\b/g, '^2')
      .replace(/\b(?:plus|add)\b/g, '+').replace(/\b(?:minus|subtract|less)\b/g, '-')
      .replace(/\b(?:times|multiplied by|multiply|x)\b/g, '*').replace(/\b(?:divided by|over|divide)\b/g, '/');
    const parts = (s.match(/[\d.+\-*/^()\s]+/g) || []).map(x => x.trim()).filter(x => /\d/.test(x) && /[+\-*/^]/.test(x.replace(/^-/, '')));
    parts.sort((a, b) => b.length - a.length);
    try {
      const v = evalExpr(parts[0]);
      if (!isFinite(v)) return 'That is not a number I can show, for example dividing by zero.';
      return 'Answer: ' + Math.round(v * 1e10) / 1e10;
    } catch { return 'I could not read that calculation. Try "12 * 5", "15% of 200" or "2^10".'; }
  }
  const E = (id, phrases, answer) => ({ id, phrases, answer });

  root.KNOWLEDGE = [
    // ---- This site ----
    E('site_add', ['how do i add a task', 'how to add tasks', 'where do i add a task', 'how can i create a task', 'adding tasks help'], 'Use Quick Add on the left: type the task, choose priority, category and an optional due date, then press Add to plan. You can also tell me in plain words, for example "add fix login bug tomorrow high".'),
    E('site_edit', ['how do i edit a task', 'how to rename a task', 'can i change a task name', 'edit task help', 'how do i change the title'], 'Double-click a task title or press the pencil button. Enter saves and Esc cancels. You can also say "rename login to fix auth".'),
    E('site_drag', ['can i drag tasks', 'how do i reorder tasks', 'how to move tasks up and down', 'drag and drop help', 'change the order of tasks'], 'In the All view with no search or filter active, drag a task up or down to reorder it. Smart sort reorders everything by priority and deadlines.'),
    E('site_undo', ['how do i undo delete', 'i deleted a task by mistake', 'can i restore a deleted task', 'undo help', 'bring back deleted task'], 'After you delete from the list, an Undo button appears at the bottom for a few seconds. Deletes made through chat have no Undo, so be careful with them.'),
    E('site_search', ['how do i search tasks', 'how to find a task', 'is there a search bar', 'keyboard shortcut for search', 'how do i filter tasks'], 'Use the search box above the list (press / to jump to it), the category dropdown, and the All, Pending and Completed tabs. In chat, say "find login" or "show bugs".'),
    E('site_optimize', ['what does smart sort do', 'how does the optimizer work', 'how does sorting work', 'what is smart sort', 'how are tasks ranked'], 'Smart sort scores each open task: priority counts most, then deadline pressure (overdue is highest), then category (bugs get a boost). Completed tasks go last, and the top task is shown after sorting.'),
    E('site_theme', ['how do i change the theme', 'is there dark mode', 'how to turn on dark mode', 'light mode please', 'change colors'], 'Press the moon or sun button in the top right to switch between light and dark. It starts from your device setting.'),
    E('site_save', ['are my tasks saved', 'do tasks save when i refresh', 'where is my data stored', 'how does saving work', 'will i lose my tasks'], 'Nothing is stored in your browser. When the header says AI ONLINE, tasks are saved on the server and load again next time. In DEMO MODE or when the server is offline, tasks reset on refresh.'),
    E('site_status', ['what does ai online mean', 'what does demo mode mean', 'why does it say server offline', 'what is the status badge', 'header status meaning'], 'AI ONLINE: the server is connected and saving. DEMO MODE: no server address is set. SERVER OFFLINE or SERVER LOST: the page cannot reach it, so tasks will not be saved.'),
    E('site_category', ['what are the categories', 'what is the difference between dev and bug', 'how do categories work', 'what categories exist', 'what is a category'], 'Categories are Dev (building things), Bug (fixing problems), Study (learning) and General (everything else). Bugs get a small boost in Smart sort. Say "tag login as dev" to change one.'),
    E('site_due', ['how do due dates work', 'how do i set a deadline', 'what do the due badges mean', 'can i add a deadline', 'overdue badge meaning'], 'Pick a date in Quick Add or say "add pay hosting friday". Badges show Due today, Due tomorrow, a date, or how many days overdue (red). Say "move login to monday" to change one.'),
    E('site_stats', ['what do the cards at the top mean', 'what is the high priority count', 'what does in progress mean', 'explain the stats', 'what is the progress bar'], 'The cards count all tasks, open tasks (In Progress), completed tasks, open High priority tasks and overdue tasks. The bar shows the percent of tasks completed.'),
    E('site_assistant', ['how do i use the ai chat', 'what commands can i say', 'how do i talk to you', 'how to use the assistant', 'examples of things to say'], 'Type naturally, for example: "add task for my study tomorrow", "complete login", "make docs low priority", "move login to friday", "plan my day", "what is due today", "summary". Say "what can you do" for the full list.'),
    E('site_neural', ['how does your ai work', 'what model are you', 'are you chatgpt', 'how were you trained', 'are you a real ai'], 'I am a small neural network trained from scratch in your browser on characters and example phrases. It guesses what you mean, then my code finds the task and date in your sentence. I am far smaller than ChatGPT-style models, so I only know this site, planning, studying and coding habits.'),
    E('site_about', ['who are you', 'what is jaltron', 'what is your name', 'who made you', 'what are you'], 'I am JALTRON, an AI task and context planner. I manage your plan, suggest what to do first and answer questions about planning, studying and this site.'),
    E('site_privacy', ['is my data private', 'do you send my tasks anywhere', 'is this safe', 'who can see my tasks', 'privacy question'], 'The neural AI runs in your browser, so your messages are not sent to an AI service. Tasks are saved only on this site\'s own server when it is connected. The optional bigger AI downloads model files from the internet, but your tasks stay on your device.'),
    E('site_shortcuts', ['keyboard shortcuts', 'what shortcuts exist', 'hotkeys', 'how to use keyboard', 'shortcut list'], 'Press / to focus search. While editing a task, Enter saves and Esc cancels. In the chat, Enter sends.'),
    E('site_mobile', ['does this work on phone', 'is it mobile friendly', 'can i use this on my phone', 'phone support'], 'Yes, the layout adapts to small screens. The optional bigger AI model is heavy for phones, but the built-in AI works fine.'),
    E('site_bigger', ['what is the bigger ai', 'what does enable bigger ai do', 'what is qwen', 'why is there a download'], 'The optional bigger AI downloads a small language model (about 400 MB) that runs in your browser for free-form questions. It is slower and can make mistakes, so the built-in AI handles everyday commands.'),
    E('kb_topics', ['what do you know', 'what can you answer', 'what topics do you know', 'what questions can i ask', 'what are you good at'], 'I know your tasks and this site, plus tips on focus, prioritizing, deadlines, studying, debugging and git, and quick things like dates, calculations, jokes and coin flips.'),

    // ---- Productivity ----
    E('tip_focus', ['how do i focus', 'tips to stay focused', 'i keep getting distracted', 'how to concentrate', 'help me focus better'], 'Pick one task, silence notifications, and work in a timed block (for example 25 minutes) with your phone out of reach. Write distracting thoughts on a list and handle them later.'),
    E('tip_pomodoro', ['what is pomodoro', 'explain the pomodoro technique', 'how does pomodoro work', 'should i use pomodoro'], 'Pomodoro: work focused for 25 minutes, take a 5 minute break, repeat. After four rounds take a longer break of 15 to 30 minutes. Pick one task per round.'),
    E('tip_timeblock', ['what is time blocking', 'how do i time block', 'how to schedule my day', 'how should i structure my day'], 'Time blocking means giving each task a slot on your calendar. Put the hardest task when your energy is highest, leave gaps for surprises, and group similar small tasks together.'),
    E('tip_eisenhower', ['what is the eisenhower matrix', 'urgent vs important', 'how do i decide whats important', 'how to prioritize tasks', 'how do i prioritize'], 'Sort tasks by urgent and important. Important and urgent: do now. Important but not urgent: schedule it. Urgent but not important: delegate or shorten. Neither: drop it. Most progress comes from the important but not urgent group.'),
    E('tip_mit', ['how many tasks should i do a day', 'what is a most important task', 'how many priorities should i have', 'how long should my to do list be'], 'Choose up to three most important tasks for the day and finish them first. A short list you complete beats a long list you do not.'),
    E('tip_frog', ['what is eat the frog', 'should i do hard tasks first', 'what task should i start with', 'hardest task first or easiest'], 'Eating the frog means doing your hardest or most dreaded task first, while your energy is high. If you struggle to start, begin with a quick easy task to build momentum, then move to the hard one.'),
    E('tip_twomin', ['what is the two minute rule', 'should i do small tasks now', 'quick tasks tip'], 'If a task takes under two minutes, do it right away instead of adding it to your list. Batch the remaining small tasks into one block.'),
    E('tip_procrastinate', ['how do i stop procrastinating', 'i keep procrastinating', 'why do i procrastinate', 'tips for procrastination', 'i cant start working'], 'Make the first step tiny, like opening the file or writing one sentence, and commit to just 5 minutes. Remove friction (clear your desk, close tabs) and set a specific start time. Starting is usually the hardest part.'),
    E('tip_overwhelm', ['i have too much to do', 'how do i handle overwhelm', 'everything feels urgent', 'so many tasks what do i do'], 'Write everything down, then choose only the next three actions. Break big items into small steps and ignore the rest for now. Ask me to "plan my day" and I will order your open tasks.'),
    E('tip_breaks', ['how often should i take breaks', 'are breaks good', 'how to rest while working', 'break tips'], 'Short breaks help focus: stand up, drink water or look away from the screen for a few minutes after each focused block. Avoid social media during breaks because it is hard to stop.'),
    E('tip_review', ['what is a weekly review', 'how do i review my week', 'how to reflect on tasks', 'end of week routine'], 'Once a week, check what you finished, move unfinished tasks to new dates or delete them, and choose your top priorities for next week. Ten to fifteen minutes is enough.'),
    E('tip_multitask', ['is multitasking bad', 'should i multitask', 'can i do many things at once'], 'Switching between tasks costs time and attention, so finishing one task before starting another usually works better. Batch similar small tasks together.'),
    E('tip_goals', ['how do i set goals', 'what is a smart goal', 'how to plan long term goals', 'how to reach a big goal'], 'Make a goal specific, measurable and time-bound, then split it into weekly actions and add the first few as tasks here. Review it every week.'),
    E('tip_habits', ['how do i build a habit', 'how to be consistent', 'how do i stay consistent', 'habit tips'], 'Start very small, attach the habit to something you already do each day, and track it daily. Try not to skip two days in a row.'),
    E('tip_deadline', ['how do i estimate time', 'how long will a task take', 'how to meet deadlines', 'deadline tips', 'i am always late with deadlines'], 'Estimate, then add about 50 percent extra because tasks usually take longer than planned. Work backwards from the deadline, set an earlier personal deadline and split the work into steps with their own dates.'),
    E('tip_sleep', ['does sleep matter for studying', 'should i stay up late to finish', 'is it ok to skip sleep'], 'Sleep supports memory and focus, so staying up late often costs more than it gains. If you can, finish the most important task earlier and rest.'),

    // ---- Study ----
    E('study_methods', ['how should i study', 'best way to study', 'study tips', 'how do i learn faster', 'how to study effectively'], 'Test yourself instead of rereading (active recall), space your practice over several days, mix topics, and explain ideas in your own words. Short focused sessions beat one long cram.'),
    E('study_exam', ['how do i prepare for an exam', 'exam tips', 'how to revise', 'i have an exam coming up', 'revision plan'], 'List the topics, rate how well you know each, and spend most time on the weak ones. Practice with past questions under time, review mistakes, and plan short sessions each day. Add each topic as a Study task here.'),
    E('study_notes', ['how do i take good notes', 'note taking tips', 'how should i make notes'], 'Write notes in your own words, add questions in the margin, and turn them into practice questions later. Review them within a day.'),
    E('study_memory', ['how do i remember things', 'how to memorize', 'memory tips', 'what is spaced repetition', 'what is active recall'], 'Spaced repetition means reviewing material after growing gaps, like 1 day, 3 days, then a week. Active recall means testing yourself from memory. Together they beat rereading.'),
    E('study_math', ['how do i get better at math', 'math study tips', 'how to learn maths', 'i struggle with math'], 'Do problems instead of only reading solutions: try first, then check, then redo mistakes a few days later. Make sure you understand each step, and start with easier problems to build confidence.'),

    // ---- Coding and servers ----
    E('dev_debug', ['how do i debug', 'debugging tips', 'how to fix a bug', 'my code has a bug what do i do', 'how to find a bug'], 'Reproduce the bug reliably, read the exact error message, then narrow it down (comment out code, add logging, or bisect). Change one thing at a time and test after each. Explaining the problem out loud often reveals it.'),
    E('dev_git', ['git tips', 'how should i use git', 'how often should i commit', 'git workflow'], 'Commit small, working changes with clear messages and use a branch per feature. Pull before you push. Never commit secrets such as API keys or passwords.'),
    E('dev_learn', ['how do i learn javascript', 'how to learn programming', 'how to get better at coding', 'coding practice tips'], 'Build small projects you care about, read other people\'s code and practice a little every day. When stuck, break the problem into steps and search the exact error message.'),
    E('dev_feature', ['how do i plan a feature', 'how to break down a project', 'how do i start a big project', 'project planning tips'], 'Write what the feature must do, split it into the smallest pieces that work on their own, build the simplest version first, then improve it. Add each piece as a task here with a due date.'),
    E('dev_deploy', ['deployment checklist', 'before i deploy what should i check', 'how to deploy safely', 'release checklist'], 'Test the main flows, back up data, check configuration and environment variables, deploy at a quiet time, watch the logs afterwards, and know how to roll back.'),
    E('dev_minecraft', ['tips for running a minecraft server', 'how to manage plugins safely', 'how do i update my server', 'server maintenance tips'], 'Back up worlds and configs before any update, try changes on a test server first, update one plugin at a time, read the console log for errors, and download plugins only from trusted sources.'),
    E('dev_security', ['how do i keep api keys safe', 'security tips for my website', 'should i put secrets in my code'], 'Never put secrets in front-end code or commit them to git. Keep them in environment variables on the server, limit who can call your API, and rotate keys if they leak.'),

    // ---- Quick utilities ----
    E('util_date', ['what is the date today', 'what day is it', 'whats todays date', 'what day is today'], () => 'Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.'),
    E('util_time', ['what time is it', 'whats the time', 'current time', 'time now'], () => 'It is ' + new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '.'),
    E('util_math', ['what is 12 times 5', 'calculate 15% of 200', '5+6', 'solve 100 / 4', 'what is 7 plus 8', 'how much is 9*9', 'compute 2^10', '(3+4)*2'], (text) => calc(text)),
    E('util_joke', ['tell me a joke', 'say something funny', 'make me laugh', 'got any jokes', 'tell me something funny'], [
      'Why do programmers prefer dark mode? Because light attracts bugs.',
      'There are 10 kinds of people: those who understand binary and those who do not.',
      'A SQL query walks into a bar, sees two tables and asks: can I join you?',
      'I would tell you a UDP joke, but you might not get it.',
      'Why did the developer go broke? He used up all his cache.'
    ]),
    E('util_coin', ['flip a coin', 'heads or tails', 'toss a coin'], () => (Math.random() < 0.5 ? 'Heads.' : 'Tails.')),
    E('util_dice', ['roll a dice', 'roll a die', 'throw dice', 'roll a number'], () => 'You rolled a ' + (1 + Math.floor(Math.random() * 6)) + '.')
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KNOWLEDGE;
})(typeof window !== 'undefined' ? window : globalThis);