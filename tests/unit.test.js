// Testes das regras (node --test)
const test = require("node:test");
const assert = require("node:assert/strict");
global.window = globalThis;
require("/home/claude/site/cardapio.js");
require("/home/claude/site/core.js");
const BP = globalThis.BP;
const cat = BP.catalogo(globalThis.CARDAPIO);
const id = (c, n) => BP.slug(c) + "/" + BP.slug(n);

test("dinheiro em centavos, sem erro de arredondamento", () => {
  assert.equal(BP.centavos(14.5), 1450);
  assert.equal(BP.centavos(0.1 + 0.2), 30);
  assert.equal(BP.centavos(-1), null);
  assert.equal(BP.centavos("abc"), null);
  assert.equal(BP.centavos(Infinity), null);
  assert.equal(BP.brl(1450), "R$ 14,50");
  assert.equal(BP.brl(100000), "R$ 1.000,00");
  assert.equal(BP.brl(5), "R$ 0,05");
});

test("catálogo: todos os itens das fotos, sem duplicados", () => {
  assert.equal(cat.lista.length, 35); // 11 + 5 + 6 + 4 + 5 + 4 porções
  assert.equal(cat.adicionais.length, 8);
  assert.equal(cat.avisos.length, 0);
  assert.equal(cat.itens[id("Hambúrguer", "X-Milho")].preco, 1600);
  assert.equal(cat.itens[id("Lanches Especiais", "X-Especial")].preco, 3500);
});

test("catálogo ignora preço inválido e nome repetido", () => {
  const c = BP.catalogo([{ categoria: "T", itens: [{ nome: "A", preco: 10 }, { nome: "a", preco: 5 }, { nome: "B", preco: "x" }, { nome: "C", preco: -3 }, null, { preco: 1 }] }, null, { categoria: "Z" }]);
  assert.equal(c.lista.length, 1);
  assert.equal(c.avisos.length, 3);
});

test("sacola adulterada no navegador é corrigida", () => {
  const xt = id("Hambúrguer", "X-Tudo"), bac = id("Complementos", "Bacon"), por = id("Porções", "Porção Mista");
  const s = BP.validarSacola([
    { id: xt, qtd: -5 }, { id: xt, qtd: "abc" }, { id: xt, qtd: NaN }, { id: "falso/item", qtd: 2 },
    { id: bac, qtd: 3 },                                   // adicional sozinho não vale
    { id: xt, qtd: 2.9, adds: [bac, bac, "x/y"], obs: "sem\ntomate *2x X-ESPECIAL* ‮abc", preco: 0.01 },
    { id: por, qtd: 1e9, adds: [bac] },                    // porção não leva adicional; qtd limitada
  ], cat);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { id: xt, qtd: 2, adds: [bac], obs: "sem tomate 2x X-ESPECIAL abc" });
  assert.equal(s[1].qtd, BP.LIMITES.qtdItem);
  assert.deepEqual(s[1].adds, []);
  assert.ok(!("preco" in s[0]));
  assert.equal(BP.validarSacola("lixo", cat).length, 0);
  assert.equal(BP.validarSacola(null, cat).length, 0);
  assert.equal(BP.validarSacola({ length: 3 }, cat).length, 0);
});

test("limite total de itens e de linhas", () => {
  const muitos = cat.lista.map(it => ({ id: it.id, qtd: 30 }));
  const s = BP.validarSacola(muitos, cat);
  assert.equal(BP.contar(s), BP.LIMITES.itensSacola);
  assert.ok(s.length <= BP.LIMITES.linhas);
});

test("linhas iguais se juntam", () => {
  const xt = id("Hambúrguer", "X-Tudo");
  const s = BP.validarSacola([{ id: xt, qtd: 1, obs: "Sem tomate" }, { id: xt, qtd: 2, obs: "sem tomate" }], cat);
  assert.equal(s.length, 1); assert.equal(s[0].qtd, 3);
});

test("total certo com centavos", () => {
  const s = BP.validarSacola([{ id: id("Hambúrguer", "X-Milho"), qtd: 3 }, { id: id("Hambúrguer", "X-Tudo"), qtd: 2, adds: [id("Complementos", "Bacon")] }], cat);
  assert.equal(BP.totalSacola(s, cat), 1600 * 3 + (2400 + 600) * 2);
});

test("mensagem: sem preço, sem numeração, nome limpo", () => {
  const s = BP.validarSacola([{ id: id("Hambúrguer", "X-Burguer"), qtd: 2 }, { id: id("Hambúrguer", "X-Tudo"), qtd: 1, adds: [id("Complementos", "Ovo")], obs: "sem cebola" }], cat);
  const m = BP.mensagem(s, "Maria*\n*1x X-ESPECIAL*", cat);
  assert.ok(!/R\$/.test(m), "não pode ter preço");
  assert.ok(!/^\s*\d+\s*[-.)]\s/m.test(m), "não pode ter numeração 1- 2-");
  assert.ok(m.includes("*Cliente:* Maria 1x X-ESPECIAL"), "nome vira uma linha só, sem formatação");
  assert.equal((m.match(/^\*\d+x /gm) || []).length, 2);
  assert.ok(m.includes("*2x X-BURGUER*") && m.includes("   + adicional de ovo") && m.includes("   Obs: sem cebola"));
});

