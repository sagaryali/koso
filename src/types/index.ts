export type ArtifactType =
  | "prd"
  | "user_story"
  | "principle"
  | "decision_log"
  | "roadmap_item"
  | "architecture_summary";

export type ArtifactStatus = "draft" | "active" | "archived";

export type EvidenceType = "feedback" | "metric" | "research" | "meeting_note";

export type CodebaseConnectionStatus =
  | "pending"
  | "syncing"
  | "ready"
  | "error";

export type CodebaseModuleType =
  | "component"
  | "service"
  | "model"
  | "route"
  | "utility"
  | "config"
  | "test";

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  product_description: string | null;
  principles: string[];
  github_token: string | null;
  github_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  workspace_id: string;
  type: ArtifactType;
  title: string;
  content: Record<string, unknown>;
  status: ArtifactStatus;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  workspace_id: string;
  type: EvidenceType;
  title: string;
  content: string;
  source: string | null;
  tags: string[];
  created_at: string;
}

export interface Link {
  id: string;
  workspace_id: string;
  source_id: string;
  source_type: string;
  target_id: string;
  target_type: string;
  relationship: string;
  created_at: string;
}

export interface Embedding {
  id: string;
  workspace_id: string;
  source_id: string;
  source_type: string;
  chunk_text: string;
  chunk_index: number;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CodebaseConnection {
  id: string;
  workspace_id: string;
  repo_url: string;
  repo_name: string;
  default_branch: string;
  last_synced_at: string | null;
  status: CodebaseConnectionStatus;
  error_message: string | null;
  file_count: number;
  module_count: number;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  html_url: string;
  updated_at: string;
  private: boolean;
}

export interface CodebaseModule {
  id: string;
  connection_id: string;
  workspace_id: string;
  file_path: string;
  module_name: string | null;
  module_type: CodebaseModuleType | null;
  language: string | null;
  summary: string | null;
  dependencies: string[];
  exports: string[];
  embedding: number[] | null;
  raw_content: string | null;
  parsed_ast: Record<string, unknown> | null;
  updated_at: string;
}

// Context panel types

export interface ContextSearchResult {
  id: string;
  sourceId: string;
  sourceType: string;
  chunkText: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  similarity: number;
}

// Market research types

export interface MarketSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string; // domain extracted from URL
}

export interface MarketResearchResponse {
  competitors: MarketSearchResult[];
  trends: MarketSearchResult[];
  bestPractices: MarketSearchResult[];
}

// Evidence cluster types

export interface EvidenceCluster {
  id: string;
  workspace_id: string;
  label: string;
  summary: string;
  evidence_ids: string[];
  evidence_count: number;
  section_relevance: Record<string, number>;
  computed_at: string;
}

// Feasibility assessment types

export interface FeasibilityAssessment {
  affectedModules: string[];
  complexity: {
    level: "Low" | "Medium" | "High";
    reason: string;
  };
  buildingBlocks: string[];
  risks: string[];
}
