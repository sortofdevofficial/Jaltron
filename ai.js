// JALTRON AI: the whole brain in one file. Edit the sections below to teach it, then redeploy.
//   1. KNOWLEDGE  questions + answers it can talk about (add entries here)
//   2. TRAINING   phrases for actions on your tasks (add phrasings here)
//   3. TINYBRAIN  small neural network trained from characters in your browser
//   4. BRAIN      commands and understanding of messy sentences (dates, priority, category, titles)
//   5. JALTRONAI  glue that picks the best answer
// ---------------------------------------------------------------------------------------
// ===== 1. KNOWLEDGE =====
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
// Lists the live categories, including the ones the user created
root.catReply = () => {
  const c = window.CATS ? CATS() : ['Dev', 'Bug', 'Study', 'General'];
  const mine = c.slice(4);
  return 'Your categories: ' + c.join(', ') + '.' + (mine.length ? ' Your own: ' + mine.join(', ') + '.' : '') + ' Bugs get a small boost in Smart sort. Say "tag login as dev" to change one, or use the + New button next to Category to create more.';
};
root.calcReply = calc;
  const E = (id, phrases, answer) => ({ id, phrases, answer });

  root.KNOWLEDGE = [
    // ---- This site ----
    E('site_add', ['how do i add a task', 'how to add tasks', 'where do i add a task', 'how can i create a task', 'adding tasks help'], 'Use Quick Add on the left: type the task, choose priority, category and an optional due date, then press Add to plan. You can also tell me in plain words, for example "add fix login bug tomorrow high".'),
    E('site_edit', ['how do i edit a task', 'how to rename a task', 'can i change a task name', 'edit task help', 'how do i change the title'], 'Double-click a task title or press the pencil button. Enter saves and Esc cancels. You can also say "rename login to fix auth".'),
    E('site_drag', ['can i drag tasks', 'how do i reorder tasks', 'how to move tasks up and down', 'drag and drop help', 'change the order of tasks'], 'In the All view with no search or filter active, drag a task up or down to reorder it. Smart sort reorders everything by priority and deadlines.'),
    E('site_undo', ['how do i undo delete', 'i deleted a task by mistake', 'can i restore a deleted task', 'undo help', 'bring back deleted task'], 'After you delete from the list, an Undo button appears at the bottom for a few seconds. You can also say "undo" in chat to put back the last deleted task.'),
    E('site_search', ['how do i search tasks', 'how to find a task', 'is there a search bar', 'keyboard shortcut for search', 'how do i filter tasks'], 'Use the search box above the list (press / to jump to it), the category dropdown, and the All, Pending and Completed tabs. In chat, say "find login" or "show bugs".'),
    E('site_optimize', ['what does smart sort do', 'how does the optimizer work', 'how does sorting work', 'what is smart sort', 'how are tasks ranked'], 'Smart sort scores each open task: priority counts most, then deadline pressure (overdue is highest), then category (bugs get a boost). Completed tasks go last, and the top task is shown after sorting.'),
    E('site_theme', ['how do i change the theme', 'is there dark mode', 'how to turn on dark mode', 'light mode please', 'change colors'], 'Open Settings in the menu and pick Light, Dark or System, or press the moon or sun button in the top right (or T). Your choice is saved on this device.'),
    E('site_save', ['are my tasks saved', 'do tasks save when i refresh', 'where is my data stored', 'how does saving work', 'will i lose my tasks'], 'Sign in with Google (top right) and your tasks save to your own account in the cloud and load on any device. Signed out, they live only in this page and refreshing clears them. Nothing goes in your browser storage.'),
    E('site_status', ['what does ai online mean', 'what does demo mode mean', 'why does it say server offline', 'what is the status badge', 'header status meaning'], 'TRAINING: the built-in neural AI is still learning in your browser (a few seconds). AI READY: it is trained. SYNCED: it is trained and you are signed in, so tasks save to your account.'),
    E('site_category', ['what are the categories', 'what is the difference between dev and bug', 'how do categories work', 'what categories exist', 'what is a category'], () => window.catReply()),
    E('site_due', ['how do due dates work', 'how do i set a deadline', 'what do the due badges mean', 'can i add a deadline', 'overdue badge meaning'], 'Pick a date in Quick Add or say "add pay hosting friday". Badges show Due today, Due tomorrow, a date, or how many days overdue (red). Say "move login to monday" to change one.'),
    E('site_stats', ['what do the cards at the top mean', 'what is the high priority count', 'what does in progress mean', 'explain the stats', 'what is the progress bar'], 'The cards count all tasks, open tasks (In Progress), completed tasks, open High priority tasks and overdue tasks. The bar shows the percent of tasks completed.'),
    E('site_assistant', ['how do i use the ai chat', 'what commands can i say', 'how do i talk to you', 'how to use the assistant', 'examples of things to say'], 'Type naturally, for example: "add task for my study tomorrow", "complete login", "focus on login", "move login to friday", "plan my day", "what is due today", "summary", "undo". Say "what can you do" for the full list.'),
    E('site_neural', ['how does your ai work', 'what model are you', 'are you chatgpt', 'how were you trained', 'are you a real ai', 'what llm do you use'], 'I am a self-owned knowledge engine, not a language model. A tiny neural network in your browser guesses what you mean, my code runs task commands locally, and for facts I search public sources such as Wikipedia, Wikidata, dictionaries, weather and currency services. I answer with sources and keep common facts offline. I cannot write free-form essays or stories.'),
    E('site_about', ['who are you', 'what is jaltron', 'what is your name', 'who made you', 'what are you'], 'I am JALTRON, an AI task and context planner. I manage your plan, suggest what to do first and answer questions about planning, studying and this site.'),
    E('site_privacy', ['is my data private', 'do you send my tasks anywhere', 'is this safe', 'who can see my tasks', 'privacy question'], 'Your task list never leaves your browser. Task and site commands run locally. General questions are answered from a shipped offline pack, or sent without any task data to my own small server, which asks public sources such as Wikipedia and Open-Meteo. There is no AI API, no model download and no account linked to your questions.'),
    E('site_shortcuts', ['keyboard shortcuts', 'what shortcuts exist', 'hotkeys', 'how to use keyboard', 'shortcut list'], 'Press / to focus search. While editing a task, Enter saves and Esc cancels. In the chat, Enter sends.'),
    E('site_mobile', ['does this work on phone', 'is it mobile friendly', 'can i use this on my phone', 'phone support'], 'Yes, the layout adapts to small screens. The AI is light: a tiny browser network plus an offline fact pack, so it runs on phones and does not download a model.'),
    E('site_bigger', ['what is the bigger ai', 'what does enable bigger ai do', 'what is qwen', 'why is there a download', 'is there a bigger model'], 'There is no bigger model and no download. The knowledge engine uses an offline fact pack plus live public sources, so it stays fast and small on phones and on a 512 MB server.'),
    E('kb_topics', ['what do you know', 'what can you answer', 'what topics do you know', 'what questions can i ask', 'what are you good at'], 'I know your tasks and this site, and I can look up far more: definitions, comparisons, country and science facts, summaries, quizzes, weather, time zones, currency, books, papers and programming answers. Common facts work offline; the rest comes from public sources with a link. Try "what is photosynthesis", "compare France and Germany", "define serendipity", "weather in London" or "quiz me on the moon". I cannot write essays or stories.'),

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
    E('study_exam', ['how do i prepare for an exam', 'exam tips', 'how to revise', 'i have an exam coming up', 'revision plan', 'how do i study for exams', 'how to study for an exam', 'how do i study for a test', 'study for exam tips', 'exam preparation'], 'List the topics, rate how well you know each, and spend most time on the weak ones. Practice with past questions under time, review mistakes, and plan short sessions each day. Add each topic as a Study task here.'),
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


    // ---- More study ----
    E('study_physics', ['tips for physics', 'how do i study physics', 'physics exam help', 'how to solve physics problems', 'i struggle with physics'], 'For physics: understand the concept before the formula, draw a diagram, list what is known and unknown, solve with symbols first and put numbers in last, then check the units and whether the answer is reasonable. Practice many different problems.'),
    E('study_chem', ['tips for chemistry', 'how do i study chemistry', 'chemistry exam help', 'how to balance equations'], 'For chemistry: learn the key terms with flashcards, practice balancing equations and mole calculations daily, and make a summary table for reactions and trends. Redo the problems you got wrong.'),
    E('study_bio', ['tips for biology', 'how do i study biology', 'biology exam help', 'how to memorize biology'], 'For biology: turn processes into flowcharts, label diagrams from memory, use flashcards for terms, and explain each process out loud in your own words.'),
    E('study_essay', ['how do i write an essay', 'essay writing tips', 'how to start an essay', 'how to structure an essay'], 'Start with a clear thesis, outline three or four main points, write one idea per paragraph with evidence, then edit. Write a rough draft first and polish it afterwards.'),
    E('study_examday', ['exam day tips', 'what to do on exam day', 'how to stay calm in an exam', 'i am nervous about my exam'], 'On exam day sleep well, eat something light, arrive early and read all the questions first. Start with the ones you know, watch the time, and review your answers at the end. Slow breathing helps with nerves.'),
    E('study_schedule', ['how do i make a study timetable', 'study schedule tips', 'how to plan my study time', 'how many hours should i study'], 'List subjects by exam date and difficulty, give hard subjects more sessions, and plan short blocks of 25 to 50 minutes with breaks. Review old topics regularly and keep one free slot each week for catching up.'),
    E('study_reading', ['how do i read a textbook', 'reading comprehension tips', 'how to read faster', 'how to remember what i read'], 'Skim the headings first, turn them into questions, read to answer them, then close the book and recite the key points. Reviewing within a day helps it stick.'),
    // ---- More coding and servers ----
    E('dev_cors', ['what is cors', 'cors error', 'blocked by cors policy', 'how do i fix cors'], 'CORS is a browser rule that stops a page from calling another site unless that server allows your page\'s origin in its response headers. Fix it on the server by allowing your site\'s origin, not in the front-end code.'),
    E('dev_mixed', ['mixed content error', 'https page cannot call http', 'why is my api blocked on https', 'blocked mixed content'], 'Browsers block an https page from calling a plain http address. Serve your API over https, or forward the calls through your https site with a proxy rewrite.'),
    E('dev_api', ['what is an api', 'what is a rest api', 'how do apis work', 'explain api'], 'An API is a set of addresses a program can call to get or change data. The page sends a request such as GET /api/tasks and the server answers, usually with JSON.'),
    E('dev_discord', ['tips for discord bots', 'how do i make a discord bot', 'discord bot best practices', 'my discord bot keeps crashing'], 'Use slash commands, keep the bot token in an environment variable, handle errors so one bad command does not crash the bot, respect rate limits, and log errors somewhere you can read.'),
    E('dev_plugin', ['how do i make a minecraft plugin', 'minecraft plugin tips', 'plugin development tips', 'spigot paper plugin help'], 'Use the official API for your server software, keep slow work like files and databases off the main thread, and test on a local server before production. Read the console log for errors first.'),
    E('dev_lag', ['my server is lagging', 'how do i fix lag', 'server performance tips', 'why is my server slow'], 'Check CPU and RAM use, run a profiler or timings report to find the heavy part, update or remove costly plugins, limit loaded chunks and entities, and change one thing at a time.'),
    E('dev_backup', ['how do i back up my server', 'backup tips', 'how often should i backup', 'backup strategy'], 'Keep several copies: automatic backups on a schedule, one stored off the machine, and test restoring them now and then. Back up before every update.'),
    E('dev_keepalive', ['how do i keep my node app running', 'how to run a server forever', 'my app stops when i close the terminal', 'pm2 or systemd'], 'Use a process manager such as pm2 or a systemd service so the app restarts after crashes and reboots, and check the logs when it does.'),
    E('dev_env', ['what are environment variables', 'how do i use env files', 'where do i put api keys', 'how to hide secrets'], 'Environment variables hold settings and secrets outside your code, for example in a .env file that is never committed to git. The program reads them when it starts.'),
    E('dev_testing', ['how do i test my code', 'how to write tests', 'testing tips', 'what is unit testing'], 'Test the small parts first (unit tests), then the main flows. Write a test that reproduces a bug before you fix it, and run the tests before every deploy.'),
    E('dev_readme', ['how do i write a readme', 'readme tips', 'how to document my project'], 'A good readme says what the project does, how to install and run it, an example of use, and how to contribute. Keep it short and update it when things change.'),
    E('dev_webbasics', ['what is html css and javascript', 'how do websites work', 'frontend vs backend', 'what is the difference between frontend and backend'], 'HTML is the structure of a page, CSS is the style and JavaScript is the behavior. The front end runs in the browser; the back end runs on a server and handles data, saving and secrets.'),
    // ---- More habits ----
    E('tip_phone', ['i am addicted to my phone', 'how do i stop scrolling', 'phone distracts me', 'social media distraction'], 'Put the phone in another room while you work, turn off non-essential notifications, and use app limits. Decide in advance when you will check it.'),
    E('tip_deepwork', ['what is deep work', 'how do i do deep work', 'long focus sessions', 'how to work without interruptions'], 'Deep work means a long block of focus on one demanding task with no interruptions. Schedule it at your best time of day, close other tabs, and keep a list for stray thoughts.'),
    E('tip_energy', ['when should i study', 'best time of day to work', 'morning or night for studying', 'how do i find my peak hours'], 'Use your peak-energy hours for hard work. Many people focus best in the morning, but it varies, so notice when you focus best for a week and plan around it.'),
    E('tip_no', ['how do i say no', 'i take on too much', 'how to manage workload', 'i am doing too many things'], 'Check your list before accepting new work, offer a later date or a smaller version, and drop tasks that no longer matter. Fewer commitments done well beat many half-done.'),

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

// ===== 2. TRAINING =====
// JALTRON training data. Edit this file to teach the AI new phrases, then redeploy.
// {slots} are filled with random words from "slots" so one template makes many examples.
// Question/answer knowledge lives in knowledge.js. This file covers actions on your tasks.
// Intents: add complete delete reopen prio due tag search breakdown focus plan first summary overdue
//          undo optimize clear_done complete_all help greet thanks motivate chat research unknown
//          deposit withdraw balance (fake bank — the regex cascade answers exact phrasing, the net catches fuzzy ones)
(function (root) {
  root.TRAIN = {
    slots: {
      task: ['fix login bug', 'study math', 'read chapter 3', 'call mom', 'write the report', 'deploy the plugin', 'clean my room', 'finish homework', 'update the server', 'buy milk', 'revise biology', 'build the navbar', 'test the api', 'practice guitar', 'pay hosting bill', 'backup the world', 'code the dashboard', 'email the teacher', 'fix lag issue', 'learn javascript', 'submit the assignment', 'prepare the presentation', 'review pull requests', 'set up the database', 'write unit tests', 'design the logo', 'plan the event', 'organize my notes', 'refactor the code', 'update the website', 'renew the domain', 'fix the crash', 'study for the exam', 'do the laundry', 'go to the gym', 'book the appointment', 'make a discord bot', 'add the whitelist', 'configure geyser', 'write the essay', 'clean the desk', 'check the logs', 'reply to messages', 'record the video', 'publish the update', 'fix the spawn bug', 'learn python', 'read the article', 'cook dinner', 'buy groceries', 'walk the dog', 'finish the project', 'practice coding', 'create the poster', 'update the readme', 'test the plugin', 'fix the css', 'solve the worksheet', 'plan the week', 'pay the bills'],
      when: ['tomorrow', 'today', 'friday', 'monday', 'tuesday', 'wednesday', 'thursday', 'saturday', 'sunday', 'next week', 'in 3 days', 'in 2 days', 'in 5 days', 'tmrw', 'tmr', '2026-10-25', '2026-11-02'],
      cat: ['study', 'dev', 'bug', 'general'],
      money: ['5', '10', '20', '25', '50', '75', '100', '250', '500', '1000'],
      subject: ['study', 'work', 'coding', 'homework', 'project', 'exam', 'server'],
      topic: ['france', 'the moon', 'photosynthesis', 'the telephone', 'mount everest', 'the eiffel tower', 'world war 2', 'black holes', 'jupiter', 'the amazon river']
    },
    templates: {
      add: ['add {task}', 'add {task} {when}', 'add {task} high priority', 'add task {task} low priority {when}', 'remind me to {task} {when}', 'i need to {task}', 'i gotta {task} {when}', 'i have to {task} before {when}', 'put {task} on my list', 'new task: {task}', 'create a task for {task}', 'add a task for my {subject}', 'make a task to {task}', 'dont let me forget to {task}', 'todo {task} {when}', 'i should {task}', 'i must {task} {when}', 'schedule {task} for {when}', 'note down {task}', 'add {task} to my plan', 'add a {subject} task', 'i want to {task} {when}', 'can you add {task}', 'please add {task} urgent', 'add {task} and {task}', 'create task {task} #{cat}'],
      complete: ['i finished {task}', 'done with {task}', '{task} is done', 'mark {task} as complete', 'tick off {task}', 'just completed {task}', 'finished {task} lol', 'i already did {task}', '{task} done!', 'check off {task}', 'completed {task}', 'i did {task}', 'got {task} done', '{task} finished', 'i am done with {task}', 'wrapped up {task}', 'that is done: {task}', 'mark {task} done'],
      delete: ['delete {task}', 'remove {task} from my list', 'get rid of {task}', 'cancel {task}', 'drop {task}', 'i dont need {task} anymore', 'trash {task}', 'erase the {task} task', 'forget about {task}', 'take {task} off my list', 'remove the task {task}', 'nuke {task}', 'scrap {task}', 'i changed my mind about {task}'],
      reopen: ['reopen {task}', 'i did not finish {task}', 'undo complete {task}', '{task} is not done yet', 'bring back {task}', 'uncheck {task}', 'mark {task} as not done', 'i still need to {task}', 'restore {task}', '{task} is not finished'],
      prio: ['make {task} urgent', 'set {task} to high priority', '{task} is super important', '{task} is not important', 'lower the priority of {task}', '{task} can wait, make it low', '{task} is critical', 'raise priority of {task}', '{task} is medium priority', 'make {task} high priority', '{task} is urgent', 'set {task} priority to low', 'bump up {task}', 'deprioritize {task}', '{task} is not a big deal'],
      due: ['move {task} to {when}', 'postpone {task} to {when}', 'change the deadline of {task} to {when}', '{task} is due {when}', 'push {task} to {when}', 'reschedule {task} for {when}', 'delay {task} until {when}', 'set {task} due {when}', 'i need {task} done by {when}', 'make {task} due {when}', 'extend the deadline for {task} to {when}'],
      tag: ['tag {task} as {cat}', 'put {task} under {cat}', 'mark {task} as a {cat} task', 'change the category of {task} to {cat}', '{task} is a {cat} thing', 'move {task} to {cat}', 'set {task} category to {cat}', 'file {task} under {cat}'],
      search: ['find {task}', 'search for {task}', 'where is {task}', 'show me {task}', 'look for {task}', 'do i have {task}', 'find my {task} task', 'search {task}', 'is {task} on my list'],
      breakdown: ['break down {task}', 'how do i finish {task}', 'split {task} into steps', 'help me start {task}', 'steps for {task}', 'how should i approach {task}', 'give me steps to {task}', 'break {task} into smaller tasks', 'how do i tackle {task}'],
      focus: ['focus on {task}', 'start focus on {task}', 'start a focus session for {task}', 'start the timer for {task}', 'work on {task}', 'begin working on {task}', 'focus on my {subject} task', 'begin focus mode for {task}'],
      undo: ['undo', 'undo that', 'undo the delete', 'undo last delete', 'bring back the task i deleted', 'restore the deleted task', 'i deleted a task by mistake', 'put back what you deleted', 'undo removing the task'],
      plan: ['plan my day', 'what should i do today', 'make me a schedule', 'organise my day', 'whats the plan', 'give me a plan for today', 'help me plan', 'what is my agenda', 'plan my tasks', 'what is on my plate', 'what do i have to do', 'show me my plan', 'what is todo', 'order my tasks', 'whats on my list'],
      first: ['what should i do first', 'whats next', 'where do i start', 'what is most important', 'top priority?', 'what do i do now', 'which task first', 'what should i focus on', 'what is my next task', 'what to do next', 'tell me what to work on', 'pick a task for me', 'what is the most urgent thing'],
      summary: ['how am i doing', 'give me a summary', 'how many tasks do i have', 'progress report', 'show my stats', 'overview please', 'how much have i done', 'status', 'how r we doing', 'how am i doing with my tasks', 'am i making progress', 'how is my plan going', 'how many are left', 'how many done'],
      overdue: ['whats overdue', 'am i late on anything', 'which tasks are late', 'anything behind schedule', 'what did i miss', 'show late tasks', 'what is past due', 'do i have overdue tasks', 'am i behind'],
      optimize: ['optimize my plan', 'sort my tasks', 'reorder by priority', 'organize by importance', 'smart sort', 'rank my tasks', 'sort by priority', 'fix the order of my tasks', 'tidy up my list'],
      clear_done: ['clear completed', 'remove all done tasks', 'clean up finished tasks', 'delete completed tasks', 'get rid of done stuff', 'clear finished tasks', 'wipe done tasks'],
      complete_all: ['complete everything', 'mark all as done', 'finish all tasks', 'tick everything off', 'mark every task complete', 'all done'],
      deposit: ['deposit {money}', 'deposit {money} to the bank', 'add {money} to the bank', 'put {money} in my bank', 'add {money} dollars to bank', 'deposit {money} into my account', 'bank deposit {money}', 'i want to deposit {money}'],
      withdraw: ['withdraw {money}', 'withdraw {money} from the bank', 'take {money} from the bank', 'remove {money} from bank', 'subtract {money} from the bank', 'take out {money} from my bank', 'bank withdraw {money}', 'i want to withdraw {money}'],
      balance: ['whats my balance', 'how much money do i have', 'balance', 'bank balance', 'how much is in my bank', 'show my balance', 'how much money', 'my money', 'how much do i have in the bank'],
      help: ['what can you do', 'help', 'how do you work', 'show commands', 'what are your features', 'how do i use you', '?', 'commands', 'help me', 'what do you do'],
      greet: ['hi', 'hello', 'hey bro', 'yo', 'good morning', 'sup', 'hey there', 'hola', 'good evening', 'hey jaltron', 'hii', 'heyy', 'good afternoon', 'whats up', 'wsp', 'wassup', 'wazzup', 'whaddup', 'what is up', "what's up", 'whats good', 'howdy', 'howdy partner', 'hiya', 'heya', 'hey hey', 'yoo', 'yooo', 'yo yo', 'ello', 'hullo', 'greetings', 'salutations', 'g\'day', 'gm', 'good night', 'morning', 'evening', 'afternoon', 'how are you', 'how are you doing', 'how r u', 'hru', 'how is it going', 'hows it going', 'how you doing', 'whats going on', 'wyd', 'what are you up to', 'wsg', 'wsup', 'sup bro', 'sup dude', 'hey buddy', 'hey man', 'hello there', 'namaste', 'namaskar', 'salaam', 'bonjour', 'ciao', 'hey whats up', 'yo whats up', 'well hello', 'oi', 'ayo', 'ayyy', 'hi there', 'hello jaltron', 'long time no see', 'nice to meet you', 'anyone there', 'you there', 'are you there', 'ping'],
      thanks: ['thanks', 'thank you', 'thx', 'ty bro', 'cheers', 'appreciate it', 'nice one', 'great job', 'awesome thanks', 'perfect', 'you are the best', 'thanks a lot'],
      motivate: ['motivate me', 'i am tired', 'i cannot focus', 'i am stressed', 'i feel lazy', 'too many things to do', 'i am overwhelmed', 'i dont feel like working', 'i cant be bothered', 'no motivation today', 'i dont want to do anything', 'im burnt out', 'cant be bothered today', 'give me some motivation', 'i feel stuck', 'cheer me up'],
      chat: ['whats the weather', 'i am bored', 'sing a song', 'do you like pizza', 'what is your favorite color', 'are you human', 'what is the meaning of life', 'translate hello to spanish', 'recipe for pasta', 'what is the news today', 'play some music', 'what is bitcoin worth', 'how old are you', 'do you have feelings', 'write me a poem', 'tell me a story', 'best football team'],
      research: ['what is {topic}', 'what is the capital of {topic}', 'who is {topic}', 'who invented {topic}', 'how tall is {topic}', 'how far is {topic}', 'what is the population of {topic}', 'tell me about {topic}', 'define {topic}', 'when did {topic} happen', 'where is {topic}', 'why is {topic} famous', 'what is {topic} known for', 'how big is {topic}', 'who won the world cup', 'who is the president', 'who is the prime minister', 'what is the tallest building', 'who is the richest person', 'how many people live in {topic}', 'how old is {topic}'],
      unknown: ['asdf', 'qwerty', 'blah blah', 'hmm', 'ok', 'lol', 'idk', '...', 'hmmmm', 'k', 'test', 'umm', 'what', 'huh', 'asdfgh', 'zzz', 'ok ok', 'hmm ok']
    },
    // Extra hand-written examples: ["phrase", "intent"]
    examples: [
      ["what's next?", 'first'], ["plan my day pls :)", 'plan'], ["hi!!!", 'greet'], ["thanks!!", 'thanks'],
      ["knock out the biology revision", 'add'], ["what's on my plate", 'plan'], ["i'm done with the login thing", 'complete'],
      ["nuke the old milk task", 'delete'], ["wat should i do", 'first'], ["tmrw i must study", 'add'],
      ["yo whats good", 'greet'], ["got it, thx", 'thanks'], ["any tasks left?", 'summary'], ["what's late??", 'overdue'],
      ["what is the capital of france", 'research'], ["who was alan turing", 'research'],
      ["tell me about black holes", 'research'], ["define photosynthesis", 'research'],
      ["how tall is mount everest", 'research'], ["what is the population of india", 'research'],
      ["who invented the telephone", 'research'], ["where is the eiffel tower", 'research']
    ]
  };

  // Extra natural phrasings, kept separate so the dataset is easy to grow.
  (function (T) {
    const add = (intent, list) => { T.templates[intent] = (T.templates[intent] || []).concat(list); };
    T.slots.task = T.slots.task.concat(['clean the kitchen', 'fix the roof', 'learn react', 'update my resume', 'call the dentist', 'buy a gift', 'plan the trip', 'write the blog', 'study history', 'practice piano', 'send the invoice', 'book tickets', 'repair the bike', 'organize photos', 'apply for jobs', 'finish the course', 'test the app', 'design a banner', 'read a book', 'water the plants']);
    add('add', ['i need to get {task} done', 'remind me about {task}', 'jot down {task}', 'put {task} on my schedule', '{task} needs doing', 'remember that i need to {task}', 'i have a new task: {task}', 'put {task} into my todo', 'i should probably {task}', 'get {task} on my list']);
    add('complete', ['{task} is all done', 'ive done {task}', 'i have done {task}', 'cross {task} off', 'mark {task} off my list', '{task} is complete now', "i'm through with {task}", 'just wrapped up {task}', 'i got {task} finished', '{task} has been finished']);
    add('delete', ["i don't need {task} anymore", 'i do not need {task}', '{task} is no longer needed', 'get {task} off my list', "i'm not doing {task} anymore", 'remove {task} completely', '{task} can go', 'throw away the {task} task', 'take {task} out of my plan']);
    add('reopen', ["{task} isn't done", "i didn't do {task}", '{task} still needs doing', 'put {task} back on my list', '{task} is not complete yet', 'unfinish {task}', '{task} was never finished']);
    add('prio', ['{task} matters most', '{task} is top priority', '{task} is not important right now', 'make {task} less urgent', 'bump {task} down', 'lower {task} priority', '{task} is high on my list', '{task} is a high priority item']);
    add('due', ['{task} needs to be done by {when}', 'give {task} a deadline of {when}', 'set {task} for {when}', 'make the deadline for {task} {when}', "{task}'s deadline is {when}", '{task} has to be finished by {when}']);
    add('tag', ['{task} belongs in {cat}', 'make {task} a {cat} task', 'put {task} in the {cat} category', '{task} should be tagged {cat}']);
    add('search', ['do i have a task about {task}', 'where did {task} go', 'look up {task}', 'find anything about {task}', 'is there a task for {task}']);
    add('breakdown', ['{task} is too big, break it down', 'help me break {task} into steps', 'where do i start with {task}', '{task} needs smaller steps', 'i am stuck on {task}', 'help me get started on {task}']);
    add('focus', ["let's focus on {task}", "i'm going to work on {task}", 'start a timer for {task}', 'focus session for {task}', 'put me in focus mode for {task}', 'start working on {task}']);
    add('plan', ['what should i get done today', 'give me a game plan for today', 'how should i spend today', 'map out my day', "what's the best order", 'help me get organised']);
    add('first', ['what do i tackle first', 'which one should i start with', "what's the highest priority", 'where should i begin', 'what deserves my attention']);
    add('summary', ['how much progress have i made', 'quick status update', "what's my progress", 'how many tasks are done', 'give me the numbers', 'where do i stand']);
    add('overdue', ['anything past due', "what's late", 'am i missing any deadlines', 'anything behind', 'what slipped']);
    add('optimize', ['put my tasks in a smart order', 'make a sensible order', 'prioritize my list', 'arrange my tasks properly']);
    add('clear_done', ['delete everything i finished', 'clear the done list', 'remove completed items', 'clean out the completed tasks']);
    add('complete_all', ['check everything off', 'finish everything', 'mark the whole list done', 'complete the entire list']);
    add('motivate', ["i'm exhausted", 'i have no energy', "i can't get started", 'i need a push', 'i keep procrastinating', 'i am losing focus']);
    add('research', ['what is {topic} famous for', 'give me info on {topic}', 'i want to learn about {topic}', 'what do you know about {topic}', 'can you explain {topic}', 'how big is {topic}', 'where is {topic} located', 'when was {topic} invented', 'why does {topic} happen', 'how does {topic} work']);
    add('unknown', ['i like pizza', 'what is love', 'the sky is blue', 'open the pod bay doors', 'i had a weird dream', 'my phone is broken', 'the quick brown fox', 'do a barrel roll']);
    T.examples.push(
      ["please get the report done by friday", 'due'], ["the essay needs to be finished by tomorrow", 'due'],
      ["i dont need the old domain anymore", 'delete'], ["remove that task about milk", 'delete'],
      ["i already finished the quiz", 'complete'], ["cross the laundry off", 'complete'],
      ["put the meeting back on my list", 'reopen'], ["the poster isnt done yet", 'reopen'],
      ["make the newsletter less urgent", 'prio'], ["the api is top priority", 'prio'],
      ["i want to get the dishes done", 'add'], ["jot down buy new headphones", 'add'],
      ["where did the invoice task go", 'search'], ["i am stuck on the landing page", 'breakdown'],
      ["lets start working on the thesis", 'focus'], ["map out tomorrow for me", 'plan'],
      ["what deserves my attention first", 'first'], ["where do i stand with my tasks", 'summary'],
      ["what slipped through the cracks", 'overdue'], ["arrange my tasks properly", 'optimize'],
      ["clean out everything i finished", 'clear_done'], ["mark the whole list done", 'complete_all'],
      ["i keep procrastinating", 'motivate'], ["i like pizza", 'unknown'],
      ["open the pod bay doors", 'unknown'], ["the sky is blue", 'unknown']
    );
  })(root.TRAIN);
})(typeof window !== 'undefined' ? window : globalThis);

// ===== 3. TINYBRAIN =====
// TinyBrain: a small neural network trained from scratch on characters.
// Text -> hashed character n-grams (letters, digits, special characters) -> hidden layer -> intent.
// No libraries, no downloads. It trains once in your browser, then saves its weights in
// localStorage so every later visit loads instantly and never trains again.
(function (root) {
  'use strict';
  const DIM = 4096, HID = 128, EPOCHS = 12, CHUNK = 300;
  const BASE = ['add', 'complete', 'delete', 'reopen', 'prio', 'due', 'tag', 'search', 'breakdown', 'focus', 'undo', 'plan', 'first', 'summary', 'overdue', 'optimize', 'clear_done', 'complete_all', 'help', 'greet', 'thanks', 'motivate', 'chat', 'research', 'deposit', 'withdraw', 'balance', 'unknown'];
  let INTENTS = BASE.slice(), K = INTENTS.length;
  let W1, b1, W2, b2, ready = false, seed = 1;
  // Words that carry no intent signal. Used by the evidence gate, not by the network.
  const STOP = new Set('a an the i me my you your we us is are am was were be been being do does did doing to of and or it its in on at for with from this that these those as can could would should will just please pls bro hey yo ok okay so if then than there here what which who whom whose how why when where all any some no not'.split(' '));
  let CUES = {}, SLOT_WORDS = new Set();
  const tok = (s) => String(s).toLowerCase().replace(/\{(\w+)\}/g, ' ').replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const stem = (w) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w);
  const sameWord = (a, b) => a === b || stem(a) === stem(b) || (a.length > 3 && b.startsWith(a)) || (b.length > 3 && a.startsWith(b));

  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const norm = (t) => ' ' + String(t).toLowerCase().replace(/\d+/g, '0').replace(/\s+/g, ' ').trim() + ' ';
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % DIM; }

  // Character n-grams (1 to 4) plus whole words, hashed into DIM slots
  function feats(text) {
    const s = norm(text), set = new Set();
    for (let n = 1; n <= 4; n++) for (let i = 0; i + n <= s.length; i++) set.add(hash(n + s.slice(i, i + n)));
    for (const w of s.split(' ')) if (w) set.add(hash('w' + w));
    return Array.from(set);
  }

  // ---- Learned phrases (self-training) ----
  // Every phrase the rule layer understands is saved here, so the net can learn how this
  // person actually talks. Kept small and deduped; n counts how often it was reinforced.
  const store = typeof localStorage !== 'undefined' ? localStorage : null;
  const LEARN_KEY = 'jc:learn';
  let LEARN = [];
  try {
    const saved = JSON.parse((store && store.getItem(LEARN_KEY)) || '[]');
    if (Array.isArray(saved)) LEARN = saved.filter(e => e && e.t && e.i).slice(-600).map(e => ({ t: String(e.t).slice(0, 160), i: String(e.i), n: Math.min(5, Number(e.n) || 1) }));
  } catch {}

  // The network alone is overconfident: it always names some intent. The evidence index
  // (command words from the templates plus learned phrases) lets it say "none of these".
  function addCue(intent, list) { const set = CUES[intent] || (CUES[intent] = new Set()); for (const w of list) set.add(w); }
  function buildCues(cfg) {
    CUES = {}; SLOT_WORDS = new Set();
    for (const vals of Object.values(cfg.slots || {})) for (const v of vals) for (const w of tok(v)) SLOT_WORDS.add(stem(w));
    for (const [intent, list] of Object.entries(cfg.templates || {})) for (const t of list) addCue(intent, tok(t));
    const fromPhrase = (t, intent) => addCue(intent, tok(t).filter(w => !SLOT_WORDS.has(stem(w))));
    for (const [t, i] of cfg.examples || []) fromPhrase(t, i);
    for (const e of LEARN) fromPhrase(e.t, e.i);
    const df = {};
    for (const set of Object.values(CUES)) for (const w of set) df[stem(w)] = (df[stem(w)] || 0) + 1;
    const limit = Math.max(4, Math.ceil(Object.keys(CUES).length * 0.35));
    for (const set of Object.values(CUES)) for (const w of [...set]) if (df[stem(w)] > limit) set.delete(w);
  }
  function support(text, intent) {
    const set = CUES[intent];
    if (!set) return 0;
    let hits = 0;
    for (const w of tok(text)) { for (const c of set) if (sameWord(w, c)) { hits++; break; } }
    return hits;
  }

  function init() {
    W1 = new Float32Array(DIM * HID).map(() => (rnd() - 0.5) * 0.2);
    W2 = new Float32Array(K * HID).map(() => (rnd() - 0.5) * 0.4);
    b1 = new Float32Array(HID); b2 = new Float32Array(K);
  }
  function forward(ix, T) {
    const sc = 1 / Math.sqrt(ix.length || 1), h = new Float32Array(HID), z = new Float32Array(K);
    for (const i of ix) { const o = i * HID; for (let j = 0; j < HID; j++) h[j] += W1[o + j] * sc; }
    for (let j = 0; j < HID; j++) h[j] = Math.tanh(h[j] + b1[j]);
    let mx = -1e9;
    for (let k = 0; k < K; k++) { let s = b2[k]; const o = k * HID; for (let j = 0; j < HID; j++) s += W2[o + j] * h[j]; s /= (T || 1); z[k] = s; if (s > mx) mx = s; }
    let sum = 0;
    for (let k = 0; k < K; k++) { z[k] = Math.exp(z[k] - mx); sum += z[k]; }
    for (let k = 0; k < K; k++) z[k] /= sum;
    return { h, p: z, sc };
  }
  function step(ix, y, lr) {
    const { h, p, sc } = forward(ix), dh = new Float32Array(HID);
    for (let k = 0; k < K; k++) {
      const g = p[k] - (k === y ? 1 : 0), o = k * HID;
      for (let j = 0; j < HID; j++) { dh[j] += W2[o + j] * g; W2[o + j] -= lr * g * h[j]; }
      b2[k] -= lr * g;
    }
    for (let j = 0; j < HID; j++) { dh[j] *= 1 - h[j] * h[j]; b1[j] -= lr * dh[j]; }
    for (const i of ix) { const o = i * HID; for (let j = 0; j < HID; j++) W1[o + j] -= lr * dh[j] * sc; }
  }

  // Make typos, slang and special characters so the net copes with messy text
  function noisy(s) {
    let t = s;
    const r = rnd();
    if (t.length > 4) {
      const i = 1 + Math.floor(rnd() * (t.length - 2));
      if (r < 0.25) t = t.slice(0, i) + t.slice(i + 1);
      else if (r < 0.5) t = t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2);
      else if (r < 0.7) t = t.slice(0, i) + t[i] + t.slice(i);
    }
    if (rnd() < 0.3) t = pick(['bro ', 'pls ', 'hey ', 'yo ', 'ok ', 'can you ']) + t;
    if (rnd() < 0.3) t += pick([' lol', ' pls', '!', '?!', ' asap', ' :)', '...']);
    return t;
  }

  function build(cfg, extra) {
    const out = [], fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => pick(cfg.slots[k] || ['thing']));
    for (const [intent, list] of Object.entries(cfg.templates)) for (const t of list) {
      const reps = t.includes('{') ? 3 : 1;
      for (let r = 0; r < reps; r++) out.push([fill(t), intent, false]);
    }
    for (const k of root.KNOWLEDGE || []) for (const ph of k.phrases) for (let r = 0; r < 4; r++) out.push([ph, 'k_' + k.id, false]);
    for (const [t, i] of cfg.examples || []) for (let r = 0; r < 4; r++) out.push([t, i, false]);
    for (const e of LEARN) for (let r = 0; r < Math.min(2 + e.n * 2, 10); r++) out.push([e.t, e.i, true]);
    for (const e of extra || []) for (let r = 0; r < 8; r++) out.push([e.text, e.intent, true]);
    // Gibberish and special-character noise teach the net to say "I don't know"
    const L = 'abcdefghijklmnopqrstuvwxyz', SP = '!?#@$%&*()-_=+[]{};:/<>~';
    for (let n = 0; n < 70; n++) {
      let g = ''; const len = 2 + Math.floor(rnd() * 12);
      for (let c = 0; c < len; c++) g += rnd() < 0.15 ? SP[Math.floor(rnd() * SP.length)] : L[Math.floor(rnd() * 26)];
      out.push([g, 'unknown', false]);
    }
    const aug = [];
    for (const [t, i, tg] of out) if (rnd() < 0.6) aug.push([noisy(t), i, tg]);
    return out.concat(aug);
  }

  // ---- Saved-weights cache (localStorage) ----
  // The base net is saved and reused until TRAIN/KNOWLEDGE or the feature setup changes. Learned
  // phrases are NOT part of the key: they are replayed onto the cached weights instead, so a chat
  // that teaches the assistant something never forces a slow retrain on the next visit.
  const KEY = 'jc:nn', V = 3;
  const sig = (x) => { const s = JSON.stringify(x); let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const fp = (extra) => [V, DIM, HID, EPOCHS, sig(root.TRAIN || {}), sig(root.KNOWLEDGE || []), sig(extra || [])].join('.');
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const ub64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const f32b = (f) => b64(new Uint8Array(f.buffer, f.byteOffset, f.byteLength));
  const b2f = (s) => new Float32Array(ub64(s).buffer);
  function save(fpKey, r) {
    if (!store) return;
    try {
      // W1 is the big one: quantize to 1 byte per weight so the whole model fits in localStorage
      let mx = 0; for (let i = 0; i < W1.length; i++) { const a = Math.abs(W1[i]); if (a > mx) mx = a; }
      const sc = mx / 127 || 1, q1 = new Uint8Array(W1.length);
      for (let i = 0; i < W1.length; i++) { const v = Math.round(W1[i] / sc) + 128; q1[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
      store.setItem(KEY, JSON.stringify({ fp: fpKey, ex: r.examples, acc: r.acc, sc, w1: b64(q1), b1: f32b(b1), w2: f32b(W2), b2: f32b(b2), I: INTENTS }));
    } catch { /* quota full or storage blocked: train again next time */ }
  }
  function load(fpKey) {
    if (!store) return null;
    try {
      const c = JSON.parse(store.getItem(KEY) || 'null');
      if (!c || c.fp !== fpKey) return null;
      const q1 = ub64(c.w1 || '');
      if (q1.length !== DIM * HID) return null;
      INTENTS = Array.isArray(c.I) ? c.I : BASE; K = INTENTS.length;
      b1 = b2f(c.b1 || ''); W2 = b2f(c.w2 || ''); b2 = b2f(c.b2 || '');
      if (b1.length !== HID || W2.length !== K * HID || b2.length !== K) return null;
      W1 = new Float32Array(DIM * HID);
      for (let i = 0; i < W1.length; i++) W1[i] = (q1[i] - 128) * (c.sc || 1);
      ready = true;
      // Learned phrases stay out of the cache key, so apply them to the loaded weights here.
      // A handful of SGD steps per phrase is milliseconds, versus a full retrain of the base set.
      for (const e of LEARN) {
        const y = INTENTS.indexOf(e.i);
        if (y < 0) continue;
        const ix = feats(e.t), passes = 2 + Math.min(e.n, 3);
        for (let i = 0; i < passes; i++) step(ix, y, 0.12);
      }
      return { examples: c.ex || 0, acc: c.acc || 0, learned: LEARN.length };
    } catch { return null; }
  }

  // Fold one labeled phrase into the model. The example is saved immediately (so it joins
  // the next full training run) and the live weights get a few SGD steps right away.
  function learn(text, intent, weight) {
    const t = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (t.length < 3 || t.length > 160 || !BASE.includes(intent)) return false;
    let e = LEARN.find(x => x.t === t);
    const isNew = !e;
    if (e) {
      // A new label wins, so corrections survive the next full training run.
      if (e.i === intent) e.n = Math.min(5, e.n + 1);
      else { e.i = intent; e.n = weight === 2 ? 2 : 1; }
    } else {
      if (LEARN.length >= 600) LEARN.shift();
      e = { t, i: intent, n: weight === 2 ? 2 : 1 };
      LEARN.push(e);
    }
    for (const w of tok(t)) if (!SLOT_WORDS.has(stem(w))) addCue(intent, [w]);
    try { if (store) store.setItem(LEARN_KEY, JSON.stringify(LEARN)); } catch {}
    if (ready) {
      const ix = feats(t), y = INTENTS.indexOf(intent);
      if (y >= 0) {
        const passes = 4 + Math.min(e.n, 3);
        for (let i = 0; i < passes; i++) step(ix, y, i < 3 ? 0.2 : 0.08);
      }
    }
    return isNew;
  }
  const learned = () => LEARN.length;

  // Yield to the page between batches. MessageChannel is not throttled, so training keeps
  // running even in a hidden tab, where setTimeout would be slowed to about once a minute.
  const tick = typeof MessageChannel !== 'undefined'
    ? () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); })
    : () => new Promise((r) => setTimeout(r, 0));
  const evalHold = (hold) => { let ok = 0; for (const d of hold) { const p = forward(d.ix).p; if (p.indexOf(Math.max(...p)) === d.y) ok++; } return hold.length ? ok / hold.length : 1; };

  async function train(extra, onProgress) {
    const fpKey = fp(extra);
    seed = 7; ready = false;
    INTENTS = BASE.concat((root.KNOWLEDGE || []).map(k => 'k_' + k.id)); K = INTENTS.length;
    buildCues(root.TRAIN || {}); // the gate needs the template command words on every visit
    const hit = load(fpKey); // previous visit: the saved weights load instantly
    if (hit) return hit;
    init();
    const raw = build(root.TRAIN, extra), all = [];
    for (let i = 0; i < raw.length; i++) { const y = INTENTS.indexOf(raw[i][1]); if (y >= 0) all.push({ ix: feats(raw[i][0]), y, tg: raw[i][2] }); if (i % 600 === 599) await tick(); }
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const hold = [], tr = [];
    for (const d of all) (!d.tg && hold.length < all.length * 0.12 ? hold : tr).push(d);
    let acc = 0, best = 0, stale = 0;
    for (let ep = 0; ep < EPOCHS; ep++) {
      const lr = 0.6 * (1 - ep / (EPOCHS * 1.2));
      for (let i = tr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tr[i], tr[j]] = [tr[j], tr[i]]; }
      for (let i = 0; i < tr.length; i++) { step(tr[i].ix, tr[i].y, lr); if (i % CHUNK === CHUNK - 1) await tick(); }
      acc = evalHold(hold);
      // stop early once the holdout score stops moving, instead of grinding the last epochs
      if (acc > best + 0.002) { best = acc; stale = 0; } else if (++stale >= 2 && ep >= 7 && acc >= 0.9) break;
      if (onProgress) onProgress(ep + 1, EPOCHS);
      await tick();
    }
    ready = true;
    const r = { examples: all.length, acc, learned: LEARN.length };
    save(fpKey, r);
    return r;
  }

  function predict(text) {
    if (!ready) return null;
    const p = forward(feats(text), 2.5).p; // temperature keeps confidence honest
    let b = 0, second = -1;
    for (let k = 1; k < K; k++) if (p[k] > p[b]) b = k;
    for (let k = 0; k < K; k++) if (k !== b && (second < 0 || p[k] > p[second])) second = k;
    return { intent: INTENTS[b], conf: p[b], margin: p[b] - (second >= 0 ? p[second] : 0), support: support(text, INTENTS[b]) };
  }

  const api = { get INTENTS() { return INTENTS; }, train, predict, learn, learned, support, get ready() { return ready; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TinyBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);

// ===== 4. BRAIN =====
(function () {
// JALTRON's built-in assistant: no API, no LLM. Task commands run locally and return { reply, actions }
// that the web UI executes (add, complete, delete, priority, clear, optimize, filter).

const W = { high: 3, medium: 2, low: 1 };
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const days = (d) => Math.round((new Date(d + 'T00:00') - new Date(dateStr() + 'T00:00')) / 864e5);
const nextDay = (n) => { const i = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(n.toLowerCase()); return dateStr(((i - new Date().getDay() + 7) % 7) || 7); };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const cats = () => (window.CATS ? CATS() : ['Dev', 'Bug', 'Study', 'General']);
const catOf = (s) => { const x = String(s).trim().toLowerCase(); return cats().find(c => c.toLowerCase() === x || c.toLowerCase() + 's' === x) || null; };
const customIn = (s) => cats().slice(4).find(c => (' ' + s.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(' ' + c.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ')) || '';

const clean = (t) => ({
  id: Number(t.id) || 0, title: String(t.title || '').slice(0, 140),
  prio: W[t.prio] ? t.prio : 'medium',
  tag: (window.CATS ? CATS() : ['Dev', 'Bug', 'Study', 'General']).includes(t.tag) ? t.tag : 'General',
  due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '', done: !!t.done,
  r: ['d', 'wd', 'we', 'w'].includes(t.r) ? t.r : '', s: Number(t.s) || 0, b: Number(t.b) || 0, l: /^\d{4}-\d{2}-\d{2}$/.test(t.l || '') ? t.l : ''
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

function stripLead(s) {
  let t = String(s).trim(), prev;
  const re = /^(?:hey\s+jaltron|hey|hi|hello|yo|bro|bruh|dude|man|mate|buddy|ok(?:ay)?|so|well|also|and|then|pls|plz|please|kindly|jaltron|can you|could you|would you|will you|can u|could u|i want you to|i need you to|go ahead and|just)\b[\s,.:!-]*/i;
  do { prev = t; t = t.replace(re, ''); } while (t !== prev);
  return t;
}
const TAG_WORDS = {
  Bug: /\b(bug|bugs|crash|crashes|error|errors|broken|glitch|exception|lag|laggy|issue|issues|fix|fixes)\b/i,
  Study: /\b(study|studying|exam|exams|quiz|homework|assignment|revise|revision|chapter|lecture|class|essay|learn|read|physics|chemistry|biology|math|maths|history|geography|science|english|syllabus|notes)\b/i,
  Dev: /\b(code|coding|build|implement|deploy|feature|plugin|plugins|api|script|server|website|bot|database|refactor|css|html|javascript|python|github|git|commit|minecraft|discord|update|test)\b/i
};
const GEN = { study: ['Study session', 'Study'], studies: ['Study session', 'Study'], studying: ['Study session', 'Study'], homework: ['Do homework', 'Study'], exam: ['Exam prep', 'Study'], exams: ['Exam prep', 'Study'], bug: ['Fix a bug', 'Bug'], bugs: ['Fix bugs', 'Bug'], coding: ['Coding session', 'Dev'], code: ['Coding session', 'Dev'], dev: ['Dev work', 'Dev'], work: ['Work task', 'General'] };

// Turns messy text like "bro pls add for physics exam its urgent" into { title, prio, tag, due }
function parseTask(raw) {
  let s = ' ' + stripLead(raw) + ' ', due = '', prio = 'medium', tag = '', m;
  s = s.replace(/^\s*(?:(?:add|create|make|put|new task|todo|note down|schedule|remind me to|remind me|i need to|i have to|i must|i should|i gotta|i want to|i wanna|lets|let's|dont forget to|don't forget to|dont let me forget to)\b\s*)+/i, ' ');
  s = s.replace(/^\s*(?:(?:a|an|new|the)\s+)?(?:task|todo|reminder|item)\b\s*/i, ' ');
  s = s.replace(/^\s*(?:to|for|about|on|called|named|:)\s+/i, ' ');
  s = ' ' + stripLead(s.trim()) + ' ';
  let rep = '';
  if ((m = s.match(/\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) { rep = 'w'; due = nextDay(m[1]); s = s.replace(m[0], ' '); }
  else if (/\b(?:every\s*day|each\s*day|everyday|daily)\b/i.test(s)) { rep = 'd'; s = s.replace(/\b(?:every\s*day|each\s*day|everyday|daily)\b/ig, ' '); }
  else if (/\b(?:every\s+weekend|on\s+weekends?)\b/i.test(s)) { rep = 'we'; s = s.replace(/\b(?:every\s+weekend|on\s+weekends?)\b/ig, ' '); }
  else if (/\b(?:every\s+week\s*day|on\s+weekdays|week\s*days?)\b/i.test(s)) { rep = 'wd'; s = s.replace(/\b(?:every\s+week\s*day|on\s+weekdays|week\s*days?)\b/ig, ' '); }
  else if (/\b(?:every\s+week|each\s+week|weekly)\b/i.test(s)) { rep = 'w'; s = s.replace(/\b(?:every\s+week|each\s+week|weekly)\b/ig, ' '); }
  const pre = '(?:by|due|before|until|till|for|on)?\\s*';
  if ((m = s.match(/\b(\d{4}-\d{2}-\d{2})\b/))) { due = m[1]; s = s.replace(m[0], ' '); }
  else if (/\b(?:tomorrow|tmrw|tmr|tmw)\b/i.test(s)) { due = dateStr(1); s = s.replace(new RegExp('\\b' + pre + '(?:tomorrow|tmrw|tmr|tmw)\\b', 'i'), ' '); }
  else if (/\b(?:today|tonight)\b/i.test(s)) { due = dateStr(0); s = s.replace(new RegExp('\\b' + pre + '(?:today|tonight)\\b', 'i'), ' '); }
  else if (/\bnext week\b/i.test(s)) { due = dateStr(7); s = s.replace(/\bnext week\b/i, ' '); }
  else if ((m = s.match(/\b(?:by|due|before|until|till|on|next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) { due = nextDay(m[1]); s = s.replace(m[0], ' '); }
  else if ((m = s.match(/\b(?:in|within)\s+(\d{1,2})\s+days?\b/i))) { due = dateStr(+m[1]); s = s.replace(m[0], ' '); }
  s = s.replace(/[!?]+/g, ' ');
  const low = /\b(?:not urgent|not important|low priority|no rush|whenever|chill)\b|\s(?:low)\s*$/i;
  const high = /\b(?:urgent|urgently|asap|critical|top priority|high priority|(?:very|super|really|extremely)\s+important|important)\b|\s(?:high)\s*$/i;
  if (low.test(s)) prio = 'low'; else if (high.test(s)) prio = 'high';
  s = s.replace(/\b(?:(?:its|it's|it is|this is|thats|that's|is|very|super|really|so|extremely|quite)\s+)*(?:not urgent|not important|low priority|no rush|whenever|chill|top priority|high priority|medium priority|urgently|urgent|asap|critical|(?:very|super|really|extremely)\s+important|important)\b/gi, ' ').replace(/\s(?:high|low|medium)\s*$/i, ' ');
  if ((m = s.match(/(?:category|tag|#)\s*([\w-]+)/i)) && catOf(m[1])) { tag = catOf(m[1]); s = s.replace(m[0], ' '); }
  else if (customIn(s)) tag = customIn(s);
  else if (TAG_WORDS.Bug.test(s)) tag = 'Bug';
  else if (TAG_WORDS.Study.test(s)) tag = 'Study';
  else if (TAG_WORDS.Dev.test(s)) tag = 'Dev';
  let t = s.replace(/\s+/g, ' ').trim(), prev;
  do { prev = t; t = t.replace(/\b(?:its|it's|it is|this is|thats|that's|is|and|but|because|so|by|due|on|for|at|as|with|before|until|till|to)\s*$/i, '').trim(); } while (t !== prev);
  t = t.replace(/^(?:a\s+|new\s+)?(?:task\s+)?(?:for|about|on|regarding)\s+(?:my\s+|the\s+)?/i, '').replace(/^my\s+/i, '').replace(/\s+tasks?$/i, '').replace(/^[^\w]+|[^\w)]+$/g, '').trim();
  const g = GEN[t.toLowerCase()];
  if (g) { t = g[0]; tag = g[1]; }
  return { title: cap(t).slice(0, 140), prio, tag: tag || 'General', due, rep };
}

const FAQ = [
  [/on-?device|real ai|llm|language model|which model/, 'I work in two layers: fast built-in commands for exact requests, and an optional on-device AI model (tap "Enable real AI" in this chat) that understands free-form requests. It runs in your browser, so your tasks are not sent to any AI service.'],
  [/drag|reorder|move (a )?task/, 'Drag a task up or down in the All view to reorder it. Dragging is off while a search or filter is active.'],
  [/edit|rename|change (the )?(name|title)/, 'Double-click a task title, or press the pencil button. Enter saves and Esc cancels.'],
  [/undo|restore|deleted by mistake/, 'After you delete a task, an Undo button appears for a few seconds at the bottom, or say "undo" in chat.'],
  [/search|shortcut|keyboard|hotkey/, 'Press / anywhere to jump to the search box. You can also filter by category next to it.'],
  [/optimi[sz]|score|rank/, 'The optimizer ranks open tasks by priority, deadline pressure (overdue counts most) and category (bugs get a boost), then puts completed tasks last.'],
  [/dark|light|theme|mode/, 'Open Settings and pick Light, Dark or System, or use the moon or sun button in the header. Your choice is saved.'],
  [/save|persist|lost|refresh|storage|backup/, 'Sign in with Google and tasks save to your account. Signed out, they reset on refresh.'],
  [/status|online|offline|demo/, 'Header status: TRAINING means the neural AI is still learning in your browser. AI READY means it is trained.'],
  [/repeat|recurring|habit|streak/, 'Pick Repeat (Daily, Weekdays or Weekly) when you add or edit a task, or say "add gym daily". Finish it each scheduled day to grow its streak; it reopens by itself for the next round, and missing a day resets the streak. Charts and streaks are in Insights.'],
  [/categor|tag/, () => window.catReply()],
  [/due|deadline|date/, 'Set a due date when adding a task. Badges show Due today, Due tomorrow or how many days overdue. You can tell me too: "add pay hosting tomorrow".']
];

const ADD_RE = /^(?:please\s+|pls\s+|can you\s+|could you\s+)?(?:add|create|put|new task|todo|remind me to|i need to|i have to|i must|i should|i gotta|lets|let's)\b\s*(?:a\s+|an\s+|new\s+)?(?:task\s*)?(?:to\s+|called\s+|named\s+|:)?\s*(.+)$/i;
const SPLIT_RE = /\s*(?:,|;|\bthen\b|\balso\b)\s*|\s+and\s+(?=(?:add|fix|study|read|learn|finish|write|build|call|buy|do|make|clean|review|prepare|practice)\b)/i;
const LIST_TAIL = /\s+(?:to|on|in|into)\s+(?:my\s+)?(?:list|plan|tasks?|to-?do(?: list)?)$/i;
const ASK_TITLE = 'What should the task say? Try "add fix login bug tomorrow high".';
// Fake bank phrases. "add N to bank" must die here, or ADD_RE turns it into a task.
const BANK_DEP_RE = /^(?:deposit\s+\$?\s*([\d,]+)|(?:add|put)\s+\$?\s*([\d,]+)\s*(?:dollars?|bucks?)?\s*(?:(?:to|into|in)\s+(?:the\s+|my\s+)?)?(?:bank|account|wallet))\s*$/i;
const BANK_WD_RE = /^(?:withdraw\s+\$?\s*([\d,]+)\s*(?:dollars?|bucks?)?\s*(?:(?:from|of)\s+(?:the\s+|my\s+)?)?(?:bank|account|wallet)?|(?:take(?:\s+out)?|remove|subtract)\s+\$?\s*([\d,]+)(?:\s+out)?\s*(?:dollars?|bucks?)?\s*(?:from|of)\s+(?:the\s+|my\s+)?(?:bank|account|wallet))\s*$/i;
const say = (reply, actions = []) => ({ reply, actions });
const GREET_RE = /^(?:(?:well|hey|hi|oh|ok|okay|so)\s+)*(?:hi+|hello+|hullo|ello|hey+(?: (?:hey|there|bro|man|buddy|dude|jaltron|whats up|what's up))?|heya|hiya|yo+(?: yo)?|ayo+|ay+|oi|sup|wsp|wsup|wsg|wassup|wazzup|whaddup|whats up|what's up|what is up|whats good|whats going on|howdy(?: partner)?|hola|ciao|bonjour|namaste|namaskar|salaam|greetings|salutations|g'day|gm|morning|evening|afternoon|good (?:morning|afternoon|evening|night)|how (?:are|r) (?:you|u)(?: doing)?|hru|how you doing|how is it going|hows it going|wyd|what are you up to|long time no see|nice to meet you|anyone there|(?:are )?you there|ping)(?: (?:there|bro|man|buddy|dude|mate|jaltron|partner|everyone|all|today))*$/;

function respond(msg, tasksIn, history) {
  const tasks = (Array.isArray(tasksIn) ? tasksIn : []).slice(0, 500).map(clean).filter(t => t.title);
  const open = tasks.filter(t => !t.done).sort((a, b) => score(b) - score(a));
  const raw0 = String(msg || '').trim().replace(/[.!?]+$/, ''), l0 = raw0.toLowerCase();
  const m = stripLead(raw0) || raw0, l = m.toLowerCase();
  let r;

  if (!m) return say('Ask me something, for example "plan my day".');
  const hist = Array.isArray(history) ? history : [];
  let lastAi = '';
  for (let i = hist.length - 2; i >= 0; i--) if (hist[i] && hist[i].role === 'assistant') { lastAi = String(hist[i].content); break; }
  if (/^(?:cancel|never ?mind|forget it|no)$/.test(l) && /^(What should the task|This will delete all)/.test(lastAi)) return say('Okay, cancelled.');
  if (/^(?:yes|y|confirm|do it|sure)$/.test(l) && /^This will delete all/.test(lastAi)) return say('All tasks deleted.', [{ type: 'clear_all' }]);
  const pendingAdd = /^What should the task/.test(lastAi) && l.split(/\s+/).length <= 10 && !/^(plan|show|what|how|summary|help|overdue|break|optimi|complete|delete)/.test(l);
  if (GREET_RE.test(l0.replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()) && l0.split(/\s+/).length <= 6) {
    const open1 = open[0] ? ` You have ${open.length} open task${open.length > 1 ? 's' : ''}, and "${open[0].title}" is up first.` : ' Your plan is empty, so tell me what to add.';
    if (/how (are|r) (you|u)|hru|how is it going|hows it going|how you doing/.test(l0)) return say('Doing great, thanks for asking!' + open1);
    if (/what are you up to|wyd/.test(l0)) return say('Just keeping your plan in order.' + open1);
    if (/(anyone|you|are you) there|ping/.test(l0)) return say('I am here.' + open1);
    if (/good night/.test(l0)) return say('Good night! Rest well, your plan will be here tomorrow.');
    const hr = new Date().getHours(), part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const g = [part + '!', 'Hey!', 'Yo!', 'Howdy!', 'Hey there!', 'Hello!'];
    return say(g[Math.floor(Math.random() * g.length)] + open1 + ' Say "what can you do" for the full list.');
  }

  // Fake bank: matched before the task verbs so "add 50 to bank" moves money, not a new task
  if (window.Bank && (BANK_DEP_RE.test(m) || BANK_WD_RE.test(m) || /\bbalance\b|\bhow much money\b|\bmy money\b/.test(l))) {
    if (!window.DB || !DB.user) return say('The fake bank needs an account. Sign in with Google first.');
    const dep = m.match(BANK_DEP_RE), wd = dep ? null : m.match(BANK_WD_RE);
    if (dep || wd) {
      const n = Number(((dep || wd)[1] || (dep || wd)[2] || '').replace(/,/g, ''));
      if (!n || n > 1e6) return say('Give me a whole number from 1 to 1,000,000, like "add 50 to bank".');
      return say(`${dep ? 'Added' : 'Withdrew'} $${n.toLocaleString()} ${dep ? 'to' : 'from'} your fake bank.`, [{ type: dep ? 'deposit' : 'withdraw', n }]);
    }
    const s = Bank.snapshot();
    return say(`Your fake bank holds ${s.mine}.${s.pot ? ` A workspace pot you are in holds ${s.pot}.` : ''} Say "add 50 to bank" or "withdraw 20" to move money.`);
  }

  if (/\b(clear|remove|delete)\b.*\b(completed|done|finished)\b/.test(l)) {
    const n = tasks.filter(t => t.done && !t.r).length;
    return n ? say(`Cleared ${n} completed task${n > 1 ? 's' : ''}. Repeating tasks are kept.`, [{ type: 'clear_done' }]) : say('There are no completed tasks to clear.');
  }
  if ((r = m.match(/^(?:please\s+)?(?:make|set|change|mark)\s+(.+?)\s+(?:as\s+|to\s+)?(high|medium|low)(?:\s+priority)?$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Set "${t.title}" to ${r[2].toLowerCase()} priority.`, [{ type: 'prio', id: t.id, prio: r[2].toLowerCase() }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if (/^(?:complete|finish|mark)\s+(?:all|everything)(?:\s+tasks?)?(?:\s+(?:as\s+)?(?:done|complete|completed))?$/.test(l))
    return open.length ? say(`Marked all ${open.length} open tasks as done.`, [{ type: 'complete_all' }]) : say('Nothing is open right now.');
  if (/^(?:delete|remove|clear|wipe)\s+(?:all|everything)(?:\s+(?:my\s+)?tasks?)?$/.test(l))
    return tasks.length ? say(`This will delete all ${tasks.length} tasks. Reply "yes" to confirm.`) : say('Your plan is already empty.');
  if (/^(?:undo(?: that| this| the (?:last )?(?:delete|deletion|removal))?|bring back (?:the |my )?(?:last )?deleted task|restore (?:the |my )?deleted task|put (?:it|that) back)$/.test(l)
    || (/\bundo\b/.test(l) && /\b(?:delete|deleted|removal|removed)\b/.test(l))) {
    if (window.jaltron && jaltron.hasDeleted && !jaltron.hasDeleted()) return say('There is nothing to undo right now.');
    return say('Put your last deleted task back.', [{ type: 'undo' }]);
  }
  if ((r = m.match(/^(?:reopen|uncheck|restore)\s+(.+)$/i))) {
    const t = find(tasks.filter(x => x.done), r[1]);
    return t ? say(`Reopened "${t.title}".`, [{ type: 'reopen', id: t.id }]) : say(`I could not find a completed task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:rename|change)\s+(.+?)\s+to\s+(.+)$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Renamed "${t.title}" to "${cap(r[2].trim())}".`, [{ type: 'rename', id: t.id, title: cap(r[2].trim()) }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:tag|categori[sz]e|move|set)\s+(.+?)\s+(?:as|to|under|category)\s+(.+)$/i)) && catOf(r[2])) {
    const t = find(tasks, r[1]), c = catOf(r[2]);
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

  if (/\b(?:streaks?|habits?)\b/.test(l) && !/\b(?:how|explain|what is|why)\b/.test(l) && !ADD_RE.test(m)) {
    const hs = tasks.filter(t => t.r).map(t => ({ t, s: window.Habit ? Habit.streak(t) : t.s })).sort((a, b) => b.s - a.s);
    if (!hs.length) return say('You have no repeating tasks yet. Try \"add gym daily\" or \"add read every weekday\".');
    return say('Your streaks:\n' + hs.slice(0, 6).map(x => `- ${x.t.title}: ${x.s} in a row (best ${Math.max(x.t.b, x.s)})`).join('\n'));
  }
  // Focus must win over the greedy add pattern ("lets focus on math" is not a new task).
  if ((r = m.match(/^(?:please\s+)?(?:(?:lets|let'?s)\s+|(?:i'?m|i\s+will|i'?ll)\s+(?:going\s+to\s+)?)?(?:start\s+(?:a\s+)?focus(?:\s+session)?(?:\s+(?:on|for|with))?|start\s+(?:working|focusing)\s+on|focus(?:\s+(?:on|for))?|work\s+on|begin\s+(?:working|focusing)\s+on)\s+(.+)$/i))) {
    const t = find(open, r[1]);
    return t ? say(`Focus mode: "${t.title}". The timer is ready on the Focus page.`, [{ type: 'focus', id: t.id }]) : say(`I could not find an open task matching "${r[1]}".`);
  }
  if ((r = m.match(ADD_RE)) || pendingAdd) {
    const text = (r ? r[1] : m).replace(LIST_TAIL, '').trim();
    if (!text || /^(?:a\s+|new\s+)?tasks?$/i.test(text)) return say(ASK_TITLE);
    const added = text.split(SPLIT_RE).filter(x => x && x.trim().length > 1).slice(0, 8).map(parseTask).filter(p => p.title);
    if (!added.length) return say(ASK_TITLE);
    const REPW = { d: 'daily', wd: 'on weekdays', we: 'on weekends', w: 'weekly' };
    const fmt = (p) => `"${p.title}" (${p.prio}, ${p.tag}${p.due ? ', due ' + p.due : ''}${p.rep ? ', repeats ' + REPW[p.rep] : ''})`;
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
  if ((r = l.match(/^(?:show|filter)\s+(?:me\s+)?(?:only\s+)?(?:the\s+)?(.+?)(?:\s+tasks?)?$/)) && catOf(r[1]))
    return say('Done. Filter updated.', [{ type: 'filter', cat: catOf(r[1]) }]);
  if ((r = l.match(/^show\s+(?:me\s+)?(?:only\s+)?(?:the\s+)?(all|everything|pending|active|open|completed|done|finished|bugs?|dev|study|general)\b/))) {
    const k = r[1];
    const a = /^(all|everything)$/.test(k) ? { type: 'filter', status: 'all', cat: 'all' }
      : /^(pending|active|open)$/.test(k) ? { type: 'filter', status: 'pending' }
      : /^(completed|done|finished)$/.test(k) ? { type: 'filter', status: 'done' }
      : { type: 'filter', cat: k.startsWith('bug') ? 'Bug' : cap(k) };
    return say('Done. Filter updated.', [a]);
  }

  if (/^(?:summary|stats|overview|status)\b/.test(l) || /\b(?:progress|status of my|my (?:progress|status|tasks|stats)|how am i doing|how'?s my day|how r we doing|where do i stand|how many (?:tasks?|are (?:left|done))|how much have i done|am i making progress)\b/.test(l)) {
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
    return t ? say(`To finish "${t.title}":\n` + (STEPS[t.tag] || STEPS.General).map((s, i) => `${i + 1}. ${s}`).join('\n')) : say('Add a task first and I will break it down.');
  }
  if (/^(?:start|begin)\s+(?:a\s+)?focus(?:\s+session)?$/.test(l)) {
    return open.length ? say(`Focus mode: "${open[0].title}". The timer is ready on the Focus page.`, [{ type: 'focus', id: open[0].id }]) : say('Add a task first and I will start a focus session on it.');
  }
  if (/^(?:what(?:'s| is)?(?: the| today'?s)? (?:date|day)(?: today)?|what day is (?:it|today)|whats todays date)$/.test(l))
    return say('Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.');
  if (/^(?:plan|schedule|organi[sz]e|todo|to-do)\b/.test(l)
    || /\b(?:my (?:day|plan|agenda|tasks|schedule|list|plate)|the plan|game plan|best order)\b/.test(l)
    || /^(?:what should i (?:do|get done) today|how should i spend (?:today|my day)|what do i have to do|help me get organised|make me a schedule|map out (?:my day|tomorrow))\b/.test(l))
    return open.length ? say('Suggested order:\n' + open.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} (${why(t)})`).join('\n')) : say('Your plan is empty. Add a task and I will plan around it.');
  if (/^(?:do|what should i do|what do i|what to do|what'?s next|what is next|what is most important|what is my next|which (?:task|one)|where (?:do|should) i|top priority|pick a task|tell me what to work on|what deserves my attention|what should i focus on)\b/.test(l)
    || /\b(?:do first|first task|next task|highest priority|most urgent thing|attention first)\b/.test(l))
    return open.length ? say(`Do this first: "${open[0].title}" (${why(open[0])}).` + (open[1] ? `\nThen: "${open[1].title}".` : '')) : say('Your plan is empty. Add a task and I will tell you what to do first.');
  if (/\b(help|what can you|commands|features|how do you work)\b/.test(l))
    return say('I can:\n- add tasks: "add task for my study", "add fix login bug tomorrow high", or several at once with commas\n- complete / reopen / delete: "complete login", "complete all", "delete old task"\n- undo a delete: "undo"\n- edit: "rename login to fix auth", "move login to friday", "make login low priority", "tag docs as study"\n- focus: "focus on login" (opens the Focus page with that task ready)\n- find and filter: "find login", "show pending", "show bugs", "clear filters"\n- think: "plan my day", "what\'s due today", "summary", "overdue", "break down login"\n- look things up: "who was alan turing", "define serendipity", "compare France and Germany", "weather in London", "100 usd to eur", "facts about the moon", "quiz me on photosynthesis" (cited public sources)\n- calculate offline: "15% of 200", "5 km to miles", "days until 2026-12-25", "tip on 42.50", "bmi 70 1.75"\n- repeat and streaks: \"add gym daily\", \"add read every weekday\", \"show my streaks\"\n- explain the site: drag, edit, themes, saving, status');
  // A real world question should reach research, not a loose FAQ keyword ("dark matter" is not the theme setting)
  const siteWord = /\b(?:jaltron|task|tasks|todo|to-do|list|plan|schedule|overdue|priority|balance|streak|habit|repeat|recurring|theme|dark mode|light mode|save|storage|sync|sign in|account|status|online|offline|drag|edit|rename|search|shortcut|keyboard|undo|delete|category|tags?|due date|deadline|timer|focus|summary)\b/;
  const worldQ = (/^(?:who|what|where|when|why|which)\b/.test(l) || /^how (?:tall|far|old|big|long|heavy|deep|high|many|much|does|did|was|were|is)\b/.test(l))
    && !siteWord.test(l)
    && !/^(?:what (?:can|do) you|who are you|how are you|what is your|whats your|what'?s your|who is your|who'?s your|what is my|what is jaltron|what are you|how do you work|how old are you)\b/.test(l);
  if (worldQ) return Object.assign(say('I did not get that. Try "add physics exam tomorrow urgent", "complete login", "plan my day", or ask a knowledge question like "why is the sky blue".'), { unknown: true });
  for (const [re, ans] of FAQ) if (re.test(l)) return say(typeof ans === 'function' ? ans() : ans);

  return Object.assign(say('I did not get that. Try "add physics exam tomorrow urgent", "complete login", "plan my day", or ask a knowledge question like "why is the sky blue".'), { unknown: true });
}

const api = { respond, clean, parseTask, find };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.Brain = api;
})();

// ===== 5. JALTRONAI =====
(function (root) {
  'use strict';
const MOTIVATE = ['Small steps count. Pick one task and give it 10 focused minutes.', 'You do not have to do everything today, just the next thing.', 'Start with the easiest task to build momentum.'];
// Turns the network's guess (intent) into a real action by finding the details in your sentence
const KSTOP = new Set('a an the i me my you is are do does how what to of and or it in on for can we be this that with'.split(' '));
const kw = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !KSTOP.has(w)).map(w => (w.length > 3 ? w.replace(/s$/, '') : w));
let DF = null; // how many entries use each word, so rare words count more than common ones
const kWeight = (k, q) => {
  if (!DF) { DF = {}; for (const e of root.KNOWLEDGE || []) new Set(e.phrases.flatMap(kw)).forEach(w => { DF[w] = (DF[w] || 0) + 1; }); }
  const toks = new Set(k.phrases.flatMap(kw)); let s = 0; q.forEach(w => { if (toks.has(w)) s += 1 / (DF[w] || 1); }); return s;
};
const kOverlap = (k, q) => { const toks = new Set(k.phrases.flatMap(kw)); let s = 0; q.forEach(w => { if (toks.has(w)) s++; }); return s; };
function kAnswer(k, text, tasks) {
  const a = typeof k.answer === 'function' ? k.answer(text, tasks) : Array.isArray(k.answer) ? k.answer[Math.floor(Math.random() * k.answer.length)] : k.answer;
  return { reply: a, actions: [] };
}
function neuralRespond(text, tasks) {
  const p = TinyBrain.predict(text) || { intent: 'unknown', conf: 0, support: 0 };
  const KB = root.KNOWLEDGE || [], q = new Set(kw(text));
  // Calculations are recognised directly
  if (/\d/.test(text) && /[+\-*/^%]|\b(?:times|plus|minus|divided|squared)\b/i.test(text)) { const m = KB.find(x => x.id === 'util_math'); if (m) return kAnswer(m, text, tasks); }
  // Keyword check backs up the network for knowledge questions
  let bk = null, bs = 0;
  for (const k of KB) { const s = kWeight(k, q); if (s > bs) { bs = s; bk = k; } }
  const kFallback = () => (bk && kOverlap(bk, q) >= 2 ? kAnswer(bk, text, tasks) : null);
  const research = () => (looksFactual(text) ? { research: true, query: cleanQuery(text) } : null);
  if (p.intent === 'chat') { // a real question beats the canned "outside what I know"
    const kf = kFallback();
    if (kf) return kf;
    const r = research();
    if (r) return r;
  }
  // "how many people live in india" must not borrow the summary answer just because it says "how many"
  const rq = SOFT_INTENT.has(p.intent) ? research() : null;
  if (rq) return rq;
  const nk = p.intent.startsWith('k_') ? KB.find(x => 'k_' + x.id === p.intent) : null;
  // The net always names some intent, so never act on a guess that has no command words
  // behind it. Chat is safe (no action); everything else has to earn its support.
  if (p.intent === 'unknown' || p.conf < 0.5 || (!nk && p.intent !== 'chat' && !p.support)) return kFallback() || research();
  if (nk) {
    const own = kWeight(nk, q);
    if (own <= 0) return kFallback();
    return kAnswer(bk && bk !== nk && bs > own ? bk : nk, text, tasks);
  }
  let intent = p.intent;
  if (intent === 'reopen' && /\b(finished|finish|done|completed)\b/i.test(text) && !/\b(not|didnt|did not|never|still|yet)\b/i.test(text)) intent = 'complete';
  const canned = { plan: 'plan my day', first: 'what should i do first', summary: 'summary', overdue: "what's overdue", help: 'what can you do', greet: 'hi', thanks: 'thanks', optimize: 'optimize', clear_done: 'clear completed', complete_all: 'complete all', undo: 'undo', balance: 'balance' };
  const strip = (s, extra) => s.replace(extra, ' ').replace(/\b(?:bro|pls|please|can you|could you|i|im|ive|i've|just|already|the|my|a|an|task|tasks|is|are|was|now|lol|from|list|plan|schedule|todo|on|it|me|to|of)\b/gi, ' ').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const known = (t) => t && Brain.find(tasks, t);
  let cmd = canned[intent] || null, res = null, t;
  switch (intent) {
    case 'motivate': res = { reply: MOTIVATE[Math.floor(Math.random() * MOTIVATE.length)] + '\n' + Brain.respond('what should i do first', tasks, []).reply, actions: [] }; break;
    case 'chat': res = { chat: true }; break;
    case 'research': res = research(); if (!res) return null; break;
    case 'add': {
      const tail = /\s+(?:to|on|in|into)\s+(?:my\s+)?(?:list|plan|schedule|todo|to-do)$/i;
      const raw = text.replace(/^(?:bro\s+|hey\s+|please\s+|pls\s+|can you\s+|could you\s+)?(?:i\s+(?:need|have|want|gotta|must|should)\s+to\s+(?:get\s+)?|i\s+should\s+probably\s+|remind me (?:to|about)\s+|jot down\s+|note down\s+|remember (?:that\s+)?(?:i\s+need\s+to\s+)?|get\s+|(?:add|create|put|new task|make)\s+(?:a\s+)?(?:new\s+)?(?:task\s+)?(?:to\s+|for\s+)?)/i, '').replace(tail, ' ').replace(/\s+(?:needs? doing|done|finished|completed)$/i, ' ').trim();
      cmd = 'add ' + (raw || text); break;
    }
    case 'complete': t = strip(text, /\b(?:finished|finish|done|completed|complete|check off|tick off|cross off|mark|with|did|have|has|had|been|got|through|wrapped up)\b/gi); if (!known(t)) return null; cmd = 'complete ' + t; break;
    case 'delete': t = strip(text, /\b(?:delete|remove|cancel|drop|get rid|don'?t need|do not need|no longer|not doing|anymore|throw away|take .* out|trash|erase)\b/gi); if (!known(t)) return null; cmd = 'delete ' + t; break;
    case 'reopen': t = strip(text, /\b(?:reopen|undo|complete|not done|yet|did not|didnt|isn'?t|never|still|needs doing|finish|finished|uncheck|bring back)\b/gi); if (!known(t)) return null; cmd = 'reopen ' + t; break;
    case 'search': t = strip(text, /\b(?:find|search|where|did|does|go|show|look up|look|anything about|there a task for|for|do have|about)\b/gi); if (!t) return null; cmd = 'find ' + t; break;
    case 'prio': {
      const level = /not (?:important|urgent)|less (?:urgent|important)|\b(?:low|later|wait|unimportant|lower|reduce)\b/i.test(text) ? 'low' : /\b(urgent|important|asap|high|critical|raise)\b/i.test(text) ? 'high' : 'medium';
      t = strip(text, /\b(?:make|set|priority|urgent|important|asap|high|critical|raise|low|later|wait|lower|less|reduce|unimportant|not|super|very|medium|can)\b/gi);
      if (!known(t)) return null; cmd = `make ${t} ${level} priority`; break;
    }
    case 'due': {
      const d = Brain.parseTask(text).due;
      if (!d) return { reply: 'Which date? Try "tomorrow", "friday" or 2026-10-25.', actions: [] };
      t = strip(text, /\b(?:move|postpone|push|delay|reschedule|change|set|give|make|needs?|to be|be done|has to|done|finished|deadline|of|for|by|due|until|tomorrow|tmrw|tmr|today|next week|in \d+ days?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/gi);
      if (!known(t)) return null; cmd = `move ${t} to ${d}`; break;
    }
    case 'tag': {
      let c = null, at = -1; // the category named last in the sentence is the target
      for (const x of (window.CATS ? CATS() : [])) { const i = text.toLowerCase().lastIndexOf(x.toLowerCase()); if (i > at) { at = i; c = x; } }
      if (!c) return null;
      t = strip(text.slice(0, at) + ' ' + text.slice(at + c.length), /\b(?:tag|put|under|as|mark|category|change|thing)\b/gi);
      if (!known(t)) return null; cmd = `tag ${t} as ${c}`; break;
    }
    case 'breakdown': t = strip(text, /\b(?:break down|split|steps|how do finish|how should approach|help start|into|how)\b/gi); cmd = 'break down' + (t ? ' ' + t : ''); break;
    case 'focus': {
      t = strip(text, /\b(?:lets|let'?s?|start|begin|focusing|focus|session|timer|mode|on|for|with|work|working)\b/gi);
      if (!t) cmd = 'start focus';
      else if (known(t)) cmd = 'focus on ' + t;
      else return null;
      break;
    }
    case 'deposit': { const n = (text.match(/\d[\d,]*/) || [])[0]; if (!n) return null; cmd = `deposit ${n}`; break; }
    case 'withdraw': { const n = (text.match(/\d[\d,]*/) || [])[0]; if (!n) return null; cmd = `withdraw ${n}`; break; }
  }
  if (!res) { if (!cmd) return null; res = Brain.respond(cmd, tasks, []); if (res.unknown) return null; }
  return res;
}


  // Which intent a successful rule-layer reply demonstrates. Learned from the user's own words.
  const ACTION_INTENT = { add: 'add', complete: 'complete', delete: 'delete', reopen: 'reopen', due: 'due', prio: 'prio', tag: 'tag', search: 'search', filter: 'search', optimize: 'optimize', clear_done: 'clear_done', focus: 'focus', undo: 'undo', deposit: 'deposit', withdraw: 'withdraw' };
  const SOFT_INTENT = new Set(['unknown', 'chat', 'plan', 'first', 'summary', 'overdue', 'help', 'greet', 'thanks', 'motivate']);
  const LEARNABLE = new Set(['add', 'complete', 'delete', 'reopen', 'prio', 'due', 'tag', 'search', 'breakdown', 'focus', 'undo', 'plan', 'first', 'summary', 'overdue', 'optimize', 'clear_done', 'complete_all', 'motivate', 'research', 'deposit', 'withdraw', 'balance']);
  const CONFIRM_RE = /^(?:yes|y|ok|okay|sure|do it|confirm|no|nope)$/i;
  const WRONG_RE = /^(?:no|nope|wrong|not that|that'?s wrong|thats wrong|incorrect|you misunderstood|i did not mean that|i didn't mean that|not what i meant)$/i;
  const SHARE_STOP = new Set('the a an i me my you your it this that these those to on in for of and or is are was were be been do does did have has had can could would should will just please pls bro hey yo ok okay so if then than there here what which who how why when where all any some no not add get make set move put remove delete complete finish done task tasks list plan schedule todo focus work start begin need want'.split(' '));
  const sigWords = (s) => { const out = new Set(); for (const w of String(s).toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 2 && !SHARE_STOP.has(w)) out.add(w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w); return out; };
  const related = (a, b) => { const B = sigWords(b); for (const w of sigWords(a)) if (B.has(w)) return true; return false; };
  let lastUnknown = '', lastNeural = null, lastStats = { examples: 0, acc: 0 };

  function intentOf(res) {
    const a = (res.actions || [])[0];
    if (a && ACTION_INTENT[a.type]) return ACTION_INTENT[a.type];
    const r = res.reply || '';
    if (/^Suggested order/.test(r)) return 'plan';
    if (/^Do this first/.test(r)) return 'first';
    if (/^You have \d+ tasks/.test(r)) return 'summary';
    if (/^Overdue|^Nothing is overdue/.test(r)) return 'overdue';
    if (/^To finish/.test(r)) return 'breakdown';
    if (/^I can:/.test(r)) return 'help';
    if (/^Anytime\./.test(r)) return 'thanks';
    if (/^(?:Doing great|Just keeping|I am here|Good night|Hey\b|Hello\b|Hi\b|Yo\b|Howdy)/.test(r)) return 'greet';
    return '';
  }
  function learn(text, intent, weight) {
    const t = String(text || '').trim();
    if (!LEARNABLE.has(intent) || CONFIRM_RE.test(t) || t.length < 3) return;
    try { root.TinyBrain.learn(t, intent, weight); } catch {}
  }

  // ---- Research: look facts up on Wikipedia, then remember them ----
  // The net routes questions; it does not store the world. Unknown factual questions are looked
  // up once, answered with a source, and kept in localStorage so the next ask is instant.
  const FACT_KEY = 'jc:facts', FACT_CAP = 300;
  const FACT_STOP = new Set([...KSTOP, 'was', 'were', 'who', 'whom', 'whose', 'why', 'where', 'when', 'which', 'about', 'tell', 'explain', 'define', 'describe', 'know', 'please', 'mean', 'means', 'much', 'many', 'give', 'information', 'info', 'look', 'up', 'search', 'whats', 'did', 'has', 'have', 'had', 'would', 'should', 'will', 'could', 'hey', 'hi', 'hello', 'bro', 'pls', 'want', 'learn', 'located', 'exactly', 'actually', 'invented', 'invent', 'discovered', 'discover', 'wrote', 'written', 'created', 'built', 'founded', 'painted', 'composed', 'won', 'win', 'tall', 'far', 'old', 'big', 'long', 'heavy', 'fast', 'deep', 'high', 'people', 'live', 'living', 'happen', 'happened', 'city']);
  const factStem = (w) => {
    if (w.length > 6 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 5 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && /(?:es|s)$/.test(w) && !/(?:ss|sis|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  };
  const factWords = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !FACT_STOP.has(w)).map(factStem);
  const normKey = (q) => [...new Set(factWords(q))].sort().join(' ');
  let FACTS = [];
  try {
    const saved = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(FACT_KEY)) || '[]');
    if (Array.isArray(saved)) FACTS = saved.filter(e => e && e.k && e.t && e.u).slice(-FACT_CAP).map(e => ({ k: String(e.k), q: String(e.q || ''), t: String(e.t), u: String(e.u), n: Math.max(1, Number(e.n) || 1), ms: Number(e.ms) || 0 }));
  } catch {}
  const saveFacts = () => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(FACT_KEY, JSON.stringify(FACTS)); } catch {} };
  function remember(item) {
    const i = FACTS.findIndex(x => x.k === item.k);
    if (i >= 0) FACTS[i] = item; else {
      if (FACTS.length >= FACT_CAP) {
        let low = 0;
        for (let j = 1; j < FACTS.length; j++) if (FACTS[j].n < FACTS[low].n) low = j;
        FACTS.splice(low, 1);
      }
      FACTS.push(item);
    }
    saveFacts();
  }
  function cacheFind(text) {
    const q = new Set(factWords(text));
    if (!q.size) return null;
    let best = null, bestScore = 0;
    for (const e of FACTS) {
      const k = new Set(String(e.k).split(' '));
      let hit = 0;
      for (const w of q) if (k.has(w)) hit++;
      const ratio = hit / q.size;
      // A single broad word ("moon") must not match a long stored question about Armstrong
      if (!hit || (q.size > 1 ? (hit < 2 || ratio < 0.6) : !(hit === 1 && k.size <= 2))) continue;
      const score = hit + ratio;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) return null;
    best.n++; best.ms = Date.now(); saveFacts();
    return { reply: `From memory: ${best.t}`, actions: [], sources: [best.u], cached: true };
  }
  function looksFactual(text) {
    const t = String(text || '').trim().toLowerCase();
    if (t.length < 8) return false;
    if (/\b(?:task|tasks|list|plan|todo|overdue|priority|balance|done|progress|streak|bank|deposit|withdraw)\b/.test(t)) return false;
    if (/^(?:how (?:do|can|should|would|to) (?:i|we)\b|what (?:should|do) i\b|who are you\b|how are you\b|what is your\b|what'?s your\b|who is your\b|who'?s your\b|what can you do\b|what do you (?:do|know)\b|how do you work\b|how old are you\b|what is my\b)/.test(t)) return false;
    const ask = /^(?:who|what|where|when|why|how|which|whose)\b|^(?:tell me|explain|describe|define|look up|search for|give me|facts about|quiz me|compare|weather|time in|currency|exchange rate|convert|book |paper |research |country )/.test(t);
    if (!ask) return false;
    return factWords(t).length > 0;
  }
  function cleanQuery(text) {
    let q = String(text || '').toLowerCase().replace(/[?!.]+$/g, '').trim();
    q = q.replace(/\bwhat'?s\b/gi, 'what is').replace(/\bwho'?s\b/gi, 'who is').replace(/\bwhere'?s\b/gi, 'where is');
    q = q.replace(/^(?:hey|hi|bro|please|can you|could you|do you know|i want to know)\s+/i, '');
    // Specific question shapes first: the generic strip below would otherwise eat "how" / "who" and leave "tall is ..."
    q = q.replace(/^how (?:tall|high) (?:is|are|was|were)\s+/i, 'height of ');
    q = q.replace(/^how old (?:is|are|was|were)\s+/i, 'age of ');
    q = q.replace(/^how far (?:is|are|was|were)\s+/i, 'distance to ');
    q = q.replace(/^how (?:big|long|heavy|fast|deep) (?:is|are|was|were)\s+/i, '');
    q = q.replace(/^how many people (?:live|are there) in\s+/i, 'population of ');
    q = q.replace(/^who invented\s+/i, 'invention of ');
    q = q.replace(/^who discovered\s+/i, 'discovery of ');
    q = q.replace(/^who founded\s+/i, 'founding of ');
    q = q.replace(/^who (?:wrote|painted|composed|created|built|directed|designed|won)\s+/i, '');
    q = q.replace(/^(?:tell me (?:about|the)|explain|define|describe|give me info on|i want to learn about|what do you know about|give me information about)\s+/i, '');
    q = q.replace(/^(?:what|who|where|when|why|how|which)\s+(?:is|are|was|were|do|does|did|can|could|would|should|has|have|had)?\s*/i, '');
    q = q.replace(/^(?:the|a|an)\s+/, '');
    q = q.replace(/\s+(?:happen|happened|located)$/i, '');
    return q.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 8).join(' ');
  }
  async function fetchJson(url) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally { if (timer) clearTimeout(timer); }
  }
  const WIKI = 'https://en.wikipedia.org/w/api.php?format=json&origin=*';
  const VOLATILE = /\b(?:president|prime minister|news|price|worth|stock|today|current|latest|weather|temperature|forecast|population|exchange|bitcoin|ethereum|crypto|time in)\b/i;
  // Pack is safe to use for "what is bitcoin", not for "bitcoin price"
  const NEEDS_LIVE = /\b(?:president|prime minister|news|price|worth|stock|today|current|latest|weather|temperature|forecast|population|exchange|time in)\b|\b(?:bitcoin|ethereum|btc|eth)\b.*\b(?:price|worth|value|usd|eur)\b/i;

  // ---- Offline pack: common facts shipped with the site ----
  let PACK = null, PACK_AT = 0, PACK_BUILD = null, lastEntity = '', lastIntent = '';
  const PACK_KEY = 'jc:kb:v2', PACK_TTL = 6048e5;
  const packNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  function packUse(p) {
    if (!p || p.v !== 1 || !Array.isArray(p.e)) return null;
    const m = new Map();
    for (const e of p.e) {
      if (!Array.isArray(e) || e.length < 2 || !Array.isArray(e[0])) continue;
      for (const q of e[0]) { const k = packNorm(q); if (k && !m.has(k)) m.set(k, e); }
    }
    return { p, m };
  }
  function packLoad() {
    if (PACK) return PACK;
    if (!PACK_AT) {
      PACK_AT = Date.now();
      try {
        const o = JSON.parse(localStorage.getItem(PACK_KEY) || 'null');
        if (o && o.t && Date.now() - o.t < PACK_TTL) PACK = packUse(o.p);
        else if (o) localStorage.removeItem(PACK_KEY);
        localStorage.removeItem('jc:kb:v1');
      } catch {}
    }
    if (PACK || PACK_BUILD || typeof fetch === 'undefined') return PACK;
    PACK_BUILD = fetch('data/kb.json', { cache: 'force-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(p => { PACK = packUse(p); if (PACK) { try { localStorage.setItem(PACK_KEY, JSON.stringify({ t: Date.now(), p })); } catch {} } return PACK; })
      .catch(() => null)
      .finally(() => { PACK_BUILD = null; });
    return null;
  }
  function packAnswer(e) {
    const a = String(e[1] || ''), s = String(e[2] || '');
    if (!a) return null;
    lastEntity = String((e[0] && e[0][0]) || '');
    lastIntent = 'wiki';
    return { reply: a, actions: [], sources: s ? [s] : [], fromPack: true };
  }
  function packFind(text) {
    const q = String(text || '').trim();
    if (!q || NEEDS_LIVE.test(q) || /^(?:add|complete|delete|reopen|move|rename|make|tag|find|show|plan|summary|undo|focus|clear|deposit|withdraw)\b/i.test(q)) return null;
    const idx = packLoad();
    if (!idx) return null;
    const s = packNorm(q);
    if (!s) return null;
    const tries = [s];
    let x = q.toLowerCase().replace(/[?!.]+$/g, '');
    tries.push(packNorm(x));
    for (let i = 0; i < 3; i++) x = x.replace(/^(?:hey|hi|please|can you|could you|do you know|tell me|explain|describe|define|what is|what are|what was|whats|who is|who was|whos|where is|where was|when was|when did|why is|why are|why do|how is|how does|how do|how did|which is|the)\s+/i, '');
    tries.push(packNorm(x));
    for (const t of tries) { const e = idx.m.get(t); if (e) return packAnswer(e); }
    let best = null, bl = 0;
    const skip = new Set('the a an of in on at to for and or is are was were be been do does did what who where when why how which tell me about give facts information'.split(' '));
    const qw = s.split(' ').filter(w => w.length > 2 && !skip.has(w));
    for (const [k, e] of idx.m) {
      if (k.length <= bl) continue;
      const kw = k.split(' ');
      if (qw.length && qw.every(w => kw.includes(w))) { best = e; bl = k.length; }
    }
    if (best) return packAnswer(best);
    // Question phrasing ("why is the sky blue") rarely matches an alias exactly; accept an entry whose answer covers every query word.
    if (qw.length < 2) return null;
    for (const [k, e] of idx.m) {
      const kw = k.split(' ');
      if (!qw.some(w => kw.includes(w)) || k.length <= bl) continue;
      const aw = new Set((k + ' ' + packNorm(String(e[1] || ''))).split(' '));
      if (qw.every(w => aw.has(w))) { best = e; bl = k.length; }
    }
    return best ? packAnswer(best) : null;
  }

  // ---- Own knowledge server: only the cleaned question leaves the browser ----
  let serverOn = null, serverAt = 0, serverJob = null, CID = '';
  function clientId() {
    if (CID) return CID;
    try { CID = localStorage.getItem('jc:cid') || ''; } catch {}
    if (!CID) { CID = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); try { localStorage.setItem('jc:cid', CID); } catch {} }
    return CID;
  }
  function abort(ms) { const c = typeof AbortController !== 'undefined' ? new AbortController() : null; return { c, t: c ? setTimeout(() => c.abort(), ms) : null }; }
  function checkHealth() {
    if (serverOn === true && Date.now() - serverAt < 60000) return Promise.resolve(true);
    if (serverJob) return serverJob;
    if (typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return Promise.resolve(false);
    const { c, t } = abort(3500);
    serverJob = fetch('/api/ai/health', { cache: 'no-store', signal: c ? c.signal : undefined })
      .then(r => r.ok ? r.json() : null)
      .then(j => { serverOn = !!(j && j.ok); serverAt = Date.now(); return serverOn; })
      .catch(() => { serverOn = false; serverAt = Date.now(); return false; })
      .finally(() => { if (t) clearTimeout(t); serverJob = null; });
    return serverJob;
  }
  function serverAsk(text, ctx) {
    if (typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return Promise.resolve(null);
    if (serverOn !== true && Date.now() - serverAt < 60000) return Promise.resolve(null);
    const { c, t } = abort(9000);
    const context = ctx || (lastEntity ? { entity: lastEntity, intent: lastIntent } : {});
    return fetch('/api/ai/ask', {
      method: 'POST', signal: c ? c.signal : undefined,
      headers: { 'content-type': 'application/json', 'x-client-id': clientId() },
      body: JSON.stringify({ message: String(text).slice(0, 500), context })
    }).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || j.ok !== true || typeof j.reply !== 'string') return null;
      const reply = j.reply.trim().slice(0, 4000);
      if (!reply) return null;
      serverOn = true; serverAt = Date.now();
      if (j.entity) lastEntity = String(j.entity).slice(0, 120);
      if (j.intent) lastIntent = String(j.intent).slice(0, 30);
      return { reply, sources: (Array.isArray(j.sources) ? j.sources : []).filter(u => /^https?:\/\//i.test(u)).slice(0, 3), actions: [], fromServer: true };
    }).catch(() => { serverOn = false; serverAt = Date.now(); return null; }).finally(() => { if (t) clearTimeout(t); });
  }

  // ---- Local skills: units, dates, money and health, all offline ----
  const U = {
    mm: ['length', 0.001], cm: ['length', 0.01], m: ['length', 1], km: ['length', 1000], in: ['length', 0.0254], ft: ['length', 0.3048], yd: ['length', 0.9144], mi: ['length', 1609.344],
    mg: ['mass', 1e-6], g: ['mass', 0.001], kg: ['mass', 1], lb: ['mass', 0.45359237], oz: ['mass', 0.028349523125], t: ['mass', 1000],
    ml: ['volume', 0.001], l: ['volume', 1], cup: ['volume', 0.2365882365], pt: ['volume', 0.473176473], qt: ['volume', 0.946352946], gal: ['volume', 3.785411784],
    kb: ['data', 1024], mb: ['data', 1048576], gb: ['data', 1073741824], tb: ['data', 1099511627776],
    m2: ['area', 1], km2: ['area', 1e6], ft2: ['area', 0.09290304], acre: ['area', 4046.8564224], ha: ['area', 10000],
    mph: ['speed', 0.44704], kmh: ['speed', 1 / 3.6], 'm/s': ['speed', 1],
    s: ['time', 1], min: ['time', 60], h: ['time', 3600], day: ['time', 86400], week: ['time', 604800]
  };
  const UALIAS = { kilometer: 'km', kilometre: 'km', kilometers: 'km', kilometres: 'km', meter: 'm', metre: 'm', meters: 'm', metres: 'm', centimeter: 'cm', centimetre: 'cm', centimeters: 'cm', centimetres: 'cm', millimeter: 'mm', millimetre: 'mm', millimeters: 'mm', millimetres: 'mm', mile: 'mi', miles: 'mi', foot: 'ft', feet: 'ft', inch: 'in', inches: 'in', yard: 'yd', yards: 'yd', pound: 'lb', pounds: 'lb', ounce: 'oz', ounces: 'oz', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', tonne: 't', tonnes: 't', liter: 'l', litre: 'l', liters: 'l', litres: 'l', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml', gallon: 'gal', gallons: 'gal', quart: 'qt', quarts: 'qt', pint: 'pt', pints: 'pt', cup: 'cup', cups: 'cup', kilobyte: 'kb', kilobytes: 'kb', megabyte: 'mb', megabytes: 'mb', gigabyte: 'gb', gigabytes: 'gb', terabyte: 'tb', terabytes: 'tb', acre: 'acre', acres: 'acre', hectare: 'ha', hectares: 'ha', kph: 'kmh' };
  const unit = (x) => { x = String(x || '').toLowerCase().replace(/\s+/g, '').replace('²', '2'); return UALIAS[x] || x; };
  const rnd = (x) => { const a = Math.abs(x); return a >= 1e6 || (a > 0 && a < 0.001) ? +x.toExponential(3) : Math.round(x * 1e4) / 1e4; };
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const DAY = 864e5;
  const isoDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; };
  const dayDiff = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
  const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  function localSkill(text) {
    const t = String(text || '').trim(), l = t.toLowerCase();
    let m;
    if ((m = l.match(/^(?:what(?:'s| is) )?(?:a )?(\d+(?:\.\d+)?)\s*%?\s*tip(?: on)?\s*\$?(\d+(?:\.\d+)?)$/))) {
      const p = +m[1], a = +m[2], tip = a * p / 100;
      return { reply: `A ${p}% tip on ${money(a)} is ${money(tip)}, total ${money(a + tip)}.`, actions: [] };
    }
    if ((m = l.match(/^tip\s*(\d+(?:\.\d+)?)\s*%\s*on\s*\$?(\d+(?:\.\d+)?)$/))) {
      const p = +m[1], a = +m[2], tip = a * p / 100;
      return { reply: `A ${p}% tip on ${money(a)} is ${money(tip)}, total ${money(a + tip)}.`, actions: [] };
    }
    if ((m = l.match(/^tip(?: on)?\s*\$?(\d+(?:\.\d+)?)(?:\s+at\s+(\d+(?:\.\d+)?)%)?$/))) {
      const a = +m[1], p = m[2] ? +m[2] : 15, tip = a * p / 100;
      return { reply: `A ${p}% tip on ${money(a)} is ${money(tip)}, total ${money(a + tip)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:what(?:'s| is) )?(\d+(?:\.\d+)?)\s*%?\s*off\s*\$?(\d+(?:\.\d+)?)$/))) {
      const p = +m[1], a = +m[2], d = a * p / 100;
      return { reply: `${p}% off ${money(a)} is ${money(d)} off, so ${money(a - d)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:loan|mortgage)\s*\$?(\d+(?:\.\d+)?)\s*(?:at\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:for\s*)?(\d+)\s*(?:years?|yrs?)$/))) {
      const P = +m[1], r = +m[2] / 1200, n = +m[3] * 12;
      const pay = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
      return { reply: `Loan ${money(P)} at ${m[2]}% for ${m[3]} years: ${money(pay)}/month, total ${money(pay * n)} (${money(pay * n - P)} interest).`, actions: [] };
    }
    if ((m = l.match(/^compound\s*\$?(\d+(?:\.\d+)?)\s*(?:at\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:for\s*)?(\d+)\s*(?:years?|yrs?)$/))) {
      const P = +m[1], A = P * Math.pow(1 + +m[2] / 100, +m[3]);
      return { reply: `${money(P)} at ${m[2]}% compounded yearly is ${money(A)} after ${m[3]} years (${money(A - P)} interest).`, actions: [] };
    }
    if ((m = l.match(/^bmi\s*(\d+(?:\.\d+)?)\s*(?:kg)?\s+(\d+(?:\.\d+)?)\s*(cm|m)?$/))) {
      const kg = +m[1], h = m[3] === 'cm' ? +m[2] / 100 : +m[2];
      if (kg && h) {
        const b = kg / (h * h), c = b < 18.5 ? 'underweight' : b < 25 ? 'normal' : b < 30 ? 'overweight' : 'obese';
        return { reply: `BMI: ${b.toFixed(1)} (${c}).`, actions: [] };
      }
    }
    if ((m = l.match(/^(?:how many )?days (?:until|till|to) (\d{4}-\d{2}-\d{2})$/))) {
      const d = isoDate(m[1]);
      if (d) return { reply: `${dayDiff(new Date(), d)} days until ${fmtDate(d)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:how many )?days (?:since|between) (\d{4}-\d{2}-\d{2})(?: and (\d{4}-\d{2}-\d{2}))?$/))) {
      const a = isoDate(m[1]), b = m[2] ? isoDate(m[2]) : new Date();
      if (a && b) return { reply: `${Math.abs(dayDiff(a, b))} days ${m[2] ? 'between those dates' : 'since ' + fmtDate(a)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:what(?:'s| is) )?(?:the )?date (?:in|after) (\d+) (day|week|month)s?$/)) || (m = l.match(/^(?:what(?:'s| is) )?(?:the )?date (\d+) (day|week|month)s? (?:from now|from today)$/)) || (m = l.match(/^(\d+) (day|week|month)s? from now$/))) {
      const d = new Date(), n = +m[1], u = m[2];
      if (u === 'day') d.setDate(d.getDate() + n); else if (u === 'week') d.setDate(d.getDate() + n * 7); else d.setMonth(d.getMonth() + n);
      return { reply: `${n} ${u}${n === 1 ? '' : 's'} from now is ${fmtDate(d)}.`, actions: [] };
    }
    if ((m = l.match(/^(\d+) (day|week|month)s? ago$/))) {
      const d = new Date(), n = +m[1], u = m[2];
      if (u === 'day') d.setDate(d.getDate() - n); else if (u === 'week') d.setDate(d.getDate() - n * 7); else d.setMonth(d.getMonth() - n);
      return { reply: `${n} ${u}${n === 1 ? '' : 's'} ago was ${fmtDate(d)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(c|°c|celsius|f|°f|fahrenheit|k|kelvin)\s*(?:to|in|into)\s*(?:degrees?\s*)?(c|°c|celsius|f|°f|fahrenheit|k|kelvin)$/))) {
      const v = +m[1], f = m[2].replace('°', '')[0], to = m[3].replace('°', '')[0];
      const C = f === 'c' ? v : f === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
      const out = to === 'c' ? C : to === 'f' ? C * 9 / 5 + 32 : C + 273.15;
      return { reply: `${v}°${f.toUpperCase()} = ${rnd(out)}°${to.toUpperCase()}.`, actions: [] };
    }
    if ((m = l.match(/^(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*([a-z°/]+)\s*(?:to|in|into)\s*([a-z°/]+)$/))) {
      const u1 = unit(m[2]), u2 = unit(m[3]), a = U[u1], b = U[u2];
      if (a && b && a[0] === b[0]) return { reply: `${+m[1]} ${u1} = ${rnd(+m[1] * a[1] / b[1])} ${u2}.`, actions: [] };
    }
    if (/\d/.test(l) && /[+\-*/^%]|\b(?:times|plus|minus|divided|squared|percent)\b/.test(l) && root.calcReply) {
      const r = root.calcReply(t);
      if (/^Answer: /.test(r)) return { reply: r, actions: [] };
    }
    return null;
  }
  // Follow-ups reuse the last subject when the server is not around
  function resolveFollow(text) {
    const t = String(text || '').trim();
    if (!lastEntity) return t;
    const m = t.match(/^(?:and )?what about (.+)$/i);
    if (m) {
      const e = m[1].replace(/[?.!]+$/, '').trim();
      const map = { capital: `capital of ${e}`, population: `population of ${e}`, currency: `currency of ${e}`, area: `area of ${e}`, height: `how tall is ${e}`, birth: `when was ${e} born`, birthplace: `where was ${e} born`, death: `when did ${e} die`, weather: `weather in ${e}`, time: `time in ${e}`, country: `country ${e}`, book: `book ${e}`, author: `who wrote ${e}`, define: `define ${e}` };
      return map[lastIntent] || `tell me about ${e}`;
    }
    if (/\b(?:he|she|it|they|him|her|them|his|hers|its|their)\b/i.test(t))
      return t.replace(/\b(his|hers|its|their)\b/gi, lastEntity + "'s").replace(/\bit\b(?!\s+(?:true|possible|likely|fair|good|bad|seem|rain|snow|cold|hot|worth|safe|legal)\b)/gi, lastEntity).replace(/\b(he|she|they|him|her|them)\b/gi, lastEntity);
    return t;
  }
  function rememberFact(original, res) {
    const src = (res.sources && res.sources[0]) || res.source || '';
    if (!src || VOLATILE.test(original)) return;
    const text = String(res.reply || '').replace(/\n\nSources?:[\s\S]*$/i, '').trim().slice(0, 900);
    if (text) remember({ k: normKey(original), q: String(original).slice(0, 160), t: text, u: src, n: 1, ms: Date.now() });
  }
  const pendingResearch = new Map();
  let lastResearch = 0;
  function trimExtract(s) {
    s = String(s || '').replace(/\([;\s]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (s.length <= 600) return s;
    const cut = s.slice(0, 600), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return (end > 160 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
  }
  async function researchAnswer(query, original) {
    const followed = resolveFollow(original), q = followed !== original ? cleanQuery(followed) : query;
    const key = normKey(q) || normKey(followed);
    if (!key) return { reply: 'I need a topic to look up, for example "what is photosynthesis".', actions: [], sources: [] };
    if (pendingResearch.has(key)) return pendingResearch.get(key);
    const job = (async () => {
      const pk = packFind(followed);
      if (pk) { learn(original, 'research', 1); return pk; }
      const hit = cacheFind(followed);
      if (hit) return hit;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return { reply: 'You are offline. I can still use the facts packed with the site and your task list, but this one needs a connection.', actions: [], sources: [], noMatch: true };
      const sv = await serverAsk(followed);
      if (sv) { rememberFact(followed, sv); learn(original, 'research', 1); return sv; }
      if (!q) return { reply: 'I need a topic to look up, for example "what is photosynthesis".', actions: [], sources: [] };
      const wait = 1200 - (Date.now() - lastResearch);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      lastResearch = Date.now();
      try {
        const s = await fetchJson(`${WIKI}&action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3`);
        const results = ((s.query || {}).search) || [];
        for (const r of results) {
          const title = r.title || '';
          if (!title || /disambiguation/i.test(title)) continue;
          const e = await fetchJson(`${WIKI}&action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}`);
          const pages = (e.query || {}).pages || {};
          const page = Object.values(pages)[0] || {};
          const text = trimExtract(page.extract);
          if (!text || text.length < 40 || /may refer to/i.test(text)) continue;
          const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
          const res = { reply: text, actions: [], sources: [url], source: url };
          lastEntity = title; lastIntent = 'wiki';
          rememberFact(followed, res);
          learn(original, 'research', 1);
          return res;
        }
      } catch (err) { console.warn('Research failed:', err && err.message); }
      return { reply: 'I could not look that up right now (no connection or no match). I can still help with your tasks — try "plan my day".', actions: [], sources: [], noMatch: true };
    })();
    pendingResearch.set(key, job);
    try { return await job; } finally { pendingResearch.delete(key); }
  }

  // Main entry: exact commands first, then the neural net, then keyword knowledge search.
  // Every understood sentence is a free training example; a rephrased sentence after a miss
  // is a strong one. This is how the assistant trains itself from normal conversation.
  async function reply(text, tasks, history) {
    const msg = String(text || '').trim(), followed = resolveFollow(msg);
    const l = msg.toLowerCase();
    if (lastNeural && WRONG_RE.test(l)) {
      const was = lastNeural;
      lastNeural = null; lastUnknown = '';
      try { root.TinyBrain.learn(was.text, 'unknown', 2); } catch {}
      return { reply: `Got it, I will not read that as "${was.intent}" again.${was.hadAction ? ' If it changed a task, say "undo" or "reopen ...".' : ''} Tell me what you meant another way, like "add ...", "complete ..." or "plan my day".`, actions: [] };
    }
    const exact = root.Brain.respond(msg, tasks, history);
    if (!exact.unknown) {
      const intent = intentOf(exact);
      if (intent) {
        if (lastUnknown && lastUnknown.toLowerCase() !== l && related(lastUnknown, msg)) learn(lastUnknown, intent, 2);
        learn(msg, intent, 1);
      }
      lastUnknown = ''; lastNeural = null; lastEntity = ''; lastIntent = '';
      return intent ? { ...exact, intent } : exact;
    }
    const skill = localSkill(msg);
    if (skill) return skill;
    const n = neuralRespond(msg, tasks);
    if (n && n.research) {
      const r = await researchAnswer(n.query, msg);
      lastNeural = null;
      lastUnknown = r.noMatch ? msg : '';
      return r;
    }
    if (n && n.chat) {
      const pk = packFind(followed);
      if (pk) { lastNeural = null; lastUnknown = ''; return pk; }
      if (looksFactual(followed)) {
        const r = await researchAnswer(cleanQuery(msg), msg);
        lastNeural = null;
        lastUnknown = r.noMatch ? msg : '';
        return r;
      }
      lastNeural = null; lastUnknown = msg;
      return { reply: 'I am a knowledge engine, not a writer: I can look up facts, definitions, comparisons, weather and currency, and I can run your task commands. Try "why is the sky blue", "compare France and Germany" or "add fix login tomorrow high".', actions: [] };
    }
    if (n) {
      const intent = intentOf(n);
      if (intent && lastUnknown && lastUnknown.toLowerCase() !== l && related(lastUnknown, msg)) learn(lastUnknown, intent, 2);
      if (intent) learn(msg, intent, 1);
      lastUnknown = '';
      if (n.actions && n.actions.length) { lastEntity = ''; lastIntent = ''; }
      lastNeural = intent ? { text: msg, intent, hadAction: !!(n.actions && n.actions.length) } : null;
      return n;
    }
    lastNeural = null;
    if (looksFactual(followed)) {
      const r = await researchAnswer(cleanQuery(msg), msg);
      lastUnknown = r.noMatch ? msg : '';
      return r;
    }
    const lastPack = packFind(followed);
    if (lastPack) { lastUnknown = ''; return lastPack; }
    // First visit, net still warming up: say so instead of a plain "did not get that"
    if (!root.TinyBrain.ready) return { reply: 'My neural side is still training in your browser (watch the badge at the top) — a few more seconds. Exact commands already work, for example "add fix login bug tomorrow high" or "plan my day".', actions: [] };
    lastUnknown = msg;
    return exact;
  }
  async function init(onProgress) { const r = await root.TinyBrain.train([], onProgress); lastStats = r; packLoad(); return r; }
  function resetContext() { lastEntity = ''; lastIntent = ''; }
  function status() {
    if (!root.TinyBrain.ready) return 'Training neural AI...';
    const n = root.TinyBrain.learned(), f = FACTS.length, p = PACK ? PACK.p.e.length : 0;
    return `Neural AI ready: ${lastStats.examples || 0} examples, ${Math.round((lastStats.acc || 0) * 100)}% accuracy on unseen phrases${n ? ` · ${n} phrase${n === 1 ? '' : 's'} learned from your chats` : ''}${f ? ` · ${f} fact${f === 1 ? '' : 's'} remembered` : ''}${p ? ` · ${p} offline facts` : ''}${serverOn ? ' · knowledge engine online' : ''}`;
  }
  root.JaltronAI = { reply, init, status, checkHealth, packFind, reset: resetContext, learned: () => root.TinyBrain.learned(), facts: () => FACTS.length, get ready() { return root.TinyBrain.ready; }, get serverOnline() { return serverOn === true; } };
})(typeof window !== 'undefined' ? window : globalThis);