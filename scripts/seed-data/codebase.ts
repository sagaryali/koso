// Fake codebase modules for the TaskFlow product

export const CODEBASE_CONNECTION = {
  repo_url: "https://github.com/taskflow/taskflow-app",
  repo_name: "taskflow/taskflow-app",
  default_branch: "main",
  status: "ready",
  file_count: 47,
  module_count: 23,
};

export type SeedModule = {
  file_path: string;
  module_name: string;
  module_type: string;
  language: string;
  summary: string;
  dependencies: string[];
  exports: string[];
  raw_content: string;
};

export const CODEBASE_MODULES: SeedModule[] = [
  {
    file_path: "src/components/Board/KanbanBoard.tsx",
    module_name: "KanbanBoard",
    module_type: "component",
    language: "TypeScript",
    summary:
      "Main kanban board component with drag-and-drop support using react-dnd. Renders columns with virtualized task cards for performance. Supports optimistic reordering with server reconciliation.",
    dependencies: ["react", "react-dnd", "@/hooks/useTasks", "@/hooks/useBoard", "@/components/TaskCard"],
    exports: ["KanbanBoard", "KanbanColumn", "KanbanBoardProps"],
    raw_content: `import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTasks } from '@/hooks/useTasks';
import { useBoard } from '@/hooks/useBoard';
import { TaskCard } from '@/components/TaskCard';

interface KanbanBoardProps {
  boardId: string;
  columns: Column[];
  onTaskMove: (taskId: string, columnId: string, index: number) => void;
}

export function KanbanBoard({ boardId, columns, onTaskMove }: KanbanBoardProps) {
  const { tasks, moveTask } = useTasks(boardId);
  const { board, updateColumn } = useBoard(boardId);

  const handleDrop = (taskId: string, targetColumn: string, index: number) => {
    moveTask(taskId, targetColumn, index); // optimistic
    onTaskMove(taskId, targetColumn, index); // server sync
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex gap-4 overflow-x-auto p-4">
        {columns.map(col => (
          <KanbanColumn key={col.id} column={col} tasks={tasks.filter(t => t.columnId === col.id)} onDrop={handleDrop} />
        ))}
      </div>
    </DndProvider>
  );
}`,
  },
  {
    file_path: "src/components/TaskCard/TaskCard.tsx",
    module_name: "TaskCard",
    module_type: "component",
    language: "TypeScript",
    summary:
      "Draggable task card component that displays title, assignee avatar, priority badge, and due date. Supports inline editing of title and keyboard navigation (j/k for selection, Enter to open).",
    dependencies: ["react", "react-dnd", "@/components/Avatar", "@/components/Badge"],
    exports: ["TaskCard", "TaskCardProps"],
    raw_content: `import React from 'react';
import { useDrag } from 'react-dnd';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';

interface TaskCardProps {
  task: Task;
  onOpen: (taskId: string) => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskCard({ task, onOpen, onUpdate }: TaskCardProps) {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'TASK',
    item: { id: task.id, columnId: task.columnId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  return (
    <div ref={dragRef} className="border p-3 bg-white cursor-pointer" onClick={() => onOpen(task.id)} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <h3 className="text-sm font-medium">{task.title}</h3>
      <div className="flex items-center gap-2 mt-2">
        {task.assignee && <Avatar user={task.assignee} size="sm" />}
        {task.priority && <Badge variant={task.priority}>{task.priority}</Badge>}
      </div>
    </div>
  );
}`,
  },
  {
    file_path: "src/services/TaskService.ts",
    module_name: "TaskService",
    module_type: "service",
    language: "TypeScript",
    summary:
      "Core service for task CRUD operations. Validates status transitions using a state machine pattern. Handles task assignment, estimation, and dependency tracking. All mutations go through Supabase with optimistic updates on the client.",
    dependencies: ["@supabase/supabase-js", "@/models/Task", "@/lib/validation"],
    exports: ["TaskService", "createTask", "updateTask", "deleteTask", "moveTask", "assignTask"],
    raw_content: `import { createClient } from '@supabase/supabase-js';
import { Task, TaskStatus } from '@/models/Task';

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['todo'],
  todo: ['in_progress', 'backlog'],
  in_progress: ['in_review', 'todo', 'blocked'],
  in_review: ['done', 'in_progress'],
  blocked: ['in_progress', 'todo'],
  done: ['in_progress'],
};

export class TaskService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async createTask(data: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
    const { data: task, error } = await this.supabase.from('tasks').insert(data).select().single();
    if (error) throw error;
    return task;
  }

  async moveTask(taskId: string, newStatus: TaskStatus): Promise<Task> {
    const { data: current } = await this.supabase.from('tasks').select('status').eq('id', taskId).single();
    if (!current || !VALID_TRANSITIONS[current.status]?.includes(newStatus)) {
      throw new Error(\`Invalid transition: \${current?.status} -> \${newStatus}\`);
    }
    const { data: task, error } = await this.supabase.from('tasks').update({ status: newStatus }).eq('id', taskId).select().single();
    if (error) throw error;
    return task;
  }
}`,
  },
  {
    file_path: "src/services/NotificationService.ts",
    module_name: "NotificationService",
    module_type: "service",
    language: "TypeScript",
    summary:
      "Handles notification creation, batching, and delivery. Supports digest mode (hourly batch) and instant delivery for mentions. Uses a priority queue to avoid overwhelming users. Integrates with email and push notification providers.",
    dependencies: ["@supabase/supabase-js", "@/lib/queue", "@/services/EmailService"],
    exports: ["NotificationService", "createNotification", "batchDigest", "NotificationType"],
    raw_content: `import { createClient } from '@supabase/supabase-js';

type NotificationType = 'mention' | 'assignment' | 'status_change' | 'comment' | 'due_date';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
  read: boolean;
  createdAt: string;
}

export class NotificationService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async create(userId: string, type: NotificationType, data: { title: string; body: string; taskId?: string }) {
    // Mentions always deliver instantly
    const instant = type === 'mention';
    const { data: notification } = await this.supabase.from('notifications').insert({ user_id: userId, type, ...data, instant }).select().single();
    if (instant) await this.deliverPush(userId, notification);
    return notification;
  }

  async batchDigest(userId: string) {
    const { data: unread } = await this.supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false).eq('instant', false);
    if (!unread?.length) return;
    await this.sendDigestEmail(userId, unread);
  }
}`,
  },
  {
    file_path: "src/services/SearchService.ts",
    module_name: "SearchService",
    module_type: "service",
    language: "TypeScript",
    summary:
      "Hybrid search service combining full-text PostgreSQL search with vector similarity search via pgvector. Supports filtering by project, status, assignee, and date range. Returns ranked results with snippet highlighting.",
    dependencies: ["@supabase/supabase-js", "openai", "@/lib/embeddings"],
    exports: ["SearchService", "search", "indexTask", "SearchResult"],
    raw_content: `import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export interface SearchResult {
  taskId: string;
  title: string;
  snippet: string;
  score: number;
  matchType: 'text' | 'semantic' | 'hybrid';
}

export class SearchService {
  private openai: OpenAI;
  constructor(private supabase: ReturnType<typeof createClient>) {
    this.openai = new OpenAI();
  }

  async search(query: string, projectId: string, options?: { limit?: number }): Promise<SearchResult[]> {
    const embedding = await this.generateEmbedding(query);
    const { data } = await this.supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: JSON.stringify(embedding),
      project_id: projectId,
      match_limit: options?.limit || 20,
    });
    return data || [];
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return response.data[0].embedding;
  }
}`,
  },
  {
    file_path: "src/models/Task.ts",
    module_name: "Task",
    module_type: "model",
    language: "TypeScript",
    summary:
      "Core Task type definition and related enums. Defines the full task schema including status, priority, estimation, assignee, labels, and rich text content. Includes Zod validation schemas for API input validation.",
    dependencies: ["zod"],
    exports: ["Task", "TaskStatus", "TaskPriority", "CreateTaskSchema", "UpdateTaskSchema"],
    raw_content: `import { z } from 'zod';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: Record<string, unknown>; // Tiptap JSON
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  estimate: number | null; // story points
  labels: string[];
  parentId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().uuid(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).default('none'),
  assigneeId: z.string().uuid().nullable().default(null),
  estimate: z.number().int().min(1).max(21).nullable().default(null),
});`,
  },
  {
    file_path: "src/models/Project.ts",
    module_name: "Project",
    module_type: "model",
    language: "TypeScript",
    summary:
      "Project model defining team workspaces. Each project has a name, description, members with roles, and default board configuration. Includes permission checking utilities.",
    dependencies: ["zod"],
    exports: ["Project", "ProjectRole", "ProjectMember", "CreateProjectSchema"],
    raw_content: `import { z } from 'zod';

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  joinedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  members: ProjectMember[];
  defaultBoardId: string | null;
  createdAt: string;
}

export function canEdit(member: ProjectMember): boolean {
  return ['owner', 'admin', 'member'].includes(member.role);
}`,
  },
  {
    file_path: "src/hooks/useTasks.ts",
    module_name: "useTasks",
    module_type: "utility",
    language: "TypeScript",
    summary:
      "React hook for task state management. Provides CRUD operations with optimistic updates and Supabase real-time subscription for live sync. Handles conflict resolution when server state diverges from optimistic updates.",
    dependencies: ["react", "@supabase/supabase-js", "@/services/TaskService"],
    exports: ["useTasks"],
    raw_content: `import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task } from '@/models/Task';

export function useTasks(boardId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase.channel(\`board:\${boardId}\`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: \`board_id=eq.\${boardId}\` }, (payload) => {
        // Reconcile server state with optimistic updates
        setTasks(prev => reconcile(prev, payload));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [boardId]);

  const moveTask = useCallback(async (taskId: string, columnId: string, index: number) => {
    setTasks(prev => optimisticMove(prev, taskId, columnId, index));
    await supabase.from('tasks').update({ column_id: columnId, position: index }).eq('id', taskId);
  }, []);

  return { tasks, moveTask };
}`,
  },
  {
    file_path: "src/hooks/useBoard.ts",
    module_name: "useBoard",
    module_type: "utility",
    language: "TypeScript",
    summary:
      "React hook for board configuration management. Handles column CRUD, board settings, and member permissions. Provides real-time sync for board structure changes across all connected clients.",
    dependencies: ["react", "@supabase/supabase-js"],
    exports: ["useBoard"],
    raw_content: `import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Board {
  id: string;
  projectId: string;
  name: string;
  columns: Column[];
}

interface Column {
  id: string;
  name: string;
  position: number;
  wipLimit: number | null;
}

export function useBoard(boardId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.from('boards').select('*, columns(*)').eq('id', boardId).single().then(({ data }) => setBoard(data));
  }, [boardId]);

  const addColumn = async (name: string) => {
    const position = (board?.columns.length || 0);
    await supabase.from('columns').insert({ board_id: boardId, name, position });
  };

  const updateColumn = async (columnId: string, updates: Partial<Column>) => {
    await supabase.from('columns').update(updates).eq('id', columnId);
  };

  return { board, addColumn, updateColumn };
}`,
  },
  {
    file_path: "src/hooks/useKeyboardShortcuts.ts",
    module_name: "useKeyboardShortcuts",
    module_type: "utility",
    language: "TypeScript",
    summary:
      "Global keyboard shortcut manager. Registers shortcuts with priority levels to handle conflicts. Supports modifier keys (Cmd/Ctrl, Shift, Alt) and sequences. Provides context-aware shortcuts that change based on the active panel.",
    dependencies: ["react"],
    exports: ["useKeyboardShortcuts", "Shortcut"],
    raw_content: `import { useEffect, useCallback, useRef } from 'react';

interface Shortcut {
  key: string;
  modifiers?: ('cmd' | 'ctrl' | 'shift' | 'alt')[];
  handler: () => void;
  priority?: number;
  context?: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], context?: string) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const matching = shortcutsRef.current
        .filter(s => !s.context || s.context === context)
        .filter(s => matchesShortcut(e, s))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      if (matching.length > 0) {
        e.preventDefault();
        matching[0].handler();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [context]);
}`,
  },
  {
    file_path: "src/app/api/tasks/route.ts",
    module_name: "tasks-api",
    module_type: "route",
    language: "TypeScript",
    summary:
      "REST API route for task CRUD operations. Supports GET (list with filters), POST (create), PATCH (update), and DELETE. Validates input with Zod schemas. Applies RLS through authenticated Supabase client.",
    dependencies: ["next/server", "@supabase/supabase-js", "@/models/Task"],
    exports: ["GET", "POST", "PATCH", "DELETE"],
    raw_content: `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateTaskSchema } from '@/models/Task';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  let query = supabase.from('tasks').select('*');
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query.order('position').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { data, error } = await supabase.from('tasks').insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}`,
  },
  {
    file_path: "src/app/api/boards/route.ts",
    module_name: "boards-api",
    module_type: "route",
    language: "TypeScript",
    summary:
      "REST API for board management. Handles board creation with default columns, board listing per project, and board configuration updates. Includes column reordering endpoint.",
    dependencies: ["next/server", "@supabase/supabase-js"],
    exports: ["GET", "POST", "PATCH"],
    raw_content: `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_COLUMNS = ['Backlog', 'In Progress', 'In Review', 'Done'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { name, projectId } = await request.json();

  const { data: board } = await supabase.from('boards').insert({ name, project_id: projectId }).select().single();
  if (!board) return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });

  const columns = DEFAULT_COLUMNS.map((name, i) => ({ board_id: board.id, name, position: i }));
  await supabase.from('columns').insert(columns);

  return NextResponse.json({ board }, { status: 201 });
}`,
  },
  {
    file_path: "src/app/api/notifications/route.ts",
    module_name: "notifications-api",
    module_type: "route",
    language: "TypeScript",
    summary:
      "Notification API endpoints. GET returns paginated unread notifications. POST marks notifications as read (single or bulk). DELETE clears all notifications for the authenticated user.",
    dependencies: ["next/server", "@supabase/supabase-js"],
    exports: ["GET", "POST", "DELETE"],
    raw_content: `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');

  const { data } = await supabase.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false }).limit(limit);
  return NextResponse.json({ notifications: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { ids } = await request.json();
  await supabase.from('notifications').update({ read: true }).in('id', ids);
  return NextResponse.json({ success: true });
}`,
  },
  {
    file_path: "src/lib/auth/permissions.ts",
    module_name: "permissions",
    module_type: "utility",
    language: "TypeScript",
    summary:
      "Permission checking utilities for project-level access control. Defines role hierarchy (owner > admin > member > viewer) and action permissions matrix. Used by API routes and UI components to gate features.",
    dependencies: ["@/models/Project"],
    exports: ["canPerformAction", "Action", "hasMinRole"],
    raw_content: `import { ProjectRole } from '@/models/Project';

export type Action = 'view' | 'edit' | 'delete' | 'manage_members' | 'manage_settings';

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

const ACTION_MIN_ROLE: Record<Action, ProjectRole> = {
  view: 'viewer',
  edit: 'member',
  delete: 'admin',
  manage_members: 'admin',
  manage_settings: 'owner',
};

export function canPerformAction(userRole: ProjectRole, action: Action): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[ACTION_MIN_ROLE[action]];
}

export function hasMinRole(userRole: ProjectRole, minRole: ProjectRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}`,
  },
  {
    file_path: "src/lib/websocket/manager.ts",
    module_name: "WebSocketManager",
    module_type: "service",
    language: "TypeScript",
    summary:
      "WebSocket connection manager for real-time collaboration. Handles connection pooling, room-based subscriptions, heartbeat/reconnection, and message broadcasting. Supports presence tracking (who is online/viewing what).",
    dependencies: ["ws"],
    exports: ["WebSocketManager", "Room", "Message"],
    raw_content: `interface Room {
  id: string;
  clients: Set<string>;
  state: Map<string, unknown>;
}

interface Message {
  type: 'presence' | 'update' | 'cursor' | 'selection';
  roomId: string;
  userId: string;
  payload: unknown;
}

export class WebSocketManager {
  private rooms = new Map<string, Room>();
  private heartbeatInterval = 30_000;

  joinRoom(roomId: string, userId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, { id: roomId, clients: new Set(), state: new Map() });
    }
    this.rooms.get(roomId)!.clients.add(userId);
    this.broadcast(roomId, { type: 'presence', roomId, userId, payload: { action: 'join' } });
  }

  broadcast(roomId: string, message: Message) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const clientId of room.clients) {
      if (clientId !== message.userId) this.send(clientId, message);
    }
  }

  private send(clientId: string, message: Message) {
    // Implementation depends on WebSocket server setup
  }
}`,
  },
  {
    file_path: "src/lib/analytics/tracker.ts",
    module_name: "tracker",
    module_type: "utility",
    language: "TypeScript",
    summary:
      "Client-side analytics event tracker. Wraps Mixpanel SDK with typed events. Automatically captures page views, feature usage, and performance metrics. Supports A/B test bucketing.",
    dependencies: ["mixpanel-browser"],
    exports: ["track", "identify", "trackPageView", "AnalyticsEvent"],
    raw_content: `type AnalyticsEvent =
  | { name: 'task_created'; properties: { projectId: string; source: 'board' | 'list' | 'shortcut' } }
  | { name: 'board_viewed'; properties: { boardId: string; taskCount: number } }
  | { name: 'search_performed'; properties: { query: string; resultCount: number } }
  | { name: 'shortcut_used'; properties: { shortcut: string } }
  | { name: 'collaboration_started'; properties: { taskId: string; participantCount: number } };

export function track(event: AnalyticsEvent) {
  if (typeof window === 'undefined') return;
  // @ts-ignore - mixpanel loaded via script tag
  window.mixpanel?.track(event.name, event.properties);
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  // @ts-ignore
  window.mixpanel?.identify(userId);
  if (traits) window.mixpanel?.people.set(traits);
}`,
  },
  {
    file_path: "src/config/feature-flags.ts",
    module_name: "feature-flags",
    module_type: "config",
    language: "TypeScript",
    summary:
      "Feature flag configuration. Simple boolean flags for gating features in development. Supports environment-based overrides. Used to gradually roll out collaboration features.",
    dependencies: [],
    exports: ["flags", "isEnabled", "FeatureFlag"],
    raw_content: `export type FeatureFlag =
  | 'realtime_collaboration'
  | 'mobile_push_notifications'
  | 'ai_task_generation'
  | 'advanced_search'
  | 'github_integration';

const FLAGS: Record<FeatureFlag, boolean> = {
  realtime_collaboration: true,
  mobile_push_notifications: false,
  ai_task_generation: true,
  advanced_search: true,
  github_integration: true,
};

export function isEnabled(flag: FeatureFlag): boolean {
  const envOverride = process.env[\`FEATURE_\${flag.toUpperCase()}\`];
  if (envOverride !== undefined) return envOverride === 'true';
  return FLAGS[flag];
}`,
  },
  {
    file_path: "src/config/constants.ts",
    module_name: "constants",
    module_type: "config",
    language: "TypeScript",
    summary:
      "Application-wide constants including API endpoints, rate limits, pagination defaults, and feature configuration. Centralizes magic numbers and strings used across the codebase.",
    dependencies: [],
    exports: ["API_BASE_URL", "PAGINATION", "RATE_LIMITS", "SUPPORTED_FILE_TYPES"],
    raw_content: `export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 60,
  SEARCH_REQUESTS_PER_MINUTE: 20,
  FILE_UPLOAD_MAX_SIZE_MB: 10,
} as const;

export const SUPPORTED_FILE_TYPES = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'] as const;`,
  },
  {
    file_path: "src/middleware.ts",
    module_name: "middleware",
    module_type: "utility",
    language: "TypeScript",
    summary:
      "Next.js middleware for authentication and route protection. Validates Supabase session on every request, redirects unauthenticated users, and refreshes auth cookies. Defines public vs protected route patterns.",
    dependencies: ["next/server", "@supabase/ssr"],
    exports: ["middleware", "config"],
    raw_content: `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/api/auth'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = PUBLIC_ROUTES.some(r => request.nextUrl.pathname.startsWith(r));

  if (!user && !isPublic) return NextResponse.redirect(new URL('/login', request.url));
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) return NextResponse.redirect(new URL('/home', request.url));

  return response;
}`,
  },
];
