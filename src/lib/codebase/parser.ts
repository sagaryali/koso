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

export function parseRuby(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const requireMatch = trimmed.match(/^require(?:_relative)?\s+["']([^"']+)["']/);
    if (requireMatch) {
      imports.push(requireMatch[1]);
      continue;
    }

    if (line.match(/^class\s+(\w+)/)) {
      const name = line.match(/^class\s+(\w+)/)![1];
      classes.push(name);
      exports.push(name);
      continue;
    }

    if (line.match(/^module\s+(\w+)/)) {
      const name = line.match(/^module\s+(\w+)/)![1];
      classes.push(name);
      exports.push(name);
      continue;
    }

    if (line.match(/^\s{0,2}def\s+(\w+)/)) {
      const name = line.match(/def\s+(\w+)/)![1];
      functions.push(name);
      if (!line.startsWith("  ") && !line.startsWith("\t")) {
        exports.push(name);
      }
      continue;
    }
  }

  return { exports, imports, functions, classes, types: [] };
}

export function parseJava(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const importMatch = trimmed.match(/^import\s+([\w.]+);/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      if (trimmed.includes("public")) exports.push(classMatch[1]);
      continue;
    }

    const interfaceMatch = trimmed.match(/^(?:public\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      types.push(interfaceMatch[1]);
      if (trimmed.includes("public")) exports.push(interfaceMatch[1]);
      continue;
    }

    const enumMatch = trimmed.match(/^(?:public\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      types.push(enumMatch[1]);
      if (trimmed.includes("public")) exports.push(enumMatch[1]);
      continue;
    }

    const methodMatch = trimmed.match(/^(?:public|protected|private)?\s*(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/);
    if (methodMatch && !["if", "for", "while", "switch", "catch", "class", "new", "return"].includes(methodMatch[1])) {
      functions.push(methodMatch[1]);
      if (trimmed.startsWith("public")) exports.push(methodMatch[1]);
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parseKotlin(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const importMatch = trimmed.match(/^import\s+([\w.]+)/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^(?:data\s+)?(?:open\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      if (!trimmed.startsWith("private") && !trimmed.startsWith("internal")) {
        exports.push(classMatch[1]);
      }
      continue;
    }

    const interfaceMatch = trimmed.match(/^interface\s+(\w+)/);
    if (interfaceMatch) {
      types.push(interfaceMatch[1]);
      exports.push(interfaceMatch[1]);
      continue;
    }

    const funMatch = trimmed.match(/^(?:suspend\s+)?fun\s+(\w+)/);
    if (funMatch) {
      functions.push(funMatch[1]);
      if (!trimmed.startsWith("private") && !trimmed.startsWith("internal")) {
        exports.push(funMatch[1]);
      }
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parseSwift(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const importMatch = trimmed.match(/^import\s+(\w+)/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^(?:public\s+)?(?:final\s+)?class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      if (!trimmed.startsWith("private") && !trimmed.startsWith("fileprivate")) {
        exports.push(classMatch[1]);
      }
      continue;
    }

    const structMatch = trimmed.match(/^(?:public\s+)?struct\s+(\w+)/);
    if (structMatch) {
      classes.push(structMatch[1]);
      if (!trimmed.startsWith("private") && !trimmed.startsWith("fileprivate")) {
        exports.push(structMatch[1]);
      }
      continue;
    }

    const protocolMatch = trimmed.match(/^(?:public\s+)?protocol\s+(\w+)/);
    if (protocolMatch) {
      types.push(protocolMatch[1]);
      exports.push(protocolMatch[1]);
      continue;
    }

    const enumMatch = trimmed.match(/^(?:public\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      types.push(enumMatch[1]);
      if (!trimmed.startsWith("private")) exports.push(enumMatch[1]);
      continue;
    }

    const funcMatch = trimmed.match(/^(?:public\s+)?(?:static\s+)?func\s+(\w+)/);
    if (funcMatch) {
      functions.push(funcMatch[1]);
      if (!trimmed.startsWith("private") && !trimmed.startsWith("fileprivate")) {
        exports.push(funcMatch[1]);
      }
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parseRust(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = []; // structs
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const useMatch = trimmed.match(/^use\s+([\w:]+)/);
    if (useMatch) {
      imports.push(useMatch[1]);
      continue;
    }

    const structMatch = trimmed.match(/^pub\s+struct\s+(\w+)/);
    if (structMatch) {
      classes.push(structMatch[1]);
      exports.push(structMatch[1]);
      continue;
    }
    const privStructMatch = trimmed.match(/^struct\s+(\w+)/);
    if (privStructMatch) {
      classes.push(privStructMatch[1]);
      continue;
    }

    const traitMatch = trimmed.match(/^pub\s+trait\s+(\w+)/);
    if (traitMatch) {
      types.push(traitMatch[1]);
      exports.push(traitMatch[1]);
      continue;
    }
    const privTraitMatch = trimmed.match(/^trait\s+(\w+)/);
    if (privTraitMatch) {
      types.push(privTraitMatch[1]);
      continue;
    }

    const enumMatch = trimmed.match(/^pub\s+enum\s+(\w+)/);
    if (enumMatch) {
      types.push(enumMatch[1]);
      exports.push(enumMatch[1]);
      continue;
    }

    const fnMatch = trimmed.match(/^pub(?:\(crate\))?\s+(?:async\s+)?fn\s+(\w+)/);
    if (fnMatch) {
      functions.push(fnMatch[1]);
      exports.push(fnMatch[1]);
      continue;
    }
    const privFnMatch = trimmed.match(/^(?:async\s+)?fn\s+(\w+)/);
    if (privFnMatch) {
      functions.push(privFnMatch[1]);
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parseCSharp(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const usingMatch = trimmed.match(/^using\s+([\w.]+);/);
    if (usingMatch) {
      imports.push(usingMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^(?:public|internal)?\s*(?:static\s+)?(?:abstract\s+)?(?:partial\s+)?class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      if (trimmed.includes("public")) exports.push(classMatch[1]);
      continue;
    }

    const interfaceMatch = trimmed.match(/^(?:public|internal)?\s*interface\s+(\w+)/);
    if (interfaceMatch) {
      types.push(interfaceMatch[1]);
      if (trimmed.includes("public")) exports.push(interfaceMatch[1]);
      continue;
    }

    const enumMatch = trimmed.match(/^(?:public|internal)?\s*enum\s+(\w+)/);
    if (enumMatch) {
      types.push(enumMatch[1]);
      if (trimmed.includes("public")) exports.push(enumMatch[1]);
      continue;
    }

    const methodMatch = trimmed.match(/^(?:public|protected|private|internal)?\s*(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/);
    if (methodMatch && !["if", "for", "while", "switch", "catch", "class", "new", "return"].includes(methodMatch[1])) {
      functions.push(methodMatch[1]);
      if (trimmed.startsWith("public")) exports.push(methodMatch[1]);
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parseCpp(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const includeMatch = trimmed.match(/^#include\s+[<"]([^>"]+)[>"]/);
    if (includeMatch) {
      imports.push(includeMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      exports.push(classMatch[1]);
      continue;
    }

    const structMatch = trimmed.match(/^(?:typedef\s+)?struct\s+(\w+)/);
    if (structMatch) {
      classes.push(structMatch[1]);
      exports.push(structMatch[1]);
      continue;
    }

    const namespaceMatch = trimmed.match(/^namespace\s+(\w+)/);
    if (namespaceMatch) {
      types.push(namespaceMatch[1]);
      continue;
    }

    // Top-level function declarations
    const funcMatch = line.match(/^(?:[\w:*&<>]+\s+)+(\w+)\s*\([^)]*\)\s*\{?\s*$/);
    if (funcMatch && !line.startsWith(" ") && !line.startsWith("\t") &&
        !["if", "for", "while", "switch", "catch", "return"].includes(funcMatch[1])) {
      functions.push(funcMatch[1]);
      exports.push(funcMatch[1]);
      continue;
    }
  }

  return { exports, imports, functions, classes, types };
}

export function parsePHP(content: string): ParsedModule {
  const exports: string[] = [];
  const imports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    const useMatch = trimmed.match(/^use\s+([\w\\]+)/);
    if (useMatch) {
      imports.push(useMatch[1]);
      continue;
    }

    const requireMatch = trimmed.match(/^(?:require|include)(?:_once)?\s+["']([^"']+)["']/);
    if (requireMatch) {
      imports.push(requireMatch[1]);
      continue;
    }

    const classMatch = trimmed.match(/^(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
      exports.push(classMatch[1]);
      continue;
    }

    const interfaceMatch = trimmed.match(/^interface\s+(\w+)/);
    if (interfaceMatch) {
      types.push(interfaceMatch[1]);
      exports.push(interfaceMatch[1]);
      continue;
    }

    const traitMatch = trimmed.match(/^trait\s+(\w+)/);
    if (traitMatch) {
      types.push(traitMatch[1]);
      exports.push(traitMatch[1]);
      continue;
    }

    const funcMatch = trimmed.match(/^(?:public\s+)?(?:static\s+)?function\s+(\w+)/);
    if (funcMatch) {
      functions.push(funcMatch[1]);
      exports.push(funcMatch[1]);
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
    case "ruby":
      return parseRuby(content);
    case "java":
      return parseJava(content);
    case "kotlin":
      return parseKotlin(content);
    case "swift":
      return parseSwift(content);
    case "rust":
      return parseRust(content);
    case "csharp":
      return parseCSharp(content);
    case "c":
    case "cpp":
      return parseCpp(content);
    case "php":
      return parsePHP(content);
    default:
      return { exports: [], imports: [], functions: [], classes: [], types: [] };
  }
}
