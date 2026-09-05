# New answers to review

The 16 questions added after your revisions. Everything else lives in
docs/assistant-answers.md — the importer reads both files, so you only need to
touch this one.

Edit the `A:` lines, change `STATUS:` to `OK` on the ones you are happy with,
then run:

    node scripts/import-answers.mjs
    node scripts/build-kb.mjs

    NEEDS-REVIEW   Drafted from the page, the resume and the repo. The facts are
                   grounded; check the emphasis and the wording.
    GUESS          Inferred from how you answered the others. The shape is
                   probably right, the specifics are mine rather than yours.

Two of these name gaps rather than hide them — no large managed-cloud
experience, and no team code review at scale. That follows your own brief about
being honest on growth areas, but they are yours to cut if you would rather not
say them to an employer.

---

### Q: Can you work independently?
STATUS: NEEDS-REVIEW
A: Yes — that's been most of my experience so far. Every project on this page I built end to end, which means when something broke there was nobody to escalate it to. I'm used to deciding what to build next, researching my way through problems I haven't seen before, and being accountable for the result.

### Q: What's your experience working with clients?
STATUS: NEEDS-REVIEW
A: My main experience is MDS Pro, where I work directly with the business owner in the US and with the nursing team who use the system every day. That means gathering requirements from people who aren't technical, explaining trade-offs in plain terms, and handling bug reports and change requests from actual users. It's one client rather than an agency's worth, but it's ongoing and the users are real.

### Q: How do you communicate when requirements are unclear?
STATUS: GUESS
A: I ask rather than guess — usually by describing back what I think is wanted and what it would actually do, so it can be corrected against something concrete instead of an abstract question. If it's still unclear, I'll build the smallest version that shows the idea and let people react to that. A wrong assumption caught early is much cheaper than one found after it's built.

### Q: Why should we choose you over another junior developer?
STATUS: NEEDS-REVIEW
A: Because I've had to own something in production. MDS Pro is used every workday by people whose pay depends on it, and when it breaks it's mine to fix — that changes how you think about data, edge cases and deployment in a way that side projects alone don't. I'd also say I'm straightforward about what I haven't done yet, which I think matters more in a junior hire than someone who claims to have done everything.

### Q: What's interesting about the WordWarz bots?
STATUS: NEEDS-REVIEW
A: They choose guesses by information gain rather than from a fixed word list — each guess is picked to eliminate as many remaining possibilities as it can, with a constraint solver for the edge cases where that isn't enough. There's also ELO-based matchmaking across five tiers with some deliberate imperfection modelling, so a lower-tier bot plays like a person rather than like a solver that's been slowed down.

### Q: Can you show us your work?
STATUS: NEEDS-REVIEW
A: WordWarz is live at wordwarz.io and on the App Store. RecodeAI and this site are on github.com/kimlj, and this page walks through the AI systems in some detail. MDS Pro is a client's payroll system so the repository isn't mine to open, but I'm happy to give a live walkthrough of the dashboard and explain the parts I built.

### Q: Have you deployed production applications?
STATUS: NEEDS-REVIEW
A: Yes. MDS Pro runs in production and is used every workday. WordWarz is deployed on a Linux VPS behind Nginx in Docker and ships to the iOS App Store through Codemagic CI, with Android in review. This site is on Vercel. Deployment and everything around it — CI, environment configuration, backups — has been my responsibility on all of them.

### Q: Have you worked with sensitive business data?
STATUS: NEEDS-REVIEW
A: Yes. MDS Pro handles timekeeping and payroll for a healthcare business, so it holds people's hours, their pay and client billing. That shaped how it's built: access is enforced in the database with row-level security rather than only in the application, records are appended rather than edited so every change stays attributed, and there are nightly encrypted off-site backups. It's also why I'm careful about what I can show publicly.

### Q: What technologies do you use most?
STATUS: NEEDS-REVIEW
A: Day to day it's TypeScript and JavaScript, React and Next.js on the front end, Node.js and Fastify on the back, and Postgres for data. Python for the AI and automation pipelines. The Skills section on this page lists each technology against the project it was actually used in, so you can see where every one of them comes from rather than taking my word for it.

### Q: What's your experience with databases?
STATUS: NEEDS-REVIEW
A: Mostly Postgres, through Supabase. On MDS Pro I designed the schema and wrote 37 row-level-security migrations, so access control is enforced in the database rather than only in the application code. Integrity matters a lot there — timestamps set by the server rather than the browser, records appended rather than edited in place, and every change attributed to whoever made it.

### Q: What's your experience with APIs?
STATUS: NEEDS-REVIEW
A: I've built REST APIs with Node and Fastify, and real-time systems over WebSockets with Socket.IO for WordWarz. I've also integrated a fair number of third-party ones — the Google Sheets API for MDS Pro's billing sync, the Claude and OpenAI APIs for the AI features, Brevo for transactional email, and Gmail through n8n for the job alert pipeline.

### Q: What's your experience with cloud services?
STATUS: NEEDS-REVIEW
A: Vercel for web deployment, Supabase for Postgres and realtime, Google Cloud on Casinore, and a self-managed Linux VPS with Nginx and Docker for WordWarz. I'm comfortable running my own infrastructure when that's the right call and using a managed platform when it isn't. I haven't worked inside a large AWS or GCP environment with a dedicated infrastructure team, so that's somewhere I'd be learning.

### Q: What's your experience with AI and LLMs?
STATUS: NEEDS-REVIEW
A: It's a large part of what I do. I've shipped natural-language database querying on the Claude API where the generated SQL runs through a read-only Postgres role, a scoped site assistant with no tools and no database, resume-aware job matching on GPT-4o, and image pipelines in ComfyUI and Stable Diffusion. The part I've spent most time on isn't prompting — it's the design around the model: what it can reach, what it can't, and how someone checks its answer afterwards.

### Q: How quickly can you learn a new technology?
STATUS: GUESS
A: Quickly, and that's been most of how I've learned. I research first — how other people solved the problem and what went wrong for them — then build something small with it before committing to it. WordWarz's bot engine, the ComfyUI pipelines and the n8n automation were all things I hadn't used before I started them.

### Q: What's something you don't know yet?
STATUS: NEEDS-REVIEW
A: Working inside a larger engineering team — code review at scale, shared ownership of a codebase, and the process that comes with it. I also haven't worked in a big managed cloud environment or alongside a dedicated DevOps or QA function. Those are the gaps I'd most like to close, and the ones I'd expect a first team role to teach me.

### Q: What kind of developer do you want to become?
STATUS: GUESS
A: Someone who can be handed a vague problem and be trusted to come back with a system that works and keeps working. I want to get much stronger in the areas I've had least exposure to — working within a team, and the engineering process around the code rather than just the code. Longer term I'd like to keep working where AI is part of the product, because designing the constraints around a model is the problem I find most interesting right now.
