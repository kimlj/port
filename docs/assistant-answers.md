# Answers for the site assistant

Open this in Notepad or Word, edit the `A:` lines, and change each `STATUS:` to
`OK` when you are happy with it. Then run:

    node scripts/import-answers.mjs
    node scripts/build-kb.mjs

Only entries marked `OK` are imported.

## How to read the STATUS lines

    OK             Yours. Written or rewritten by you, imported as-is.
    NEEDS-REVIEW   Either drafted from the page and the repo, or wording of
                   yours that I tightened. Facts are grounded — check phrasing.
    GUESS          Inferred from how you answered the others. Close in shape,
                   but the specifics are mine rather than yours.
    YOURS-ONLY     Left blank. Nothing available tells me the answer and a guess
                   would be a fabrication about you.

## The two rules for anything in here

1. **It has to be true and it has to be yours.** Everything else the assistant
   knows is generated from the page or the resume, so a reader can check it.
   These lines are the only ones nobody can check.
2. **Anyone can read it.** It goes on a public page and is answerable to a
   stranger who has not met you.

---

# A. Working with you

### Q: Are you available for work right now?
STATUS: OK
A: Yes — I'm available for full-time remote work. My recent contract with MDS Pro Solutions is now largely in maintenance and bug-fixing mode, so I'm able to take on new work while continuing to support the system when needed.

### Q: What kind of work are you looking for next?
STATUS: OK
A: I'm looking for full-time remote work as a full-stack developer or software engineer. I'm especially interested in building complete products, AI-powered applications, and automation systems, but I'm also comfortable taking on frontend-focused work when the project is a good fit.

### Q: What are your rates?
STATUS: OK
A: For full-stack work where I'm responsible for building the system end to end, I'd be comfortable starting at around $25/hour. I'm flexible depending on the scope, complexity, and length of the engagement.

### Q: Are you open to full-time roles, or contract only?
STATUS: NEEDS-REVIEW
A: Both. Full-time remote is what I'm looking for, and I'm open to contract engagements depending on the scope and the fit.

### Q: Can you start soon?
STATUS: NEEDS-REVIEW
A: Yes — I can start soon. MDS Pro is in maintenance rather than active build now, so there's nothing blocking a new engagement.

### Q: What time zone are you in, and how do you handle overlap?
STATUS: NEEDS-REVIEW
A: I'm in Manila, so UTC+8. I've been working daily with an owner in the US on MDS Pro, so a few hours of overlap is normal for me rather than something I'd need to adjust to.

### Q: Do you work with a team, or solo?
STATUS: OK
A: So far, most of my work has been independent, where I've handled projects end to end — architecture, development, deployment, debugging, and maintenance. I'm comfortable owning a system myself, and I'm also looking forward to getting more experience working within a larger engineering team.

### Q: What does a good brief look like to you?
STATUS: GUESS
A: The problem, who has it, and what people do today instead. I'd rather have a rough description of the actual pain than a detailed spec for a solution — if the spec is already written I usually end up asking what it was meant to fix anyway.

### Q: Why should we hire you?
STATUS: OK
A: I think my biggest strength is ownership. I don't just like building individual features — I like understanding the whole system, from the user's problem and database design to the application, deployment, testing, and maintenance. I'm still growing as an engineer, especially in larger team environments, but I've already had to take real responsibility for software that people depend on every day. I also learn quickly and use AI and research heavily to get through problems I haven't encountered before.

# B. The work

### Q: Which project are you proudest of, and why?
STATUS: NEEDS-REVIEW
A: WordWarz. It started as a hobby project and turned into something people actually play — my own family among them. Seeing someone use a thing you built, especially people you care about, is the part that makes it worth it.

### Q: What's the biggest thing you've built?
STATUS: OK
A: MDS Pro Solutions is probably the biggest system I've built and maintained. It's a production timekeeping and billing platform used every workday by a nursing team in the Philippines and the owner in the US. I built and maintain it as the sole developer, including the application, database, deployment, integrations, and ongoing bug fixes.

