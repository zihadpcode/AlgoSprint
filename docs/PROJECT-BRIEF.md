# Original AlgoSprint project brief

This is the original user-provided brief, preserved for continuity. Phases 1–6 are merged; Phase 7 is completed in PR #8 after the user resumed from its first-half pause. The latest request includes pausing at 90% usage. No live usage meter is available, so this session is bounded to completing and saving Phase 7, then pausing before Phase 8. Read SESSION-HANDOFF.md for current evidence and configuration gaps. The original Phase 1-only instruction below is historical.

---

You are my senior software engineering mentor. Help me build a full-stack coding interview preparation platform from scratch called **AlgoSprint**.

I am a senior Computer Science student building this project for my portfolio, internship applications, resume, and real software engineering practice. I am starting from zero. Assume I need beginner-friendly but serious professional guidance.

This project should be treated like a real production-style full-stack application, not a small class assignment.

Use color-coded sections in every response:

- 🟦 Architecture / setup
- 🟩 Implementation / code
- 🟨 Explanation / reasoning
- 🟥 Warnings / mistakes / security
- 🟪 Expansion / future improvements

Project source requirement:
The project is inspired by coding platforms like LeetCode and learning roadmaps like NeetCode, but **do not copy** their UI, branding, problem statements, explanations, roadmaps, or copyrighted content. AlgoSprint must have original design, original branding, original problem statements, original hints, original explanations, and original roadmap names.

Project name:
**AlgoSprint**

Main goal:
Build a full-stack coding practice and interview preparation platform with:

- original DSA problems
- searchable problem library
- problem detail pages
- layered hints
- guided step-by-step solutions
- starter code
- test cases
- code editor
- safe code execution
- roadmaps
- user accounts
- progress tracking
- notes
- bookmarks/review later
- dashboard analytics
- mock interview mode
- admin panel
- bulk problem seeding system

The long-term target is **1000 original coding problems**, but the project should be built incrementally. Start with a strong MVP, then scale.

Recommended tech stack:
Use this stack unless there is a very strong reason not to:

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:

- Next.js API routes or server actions
- REST-style APIs where useful
- Supabase for authentication
- PostgreSQL database

Database:

- PostgreSQL
- Prisma ORM
- Supabase PostgreSQL is acceptable
- Use migrations
- Use relational constraints
- Use enums where useful
- Use indexes for filtering/searching

Authentication:

- Supabase Auth
- Email/password login first
- GitHub OAuth later if time allows
- Protected routes
- Admin role protection

Code editor:

- Monaco Editor

Code execution:

- Do not run untrusted user code directly on the main backend server.
- For MVP, either use a safe mock runner for simple JavaScript problems or integrate Judge0.
- Later, consider a Docker-based sandbox as a separate isolated service.
- Explain the pros and cons before implementing.

Validation:

- Zod for validating problem data, forms, and imports.

Charts/dashboard:

- Recharts or Chart.js.

Icons:

- lucide-react.

Styling:

- Tailwind CSS
- dark-mode first
- clean dashboard layout
- original coding/editor aesthetic
- glassmorphism-style cards if appropriate
- smooth hover effects
- responsive design
- good spacing
- professional typography
- difficulty badges
- progress charts
- topic cards

Important teaching rule:
For every phase, explain:

1. What we are building
2. Why we are building it this way
3. What files are created or edited
4. Full code for every file
5. How the code works internally
6. How files connect to each other
7. How to test the feature
8. Common mistakes
9. How to expand it later

Do not give tiny snippets unless I specifically ask for only a snippet. Give complete files.

Do not jump ahead. Build phase by phase.

Do not assume I already have anything built. Start from scratch.

Use beginner-friendly explanations, but make the engineering decisions professional and scalable.

Core platform pages:
Build these pages over time:

1. Landing Page
2. Register Page
3. Login Page
4. Dashboard Page
5. Problems List Page
6. Problem Detail Page
7. Roadmaps Page
8. Individual Roadmap Page
9. Mock Interview Page
10. Interview Results Page
11. Notes Page
12. User Profile Page
13. Admin Problem Manager
14. Admin Add Problem Page
15. Admin Edit Problem Page

Problem library requirements:
Problems must be searchable and filterable by:

- title
- difficulty
- category
- tags
- pattern
- status
- estimated time
- completion status

Problem difficulty levels:

- Easy
- Medium
- Hard

Minimum categories:

- Arrays
- Strings
- Hash Maps
- Two Pointers
- Sliding Window
- Stack
- Queue
- Linked List
- Trees
- Binary Search Trees
- Heaps / Priority Queues
- Graphs
- BFS
- DFS
- Backtracking
- Dynamic Programming
- Greedy Algorithms
- Binary Search
- Intervals
- Sorting
- Recursion
- Bit Manipulation
- Math
- Tries
- Union Find
- Topological Sort
- Design Problems
- System Design Basics
- SQL Problems
- Object-Oriented Programming Interview Problems

