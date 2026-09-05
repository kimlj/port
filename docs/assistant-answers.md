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
STATUS: OK
A: Both. Full-time remote is what I'm looking for, and I'm open to contract engagements depending on the scope and the fit.

### Q: Can you start soon?
STATUS: OK
A: Yes — I can start soon. MDS Pro is in maintenance rather than active build now, so there's nothing blocking a new engagement.

### Q: What time zone are you in, and how do you handle overlap?
STATUS: OK
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
STATUS: OK
A: The problem, who has it, and what people do today instead. I'd rather have a rough description of the actual pain than a detailed spec for a solution — if the spec is already written I usually end up asking what it was meant to fix anyway.

### Q: Why should we hire you?
STATUS: OK
A: I think my biggest strength is ownership. I don't just like building individual features — I like understanding the whole system, from the user's problem and database design to the application, deployment, testing, and maintenance. I'm still growing as an engineer, especially in larger team environments, but I've already had to take real responsibility for software that people depend on every day. I also learn quickly and use AI and research heavily to get through problems I haven't encountered before.

### Q: Why should we choose you over another junior developer?
STATUS: OK
A: Because I've had to own something in production. MDS Pro is used every workday by people whose pay depends on it, and when it breaks it's mine to fix — that changes how you think about data, edge cases and deployment in a way that side projects alone don't. I'd also say I'm straightforward about what I haven't done yet, which I think matters more in a junior hire than someone who claims to have done everything.

# B. The work

### Q: Which project are you proudest of, and why?
STATUS: OK
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
STATUS: OK
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
STATUS: OK
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
STATUS: OK
A: I started at the University of the Philippines Los Baños in Agricultural Chemistry and got as far as a year before being dropped for failing grades. I'll be straightforward about why: I was immature, I hadn't set myself any real goal yet, and it was a field I couldn't picture myself working in. I later took BS Information Technology at AMA Computer College Makati — three of four years completed, the degree not yet conferred, one year remaining. Programming is the part I actually stayed with, and most of what I use day to day I learned by building something, watching it break, and working out why.

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
STATUS: OK
A: Quezon City, Metro Manila, in the Philippines. I work remotely.

### Q: What kind of developer do you want to become?
STATUS: OK
A: Someone who can be handed a vague problem and be trusted to come back with a system that works and keeps working. I want to get much stronger in the areas I've had least exposure to — working within a team, and the engineering process around the code rather than just the code. Longer term I'd like to keep working where AI is part of the product, because designing the constraints around a model is the problem I find most interesting right now.

# F. Who you are

### Q: Tell me something about yourself.
STATUS: OK
A: I'm a developer who likes building things, but I'm probably just as obsessed with improving things outside programming. A lot of my free time goes into running, cycling, the gym, and recently tennis. I've always liked having something to work toward, whether that's a project, a faster running time, or simply getting better at something.

Professionally, I enjoy taking a vague problem and turning it into something people can actually use. I've spent a lot of time working independently as a sole developer, so one of the things I want from my next role is more experience working with a strong engineering team and learning from other developers.

### Q: What's something you believe now that you didn't believe a few years ago?
STATUS: OK
A: Think critically and do your own research. Not everything you see or hear is true, especially with the rise of AI and how easy it is to generate convincing information now.

### Q: What's something you used to be bad at but eventually got good at?
STATUS: OK
A: Cooking. I used to be pretty bad at it, but I eventually learned how to make decent food for myself.

### Q: What's something you're still trying to figure out about yourself?
STATUS: OK
A: My purpose in life. I have a general idea of the kind of person I want to become, but I'm still figuring out exactly what that means for me.

### Q: What's something you wish you'd learned earlier?
STATUS: OK
A: That you need to consistently invest time and effort into your craft to become good at it. Past achievements don't mean you can stop putting in the work.

### Q: What kind of person are you trying to become?
STATUS: OK
A: Someone who leaves a legacy and inspires other people, whether through the things I build, the way I live, or the way I treat people.

