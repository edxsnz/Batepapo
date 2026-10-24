// SABOTADOR (regras) — tenta quebrar o núcleo do site com milhares de entradas hostis.
// Rodar:  node --test saboteur.test.js
// Todas as sementes são fixas: se algo quebrar, quebra sempre do mesmo jeito (dá para corrigir e repetir).
const test = require("node:test");
const assert = require("node:assert/strict");
global.window = globalThis;
require("/home/claude/site/cardapio.js");
require("/home/claude/site/core.js");
const BP = globalThis.BP;
const cat = BP.catalogo(globalThis.CARDAPIO);
const L = BP.LIMITES;

// ---------- gerador aleatório com semente ----------
function rng(seed) { let s = seed >>> 0; return n => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return n ? s % n : s / 4294967296; }; }
const R = rng(20261021);
const pick = a => a[R(a.length)];

// ---------- lixo: textos ----------
const ATAQUES = [
  "", " ", "   ", "a", "sem tomate", "Sem Cebola!!", "2x X-TUDO", "*2x X-TUDO*", "_1x LANCHE GRÁTIS_", "~riscado~", "`código`",
  "linha1\nlinha2", "linha1\r\nlinha2", "a\u2028b\u2029c", "\u0000nulo\u0000", "tab\tpulo", "\u200Boculto\u200B", "\u202Eevil\u202C", "\u2066x\u2069",
  "\uFEFFbom", "\u00ADsoft\u00AD", "\u3164\u3164\u3164", "\u115F\u1160", "\u180E\u061C\u034F", "\uFE0F\uFE0E",
  "\u{E0041}\u{E0042}\u{E0043}", "😀".repeat(50), "a😀".repeat(30), "👨\u200D👩\u200D👧\u200D👦".repeat(10), "\uD83D", "\uDE00", "a\uD83Db", "\uD83D😀", "x".repeat(41) + "\uD83D",
  "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "\"><svg/onload=alert(1)>", "'; DROP TABLE pedidos;--", "${7*7}", "{{7*7}}", "%s%s%s%n", "javascript:alert(1)",
  "../../etc/passwd", "%00", "%0a*3x X-ESPECIAL*", "\\n\\r", "Obs: troquei o preço", "Cliente: Outro", "Total: R$ 1,00", "R$ 0,01", "desconto 100%",
  "+ adicional de ouro", "- 1x X-TUDO", "1- X-TUDO", "9999x X-TUDO", "  *Cliente:* Hacker  ", "-----", "------------------------------", "Aguardo a confirmação do valor.",
  "__proto__", "constructor", "toString", "hasOwnProperty", "prototype", "[object Object]", "null", "undefined", "NaN", "Infinity", "-0", "0", "1e999",
  "ÀÉÎÕÜ çÇ ñ", "ǅ ǈ ǋ", "İstanbul", "ﬃ ﬁ ﬂ", "Å Å", "é́́́́", "Z͑ͫ̓ͪ̂ͫ̽\u034F̴̙̤̞͉͚̯̞̠͍", "مرحبا بالعالم", "שלום עולם", "こんにちは", "한국어", "🇧🇷🇧🇷",
  "a".repeat(200), "a ".repeat(500), " ".repeat(100000) + "x", "*".repeat(5000), "\n".repeat(3000), "a\n".repeat(500), "\u202E".repeat(2000)
];
const lixoTexto = () => R(4) ? pick(ATAQUES) : Array.from({ length: R(8) }, () => pick(ATAQUES)).join(pick(["", " ", "\n"]));
const ids = Object.values(cat.itens).map(i => i.id);
const idsLanche = cat.lista.map(i => i.id), idsAdd = cat.adicionais.map(i => i.id);
const lixoId = () => R(3) ? pick(R(3) ? idsLanche : ids) : pick(["__proto__", "constructor", "toString", "hasOwnProperty", "", "x/y", 5, null, undefined, {}, [], [idsLanche[0]], { toString: 0 }, true, NaN]);
const lixoNum = () => pick([1, 2, 3, 5, 10, 29, 30, 31, 60, 61, 1e9, -1, 0, 0.5, 1.9, "3", "abc", "", " 4 ", null, undefined, NaN, Infinity, -Infinity, [], [2], {}, true, false, "0x10", "1e2", 1e-9]);
function lixoLinha() {
  const l = { id: lixoId(), qtd: lixoNum() };
  if (R(2)) l.adds = R(5) ? Array.from({ length: R(5) }, () => R(3) ? pick(idsAdd) : lixoId()) : pick([null, "bacon", 5, {}, { length: 3 }, "complementos/bacon"]);
  if (R(2)) l.obs = lixoTexto();
  if (R(6) === 0) l.preco = pick([0, 0.01, -5, "0"]);
  if (R(8) === 0) l.__proto__ = { id: idsLanche[0], qtd: 5 };
  if (R(8) === 0) l.constructor = { prototype: { polluted: true } };
  return R(12) ? l : pick([null, undefined, 5, "texto", [], [l], true, () => 1]);
}
const lixoSacola = () => R(15) ? Array.from({ length: pick([0, 1, 2, 3, 5, 10, 41, 100]) }, lixoLinha) : pick([null, undefined, "lixo", 7, {}, { length: 5 }, { 0: lixoLinha(), length: 1 }, true, [[[]]]]);