Each problem should eventually include:

- title
- slug
- difficulty
- categories
- tags
- pattern
- problem statement
- examples
- constraints
- starter code
- visible test cases
- hidden test cases
- expected output
- actual output
- failed test explanation
- hints
- step-by-step solution
- brute force approach
- optimized approach
- alternative approach if useful
- pseudocode
- final code solution
- time complexity
- space complexity
- common mistakes
- interview explanation
- related problems

Layered hints system:
Each problem should support hints revealed one at a time:

- Hint 1: light clue
- Hint 2: points toward the data structure or algorithm
- Hint 3: explains the main pattern
- Hint 4: gives strong guidance
- Final Reveal: full solution direction

The UI should not show all hints immediately. The user should reveal them progressively.

Solution system:
Every problem should eventually support multiple solution types:

- brute force
- better
- optimal
- alternative

Each solution should include:

- intuition
- approach
- walkthrough
- pseudocode
- code
- complexity
- mistakes
- interview explanation

User features:
Users should be able to:

- create account
- log in
- log out
- view dashboard
- solve problems
- attempt problems
- mark solved
- mark review later
- bookmark problems
- save notes per problem
- view progress by difficulty
- view progress by category
- see weak topics
- see recent activity
- see recommended problems

Dashboard should show:

- total solved
- total attempted
- solved by difficulty
- solved by category
- current streak
- strongest topics
- weakest topics
- recent activity
- recommended next problems
- mock interview scores later

Roadmaps:
Create original roadmaps. Do not use copyrighted roadmap names.

Roadmaps can include:

- Beginner DSA Roadmap
- AlgoSprint 150
- Arrays and Strings Roadmap
- Dynamic Programming Roadmap
- Graphs Roadmap
- Interview in 30 Days
- Interview in 60 Days
- Interview in 90 Days
- Backend Developer Interview Roadmap
- Frontend Developer Interview Roadmap
- FAANG-Style Prep Roadmap

Each roadmap should have:

- title
- slug
- description
- difficulty level
- estimated completion time
- ordered steps
- associated problems
- progress tracking

Mock interview mode:
Later, build a mock interview section with:

- timed sessions
- randomized problems
- difficulty selection
- topic selection
- coding questions
- conceptual DSA questions
- debugging questions
- optimization questions
- behavioral questions
- system design basics
- post-interview score/report
- feedback summary

All interview-style questions must be original.

Admin panel:
Build an admin panel so I can manage content without editing code manually.

Admin should be able to:

- create problem
- edit problem
- archive problem
- delete problem only if safe
- add examples
- add constraints
- add hints
- add solutions
- add test cases
- assign categories
- assign tags
- assign roadmap placement
- import problems from JSON
- later import from CSV
- validate problem data before saving

Bulk seeding strategy:
Do not manually hardcode 1000 problems one by one.

Create:

- problem JSON format
- Zod validation schema
- seed script
- sample seed file
- duplicate slug protection
- test case validation
- category/tag validation
- scalable folder structure for generated problems

Start small:

- first seed 5 problems
- then 20 problems
- then 100 problems
- later scale to 1000

The problems must be original.

Suggested project phases:

Phase 1 — Project Setup and Architecture
Build:

- Next.js app
- TypeScript
- Tailwind CSS
- package installation
- folder structure
- environment variables
- basic layout
- global styles
- project README starter

Phase 2 — Database and Prisma Schema
Build:

- PostgreSQL connection
- Prisma setup
- full schema design
- enums
- relationships
- migrations
- seed categories
- seed tags
- seed starter problems

Database tables/models should include:

- User/Profile
- Problem
- ProblemExample
- ProblemHint
- ProblemSolution
- SolutionStep
- StarterCode
- TestCase
- Category
- Tag
- CompanyStyle or InterviewStyle
- ProblemCategory
- ProblemTag
- ProblemCompanyStyle
- UserProgress
- UserSubmission
- UserNote
- Roadmap
- RoadmapStep
- MockInterview
- MockInterviewQuestion

Phase 3 — Supabase Auth
Build:

- Supabase setup
- register page
- login page
- logout
- session handling
- protected dashboard
- profile creation
- user role field
- admin protection

Phase 4 — App Shell and UI System
Build:

- navbar
- sidebar
- layout
- reusable card component
- reusable button component
- reusable badge component
- reusable input component
- loading state
- empty state
- error state
- dark-mode visual system

Phase 5 — Problem Library
Build:

- problems list page
- search bar
- difficulty filter
- category filter
- tag filter
- sorting
- pagination
- debounced search
- problem cards/table
- solved/attempted/review status indicators

Phase 6 — Problem Detail Page
Build:

- problem statement section
- examples section
- constraints section
- hints reveal component
- solution tabs
- starter code section
- related problems
- notes area
- mark solved/review later buttons

