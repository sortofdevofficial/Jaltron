// JALTRON training data. Edit this file to teach the AI new phrases, then redeploy.
// {slots} are filled with random words from "slots" to create many examples from one template.
// Intents: add complete delete reopen prio due tag search breakdown plan first summary overdue
//          optimize clear_done complete_all help greet thanks motivate chat
(function (root) {
  root.TRAIN = {
    slots: {
      task: ['fix login bug', 'study math', 'read chapter 3', 'call mom', 'write the report', 'deploy the plugin', 'clean my room', 'finish homework', 'update the server', 'buy milk', 'revise biology', 'build the navbar', 'test the api', 'practice guitar', 'pay hosting bill', 'backup the world', 'code the dashboard', 'email the teacher', 'fix lag issue', 'learn javascript'],
      when: ['tomorrow', 'today', 'friday', 'monday', 'saturday', 'next week', 'in 3 days', 'in 2 days', 'tmrw', '2026-10-25'],
      cat: ['study', 'dev', 'bug', 'general'],
      subject: ['study', 'work', 'coding', 'homework', 'project']
    },
    templates: {
      add: ['add {task}', 'add {task} {when}', 'add task {task} high priority', 'remind me to {task} {when}', 'i need to {task}', 'i gotta {task} {when}', 'i have to {task} before {when}', 'put {task} on my list', 'new task: {task}', 'create a task for {task}', 'add a task for my {subject}', 'make a task to {task}', 'dont let me forget to {task}', 'todo {task} {when}', 'i should {task}'],
      complete: ['i finished {task}', 'done with {task}', '{task} is done', 'mark {task} as complete', 'tick off {task}', 'just completed {task}', 'finished {task} lol', 'i already did {task}', '{task} done!', 'check off {task}', 'completed {task}'],
      delete: ['delete {task}', 'remove {task} from my list', 'get rid of {task}', 'cancel {task}', 'drop {task}', 'i dont need {task} anymore', 'trash {task}', 'erase the {task} task'],
      reopen: ['reopen {task}', 'i did not finish {task}', 'undo complete {task}', '{task} is not done yet', 'bring back {task}', 'uncheck {task}'],
      prio: ['make {task} urgent', 'set {task} to high priority', '{task} is super important', '{task} is not important', 'lower the priority of {task}', '{task} can wait, make it low', '{task} is critical', 'raise priority of {task}', '{task} is medium priority'],
      due: ['move {task} to {when}', 'postpone {task} to {when}', 'change the deadline of {task} to {when}', '{task} is due {when}', 'push {task} to {when}', 'reschedule {task} for {when}', 'delay {task} until {when}'],
      tag: ['tag {task} as {cat}', 'put {task} under {cat}', 'mark {task} as a {cat} task', 'change the category of {task} to {cat}', '{task} is a {cat} thing'],
      search: ['find {task}', 'search for {task}', 'where is {task}', 'show me {task}', 'look for {task}', 'do i have {task}'],
      breakdown: ['break down {task}', 'how do i finish {task}', 'split {task} into steps', 'help me start {task}', 'steps for {task}', 'how should i approach {task}'],
      plan: ['plan my day', 'what should i do today', 'make me a schedule', 'organise my day', 'whats the plan', 'give me a plan for today', 'help me plan', 'what is my agenda'],
      first: ['what should i do first', 'whats next', 'where do i start', 'what is most important', 'top priority?', 'what do i do now', 'which task first', 'what should i focus on'],
      summary: ['how am i doing', 'give me a summary', 'how many tasks do i have', 'progress report', 'show my stats', 'overview please', 'how much have i done', 'status', 'how r we doing', 'how am i doing with my tasks', 'how r u doing with tasks', 'am i making progress', 'how is my plan going'],
      overdue: ['whats overdue', 'am i late on anything', 'which tasks are late', 'anything behind schedule', 'what did i miss', 'show late tasks'],
      optimize: ['optimize my plan', 'sort my tasks', 'reorder by priority', 'organize by importance', 'smart sort', 'rank my tasks'],
      clear_done: ['clear completed', 'remove all done tasks', 'clean up finished tasks', 'delete completed tasks', 'get rid of done stuff'],
      complete_all: ['complete everything', 'mark all as done', 'finish all tasks', 'tick everything off'],
      help: ['what can you do', 'help', 'how do you work', 'show commands', 'what are your features', 'how do i use you', '?'],
      greet: ['hi', 'hello', 'hey bro', 'yo', 'good morning', 'sup', 'hey there', 'hola', 'good evening'],
      thanks: ['thanks', 'thank you', 'thx', 'ty bro', 'cheers', 'appreciate it', 'nice one', 'great job'],
      motivate: ['motivate me', 'i am tired', 'i cannot focus', 'i am stressed', 'i feel lazy', 'too many things to do', 'i am overwhelmed', 'i dont feel like working', 'i cant be bothered', 'no motivation today', 'i dont want to do anything', 'im burnt out', 'i keep procrastinating', 'cant be bothered today'],
      chat: ['tell me a joke', 'who made you', 'what is your name', 'are you real ai', 'whats the weather', 'i am bored', 'what is 2+2', 'sing a song', 'do you like pizza', 'tell me something funny', 'u there?', 'are you there', 'how are you', 'say something', 'whats up with you'],
      unknown: ['asdf', 'qwerty', 'blah blah', 'hmm', 'ok', 'lol', 'idk', '...', 'hmmmm', 'k', 'test', 'umm', 'what', 'huh']
    },
    // Extra hand-written examples: ["phrase", "intent"]
    examples: [
      ["what's next?", 'first'], ["plan my day pls :)", 'plan'], ["hi!!!", 'greet'], ["thanks!!", 'thanks'],
      ["knock out the biology revision", 'add'], ["what's on my plate", 'plan'], ["i'm done with the login thing", 'complete'],
      ["nuke the old milk task", 'delete'], ["wat should i do", 'first'], ["tmrw i must study", 'add']
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);