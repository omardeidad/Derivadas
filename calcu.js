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
        katex.render(tex, container, { throwOnError: false });
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
// TECLADO RÁPIDO (botones)
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
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const val = input.value;
        const insert = (k === '^2') ? '^2' : (k === '^3' ? '^3' : k);
        input.value = val.slice(0,start) + insert + val.slice(end);
        const pos = start + insert.length;
        input.setSelectionRange(pos,pos);
        input.focus();
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
// VISTA PREVIA: convierte a TeX
// ---------------------------
function previewExprToTex(expr) {
    try {
        if (window.math && typeof math.parse === "function") {
            const node = math.parse(expr);
            return node.toTex({ parenthesis: "auto" });
        }
    } catch (e) {}
    let tex = expr;
    tex = tex.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, "\\frac{$1}{$2}");
    tex = tex.replace(/([A-Za-z0-9]+)\^([0-9]+)/g, "$1^{ $2 }");
    return tex;
}

function triggerPreview() {
    const input = $('funcion');
    const preview = $('preview');
    if (!input || !preview) return;
    const txt = input.value.trim();
    if (txt === "") { preview.innerHTML = ""; return; }
    try {
        let tex = previewExprToTex(txt);
        tex = tex.replace(/^\\\(/, "").replace(/\\\)$/, "");
        tex = tex.replace(/^\\\[/, "").replace(/\\\]$/, "");
        safeRenderTex(preview, tex);
    } catch (e){
        preview.textContent = "Expresión inválida";
    }
}

// ---------------------------
// LEXER / TOKENIZER
// ---------------------------
function tokenize(input){
  let raw = [];
  let i = 0;
  const isDigit = c => /\d/.test(c);
  const isLetter = c => /[a-zA-Z]/.test(c);

  while(i < input.length){
    let c = input[i];
    if(c === ' '){ i++; continue; }
    if(isDigit(c) || (c === '.' && isDigit(input[i+1]))){
      let num = c; i++;
      while(i < input.length && (isDigit(input[i]) || input[i] === '.')) num += input[i++];
      raw.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    if(isLetter(c)){
      let name = c; i++;
      while(i < input.length && isLetter(input[i])) name += input[i++];
      raw.push({ type: 'name', value: name });
      continue;
    }
    if("+-*/^()".includes(c)){
      raw.push({ type: c }); i++; continue;
    }
    throw new Error('Carácter inválido en input: ' + c);
  }

  const tokens = [];
  function isPrimary(t){ return t.type === 'number' || t.type === 'name' || t.type === ')'; }
  function isFollowingPrimary(t){ return t.type === 'number' || t.type === 'name' || t.type === '('; }
  for(let j=0;j<raw.length;j++){
    const t = raw[j]; const next = raw[j+1];
    tokens.push(t);
    if(!next) continue;
    if(isPrimary(t) && isFollowingPrimary(next)){ tokens.push({ type: '*' }); }
  }
  return tokens;
}

// ---------------------------
// PARSER → AST
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
      if(peek() && peek().type === '('){
        consume('(');
        const inside = parseAddSub();
        consume(')');
        return { type: 'func', name: t.value, arg: inside };
      }
      return { type: 'var', name: t.value };
    }
    if(t.type === '('){ consume('('); const ex = parseAddSub(); consume(')'); return ex; }
    throw new Error('Token inválido en primary: ' + t.type);
  }
  function parseUnary(){
    if(peek() && peek().type === '-'){ consume('-'); return { type: 'neg', value: parseUnary() }; }
    return parsePrimary();
  }
  function parsePow(){ let left = parseUnary(); while(peek() && peek().type === '^'){ consume('^'); const right = parseUnary(); left = { type: 'pow', left, right }; } return left; }
  function parseMulDiv(){ let left = parsePow(); while(peek() && (peek().type === '*' || peek().type === '/')){ const op = peek().type; consume(op); const right = parsePow(); left = { type: op, left, right }; } return left; }
  function parseAddSub(){ let left = parseMulDiv(); while(peek() && (peek().type === '+' || peek().type === '-')){ const op = peek().type; consume(op); const right = parseMulDiv(); left = { type: op, left, right }; } return left; }
  return parseAddSub();
}

