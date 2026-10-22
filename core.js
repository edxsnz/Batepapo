/* Lanchonete Bate Papo — regras compartilhadas entre o cardápio e a página de conferência.
   Não precisa editar este arquivo para mudar preços: use o cardapio.js. */
(function (root) {
  "use strict";

  const fold = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Dinheiro sempre em centavos inteiros, para não ter erro de arredondamento (0.1 + 0.2).
  // Aceita número (14.5) ou texto ("14,50" / "14.50" / "R$ 14,50"). Qualquer outra coisa (vazio, null, "abc") é recusada:
  // um preço em branco nunca pode virar "lanche grátis".
  const centavos = v => {
    let n = v;
    if (typeof v === "string") {
      const m = v.trim().match(/^(?:R\$\s*)?(\d{1,5})(?:[.,](\d{1,2}))?$/);
      n = m ? Number(m[1] + "." + (m[2] || "0")) : NaN;
    } else if (typeof v !== "number") return null;
    return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) : null;
  };
  const brl = c => {
    c = Number.isFinite(c) ? Math.max(0, Math.round(c)) : 0;
    return "R$ " + Math.floor(c / 100).toLocaleString("pt-BR") + "," + String(c % 100).padStart(2, "0");
  };

  // Texto digitado pelo cliente: tira quebras de linha, caracteres invisíveis (inclusive os "tag" escondidos),
  // inversão de direção, os símbolos de formatação do WhatsApp (* _ ~ `) e pedaços soltos de emoji,
  // para ninguém "desenhar" itens falsos na mensagem nem quebrar o link do WhatsApp.
  const FAIXAS_INVISIVEIS = [[0, 31], [127, 159], [173, 173], [847, 847], [1564, 1564], [4447, 4448], [6068, 6069], [6155, 6158],
    [8203, 8207], [8232, 8238], [8288, 8297], [12644, 12644], [65024, 65039], [65279, 65279], [65440, 65440], [65529, 65531], [917504, 917631]];
  const INVISIVEIS = new RegExp("[" + FAIXAS_INVISIVEIS.map(([a, b]) => String.fromCodePoint(a) + "-" + String.fromCodePoint(b)).join("") + "]", "gu");
  const limpar = (s, max) => {
    let t = String(s == null ? "" : s).slice(0, max * 8 + 64);          // texto gigante: só olha o começo
    t = t.normalize("NFC").replace(INVISIVEIS, " ").replace(/[*_~`]/g, "");
    const cs = Array.from(t).filter(c => c.length > 1 || (c.charCodeAt(0) & 0xF800) !== 0xD800);   // some com emoji cortado ao meio
    const limpo = cs.join("").replace(/\s+/g, " ").trim();
    return Array.from(limpo).slice(0, max).join("").trim();           // corta por letra/emoji inteiro, nunca no meio
  };

  const LIMITES = { qtdItem: 30, itensSacola: 60, linhas: 40, nome: 40, obs: 80 };

  // Lê o cardapio.js e monta um catálogo validado. Itens com preço inválido, sem nome ou repetidos são ignorados
  // (e avisados no console), então um erro de digitação num item nunca derruba o site inteiro.
  function catalogo(C) {
    const itens = Object.create(null), lista = [], adicionais = [], avisos = [], nomes = new Set();
    (Array.isArray(C) ? C : []).forEach(c => {
      if (!c || typeof c.categoria !== "string" || !Array.isArray(c.itens)) return;
      const categoria = limpar(c.categoria, 60), catSlug = slug(categoria);
      if (!catSlug) return;
      const tipo = c.icone === "mais" ? "adicional" : c.icone === "porcao" ? "porcao" : "lanche";
      c.itens.forEach(i => {
        if (!i || typeof i.nome !== "string") return;
        const nome = limpar(i.nome, 60);
        if (!nome) return;
        const preco = centavos(i.preco);
        if (preco === null) { avisos.push(`Preço inválido em "${nome}"`); return; }
        const id = catSlug + "/" + slug(nome), chaveNome = tipo + ":" + fold(nome).replace(/[^a-z0-9]/g, "");
        if (!slug(nome) || nomes.has(chaveNome) || itens[id]) { avisos.push(`Nome repetido: "${nome}"`); return; }
        nomes.add(chaveNome);
        const it = Object.freeze({
          id, nome, preco,
          ingredientes: typeof i.ingredientes === "string" ? i.ingredientes : "", destaque: typeof i.destaque === "string" ? limpar(i.destaque, 40) : "",
          categoria, tipo
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
      const it = typeof l.id === "string" ? cat.itens[l.id] : null;
      if (!it || it.tipo === "adicional") return;
      let qtd = typeof l.qtd === "number" || typeof l.qtd === "string" ? Math.floor(Number(l.qtd)) : NaN;
      if (!Number.isFinite(qtd) || qtd < 1) return;
      qtd = Math.min(qtd, LIMITES.qtdItem, LIMITES.itensSacola - total);
      if (qtd < 1) return;
      const adds = it.tipo === "lanche"
        ? [...new Set((Array.isArray(l.adds) ? l.adds : []).filter(a => typeof a === "string" && cat.itens[a] && cat.itens[a].tipo === "adicional"))].sort()
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
  // Quem cola pode ter editado a mensagem à mão: tudo que fugir do que o site gera (quantidade fora do limite,
  // adicional repetido, pedido grande demais, texto enorme) é apontado em "estranhas" e NÃO entra na conta.
  const MAX_TEXTO = 20000, MAX_LINHA = 300;
  function lerMensagem(texto, cat) {
    const porNome = Object.create(null);
    Object.values(cat.itens).forEach(it => { porNome[it.tipo + ":" + fold(it.nome).replace(/[^a-z0-9]/g, "")] = it; });
    const k = (tipo, n) => tipo + ":" + fold(n).replace(/[^a-z0-9]/g, "");
    const linhas = [], estranhas = [];
    let cliente = "", atual = null, itens = 0;
    const todo = String(texto == null ? "" : texto), cortado = todo.length > MAX_TEXTO;
    todo.slice(0, MAX_TEXTO).split(/\r?\n/).forEach(raw => {
      const t = raw.length > MAX_LINHA ? "" : raw.replace(/[*_~`]/g, "").replace(INVISIVEIS, " ").trim();
      if (raw.length > MAX_LINHA) { atual = null; estranhas.push(raw.trim().slice(0, 120)); return; }
      if (!t || /^-{5,}$/.test(t) || /^pedido\s*-\s*lanchonete/i.test(t) || /^aguardo a confirma/i.test(t)) return;
      let m;
      if ((m = t.match(/^cliente:\s*(.*)$/i))) { cliente = limpar(m[1], LIMITES.nome); return; }
      if ((m = t.match(/^(\d{1,4})\s*x\s+(.+)$/i))) {
        const it = porNome[k("lanche", m[2])] || porNome[k("porcao", m[2])], qtd = Number(m[1]);
        if (it && qtd >= 1 && qtd <= LIMITES.qtdItem && itens + qtd <= LIMITES.itensSacola && linhas.length < LIMITES.linhas) {
          atual = { item: it, qtd, adds: [], obs: "" }; linhas.push(atual); itens += qtd;
        } else { atual = null; estranhas.push(raw.trim()); }
        return;
      }
      if ((m = t.match(/^\+\s*adicional de\s+(.+?)(\s*\(em cada\))?$/i)) && atual && atual.item.tipo === "lanche") {
        const a = porNome[k("adicional", m[1])];
        if (a && !atual.adds.includes(a)) atual.adds.push(a); else estranhas.push(raw.trim());
        return;
      }
      if ((m = t.match(/^obs:\s*(.*)$/i)) && atual) { atual.obs = limpar(m[1], LIMITES.obs); return; }
      if (/^do jeito do card[aá]pio$/i.test(t) && atual) return;
      estranhas.push(raw.trim().slice(0, 120));
    });
    if (cortado) estranhas.push("(a mensagem era grande demais: só o começo foi conferido)");
    linhas.forEach(l => { l.unit = l.item.preco + l.adds.reduce((s, a) => s + a.preco, 0); l.subtotal = l.unit * l.qtd; });
    return { cliente, linhas, estranhas, cortado, total: linhas.reduce((s, l) => s + l.subtotal, 0) };
  }

  // Link do WhatsApp. Se o texto ficar muito grande para um link, avisa (o site oferece "Copiar pedido").
  const LIMITE_URL = 4000;
  function urlWhats(numero, texto) {
    const url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
    return { url, longo: url.length > LIMITE_URL };
  }

  root.BP = Object.freeze({ fold, slug, centavos, brl, limpar, LIMITES, catalogo, validarSacola, chave, precoLinha, totalSacola, contar, mensagem, agrupar, frase, dicasObs, lerMensagem, urlWhats });
})(typeof window !== "undefined" ? window : globalThis);
