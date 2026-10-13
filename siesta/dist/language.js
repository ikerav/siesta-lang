// Siesta v1: lexer → recursive-descent parser → tree-walking interpreter.
// No eval, Function constructor, host object access or third-party dependencies.
export const KEYWORDS = new Set(['pon', 'chiva', 'si', 'sino', 'repite', 'mientras', 'receta', 'sirve', 'pilas', 'siesta', 'verdad', 'mentira', 'nada', 'y', 'o', 'no']);
export class SiestaError extends Error {
  constructor(message, loc = {}, phase = 'Evaluador') {
    super(message); this.name = 'SiestaError'; this.line = loc.line ?? 1; this.column = loc.column ?? 1; this.phase = phase;
  }
}
export function tokenize(source) {
  if (source.length > 50000) throw new SiestaError('Este cuaderno admite hasta 50.000 caracteres.', {}, 'Tokenizer');
  const tokens = []; let i = 0, line = 1, column = 1;
  const advance = () => { const c = source[i++]; if (c === '\n') { line++; column = 1; } else column++; return c; };
  const fail = (message, loc) => { throw new SiestaError(message, loc, 'Tokenizer'); };
  while (i < source.length) {
    const c = source[i];
    if (/\s/u.test(c)) { advance(); continue; }
    if (c === '#') { while (i < source.length && source[i] !== '\n') advance(); continue; }
    const start = i, loc = { line, column };
    let type, value;
    if (/\d/.test(c)) {
      while (i < source.length && /\d/.test(source[i])) advance();
      if (source[i] === '.' && /\d/.test(source[i + 1] ?? '')) { advance(); while (i < source.length && /\d/.test(source[i])) advance(); }
      type = 'NUMBER'; value = Number(source.slice(start, i));
      if (!Number.isFinite(value)) fail('Ese número es demasiado grande.', loc);
    } else if (/[\p{L}_]/u.test(c)) {
      while (i < source.length && /[\p{L}\p{N}_]/u.test(source[i])) advance();
      value = source.slice(start, i); type = KEYWORDS.has(value) ? 'KEYWORD' : 'IDENTIFIER';
    } else if (c === '"' || c === "'") {
      const quote = advance(); value = ''; type = 'STRING';
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
          advance(); const esc = advance();
          const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
          if (!(esc in escapes)) fail('Escape desconocido. Prueba \\n, \\t o \\".', loc);
          value += escapes[esc];
        } else value += advance();
      }
      if (i >= source.length) fail('Esta cadena se ha quedado sin comillas de cierre.', loc);
      advance();
    } else {
      const two = source.slice(i, i + 2);
      if (['==', '!=', '<=', '>='].includes(two)) { advance(); advance(); value = two; type = 'OPERATOR'; }
      else if ('+-*/%<>=!'.includes(c)) { value = advance(); type = 'OPERATOR'; }
      else if ('(){}[],;'.includes(c)) { value = advance(); type = 'PUNCTUATION'; }
      else fail(`No conozco el carácter «${c}».`, loc);
    }
    tokens.push({ type, value, raw: source.slice(start, i), ...loc, start, end: i });
  }
  tokens.push({ type: 'EOF', value: '<fin>', raw: '', line, column, start: i, end: i });
  return tokens;
}
export function parse(tokens) {
  let pos = 0, depth = 0;
  const peek = () => tokens[pos];
  const is = v => peek().value === v && peek().type !== 'STRING';
  const next = () => tokens[pos++];
  const fail = message => { throw new SiestaError(message, peek(), 'Parser'); };
  const match = v => is(v) ? next() : null;
  const expect = v => match(v) ?? fail(`Esperaba «${v}», pero encontré «${peek().raw || 'fin del código'}».`);
  const identifier = () => peek().type === 'IDENTIFIER' ? next().value : fail('Aquí necesito un nombre de variable o receta.');
  const node = (type, loc, props = {}) => ({ type, loc: { line: loc.line, column: loc.column }, ...props });
  const bounded = fn => { if (++depth > 180) fail('Demasiados niveles de anidación (máximo 180).'); try { return fn(); } finally { depth--; } };
  function block() { expect('{'); const body = []; while (!is('}') && peek().type !== 'EOF') body.push(statement()); expect('}'); return body; }
  function statement() { return bounded(() => {
    const t = peek();
    if (match('pon')) { const name = identifier(); expect('='); const value = expression(); expect(';'); return node('Let', t, { name, value }); }
    if (match('chiva')) { const value = expression(); expect(';'); return node('Print', t, { value }); }
    if (match('pilas')) { const value = expression(); expect(';'); return node('Battery', t, { value }); }
    if (match('siesta')) { expect(';'); return node('Rest', t); }
    if (match('si')) { const test = expression(); const consequent = block(); const alternate = match('sino') ? block() : []; return node('If', t, { test, consequent, alternate }); }
    if (match('repite')) { const count = expression(); return node('Repeat', t, { count, body: block() }); }
    if (match('mientras')) { const test = expression(); return node('While', t, { test, body: block() }); }
    if (match('receta')) {
      const name = identifier(); expect('('); const params = [];
      if (!is(')')) do { const param = identifier(); if (params.includes(param)) fail(`El parámetro «${param}» ya existe.`); params.push(param); } while (match(','));
      expect(')'); return node('Function', t, { name, params, body: block() });
    }
    if (match('sirve')) { const value = is(';') ? node('Literal', t, { value: null }) : expression(); expect(';'); return node('Return', t, { value }); }
    if (peek().type === 'IDENTIFIER' && tokens[pos + 1]?.value === '=') { const name = next().value; next(); const value = expression(); expect(';'); return node('Assign', t, { name, value }); }
    const value = expression(); expect(';'); return node('Expression', t, { value });
  }); }
  const levels = [['o'], ['y'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];
  function expression(level = 0) { return bounded(() => {
    if (level === levels.length) return unary();
    let left = expression(level + 1);
    while (levels[level].some(is)) { const op = next(); left = node('Binary', op, { operator: op.value, left, right: expression(level + 1) }); }
    return left;
  }); }
  function unary() { return bounded(() => { if (['-', '+', 'no', '!'].some(is)) { const t = next(); return node('Unary', t, { operator: t.value, argument: unary() }); } return postfix(); }); }
  function postfix() {
    let result = primary();
    while (is('(') || is('[')) {
      const loc = peek();
      if (match('(')) { const args = []; if (!is(')')) do { args.push(expression()); } while (match(',')); expect(')'); result = node('Call', loc, { callee: result, args }); }
      else { expect('['); const index = expression(); expect(']'); result = node('Index', loc, { object: result, index }); }
    }
    return result;
  }
  function primary() {
    const t = peek();
    if (t.type === 'NUMBER' || t.type === 'STRING') { next(); return node('Literal', t, { value: t.value }); }
    if (match('verdad')) return node('Literal', t, { value: true });
    if (match('mentira')) return node('Literal', t, { value: false });
    if (match('nada')) return node('Literal', t, { value: null });
    if (t.type === 'IDENTIFIER') { next(); return node('Identifier', t, { name: t.value }); }
    if (match('(')) { const value = expression(); expect(')'); return value; }
    if (match('[')) { const elements = []; if (!is(']')) do { elements.push(expression()); } while (match(',')); expect(']'); return node('List', t, { elements }); }
    fail(`Esperaba una expresión, pero encontré «${t.raw || 'fin del código'}».`);
  }
  const body = []; while (peek().type !== 'EOF') body.push(statement());
  return node('Program', tokens[0], { body });
}
export function format(value) {
  let visits = 0, characters = 0;
  const append = s => { characters += s.length; if (characters > 100000) throw new SiestaError('Valor demasiado largo para mostrar (máximo 100.000 caracteres).'); return s; };
  const visit = (v, depth) => {
    if (++visits > 10000 || depth > 60) throw new SiestaError('Lista demasiado grande o profunda para mostrar.');
    if (v === null) return append('nada'); if (v === true) return append('verdad'); if (v === false) return append('mentira');
    if (Array.isArray(v)) return append('[') + v.map(el => typeof el === 'string' ? append(JSON.stringify(el)) : visit(el, depth + 1)).join(append(', ')) + append(']');
    if (typeof v === 'object') return append('<receta>');
    return append(String(v));
  };
  return visit(value, 0);
}
class Environment {
  constructor(parent = null) { this.parent = parent; this.values = new Map(); }
  define(name, value, loc) { if (this.values.has(name)) throw new SiestaError(`«${name}» ya está declarado en este bloque.`, loc); this.values.set(name, value); }
  owner(name, loc) { if (this.values.has(name)) return this; if (this.parent) return this.parent.owner(name, loc); throw new SiestaError(`«${name}» no existe. Decláralo con «pon».`, loc); }
  get(name, loc) { return this.owner(name, loc).values.get(name); }
  set(name, value, loc) { this.owner(name, loc).values.set(name, value); }
}
class ReturnSignal { constructor(value) { this.value = value; } }
export function evaluate(ast, options = {}) {
  let capacity = 40, energy = capacity, steps = 0, rests = 0, callDepth = 0, batterySet = false, outputSize = 0;
  const output = [], events = [], root = new Environment(), builtins = new Environment(); root.parent = builtins;
  const maxSteps = Math.min(options.maxSteps ?? 30000, 100000);
  const fail = (message, loc) => { throw new SiestaError(message, loc); };
  const tick = loc => { if (++steps > maxSteps) fail(`Has alcanzado el límite de ${maxSteps.toLocaleString('es')} pasos. Revisa tus bucles.`, loc); };
  const spend = loc => { tick(loc); if (energy <= 0) fail('Sin pilas. Añade «siesta;» antes de agotar la batería.', loc); energy--; };
  const event = (kind, text, loc) => { if (events.length < 400) events.push({ kind, text, line: loc.line, energy }); };
  const number = (v, loc) => typeof v === 'number' && Number.isFinite(v) ? v : fail('Aquí necesito un número finito.', loc);
  const boolean = (v, loc) => typeof v === 'boolean' ? v : fail('La condición debe ser «verdad» o «mentira».', loc);
  const builtin = (name, arity, fn) => builtins.define(name, { builtin: fn, arity });
  builtin('largo', 1, ([v], loc) => typeof v === 'string' || Array.isArray(v) ? v.length : fail('«largo» necesita un texto o una lista.', loc));
  builtin('texto', 1, ([v]) => format(v));
  builtin('numero', 1, ([v], loc) => { if (typeof v !== 'string' && typeof v !== 'number' || typeof v === 'string' && !v.trim()) fail('«numero» necesita un texto numérico o un número.', loc); return number(Number(v), loc); });
  builtin('redondea', 1, ([v], loc) => Math.round(number(v, loc)));
  builtin('energia', 0, () => energy);
  function expr(n, env) {
    tick(n.loc); let v;
    switch (n.type) {
      case 'Literal': return n.value;
      case 'Identifier': return env.get(n.name, n.loc);
      case 'List': return n.elements.map(el => expr(el, env));
      case 'Index': { const obj = expr(n.object, env), index = expr(n.index, env); if (!Array.isArray(obj) && typeof obj !== 'string') fail('Solo puedes indexar listas y textos.', n.loc); if (!Number.isInteger(index) || index < 0 || index >= obj.length) fail('Ese índice se ha salido de la lista o del texto (empiezan en 0).', n.loc); return obj[index]; }
      case 'Unary': v = expr(n.argument, env); return n.operator === 'no' || n.operator === '!' ? !boolean(v, n.loc) : number(n.operator === '-' ? -number(v, n.loc) : number(v, n.loc), n.loc);
      case 'Binary': {
        const a = expr(n.left, env), op = n.operator;
        if (op === 'y') return boolean(a, n.loc) && boolean(expr(n.right, env), n.loc);
        if (op === 'o') return boolean(a, n.loc) || boolean(expr(n.right, env), n.loc);
        const b = expr(n.right, env);
        if (op === '==') return a === b; if (op === '!=') return a !== b;
        if (op === '+' && (typeof a === 'string' || typeof b === 'string')) { const s = format(a) + format(b); if (s.length > 100000) fail('Texto demasiado largo (máximo 100.000 caracteres).', n.loc); return s; }
        if (['<', '>', '<=', '>='].includes(op)) { if (!(typeof a === 'number' && typeof b === 'number' || typeof a === 'string' && typeof b === 'string')) fail('Compara dos números o dos textos del mismo tipo.', n.loc); return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b; }
        number(a, n.loc); number(b, n.loc);
        if ((op === '/' || op === '%') && b === 0) fail('Dividir entre cero da más sueño del permitido.', n.loc);
        return number(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : a % b, n.loc);
      }
      case 'Call': {
        const fn = expr(n.callee, env), args = n.args.map(a => expr(a, env));
        if (!fn || typeof fn !== 'object' || (!fn.builtin && fn.type !== 'Closure')) fail('Eso no es una receta que puedas llamar.', n.loc);
        const expected = fn.arity ?? fn.params.length;
        if (args.length !== expected) fail(`Esta receta espera ${expected} ingredientes; has pasado ${args.length}.`, n.loc);
        spend(n.loc);
        if (fn.builtin) return fn.builtin(args, n.loc);
        if (++callDepth > 60) { callDepth--; fail('Demasiadas recetas dentro de recetas (máximo 60 llamadas).', n.loc); }
        const local = new Environment(fn.env); fn.params.forEach((p, i) => local.define(p, args[i], n.loc));
        try { execute(fn.body, local); return null; } catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; } finally { callDepth--; }
      }
      default: fail('Expresión desconocida.', n.loc);
    }
  }
  function execute(body, env) { for (const n of body) stmt(n, env); }
  function stmt(n, env) {
    if (n.type === 'Battery') {
      tick(n.loc);
      if (batterySet || ast.body[0] !== n || env !== root) fail('«pilas» solo puede aparecer como primera instrucción del programa.', n.loc);
      const value = expr(n.value, env);
      if (!Number.isInteger(value) || value < 1 || value > 1000) fail('La batería necesita entre 1 y 1.000 pilas enteras.', n.loc);
      capacity = value; energy = capacity; batterySet = true; event('battery', `Batería: ${capacity} unidades`, n.loc); return;
    }
    if (n.type === 'Rest') { tick(n.loc); energy = capacity; rests++; event('rest', 'Siesta. Batería recargada.', n.loc); return; }
    spend(n.loc);
    switch (n.type) {
      case 'Let': { const value = expr(n.value, env); env.define(n.name, value, n.loc); event('variable', `${n.name} = ${format(value)}`, n.loc); break; }
      case 'Assign': { const value = expr(n.value, env); env.set(n.name, value, n.loc); event('variable', `${n.name} = ${format(value)}`, n.loc); break; }
      case 'Print': { const value = format(expr(n.value, env)); outputSize += value.length; if (output.length >= 500 || outputSize > 100000) fail('La consola está llena (500 líneas o 100.000 caracteres).', n.loc); output.push(value); event('print', value, n.loc); break; }
      case 'If': execute(boolean(expr(n.test, env), n.loc) ? n.consequent : n.alternate, new Environment(env)); break;
      case 'Repeat': {
        const count = expr(n.count, env); if (!Number.isInteger(count) || count < 0 || count > 100000) fail('«repite» necesita un entero entre 0 y 100.000.', n.loc);
        for (let i = 0; i < count; i++) { spend(n.loc); const iteration = new Environment(env); iteration.define('turno', i + 1, n.loc); execute(n.body, iteration); } break;
      }
      case 'While': while (boolean(expr(n.test, env), n.loc)) { spend(n.loc); execute(n.body, new Environment(env)); } break;
      case 'Function': env.define(n.name, { type: 'Closure', params: n.params, body: n.body, env }, n.loc); event('recipe', `Receta «${n.name}» preparada`, n.loc); break;
      case 'Return': if (!callDepth) fail('«sirve» solo funciona dentro de una receta.', n.loc); throw new ReturnSignal(expr(n.value, env));
      case 'Expression': expr(n.value, env); break;
      default: fail('Instrucción desconocida.', n.loc);
    }
  }
  let error = null;
  try { execute(ast.body, root); } catch (e) { error = e instanceof SiestaError ? e : new SiestaError('El programa supera los límites del intérprete.'); }
  return { output, events, variables: [...root.values].map(([name, value]) => ({ name, type: Array.isArray(value) ? 'lista' : value === null ? 'nada' : typeof value === 'object' ? 'receta' : typeof value === 'number' ? 'número' : typeof value === 'boolean' ? 'booleano' : 'texto', value: (() => { try { return format(value); } catch { return '<valor demasiado grande>'; } })() })), energy, capacity, rests, steps, error };
}
export function run(source, options) {
  let tokens = [], ast = null;
  try { tokens = tokenize(source); ast = parse(tokens); return { tokens, ast, ...evaluate(ast, options) }; }
  catch (e) { return { tokens, ast, output: [], variables: [], events: [], energy: 40, capacity: 40, rests: 0, steps: 0, error: e instanceof SiestaError ? e : new SiestaError('El programa supera los límites del parser.', {}, 'Parser') }; }
}
