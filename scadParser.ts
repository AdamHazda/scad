/**
 * OpenSCAD AST and Parser
 */

export type ASTNode =
  | VariableDeclNode
  | ModuleDeclNode
  | CallNode
  | ForNode
  | IfNode
  | BlockNode
  | PrimitiveNode;

export interface VariableDeclNode {
  type: 'VariableDecl';
  name: string;
  expression: any;
  line: number;
}

export interface ModuleDeclNode {
  type: 'ModuleDecl';
  name: string;
  parameters: { name: string; defaultValue?: any }[];
  body: ASTNode;
  line: number;
}

export interface CallNode {
  type: 'Call';
  name: string;
  args: Record<string, any>;
  positionalArgs: any[];
  children: ASTNode[];
  modifier?: string; // *, !, #, %
  line: number;
}

export interface ForNode {
  type: 'For';
  variable: string;
  range: { start: any; step?: any; end: any } | any[];
  children: ASTNode[];
  line: number;
}

export interface IfNode {
  type: 'If';
  condition: any;
  consequent: ASTNode[];
  alternate?: ASTNode[];
  line: number;
}

export interface BlockNode {
  type: 'Block';
  children: ASTNode[];
  line: number;
}

export interface PrimitiveNode {
  type: 'Primitive';
  kind: 'cube' | 'cylinder' | 'sphere' | 'polyhedron' | 'square' | 'circle' | 'polygon';
  args: Record<string, any>;
  positionalArgs: any[];
  line: number;
}

