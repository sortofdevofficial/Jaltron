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
    E('site_save', ['are my tasks saved', 'do tasks save when i refresh', 'where is my data stored', 'how does saving work', 'will i lose my tasks'], 'Sign in with Google (top right) and your tasks save to your own account in the cloud and load on any device. Signed out, they live only in this page and refreshing clears them. Nothing goes in your browser storage.'),
    E('site_status', ['what does ai online mean', 'what does demo mode mean', 'why does it say server offline', 'what is the status badge', 'header status meaning'], 'TRAINING: the built-in neural AI is still learning in your browser (a few seconds). AI READY: it is trained. SYNCED: it is trained and you are signed in, so tasks save to your account.'),
    E('site_category', ['what are the categories', 'what is the difference between dev and bug', 'how do categories work', 'what categories exist', 'what is a category'], () => window.catReply()),
    E('site_due', ['how do due dates work', 'how do i set a deadline', 'what do the due badges mean', 'can i add a deadline', 'overdue badge meaning'], 'Pick a date in Quick Add or say "add pay hosting friday". Badges show Due today, Due tomorrow, a date, or how many days overdue (red). Say "move login to monday" to change one.'),
    E('site_stats', ['what do the cards at the top mean', 'what is the high priority count', 'what does in progress mean', 'explain the stats', 'what is the progress bar'], 'The cards count all tasks, open tasks (In Progress), completed tasks, open High priority tasks and overdue tasks. The bar shows the percent of tasks completed.'),
    E('site_assistant', ['how do i use the ai chat', 'what commands can i say', 'how do i talk to you', 'how to use the assistant', 'examples of things to say'], 'Type naturally, for example: "add task for my study tomorrow", "complete login", "make docs low priority", "move login to friday", "plan my day", "what is due today", "summary". Say "what can you do" for the full list.'),
    E('site_neural', ['how does your ai work', 'what model are you', 'are you chatgpt', 'how were you trained', 'are you a real ai'], 'I am a small neural network trained from scratch in your browser on characters and example phrases. It guesses what you mean, then my code finds the task and date in your sentence. I am far smaller than ChatGPT-style models, so I only know this site, planning, studying and coding habits.'),
    E('site_about', ['who are you', 'what is jaltron', 'what is your name', 'who made you', 'what are you'], 'I am JALTRON, an AI task and context planner. I manage your plan, suggest what to do first and answer questions about planning, studying and this site.'),
    E('site_privacy', ['is my data private', 'do you send my tasks anywhere', 'is this safe', 'who can see my tasks', 'privacy question'], 'Yes. The neural AI runs in your browser, so your messages are not sent to any AI service. Tasks are saved only if you sign in, and only your account can read them.'),
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
// Intents: add complete delete reopen prio due tag search breakdown plan first summary overdue
//          optimize clear_done complete_all help greet thanks motivate chat unknown
(function (root) {
  root.TRAIN = {
    slots: {
      task: ['fix login bug', 'study math', 'read chapter 3', 'call mom', 'write the report', 'deploy the plugin', 'clean my room', 'finish homework', 'update the server', 'buy milk', 'revise biology', 'build the navbar', 'test the api', 'practice guitar', 'pay hosting bill', 'backup the world', 'code the dashboard', 'email the teacher', 'fix lag issue', 'learn javascript', 'submit the assignment', 'prepare the presentation', 'review pull requests', 'set up the database', 'write unit tests', 'design the logo', 'plan the event', 'organize my notes', 'refactor the code', 'update the website', 'renew the domain', 'fix the crash', 'study for the exam', 'do the laundry', 'go to the gym', 'book the appointment', 'make a discord bot', 'add the whitelist', 'configure geyser', 'write the essay', 'clean the desk', 'check the logs', 'reply to messages', 'record the video', 'publish the update', 'fix the spawn bug', 'learn python', 'read the article', 'cook dinner', 'buy groceries', 'walk the dog', 'finish the project', 'practice coding', 'create the poster', 'update the readme', 'test the plugin', 'fix the css', 'solve the worksheet', 'plan the week', 'pay the bills'],
      when: ['tomorrow', 'today', 'friday', 'monday', 'tuesday', 'wednesday', 'thursday', 'saturday', 'sunday', 'next week', 'in 3 days', 'in 2 days', 'in 5 days', 'tmrw', 'tmr', '2026-10-25', '2026-11-02'],
      cat: ['study', 'dev', 'bug', 'general'],
      subject: ['study', 'work', 'coding', 'homework', 'project', 'exam', 'server']
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
      plan: ['plan my day', 'what should i do today', 'make me a schedule', 'organise my day', 'whats the plan', 'give me a plan for today', 'help me plan', 'what is my agenda', 'plan my tasks', 'what is on my plate', 'what do i have to do', 'show me my plan', 'what is todo', 'order my tasks', 'whats on my list'],
      first: ['what should i do first', 'whats next', 'where do i start', 'what is most important', 'top priority?', 'what do i do now', 'which task first', 'what should i focus on', 'what is my next task', 'what to do next', 'tell me what to work on', 'pick a task for me', 'what is the most urgent thing'],
      summary: ['how am i doing', 'give me a summary', 'how many tasks do i have', 'progress report', 'show my stats', 'overview please', 'how much have i done', 'status', 'how r we doing', 'how am i doing with my tasks', 'am i making progress', 'how is my plan going', 'how many are left', 'how many done'],
      overdue: ['whats overdue', 'am i late on anything', 'which tasks are late', 'anything behind schedule', 'what did i miss', 'show late tasks', 'what is past due', 'do i have overdue tasks', 'am i behind'],
      optimize: ['optimize my plan', 'sort my tasks', 'reorder by priority', 'organize by importance', 'smart sort', 'rank my tasks', 'sort by priority', 'fix the order of my tasks', 'tidy up my list'],
      clear_done: ['clear completed', 'remove all done tasks', 'clean up finished tasks', 'delete completed tasks', 'get rid of done stuff', 'clear finished tasks', 'wipe done tasks'],
      complete_all: ['complete everything', 'mark all as done', 'finish all tasks', 'tick everything off', 'mark every task complete', 'all done'],
      help: ['what can you do', 'help', 'how do you work', 'show commands', 'what are your features', 'how do i use you', '?', 'commands', 'help me', 'what do you do'],
      greet: ['hi', 'hello', 'hey bro', 'yo', 'good morning', 'sup', 'hey there', 'hola', 'good evening', 'hey jaltron', 'hii', 'heyy', 'good afternoon', 'whats up', 'wsp', 'wassup', 'wazzup', 'whaddup', 'what is up', "what's up", 'whats good', 'howdy', 'howdy partner', 'hiya', 'heya', 'hey hey', 'yoo', 'yooo', 'yo yo', 'ello', 'hullo', 'greetings', 'salutations', 'g\'day', 'gm', 'good night', 'morning', 'evening', 'afternoon', 'how are you', 'how are you doing', 'how r u', 'hru', 'how is it going', 'hows it going', 'how you doing', 'whats going on', 'wyd', 'what are you up to', 'wsg', 'wsup', 'sup bro', 'sup dude', 'hey buddy', 'hey man', 'hello there', 'namaste', 'namaskar', 'salaam', 'bonjour', 'ciao', 'hey whats up', 'yo whats up', 'well hello', 'oi', 'ayo', 'ayyy', 'hi there', 'hello jaltron', 'long time no see', 'nice to meet you', 'anyone there', 'you there', 'are you there', 'ping'],
      thanks: ['thanks', 'thank you', 'thx', 'ty bro', 'cheers', 'appreciate it', 'nice one', 'great job', 'awesome thanks', 'perfect', 'you are the best', 'thanks a lot'],
      motivate: ['motivate me', 'i am tired', 'i cannot focus', 'i am stressed', 'i feel lazy', 'too many things to do', 'i am overwhelmed', 'i dont feel like working', 'i cant be bothered', 'no motivation today', 'i dont want to do anything', 'im burnt out', 'cant be bothered today', 'give me some motivation', 'i feel stuck', 'cheer me up'],
      chat: ['whats the weather', 'i am bored', 'sing a song', 'do you like pizza', 'what is your favorite color', 'are you human', 'what is the meaning of life', 'who is the president', 'what is the capital of france', 'who won the world cup', 'translate hello to spanish', 'recipe for pasta', 'how tall is mount everest', 'what is the news today', 'play some music', 'what is bitcoin worth', 'how old are you', 'do you have feelings', 'write me a poem', 'tell me a story', 'capital of japan', 'what is the capital of germany', 'who is the prime minister', 'population of india', 'how far is the moon', 'who invented the telephone', 'what is the tallest building', 'who is the richest person', 'how many people live in china', 'best football team'],
      unknown: ['asdf', 'qwerty', 'blah blah', 'hmm', 'ok', 'lol', 'idk', '...', 'hmmmm', 'k', 'test', 'umm', 'what', 'huh', 'asdfgh', 'zzz', 'ok ok', 'hmm ok']
    },
    // Extra hand-written examples: ["phrase", "intent"]
    examples: [
      ["what's next?", 'first'], ["plan my day pls :)", 'plan'], ["hi!!!", 'greet'], ["thanks!!", 'thanks'],
      ["knock out the biology revision", 'add'], ["what's on my plate", 'plan'], ["i'm done with the login thing", 'complete'],
      ["nuke the old milk task", 'delete'], ["wat should i do", 'first'], ["tmrw i must study", 'add'],
      ["yo whats good", 'greet'], ["got it, thx", 'thanks'], ["any tasks left?", 'summary'], ["what's late??", 'overdue']
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);

// ===== 3. TINYBRAIN =====
// TinyBrain: a small neural network trained from scratch on characters.
// Text -> hashed character n-grams (letters, digits, special characters) -> hidden layer -> intent.
// No libraries, no downloads. It trains in your browser each time the page loads.
(function (root) {
  'use strict';
  const DIM = 4096, HID = 128, EPOCHS = 16;
  const BASE = ['add', 'complete', 'delete', 'reopen', 'prio', 'due', 'tag', 'search', 'breakdown', 'plan', 'first', 'summary', 'overdue', 'optimize', 'clear_done', 'complete_all', 'help', 'greet', 'thanks', 'motivate', 'chat', 'unknown'];
  let INTENTS = BASE.slice(), K = INTENTS.length;
  let W1, b1, W2, b2, ready = false, seed = 1;

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

  async function train(extra, onProgress) {
    seed = 7; ready = false;
    INTENTS = BASE.concat((root.KNOWLEDGE || []).map(k => 'k_' + k.id)); K = INTENTS.length;
    init();
    const all = build(root.TRAIN, extra).map(([t, i, tg]) => ({ ix: feats(t), y: INTENTS.indexOf(i), tg })).filter(d => d.y >= 0);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const hold = [], tr = [];
    for (const d of all) (!d.tg && hold.length < all.length * 0.12 ? hold : tr).push(d);
    for (let ep = 0; ep < EPOCHS; ep++) {
      const lr = 0.6 * (1 - ep / (EPOCHS * 1.2));
      for (let i = tr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tr[i], tr[j]] = [tr[j], tr[i]]; }
      for (const d of tr) step(d.ix, d.y, lr);
      if (onProgress) onProgress(ep + 1, EPOCHS);
      await new Promise(r => setTimeout(r, 0)); // keep the page responsive
    }
    let ok = 0;
    for (const d of hold) { const p = forward(d.ix).p; if (p.indexOf(Math.max(...p)) === d.y) ok++; }
    ready = true;
    return { examples: all.length, acc: hold.length ? ok / hold.length : 1 };
  }

  function predict(text) {
    if (!ready) return null;
    const p = forward(feats(text), 2.5).p; // temperature keeps confidence honest
    let b = 0; for (let k = 1; k < K; k++) if (p[k] > p[b]) b = k;
    return { intent: INTENTS[b], conf: p[b] };
  }

  const api = { get INTENTS() { return INTENTS; }, train, predict, get ready() { return ready; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TinyBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);

// ===== 4. BRAIN =====
(function () {
// JALTRON's built-in assistant: no API, no model. It knows the site and returns { reply, actions }
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
  [/undo|restore|deleted by mistake/, 'After you delete a task, an Undo button appears for a few seconds at the bottom.'],
  [/search|shortcut|keyboard|hotkey/, 'Press / anywhere to jump to the search box. You can also filter by category next to it.'],
  [/optimi[sz]|score|rank/, 'The optimizer ranks open tasks by priority, deadline pressure (overdue counts most) and category (bugs get a boost), then puts completed tasks last.'],
  [/dark|light|theme|mode/, 'Use the moon or sun button in the header to switch themes.'],
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
    return t ? say(`To finish "${t.title}":\n` + (STEPS[t.tag] || STEPS.General).map((s, i) => `${i + 1}. ${s}`).join('\n')) : say('Add a task first and I will break it down.');
  }
  if (/\b(plan|schedule|today|my day)\b/.test(l))
    return open.length ? say('Suggested order:\n' + open.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} (${why(t)})`).join('\n')) : say('Your plan is empty. Add a task and I will plan around it.');
  if (/\b(first|next|start|focus|priorit)/.test(l))
    return open.length ? say(`Do this first: "${open[0].title}" (${why(open[0])}).` + (open[1] ? `\nThen: "${open[1].title}".` : '')) : say('Your plan is empty. Add a task and I will tell you what to do first.');
  if (/\b(help|what can you|commands|features|how do you work)\b/.test(l))
    return say('I can:\n- add tasks: "add task for my study", "add fix login bug tomorrow high", or several at once with commas\n- complete / reopen / delete: "complete login", "complete all", "delete old task"\n- edit: "rename login to fix auth", "move login to friday", "make login low priority", "tag docs as study"\n- find and filter: "find login", "show pending", "show bugs", "clear filters"\n- think: "plan my day", "what\'s due today", "summary", "overdue", "break down login"\n- repeat and streaks: \"add gym daily\", \"add read every weekday\", \"show my streaks\"\n- explain the site: drag, edit, themes, saving, status');
  for (const [re, ans] of FAQ) if (re.test(l)) return say(typeof ans === 'function' ? ans() : ans);

  return Object.assign(say('I did not get that. Try "add physics exam tomorrow urgent", "complete login", "plan my day" or ask "what do you know".'), { unknown: true });
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
  const p = TinyBrain.predict(text) || { intent: 'unknown', conf: 0 };
  const KB = root.KNOWLEDGE || [], q = new Set(kw(text));
  // Calculations are recognised directly
  if (/\d/.test(text) && /[+\-*/^%]|\b(?:times|plus|minus|divided|squared)\b/i.test(text)) { const m = KB.find(x => x.id === 'util_math'); if (m) return kAnswer(m, text, tasks); }
  // Keyword check backs up the network for knowledge questions
  let bk = null, bs = 0;
  for (const k of KB) { const s = kWeight(k, q); if (s > bs) { bs = s; bk = k; } }
  if (p.intent === 'unknown' || p.conf < 0.5) return bk && kOverlap(bk, q) >= 2 ? kAnswer(bk, text, tasks) : null;
  if (p.intent.startsWith('k_')) {
    const nk = KB.find(x => 'k_' + x.id === p.intent);
    if (!nk) return null;
    return kAnswer(bk && bk !== nk && bs > kWeight(nk, q) ? bk : nk, text, tasks);
  }
  let intent = p.intent;
  if (intent === 'reopen' && /\b(finished|finish|done|completed)\b/i.test(text) && !/\b(not|didnt|did not|never|still|yet)\b/i.test(text)) intent = 'complete';
  const canned = { plan: 'plan my day', first: 'what should i do first', summary: 'summary', overdue: "what's overdue", help: 'what can you do', greet: 'hi', thanks: 'thanks', optimize: 'optimize', clear_done: 'clear completed', complete_all: 'complete all' };
  const strip = (s, extra) => s.replace(extra, ' ').replace(/\b(?:bro|pls|please|can you|could you|i|im|just|already|the|my|a|an|task|tasks|is|are|was|now|lol|from|list|on|it|me|to|of)\b/gi, ' ').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const known = (t) => t && Brain.find(tasks, t);
  let cmd = canned[intent] || null, res = null, t;
  switch (intent) {
    case 'motivate': res = { reply: MOTIVATE[Math.floor(Math.random() * MOTIVATE.length)] + '\n' + Brain.respond('what should i do first', tasks, []).reply, actions: [] }; break;
    case 'chat': res = { reply: 'That is outside what I know. I can help with your tasks, this site, planning, studying, debugging and quick things like dates, calculations and jokes. Say "what do you know" for the list.', actions: [] }; break;
    case 'add': cmd = 'add ' + (text.replace(/^(?:bro\s+|hey\s+|please\s+|pls\s+|can you\s+|could you\s+)?(?:i\s+(?:need|have|want|gotta|must|should)\s+to\s+|remind me to\s+|(?:add|create|put|new task|make)\s+(?:a\s+)?(?:new\s+)?(?:task\s+)?(?:to\s+|for\s+)?)/i, '').trim() || text); break;
    case 'complete': t = strip(text, /\b(?:finished|finish|done|completed|complete|check off|tick off|mark|with|did)\b/gi); if (!known(t)) return null; cmd = 'complete ' + t; break;
    case 'delete': t = strip(text, /\b(?:delete|remove|cancel|drop|get rid|dont need|anymore|trash|erase)\b/gi); if (!known(t)) return null; cmd = 'delete ' + t; break;
    case 'reopen': t = strip(text, /\b(?:reopen|undo|complete|not done|yet|did not|didnt|finish|finished|uncheck|bring back)\b/gi); if (!known(t)) return null; cmd = 'reopen ' + t; break;
    case 'search': t = strip(text, /\b(?:find|search|where|show|look|for|do have)\b/gi); if (!t) return null; cmd = 'find ' + t; break;
    case 'prio': {
      const level = /not important|\b(low|later|wait|unimportant|lower)\b/i.test(text) ? 'low' : /\b(urgent|important|asap|high|critical|raise)\b/i.test(text) ? 'high' : 'medium';
      t = strip(text, /\b(?:make|set|priority|urgent|important|asap|high|critical|raise|low|later|wait|lower|unimportant|not|super|very|medium|can)\b/gi);
      if (!known(t)) return null; cmd = `make ${t} ${level} priority`; break;
    }
    case 'due': {
      const d = Brain.parseTask(text).due;
      if (!d) return { reply: 'Which date? Try "tomorrow", "friday" or 2026-10-25.', actions: [] };
      t = strip(text, /\b(?:move|postpone|push|delay|reschedule|change|deadline|due|until|tomorrow|tmrw|tmr|today|next week|in \d+ days?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/gi);
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
  }
  if (!res) { if (!cmd) return null; res = Brain.respond(cmd, tasks, []); if (res.unknown) return null; }
  return { ...res, reply: res.reply + `\n(AI read this as "${intent}", ${Math.round(p.conf * 100)}% sure)` };
}


  // Main entry: exact commands first, then the neural net, then keyword knowledge search
  function reply(text, tasks, history) {
    let res = root.Brain.respond(text, tasks, history);
    if (res.unknown) { const n = neuralRespond(text, tasks); if (n) res = n; }
    return res;
  }
  async function init(onProgress) { return root.TinyBrain.train([], onProgress); }
  root.JaltronAI = { reply, init, get ready() { return root.TinyBrain.ready; } };
})(typeof window !== 'undefined' ? window : globalThis);