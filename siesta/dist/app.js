import { KEYWORDS } from './language.js';
import { examples } from './examples.js';
const $ = id => document.getElementById(id);
const editor = $('editor');
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current = examples[0].id, lastResult = null, activeTab = 'variables', worker = null, runTimer, toastTimer, lastCode = '', storageOK = true;
try { const saved = JSON.parse(localStorage.getItem('siesta.workspace.v1') || 'null'); if (saved && typeof saved.code === 'string' && saved.code.length <= 50000) { current = examples.some(e => e.id === saved.current) ? saved.current : 'nuevo'; editor.value = saved.code; } else editor.value = examples[0].code; } catch { storageOK = false; editor.value = examples[0].code; }
function save() { try { localStorage.setItem('siesta.workspace.v1', JSON.stringify({ current, code: editor.value })); storageOK = true; } catch { storageOK = false; } $('save-status').textContent = storageOK ? 'Guardado en este navegador' : 'Guardado local no disponible'; }
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 2600); }
function renderExamples() {
  $('examples').innerHTML = examples.map(e => `<button class="example ${current === e.id ? 'active' : ''}" data-example="${e.id}" ${current === e.id ? 'aria-current="true"' : ''}><span class="number">${e.badge}</span><span><strong>${e.title}</strong><small>${e.subtitle}</small></span></button>`).join('');
  $('file-name').textContent = `${current}.zzz`;
}
function highlight() {
  const code = editor.value, re = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[\p{L}_][\p{L}\p{N}_]*|[+*/%=<>!\-]+/gu;
  let html = '', at = 0;
  for (const m of code.matchAll(re)) {
    const s = m[0]; html += escape(code.slice(at, m.index));
    const type = s.startsWith('#') ? 'comment' : /^["']/.test(s) ? 'string' : /^\d/.test(s) ? 'number' : KEYWORDS.has(s) ? 'keyword' : ['largo','texto','numero','redondea','energia'].includes(s) ? 'builtin' : /^[+*/%=<>!\-]/.test(s) ? 'operator' : '';
    html += type ? `<span class="tok-${type}">${escape(s)}</span>` : escape(s); at = m.index + s.length;
  }
  $('highlight').innerHTML = html + escape(code.slice(at)) + '\n';
  $('line-numbers').innerHTML = Array.from({length:code.split('\n').length}, (_, i) => `<div${lastResult?.error?.line === i + 1 && code === lastCode ? ' class="error-line"' : ''}>${i + 1}</div>`).join('');
  syncScroll(); cursor();
}
function syncScroll() { $('highlight').scrollTop = editor.scrollTop; $('highlight').scrollLeft = editor.scrollLeft; $('line-numbers').scrollTop = editor.scrollTop; }
function cursor() { const parts = editor.value.slice(0,editor.selectionStart).split('\n'); $('cursor-position').textContent = `Lín ${parts.length}, Col ${parts.at(-1).length + 1}`; }
function changed() { highlight(); save(); $('edited-dot').hidden = editor.value === lastCode; if (editor.value !== lastCode) { $('result-status').textContent = 'Cambios sin ejecutar'; $('result-status').className = 'result-status stale'; } }
function stopWorker() { if(worker) worker.terminate(); worker = null; clearTimeout(runTimer); $('run').disabled = false; $('run').innerHTML = '<span>▶</span> Ejecutar <kbd>Ctrl ↵</kbd>'; }
function execute() {
  stopWorker(); lastCode = editor.value; $('run').disabled = true; $('run').textContent = 'Ejecutando…'; $('result-status').className = 'result-status'; $('result-status').textContent = 'Ejecutando';
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({data}) => { stopWorker(); lastResult = data; renderResult(); highlight(); if (editor.value !== lastCode) changed(); };
    worker.onerror = () => { stopWorker(); runtimeFailure('No se pudo iniciar el intérprete. Abre el playground desde un servidor HTTP, no como archivo local.'); };
    worker.postMessage({ code: lastCode });
    runTimer = setTimeout(() => { stopWorker(); runtimeFailure('La ejecución ha superado 3 segundos y se ha detenido. Revisa los bucles o reduce el programa.'); }, 3000);
  } catch { stopWorker(); runtimeFailure('Este navegador no permite iniciar el intérprete en un Web Worker.'); }
}
function runtimeFailure(message) { lastResult = { error: { message, phase:'Playground', line:1, column:1 }, output:[], tokens:[], ast:null, variables:[], events:[], energy:0, capacity:40, rests:0, steps:0, duration:0 }; renderResult(); }
function renderResult() {
  const r = lastResult; $('edited-dot').hidden = editor.value === lastCode;
  $('result-status').textContent = r.error ? 'Hay algo que revisar' : 'Todo en orden'; $('result-status').className = `result-status${r.error ? ' error' : ''}`;
  $('console-output').innerHTML = r.output.map(v => `<div class="output-line"><span class="output-arrow">›</span><span class="output-value">${escape(v)}</span></div>`).join('') + (r.error ? `<div class="error-message"><strong>${escape(r.error.phase)}</strong> · ${escape(r.error.message)}<button id="jump-error">Ir a línea ${r.error.line}, columna ${r.error.column} ↗</button></div>` : r.output.length ? '' : '<span class="muted-output">Programa terminado. Usa chiva para escribir aquí.</span>');
  $('jump-error')?.addEventListener('click', () => { if (editor.value !== lastCode) { toast('El código ha cambiado. Ejecuta de nuevo para localizar el error.'); return; } const lines = editor.value.split('\n'), idx = lines.slice(0,r.error.line-1).reduce((a,l) => a+l.length+1,0) + r.error.column-1; editor.focus(); editor.setSelectionRange(idx,idx); editor.scrollTop = Math.max(0,(r.error.line - 3) * parseFloat(getComputedStyle(editor).lineHeight)); syncScroll(); cursor(); });
  $('console-output').scrollTop = 0;
  $('run-summary').textContent = `${r.output.length} ${r.output.length === 1 ? 'salida' : 'salidas'} · ${r.steps.toLocaleString('es')} pasos internos`;
  $('duration').textContent = `${r.duration.toFixed(1)} ms`;
  $('energy-value').innerHTML = `${r.energy} <small>/ ${r.capacity}</small>`;
  $('battery-bar').innerHTML = Array.from({length:16}, (_,i) => `<span class="battery-segment ${i < Math.ceil(r.energy/r.capacity*16) ? 'filled' : ''}"></span>`).join('');
  $('rest-count').textContent = r.rests;
  $('battery-state').textContent = r.energy === 0 ? 'NECESITA UNA SIESTA' : r.energy/r.capacity < .25 ? 'A MEDIO BOSTEZO' : 'CON ENERGÍA';
  document.querySelector('.battery-card').classList.toggle('empty',r.energy === 0);
  renderInspector();
}
function astHtml(value, label = '', depth = 0) {
  if (value === null || typeof value !== 'object') return `<div class="ast-leaf">${label ? `${escape(label)}: ` : ''}<span>${escape(JSON.stringify(value))}</span></div>`;
  if (depth > 45) return '<div class="ast-leaf">… árbol demasiado profundo para mostrar</div>';
  const title = Array.isArray(value) ? `${label} [${value.length}]` : `${label ? label + ': ' : ''}${value.type || 'Nodo'}${value.loc ? ` · L${value.loc.line}` : ''}`;
  const entries = Array.isArray(value) ? value.map((v,i) => [i,v]) : Object.entries(value).filter(([k]) => k !== 'type' && k !== 'loc');
  return `<details ${depth < 3 ? 'open' : ''}><summary>${escape(title)}</summary>${entries.map(([k,v]) => astHtml(v,String(k),depth+1)).join('')}</details>`;
}
function renderInspector() {
  const r = lastResult, body = $('inspector-body'); body.setAttribute('aria-labelledby',`tab-${activeTab}`);
  if (!r) { body.innerHTML = '<p class="empty-inspector">Ejecuta tu código para ver cómo funciona por dentro.</p>'; return; }
  if(activeTab === 'variables') body.innerHTML = r.variables.length ? `<table><thead><tr><th>NOMBRE</th><th>TIPO</th><th>VALOR</th></tr></thead><tbody>${r.variables.map(v=>`<tr><td>${escape(v.name)}</td><td><span class="type-badge">${v.type}</span></td><td class="variable-value">${escape(v.value)}</td></tr>`).join('')}</tbody></table><p class="inspector-help">Variables del ámbito global al terminar.<br>Las de cada bloque se quedan en su bloque.</p>` : '<p class="empty-inspector">Todavía no hay variables globales.<br>Prueba con <code>pon nombre = "Ana";</code></p>';
  if(activeTab === 'tokens') body.innerHTML = `<p class="token-count">${r.tokens.length} tokens · incluye EOF${r.tokens.length > 1500 ? ' · mostrando los primeros 1.500' : ''}</p><table class="token-list"><thead><tr><th>LEXEMA</th><th>TIPO</th><th>LÍN:COL</th></tr></thead><tbody>${r.tokens.slice(0,1500).map(t=>`<tr><td>${escape(t.raw || '∎')}</td><td><span class="type-badge">${t.type}</span></td><td>${t.line}:${t.column}</td></tr>`).join('')}</tbody></table>`;
  if(activeTab === 'ast') body.innerHTML = r.ast ? `<div class="ast-tree">${astHtml(r.ast)}</div>` : '<p class="empty-inspector">No hay árbol: primero hay que corregir el código.</p>';
  if(activeTab === 'trace') body.innerHTML = r.events.length ? r.events.map(e=>`<div class="trace-row ${e.kind}"><strong>LÍNEA ${e.line} · ${e.energy} PILAS</strong><span>${escape(e.text)}</span></div>`).join('') + '<p class="inspector-help">Cambios de variables, salidas, recetas y descansos. Máximo: 400 eventos.</p>' : '<p class="empty-inspector">Sin eventos de ejecución todavía.</p>';
}
function loadExample(id) { current = id; editor.value = examples.find(e=>e.id === id)?.code ?? '# Una idea nueva. Sin ninguna prisa.\n\nchiva "Hola, Siesta";\n'; editor.scrollTop = 0; editor.scrollLeft = 0; renderExamples(); changed(); execute(); }
$('examples').addEventListener('click', e => { const button = e.target.closest('[data-example]'); if(button) loadExample(button.dataset.example); });
$('new-program').addEventListener('click',()=>{loadExample('nuevo');editor.focus();});
$('run').addEventListener('click',execute);
$('reset').addEventListener('click',()=>{loadExample(current);toast('Ejemplo restablecido. A empezar de nuevo.');});
$('clear-console').addEventListener('click',()=>{$('console-output').replaceChildren();$('run-summary').textContent='Consola limpia';$('duration').textContent='';toast('Consola limpia');});
$('download').addEventListener('click',()=>{const blob=new Blob([editor.value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${current}.zzz`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Programa descargado');});
editor.addEventListener('input',changed);editor.addEventListener('scroll',syncScroll);editor.addEventListener('click',cursor);editor.addEventListener('keyup',cursor);editor.addEventListener('select',cursor);
editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;editor.setRangeText('  ',start,end,'end');changed();}if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const start=editor.selectionStart,line=editor.value.slice(0,start).split('\n').at(-1),indent=line.match(/^\s*/)[0]+(line.trimEnd().endsWith('{')?'  ':'');editor.setRangeText('\n'+indent,start,editor.selectionEnd,'end');changed();}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!$('guide').open){e.preventDefault();execute();}});
for(const b of document.querySelectorAll('[data-tab]')) { b.addEventListener('click',()=>{activeTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(t=>{t.setAttribute('aria-selected',String(t===b));t.tabIndex=t===b?0:-1;});renderInspector();}); b.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[data-tab]')];let next;if(e.key==='ArrowRight') next=(tabs.indexOf(b)+1)%tabs.length;if(e.key==='ArrowLeft')next=(tabs.indexOf(b)+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();tabs[next].focus();tabs[next].click();}});b.tabIndex=b.getAttribute('aria-selected')==='true'?0:-1; }
for(const id of ['guide-nav','concept-guide','short-guide']) $(id).addEventListener('click',()=>$('guide').showModal());
for(const id of ['close-guide','guide-done']) $(id).addEventListener('click',()=>$('guide').close());
$('guide').addEventListener('click',e=>{if(e.target===$('guide')){const r=$('guide').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('guide').close();}});
$('playground-nav').addEventListener('click',()=>{if($('guide').open)$('guide').close();editor.focus();});
renderExamples();highlight();save();execute();
