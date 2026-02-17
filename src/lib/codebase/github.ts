import type { GitHubRepo } from "@/types";

const GITHUB_API = "https://api.github.com";

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubFileContent {
  content: string;
  encoding: string;
  size: number;
}

interface GitHubUser {
  login: string;
  id: number;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=all`,
      { headers: headers(token) }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data: GitHubRepo[] = await res.json();
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

export async function fetchRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTreeItem[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data: GitHubTree = await res.json();
  return data.tree.filter((item) => item.type === "blob");
}

export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitHub API error fetching ${path}: ${res.status}`);
  const data: GitHubFileContent = await res.json();

  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return data.content;
}

// --- File filtering ---

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".next", ".vercel", "coverage", ".cache", "vendor",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "bun.lockb", ".env", ".env.local", ".env.production",
  ".DS_Store", "Thumbs.db",
]);

export function shouldIncludeFile(path: string): boolean {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];

  // Skip directories
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return false;
  }

  // Skip specific files
  if (SKIP_FILES.has(fileName)) return false;

  // Skip dotfiles
  if (fileName.startsWith(".")) return false;

  // Check extension
  const ext = "." + fileName.split(".").slice(1).join(".");
  const lastExt = "." + fileName.split(".").pop();

  return SUPPORTED_EXTENSIONS.has(lastExt) || SUPPORTED_EXTENSIONS.has(ext);
}

export function detectLanguage(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    default:
      return null;
  }
}

export function detectModuleType(
  path: string
): "component" | "service" | "model" | "route" | "utility" | "config" | "test" | null {
  const lower = path.toLowerCase();

  if (/\.(test|spec)\.(ts|tsx|js|jsx|py|go)$/.test(lower)) return "test";
  if (lower.includes("/components/") || lower.includes("/component/")) return "component";
  if (lower.includes("/services/") || lower.includes("/service/") || lower.includes("/lib/")) return "service";
  if (lower.includes("/models/") || lower.includes("/types/") || lower.includes("/schemas/") || lower.includes("/schema/")) return "model";
  if (lower.includes("/routes/") || lower.includes("/api/") || lower.includes("/pages/") || lower.includes("/app/")) return "route";
  if (lower.includes("/utils/") || lower.includes("/helpers/") || lower.includes("/util/")) return "utility";
  if (lower.includes("/config/") || lower.includes("/configuration/")) return "config";

  return null;
}
