# Answers for the site assistant

Open this in Notepad or Word, edit the `A:` lines, and change each `STATUS:` to
`OK` when you are happy with it. Then run:

    node scripts/import-answers.mjs
    node scripts/build-kb.mjs

Only entries marked `OK` are imported. Everything else is ignored, so you can do
five today and the rest whenever.

## How to read the STATUS lines

    NEEDS-REVIEW   I drafted this from the page, the resume or the repo. It is
                   probably close, but check it — I can get emphasis wrong.
    GUESS          I made this up. It is a starting point so you are not facing
                   a blank page, and it is very likely wrong about you. Rewrite
                   it. Do not just mark it OK.
    YOURS-ONLY     I did not draft anything because nothing on the page tells me
                   the answer and a guess would be a fabrication about you.

The importer refuses anything not marked `OK`, so nothing here reaches the site
by accident.

## The two rules for anything you write here

1. **It has to be true and it has to be yours.** Everything else the assistant
   knows is generated from the page or the resume, so a reader can check it.
   These lines are the only ones nobody can check. That is the whole cost of
   this file.
2. **Anyone can read it.** It goes on a public page and is answerable to a
   stranger. Nothing here that you would not say to a recruiter you had not met.

Short is fine. Two sentences beats a paragraph. If an answer would be better
said on the page itself, tell me and I will put it there instead — then the
assistant gets it for free and there is no second copy to drift.

---

# A. Working with you

### Q: Are you available for work right now?
STATUS: NEEDS-REVIEW
A: Yes — I'm open to remote work, with a flexible schedule and a reliable setup. I'm currently on a contract with MDS Pro Solutions, so it depends on the shape of the work. The form at the bottom of this page reaches me directly and I'll answer it myself.

### Q: What kind of work are you looking for next?
STATUS: YOURS-ONLY
A:

### Q: What are your rates?
STATUS: NEEDS-REVIEW
A: That depends on the scope and the length of the engagement, so I'd rather answer it properly than guess at a number here. Send the details through the form and I'll come back to you.

### Q: Are you open to full-time roles, or contract only?
STATUS: YOURS-ONLY
A:

### Q: What time zone are you in, and how do you handle overlap?
STATUS: NEEDS-REVIEW
A: I'm in Manila, so UTC+8. I've been working daily with an owner in the US on the MDS Pro contract, so a few hours of overlap is normal for me rather than an adjustment.

### Q: Can you start soon?
STATUS: YOURS-ONLY
A:

### Q: Do you work with a team, or solo?
STATUS: NEEDS-REVIEW
A: Solo, so far. Every project on this page was built by me end to end — architecture, deployment and the bugs. That means I'm used to owning the whole thing, and it also means I haven't worked inside a large team's process yet.

### Q: What does a good brief look like to you?
STATUS: GUESS
A: The problem, who has it, and what happens today instead. I'd rather have a rough description of the actual pain than a detailed spec for a solution — if the spec is already written I usually end up asking what it was meant to fix anyway.

# B. The work

### Q: Which project are you proudest of, and why?
STATUS: YOURS-ONLY
A:

### Q: What's the biggest thing you've built?
STATUS: NEEDS-REVIEW
A: MDS Pro Solutions — the internal timekeeping and billing platform a US healthcare company runs on. Thirteen people use it every workday: a nursing team across the Philippines and the owner in the US. I'm the only engineer on it.

### Q: What is WordWarz?
STATUS: NEEDS-REVIEW
A: A real-time multiplayer word game, on the web and as a native iOS app with Android in review. The part I'd point at is the bot engine — it picks guesses by information gain rather than from a word list, with a constraint solver for the edge cases and ELO-based matchmaking. 570 players have reached a game across 1,045 multiplayer matches, grown entirely by word of mouth.

### Q: How many people actually use the things you've built?
STATUS: NEEDS-REVIEW
A: MDS Pro has 13 daily users and is in production every workday. WordWarz has had 570 players reach a game since launch, with 176 active in the last 30 days as of August 2026. The rest are smaller or personal.

### Q: What's the hardest technical problem you've solved?
STATUS: GUESS
A: Getting one pay calculation to hold across the timesheet, the payroll and the client invoice at MDS Pro. Three surfaces, three different shapes of output, and a 40-hour weekly cap, a break trim against a shift window that moves with DST, an idle trim and a period ceiling all interacting. They have to agree to the cent, because someone is paid on one and billed on another.

### Q: Why is MDS Pro's dashboard vanilla JS with no framework?
STATUS: GUESS
A: It started small and never needed one. Six thousand lines across seven surfaces is not a lot when there's no build step to maintain and nothing to upgrade. I'd reach for a framework if the team grew — the argument for one is mostly about other people, not about the code.

