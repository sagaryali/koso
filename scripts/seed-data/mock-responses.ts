// Canned AI and market research responses for demo mode

export const MOCK_AI_RESPONSES: Record<string, string> = {
  // Default fallback
  default:
    "Based on the current document context, here are my thoughts:\n\n**Key Observations:**\n- The feature described aligns well with user feedback around collaboration needs\n- There are several technical considerations to address before implementation\n- The scope seems appropriate for a single sprint\n\n**Recommendations:**\n1. Start with a minimal implementation that covers the core use case\n2. Add edge case handling in a follow-up iteration\n3. Consider the impact on existing workflows before launching broadly\n\nWould you like me to dive deeper into any of these areas?",

  // User story generation
  user_stories:
    "## Generated User Stories\n\n**Story 1: Basic Flow**\nAs a team member, I want to see real-time updates when my teammates change task status so that I always have an accurate view of work in progress.\n\n**Acceptance Criteria:**\n- Given I am viewing a board, when another user moves a task, then I see the change within 500ms\n- Given I am offline, when I reconnect, then the board syncs to the latest state\n\n**Story 2: Conflict Resolution**\nAs a user editing a task simultaneously with a colleague, I want to see their changes merged with mine so that neither of us loses work.\n\n**Acceptance Criteria:**\n- Given two users are editing the same task description, when both save, then both changes are preserved\n- Given a merge conflict occurs, when the system cannot auto-merge, then both users see a visual diff\n\n**Story 3: Presence Indicators**\nAs a team member, I want to see who else is viewing or editing a task so that I can avoid conflicting edits.\n\n**Acceptance Criteria:**\n- Given I open a task, when another user is also viewing it, then I see their avatar on the task card\n- Given a user leaves a task, when 10 seconds pass with no activity, then their presence indicator disappears",

  // Acceptance criteria
  acceptance_criteria:
    "## Acceptance Criteria\n\n**Happy Path:**\n- Given the user is authenticated, when they perform the action, then the expected result occurs within 2 seconds\n- Given valid input is provided, when the form is submitted, then a success confirmation is displayed\n\n**Error Handling:**\n- Given the server returns an error, when the action fails, then a descriptive error message is shown\n- Given the network is unavailable, when the user tries to save, then changes are queued for retry\n\n**Edge Cases:**\n- Given the user has no permissions, when they attempt the action, then they see a 403 message\n- Given concurrent edits occur, when changes conflict, then the system preserves both versions",

  // Conflict check
  conflicts:
    "## Conflict Analysis\n\nI've reviewed the current document against related specifications in your workspace.\n\n**No Direct Conflicts Found**\n\nHowever, there are some areas of potential tension:\n\n1. **Async-First Principle vs Real-time Features**: The principle states \"every action should have a non-blocking path,\" but real-time collaboration inherently requires synchronous presence. Consider adding a \"focus mode\" that suppresses real-time indicators.\n\n2. **Mobile App PRD**: The mobile PRD mentions offline read access, which could conflict with real-time sync semantics. Clarify how offline-created content merges when the device reconnects.\n\n3. **Performance Metrics**: The API latency metric shows p95 is already at 340ms. Adding WebSocket connections could push this higher. The success metric for real-time sync (200ms p95) may be at risk.",

  // Rewrite for audience
  rewrite:
    "## Executive Summary\n\n**What:** Adding real-time collaboration to TaskFlow so teams can work on tasks simultaneously.\n\n**Why:** Customer research shows teams waste 30+ minutes per sprint planning session taking turns editing. Real-time editing could reduce sprint planning time by 50% and improve task resolution speed by 40%.\n\n**Impact:** Expected to increase collaboration session adoption to 30% of active users within 8 weeks, with a projected NPS lift of 10+ points for collaboration features.\n\n**Investment:** 2 engineers for 8 weeks. Primary risk is WebSocket infrastructure costs at scale — CTO has requested cost projections.\n\n**Timeline:** Demo-ready by end of Q1 for Series B investor conversations.",

  // Edge cases
  edge_cases:
    "## Edge Cases & Security Concerns\n\n**Concurrency:**\n- Two users drag the same task card simultaneously — need last-write-wins with visual conflict indicator\n- User A deletes a task while User B is editing it — show \"task was deleted\" notification\n- Board with 200+ tasks and 8 simultaneous viewers — need virtualized rendering and batched WebSocket updates\n\n**Security:**\n- WebSocket connections must validate auth tokens on each message, not just on connection\n- Room-based broadcasting must verify workspace membership to prevent cross-tenant data leaks\n- Rate-limit WebSocket messages to prevent abuse (max 100 messages/second per client)\n\n**Data Integrity:**\n- CRDT merge producing unexpected results with nested content (lists within lists)\n- Clock skew between clients causing out-of-order operations\n- Large documents (>100KB) causing CRDT state to exceed WebSocket frame limits",

  // Feasibility / engineering
  engineering:
    "## Technical Feasibility Assessment\n\n**How Engineering Would Build This:**\n\n1. **WebSocket Layer**: Set up a Supabase Realtime channel per board/task for presence and live updates. Use Yjs CRDT library for document-level collaboration.\n\n2. **Affected Modules:**\n   - `src/components/Board/KanbanBoard.tsx` — Add real-time card position sync\n   - `src/hooks/useTasks.ts` — Replace polling with WebSocket subscription\n   - `src/services/TaskService.ts` — Add conflict resolution for concurrent status changes\n   - `src/lib/websocket/manager.ts` — New module for connection pooling and room management\n\n3. **Effort Estimate: Large (L)**\n   - WebSocket infrastructure: 2 weeks\n   - CRDT integration for task editing: 3 weeks\n   - Board real-time sync: 1 week\n   - Testing and edge cases: 2 weeks\n\n4. **Risks:**\n   - Supabase Realtime has a 200 concurrent connections limit on the free tier\n   - CRDT library adds ~15KB to bundle size\n   - Need to handle graceful degradation when WebSocket connection drops",

  // Effort estimate
  effort:
    "## Effort Estimate: **Medium (M)**\n\n**Breakdown:**\n- Core implementation: 1-2 weeks for one engineer\n- Edge cases and error handling: 2-3 days\n- Testing (unit + integration): 2-3 days\n- Code review and iteration: 1-2 days\n\n**Total: ~2-3 weeks** for a single engineer, or **~1.5 weeks** with a pair.\n\n**Confidence:** Medium-High. The main uncertainty is around integration with existing real-time infrastructure, which could add 3-5 days if unexpected issues arise.\n\n**Dependencies:**\n- WebSocket infrastructure must be deployed and load-tested\n- CRDT library selection must be finalized\n- Design specs for presence indicators needed from design team",

  // Codebase changes
  codebase_changes:
    "## Required Codebase Changes\n\n- [ ] `src/hooks/useTasks.ts` — Add Supabase Realtime subscription for live task updates\n- [ ] `src/components/Board/KanbanBoard.tsx` — Wire up real-time card movement events\n- [ ] `src/services/TaskService.ts` — Add optimistic update rollback on server conflict\n- [ ] `src/lib/websocket/manager.ts` — Create new WebSocket connection manager\n- [ ] `src/components/TaskCard/TaskCard.tsx` — Add presence avatars overlay\n- [ ] `src/app/api/tasks/route.ts` — Add broadcast event on task mutation\n- [ ] `src/config/feature-flags.ts` — Add `realtime_collaboration` flag\n- [ ] `src/models/Task.ts` — Add `lastEditedBy` and `editedAt` fields for conflict tracking",

  // Market research
  market_research:
    "## Market Research Summary\n\n**Competitor Landscape:**\n- **Linear** launched real-time collaboration in Q3 2025 — adoption grew 40% quarter-over-quarter\n- **Height** has had real-time editing since launch — it's their #1 differentiator\n- **Shortcut** announced collaboration features on their 2026 roadmap\n\n**Best Practices:**\n- Google Docs pattern: show colored cursors, allow comments on selections, auto-save every keystroke\n- Figma pattern: show avatar stack on canvas, subtle presence indicators that don't distract\n- Notion pattern: block-level locking during active editing with graceful conflict resolution\n\n**Verdict: BUILD** — Real-time collaboration is table stakes for modern project management tools. Not having it is becoming a competitive disadvantage. Early mover advantage in the async-first space gives us a unique positioning angle.",

  // Who's asking for this
  whos_asking:
    "## Who's Asking For This?\n\n**Request Frequency:** 12 distinct pieces of evidence mention this need\n\n**Customer Segments:**\n- Enterprise teams (5 requests) — Need this for compliance and audit workflows\n- Mid-market product teams (4 requests) — Want it for cross-functional alignment\n- Startup teams (3 requests) — Need it to move fast without losing context\n\n**Urgency Signals:**\n- CloudScale (Enterprise): \"This is a blocker for our Q2 renewal\" — HIGH urgency, churn risk\n- Priya M.: \"We're evaluating alternatives that have this\" — competitive pressure\n- DevTools team: \"Would save us 2 hours per sprint\" — productivity impact\n\n**Key Quotes:**\n1. \"Without this, we're copying data between three tools\" — Sarah K., Product Lead\n2. \"My team literally cannot collaborate in real-time during planning\" — Marcus R., Engineering Manager\n3. \"This is the #1 feature holding us back from upgrading\" — CloudScale account\n\n**Gaps:** No feedback from design teams or solo users — worth investigating if they have different needs.",

  // Challenge this spec
  challenge_spec:
    "## Critical Review\n\n**HIGH - Unstated Assumptions:**\n- Assumes users will adopt real-time collaboration over their existing async workflows. No evidence validates this assumption.\n- Assumes WebSocket infrastructure can handle 200+ concurrent connections without cost implications.\n\n**HIGH - Evidence Gaps:**\n- The spec claims \"high demand\" but only references 3 customer quotes. Need broader validation.\n- No data on how competitors' adoption rates changed after launching similar features.\n\n**MEDIUM - Conflicts:**\n- The \"async-first\" product principle conflicts with a real-time feature. Needs explicit reconciliation.\n- Mobile app spec mentions offline-first — how does real-time sync interact with offline state?\n\n**MEDIUM - Missing Edge Cases:**\n- What happens when a user has the spec open in two tabs?\n- No mention of rate limiting or abuse prevention for WebSocket connections.\n- No accessibility considerations for real-time cursor indicators.\n\n**LOW - Scope Concerns:**\n- Trying to solve collaboration, presence, AND conflict resolution in one spec. Consider phasing.",

  // Build the case
  build_the_case:
    "## Business Case: Real-Time Collaboration\n\n**Problem Statement:**\nTeams waste 30+ minutes per sprint planning session because they can't edit simultaneously. 12 customers have explicitly requested this, with 2 flagging it as a renewal blocker.\n\n**Customer Demand: Strong**\n- 12 evidence items across 3 segments\n- 2 accounts at churn risk without it\n- Enterprise segment willing to upgrade plans for it\n\n**Market Context:**\n- Linear launched this in Q3 2025 — adoption grew 40% QoQ\n- Forrester reports 78% of teams expect real-time collaboration\n- Not having it is becoming a competitive disadvantage\n\n**Strategic Alignment:**\n- Aligns with \"empower teams\" principle\n- Supports enterprise expansion strategy\n- Creates platform stickiness through collaboration lock-in\n\n**Risk of Inaction:**\n- 2 enterprise accounts ($180K ARR) at risk\n- Losing competitive evaluations to Linear and Height\n- Engineering team morale — they want to build this\n\n**Recommended MVP Scope:**\nStart with presence indicators + live status updates. Defer full document co-editing to phase 2.",

  // What's missing
  whats_missing:
    "## Gap Analysis\n\n**Uncovered Customer Requests:**\n- 3 evidence items mention needing audit logs for compliance — not in spec\n- 2 items mention mobile support for real-time features — spec only covers web\n- 1 item from CloudScale mentions SSO requirement for collaboration sessions\n\n**Missing Patterns from Peer Specs:**\n- Error handling: Other specs include retry logic and graceful degradation sections\n- Analytics: No tracking plan for measuring collaboration adoption\n- Accessibility: No mention of screen reader support for presence indicators\n- Performance budget: Other specs set explicit latency targets\n\n**Unaddressed Personas:**\n- Read-only viewers (stakeholders who observe but don't edit)\n- External collaborators (contractors, clients)\n\n**Integration Gaps:**\n- No mention of notification system integration (should users be notified when someone starts editing?)\n- No connection to the permissions/roles spec — who can collaborate?\n\n**Acceptance Criteria Gaps:**\n- No criteria for connection loss/recovery\n- No criteria for maximum number of simultaneous editors",

  // What to build next
  what_to_build_next:
    "## What to Build Next\n\n**Top 3 Opportunities:**\n\n1. Real-Time Collaboration (8 evidence items, no spec coverage)\n   - Strongest theme in evidence clusters\n   - Aligns with \"empower teams\" principle\n   - Suggested scope: Start with presence indicators and live task status sync\n\n2. Advanced Reporting & Analytics (6 evidence items, partial coverage)\n   - Current analytics spec only covers basic metrics\n   - Enterprise customers need custom reports for stakeholder updates\n   - Suggested scope: Spec for customizable dashboard with export\n\n3. Integration Hub (5 evidence items, no spec coverage)\n   - Slack, Jira, and GitHub integrations requested repeatedly\n   - Reduces tool-switching friction — core pain point\n   - Suggested scope: Start with Slack notifications + GitHub PR links\n\n**Prioritize Existing Specs:**\n- Mobile App v2 (4 evidence items supporting it, already in draft)\n- API Access for Enterprise (3 items, spec complete but not scheduled)\n\n**Deprioritize:**\n- Dark Mode spec (1 evidence item, low impact)\n- Custom Themes (0 evidence items, nice-to-have)",

  // Customer struggles
  customer_struggles:
    "## Customer Pain Points Report\n\n**Top Pain Points (Ranked):**\n\n1. Cannot collaborate in real-time (8 mentions, BLOCKING)\n   - Teams resorting to Google Docs for planning sessions\n   - Addressed by: No existing spec\n\n2. Slow search across large workspaces (6 mentions, FRUSTRATING)\n   - Users with 200+ items report 5-10 second search times\n   - Addressed by: Search improvements spec (partially)\n\n3. No way to see who changed what (5 mentions, FRUSTRATING)\n   - Compliance teams need audit trails\n   - Addressed by: No existing spec\n\n4. Missing integrations (5 mentions, FRUSTRATING)\n   - Context-switching between Slack, Jira, and this tool\n   - Addressed by: No existing spec\n\n5. Mobile experience too limited (3 mentions, MINOR)\n   - Can view but can't meaningfully edit on mobile\n   - Addressed by: Mobile App spec (in draft)\n\n**Emerging Patterns:**\n- AI-assisted writing (2 mentions) — early signal worth watching\n- Role-based permissions (2 mentions) — enterprise-specific need\n\n**Positive Signals:**\n- Users love the keyboard shortcuts and speed\n- Evidence management praised as unique differentiator\n- Onboarding experience rated highly",

  // Unaddressed feedback
  unaddressed_feedback:
    "## Unaddressed Feedback Analysis\n\n**Unlinked Evidence Themes:**\n\n1. Integration Requests (5 items)\n   - \"Need Slack notifications when specs change\" — DevOps team\n   - \"Would love to link GitHub PRs directly to specs\" — Sarah K.\n   - \"Can we import from Confluence?\" — Enterprise onboarding\n   - Should become a new spec? YES — High demand, clear scope\n\n2. Audit & Compliance (3 items)\n   - \"We need to see who changed what for SOC2\" — CloudScale\n   - \"Version history is essential for our workflow\" — FinTech client\n   - Should become a new spec? YES — Blocker for enterprise segment\n\n3. Workflow Automation (2 items)\n   - \"Would love auto-assignment based on spec type\" — Marcus R.\n   - \"Trigger notifications when status changes\" — Product team\n   - Should become a new spec? MAYBE — Wait for more signal\n\n**Coverage Gaps:**\n- Evidence cluster 'Team Communication' has 6 items but no matching spec\n- Evidence cluster 'Onboarding' has 4 items — partially covered by existing docs\n\n**Recommended New Specs:**\n1. Integration Hub — Slack + GitHub + Jira connectors\n2. Audit Trail & Version History — Change tracking with diff view\n3. Team Communication — In-app comments and @mentions on specs",

  // Feedback summary
  feedback_summary:
    "## Feedback Summary\n\nBased on customer evidence in your workspace:\n\n**Key Themes:**\n1. **Collaboration demand is high** — Multiple customers have requested simultaneous editing, especially during sprint planning sessions (see: feedback from Priya M. at CloudScale)\n2. **Performance is a concern** — API latency is already trending up. Adding real-time features needs careful performance work (see: P95 latency metric)\n3. **Keyboard users are power users** — Customers who use keyboard shortcuts are more engaged and more vocal about wanting advanced features (see: feedback from @devtools_sarah)\n\n**Sentiment:** Predominantly positive toward collaboration features, with caution around complexity and performance.",
};