Phase 7 — Monaco Code Editor
Build:

- editor component
- language selector
- starter code loading
- reset code button
- local code state
- output panel
- test results panel

Phase 8 — Safe Code Runner
Build:

- explain options first:
  - frontend mock runner
  - Judge0
  - Docker sandbox
- implement safest MVP option
- run visible tests
- submit hidden tests
- save submission result
- show runtime/error/output
- do not expose API keys
- do not run arbitrary code on main server

Phase 9 — Progress Tracking
Build:

- user\_progress model usage
- mark attempted
- mark solved
- mark review later
- solved counts
- category progress
- difficulty progress
- recent activity

Phase 10 — Dashboard
Build:

- dashboard cards
- solved by difficulty chart
- solved by category chart
- weak topics
- recent submissions
- recommended problems
- streak placeholder or implementation

Phase 11 — Notes and Bookmarks
Build:

- notes per problem
- save notes
- edit notes
- delete notes
- bookmarks
- review later page

Phase 12 — Roadmaps
Build:

- roadmaps list
- roadmap detail page
- roadmap steps
- progress per roadmap
- original roadmap seed data
- recommended next step

Phase 13 — Admin Panel
Build:

- admin route protection
- problem manager table
- add problem form
- edit problem form
- archive problem
- manage hints
- manage examples
- manage solutions
- manage test cases
- assign categories/tags
- import JSON problems

Phase 14 — Problem Generator System
Build:

- generator architecture
- templates by pattern
- original problem generation rules
- brute-force validator structure
- test case generator
- sample generators:
  - two pointers
  - sliding window
  - prefix sum
  - binary search
  - dynamic programming
- validate generated problem objects with Zod
- save generated problems into seed files

Phase 15 — Mock Interview Mode
Build:

- interview setup page
- timer
- random question selection
- problem session
- answer explanation mode
- scoring/report page
- feedback summary

Phase 16 — Polish and Deployment
Build:

- landing page polish
- mobile responsiveness
- loading states
- error handling
- README
- screenshots checklist
- deployment guide
- Vercel deployment
- Supabase production setup
- environment variable setup
- portfolio description
- resume bullet suggestions only after features are real

Security requirements:
Implement and explain:

- authentication
- protected routes
- admin roles
- server-side authorization
- input validation
- environment variables
- secret key safety
- database constraints
- safe code execution
- API rate limiting if needed
- avoiding exposing service role keys
- avoiding direct untrusted code execution

Environment variable rules:
Use `.env.local` for local development.
Use `.env.example` to show required variable names.
Never expose:

- Supabase service role key
- Judge0 API key
- database password
- private tokens

Only expose public browser-safe values with `NEXT_PUBLIC_`.

Code quality requirements:
Use:

- TypeScript
- clean folder structure
- reusable components
- reusable utility functions
- validation schemas
- clear comments
- error handling
- loading states
- empty states
- mobile responsive design
- accessible buttons/forms
- consistent naming
- scalable database relationships

Suggested folder structure:

algosprint/
├── prisma/
│ ├── schema.prisma
│ └── seed.ts
├── public/
├── src/
│ ├── app/
│ │ ├── page.tsx
│ │ ├── layout.tsx
│ │ ├── globals.css
│ │ ├── login/
│ │ ├── register/
│ │ ├── dashboard/
│ │ ├── problems/
│ │ │ ├── page.tsx
│ │ │ └── [slug]/
│ │ ├── roadmaps/
│ │ ├── mock-interview/
│ │ ├── notes/
│ │ ├── profile/
│ │ ├── admin/
│ │ └── api/
│ ├── components/
│ │ ├── layout/
│ │ ├── ui/
│ │ ├── problems/
│ │ ├── editor/
│ │ ├── dashboard/
│ │ ├── roadmaps/
│ │ └── admin/
│ ├── features/
│ │ ├── auth/
│ │ ├── problems/
│ │ ├── progress/
│ │ ├── roadmaps/
│ │ ├── submissions/
│ │ └── admin/
│ ├── lib/
│ │ ├── prisma.ts
│ │ ├── supabase/
│ │ ├── validators/
│ │ ├── constants.ts
│ │ └── utils.ts
│ ├── types/
│ └── data/
│ └── seeds/
├── scripts/
├── .env.local
├── .env.example
├── package.json
└── README.md

When we start, begin with Phase 1 only.

For Phase 1, provide:

1. exact terminal commands
2. packages to install
3. project folder structure
4. initial files
5. Tailwind/global styling
6. initial landing page
7. reusable constants
8. README starter
9. explanation of every decision
10. how to run and test locally

Do not build Phase 2 until Phase 1 is complete.

Start now with:

**Phase 1: Create the AlgoSprint Next.js + TypeScript + Tailwind project from scratch, set up the folder structure, install dependencies, create the initial dark-mode landing page shell, and explain every step clearly.**