### Q: What's something you're proud of that took a long time to achieve?
STATUS: OK
A: My fitness. Building my body and maintaining an active, healthy lifestyle took years of consistency and discipline.

### Q: What's something you failed at that taught you something important?
STATUS: OK
A: I learned that sometimes people don't directly ask for help even when they need it. A subtle message or a change in someone's behavior can be a sign that they need your time and attention. It taught me to make more effort to check in on the people I care about and not wait for them to explicitly ask for help.

### Q: How do you deal with things not going according to plan?
STATUS: OK
A: I try not to fixate on it. I'll take a breather, go outside, clear my head, and sometimes just park the task until the next day. Coming back with a fresh mind usually helps me see the problem more clearly.

### Q: What do you do when motivation disappears?
STATUS: OK
A: I spend time with friends or family. They're a big part of why I work hard in the first place, so sometimes I just need to remind myself who I'm doing it for.

# G. What drives you

### Q: What motivates you?
STATUS: OK
A: My family is a big motivation for me. I want to build a stable career that lets me support my parents and eventually give them the freedom to retire comfortably. Beyond that, I like seeing myself improve, whether that's in programming, fitness, or anything else I'm working on.

### Q: What keeps you going when something gets difficult?
STATUS: OK
A: My family and the bigger reason behind what I'm working toward. When things get difficult, I try to remember why I started.

### Q: What makes you want to get better at something?
STATUS: OK
A: I want to become good enough that I can inspire other people. I like the idea that seeing someone put in the work and improve can motivate someone else to do the same.

### Q: What makes you feel like you've had a productive day?
STATUS: OK
A: When I've made meaningful progress — maybe I solved a difficult bug, shipped a big feature, went for a run, and even got some household chores done. It doesn't have to be entirely work-related.

### Q: What are you trying to accomplish in the next few years?
STATUS: OK
A: Build a stable developer career, continue improving my skills, and eventually have enough freedom and experience to choose the kind of work I want to do.

### Q: What does success mean to you?
STATUS: OK
A: Having peace of mind. For me, that usually comes from knowing the people I care about are doing well and being happy.

### Q: What matters more to you: stability, freedom, money, or achievement?
STATUS: OK
A: Freedom. Financial stability is important, but ultimately I want the freedom to decide how I spend my time and what I work on.

### Q: What would you like to be able to provide for your family someday?
STATUS: OK
A: A house and lot, and enough financial stability that my parents can enjoy retirement without having to worry about money.

### Q: What makes you proud of yourself?
STATUS: OK
A: My discipline, especially with running and taking care of my body. Staying consistent with a healthy lifestyle for years is something I'm genuinely proud of.

### Q: What makes you feel like you're wasting your time?
STATUS: OK
A: When I feel like nobody is benefiting from what I'm doing or that I'm putting effort into something with no meaningful purpose.

### Q: What makes you lose interest in something?
STATUS: OK
A: When something becomes too easy and there's no longer anything interesting to learn or improve.

# H. How you think

### Q: How do you decide whether something is worth pursuing?
STATUS: OK
A: If I believe the solution can genuinely make people's lives easier or solve a problem that matters, I'm much more interested in pursuing it.

### Q: How do you know when you've done enough?
STATUS: OK
A: When continuing would give me diminishing returns and I'm no longer making meaningful progress. Sometimes that also means recognizing when I'm mentally exhausted and need to step away.

### Q: How do you handle failure?
STATUS: OK
A: I see failure as part of progress. I try to be patient, learn from it, and keep working. If something matters to me, I don't expect to get it right immediately.

### Q: When do you know it's time to give up on something?
STATUS: OK
A: When something is becoming a serious burden and is starting to negatively affect my well-being, especially if it's causing constant stress or affecting my sleep. Sometimes stepping away is better than forcing something indefinitely.

### Q: Do you tend to trust your instincts or analyze everything first?
STATUS: OK
A: Both. Instincts are based on everything you've experienced and learned, so I don't ignore them. But if my instinct turns out to be wrong, I want to understand why and analyze the situation more carefully.

### Q: Are you more interested in being right or understanding why you're wrong?
STATUS: OK
A: Understanding why I'm wrong. Being wrong gives me an opportunity to improve.