### Q: What's Casinore?
STATUS: NEEDS-REVIEW
A: A hobby experiment — I wanted to understand Web3 by building with it rather than reading about it. It's on the page as what it is, not as client work.

### Q: Do you have code I can look at?
STATUS: NEEDS-REVIEW
A: Some. github.com/kimlj has RecodeAI and this site. Most of the rest is either client work I can't open up or private repos — MDS Pro is somebody's payroll system, so that one isn't mine to share.

### Q: What's the AI showcase on this page?
STATUS: NEEDS-REVIEW
A: Eight AI systems I've built, each listed with the constraint it's held to rather than just what it does. The site assistant has no tools and no database; the plain-English database querying runs through a read-only Postgres role; the avatar pipeline uses a fixed seed and a node graph. The constraint is the interesting part — a system that can reach anything will eventually claim anything.

### Q: What have you shipped that people actually pay for?
STATUS: YOURS-ONLY
A:

### Q: What's something on this page you'd rebuild differently now?
STATUS: YOURS-ONLY
A:

# C. How you build

### Q: How do you approach a new project?
STATUS: GUESS
A: I try to find the thing that would be worst to get wrong and build that first. On MDS Pro that was the pay calculation, because everything downstream is a rendering of it. The parts that are easy to change I leave until I know more.

### Q: What do you care about that other developers don't seem to?
STATUS: NEEDS-REVIEW
A: That two things never disagree. One pay calculation behind three surfaces. Timestamps set by the server, not the browser. Rows appended rather than edited, so every change stays attributed. None of it is clever — it's the difference between software people trust and software they end up double-checking by hand.

### Q: How do you test your work?
STATUS: YOURS-ONLY
A:

### Q: How do you handle a bug in production?
STATUS: GUESS
A: Find out whether it's actually happening before hunting it — I've lost time to bugs that turned out to be a stale browser tab. Then reproduce it, fix it, and check the fix by making it fail without the patch. If it touched money or a timestamp I go and look at what else reads the same code.

### Q: What's your biggest weakness as a developer?
STATUS: YOURS-ONLY
A:

### Q: How do you decide when something is done?
STATUS: GUESS
A: When I'd be comfortable with someone using it without me there to explain it. That's usually later than when it works.

### Q: Do you write documentation?
STATUS: NEEDS-REVIEW
A: For anything I'll come back to, yes — and it records why rather than what. The comments worth keeping in my code are the ones about a bug that actually happened, because that's the thing the next reader can't work out from the source.

### Q: What's your take on AI-assisted development?
STATUS: NEEDS-REVIEW
A: I use it heavily and I'm open about it — the Build Activity section on this page counts the hours. What I don't do is let it decide anything I can't check. Every AI system in my showcase is listed with the constraint it's held to, and that's the same instinct: the model is fast, but it isn't accountable, and I am.

# D. Background

### Q: What got you into building software?
STATUS: YOURS-ONLY
A:

### Q: Tell me about your education.
STATUS: NEEDS-REVIEW
A: BS Information Technology at AMA Computer College Makati — three of four years done. The degree isn't conferred; one year remains. Most of what I actually use I learned by building something that broke and working out why.

### Q: Why isn't your degree finished?
STATUS: YOURS-ONLY
A:

### Q: How long have you been doing this?
STATUS: NEEDS-REVIEW
A: Independently since 2018, on and off — 5+ years of it. The MDS Pro contract, which is my first production system in daily use by other people, started June 2026.

### Q: What does "on-and-off" mean?
STATUS: YOURS-ONLY
A:

### Q: Where are you based?
STATUS: NEEDS-REVIEW
A: Quezon City, Metro Manila, in the Philippines. I work remotely.

# E. About this assistant

### Q: Are you actually Kim, or a bot?
STATUS: NEEDS-REVIEW
A: A bot — I'm the assistant on Kim's site, answering in his voice from what this page says. If you want Kim himself, the form at the bottom reaches him directly.

### Q: How do you work?
STATUS: NEEDS-REVIEW
A: I answer from a fixed knowledge file built from this page and Kim's resume. No tools, no database, no search. That means I can't look anything up — but it also means there's nothing for me to invent from, which is the point.

### Q: What can't you answer?
STATUS: NEEDS-REVIEW
A: I can tell you about Kim's projects, the technologies behind them and his experience. Anything outside that, the form at the bottom of the page reaches him directly.

### Q: Did Kim build you?
STATUS: NEEDS-REVIEW
A: Yes — I'm one of the systems in the AI showcase on this page, and the constraint I'm held to is listed there like all the others: no tools, no database.
