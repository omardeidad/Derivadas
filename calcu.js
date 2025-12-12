/* app.js
   Motor simbólico local + UI
   - Pasos MUY detallados (estilo MathDF)
   - Vista previa TeX
   - Zoom, modo oscuro, limpiar
   - Teclado matemático con botones rápidos
*/

// ---------------------------
// Utilidades generales
// ---------------------------
function $(id){ return document.getElementById(id); }
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }
function safeRenderTex(container, tex) {
    try {
        container.innerHTML = "";

        tex = tex.replace(/^\\\(/, "").replace(/\\\)$/, "");
        tex = tex.replace(/^\\\[/, "").replace(/\\\]$/, "");

        katex.render(tex, container, {
            throwOnError: false
        });

    } catch (e) {
        container.textContent = tex;
    }
}



// ---------------------------
// ZOOM
// ---------------------------
let zoomLevel = 100;
function zoom(val){
  zoomLevel = Number(val);
  const result = $('resultado');
  if(result) result.style.fontSize = (zoomLevel/100) + "em";
}
if($('zoom-area')){
  // if there's an input range, sync it
  const inputRange = document.querySelector('#zoom-area input[type="range"]');
  if(inputRange){
    inputRange.addEventListener('input', (e) => zoom(e.target.value));
  }
}

// ---------------------------
// MODO OSCURO
// ---------------------------
if($('themeButton')) {
  $('themeButton').addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });
}

// ---------------------------
// TECLADO RÁPIDO (botones) - crea botones dinámicos si hay contenedor
// ---------------------------
(function createQuickButtons(){
  const keys = [
    ['^','x','*','+','-','/'],
    ['(',')','^2','^3','^','sqrt('],
    ['sin(','cos(','tan(','ln(','log(','exp('],
    ['pi','e','abs(','|',' , ',' ']
  ];
  const keyboardArea = document.getElementById('keyboard-area');
  if(!keyboardArea) return;
  keys.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'kbd-row';
    row.forEach(k => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kbd-btn';
      btn.textContent = k;
      btn.addEventListener('click', () => {
        const input = $('funcion');
        if(!input) return;
        // Insert at cursor
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const val = input.value;
        const insert = (k === '^2') ? '^2' : (k === '^3' ? '^3' : k);
        input.value = val.slice(0,start) + insert + val.slice(end);
        const pos = start + insert.length;
        input.setSelectionRange(pos,pos);
        input.focus();
        // update preview
        triggerPreview();
      });
      rowDiv.appendChild(btn);
    });
    keyboardArea.appendChild(rowDiv);
  });
})();

// ---------------------------
// EVENTOS LIMPIAR
// ---------------------------
if($('btn-limpiar')){
  $('btn-limpiar').addEventListener('click', () => {
    if($('funcion')) $('funcion').value = '';
    if($('preview')) $('preview').innerHTML = '';
    if($('resultado')) $('resultado').innerHTML = '';
    if($('steps')) $('steps').innerHTML = '';
  });
}

// ---------------------------
// VISTA PREVIA: convierte a TeX usando un parser ligero (intenta math.parse si existe)
// ---------------------------
function previewExprToTex(expr) {

    // Si existe math.js — usa su LaTeX
    try {
        if (window.math && typeof math.parse === "function") {
            const node = math.parse(expr);
            return node.toTex({ parenthesis: "auto" });
        }
    } catch (e) {}

    // fallback manual
    let tex = expr;

    // convertir (A)/(B) → \frac{A}{B}
    tex = tex.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, "\\frac{$1}{$2}");

    // exponentes simples
    tex = tex.replace(/([A-Za-z0-9]+)\^([0-9]+)/g, "$1^{ $2 }");

    return tex;
}


function triggerPreview() {
    const input = $('funcion');
    const preview = $('preview');
    if (!input || !preview) return;

    const txt = input.value.trim();
    if (txt === "") {
        preview.innerHTML = "";
        return;
    }

    try {
        let tex = previewExprToTex(txt);

        // limpiar delimitadores KaTeX inválidos
        tex = tex.replace(/^\\\(/, "").replace(/\\\)$/, "");
        tex = tex.replace(/^\\\[/, "").replace(/\\\]$/, "");

        safeRenderTex(preview, tex);

    } catch (e) {
        preview.textContent = "Expresión inválida";
    }
}