### Q: What's something you tend to overthink?
STATUS: OK
A: Training. I tend to over-optimize things that probably don't need that much optimization. I'll sometimes spend too much time thinking about how to improve my training by a tiny amount.

### Q: How do you react when your hard work doesn't produce the result you expected?
STATUS: OK
A: Take a deep breath, accept that not everything will go smoothly or in my favor, figure out what I can learn from it, and move on.

### Q: What do you do when you realize you were wrong?
STATUS: OK
A: Accept it, correct myself as soon as possible, and try to remember what caused the mistake so I don't make the same one twice.

# I. Outside work

### Q: What do you do outside of programming?
STATUS: OK
A: My usual days involve some combination of fitness — usually a morning bike ride, afternoon gym session, or evening run. I'll usually do two of those in a day when I have the time, and sometimes all three on weekends. I also spend a lot of my weekends with my family.

### Q: What are your hobbies?
STATUS: OK
A: Most of my hobbies revolve around fitness and endurance sports. Outside of that, I enjoy watching movies and TV series.

### Q: Are you into sports or fitness?
STATUS: OK
A: Definitely. Most of my free time outside programming is spent running, cycling, or working out. I also occasionally compete in races and have podiumed in trail runs.

### Q: Do you play games? What kind?
STATUS: OK
A: Not anymore. I used to play League of Legends, but I gradually stopped as I got busier with programming and other things I wanted to build.

### Q: Why do you build personal projects if nobody is paying you?
STATUS: OK
A: I like keeping my mind occupied, and I genuinely enjoy solving problems. It doesn't really matter whether the problem comes from a client or something I came up with myself — if there's something interesting to figure out, I enjoy working on it.

### Q: What are you interested in outside of technology?
STATUS: OK
A: Fitness, especially running, cycling, and endurance sports.

### Q: What's something you've been really interested in recently?
STATUS: OK
A: AI. It's moving so quickly that there's always something new to learn or experiment with, and I'm particularly interested in how it can be used to build useful products.

### Q: What could you talk about for hours?
STATUS: OK
A: Getting fit and endurance sports. I can probably talk way too long about running, cycling, training, and trying to improve performance.

### Q: What do you do when you need to clear your head?
STATUS: OK
A: I run or bike. Being outside and doing something physical is usually the fastest way for me to reset.

### Q: What makes you genuinely happy?
STATUS: OK
A: Seeing the people I love happy.

### Q: What do you do when you have a completely free day?
STATUS: OK
A: Walk, run, eat something good, watch a movie, and probably think about life more than I should.

### Q: What's something you could never imagine giving up?
STATUS: OK
A: My family, and my active lifestyle.

### Q: What kind of experiences do you value most?
STATUS: OK
A: Quality time with my family.

### Q: What's something you want to experience at least once in your life?
STATUS: OK
A: Skydiving.

### Q: What do you spend too much time thinking about?
STATUS: OK
A: What the world will look like 15 or 25 years from now. Will everything be dominated by robots and AI? Will there be major wars? How will people live? I tend to think about big-picture questions like that.

### Q: What's something people might be surprised to learn about you?
STATUS: OK
A: That I take my active lifestyle pretty seriously. Running, cycling, the gym, and endurance sports aren't just casual hobbies for me.

### Q: What's something that's important to you that doesn't show up on your resume?
STATUS: OK
A: Maintaining a healthy lifestyle. It's a big part of how I structure my life, but obviously there's no place for that on a resume.

### Q: What's something you're proud of that isn't on your resume?
STATUS: OK
A: Probably my fitness. I've been consistently working out for around three years and I'm proud of the physique and fitness I've built. It's not exactly something I can put on GitHub or LinkedIn, but it represents a lot of consistency and effort.

### Q: What are you like when you're not working?
STATUS: OK
A: Probably walking or exercising outside and thinking about life.

### Q: What kind of person do your friends think you are?
STATUS: OK
A: Hardworking and disciplined. Probably also someone who takes things seriously when they matter but likes to joke around when there's an opportunity.