// ---------------------------
// TO-TEX
// ---------------------------
function nodeToTex(node){
  if(!node) return '';
  if(node.tex) return node.tex;
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
// SIMPLIFICADOR + COMBINACIÓN DE FACTORES
// ---------------------------
function flattenProduct(node) {
    if(node.type !== '*') return [node];
    return [...flattenProduct(node.left), ...flattenProduct(node.right)];
}

function combineLikeTerms(factors) {
    let coef = 1;
    const powers = {};
    factors.forEach(f => {
        if(f.type==='num') coef *= f.value;
        else if(f.type==='var') powers[f.name] = (powers[f.name]||0)+1;
        else if(f.type==='pow' && f.left.type==='var' && f.right.type==='num') powers[f.left.name] = (powers[f.left.name]||0)+f.right.value;
    });
    const result = [];
    if(coef !== 1) result.push({type:'num',value:coef});
    Object.keys(powers).forEach(v => {
        const exp = powers[v];
        if(exp===1) result.push({type:'var',name:v});
        else result.push({type:'pow',left:{type:'var',name:v}, right:{type:'num',value:exp}});
    });
    return result.reduce((acc,f)=>{
        if(!acc) return f;
        return {type:'*', left:acc, right:f};
    }, null);
}

function simplify(node){
  function rec(n){
    if(!n) return n;
    switch(n.type){
      case 'num': case 'var': return n;
      case 'neg': { const v = rec(n.value); if(v.type==='num') return {type:'num',value:-v.value}; return {type:'neg',value:v}; }
      case '+': { const L=rec(n.left), R=rec(n.right); if(L.type==='num'&&L.value===0) return R; if(R.type==='num'&&R.value===0) return L; if(L.type==='num'&&R.type==='num') return {type:'num',value:L.value+R.value}; return {type:'+',left:L,right:R}; }
      case '-': { const L=rec(n.left), R=rec(n.right); if(R.type==='num'&&R.value===0) return L; if(L.type==='num'&&R.type==='num') return {type:'num',value:L.value-R.value}; return {type:'-',left:L,right:R}; }
      case '*': {
        const L=rec(n.left), R=rec(n.right);
        let factors = flattenProduct({type:'*',left:L,right:R}).map(rec);
        return combineLikeTerms(factors);
      }
      case '/': { const L=rec(n.left), R=rec(n.right); if(L.type==='num'&&L.value===0) return {type:'num',value:0}; if(R.type==='num'&&R.value===1) return L; return {type:'/',left:L,right:R}; }
      case 'pow': { const L=rec(n.left), R=rec(n.right); if(R.type==='num'&&R.value===0) return {type:'num',value:1}; if(R.type==='num'&&R.value===1) return L; return {type:'pow',left:L,right:R}; }
      case 'func': return {type:'func',name:n.name,arg:rec(n.arg)};
    }
  }
  return rec(node);
}

// ---------------------------
// DERIVACIÓN DETALLADA
// ---------------------------
// [Aquí conservarías todo tu código de deriveDetailed igual que antes]
// Solo debes llamar a simplify al derivar productos y potencias

// ---------------------------
// RENDER PASOS
// ---------------------------
function renderSteps(steps){
  const stepsEl = $('steps');
  if(!stepsEl) return;
  clearChildren(stepsEl);
  steps.forEach((s, idx) => {
    const div = document.createElement('div'); div.className='step';
    const title = document.createElement('div'); title.className='rule'; title.textContent=`${idx+1}. ${s.rule}`;
    const note = document.createElement('div'); note.className='note'; note.textContent=s.note||'';
    const beforeL=document.createElement('div'); beforeL.className='label'; beforeL.textContent='Antes:';
    const before=document.createElement('div'); before.className='expr'; safeRenderTex(before,s.beforeTex);
    const afterL=document.createElement('div'); afterL.className='label'; afterL.textContent='Después:';
    const after=document.createElement('div'); after.className='expr'; safeRenderTex(after,s.afterTex);
    div.appendChild(title); if(s.note) div.appendChild(note); div.appendChild(beforeL); div.appendChild(before); div.appendChild(afterL); div.appendChild(after);
    stepsEl.appendChild(div);
  });
}

// ---------------------------
// BOTÓN DERIVAR
// ---------------------------
if($('btn-derivar')){
  $('btn-derivar').addEventListener('click', () => {
    const expr = $('funcion')? $('funcion').value.trim() : '';
    const variable = $('variable')? $('variable').value : 'x';
    const previewEl = $('preview'); const resultEl = $('resultado'); const stepsEl = $('steps');
    if(!expr){ if(resultEl) resultEl.innerHTML='Ingresa una función'; if(stepsEl) stepsEl.innerHTML=''; return; }
    try{
      const tokens = tokenize(expr);
      const ast = parseExpression(tokens);
      const { derived, steps } = deriveDetailed(ast, variable);
      const simplified = simplify(derived);
      const finalTex = nodeToTex(simplified);
      const finalStep = { rule:'Simplificación final', beforeTex:nodeToTex(derived), afterTex:finalTex, note:'Se aplicaron simplificaciones básicas (constantes, 0, 1, combinaciones).' };
      renderSteps(steps.concat([finalStep]));
      clearChildren(resultEl); safeRenderTex(resultEl, finalTex);
      $('resultado').style.fontSize = (zoomLevel/100)+'em';
      if(previewEl){ try{ safeRenderTex(previewEl, previewExprToTex(expr)); }catch(e){ previewEl.textContent=''; } }
    }catch(e){ console.error('Error:',e); if(resultEl) resultEl.innerHTML='Error'; if(stepsEl) stepsEl.innerHTML=''; }
  });
}

console.log('App.js corregido cargado.');
