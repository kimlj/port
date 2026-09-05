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

### Q: Can you work independently?
STATUS: OK
A: Yes — that's been most of my experience so far. Every project on this page I built end to end, which means when something broke there was nobody to escalate it to. I'm used to deciding what to build next, researching my way through problems I haven't seen before, and being accountable for the result.

### Q: What's your experience working with clients?
STATUS: OK
A: My main experience is MDS Pro, where I work directly with the business owner in the US and with the nursing team who use the system every day. That means gathering requirements from people who aren't technical, explaining trade-offs in plain terms, and handling bug reports and change requests from actual users. It's one client rather than an agency's worth, but it's ongoing and the users are real.

### Q: How do you communicate when requirements are unclear?
STATUS: OK
A: I ask rather than guess — usually by describing back what I think is wanted and what it would actually do, so it can be corrected against something concrete instead of an abstract question. If it's still unclear, I'll build the smallest version that shows the idea and let people react to that. A wrong assumption caught early is much cheaper than one found after it's built.

### Q: What does a good brief look like to you?
STATUS: GUESS
A: The problem, who has it, and what people do today instead. I'd rather have a rough description of the actual pain than a detailed spec for a solution — if the spec is already written I usually end up asking what it was meant to fix anyway.

### Q: Why should we hire you?
STATUS: OK
A: I think my biggest strength is ownership. I don't just like building individual features — I like understanding the whole system, from the user's problem and database design to the application, deployment, testing, and maintenance. I'm still growing as an engineer, especially in larger team environments, but I've already had to take real responsibility for software that people depend on every day. I also learn quickly and use AI and research heavily to get through problems I haven't encountered before.

### Q: Why should we choose you over another junior developer?
STATUS: OK
A: Because I've had to own something in production. MDS Pro is used every workday by people whose pay depends on it, and when it breaks it's mine to fix — that changes how you think about data, edge cases and deployment in a way that side projects alone don't. I'd also say I'm straightforward about what I haven't done yet, which I think matters more in a junior hire than someone who claims to have done everything.

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

### Q: What's interesting about the WordWarz bots?
STATUS: OK
A: They choose guesses by information gain rather than from a fixed word list — each guess is picked to eliminate as many remaining possibilities as it can, with a constraint solver for the edge cases where that isn't enough. There's also ELO-based matchmaking across five tiers with some deliberate imperfection modelling, so a lower-tier bot plays like a person rather than like a solver that's been slowed down.

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

### Q: Can you show us your work?
STATUS: OK
A: WordWarz is live at wordwarz.io and on the App Store. RecodeAI and this site are on github.com/kimlj, and this page walks through the AI systems in some detail. MDS Pro is a client's payroll system so the repository isn't mine to open, but I'm happy to give a live walkthrough of the dashboard and explain the parts I built.

### Q: Have you deployed production applications?
STATUS: OK
A: Yes. MDS Pro runs in production and is used every workday. WordWarz is deployed on a Linux VPS behind Nginx in Docker and ships to the iOS App Store through Codemagic CI, with Android in review. This site is on Vercel. Deployment and everything around it — CI, environment configuration, backups — has been my responsibility on all of them.

### Q: Have you worked with sensitive business data?
STATUS: OK
A: Yes. MDS Pro handles timekeeping and payroll for a healthcare business, so it holds people's hours, their pay and client billing. That shaped how it's built: access is enforced in the database with row-level security rather than only in the application, records are appended rather than edited so every change stays attributed, and there are nightly encrypted off-site backups. It's also why I'm careful about what I can show publicly.

### Q: What's the AI showcase on this page?
STATUS: OK
A: The AI showcase is a collection of AI systems I've built for different problems, from natural-language database querying to automation and content pipelines. What I care about most isn't just getting an LLM to produce an impressive answer — it's designing constraints around it so the system behaves predictably and can be checked. I use AI heavily in my own development, but I still treat the model as a component of the system rather than the system itself.

### Q: What have you shipped that people actually pay for?
STATUS: NEEDS-REVIEW
A: MDS Pro Solutions — a one-time build with ongoing monthly maintenance. WordWarz is free to play.

### Q: What's something on this page you'd rebuild differently now?
STATUS: OK
A: Probably RecodeAI. AI development is moving so quickly that some of the assumptions I made when I built it are already outdated. If I rebuilt it today, I'd focus less on building a static showcase around a particular AI workflow and more on making the underlying system easier to change as models and tools evolve.

# C. Technologies

### Q: What technologies do you use most?
STATUS: OK
A: Day to day it's TypeScript and JavaScript, React and Next.js on the front end, Node.js and Fastify on the back, and Postgres for data. Python for the AI and automation pipelines. The Skills section on this page lists each technology against the project it was actually used in, so you can see where every one of them comes from rather than taking my word for it.

### Q: What's your experience with databases?
STATUS: OK
A: Mostly Postgres, through Supabase. On MDS Pro I designed the schema and wrote 37 row-level-security migrations, so access control is enforced in the database rather than only in the application code. Integrity matters a lot there — timestamps set by the server rather than the browser, records appended rather than edited in place, and every change attributed to whoever made it.

### Q: What's your experience with APIs?
STATUS: OK
A: I've built REST APIs with Node and Fastify, and real-time systems over WebSockets with Socket.IO for WordWarz. I've also integrated a fair number of third-party ones — the Google Sheets API for MDS Pro's billing sync, the Claude and OpenAI APIs for the AI features, Brevo for transactional email, and Gmail through n8n for the job alert pipeline.

### Q: What's your experience with cloud services?
STATUS: OK
A: Vercel for web deployment, Supabase for Postgres and realtime, Google Cloud on Casinore, and a self-managed Linux VPS with Nginx and Docker for WordWarz. I'm comfortable running my own infrastructure when that's the right call and using a managed platform when it isn't. I haven't worked inside a large AWS or GCP environment with a dedicated infrastructure team, so that's somewhere I'd be learning.

### Q: What's your experience with AI and LLMs?
STATUS: OK
A: It's a large part of what I do. I've shipped natural-language database querying on the Claude API where the generated SQL runs through a read-only Postgres role, a scoped site assistant with no tools and no database, resume-aware job matching on GPT-4o, and image pipelines in ComfyUI and Stable Diffusion. The part I've spent most time on isn't prompting — it's the design around the model: what it can reach, what it can't, and how someone checks its answer afterwards.

### Q: How quickly can you learn a new technology?
STATUS: OK
A: Quickly, and that's been most of how I've learned. I research first — how other people solved the problem and what went wrong for them — then build something small with it before committing to it. WordWarz's bot engine, the ComfyUI pipelines and the n8n automation were all things I hadn't used before I started them.

### Q: What's something you don't know yet?
STATUS: OK
A: Working inside a larger engineering team — code review at scale, shared ownership of a codebase, and the process that comes with it. I also haven't worked in a big managed cloud environment or alongside a dedicated DevOps or QA function. Those are the gaps I'd most like to close, and the ones I'd expect a first team role to teach me.

# D. How you build

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

# E. Background

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

### Q: What kind of developer do you want to become?
STATUS: OK
A: Someone who can be handed a vague problem and be trusted to come back with a system that works and keeps working. I want to get much stronger in the areas I've had least exposure to — working within a team, and the engineering process around the code rather than just the code. Longer term I'd like to keep working where AI is part of the product, because designing the constraints around a model is the problem I find most interesting right now.

# F. About this assistant

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