// ---------------------------
// LEXER / TOKENIZER (con multiplicación implícita robusta)
// ---------------------------
function tokenize(input){
  let raw = [];
  let i = 0;
  const isDigit = c => /\d/.test(c);
  const isLetter = c => /[a-zA-Z]/.test(c);

  while(i < input.length){
    let c = input[i];
    if(c === ' '){ i++; continue; }

    // numbers (support decimal)
    if(isDigit(c) || (c === '.' && isDigit(input[i+1]))){
      let num = c; i++;
      while(i < input.length && (isDigit(input[i]) || input[i] === '.')) num += input[i++];
      raw.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // names (variables or functions)
    if(isLetter(c)){
      let name = c; i++;
      while(i < input.length && isLetter(input[i])) name += input[i++];
      raw.push({ type: 'name', value: name });
      continue;
    }

    // symbols
    if("+-*/^()".includes(c)){
      raw.push({ type: c });
      i++;
      continue;
    }

    // unexpected char
    throw new Error('Carácter inválido en input: ' + c);
  }

  // MULTIPLICACIÓN IMPLÍCITA (inserta '*')
  const tokens = [];
  function isPrimary(t){
    return t.type === 'number' || t.type === 'name' || t.type === ')';
  }
  function isFollowingPrimary(t){
    return t.type === 'number' || t.type === 'name' || t.type === '(';
  }
  for(let j=0;j<raw.length;j++){
    const t = raw[j];
    const next = raw[j+1];
    tokens.push(t);
    if(!next) continue;
    if(isPrimary(t) && isFollowingPrimary(next)){
      tokens.push({ type: '*' });
    }
  }
  return tokens;
}

// ---------------------------
// PARSER → AST (precedences: ^, unary -, *, /, +, -)
// ---------------------------
function parseExpression(tokens){
  let i = 0;
  function peek(){ return tokens[i]; }
  function consume(t){
    if(peek() && peek().type === t) return tokens[i++];
    throw new Error('Se esperaba ' + t + ' pero vino ' + (peek()?peek().type:'EOF'));
  }

  function parsePrimary(){
    const t = peek();
    if(!t) throw new Error('Token inesperado EOF');
    if(t.type === 'number'){ consume('number'); return { type: 'num', value: t.value }; }
    if(t.type === 'name'){ 
      consume('name');
      // function call?
      if(peek() && peek().type === '('){
        consume('(');
        const inside = parseAddSub();
        consume(')');
        return { type: 'func', name: t.value, arg: inside };
      }
      return { type: 'var', name: t.value };
    }
    if(t.type === '('){
      consume('(');
      const ex = parseAddSub();
      consume(')');
      return ex;
    }
    throw new Error('Token inválido en primary: ' + t.type);
  }

  function parseUnary(){
    if(peek() && peek().type === '-'){ consume('-'); return { type: 'neg', value: parseUnary() }; }
    return parsePrimary();
  }

  function parsePow(){
    let left = parseUnary();
    while(peek() && peek().type === '^'){
      consume('^');
      const right = parseUnary();
      left = { type: 'pow', left, right };
    }
    return left;
  }

  function parseMulDiv(){
    let left = parsePow();
    while(peek() && (peek().type === '*' || peek().type === '/')){
      const op = peek().type; consume(op);
      const right = parsePow();
      left = { type: op, left, right };
    }
    return left;
  }

  function parseAddSub(){
    let left = parseMulDiv();
    while(peek() && (peek().type === '+' || peek().type === '-')){
      const op = peek().type; consume(op);
      const right = parseMulDiv();
      left = { type: op, left, right };
    }
    return left;
  }

  return parseAddSub();
}

// ---------------------------
// TO-TEX (para nodos del AST)
// ---------------------------
function nodeToTex(node){
  if(!node) return '';
  if(node.tex) return node.tex; // si tenemos shortcut de TeX
  switch(node.type){
    case 'num': return node.value.toString();
    case 'var': return node.name;
    case 'neg': return '-' + nodeToTex(node.value);
    case '+': return `${nodeToTex(node.left)} + ${nodeToTex(node.right)}`;
    case '-': return `${nodeToTex(node.left)} - ${nodeToTex(node.right)}`;
    case '*': {
      const L = (node.left.type==='+'||node.left.type==='-')?`(${nodeToTex(node.left)})`:nodeToTex(node.left);
      const R = (node.right.type==='+'||node.right.type==='-')?`(${nodeToTex(node.right)})`:nodeToTex(node.right);
      return `${L} ${R}`;
    }
    case '/': return `\\frac{${nodeToTex(node.left)}}{${nodeToTex(node.right)}}`;
    case 'pow': return `${nodeToTex(node.left)}^{${nodeToTex(node.right)}}`;
    case 'func': return `\\${node.name}(${nodeToTex(node.arg)})`;
    default: return '';
  }
}


// ---------------------------
// SIMPLIFICADOR BÁSICO (reduce términos obvios)
// ---------------------------
function simplify(node){

  // Simplifica recursivamente
  function rec(n){
    if(!n) return n;

    switch(n.type){
      case 'num':
      case 'var':
        return n;

      case 'neg':
        const v = rec(n.value);
        if(v.type === 'num') return { type:'num', value:-v.value };
        return { type:'neg', value:v };

      case '+': {
        const L = rec(n.left), R = rec(n.right);
        if(L.type==='num' && L.value===0) return R;
        if(R.type==='num' && R.value===0) return L;
        if(L.type==='num' && R.type==='num') return { type:'num', value:L.value+R.value };
        return { type:'+', left:L, right:R };
      }

      case '-': {
        const L = rec(n.left), R = rec(n.right);
        if(R.type==='num' && R.value===0) return L;
        if(L.type==='num' && R.type==='num') return { type:'num', value:L.value-R.value };
        return { type:'-', left:L, right:R };
      }

      case '*': {
        const L = rec(n.left), R = rec(n.right);

        // Si cualquier lado es 0
        if((L.type==='num' && L.value===0) || (R.type==='num' && R.value===0))
            return { type:'num', value:0 };

        // 1 * f
        if(L.type==='num' && L.value===1) return R;
        if(R.type==='num' && R.value===1) return L;

        // APLANAR productos: obtener lista [factores...]
        function flattenMul(x){
          if(x.type==='*'){
            return [...flattenMul(x.left), ...flattenMul(x.right)];
          }
          return [x];
        }

        const factors = [...flattenMul(L), ...flattenMul(R)];

        // Multiplicar números
        let numeric = 1;
        const others = [];

        for(const f of factors){
          if(f.type==='num'){
            numeric *= f.value;
          } else {
            others.push(f);
          }
        }

        // Si no quedan otros factores → solo un número
        if(others.length === 0)
          return { type:'num', value:numeric };

        // Si numeric = 1 → no incluir explícitamente
        let result = null;

        if(numeric !== 1)
          result = { type:'num', value:numeric };

        // reconstruir producto
        for(const f of others){
          if(result === null) result = f;
          else result = { type:'*', left:result, right:f };
        }

        return result;
      }

      case '/': {
        const L = rec(n.left), R = rec(n.right);
        if(L.type==='num' && L.value===0) return { type:'num', value:0 };
        if(R.type==='num' && R.value===1) return L;
        return { type:'/', left:L, right:R };
      }

      case 'pow': {
        const L = rec(n.left), R = rec(n.right);
        if(R.type==='num' && R.value===0) return { type:'num', value:1 };
        if(R.type==='num' && R.value===1) return L;
        return { type:'pow', left:L, right:R };
      }

      case 'func':
        return { type:'func', name:n.name, arg:rec(n.arg) };
    }
  }

  return rec(node);
}

// ---------------------------
// DERIVACIÓN con pasos MUY DETALLADOS (registro de pasos estilo MathDF)
// ---------------------------

function deriveDetailed(node, v){
  const steps = []; // each step { rule, beforeTex, afterTex, note? }

  function push(rule, beforeNode, afterNode, note){
    steps.push({
      rule,
      beforeTex: nodeToTex(beforeNode),
      afterTex: nodeToTex(afterNode),
      note: note || ''
    });
  }

  // recursive derivative that returns node result
  function d(n){
    switch(n.type){
      case 'num': {
        const res = { type: 'num', value: 0 };
        push('Constante', n, res, 'La derivada de una constante es 0.');
        return res;
      }
      case 'var': {
        const val = (n.name === v) ? 1 : 0;
        const res = { type: 'num', value: val };
        push('Derivada de variable', n, res, (val===1) ? `d(${n.name})/d${v} = 1` : `d(${n.name})/d${v} = 0`);
        return res;
      }
      case 'neg': {
        const innerPrime = d(n.value);
        const res = { type: 'neg', value: innerPrime };
        push('Negativo', n, res, "La derivada de -f es -f'.");
        return res;
      }
      case '+': {
        const Lp = d(n.left); const Rp = d(n.right);
        const res = { type: '+', left: Lp, right: Rp };
        push('Suma', n, res, "La derivada de f+g es f' + g'.");
        return res;
      }
      case '-': {
        const Lp = d(n.left); const Rp = d(n.right);
        const res = { type: '-', left: Lp, right: Rp };
        push('Resta', n, res, "La derivada de f-g es f' - g'.");
        return res;
      }
      case '*': {
        // handle constant * var or const * f (simplify for readability)
        // case 1: k * x  where k number and x variable equal v
        if(n.left.type === 'num' && n.right.type === 'var' && n.right.name === v){
          const k = n.left.value;
          const res = { type: 'num', value: k };
          push('Constante por variable', n, res, `d(${k}·${v}) = ${k}`);
          return res;
        }
        // case 2: x * k
        if(n.right.type === 'num' && n.left.type === 'var' && n.left.name === v){
          const k = n.right.value;
          const res = { type: 'num', value: k };
          push('Constante por variable', n, res, `d(${v}·${k}) = ${k}`);
          return res;
        }

        // general product rule
        push('Producto - preparación', n, n, 'Aplicaremos (f·g)\' = f\'·g + f·g\' (regla del producto).');
        const f = n.left; const g = n.right;
        const fprime = d(f);
        const gprime = d(g);
        const leftTerm = { type: '*', left: fprime, right: g };
        const rightTerm = { type: '*', left: f, right: gprime };
        const res = { type: '+', left: leftTerm, right: rightTerm };
        push('Producto - aplicación', n, res, "Aplicada la regla del producto:");
        // optionally simplify terms like 0*x etc will be simplified later
        return res;
      }
      case '/': {
        push('Cociente - preparación', n, n, "Aplicaremos (f/g)' = (f'·g - f·g')/g^2.");
        const f = n.left; const g = n.right;
        const fprime = d(f);
        const gprime = d(g);
        const numerator = { type: '-', left: { type: '*', left: fprime, right: g }, right: { type: '*', left: f, right: gprime } };
        const denominator = { type: 'pow', left: g, right: { type: 'num', value: 2 } };
        const res = { type: '/', left: numerator, right: denominator };
        push('Cociente - aplicación', n, res, "Aplicada la regla del cociente.");
        return res;
      }
      case 'pow': {
        // if exponent is a number: n * u^{n-1} * u'
        if(n.right.type === 'num'){
          const exponent = n.right.value;
          // d(u^n) = n*u^{n-1} * u'
          push('Potencia - identificación', n, n, `Detectada potencia con exponente ${exponent}.`);
          const u = n.left;
          const uPrime = d(u);
          const basePow = { type: 'pow', left: u, right: { type: 'num', value: exponent - 1 } };
          const coeff = { type: 'num', value: exponent };
          const resBase = { type: '*', left: coeff, right: basePow };
          // if u is simple variable equal v, then u' = 1, we can short-circuit
          if(u.type === 'var' && u.name === v){
            push('Potencia - regla simple', n, resBase, `d(${v}^${exponent}) = ${exponent}·${v}^{${exponent-1}}`);
            return resBase;
          } else {
            // full: n * u^{n-1} * u'
            const full = { type: '*', left: resBase, right: uPrime };
            push('Potencia - regla con cadena', n, full, 'Aplicada la regla de la potencia combinada con la regla de la cadena.');
            return full;
          }
        }
        // general case: a^b => a^b * d(ln(a)*b) (not fully expanded but explained)
        push('Potencia general', n, n, 'Exponente no constante: aplicamos regla general d(a^b)=a^b · d(ln(a)·b).');
        const lnA_times_b = { type: '*', left: { type: 'func', name: 'ln', arg: n.left }, right: n.right };
        const dlnab = d(lnA_times_b);
        const res = { type: '*', left: n, right: dlnab };
        push('Potencia general - aplicación', n, res, 'Regla general aplicada.');
        return res;
      }
      case 'func': {
        // chain rule: d(f(g(x))) = f'(g(x)) * g'(x)
        const name = n.name;
        const u = n.arg;
        push('Cadena - identificación', n, n, `Función compuesta detectada: ${name}(...). Aplicaremos regla de la cadena.`);
        const uprime = d(u);
        let outer; let note;
        switch(name){
          case 'sin':
            outer = { type: 'func', name: 'cos', arg: u }; note = "d(sin(u)) = cos(u)·u'";
            break;
          case 'cos':
            outer = { type: 'neg', value: { type: 'func', name: 'sin', arg: u } }; note = "d(cos(u)) = -sin(u)·u'";
            break;
          case 'tan':
            outer = { type: 'pow', left: { type: 'func', name: 'sec', arg: u }, right: { type: 'num', value: 2 } }; note = "d(tan(u)) = sec^2(u)·u'";
            break;
          case 'ln':
          case 'log':
            outer = u; note = "d(ln(u)) = u'/u";
            break;
          case 'exp':
            outer = n; note = "d(exp(u)) = exp(u)·u'";
            break;
          case 'sqrt':
            outer = { type: '/', left: uprime, right: { type: '*', left: { type: 'num', value: 2 }, right: n } }; // handled later better
            break;
          case 'abs':
            outer = { type: 'func', name: 'sgn', arg: u }; note = "d(abs(u)) = sgn(u)·u'";
            break;
          default:
            throw new Error('Función no soportada en chain rule: ' + name);
        }

        // build result = outer * u'
        let res;
        if(name === 'ln' || name === 'log'){
          // ln case: u'/u
          res = { type: '/', left: uprime, right: u };
          push('Cadena - ln/log', n, res, 'Aplicada d(ln(u)) = u\'/u');
          return res;
        } else if(name === 'sqrt'){
          // already handled above as shortcut
          const innerPrime = uprime;
          const resSqrt = { type: '/', left: innerPrime, right: { type: '*', left: { type: 'num', value: 2 }, right: n } };
          push('Cadena - sqrt', n, resSqrt, 'd(sqrt(u)) = u\'/(2 sqrt(u))');
          return resSqrt;
        } else {
          // general: outer(u) * u'
          res = { type: '*', left: uprime, right: outer };
          push('Cadena - aplicación', n, res, `Aplicada regla de la cadena: ${note}`);
          return res;
        }
      }
      default:
        throw new Error('Tipo de nodo no soportado en derivación: ' + n.type);
    }
  }

  const derived = d(node);
  return { derived, steps };
}

// ---------------------------
// FUNCIÓN PARA GENERAR PASOS Y RENDERIZAR TODO
// ---------------------------
function renderSteps(steps){
  const stepsEl = $('steps');
  if(!stepsEl) return;
  clearChildren(stepsEl);
  steps.forEach((s, idx) => {
    const div = document.createElement('div');
    div.className = 'step';
    const title = document.createElement('div');
    title.className = 'rule';
    title.textContent = `${idx+1}. ${s.rule}`;
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = s.note || '';
    const beforeL = document.createElement('div');
    beforeL.className = 'label';
    beforeL.textContent = 'Antes:';
    const before = document.createElement('div'); before.className='expr';
    safeRenderTex(before, s.beforeTex);
    const afterL = document.createElement('div'); afterL.className='label'; afterL.textContent='Después:';
    const after = document.createElement('div'); after.className='expr';
    safeRenderTex(after, s.afterTex);
    div.appendChild(title);
    if(s.note) div.appendChild(note);
    div.appendChild(beforeL);
    div.appendChild(before);
    div.appendChild(afterL);
    div.appendChild(after);
    stepsEl.appendChild(div);
  });
}

// ---------------------------
// BOTÓN DERIVAR: todo el flujo
// ---------------------------
if($('btn-derivar')){
  $('btn-derivar').addEventListener('click', () => {
    const expr = $('funcion')? $('funcion').value.trim() : '';
    const variable = $('variable')? $('variable').value : 'x';
    const previewEl = $('preview');
    const resultEl = $('resultado');
    const stepsEl = $('steps');

    if(!expr){
      if(resultEl) resultEl.innerHTML = 'Ingresa una función';
      if(stepsEl) stepsEl.innerHTML = '';
      return;
    }

    try {
      // 1) tokenize & parse
      const tokens = tokenize(expr);
      const ast = parseExpression(tokens);

      // 2) derive with detailed steps
      const { derived, steps } = deriveDetailed(ast, variable);

      // 3) simplify derived tree (basic)
      const simplified = simplify(derived);

      // 4) render steps (but we want "very detailed": show intermediate strings)
      // The deriveDetailed already produces many steps. We'll also add final simplification step:
      // push final simplification as last step
      const finalTex = nodeToTex(simplified);
      const finalStep = {
        rule: 'Simplificación final',
        beforeTex: nodeToTex(derived),
        afterTex: finalTex,
        note: 'Se aplicaron simplificaciones básicas (constantes, 0, 1, combinaciones sencillas).'
      };
      // append final step to steps array copy for display
      const stepsForDisplay = steps.concat([finalStep]);
      renderSteps(stepsForDisplay);

      // 5) Render result
      clearChildren(resultEl);
      safeRenderTex(resultEl, finalTex);
      // set zoom
      $('resultado').style.fontSize = (zoomLevel/100) + 'em';

      // 6) also show preview as original TeX
      if(previewEl){
        try {
          const previewTex = previewExprToTex(expr);
          safeRenderTex(previewEl, previewTex);
        } catch(e){
          previewEl.textContent = '';
        }
      }

    } catch(e){
      console.error('Error en derivación:', e);
      if(resultEl) resultEl.innerHTML = 'Error al procesar la expresión';
      if(stepsEl) stepsEl.innerHTML = '';
    }
  });
}

// ---------------------------
// Quick debug helpers: show tokenizer/ast if called in console
// ---------------------------
window._debug = {
  tokenize,
  parseExpression,
  nodeToTex,
  deriveDetailed,
  simplify
};

// ---------------------------
// On load: attach preview if missing, and create keyboard area container if not present
// ---------------------------
(function ensureUI(){
  if(!$('preview') && $('funcion')){
    const p = document.createElement('div'); p.id='preview'; p.className='preview'; $('funcion').after(p);
  }
  if(!$('steps')){
    const s = document.createElement('div'); s.id='steps'; s.className='steps'; 
    const res = $('resultado')||document.createElement('div');
    if(res.nextSibling) res.parentNode.insertBefore(s, res.nextSibling);
    else res.parentNode.appendChild(s);
  }
  if(!$('keyboard-area')){
    const kb = document.createElement('div'); kb.id='keyboard-area'; kb.className='keyboard-area';
    const func = $('funcion');
    if(func) func.parentNode.insertBefore(kb, func.nextSibling);
    // create quick buttons now that container exists
    // (re-run creation for safety)
    // small delay to ensure DOM stable
    setTimeout(() => { 
      // recreate only if empty
      if(kb && kb.children.length === 0){
        const sampleKeys = ['^','x','*','+','-','/','(',')','sin(','cos(','tan(','ln(','sqrt('];
        const row = document.createElement('div'); row.className='kbd-row';
        sampleKeys.forEach(k => {
          const b = document.createElement('button'); b.type='button'; b.className='kbd-btn'; b.textContent = k;
          b.addEventListener('click', () => {
            const input = $('funcion');
            if(!input) return;
            const start = input.selectionStart, end = input.selectionEnd;
            const val = input.value;
            input.value = val.slice(0,start) + k + val.slice(end);
            const pos = start + k.length;
            input.setSelectionRange(pos,pos);
            input.focus();
            triggerPreview();
          });
          row.appendChild(b);
        });
        kb.appendChild(row);
      }
    }, 50);
  }
})();

document.addEventListener("DOMContentLoaded", () => { const f = $('funcion'); if (f) { f.addEventListener("input", () => { triggerPreview(); }); } });

// Mostrar/Ocultar menú
const toggleBtn = document.getElementById('settings-toggle');
const settingsContent = document.getElementById('settings-content');
toggleBtn.addEventListener('click', () => {
  settingsContent.style.display = (settingsContent.style.display === 'block') ? 'none' : 'block';
});


console.log('App.js (derivación con pasos detallados) cargado.');
