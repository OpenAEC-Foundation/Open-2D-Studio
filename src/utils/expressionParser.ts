/**
 * Safe math expression evaluator using recursive descent parsing.
 * Supports: +, -, *, /, parentheses, decimal numbers, and negative numbers.
 * Does NOT use eval() for security.
 *
 * Examples:
 *   evaluateExpression("3*50")      -> 150
 *   evaluateExpression("1000+500")  -> 1500
 *   evaluateExpression("6000/4")    -> 1500
 *   evaluateExpression("100+50*2")  -> 200
 *   evaluateExpression("3000-500")  -> 2500
 *   evaluateExpression("(3+2)*10")  -> 50
 *   evaluateExpression("150")       -> 150
 *   evaluateExpression("abc")       -> null
 */

// Token types
type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

/**
 * Tokenize an input string into a list of tokens.
 * Returns null if the input contains invalid characters.
 */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const str = input.replace(/\s/g, ''); // strip whitespace

  if (str.length === 0) return null;

  while (i < str.length) {
    const ch = str[i];

    // Number (including decimals)
    if (ch >= '0' && ch <= '9' || ch === '.') {
      let numStr = '';
      let hasDot = false;
      while (i < str.length && ((str[i] >= '0' && str[i] <= '9') || str[i] === '.')) {
        if (str[i] === '.') {
          if (hasDot) return null; // double dot is invalid
          hasDot = true;
        }
        numStr += str[i];
        i++;
      }
      const value = parseFloat(numStr);
      if (isNaN(value)) return null;
      tokens.push({ type: 'number', value });
      continue;
    }

    // Operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      // Handle unary minus/plus: if '-' or '+' appears at the start, after '(', or after an operator,
      // treat it as part of the next number (unary).
      if ((ch === '-' || ch === '+') && (tokens.length === 0 || tokens[tokens.length - 1].type === 'op' || tokens[tokens.length - 1].type === 'lparen')) {
        // Unary: read the sign and the following number or parenthesized expression
        // For simplicity, if the next thing is a digit or dot, absorb into number token
        const sign = ch === '-' ? -1 : 1;
        i++;
        if (i < str.length && (str[i] >= '0' && str[i] <= '9' || str[i] === '.')) {
          let numStr = '';
          let hasDot = false;
          while (i < str.length && ((str[i] >= '0' && str[i] <= '9') || str[i] === '.')) {
            if (str[i] === '.') {
              if (hasDot) return null;
              hasDot = true;
            }
            numStr += str[i];
            i++;
          }
          const value = parseFloat(numStr) * sign;
          if (isNaN(value)) return null;
          tokens.push({ type: 'number', value });
        } else if (str[i] === '(') {
          // Unary minus/plus before parenthesis: insert 0 and the operator
          // e.g., -(expr) becomes (0 - expr)
          tokens.push({ type: 'number', value: 0 });
          tokens.push({ type: 'op', value: ch as '+' | '-' });
        } else {
          return null; // invalid: operator followed by nothing valid
        }
        continue;
      }
      tokens.push({ type: 'op', value: ch as '+' | '-' | '*' | '/' });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    // Any other character is invalid
    return null;
  }

  return tokens;
}

/**
 * Recursive descent parser.
 *
 * Grammar:
 *   expression = term (('+' | '-') term)*
 *   term       = factor (('*' | '/') factor)*
 *   factor     = NUMBER | '(' expression ')' | unary
 */
class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parseExpression(): number | null {
    const result = this.additive();
    if (result === null) return null;
    // After parsing the full expression, we should have consumed all tokens
    if (this.pos !== this.tokens.length) return null;
    return result;
  }

  private additive(): number | null {
    let left = this.multiplicative();
    if (left === null) return null;

    while (this.peek()?.type === 'op' && (this.peek() as { type: 'op'; value: string }).value === '+' || this.peek()?.type === 'op' && (this.peek() as { type: 'op'; value: string }).value === '-') {
      const op = this.consume() as { type: 'op'; value: '+' | '-' };
      const right = this.multiplicative();
      if (right === null) return null;
      if (op.value === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
    }

    return left;
  }

  private multiplicative(): number | null {
    let left = this.factor();
    if (left === null) return null;

    while (this.peek()?.type === 'op' && ((this.peek() as { type: 'op'; value: string }).value === '*' || (this.peek() as { type: 'op'; value: string }).value === '/')) {
      const op = this.consume() as { type: 'op'; value: '*' | '/' };
      const right = this.factor();
      if (right === null) return null;
      if (op.value === '*') {
        left = left * right;
      } else {
        if (right === 0) return null; // division by zero
        left = left / right;
      }
    }

    return left;
  }

  private factor(): number | null {
    const token = this.peek();
    if (!token) return null;

    // Number literal
    if (token.type === 'number') {
      this.consume();
      return token.value;
    }

    // Parenthesized expression
    if (token.type === 'lparen') {
      this.consume(); // consume '('
      const result = this.additive();
      if (result === null) return null;
      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') return null; // missing closing paren
      this.consume(); // consume ')'
      return result;
    }

    return null; // unexpected token
  }
}

/**
 * Evaluate a math expression string and return the result.
 * Returns null if the expression is invalid.
 *
 * Supports: +, -, *, /, parentheses, decimal numbers, negative numbers.
 * Plain numbers (e.g., "150") are also handled and return their numeric value.
 */
export function evaluateExpression(input: string): number | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return null;

  const parser = new Parser(tokens);
  const result = parser.parseExpression();

  if (result === null || !isFinite(result)) return null;

  return result;
}
