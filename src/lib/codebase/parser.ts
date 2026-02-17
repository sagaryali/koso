interface ParsedModule {
  exports: string[];
  imports: string[];
  functions: string[];
  classes: string[];
  types: string[];
}

export function parseTypeScript(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Imports: import { X } from "y" or import X from "y"
    const importMatch = trimmed.match(
      /^import\s+(?:(?:\{([^}]+)\})|(?:(\w+))).*from\s+["']([^"']+)["']/
    );
    if (importMatch) {
      const source = importMatch[3];
      if (importMatch[1]) {
        const names = importMatch[1].split(",").map((s) => s.trim().split(" as ")[0].trim());
        imports.push(...names.map((n) => `${n} from ${source}`));
      } else if (importMatch[2]) {
        imports.push(`${importMatch[2]} from ${source}`);
      }
      continue;
    }

    // Named exports: export function, export class, export const, export type, export interface
    const exportFuncMatch = trimmed.match(
      /^export\s+(?:async\s+)?function\s+(\w+)/
    );
    if (exportFuncMatch) {
      exports.push(exportFuncMatch[1]);
      functions.push(exportFuncMatch[1]);
      continue;
    }

    const exportClassMatch = trimmed.match(/^export\s+class\s+(\w+)/);
    if (exportClassMatch) {
      exports.push(exportClassMatch[1]);
      classes.push(exportClassMatch[1]);
      continue;
    }

    const exportConstMatch = trimmed.match(
      /^export\s+(?:const|let|var)\s+(\w+)/
    );
    if (exportConstMatch) {
      exports.push(exportConstMatch[1]);
      continue;
    }

    const exportTypeMatch = trimmed.match(
      /^export\s+(?:type|interface)\s+(\w+)/
    );
    if (exportTypeMatch) {
      exports.push(exportTypeMatch[1]);
      types.push(exportTypeMatch[1]);
      continue;
    }

    // Default export
    if (trimmed.match(/^export\s+default\s+(?:function|class)\s+(\w+)/)) {
      const name = trimmed.match(
        /^export\s+default\s+(?:function|class)\s+(\w+)/
      )![1];
      exports.push(`default(${name})`);
      continue;
    }
    if (trimmed.startsWith("export default")) {
      exports.push("default");
      continue;
    }

    // Non-exported declarations
    const funcMatch = trimmed.match(/^(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      functions.push(funcMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      continue;
    }

    const typeMatch = trimmed.match(/^(?:type|interface)\s+(\w+)/);
    if (typeMatch) {
      types.push(typeMatch[1]);
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parsePython(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Imports
    const importFromMatch = trimmed.match(/^from\s+(\S+)\s+import\s+(.+)/);
    if (importFromMatch) {
      const names = importFromMatch[2].split(",").map((s) => s.trim());
      imports.push(...names.map((n) => `${n} from ${importFromMatch[1]}`));
      continue;
    }

    const importMatch = trimmed.match(/^import\s+(\S+)/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    // Top-level functions (no indentation)
    if (line.match(/^def\s+(\w+)/)) {
      const name = line.match(/^def\s+(\w+)/)![1];
      functions.push(name);
      if (!name.startsWith("_")) exports.push(name);
      continue;
    }

    // Top-level classes
    if (line.match(/^class\s+(\w+)/)) {
      const name = line.match(/^class\s+(\w+)/)![1];
      classes.push(name);
      if (!name.startsWith("_")) exports.push(name);
      continue;
    }
  }

  return { exports, imports, functions, classes, types: [] };
}

export function parseGo(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = []; // structs
  const types: string[] = [];

  const lines = content.split("\n");
  let inImportBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Import blocks
    if (trimmed === "import (") {
      inImportBlock = true;
      continue;
    }
    if (inImportBlock) {
      if (trimmed === ")") {
        inImportBlock = false;
        continue;
      }
      const pkg = trimmed.replace(/"/g, "").trim();
      if (pkg) imports.push(pkg);
      continue;
    }

    // Single import
    const singleImport = trimmed.match(/^import\s+"([^"]+)"/);
    if (singleImport) {
      imports.push(singleImport[1]);
      continue;
    }

    // Functions
    const funcMatch = trimmed.match(/^func\s+(\w+)/);
    if (funcMatch) {
      functions.push(funcMatch[1]);
      // Go exports start with uppercase
      if (funcMatch[1][0] === funcMatch[1][0].toUpperCase()) {
        exports.push(funcMatch[1]);
      }
      continue;
    }

    // Method (func (receiver) Name)
    const methodMatch = trimmed.match(/^func\s+\([^)]+\)\s+(\w+)/);
    if (methodMatch) {
      functions.push(methodMatch[1]);
      if (methodMatch[1][0] === methodMatch[1][0].toUpperCase()) {
        exports.push(methodMatch[1]);
      }
      continue;
    }

    // Type declarations
    const typeMatch = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
    if (typeMatch) {
      const kind = typeMatch[2] === "struct" ? classes : types;
      kind.push(typeMatch[1]);
      if (typeMatch[1][0] === typeMatch[1][0].toUpperCase()) {
        exports.push(typeMatch[1]);
      }
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parseFile(
  content: string,
  language: string | null
): ParsedModule {
  switch (language) {
    case "typescript":
    case "javascript":
      return parseTypeScript(content);
    case "python":
      return parsePython(content);
    case "go":
      return parseGo(content);
    default:
      return { exports: [], imports: [], functions: [], classes: [], types: [] };
  }
}
