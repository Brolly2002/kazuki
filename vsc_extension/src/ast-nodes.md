
# TypeScript AST - Import-Related Nodes

This document describes the Abstract Syntax Tree (AST) node types related to `import` statements in TypeScript using the TypeScript Compiler API.

---

## 🔹 1. `ImportDeclaration`

Represents the entire `import` statement.

- Example: `import { readFile } from "fs";`
- This is the top-level wrapper node for any import.
- It includes the `moduleSpecifier` (e.g., `"fs"`) and an optional `importClause`.

---

## 🔹 2. `ImportClause`

Describes what is being imported — can include default import, named imports, or namespace imports.

- Examples:
  - `import React from "react"` (default)
  - `import { useState } from "react"` (named)
  - `import * as fs from "fs"` (namespace)
  - `import React, { useState } from "react"` (default + named)

- It may contain:
  - `name`: Identifier for the default import (e.g., `React`)
  - `namedBindings`: `NamedImports` or `NamespaceImport`

---

## 🔹 3. `NamedImports`

Used for importing specific named bindings from a module.

- Example: `import { useState, useEffect } from "react"`
- It wraps a list of `ImportSpecifier` nodes inside the `{}`.
- Each item inside the braces is handled by its own `ImportSpecifier`.

---

## 🔹 4. `ImportSpecifier`

Represents a single binding inside `NamedImports`.

- Examples:
  - `import { useState } from "react"` (direct)
  - `import { useState as useSt } from "react"` (aliased)

- It may include:
  - `propertyName`: The original name from the module (e.g., `useState`)
  - `name`: The local alias used in your code (e.g., `useSt`)

---

## 🔹 5. `NamespaceImport`

Handles the `* as` style import where everything is grouped under a single name.

- Example: `import * as fs from "fs"`
- The name (e.g., `fs`) is an alias for the entire module.
- Used when you need to access all exports under a single object.

---

## 🔹 6. `StringLiteral` (as `moduleSpecifier`)

Represents the module source path in the import.

- Example: `"react"` or `"fs"`
- This is part of the `ImportDeclaration` and holds the value of the module you are importing from.

---

## 🧪 Full Example AST Shape (High-Level)

For the line: `import React, { useState as us } from "react"`

The AST would look like:



---

## 📌 Summary Table

| Code Example                             | Node Breakdown                                                 |
|------------------------------------------|----------------------------------------------------------------|
| `import React from "react"`              | ImportDeclaration → ImportClause → name                        |
| `import { useState } from "react"`       | ImportDeclaration → ImportClause → NamedImports → ImportSpecifier |
| `import * as fs from "fs"`               | ImportDeclaration → ImportClause → NamespaceImport             |
| `import React, { useState } from "react"`| ImportDeclaration → ImportClause → name + NamedImports         |
| `import { x as y } from "lib"`           | ImportSpecifier with alias                                     |

---