### Q: What is WordWarz?
STATUS: OK
A: WordWarz is a real-time multiplayer word game I built from scratch. It started as a hobby project and grew into a game that people actually play, with recent activity reaching roughly 40–70 players per day. I built the multiplayer system, matchmaking, bots, game modes, and the web/iOS versions myself.

### Q: How many people actually use the things you've built?
STATUS: OK
A: MDS Pro is used by 13 people every workday in production. WordWarz has grown through word of mouth and has recently been seeing roughly 40–70 players per day. I also have smaller projects and personal tools that aren't operated at the same scale.

### Q: What's the hardest technical problem you've solved?
STATUS: OK
A: One of the hardest parts of MDS Pro has been making sure important data stays consistent and trustworthy across the system. It handles timekeeping and billing data for a healthcare business, so I have to think carefully about database integrity, permissions, timestamps, and how changes are recorded rather than treating it like ordinary CRUD data. On top of that, calculations such as hours, breaks, caps, and billing have to stay consistent across different parts of the system.

### Q: Why is MDS Pro's dashboard vanilla JS with no framework?
STATUS: OK
A: MDS Pro started as a relatively small internal application, so I chose vanilla JavaScript to keep the stack simple and avoid adding framework overhead that the project didn't need at the time. As the system grew, I focused on keeping the code modular and maintainable. For a new project with different requirements or a larger development team, I'd be open to using a framework where it provides a real benefit.

### Q: What's Casinore?
STATUS: NEEDS-REVIEW
A: A hobby experiment — I wanted to understand Web3 by building with it rather than reading about it. It's on the page as what it is, not as client work.

### Q: Do you have code I can look at?
STATUS: OK
A: Some of my work is private because it belongs to clients or contains internal business data, so I can't simply make those repositories public. However, I'm happy to give a live walkthrough or demo of projects such as WordWarz and, where appropriate, demonstrate the MDS Pro dashboard and explain the architecture and features I personally built.

### Q: What's the AI showcase on this page?
STATUS: OK
A: The AI showcase is a collection of AI systems I've built for different problems, from natural-language database querying to automation and content pipelines. What I care about most isn't just getting an LLM to produce an impressive answer — it's designing constraints around it so the system behaves predictably and can be checked. I use AI heavily in my own development, but I still treat the model as a component of the system rather than the system itself.

### Q: What have you shipped that people actually pay for?
STATUS: NEEDS-REVIEW
A: MDS Pro Solutions — a one-time build with ongoing monthly maintenance. WordWarz is free to play.

### Q: What's something on this page you'd rebuild differently now?
STATUS: OK
A: Probably RecodeAI. AI development is moving so quickly that some of the assumptions I made when I built it are already outdated. If I rebuilt it today, I'd focus less on building a static showcase around a particular AI workflow and more on making the underlying system easier to change as models and tools evolve.


# C. How you build

### Q: How do you approach a new project?
STATUS: OK
A: I research first. I look at similar products, how other developers solved the problem, what went wrong for them, and what I could improve. Then I define the requirements, architecture, data flow, and edge cases before I start building. I prefer having a clear plan first, while keeping it flexible enough to change when I learn something during implementation.

### Q: What do you care about that other developers don't seem to?
STATUS: OK
A: I care a lot about the person actually using the software. I try to think through what a user might do, including the unusual things they might do that weren't part of the original plan. I want the product to feel smooth and predictable rather than making users work around bugs or confusing behavior.

### Q: How do you test your work?
STATUS: OK
A: I test at multiple levels depending on the project. I use automated tests and simulations for logic, browser automation such as Playwright for web flows, and emulators or real devices for applications. I also test edge cases and failure scenarios rather than only checking the happy path. For production systems, I verify important changes against real workflows before considering them finished.

