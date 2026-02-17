// Realistic artifact content for TaskFlow product
// Content is in Tiptap JSON format

function text(t: string) {
  return { type: "text", text: t };
}

function paragraph(...texts: string[]) {
  return {
    type: "paragraph",
    content: texts.map((t) => text(t)),
  };
}

function heading(level: number, t: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [text(t)],
  };
}

function bulletList(...items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function doc(...content: Record<string, unknown>[]) {
  return { type: "doc", content };
}

export type SeedArtifact = {
  key: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  parentKey?: string;
};

export const ARTIFACTS: SeedArtifact[] = [
  {
    key: "prd-realtime",
    type: "prd",
    title: "Real-time Collaboration",
    status: "active",
    content: doc(
      heading(1, "Real-time Collaboration"),
      heading(2, "Problem Statement"),
      paragraph(
        "Remote teams lose 3-5 hours per week to context switching between async tools (Slack, Notion, Jira) and synchronous sessions (Zoom, Google Meet). When teammates need to collaborate on a task in real time, they cobble together screen shares and chat threads — fragmenting the conversation across tools and losing context after the session ends."
      ),
      heading(2, "Goals"),
      bulletList(
        "Reduce time-to-resolution for blocked tasks by 40%",
        "Enable real-time co-editing of task descriptions, comments, and checklists",
        "Persist all real-time session context as first-class task history",
        "Support 2-8 simultaneous collaborators per task without performance degradation"
      ),
      heading(2, "User Stories"),
      paragraph(
        "See linked user stories below for detailed acceptance criteria."
      ),
      heading(2, "Success Metrics"),
      bulletList(
        "Average task resolution time decreases from 4.2 hours to 2.5 hours",
        "Collaboration session adoption reaches 30% of active users within 8 weeks",
        "Net Promoter Score for collaboration features exceeds 45",
        "P95 latency for real-time sync operations stays under 200ms"
      ),
      heading(2, "Non-Goals"),
      bulletList(
        "Video/audio calling (integrate with existing tools instead)",
        "Whiteboarding or diagramming (out of scope for v1)",
        "Offline-first editing (requires significant architecture changes)"
      ),
      heading(2, "Technical Considerations"),
      paragraph(
        "The current architecture uses polling for task updates. Real-time collaboration requires WebSocket connections or a CRDT-based approach. We should evaluate Yjs vs Automerge for conflict resolution. The database layer needs to support operational transforms or last-write-wins semantics depending on the data type."
      ),
      heading(2, "Risks"),
      bulletList(
        "WebSocket connections at scale could significantly increase infrastructure costs",
        "CRDT implementation complexity may delay the timeline by 2-3 weeks",
        "Real-time presence indicators could create social pressure in an async-first tool"
      )
    ),
  },
  {
    key: "prd-mobile",
    type: "prd",
    title: "Mobile App (iOS & Android)",
    status: "draft",
    content: doc(
      heading(1, "Mobile App"),
      heading(2, "Problem Statement"),
      paragraph(
        "35% of our users check TaskFlow on mobile browsers during commutes and between meetings. The mobile web experience is functional but slow — page loads average 3.2 seconds and the editor is unusable on small screens. Users report they want to triage notifications, update task status, and leave quick comments from their phone."
      ),
      heading(2, "Goals"),
      bulletList(
        "Launch native iOS and Android apps within Q2 2026",
        "Support task viewing, status updates, and commenting",
        "Push notifications for mentions and blocked task updates",
        "Offline read access to assigned tasks"
      ),
      heading(2, "Open Questions"),
      bulletList(
        "React Native vs native Swift/Kotlin — need engineering assessment",
        "Should we support full task editing on mobile or just quick actions?",
        "How does offline sync interact with the real-time collaboration feature?"
      )
    ),
  },
  {
    key: "story-sprint-board",
    type: "user_story",
    title: "Create and manage sprint boards",
    status: "active",
    parentKey: "prd-realtime",
    content: doc(
      heading(1, "Create and manage sprint boards"),
      heading(2, "User Story"),
      paragraph(
        "As a team lead, I want to create sprint boards with customizable columns so that my team can visualize work in progress and identify bottlenecks before standup."
      ),
      heading(2, "Acceptance Criteria"),
      bulletList(
        "Given I am on the project page, when I click 'New Board', then a board is created with default columns: Backlog, In Progress, In Review, Done",
        "Given I have a board, when I drag a column header, then I can reorder columns",
        "Given I have a board, when I click the column menu, then I can rename, add, or remove columns",
        "Given a board has tasks, when I drag a task card between columns, then the task status updates in real time for all viewers",
        "Given multiple users are viewing the board, when any user moves a card, then all users see the update within 500ms"
      ),
      heading(2, "Edge Cases"),
      bulletList(
        "Board with 200+ tasks should still render smoothly (virtualized list)",
        "Simultaneous drag by two users on the same card — last write wins with visual conflict indicator",
        "Column deletion with tasks in it — prompt to move tasks to another column"
      )
    ),
  },
  {
    key: "story-code-review",
    type: "user_story",
    title: "Inline code review on tasks",
    status: "draft",
    parentKey: "prd-realtime",
    content: doc(
      heading(1, "Inline code review on tasks"),
      heading(2, "User Story"),
      paragraph(
        "As a developer, I want to review code diffs directly within a task card so that code review context stays attached to the feature it implements rather than being isolated in GitHub."
      ),
      heading(2, "Acceptance Criteria"),
      bulletList(
        "Given a task is linked to a GitHub PR, when I open the task, then I see the diff summary with files changed",
        "Given I am viewing a diff, when I click a line, then I can leave an inline comment visible to all task collaborators",
        "Given a comment is left on a diff, when the PR is updated, then outdated comments are marked but not deleted"
      )
    ),
  },
  {
    key: "principle-async",
    type: "principle",
    title: "Async-First Communication",
    status: "active",
    content: doc(
      heading(1, "Async-First Communication"),
      heading(2, "Principle"),
      paragraph(
        "Every interaction in TaskFlow should have a non-blocking path. Users should never be forced to wait for a synchronous response to make progress on their work. Real-time features are opt-in enhancements, not requirements."
      ),
      heading(2, "Implications"),
      bulletList(
        "All comments and updates are persisted and accessible after the fact",
        "Notifications are batched by default (hourly digest) with instant delivery as opt-in",
        "Status changes happen optimistically — no confirmation dialogs for routine actions",
        "Collaborative editing sessions leave a complete audit trail for teammates who join later",
        "Deadline and reminder features assume timezone awareness across distributed teams"
      ),
      heading(2, "Exceptions"),
      paragraph(
        "Direct messages and @mentions may trigger immediate notifications if the recipient has opted into instant alerts. Security-critical actions (account deletion, permission changes) require synchronous confirmation."
      )
    ),
  },
  {
    key: "decision-database",
    type: "decision_log",
    title: "Database Selection: PostgreSQL vs MongoDB",
    status: "active",
    content: doc(
      heading(1, "Database Selection: PostgreSQL vs MongoDB"),
      heading(2, "Context"),
      paragraph(
        "We need to select a primary database for TaskFlow. The application stores structured data (users, teams, projects), semi-structured data (task metadata, comments), and document-like data (rich text content, activity logs)."
      ),
      heading(2, "Options Considered"),
      heading(3, "PostgreSQL"),
      bulletList(
        "Strong ACID compliance for task state transitions",
        "JSONB columns handle semi-structured data well",
        "pgvector extension enables future AI/search features",
        "Mature ecosystem with Supabase for auth and real-time",
        "Team has deep PostgreSQL experience"
      ),
      heading(3, "MongoDB"),
      bulletList(
        "Natural fit for document-like task content",
        "Flexible schema evolution without migrations",
        "Built-in change streams for real-time features",
        "Less natural for relational queries (team membership, permissions)"
      ),
      heading(2, "Decision"),
      paragraph(
        "We chose PostgreSQL with Supabase. The combination of JSONB for flexible content, pgvector for future AI features, built-in auth, and the team's existing expertise made this the clear winner. The relational model also fits our permission system better than MongoDB's document model."
      ),
      heading(2, "Consequences"),
      bulletList(
        "Schema migrations required for structural changes",
        "JSONB queries are slightly less ergonomic than MongoDB's query language",
        "We get Row Level Security for free via Supabase",
        "Real-time subscriptions available through Supabase Realtime"
      )
    ),
  },
  {
    key: "roadmap-q1",
    type: "roadmap_item",
    title: "Q1 2026 Roadmap",
    status: "active",
    content: doc(
      heading(1, "Q1 2026 Roadmap"),
      heading(2, "Theme: Foundation for Collaboration"),
      paragraph(
        "Q1 focuses on laying the technical foundation for real-time collaboration while shipping incremental improvements to the core task management experience."
      ),
      heading(2, "January"),
      bulletList(
        "Sprint board v1 with drag-and-drop (2 engineers, 3 weeks)",
        "WebSocket infrastructure setup and load testing (1 engineer, 2 weeks)",
        "Mobile web performance optimization (1 engineer, 2 weeks)"
      ),
      heading(2, "February"),
      bulletList(
        "Real-time presence indicators on tasks (1 engineer, 2 weeks)",
        "Collaborative task editing with CRDT (2 engineers, 4 weeks)",
        "GitHub integration for code review (1 engineer, 3 weeks)"
      ),
      heading(2, "March"),
      bulletList(
        "Sprint board real-time sync (1 engineer, 2 weeks)",
        "Keyboard shortcuts overhaul (1 engineer, 1 week)",
        "Beta launch of collaboration features to 50 teams"
      ),
      heading(2, "Dependencies"),
      bulletList(
        "CRDT library selection must be finalized by Jan 15",
        "WebSocket infrastructure needs DevOps support for scaling",
        "GitHub app registration and OAuth setup needed before integration work"
      )
    ),
  },
  {
    key: "arch-summary",
    type: "architecture_summary",
    title: "TaskFlow Architecture Overview",
    status: "active",
    content: doc(
      heading(1, "TaskFlow Architecture Overview"),
      heading(2, "Frontend"),
      paragraph(
        "Next.js 16 application with React 19. Pages use the App Router with server components for initial data loading and client components for interactive features. Styling via Tailwind CSS v4 with a custom design token system. Rich text editing powered by Tiptap (ProseMirror)."
      ),
      heading(2, "Backend"),
      paragraph(
        "Supabase provides PostgreSQL database, authentication, and real-time subscriptions. API routes in Next.js handle business logic, AI integration, and external service calls. Row Level Security enforces multi-tenant data isolation at the database level."
      ),
      heading(2, "Key Services"),
      bulletList(
        "KanbanBoard: Drag-and-drop board component with react-dnd, optimistic state updates",
        "TaskService: Core CRUD operations for tasks with status machine validation",
        "NotificationService: Batched async notifications with digest scheduling",
        "AuthService: Supabase Auth with email/password and GitHub OAuth",
        "SearchService: Hybrid text + vector search using pgvector",
        "WebSocketManager: Connection pooling and room management for real-time features"
      ),
      heading(2, "Data Model"),
      paragraph(
        "PostgreSQL with 12 core tables. JSONB columns for flexible task content and activity metadata. pgvector extension for semantic search embeddings (1536 dimensions). Foreign key relationships enforce referential integrity with cascade deletes."
      ),
      heading(2, "Infrastructure"),
      bulletList(
        "Vercel for frontend hosting and serverless functions",
        "Supabase Cloud for database and auth",
        "GitHub Actions for CI/CD pipeline",
        "Sentry for error tracking and performance monitoring"
      )
    ),
  },
  {
    key: "prd-smart-notifications",
    type: "prd",
    title: "Smart Notifications & Digest System",
    status: "active",
    content: doc(
      heading(1, "Smart Notifications & Digest System"),
      heading(2, "Problem Statement"),
      paragraph(
        "TaskFlow users receive an average of 47 notifications per day. Internal research shows that 62% of these are ignored, and power users report notification fatigue as the #2 reason they mute channels entirely. When users mute notifications they miss genuinely urgent updates — blocked tasks, PR approvals, and deadline changes — leading to delayed delivery cycles. We need a system that surfaces the right information at the right time without overwhelming the user."
      ),
      heading(2, "Goals"),
      bulletList(
        "Reduce notification volume by 50% while increasing click-through rate by 30%",
        "Deliver a configurable daily/weekly digest email summarizing workspace activity",
        "Introduce urgency-based routing: critical notifications are delivered immediately, everything else is batched",
        "Allow users to set per-project and per-type notification preferences",
        "Ship an in-app notification center that replaces the current toast-only system"
      ),
      heading(2, "User Personas"),
      heading(3, "Sarah — Engineering Manager"),
      paragraph(
        "Sarah manages 3 squads (14 engineers). She needs to know when tasks are blocked, when PRs are approved, and when sprint goals are at risk. She does not need to know about every comment or status change. She checks TaskFlow in focused 30-minute blocks twice per day and relies on email digests the rest of the time."
      ),
      heading(3, "Kai — Individual Contributor"),
      paragraph(
        "Kai is a senior frontend engineer assigned to 4-6 tasks per sprint. He wants instant notifications for direct mentions and review requests but finds status change notifications distracting when he is in deep focus. He uses macOS Do Not Disturb from 9am-12pm daily."
      ),
      heading(2, "Proposed Solution"),
      heading(3, "1. Notification Scoring Engine"),
      paragraph(
        "Each notification event is scored on a 0-100 urgency scale based on: event type weight, user role relative to the task, time sensitivity (approaching deadline), and historical engagement patterns. Events scoring above 80 are delivered immediately. Events scoring 40-80 are batched into hourly summaries. Events below 40 are rolled into the daily digest only."
      ),
      heading(3, "2. In-App Notification Center"),
      paragraph(
        "A slide-over panel accessible from the top nav bell icon. Notifications are grouped by project and sorted by urgency score. Each notification supports inline actions — approve, reply, snooze, or mark as read — without navigating away from the current view. Unread count badge on the bell icon. Keyboard shortcut: Cmd+Shift+N to toggle."
      ),
      heading(3, "3. Digest Emails"),
      paragraph(
        "Configurable daily or weekly email digest. The digest includes: tasks that moved to blocked, PRs awaiting your review, upcoming deadlines (next 48 hours), a summary of comments on your tasks, and a team velocity snapshot. Powered by a scheduled Supabase Edge Function running at the user's preferred time (default 8am local)."
      ),
      heading(3, "4. Preference Controls"),
      paragraph(
        "Per-project notification settings (all, mentions only, none). Per-event-type toggles (comments, status changes, assignments, deadlines). Quiet hours configuration with timezone support. A 'Focus Mode' toggle that batches everything except direct mentions for the next N hours."
      ),
      heading(2, "Success Metrics"),
      bulletList(
        "Notification volume per user drops from 47/day to under 25/day",
        "Notification click-through rate increases from 12% to 18%+",
        "Digest email open rate exceeds 40% after 4 weeks",
        "User-reported notification satisfaction (quarterly survey) improves from 3.1 to 4.0+ out of 5",
        "Zero increase in missed-deadline incidents after rollout"
      ),
      heading(2, "Non-Goals"),
      bulletList(
        "Push notifications for mobile (dependent on Mobile App PRD shipping first)",
        "Slack or Microsoft Teams integration for notification delivery (planned for Q3)",
        "AI-generated summaries of notification content (requires LLM infrastructure not yet approved)",
        "Notification sounds or desktop OS-level alerts"
      ),
      heading(2, "Technical Approach"),
      paragraph(
        "The scoring engine runs as a server-side function invoked on every notifiable event (task update, comment, assignment change). Scores are computed synchronously and written to a new notifications table with columns for recipient, urgency score, delivery channel, read status, and payload. A cron job (Supabase pg_cron or Edge Function) runs every 60 minutes to batch-deliver hourly summaries. The digest email job runs once daily per user timezone bucket."
      ),
      paragraph(
        "The in-app notification center uses Supabase Realtime subscriptions to push new notifications to connected clients. We will use a cursor-based pagination strategy for the notification list since users may accumulate thousands of entries over time."
      ),
      heading(2, "Risks & Mitigations"),
      bulletList(
        "Scoring model may not match user expectations initially — mitigate with a 2-week beta with 20 power users and a feedback loop to tune weights",
        "Digest emails could land in spam — mitigate by using a verified sending domain and keeping email content concise",
        "Notification table could grow rapidly — mitigate with a 90-day TTL and background cleanup job",
        "Hourly batch job could fail silently — mitigate with health check alerts in Sentry"
      ),
      heading(2, "Timeline"),
      bulletList(
        "Week 1-2: Notification scoring engine + notifications table schema",
        "Week 3-4: In-app notification center UI + Realtime integration",
        "Week 5: Digest email templates + Edge Function scheduler",
        "Week 6: Preference controls UI + quiet hours logic",
        "Week 7: Internal dogfood + bug fixes",
        "Week 8: Beta rollout to 20 teams, begin tuning scoring weights"
      ),
      heading(2, "Open Questions"),
      bulletList(
        "Should we expose the urgency score to users or keep it an internal signal?",
        "Do we archive or hard-delete notifications after the 90-day TTL?",
        "Should digest emails include tasks the user is watching but not assigned to?",
        "How do we handle notification preferences for users who belong to 5+ projects — per-project settings could be overwhelming"
      )
    ),
  },
];