// Token types for lexer
type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'PUNCTUATION'
  | 'OPERATOR'
  | 'SPECIAL_VAR'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export class ScadLexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      // Whitespace
      if (/\s/.test(ch)) {
        if (ch === '\n') {
          this.line++;
          this.col = 1;
        } else {
          this.col++;
        }
        this.pos++;
        continue;
      }

      // Single line comments
      if (ch === '/' && this.input[this.pos + 1] === '/') {
        this.pos += 2;
        this.col += 2;
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Multi line comments
      if (ch === '/' && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        this.col += 2;
        while (
          this.pos < this.input.length &&
          !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')
        ) {
          if (this.input[this.pos] === '\n') {
            this.line++;
            this.col = 1;
          } else {
            this.col++;
          }
          this.pos++;
        }
        if (this.pos < this.input.length) {
          this.pos += 2;
          this.col += 2;
        }
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const startLine = this.line;
        const startCol = this.col;
        let str = '';
        this.pos++;
        this.col++;
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
          if (this.input[this.pos] === '\\') {
            this.pos++;
            this.col++;
            str += this.input[this.pos] || '';
          } else {
            str += this.input[this.pos];
          }
          this.pos++;
          this.col++;
        }
        this.pos++; // skip closing quote
        this.col++;
        tokens.push({
          type: 'STRING',
          value: str,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
        const startLine = this.line;
        const startCol = this.col;
        let numStr = '';
        while (
          this.pos < this.input.length &&
          /[0-9.eE+-]/.test(this.input[this.pos])
        ) {
          // ensure valid number character
          if (
            (this.input[this.pos] === '+' || this.input[this.pos] === '-') &&
            !/[eE]/.test(numStr[numStr.length - 1] || '')
          ) {
            break;
          }
          numStr += this.input[this.pos];
          this.pos++;
          this.col++;
        }
        tokens.push({
          type: 'NUMBER',
          value: numStr,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Special variables starting with $ (e.g. $fn, $fa, $fs, $t)
      if (ch === '$') {
        const startLine = this.line;
        const startCol = this.col;
        let id = '$';
        this.pos++;
        this.col++;
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          id += this.input[this.pos];
          this.pos++;
          this.col++;
        }
        tokens.push({
          type: 'SPECIAL_VAR',
          value: id,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Identifiers & Keywords
      if (/[a-zA-Z_]/.test(ch)) {
        const startLine = this.line;
        const startCol = this.col;
        let id = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          id += this.input[this.pos];
          this.pos++;
          this.col++;
        }
        const keywords = ['module', 'function', 'for', 'if', 'else', 'let', 'each', 'true', 'false', 'undef'];
        tokens.push({
          type: keywords.includes(id) ? 'KEYWORD' : 'IDENTIFIER',
          value: id,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Multi-char operators: ==, !=, <=, >=, &&, ||
      const twoChar = this.input.slice(this.pos, this.pos + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
        tokens.push({
          type: 'OPERATOR',
          value: twoChar,
          line: this.line,
          col: this.col,
        });
        this.pos += 2;
        this.col += 2;
        continue;
      }

      // Punctuation and single-char operators
      if ('{}()[],;:?:=+-*/%<>!*#%'.includes(ch)) {
        tokens.push({
          type: 'PUNCTUATION',
          value: ch,
          line: this.line,
          col: this.col,
        });
        this.pos++;
        this.col++;
        continue;
      }

      // Unrecognized character
      this.pos++;
      this.col++;
    }

    tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      col: this.col,
    });
    return tokens;
  }
}

/**
 * OpenSCAD Expression Evaluator for math & parameters
 */
export class ExpressionEvaluator {
  static evalExpr(tokens: Token[], env: Record<string, any>): any {
    if (tokens.length === 0) return undefined;
    const str = tokens.map((t) => t.value).join(' ');
    return ExpressionEvaluator.evalString(str, env);
  }

  static evalString(exprStr: string, env: Record<string, any>): any {
    const trimmed = exprStr.trim();
    if (!trimmed) return undefined;

    // Vector / array [a, b, c]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      // Check if it is a range [start:end] or [start:step:end]
      const rangeParts = ExpressionEvaluator.splitTopLevel(inner, ':');
      if (rangeParts.length === 2) {
        const start = Number(ExpressionEvaluator.evalString(rangeParts[0], env));
        const end = Number(ExpressionEvaluator.evalString(rangeParts[1], env));
        const step = start <= end ? 1 : -1;
        const res: number[] = [];
        for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
          res.push(i);
        }
        return res;
      } else if (rangeParts.length === 3) {
        const start = Number(ExpressionEvaluator.evalString(rangeParts[0], env));
        const step = Number(ExpressionEvaluator.evalString(rangeParts[1], env));
        const end = Number(ExpressionEvaluator.evalString(rangeParts[2], env));
        const res: number[] = [];
        if (step !== 0) {
          for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
            res.push(i);
          }
        }
        return res;
      }

      // Normal array
      const items = ExpressionEvaluator.splitTopLevel(inner, ',');
      return items.map((item) => ExpressionEvaluator.evalString(item, env));
    }

    // Direct literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'undef') return undefined;
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    if (!isNaN(Number(trimmed))) {
      return Number(trimmed);
    }

    // Direct variable lookup
    if (trimmed in env) {
      return env[trimmed];
    }

    // Safe mathematical expression evaluation
    try {
      // Build safe scope
      const scope: Record<string, any> = {
        PI: Math.PI,
        sin: (d: number) => Math.sin((d * Math.PI) / 180),
        cos: (d: number) => Math.cos((d * Math.PI) / 180),
        tan: (d: number) => Math.tan((d * Math.PI) / 180),
        asin: (v: number) => (Math.asin(v) * 180) / Math.PI,
        acos: (v: number) => (Math.acos(v) * 180) / Math.PI,
        atan: (v: number) => (Math.atan(v) * 180) / Math.PI,
        atan2: (y: number, x: number) => (Math.atan2(y, x) * 180) / Math.PI,
        sqrt: Math.sqrt,
        pow: Math.pow,
        abs: Math.abs,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round,
        min: Math.min,
        max: Math.max,
        ln: Math.log,
        log: (v: number) => Math.log10(v),
        exp: Math.exp,
        ...env,
      };

      // Sanitize expression: replace identifiers with scope lookup
      const keys = Object.keys(scope);
      const func = new Function(...keys, `"use strict"; return (${trimmed});`);
      return func(...keys.map((k) => scope[k]));
    } catch {
      // Fallback: return as string or 0
      return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
    }
  }

  static splitTopLevel(str: string, delimiter: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inString) {
        current += ch;
        if (ch === stringChar && str[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        current += ch;
      } else if (ch === '(') {
        depthParen++;
        current += ch;
      } else if (ch === ')') {
        depthParen--;
        current += ch;
      } else if (ch === '[') {
        depthBracket++;
        current += ch;
      } else if (ch === ']') {
        depthBracket--;
        current += ch;
      } else if (ch === '{') {
        depthBrace++;
        current += ch;
      } else if (ch === '}') {
        depthBrace--;
        current += ch;
      } else if (
        ch === delimiter &&
        depthParen === 0 &&
        depthBracket === 0 &&
        depthBrace === 0
      ) {
        parts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      parts.push(current.trim());
    }
    return parts;
  }
}

/**
 * OpenSCAD Recursive Descent Parser
 */
export class ScadParser {
  private tokens: Token[];
  private current = 0;
  public errors: { line: number; message: string }[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode[] {
    const statements: ASTNode[] = [];
    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        if (stmt) statements.push(stmt);
      } catch (err: any) {
        this.errors.push({
          line: this.peek().line,
          message: err.message || 'Syntax error',
        });
        this.synchronize();
      }
    }
    return statements;
  }

  private parseStatement(): ASTNode | null {
    // Check modifiers: * (disable), ! (show only), # (highlight), % (transparent)
    let modifier: string | undefined;
    if (['*', '!', '#', '%'].includes(this.peek().value)) {
      modifier = this.advance().value;
    }

    const token = this.peek();

    // Module declaration: module name(...) { ... }
    if (token.type === 'KEYWORD' && token.value === 'module') {
      return this.parseModuleDecl();
    }

    // For loop: for (i = [...]) { ... }
    if (token.type === 'KEYWORD' && token.value === 'for') {
      return this.parseForLoop();
    }

    // If statement: if (...) { ... } else { ... }
    if (token.type === 'KEYWORD' && token.value === 'if') {
      return this.parseIfStatement();
    }

    // Variable assignment: var = expr;
    if (
      (token.type === 'IDENTIFIER' || token.type === 'SPECIAL_VAR') &&
      this.checkNext('=')
    ) {
      return this.parseVariableDecl();
    }

    // Block: { stmt; stmt; }
    if (token.type === 'PUNCTUATION' && token.value === '{') {
      return this.parseBlock();
    }

    // Builtin primitives or function/module calls
    if (token.type === 'IDENTIFIER' || token.type === 'SPECIAL_VAR') {
      return this.parseCallOrPrimitive(modifier);
    }

    // Skip stray semicolons
    if (token.value === ';') {
      this.advance();
      return null;
    }

    this.advance();
    return null;
  }

  private parseModuleDecl(): ModuleDeclNode {
    const startLine = this.advance().line; // skip 'module'
    const nameToken = this.consume('IDENTIFIER', 'Očekáván název modulu');
    this.consumePunc('(', "Očekávána '(' po názvu modulu");

    const params: { name: string; defaultValue?: any }[] = [];
    if (!this.checkPunc(')')) {
      do {
        const paramName = this.advance().value;
        let defaultValue: any;
        if (this.matchPunc('=')) {
          const valTokens = this.collectUntil([',', ')']);
          defaultValue = valTokens.map((t) => t.value).join(' ');
        }
        params.push({ name: paramName, defaultValue });
      } while (this.matchPunc(','));
    }
    this.consumePunc(')', "Očekávána ')' za parametry modulu");

    const body = this.parseChildOrBlock();
    return {
      type: 'ModuleDecl',
      name: nameToken.value,
      parameters: params,
      body,
      line: startLine,
    };
  }

  private parseVariableDecl(): VariableDeclNode {
    const nameToken = this.advance();
    this.consumePunc('=', "Očekáváno '=' v přiřazení proměnné");
    const exprTokens = this.collectUntil([';']);
    this.matchPunc(';');
    const exprStr = exprTokens.map((t) => t.value).join(' ');

    return {
      type: 'VariableDecl',
      name: nameToken.value,
      expression: exprStr,
      line: nameToken.line,
    };
  }

  private parseForLoop(): ForNode {
    const startLine = this.advance().line; // skip 'for'
    this.consumePunc('(', "Očekávána '(' za 'for'");
    const varToken = this.advance();
    this.consumePunc('=', "Očekáváno '=' ve for smyčce");

    const rangeTokens = this.collectUntil([')']);
    this.consumePunc(')', "Očekávána ')' po definici for smyčky");

    const childrenNode = this.parseChildOrBlock();
    const children = childrenNode.type === 'Block' ? childrenNode.children : [childrenNode];

    return {
      type: 'For',
      variable: varToken.value,
      range: rangeTokens.map((t) => t.value).join(' ') as any,
      children,
      line: startLine,
    };
  }

  private parseIfStatement(): IfNode {
    const startLine = this.advance().line; // skip 'if'
    this.consumePunc('(', "Očekávána '(' po 'if'");
    const condTokens = this.collectUntil([')']);
    this.consumePunc(')', "Očekávána ')' za podmínkou");

    const consequentNode = this.parseChildOrBlock();
    const consequent =
      consequentNode.type === 'Block' ? consequentNode.children : [consequentNode];

    let alternate: ASTNode[] | undefined;
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'else') {
      this.advance(); // skip 'else'
      const altNode = this.parseChildOrBlock();
      alternate = altNode.type === 'Block' ? altNode.children : [altNode];
    }

    return {
      type: 'If',
      condition: condTokens.map((t) => t.value).join(' '),
      consequent,
      alternate,
      line: startLine,
    };
  }

  private parseBlock(): BlockNode {
    const startLine = this.consumePunc('{', "Očekávána '{'").line;
    const children: ASTNode[] = [];
    while (!this.checkPunc('}') && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) children.push(stmt);
    }
    this.consumePunc('}', "Očekávána '}' na konci bloku");
    return {
      type: 'Block',
      children,
      line: startLine,
    };
  }

  private parseCallOrPrimitive(modifier?: string): ASTNode {
    const nameToken = this.advance();
    const name = nameToken.value;
    const line = nameToken.line;

    // Arguments in parentheses: (arg1, arg2=val, ...)
    const args: Record<string, any> = {};
    const positionalArgs: any[] = [];

    if (this.matchPunc('(')) {
      if (!this.checkPunc(')')) {
        do {
          const argTokens = this.collectUntilTopLevel([',', ')']);
          const argStr = argTokens.map((t) => t.value).join(' ');

          const equalIdx = argTokens.findIndex((t) => t.value === '=');
          if (equalIdx > 0 && argTokens[equalIdx - 1].type === 'IDENTIFIER') {
            const argName = argTokens[equalIdx - 1].value;
            const argValStr = argTokens
              .slice(equalIdx + 1)
              .map((t) => t.value)
              .join(' ');
            args[argName] = argValStr;
          } else {
            positionalArgs.push(argStr);
          }
        } while (this.matchPunc(','));
      }
      this.consumePunc(')', "Očekávána ')' za argumenty");
    }

    // Does this statement have children or end with a semicolon?
    let children: ASTNode[] = [];
    if (this.matchPunc(';')) {
      // Leaf node (e.g. cube(...); sphere(...); or empty call)
    } else {
      // Has child or block
      const childNode = this.parseChildOrBlock();
      children = childNode.type === 'Block' ? childNode.children : [childNode];
    }

    return {
      type: 'Call',
      name,
      args,
      positionalArgs,
      children,
      modifier,
      line,
    };
  }

  private parseChildOrBlock(): ASTNode {
    if (this.checkPunc('{')) {
      return this.parseBlock();
    }
    const stmt = this.parseStatement();
    return stmt || { type: 'Block', children: [], line: this.peek().line };
  }

  private collectUntil(delimiters: string[]): Token[] {
    const result: Token[] = [];
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    while (!this.isAtEnd()) {
      const tok = this.peek();
      if (
        parenDepth === 0 &&
        bracketDepth === 0 &&
        braceDepth === 0 &&
        delimiters.includes(tok.value)
      ) {
        break;
      }

      if (tok.value === '(') parenDepth++;
      else if (tok.value === ')') parenDepth--;
      else if (tok.value === '[') bracketDepth++;
      else if (tok.value === ']') bracketDepth--;
      else if (tok.value === '{') braceDepth++;
      else if (tok.value === '}') braceDepth--;

      result.push(this.advance());
    }
    return result;
  }

  private collectUntilTopLevel(delimiters: string[]): Token[] {
    return this.collectUntil(delimiters);
  }

  private checkNext(val: string): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    return this.tokens[this.current + 1].value === val;
  }

  private checkPunc(val: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().value === val;
  }

  private matchPunc(val: string): boolean {
    if (this.checkPunc(val)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consumePunc(val: string, errMsg: string): Token {
    if (this.checkPunc(val)) return this.advance();
    throw new Error(`${errMsg} na řádku ${this.peek().line}`);
  }

  private consume(type: TokenType, errMsg: string): Token {
    if (this.peek().type === type) return this.advance();
    throw new Error(`${errMsg} na řádku ${this.peek().line}`);
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.tokens[this.current].type === 'EOF';
  }

  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.tokens[this.current - 1].value === ';') return;
      if (['module', 'for', 'if'].includes(this.peek().value)) return;
      this.advance();
    }
  }
}