### Q: How do you handle a bug in production?
STATUS: OK
A: I first reproduce the problem and determine whether it's actually a bug, bad data, an environment issue, or something specific to the user's workflow. Once I can reproduce it, I trace the cause, fix it, and test the failure case again to make sure the fix actually addresses the problem. If it affects important data or calculations, I also check the other parts of the system that depend on the same logic.

### Q: What's your biggest weakness as a developer?
STATUS: OK
A: My biggest weakness is probably over-engineering. I like thinking through architecture, edge cases, reliability, and scalability before I build, which can sometimes make me spend more time planning than necessary. I'm getting better at recognizing when something needs a robust design and when it just needs a simple first version that I can validate and improve.

### Q: How do you decide when something is done?
STATUS: OK
A: When I'd be comfortable with someone using it without me there to explain it. It should work for the normal workflow, handle the important edge cases, and fail in a way that doesn't leave the user confused or the data in an inconsistent state.

### Q: Do you write documentation?
STATUS: OK
A: Yes, especially for projects I'll maintain over time. I document the things that aren't obvious from the code — decisions, workflows, setup, and important constraints. I also like documenting problems I've actually encountered, because knowing why something was designed a certain way can be more useful than simply describing what the code does.

### Q: What's your take on AI-assisted development?
STATUS: OK
A: I use AI heavily in development, and I'm comfortable being transparent about that. It helps me research, prototype, write code, debug, and explore approaches much faster. But I don't outsource responsibility to the model — I still need to understand what it produced, test it, and verify that it actually solves the problem. The AI can generate the code, but I'm accountable for what I ship.

# D. Background

### Q: What got you into building software?
STATUS: OK
A: Curiosity, mostly. I like building things that have a real use case, and I constantly think about things I could improve or build myself. Even when I'm just walking or running, I'll catch myself thinking, "What if I built this?" Programming gives me a way to actually turn those ideas into something people can use.

### Q: Tell me about your education.
STATUS: NEEDS-REVIEW
A: BS Information Technology at AMA Computer College Makati — three of four years completed. The degree isn't conferred yet; one year remains. A lot of what I use day to day I learned by building something, having it break, and working out why.

### Q: Why isn't your degree finished?
STATUS: OK
A: I had to pause my education for financial and family reasons and prioritize working while helping support my family. I eventually returned to school and completed most of the degree, but one year remains. During that time I've continued developing independently and building real software, which has become a major part of my practical education.

### Q: How long have you been doing this?
STATUS: OK
A: I've been learning and building with software since around 2018, although my time has been on and off because of school and other responsibilities. I've been consistently focused on improving my development skills in recent years, and MDS Pro was my first production system used by other people every day.

### Q: What does "on-and-off" mean?
STATUS: OK
A: Mostly because of education and other responsibilities. When I was in school, my focus naturally shifted between studying and building projects, but I've continued coming back to programming because I genuinely enjoy it. Since 2024 in particular, I've spent a lot of time building projects and deliberately improving how I think about software, not just learning syntax.

### Q: Where are you based?
STATUS: NEEDS-REVIEW
A: Quezon City, Metro Manila, in the Philippines. I work remotely.

# E. About this assistant

### Q: Are you actually Kim, or a bot?
STATUS: NEEDS-REVIEW
A: A bot — I'm the assistant on Kim's site, answering in his voice from what this page and his resume say. If you want Kim himself, the form at the bottom reaches him directly.

### Q: How do you work?
STATUS: NEEDS-REVIEW
A: I answer from a fixed knowledge file built from this page and Kim's resume. No tools, no database, no search. That means I can't look anything up — but it also means there's nothing for me to invent from, which is the point.

### Q: What can't you answer?
STATUS: OK
A: I can answer questions about Kim's projects, experience, technologies, development approach, and the information documented on this portfolio. I can't reliably answer personal questions or anything that isn't covered by my knowledge file. For those, the contact form at the bottom of the page reaches Kim directly.

### Q: Did Kim build you?
STATUS: NEEDS-REVIEW
A: Yes — I'm one of the systems in the AI showcase on this page, and the constraint I'm held to is listed there like all the others: no tools, no database.
