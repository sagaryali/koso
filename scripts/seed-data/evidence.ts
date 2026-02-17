// Realistic evidence data for TaskFlow product

export type SeedEvidence = {
  key: string;
  type: string;
  title: string;
  content: string;
  source: string | null;
  tags: string[];
  linkedArtifactKeys?: string[];
};

export const EVIDENCE: SeedEvidence[] = [
  // --- Feedback ---
  {
    key: "fb-notifications",
    type: "feedback",
    title: "Notification overload complaint",
    content:
      "The notification system is overwhelming. I get pinged for every comment even on threads I'm not following. I've started ignoring all notifications which means I miss the important ones. Can we get some kind of smart filtering?",
    source: "User interview — Sarah K., Engineering Lead at Rentify",
    tags: ["notifications", "ux", "retention-risk"],
    linkedArtifactKeys: ["principle-async"],
  },
  {
    key: "fb-onboarding",
    type: "feedback",
    title: "Onboarding confusion for new team members",
    content:
      "When a new person joins our team, they have no idea where to start. There's no guided tour and the empty state just says 'No tasks yet'. It took our latest hire 3 days to feel comfortable navigating the tool. We almost churned because of it.",
    source: "Support ticket #4821 — Marcus R., Team Lead at DataStack",
    tags: ["onboarding", "empty-states", "churn-risk"],
  },
  {
    key: "fb-mobile",
    type: "feedback",
    title: "Mobile experience too slow for triage",
    content:
      "I check TaskFlow on my phone during my commute to triage overnight tasks. The mobile web loads slowly (I counted 5 seconds last time) and the task cards are too small to tap accurately. I end up waiting until I get to my laptop which defeats the purpose.",
    source: "NPS survey response — anonymous, Enterprise plan",
    tags: ["mobile", "performance", "triage"],
    linkedArtifactKeys: ["prd-mobile"],
  },
  {
    key: "fb-keyboard",
    type: "feedback",
    title: "Love the keyboard shortcuts, want more",
    content:
      "The keyboard shortcuts are the reason I switched from Jira. j/k navigation, quick-assign with 'a', and the command palette are amazing. But I wish I could customize them and add macros for repetitive workflows like moving a task to review + assigning a reviewer.",
    source: "Twitter DM from @devtools_sarah",
    tags: ["keyboard", "power-users", "workflow"],
    linkedArtifactKeys: ["principle-async"],
  },
  {
    key: "fb-collab",
    type: "feedback",
    title: "Need real-time editing for sprint planning",
    content:
      "During sprint planning, our team of 6 all needs to update task estimates and descriptions simultaneously. Right now we take turns which wastes 30 minutes per session. If we could all edit at once like Google Docs, sprint planning would take half the time.",
    source: "Customer call — Priya M., PM at CloudScale",
    tags: ["collaboration", "sprint-planning", "real-time"],
    linkedArtifactKeys: ["prd-realtime"],
  },
  // --- Metrics ---
  {
    key: "met-velocity",
    type: "metric",
    title: "Sprint velocity dropped after mandatory code reviews",
    content:
      "Sprint velocity decreased 15% (from 34 to 29 story points average) in the 4 weeks after we introduced mandatory code reviews. However, bug escape rate dropped 42% in the same period. The net impact on delivery timeline is roughly neutral when accounting for reduced rework.",
    source: "Engineering Analytics Dashboard — Jan 2026",
    tags: ["velocity", "code-review", "quality"],
    linkedArtifactKeys: ["story-code-review"],
  },
  {
    key: "met-adoption",
    type: "metric",
    title: "Board view adoption at 68% of active users",
    content:
      "68% of weekly active users have viewed the board at least once in the past 30 days. Of those, 41% use the board as their primary navigation (vs. list view at 52%, calendar at 7%). Board users complete tasks 12% faster on average, likely due to better visual context of work in progress.",
    source: "Product Analytics — Mixpanel",
    tags: ["adoption", "board", "engagement"],
    linkedArtifactKeys: ["story-sprint-board"],
  },
  {
    key: "met-retention",
    type: "metric",
    title: "Day-30 retention stable at 72%",
    content:
      "Day-30 retention for new teams is 72%, up from 68% last quarter. The biggest drop-off is between Day 1 and Day 7 (28% of new signups don't return after day 1). Teams that create their first board within 24 hours retain at 89%.",
    source: "Growth Dashboard — Amplitude",
    tags: ["retention", "activation", "growth"],
  },
  {
    key: "met-latency",
    type: "metric",
    title: "API p95 latency creeping up",
    content:
      "P95 API latency has increased from 180ms to 340ms over the past 6 weeks. The main contributors are the /tasks/search endpoint (now averaging 420ms at p95) and the /boards/:id endpoint (380ms at p95 due to loading all task cards). We need to investigate query optimization and consider pagination.",
    source: "Datadog APM — Feb 2026",
    tags: ["performance", "latency", "technical-debt"],
  },
  // --- Research ---
  {
    key: "res-competitors",
    type: "research",
    title: "Competitor analysis: Linear vs Height vs Shortcut",
    content:
      "Linear: Fastest-growing competitor. Keyboard-first UX, beautiful design, auto-scheduling. Weakness: limited customization, no self-hosted option. Height: Spreadsheet-like flexibility with real-time collaboration. Strength: AI task generation. Weakness: learning curve, smaller ecosystem. Shortcut: Focused on engineering teams. Good GitHub integration and cycles. Weakness: outdated UI, slow feature velocity. Key insight: all three are investing heavily in AI-assisted project management. Linear launched 'Auto-prioritize' in Q4 2025. We're behind on AI features.",
    source: "PM competitive review — January 2026",
    tags: ["competitors", "market", "ai"],
    linkedArtifactKeys: ["roadmap-q1"],
  },
  {
    key: "res-crdt",
    type: "research",
    title: "CRDT library evaluation: Yjs vs Automerge",
    content:
      "Yjs: More mature, larger ecosystem. Used by Notion, Figma, and Hocuspocus. ~15KB gzipped. Excellent performance up to 100 concurrent editors. Well-documented WebSocket provider. Downside: harder to reason about conflict resolution, less predictable memory usage. Automerge: Cleaner API, better conflict semantics. Used by Ink & Switch projects. ~45KB gzipped. Good for document-like data but less proven at scale. New Rust implementation is fast but the JS bindings are still maturing. Recommendation: Yjs for our use case. The ecosystem maturity and performance at our scale (2-8 collaborators) makes it the safer choice.",
    source: "Engineering spike — Wei L., Senior Engineer",
    tags: ["technical", "crdt", "real-time", "architecture"],
    linkedArtifactKeys: ["prd-realtime", "decision-database"],
  },
  {
    key: "res-mobile-market",
    type: "research",
    title: "Mobile PM tool usage trends 2025-2026",
    content:
      "Forrester reports that 47% of PMs use mobile devices for task management daily, up from 31% in 2024. The most common mobile actions: status updates (78%), comment replies (65%), notification triage (82%), and quick task creation (41%). Full editing is rare on mobile (12%). Implication: our mobile app should optimize for quick actions and triage rather than full editing capabilities.",
    source: "Forrester Research — Q4 2025 Report",
    tags: ["mobile", "market", "research"],
    linkedArtifactKeys: ["prd-mobile"],
  },
  // --- Meeting Notes ---
  {
    key: "meet-retro",
    type: "meeting_note",
    title: "Sprint 14 Retrospective",
    content:
      "What went well: GitHub PR linking shipped ahead of schedule. The new search indexing reduced query times by 60%. Team morale is high after the successful board launch. What could be improved: Sprint planning still takes too long (2 hours). We underestimated the complexity of the permission system refactor. QA feedback loop is too slow — bugs found on Friday don't get fixed until Tuesday. Action items: 1) Try async sprint planning with a 30-min sync cap. 2) Break permission system work into smaller PRs. 3) Set up a QA rotation so bugs get triaged same-day.",
    source: "Sprint 14 Retro — Feb 7, 2026",
    tags: ["retro", "process", "sprint-planning"],
  },
  {
    key: "meet-stakeholder",
    type: "meeting_note",
    title: "Q1 stakeholder review with leadership",
    content:
      "Attendees: CEO, CTO, VP Product, VP Engineering. Key discussion: Board feature is landing well — usage metrics look strong. Leadership wants to see collaboration features in demo-ready state by end of Q1 for a potential Series B investor demo. CTO raised concerns about WebSocket infrastructure costs at scale — wants a cost projection before we commit to the approach. VP Eng asked about React Native feasibility for mobile — team needs to do a 1-week spike. Decision: Proceed with real-time collaboration as top priority. Mobile app moves to Q2 unless React Native spike shows we can parallelize.",
    source: "Stakeholder Review — Feb 10, 2026",
    tags: ["stakeholder", "strategy", "q1", "fundraising"],
    linkedArtifactKeys: ["roadmap-q1", "prd-mobile"],
  },
];
