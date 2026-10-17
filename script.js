'use strict';
// JALTRON script generator: builds a structured draft script (YouTube, shorts, movie scenes, podcasts, ads, explainers).
// It runs fully in the browser from templates, so it needs no server or AI service.
(function (root) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? '' : v[k]));
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const span = (a, b) => `[${clock(a)} - ${clock(b)}]`;

  const LABEL = { youtube: 'YouTube video', short: 'Short / Reel / TikTok', movie: 'Movie / short film', podcast: 'Podcast episode', ad: 'Ad / promo', explainer: 'Explainer video' };
  const SECS = {
    youtube: { short: 120, medium: 300, long: 600 },
    explainer: { short: 90, medium: 180, long: 360 },
    short: { short: 15, medium: 30, long: 60 },
    ad: { short: 15, medium: 30, long: 60 },
    podcast: { short: 600, medium: 1200, long: 1800 }
  };
  const SCENES = { short: 1, medium: 2, long: 4 };
  const BODY = { short: 2, medium: 4, long: 6 };

  const TONES = {
    funny: {
      style: 'Playful. Quick cuts, jokes, sound effects and self-aware humour.',
      hooks: ['I tried to figure out {t} so you do not have to. It went about as well as you would expect.', 'Nobody asked, but here is everything about {t} anyway.', '{T}. Sounds boring. Stay with me, I promise it gets weird.'],
      close: ['And that is my chaotic take on {t}.', 'If you laughed even once, my job here is done.'],
      par: ['(deadpan)', '(far too loudly)', '(whispering)', '(rolling eyes)'],
      end: 'A beat of awkward silence. Then, absurdly, a distant car alarm.'
    },
    serious: {
      style: 'Calm and focused. Clear facts, steady pacing, minimal music.',
      hooks: ['Most people get {t} wrong, and it is costing them more than they realise.', 'There is a reason people keep asking about {t}, and almost nobody explains it properly.', 'Before you decide anything about {t}, you need to hear this.'],
      close: ['Understanding {t} is not optional anymore. Take it seriously.', 'The facts are clear. What you do with them is up to you.'],
      par: ['(quietly)', '(firmly)', '(after a pause)', '(measured)'],
      end: 'Silence. Neither of them moves.'
    },
    inspiring: {
      style: 'Warm and uplifting. Slow build, hopeful music, direct eye contact.',
      hooks: ['Everyone starts at zero. Here is how you do not stay there, starting with {t}.', 'You are closer to figuring out {t} than you think.', 'What if one answer about {t} changes everything for you?'],
      close: ['You do not need to be perfect to start with {t}. You just need to begin.', 'Small steps today, big change tomorrow. Go and start.'],
      par: ['(smiling)', '(with quiet confidence)', '(softly)', '(eyes bright)'],
      end: 'A small, hopeful smile. The camera pulls back as light fills the frame.'
    },
    dramatic: {
      style: 'Cinematic. Low music, long pauses, high stakes in every line.',
      hooks: ['It began with a single question about {t}. It did not end quietly.', 'Everything we were told about {t} was only half the story.', 'Some stories about {t} are never told. Until now.'],
      close: ['And so the story of {t} changed everything. Nothing would ever be the same.', 'The story of {t} is far from over.'],
      par: ['(voice breaking)', '(barely a whisper)', '(coldly)', '(trembling)'],
      end: 'Thunder rolls in the distance. The lights flicker, then hold.'
    },
    casual: {
      style: 'Relaxed, like talking to a friend. Natural pauses, simple words.',
      hooks: ['Hey guys, so today we are talking about {t}, and honestly it is easier than it looks.', 'Okay, real talk. Let us figure out {t} together.', 'So I keep getting asked about {t}, which means it is time for a video.'],
      close: ['Anyway, that is {t} in a nutshell. Hope it helped.', 'That is it from me. Go try it out and tell me how it goes.'],
      par: ['(shrugging)', '(laughing)', '(casually)', '(leaning back)'],
      end: 'They share a look, then a laugh. The tension is gone.'
    },
    educational: {
      style: 'Clear and structured. Simple language, on-screen text for key terms.',
      hooks: ['By the end of this video you will understand {t} clearly, step by step.', 'Let us take {t} and break it into simple parts anyone can follow.', '{T} explained: what it is, why it matters and how to use it.'],
      close: ['Now you know the basics of {t}. Practice them and they will stick.', 'Review the key points once more tomorrow and they will stay with you.'],
      par: ['(patiently)', '(clearly)', '(thoughtfully)', '(curious)'],
      end: 'A quiet moment of understanding settles over the room.'
    }
  };

  const POINTS = [
    ['The basics of {t}', 'Define it in one simple sentence, then give a quick everyday example.'],
    ['Why it matters right now', 'Explain the problem it solves and what happens if people ignore it.'],
    ['The biggest mistake people make', 'Show the common mistake, why it happens and how to fix it.'],
    ['Step by step: how to get started', 'Walk through three clear steps. Show each one on screen.'],
    ['A real example', 'Tell a short story or show a real case of {t} in action.'],
    ['Tips most people skip', 'Give two or three quick pro tips. Use on-screen text for each.'],
    ['Myths about {t}', 'Bust one or two popular myths and give a fact for each.'],
    ['What to do next', 'Give one small action the viewer can take today.']
  ];
  const ANALOGY = ['Think of it like this', 'Use an everyday analogy so a complete beginner understands {t} instantly.'];
  const BROLL = ['Screen recording or close-up of the thing being discussed', 'Cutaway examples with text overlay', 'Simple animation or diagram', 'Quick meme or sound effect', 'Over-the-shoulder shot while you demonstrate'];
  const ASKS = ['What surprised you most about {t}?', 'If a beginner asked about {t} today, what would you say first?', 'What is the biggest myth about {t}?', 'Where is the conversation about {t} going in the next few years?', 'What would you change if you started again with {t}?', 'Which tip about {t} gets ignored the most?'];
  const SHORT_BEATS = ['State the one thing most people get wrong about {t}.', 'Show it fast: one clear visual, one sentence.', 'Give the quick fix or tip. Put the key words on screen.', 'Payoff: show the result or the most surprising detail.'];

  const orderedPoints = (n, withAnalogy) => {
    const mid = shuffle(POINTS.slice(1, 7));
    const list = [POINTS[0], ...(withAnalogy ? [ANALOGY] : []), ...mid, POINTS[7]];
    const first = list.slice(0, 1 + (withAnalogy ? 1 : 0)), last = list[list.length - 1];
    const middle = list.slice(first.length, -1).slice(0, Math.max(0, n - first.length - 1));
    return [...first, ...middle, last];
  };

  const build = (o, meta, parts) => {
    const head = [
      `SCRIPT: ${o.T}`,
      `TYPE: ${LABEL[o.type]}   |   TONE: ${cap(o.toneKey)}   |   ${meta}`,
      ...(o.who ? [`${o.type === 'movie' ? 'CHARACTERS' : 'AUDIENCE'}: ${o.who}`] : []),
      `STYLE NOTE: ${o.tone.style}`
    ];
    const body = parts.map(p => p.h + '\n' + p.lines.join('\n')).join('\n\n');
    const foot = '-- Draft by JALTRON. Replace the general lines with your own facts, examples and jokes. --';
    return { text: head.join('\n') + '\n\n' + body + '\n\n' + foot, sections: parts.map(p => p.name) };
  };

  function video(o) {
    const V = { t: o.t, T: o.T }, explainer = o.type === 'explainer';
    const total = SECS[o.type][o.length], n = BODY[o.length];
    const hookEnd = Math.min(15, Math.max(5, Math.round(total * 0.08)));
    const introEnd = hookEnd + Math.max(8, Math.round(total * 0.07));
    const outro = Math.max(10, Math.round(total * 0.08));
    const per = (total - outro - introEnd) / n;
    const shortTitle = o.t.split(/\s+/).slice(0, 3).join(' ').toUpperCase();
    const mins = Math.max(1, Math.round(total / 60));
    const titles = shuffle([`${o.T}: Everything You Need to Know`, `${o.T}: The Simple Way`, `${o.T} in ${mins} Minute${mins > 1 ? 's' : ''}`, `The Truth About ${o.T}`, `${o.T} for Beginners (Simple Guide)`]).slice(0, 3);
    const parts = [
      { name: 'Titles and thumbnail', h: 'TITLE IDEAS', lines: titles.map((x, i) => `${i + 1}. ${x}`).concat([`THUMBNAIL: Close-up face, ${pick(['shocked', 'confident', 'curious'])} expression, big text "${shortTitle}".`]) },
      { name: 'Hook', h: `${span(0, hookEnd)} HOOK`, lines: [`VOICEOVER: ${fill(pick(o.tone.hooks), V)}`, 'VISUAL: Fast montage or a bold statement on screen. Start mid-action, no logo, no long greeting.'] },
      { name: 'Intro', h: `${span(hookEnd, introEnd)} INTRO`, lines: [`VOICEOVER: Welcome back. Today we are covering ${o.t}${o.who ? `, made for ${o.who}` : ''}. Stay until the end, because the last part is the one most people miss.`, `VISUAL: Presenter to camera, title card with "${o.T}".`] }
    ];
    orderedPoints(n, explainer).forEach((p, i) => {
      const a = introEnd + per * i;
      parts.push({ name: fill(p[0], V), h: `${span(a, a + per)} SECTION ${i + 1}: ${fill(p[0], V).toUpperCase()}`, lines: [`VOICEOVER: ${fill(p[1], V)}`, `B-ROLL: ${pick(BROLL)}.`] });
    });
    parts.push({ name: 'Outro and call to action', h: `${span(total - outro, total)} RECAP AND CALL TO ACTION`, lines: [`VOICEOVER: ${fill(pick(o.tone.close), V)}`, `Quick recap: repeat the ${n} points in one sentence each.`, `CTA: If this helped, like and subscribe, and tell me in the comments what you want covered next.`, 'END SCREEN: Show the next video and the subscribe button.'] });
    return build(o, `LENGTH: about ${mins} min`, parts);
  }

  function shortForm(o) {
    const V = { t: o.t, T: o.T }, total = SECS.short[o.length];
    const beats = { short: 2, medium: 3, long: 4 }[o.length];
    const hook = 3, cta = 4, per = (total - hook - cta) / beats;
    const parts = [{ name: 'Hook', h: `${span(0, hook)} HOOK`, lines: [`ON-SCREEN TEXT: "${o.T}?"`, `SAY: ${fill(pick(o.tone.hooks), V)}`, 'VISUAL: Movement in the first frame. No intro, no logo.'] }];
    SHORT_BEATS.slice(0, beats - 1).concat([SHORT_BEATS[3]]).forEach((b, i) => {
      const a = hook + per * i;
      parts.push({ name: `Beat ${i + 1}`, h: `${span(a, a + per)} BEAT ${i + 1}`, lines: [`SAY: ${fill(b, V)}`, 'VISUAL: One clear shot, change angle or cut every 2 to 3 seconds.'] });
    });
    parts.push({ name: 'Call to action', h: `${span(total - cta, total)} CALL TO ACTION`, lines: [`SAY: ${fill(pick(o.tone.close), V)}`, 'ON-SCREEN TEXT: "Follow for more"', 'AUDIO: Trending sound at low volume under your voice.'] });
    return build(o, `LENGTH: about ${total} sec`, parts);
  }

  function podcast(o) {
    const V = { t: o.t, T: o.T }, total = SECS.podcast[o.length], n = BODY[o.length];
    const cold = 30, intro = 90, outro = 90, per = (total - cold - intro - outro) / n;
    const parts = [
      { name: 'Cold open', h: `${span(0, cold)} COLD OPEN`, lines: [`HOST: ${fill(pick(o.tone.hooks), V)}`, 'SOUND: Short music sting.'] },
      { name: 'Intro', h: `${span(cold, cold + intro)} INTRO`, lines: [`HOST: Welcome to the show. Today we are talking about ${o.t}${o.who ? `, for ${o.who}` : ''}. Here is what we will cover, and why it matters.`] }
    ];
    const qs = shuffle(ASKS);
    orderedPoints(n, false).forEach((p, i) => {
      const a = cold + intro + per * i;
      parts.push({ name: fill(p[0], V), h: `${span(a, a + per)} SEGMENT ${i + 1}: ${fill(p[0], V).toUpperCase()}`, lines: [`TALKING POINTS: ${fill(p[1], V)}`, `ASK: ${fill(qs[i % qs.length], V)}`] });
    });
    parts.push({ name: 'Outro', h: `${span(total - outro, total)} OUTRO`, lines: [`HOST: ${fill(pick(o.tone.close), V)}`, 'HOST: Thanks for listening. Subscribe, leave a rating and send us your questions for the next episode.', 'SOUND: Outro music fades out.'] });
    return build(o, `LENGTH: about ${Math.round(total / 60)} min`, parts);
  }

  function ad(o) {
    const V = { t: o.t, T: o.T }, total = SECS.ad[o.length], q = total / 4;
    const problems = ['Life is busy, and the old way just is not cutting it.', 'We have all been there: too much to do and no good way to do it.', 'Be honest, have you ever wished this was easier?'];
    const proofs = ['Thousands of people already use it.', 'You will see the difference on day one.', 'Simple to start, hard to put down.'];
    const parts = [
      { name: 'Hook', h: `${span(0, q)} HOOK`, lines: [`VO: ${pick(problems)}`, 'VISUAL: Relatable frustration, shown in two quick shots.'] },
      { name: 'Solution', h: `${span(q, q * 2)} SOLUTION`, lines: [`VO: Introducing ${o.t}${o.who ? `, made for ${o.who}` : ''}. Simple, fast and built around you.`, 'VISUAL: Product or service shown clearly, clean background.'] },
      { name: 'Proof', h: `${span(q * 2, q * 3)} PROOF`, lines: [`VO: ${pick(proofs)}`, 'VISUAL: Result, testimonial or before-and-after.'] },
      { name: 'Call to action', h: `${span(q * 3, total)} CALL TO ACTION`, lines: [`VO: ${fill(pick(o.tone.close), V)} Try ${o.t} today.`, 'ON-SCREEN TEXT: Name, offer and link or where to find it.'] }
    ];
    return build(o, `LENGTH: about ${total} sec`, parts);
  }

  const LOCS = ['INT. APARTMENT', 'EXT. PARKING LOT', 'EXT. RAIN-SOAKED STREET', 'INT. OLD LIBRARY', 'EXT. ROOFTOP', 'INT. CROWDED CAFE', 'INT. DIM HALLWAY'];
  const TIMES = ['NIGHT', 'DAY', 'DAWN', 'DUSK'];
  const ACTION = {
    setup: ['{A} sits alone, turning over a crumpled note. Written on it, in shaky handwriting: "{t}". {B} walks in, trying not to look worried.', 'Silence. {A} stares at a wall covered in notes and photos, all about "{t}". The door creaks. {B} steps in.'],
    conflict: ['The room feels smaller. {A} paces. {B} blocks the doorway, arms crossed.', 'Rain hammers the windows. {A} slams a folder on the table. Inside: everything about "{t}".'],
    turn: ['{B} hands over a small, sealed envelope. {A} opens it slowly. The colour drains from their face.', 'A phone buzzes. {A} reads the message twice, then looks up at {B}. Everything has changed.'],
    ending: ['Soft light spills across the space. {A} and {B} stand side by side, finally calm.', 'The worst is over. {A} folds the note and slips it into a pocket. {B} nods once.']
  };
  const TALK = {
    setup: [['A', 'You heard about the whole "{t}" situation, did you not?'], ['B', 'Everyone has. Nobody wants to say it out loud.'], ['A', 'Then I will say it. We cannot ignore this anymore.'], ['B', 'And if we are wrong?']],
    conflict: [['B', 'This is about "{t}", is it not? You have been hiding something.'], ['A', 'I was protecting you.'], ['B', 'From what? The truth?'], ['A', 'From what it costs.']],
    turn: [['A', 'Wait. If "{t}" is real, then everything we did...'], ['B', '...was part of it. All of it.'], ['A', 'Why tell me now?'], ['B', 'Because you were about to find out anyway.']],
    ending: [['A', 'So what happens now?'], ['B', 'Now we decide what "{t}" means for us.'], ['A', 'Together?'], ['B', 'Together.']]
  };

  function movie(o) {
    const names = String(o.who || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const A = names[0] || 'ALEX', B = names[1] || (A === 'MAYA' ? 'ALEX' : 'MAYA');
    const V = { t: o.t, T: o.T, A, B };
    const n = SCENES[o.length];
    const beats = n === 1 ? ['conflict'] : n === 2 ? ['setup', 'ending'] : ['setup', 'conflict', 'turn', 'ending'];
    const parts = [{ name: 'Title and logline', h: 'TITLE AND LOGLINE', lines: [`WORKING TITLE: ${o.T.toUpperCase()}`, `LOGLINE: A story about ${o.t}: ${A} and ${B} must choose between what is safe and what is right.`, '', 'FADE IN:'] }];
    beats.forEach((b, i) => {
      const last = i === beats.length - 1;
      const lines = [fill(pick(ACTION[b]), V), ''];
      TALK[b].forEach(([who, text], k) => {
        lines.push(' '.repeat(22) + (who === 'A' ? A : B));
        if (k % 2 === 1 || Math.random() < 0.35) lines.push(' '.repeat(16) + pick(o.tone.par));
        lines.push(' '.repeat(10) + fill(text, V), '');
      });
      if (last) lines.push(o.tone.end, '', 'FADE OUT.'); else lines.push('CUT TO:');
      parts.push({ name: `Scene ${i + 1}`, h: `${pick(LOCS)} - ${pick(TIMES)}  (SCENE ${i + 1}: ${b.toUpperCase()})`, lines });
    });
    return build(o, `LENGTH: ${n} scene${n > 1 ? 's' : ''}`, parts);
  }

  function generate(opts) {
    const type = LABEL[opts && opts.type] ? opts.type : 'youtube';
    const toneKey = TONES[opts && opts.tone] ? opts.tone : 'casual';
    const length = SCENES[opts && opts.length] ? opts.length : 'medium';
    const t = String((opts && opts.topic) || '').trim().replace(/[.!?]+$/, '').slice(0, 120) || 'my idea';
    const o = { type, toneKey, tone: TONES[toneKey], length, t, T: cap(t), who: String((opts && opts.who) || '').trim().slice(0, 60) };
    const r = type === 'movie' ? movie(o) : type === 'short' ? shortForm(o) : type === 'podcast' ? podcast(o) : type === 'ad' ? ad(o) : video(o);
    return { ...r, topic: t };
  }

  root.ScriptGen = { generate, TYPES: LABEL, TONES: Object.keys(TONES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ScriptGen;
})(typeof window !== 'undefined' ? window : globalThis);