### Q: What's something you've learned recently just because you wanted to?
STATUS: OK
A: Tennis. I've been practicing it for a while now. Most of what I learn outside programming tends to revolve around fitness or sports, apparently.

### Q: What's something you've built purely because you thought it would be fun?
STATUS: OK
A: I once made a browser extension for my sister's laptop that would redirect Google searches to a random weird YouTube video. It was completely useless, but I thought it would be funny.

### Q: What's a lesson you've learned the hard way?
STATUS: OK
A: You don't get the result you want just because you've achieved it before. You still have to put in the work.

I learned that with running. After hitting some good personal records one year, I assumed I could improve them again without putting in the same level of effort. I was wrong. It was a good reminder that past performance doesn't replace preparation — if you want a better result, you have to put in the work.

### Q: If you weren't a developer, what do you think you'd be doing?
STATUS: OK
A: Probably helping my father with his farm and trying to find ways to grow and improve the business.

# J. Working with people

### Q: What are you like to work with?
STATUS: OK
A: Give me a clear goal and I'll take ownership of getting it done. I'm also easy to work with outside of the task itself — I listen, communicate, and can usually vibe and joke around with people once I'm comfortable.

### Q: What kind of teammate are you?
STATUS: OK
A: I'm probably not the most talkative person or the natural leader in a room. I've mostly worked as a sole developer, but as a teammate, I'm someone you can rely on. If something is assigned to me, I'll take responsibility for it and make sure it gets done.

### Q: What kind of people do you enjoy working with?
STATUS: OK
A: People who are smart and take their work seriously without taking themselves too seriously. I like teammates I can joke and banter with while still getting things done.

### Q: What kind of environment do you work best in?
STATUS: OK
A: A calm environment where people can focus, but where there's still enough personality to joke around and banter with teammates. I don't need a completely serious environment to do good work.

### Q: How do you handle criticism?
STATUS: OK
A: I try to listen before getting defensive. I generally assume there's something I can learn from what the other person is saying, then I evaluate it and decide what I should actually change.

### Q: How do you react when someone disagrees with your approach?
STATUS: OK
A: I accept that people can solve the same problem in completely different ways. I'll hear them out, understand why they prefer their approach, and see whether there's something I can improve in mine.

### Q: When do you know it's time to ask for help?
STATUS: OK
A: Usually when I've been genuinely stuck for a while and I've already tried researching and debugging the problem myself without making progress. I don't mind asking for help — I'd rather ask after making a reasonable effort than waste hours being stuck on something someone else can unblock quickly.

### Q: What frustrates you at work?
STATUS: OK
A: Bugs that seem like they should be simple but somehow take hours to track down. Especially when the actual cause ends up being something completely different from what I initially suspected.

### Q: What are you trying to improve about yourself right now?
STATUS: OK
A: I'm always trying to get a little better than I was yesterday. More specifically, I'm currently putting more effort into learning application security and getting better at securing the apps and websites I build.

# K. About this assistant

### Q: Are you actually Kim, or a bot?
STATUS: OK
A: A bot — I'm the assistant on Kim's site, answering in his voice from what this page and his resume say. If you want Kim himself, the form at the bottom reaches him directly.

### Q: How do you work?
STATUS: OK
A: I answer from a fixed knowledge file built from this page and Kim's resume. No tools, no database, no search. That means I can't look anything up — but it also means there's nothing for me to invent from, which is the point.

### Q: What can't you answer?
STATUS: OK
A: I can answer questions about Kim's projects, experience, technologies and development approach from what this page documents, his availability and rates, and a fair amount about what he's like outside the work — what drives him, how he thinks, what he does when he isn't at a keyboard — because he wrote those answers himself. What I can't do is anything that isn't in my knowledge file: contract terms, references, or the specifics of your own project. For those, the contact form at the bottom of the page reaches Kim directly.

### Q: Did Kim build you?
STATUS: OK
A: Yes — I'm one of the systems in the AI showcase on this page, and the constraint I'm held to is listed there like all the others: no tools, no database.
