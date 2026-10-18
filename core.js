/* Lanchonete Bate Papo — regras compartilhadas entre o cardápio e a página de conferência.
   Não precisa editar este arquivo para mudar preços: use o cardapio.js. */
(function (root) {
  "use strict";

  const fold = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Dinheiro sempre em centavos inteiros, para não ter erro de arredondamento (0.1 + 0.2).
  const centavos = v => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) : null;
  };
  const brl = c => {
    c = Math.max(0, Math.round(c));
    return "R$ " + Math.floor(c / 100).toLocaleString("pt-BR") + "," + String(c % 100).padStart(2, "0");
  };

  // Texto digitado pelo cliente: tira quebras de linha, caracteres invisíveis, inversão de direção
  // e os símbolos de formatação do WhatsApp (* _ ~ `), para ninguém "desenhar" itens falsos na mensagem.
  const limpar = (s, max) => String(s == null ? "" : s)
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, " ")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  const LIMITES = { qtdItem: 30, itensSacola: 60, linhas: 40, nome: 40, obs: 80 };

  // Lê o cardapio.js e monta um catálogo validado. Itens com preço inválido ou nome repetido são ignorados.
  function catalogo(C) {
    const itens = Object.create(null), lista = [], adicionais = [], avisos = [], nomes = new Set();
    (Array.isArray(C) ? C : []).forEach(c => {
      if (!c || !c.categoria || !Array.isArray(c.itens)) return;
      const tipo = c.icone === "mais" ? "adicional" : c.icone === "porcao" ? "porcao" : "lanche";
      c.itens.forEach(i => {
        if (!i || !i.nome) return;
        const preco = centavos(i.preco);
        if (preco === null) { avisos.push(`Preço inválido em "${i.nome}"`); return; }
        const chaveNome = tipo + ":" + fold(i.nome).replace(/[^a-z0-9]/g, "");
        if (nomes.has(chaveNome)) { avisos.push(`Nome repetido: "${i.nome}"`); return; }
        nomes.add(chaveNome);
        const it = Object.freeze({
          id: slug(c.categoria) + "/" + slug(i.nome), nome: String(i.nome), preco,
          ingredientes: i.ingredientes ? String(i.ingredientes) : "", destaque: i.destaque ? String(i.destaque) : "",
          categoria: String(c.categoria), tipo
        });
        itens[it.id] = it;
        (tipo === "adicional" ? adicionais : lista).push(it);
      });
    });
    if (avisos.length && root.console) console.warn("Cardápio:", avisos.join(" | "));
    return { itens, lista, adicionais, avisos };
  }

  // Confere uma sacola vinda do navegador (que o cliente pode ter mexido) e devolve só o que é válido.
  function validarSacola(bruta, cat) {
    const out = [], vistos = new Map();
    let total = 0;
    (Array.isArray(bruta) ? bruta : []).slice(0, LIMITES.linhas).forEach(l => {
      if (!l || typeof l !== "object") return;
      const it = cat.itens[l.id];
      if (!it || it.tipo === "adicional") return;
      let qtd = Math.floor(Number(l.qtd));
      if (!Number.isFinite(qtd) || qtd < 1) return;
      qtd = Math.min(qtd, LIMITES.qtdItem, LIMITES.itensSacola - total);
      if (qtd < 1) return;
      const adds = it.tipo === "lanche"
        ? [...new Set((Array.isArray(l.adds) ? l.adds : []).filter(a => cat.itens[a] && cat.itens[a].tipo === "adicional"))].sort()
        : [];
      const obs = limpar(l.obs, LIMITES.obs);
      const linha = { id: it.id, qtd, adds, obs };
      const k = chave(linha);
      if (vistos.has(k)) {                         // linhas iguais viram uma só
        const ant = vistos.get(k), soma = Math.min(ant.qtd + qtd, LIMITES.qtdItem);
        total += soma - ant.qtd; ant.qtd = soma; return;
      }
      vistos.set(k, linha); out.push(linha); total += qtd;
    });
    return out;
  }
  const chave = l => l.id + "|" + l.adds.join(",") + "|" + fold(l.obs);
  const precoLinha = (l, cat) => (cat.itens[l.id].preco + l.adds.reduce((s, a) => s + cat.itens[a].preco, 0)) * l.qtd;
  const totalSacola = (s, cat) => s.reduce((t, l) => t + precoLinha(l, cat), 0);
  const contar = s => s.reduce((t, l) => t + l.qtd, 0);

  // Mensagem do pedido. Não leva preço: o valor é sempre conferido pela lanchonete com os preços oficiais.
  const CABECALHO = "*PEDIDO - LANCHONETE BATE PAPO*";
  const SEP = "------------------------------";
  function mensagem(sacola, nome, cat) {
    const L = [CABECALHO, "", "*Cliente:* " + (limpar(nome, LIMITES.nome) || "(seu nome)"), "", SEP];
    agrupar(sacola).forEach(l => {
      const it = cat.itens[l.id];
      const variacoes = sacola.filter(x => x.id === l.id).length > 1;
      L.push("", `*${l.qtd}x ${it.nome.toUpperCase()}*`);
      l.adds.forEach(a => L.push(`   + adicional de ${cat.itens[a].nome.toLowerCase()}${l.qtd > 1 ? " (em cada)" : ""}`));
      if (variacoes && !l.adds.length && !l.obs) L.push("   do jeito do cardápio");
      if (l.obs) L.push("   Obs: " + l.obs);
    });
    L.push("", SEP, "", "Aguardo a confirmação do valor.");
    return L.join("\n");
  }
  // Deixa o mesmo lanche junto (ex: os dois X-Tudo um embaixo do outro), mantendo a ordem em que entraram.
  function agrupar(sacola) {
    const ordem = [];
    sacola.forEach(l => { if (!ordem.includes(l.id)) ordem.push(l.id); });
    return ordem.flatMap(id => sacola.filter(l => l.id === id));
  }

  // Frase simples para o cliente: "2 X-Tudo, cada um com ovo a mais".
  const juntar = xs => xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
  function frase(l, cat) {
    const it = cat.itens[l.id];
    let s = `${l.qtd} ${it.nome}`;
    if (l.adds.length) s += (l.qtd > 1 ? ", cada um com " : " com ") + juntar(l.adds.map(a => cat.itens[a].nome.toLowerCase())) + " a mais";
    else if (it.tipo === "lanche") s += " do jeito do cardápio";
    return s;
  }

  // Lê a observação e ajuda o cliente, como alguém do balcão faria.
  const norm = s => " " + fold(s).replace(/[^a-z0-9]+/g, " ").trim() + " ";
  const SEM = "(?:sem|tirar|tira|retirar|retira|nao quero|nao coloca|nao colocar|nao por)";
  const ART = "(?:o |a |os |as )?";
  const MAIS = / (mais|extra|adicional|dobro|dobrado|duplo|dupla|bastante|caprichad[oa]|com) /;
  let VOCAB = null;
  function vocabulario(cat) {
    if (VOCAB && VOCAB.cat === cat) return VOCAB.lista;
    const set = new Set();
    Object.values(cat.itens).forEach(it => {
      String(it.ingredientes).split(/,| e /).forEach(p => { const v = norm(p).trim(); if (v && v !== "pao" && v.length > 2) set.add(v); });
      if (it.tipo === "adicional") set.add(norm(it.nome).trim());
    });
    VOCAB = { cat, lista: [...set].sort((a, b) => b.length - a.length) };
    return VOCAB.lista;
  }
  const temPalavra = (o, v) => new RegExp(" " + v + "s? ").test(o);
  const pedeSem = (o, v) => new RegExp(" " + SEM + " " + ART + v + "s? ").test(o);
  function dicasObs(it, adds, obs, qtd, iguais, cat) {
    const o = norm(obs), out = [];
    if (!o.trim() || !it || it.tipo !== "lanche") return out;
    if (qtd > 1 && iguais && / (\d+|um|uma|dois|duas|tres|so|apenas|somente|metade) /.test(o) && / (com|sem|mais|extra) /.test(o)) {
      out.push({ tipo: "separar", texto: `Pelo que você escreveu, parece que ${qtd === 2 ? "os 2 não vão iguais" : "nem todos os " + qtd + " vão iguais"}. Quer montar cada um separado? Assim a cozinha não se confunde.` });
    }
    const ing = norm(it.ingredientes);
    const avisados = new Set();
    cat.adicionais.forEach(a => {
      const n = norm(a.nome).trim();
      if (!temPalavra(o, n)) return;
      const marcado = adds.includes(a.id);
      if (pedeSem(o, n)) {
        if (marcado) out.push({ tipo: "conflito", add: a.id, texto: `Você marcou ${a.nome.toLowerCase()} a mais, mas escreveu "sem ${a.nome.toLowerCase()}". Quer tirar o adicional?` });
        return;
      }
      if (!marcado && (MAIS.test(o) || !ing.includes(" " + n + " "))) {
        out.push({ tipo: "add", add: a.id, texto: `Você escreveu sobre ${a.nome.toLowerCase()}. Se é ${a.nome.toLowerCase()} a mais, marque o adicional (+ ${brl(a.preco)}) para o valor sair certo.` });
        avisados.add(n);
      }
    });
    vocabulario(cat).forEach(v => {
      if (avisados.has(v) || !pedeSem(o, v) || ing.includes(" " + v + " ")) return;
      if ([...avisados].some(x => x.includes(v) || v.includes(x))) return;
      avisados.add(v);
      out.push({ tipo: "info", texto: `O ${it.nome} já vem sem ${v}, não precisa pedir.` });
    });
    return out;
  }

  // Lê uma mensagem de pedido colada e recalcula com os preços oficiais.
  function lerMensagem(texto, cat) {
    const porNome = Object.create(null);
    Object.values(cat.itens).forEach(it => { porNome[it.tipo + ":" + fold(it.nome).replace(/[^a-z0-9]/g, "")] = it; });
    const k = (tipo, n) => tipo + ":" + fold(n).replace(/[^a-z0-9]/g, "");
    const linhas = [], estranhas = [];
    let cliente = "", atual = null;
    String(texto || "").split(/\r?\n/).forEach(raw => {
      const t = raw.replace(/[*_~`]/g, "").replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, "").trim();
      if (!t || /^-{5,}$/.test(t) || /^pedido\s*-\s*lanchonete/i.test(t) || /^aguardo a confirma/i.test(t)) return;
      let m;
      if ((m = t.match(/^cliente:\s*(.*)$/i))) { cliente = m[1]; return; }
      if ((m = t.match(/^(\d{1,3})\s*x\s+(.+)$/i))) {
        const it = porNome[k("lanche", m[2])] || porNome[k("porcao", m[2])];
        if (it) { atual = { item: it, qtd: Number(m[1]), adds: [], obs: "" }; linhas.push(atual); }
        else { atual = null; estranhas.push(raw.trim()); }
        return;
      }
      if ((m = t.match(/^\+\s*adicional de\s+(.+?)(\s*\(em cada\))?$/i)) && atual && atual.item.tipo === "lanche") {
        const a = porNome[k("adicional", m[1])];
        if (a) atual.adds.push(a); else estranhas.push(raw.trim());
        return;
      }
      if ((m = t.match(/^obs:\s*(.*)$/i)) && atual) { atual.obs = m[1]; return; }
      if (/^do jeito do card[aá]pio$/i.test(t) && atual) return;
      estranhas.push(raw.trim());
    });
    linhas.forEach(l => { l.unit = l.item.preco + l.adds.reduce((s, a) => s + a.preco, 0); l.subtotal = l.unit * l.qtd; });
    return { cliente, linhas, estranhas, total: linhas.reduce((s, l) => s + l.subtotal, 0) };
  }

  root.BP = Object.freeze({ fold, slug, centavos, brl, limpar, LIMITES, catalogo, validarSacola, chave, precoLinha, totalSacola, contar, mensagem, agrupar, frase, dicasObs, lerMensagem });
})(typeof window !== "undefined" ? window : globalThis);