export const MOCK_MARKET_RESULTS = [
  {
    title: "How Linear Built Real-Time Collaboration for 100K Teams",
    snippet:
      "Linear's engineering team shares their approach to implementing real-time collaboration using CRDTs and WebSocket connections. Key insight: they chose Yjs over Automerge for its mature ecosystem and smaller bundle size.",
    url: "https://linear.app/blog/real-time-collaboration",
    source: "linear.app",
  },
  {
    title: "The State of Project Management Tools 2026",
    snippet:
      "Forrester's annual report on PM tools shows that real-time collaboration is now expected by 78% of teams. Tools without it see 2.3x higher churn in the first 90 days.",
    url: "https://forrester.com/report/pm-tools-2026",
    source: "forrester.com",
  },
  {
    title: "CRDTs for Beginners: Building Collaborative Apps",
    snippet:
      "A practical guide to implementing Conflict-free Replicated Data Types in web applications. Covers Yjs, Automerge, and hybrid approaches with real-world performance benchmarks.",
    url: "https://crdt.tech/tutorials/beginners-guide",
    source: "crdt.tech",
  },
  {
    title: "Why Async-First Teams Still Need Real-Time Features",
    snippet:
      "Research from GitLab's remote work team shows that async-first doesn't mean async-only. The best remote teams use real-time collaboration for specific high-bandwidth activities like planning and design reviews.",
    url: "https://about.gitlab.com/blog/async-realtime-balance",
    source: "about.gitlab.com",
  },
  {
    title: "WebSocket vs Server-Sent Events for Real-Time Updates",
    snippet:
      "A technical comparison of WebSocket and SSE for different real-time use cases. WebSocket wins for bidirectional communication (editing, presence), SSE wins for unidirectional updates (notifications, feeds).",
    url: "https://web.dev/articles/websocket-vs-sse",
    source: "web.dev",
  },
];