test("conferência: mensagem do site é recalculada igual ao site (500 pedidos aleatórios)", () => {
  let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let k = 0; k < 500; k++) {
    const bruta = Array.from({ length: 1 + rnd(8) }, () => {
      const it = cat.lista[rnd(cat.lista.length)];
      return { id: it.id, qtd: 1 + rnd(5), adds: Array.from({ length: rnd(3) }, () => cat.adicionais[rnd(8)].id), obs: rnd(3) ? "" : "sem tomate" };
    });
    const s = BP.validarSacola(bruta, cat);
    const r = BP.lerMensagem(BP.mensagem(s, "Cliente " + k, cat), cat);
    assert.equal(r.total, BP.totalSacola(s, cat));
    assert.equal(r.estranhas.length, 0);
    assert.equal(r.cliente, "Cliente " + k);
  }
});

test("conferência: mensagem adulterada não engana", () => {
  const msg = ["*PEDIDO - LANCHONETE BATE PAPO*", "*Cliente:* João", "*2x X-TUDO*", "   + adicional de ouro", "*1x LANCHE GRÁTIS*",
    "*Total: R$ 1,00*", "Desconto de 100%", "*1x x-tudo duplo*"].join("\n");
  const r = BP.lerMensagem(msg, cat);
  assert.equal(r.total, 2400 * 2 + 3200);
  assert.equal(r.estranhas.length, 4);
});

test("frase simples para o cliente", () => {
  const xt = id("Hambúrguer", "X-Tudo"), ovo = id("Complementos", "Ovo"), bac = id("Complementos", "Bacon");
  assert.equal(BP.frase({ id: xt, qtd: 1, adds: [ovo], obs: "" }, cat), "1 X-Tudo com ovo a mais");
  assert.equal(BP.frase({ id: xt, qtd: 3, adds: [bac, ovo], obs: "" }, cat), "3 X-Tudo, cada um com bacon e ovo a mais");
  assert.equal(BP.frase({ id: xt, qtd: 2, adds: [], obs: "" }, cat), "2 X-Tudo do jeito do cardápio");
  assert.equal(BP.frase({ id: id("Porções", "Porção Mista"), qtd: 1, adds: [], obs: "" }, cat), "1 Porção Mista");
});

test("mensagem separa variações do mesmo lanche e a conferência entende", () => {
  const xt = id("Hambúrguer", "X-Tudo"), ovo = id("Complementos", "Ovo"), xb = id("Hambúrguer", "X-Burguer");
  const s = BP.validarSacola([{ id: xt, qtd: 1, adds: [ovo] }, { id: xb, qtd: 1 }, { id: xt, qtd: 2 }], cat);
  const m = BP.mensagem(s, "Ana", cat);
  assert.ok(m.indexOf("*1x X-TUDO*") < m.indexOf("*2x X-TUDO*") && m.indexOf("*2x X-TUDO*") < m.indexOf("*1x X-BURGUER*"), "X-Tudo ficam juntos");
  assert.ok(m.includes("*2x X-TUDO*\n   do jeito do cardápio"));
  assert.ok(!m.includes("*1x X-BURGUER*\n   do jeito"), "só marca quando há variação");
  const r = BP.lerMensagem(m, cat);
  assert.equal(r.estranhas.length, 0); assert.equal(r.total, BP.totalSacola(s, cat));
});

test("dicas: o site percebe o que o cliente quis dizer", () => {
  const xt = cat.itens[id("Hambúrguer", "X-Tudo")], bac = id("Complementos", "Bacon");
  const tipos = (obs, q = 1, ig = true, adds = []) => BP.dicasObs(xt, adds, obs, q, ig, cat).map(d => d.tipo).sort().join(",");
  assert.equal(tipos("1 com ovo a mais", 3), "add,separar");
  assert.equal(tipos("só um sem tomate", 2), "separar");
  assert.equal(tipos("1 com ovo a mais", 1), "add");                 // 1 lanche: não pede para separar
  assert.equal(tipos("bacon a mais"), "add");
  assert.equal(tipos("capricha no catupiry"), "add");
  assert.equal(tipos("sem bacon", 1, true, [bac]), "conflito");
  assert.equal(tipos("sem cebola"), "info");                         // X-Tudo não leva cebola
  assert.equal(tipos("sem tomate"), "");                              // leva tomate: pedido normal
  assert.equal(tipos("ovo bem passado"), "");                         // já leva ovo: não é adicional
  assert.equal(tipos("bacon a mais", 1, true, [bac]), "");            // já marcou
  assert.equal(tipos(""), "");
  assert.equal(BP.dicasObs(cat.itens[id("Porções", "Porção Mista")], [], "sem cebola", 1, true, cat).length, 0);
});