// ---------- invariantes que NUNCA podem quebrar ----------
const PROIBIDOS = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF*_~`\n\r]/u;
function invariantes(s, rotulo) {
  assert.ok(Array.isArray(s), rotulo + ": não é lista");
  assert.ok(s.length <= L.linhas, rotulo + ": linhas demais");
  assert.ok(BP.contar(s) <= L.itensSacola, rotulo + ": itens demais " + BP.contar(s));
  const chaves = new Set();
  for (const l of s) {
    assert.equal(typeof l.id, "string", rotulo + ": id não é texto");
    assert.ok(cat.itens[l.id] && cat.itens[l.id].tipo !== "adicional", rotulo + ": id inválido " + l.id);
    assert.ok(Number.isInteger(l.qtd) && l.qtd >= 1 && l.qtd <= L.qtdItem, rotulo + ": qtd inválida " + l.qtd);
    assert.ok(Array.isArray(l.adds) && l.adds.every(a => typeof a === "string" && cat.itens[a] && cat.itens[a].tipo === "adicional"), rotulo + ": adicional inválido");
    assert.equal(new Set(l.adds).size, l.adds.length, rotulo + ": adicional repetido");
    if (cat.itens[l.id].tipo !== "lanche") assert.equal(l.adds.length, 0, rotulo + ": porção com adicional");
    assert.equal(typeof l.obs, "string");
    assert.ok([...l.obs].length <= L.obs, rotulo + ": obs longa");
    assert.ok(!PROIBIDOS.test(l.obs), rotulo + ": obs com caractere proibido " + JSON.stringify(l.obs));
    assert.ok(!/[\uD800-\uDFFF]/.test(l.obs.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")), rotulo + ": obs com surrogate solto");
    const k = BP.chave(l); assert.ok(!chaves.has(k), rotulo + ": linhas iguais não juntaram"); chaves.add(k);
    assert.deepEqual(Object.keys(l).sort(), ["adds", "id", "obs", "qtd"], rotulo + ": campos extras (" + Object.keys(l) + ")");
  }
}

test("SABOTADOR 1: 20.000 sacolas lixo — nunca estoura, sempre válida, nunca passa preço", () => {
  for (let i = 0; i < 20000; i++) {
    const bruta = lixoSacola();
    const s = BP.validarSacola(bruta, cat);
    invariantes(s, "#" + i);
    assert.deepEqual(BP.validarSacola(JSON.parse(JSON.stringify(s)), cat), s, "#" + i + ": validar duas vezes muda o resultado");
    // preço só vem do cardápio
    assert.equal(BP.totalSacola(s, cat), s.reduce((t, l) => t + (cat.itens[l.id].preco + l.adds.reduce((x, a) => x + cat.itens[a].preco, 0)) * l.qtd, 0));
  }
  assert.equal({}.polluted, undefined, "poluição de protótipo");
  assert.equal(Object.prototype.polluted, undefined);
});

test("SABOTADOR 2: nomes e observações hostis — mensagem sempre segura e a URL do WhatsApp nunca quebra", () => {
  for (let i = 0; i < 6000; i++) {
    const nome = lixoTexto(), obs = lixoTexto(), obs2 = lixoTexto();
    const s = BP.validarSacola([{ id: pick(idsLanche), qtd: 1 + R(3), adds: [pick(idsAdd)], obs }, { id: pick(idsLanche), qtd: 1, obs: obs2 }], cat);
    const m = BP.mensagem(s, nome, cat);
    assert.doesNotThrow(() => encodeURIComponent(m), "URL do WhatsApp quebra com nome/obs " + JSON.stringify(nome.slice(0, 60)) + " / " + JSON.stringify(obs.slice(0, 60)));
    if (!/R\$/.test(nome + obs + obs2)) assert.ok(!/R\$/.test(m), "o site gerou preço na mensagem sozinho");   // preço escrito pelo cliente ("troco p/ R$ 50") é problema dele, não do site
    assert.ok(!/[\u202A-\u202E\u2066-\u2069\u200B-\u200F\u2028\u2029\u0000]/.test(m), "mensagem com caractere de controle/bidi");
    const cliente = m.split("\n").find(l => l.startsWith("*Cliente:*"));
    assert.ok(cliente, "sem linha de cliente");
    const r = BP.lerMensagem(m, cat);
    assert.equal(r.total, BP.totalSacola(s, cat), "conferência diverge do site com nome=" + JSON.stringify(nome.slice(0, 50)) + " obs=" + JSON.stringify(obs.slice(0, 50)));
    assert.equal(r.estranhas.length, 0, "linha estranha numa mensagem legítima: " + JSON.stringify(r.estranhas) + " nome=" + JSON.stringify(nome.slice(0, 40)));
    assert.equal(r.linhas.length, s.length ? r.linhas.length : 0);
  }
});

test("SABOTADOR 3: limpar() — sem caractere invisível, sem formatação, sem lixo de emoji cortado", () => {
  for (const t of ATAQUES) for (const max of [1, 2, 3, 5, 40, 80]) {
    const o = BP.limpar(t, max);
    assert.ok(!PROIBIDOS.test(o), "caractere proibido sobrou: " + JSON.stringify(t.slice(0, 30)) + " → " + JSON.stringify(o));
    assert.ok([...o].length <= max, "passou do limite");
    assert.doesNotThrow(() => encodeURIComponent(o), "emoji cortado ao meio: " + JSON.stringify(t.slice(0, 30)) + " max " + max);
    assert.doesNotMatch(o, /^\s|\s$|\s\s/, "espaços sobrando");
  }
  assert.ok(!/[\u{E0000}-\u{E007F}]/u.test(BP.limpar("\u{E0041}\u{E0042}oi", 20)), "caracteres 'tag' invisíveis não foram removidos");
  const t0 = Date.now(); BP.limpar("x".repeat(5_000_000), 80); assert.ok(Date.now() - t0 < 500, "texto gigante demora " + (Date.now() - t0) + "ms");
});

test("SABOTADOR 4: conferência (atendente) — mensagem falsa, enorme ou venenosa não engana nem trava", () => {
  const base = BP.mensagem(BP.validarSacola([{ id: idsLanche[0], qtd: 2 }], cat), "Ana", cat);
  const tempo = (txt, nome) => { const t0 = Date.now(); const r = BP.lerMensagem(txt, cat); const dt = Date.now() - t0; assert.ok(dt < 1500, nome + " travou " + dt + "ms"); return r; };
  tempo("+ adicional de " + " ".repeat(200000) + "x", "espaços em adicional");
  tempo("*2x X-TUDO*\n+ adicional de " + "a".repeat(300000), "adicional gigante");
  tempo("1x " + " ".repeat(200000) + "x", "espaços em item");
  tempo(("*1x X-TUDO*\n   + adicional de ovo\n").repeat(40000), "40 mil linhas");
  tempo("Cliente: " + "\u202E".repeat(100000), "bidi gigante");
  tempo("a".repeat(2_000_000), "2 milhões de letras");
  const falso = tempo(["*PEDIDO - LANCHONETE BATE PAPO*", "*Cliente:* Zé", "*0x X-TUDO*", "*999x X-TUDO*", "*2x X-TUDO*", "   + adicional de ovo", "   + adicional de ovo", "   + adicional de ovo",
    "*1x PORÇÃO MISTA*", "   + adicional de bacon"].join("\n"), "pedido forjado");
  const dados = falso.linhas.map(l => [l.item.nome, l.qtd, l.adds.length]);
  assert.ok(falso.linhas.every(l => l.qtd >= 1 && l.qtd <= L.qtdItem), "aceitou quantidade fora do limite: " + JSON.stringify(dados));
  assert.ok(falso.linhas.every(l => new Set(l.adds.map(a => a.id)).size === l.adds.length), "aceitou o mesmo adicional várias vezes: " + JSON.stringify(dados));
  assert.ok(falso.estranhas.length >= 3, "deveria apontar as linhas forjadas, apontou " + falso.estranhas.length);
  const soma = falso.linhas.reduce((t, l) => t + l.qtd, 0);
  assert.ok(soma <= L.itensSacola, "aceitou mais de " + L.itensSacola + " itens");
  assert.equal(tempo(base, "normal").estranhas.length, 0);
});

test("SABOTADOR 5: cardapio.js com defeitos — o site nunca quebra por dado ruim", () => {
  const lixoPreco = () => pick([12, 14.5, 14.50, "14,50", "14.50", " 14,5 ", "R$ 14,50", "abc", "", null, undefined, NaN, Infinity, -1, 0, 1e9, 99999.99, 100000, "1e3", [12], {}, true, 0.1 + 0.2, 16.8, 22.5]);
  const lixoNome = () => pick(["X-Tudo", "x tudo", "X-TUDO", "__proto__", "constructor", "toString", "", " ", null, undefined, 5, { a: 1 }, "<b>negrito</b>", "😀", "A".repeat(500), "Ovo", "*Nome*"]);
  const lixoItem = () => R(10) ? { nome: lixoNome(), preco: lixoPreco(), ingredientes: R(2) ? lixoTexto() : undefined, destaque: R(4) ? undefined : pick(["Especial", "", 5, "<i>x</i>"]) } : pick([null, undefined, 5, "x", [], { preco: 1 }]);
  const lixoCat = () => R(10) ? { categoria: pick(["Hambúrguer", "Complementos", "__proto__", "constructor", "", null, 7, "A".repeat(300), "Busca", "Menu", "Nome"]), icone: pick(["burger", "mais", "porcao", "constructor", "__proto__", "toString", undefined, 5, "<x>"]), subtitulo: R(2) ? lixoTexto() : undefined,
    itens: R(10) ? Array.from({ length: R(8) }, lixoItem) : pick([null, undefined, "x", {}, 5, { length: 3 }]) } : pick([null, undefined, 5, "x", []]);
  for (let i = 0; i < 4000; i++) {
    const dados = R(20) ? Array.from({ length: R(6) }, lixoCat) : pick([null, undefined, "x", 5, {}, [[]], true]);
    let c;
    assert.doesNotThrow(() => { c = BP.catalogo(dados); }, "catalogo estourou com " + String(JSON.stringify(dados)).slice(0, 200));
    const todos = Object.values(c.itens);
    assert.equal(new Set(todos.map(x => x.id)).size, todos.length);
    for (const it of todos) {
      assert.ok(Number.isInteger(it.preco) && it.preco >= 0 && it.preco < 10_000_000, "preço fora do normal " + it.preco);
      assert.ok(/^[a-z0-9-]*\/[a-z0-9-]*$/.test(it.id), "id estranho " + it.id);
    }
    // quem está em lista/adicionais precisa existir em itens (e vice-versa), sem item fantasma
    assert.equal(c.lista.length + c.adicionais.length, todos.length, "item some ou aparece duas vezes: " + String(JSON.stringify(dados)).slice(0, 300));
    const s = BP.validarSacola(Array.from({ length: 8 }, () => ({ id: pick(todos.length ? todos : [{ id: "x" }]).id, qtd: 2, adds: c.adicionais.slice(0, 2).map(a => a.id) })), c);
    assert.doesNotThrow(() => BP.lerMensagem(BP.mensagem(s, "x", c), c));
  }
  assert.equal(BP.catalogo([{ categoria: "A", itens: [{ nome: "Tudo", preco: "14,50" }] }]).lista.length, 1, 'preço escrito com vírgula ("14,50") deveria ser aceito');
  assert.equal(BP.catalogo([{ categoria: "A", itens: [{ nome: "Tudo", preco: "14,50" }] }]).lista[0]?.preco, 1450);
  assert.equal(BP.catalogo([{ categoria: "X", icone: "burger", itens: [{ nome: "Ovo", preco: 1 }] }, { categoria: "X", icone: "mais", itens: [{ nome: "Ovo", preco: 2 }] }]).lista.length +
    BP.catalogo([{ categoria: "X", icone: "burger", itens: [{ nome: "Ovo", preco: 1 }] }, { categoria: "X", icone: "mais", itens: [{ nome: "Ovo", preco: 2 }] }]).adicionais.length, 1, "mesmo id em dois tipos");
});

test("SABOTADOR 6: dinheiro — nenhum centavo se perde em nenhum valor possível", () => {
  for (let c = 0; c < 100000; c++) { assert.equal(BP.centavos(c / 100), c); }
  assert.equal(BP.centavos(16.8), 1680); assert.equal(BP.centavos(22.5), 2250); assert.equal(BP.centavos(0.1 + 0.2), 30); 
  for (const x of [-1, NaN, Infinity, "x", "", " ", null, undefined, {}, [], [5], true, false, 100000, 1e300, -0.0001, "1e3", "-5", "14,555"]) assert.equal(BP.centavos(x), null, "aceitou " + String(x));
  for (const [x, c] of [["14,50", 1450], ["14.50", 1450], [" R$ 14,5 ", 1450], ["12", 1200], [12, 1200], [0, 0]]) assert.equal(BP.centavos(x), c, "recusou " + x);
  assert.equal(BP.brl(1680), "R$ 16,80"); assert.equal(BP.brl(0), "R$ 0,00"); assert.equal(BP.brl(-5), "R$ 0,00"); assert.equal(BP.brl(NaN), "R$ 0,00");
  // maior pedido possível: 60 itens do mais caro com todos os adicionais
  const caro = Math.max(...cat.lista.map(i => i.preco)), adds = cat.adicionais.reduce((t, a) => t + a.preco, 0);
  assert.ok((caro + adds) * L.itensSacola < Number.MAX_SAFE_INTEGER);
});

test("SABOTADOR 7: dicas e texto livre — nenhuma frase do cliente trava ou estoura", () => {
  const it = cat.itens[idsLanche[0]];
  for (let i = 0; i < 3000; i++) {
    const t0 = Date.now();
    assert.doesNotThrow(() => BP.dicasObs(pick(cat.lista), R(2) ? [pick(idsAdd)] : [], lixoTexto(), R(40) - 3, !!R(2), cat));
    assert.ok(Date.now() - t0 < 300, "dica demorou " + (Date.now() - t0) + "ms");
  }
  assert.doesNotThrow(() => BP.frase({ id: it.id, qtd: 1, adds: [], obs: "" }, cat));
  const t0 = Date.now(); BP.dicasObs(it, [], "sem ".repeat(5000) + "x".repeat(5000), 3, true, cat); assert.ok(Date.now() - t0 < 1000, "dica com texto gigante demorou");
});

test("SABOTADOR 8: pedido máximo de verdade cabe numa URL do WhatsApp", () => {
  // 40 linhas, todas diferentes, com todos os adicionais e observação longa — o pior pedido possível
  const obsMax = "ç".repeat(L.obs);
  const bruta = cat.lista.slice(0, L.linhas).map((i, n) => ({ id: i.id, qtd: 1, adds: idsAdd, obs: obsMax.slice(0, L.obs - 3) + n }));
  const s = BP.validarSacola(bruta, cat);
  const url = "https://wa.me/551633823518?text=" + encodeURIComponent(BP.mensagem(s, "N".repeat(40), cat));
  const grande = BP.urlWhats("551633823518", BP.mensagem(s, "N".repeat(40), cat));
  console.log("   pior pedido: " + s.length + " linhas, " + grande.url.length + " caracteres na URL");
  assert.ok(grande.longo, "pedido enorme deveria acionar o aviso de link grande");
  const normal = BP.validarSacola([{ id: idsLanche[0], qtd: 2, adds: idsAdd.slice(0, 2), obs: "sem tomate" }, { id: idsLanche[1], qtd: 1 }, { id: idsLanche[2], qtd: 3, obs: "bem passado" }], cat);
  assert.ok(!BP.urlWhats("551633823518", BP.mensagem(normal, "Maria da Silva", cat)).longo, "pedido normal não pode acionar o aviso");
});
