/* Lanchonete Bate Papo — funcionamento do cardápio (busca, sacola e pedido pelo WhatsApp).
   Para mudar preços e lanches, edite o cardapio.js. */
(function () {
  "use strict";
  const BP = window.BP;
  const $ = id => document.getElementById(id);
  if (!BP) { $("menu").innerHTML = '<div class="nores"><strong>Não foi possível carregar o cardápio</strong>Atualize a página. Se continuar assim, fale com a lanchonete pelo WhatsApp.</div>'; return; }
  const cat = BP.catalogo(window.CARDAPIO);
  const NUMERO = String(window.WHATSAPP || "").replace(/\D/g, "");
  const NUMERO_OK = /^55\d{10,11}$/.test(NUMERO);
  const { fold, slug, brl, limpar, LIMITES } = BP;

  /* ---------------- utilidades ---------------- */
  const ICONES = {
    burger:   '<path d="M4 11a8 6 0 0 1 16 0z"/><path d="M3 14h18"/><path d="M4 17h16c0 2-2 3-8 3s-8-1-8-3z"/>',
    frango:   '<path d="M15.5 3.5a5 5 0 0 1 0 7.1L11 15l-2-2 4.4-4.5"/><path d="M15.5 3.5a5 5 0 0 0-7 0c-2 2-2 5 0 7L11 15"/><path d="M9 13l-4 4"/><circle cx="4" cy="18" r="1.6"/><circle cx="6" cy="20" r="1.6"/>',
    file:     '<path d="M5 9c0-3.5 3.5-5.5 8-5.5 4 0 7 2.5 7 6.5 0 5-4.5 10-10 10-3.5 0-6-2.5-6-5.5 0-2 1-3 1-5.5z"/><circle cx="14" cy="10" r="2.2"/>',
    estrela:  '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    sanduiche:'<path d="M3 17L12 5l9 12z"/><path d="M6 13h12"/><path d="M3 17v2h18v-2"/>',
    porcao:   '<path d="M5 10h14l-1.6 10H6.6z"/><path d="M8 10V4M11 10V3M14 10V4M17 10V5"/>',
    mais:     '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${Object.prototype.hasOwnProperty.call(ICONES, n) ? ICONES[n] : ICONES.burger}</svg>`;
  const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const etiqueta = c => {
    const i = Math.floor(c / 100), ct = String(c % 100).padStart(2, "0");
    return `<span class="price" aria-label="${i} reais${ct !== "00" ? " e " + ct + " centavos" : ""}"><span class="cur">R$</span><span class="int">${i}</span><span class="cts">,${ct}</span></span>`;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  /* ---------------- sacola (estado) ---------------- */
  const CHAVE = "bp-sacola-v2";
  let sacola = BP.validarSacola(store.get(CHAVE, []), cat);

  // Sempre relê o que está salvo antes de mudar (outra aba pode ter mexido) e valida depois.
  // Se o navegador não consegue guardar (armazenamento cheio ou bloqueado), vale a sacola da memória:
  // reler o que ficou salvo antes faria a sacola "esquecer" o que acabou de ser adicionado.
  let gravando = true;
  function mudar(fn) {
    const atual = BP.validarSacola(gravando ? store.get(CHAVE, sacola) : sacola, cat);
    const nova = BP.validarSacola(fn(atual.map(l => ({ ...l, adds: [...l.adds] }))), cat);
    sacola = nova; salvar(); atualizarTudo();
  }
  function salvar() {
    const ok = store.set(CHAVE, sacola);
    if (!ok && gravando && sacola.length) setTimeout(() => avisar("Seu navegador não está guardando o pedido. Ele continua aqui, mas some se você recarregar a página.", 6000), 0);
    gravando = ok;
  }
  const qtdNaSacola = id => sacola.filter(l => l.id === id).reduce((s, l) => s + l.qtd, 0);
  const restante = () => LIMITES.itensSacola - BP.contar(sacola);

  /* ---------------- busca tolerante a erros ---------------- */
  const PARADAS = new Set(["de", "da", "do", "e", "com", "o", "a", "um", "uma", "no", "na", "em", "sem", "quero", "lanche", "lanches"]);
  const SINONIMOS = Object.assign(Object.create(null), { xis: "x", xes: "x", xese: "x", xs: "x", xiz: "x", bacom: "bacon", beicon: "bacon", beicom: "bacon",
    ovos: "ovo", eg: "ovo", amburgers: "amburger", burgers: "burger", frangos: "frango", porsoes: "porcao", porcoes: "porcao",
    calabresas: "calabresa", queijos: "queijo", files: "file" });
  function som(w) {
    w = fold(w).replace(/[^a-z0-9]/g, "");
    w = w.replace(/ph/g, "f").replace(/ch/g, "x").replace(/sh/g, "x").replace(/lh/g, "l").replace(/nh/g, "n")
         .replace(/qu/g, "c").replace(/gu(?=[ei])/g, "g").replace(/k/g, "c").replace(/y/g, "i").replace(/w/g, "v")
         .replace(/z/g, "s").replace(/c(?=[ei])/g, "s").replace(/^h/, "").replace(/(.)\1+/g, "$1");
    return SINONIMOS[w] || w;
  }
  const palavras = s => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  function distancia(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    const d = []; for (let i = 0; i <= m; i++) d[i] = [i]; for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  }
  const tolera = len => len <= 3 ? 0 : len <= 5 ? 1 : 2;
  function compara(q, t) {
    if (q === t) return 1;
    if (q.length === 1) return 0;
    if (t.startsWith(q)) return 0.9;
    if (q.length >= 4 && t.includes(q)) return 0.7;
    const tol = tolera(q.length); if (!tol) return 0;
    if (Math.abs(q.length - t.length) <= tol && distancia(q, t) <= tol) return 0.65;
    if (t.length > q.length && distancia(q, t.slice(0, q.length)) <= 1) return 0.5;
    return 0;
  }
  const INDICE = new Map();
  cat.lista.forEach(it => {
    const nome = palavras(it.nome).map(som), n = [...new Set([...nome, nome.join("")])];
    for (let i = 0; i < nome.length - 1; i++) n.push(nome[i] + nome[i + 1]);
    INDICE.set(it.id, { nome: n, cat: palavras(it.categoria).map(som), ing: palavras(it.ingredientes).map(som), exato: fold(it.nome).replace(/[^a-z0-9]/g, "") });
  });
  function buscar(texto) {
    const qs = palavras(String(texto).slice(0, 60)).filter(w => !PARADAS.has(w)).slice(0, 6).map(som).filter(Boolean);
    if (!qs.length) return [];
    const out = [];
    cat.lista.forEach(it => {
      const ix = INDICE.get(it.id); let total = 0, noNome = 0;
      for (const q of qs) {
        let best = 0, nm = false;
        for (const t of ix.nome) { const s = compara(q, t) * 3; if (s > best) { best = s; nm = true; } }
        for (const t of ix.cat) { const s = compara(q, t) * 1.5; if (s > best) { best = s; nm = false; } }
        for (const t of ix.ing) { const s = compara(q, t); if (s > best) { best = s; nm = false; } }
        if (!best) return;
        total += best; if (nm) noNome++;
      }
      if (ix.exato === qs.join("")) total += 5;
      out.push({ it, score: total + noNome * 0.5 - it.nome.length * 0.01 });
    });
    return out.sort((a, b) => b.score - a.score).map(r => r.it);
  }

  /* ingredientes: lista limpa com pontos e os molhos numa linha à parte (só na tela; o texto original não muda) */
  const DESC_CACHE = new Map();
  function descHtml(txt) {
    txt = String(txt || ""); if (DESC_CACHE.has(txt)) return DESC_CACHE.get(txt);
    const m = /,?\s*(Maionese,\s*Ketchup e Mostarda)\s*$/i.exec(txt);
    const base = m ? txt.slice(0, m.index) : txt;
    const lista = base.split(",").map(s => s.trim()).filter(Boolean).map(s => `<span class="i">${esc(s)}</span>`).join('<i class="sep"> · </i>');
    const out = `<span class="ings">${lista}</span>` + (m ? `<span class="molhos">Com maionese, ketchup e mostarda</span>` : "");
    DESC_CACHE.set(txt, out); return out;
  }

  /* ---------------- desenhar cardápio ---------------- */
  const AVATAR0 = `<span class="avatar" aria-hidden="true">${icon("burger")}</span>`;
  const tagSacola = id => `<span class="incart" data-incart="${esc(id)}" hidden></span>`;
  const btnAdd = it => `<button class="add" type="button" data-id="${esc(it.id)}" aria-label="Pedir ${esc(it.nome)}">${PLUS}<span>Pedir</span></button>`;
  const linhaItem = (it, mostrarCat) => `
    <div class="item" data-id="${esc(it.id)}">
      <div>
        ${mostrarCat ? `<div class="cat-label">${esc(it.categoria)}</div>` : ""}
        <div class="top"><span class="name">${esc(it.nome)}</span><span class="dots"></span>${etiqueta(it.preco)}</div>
        ${it.destaque ? `<span class="selo">${esc(it.destaque)}</span>` : ""}
        ${it.ingredientes ? `<div class="desc">${descHtml(it.ingredientes)}</div>` : ""}
        ${tagSacola(it.id)}
      </div>
      ${btnAdd(it)}
    </div>`;

  const C = Array.isArray(window.CARDAPIO) ? window.CARDAPIO : [];
  const secoes = C.map(c => ({ c, id: "sec-" + slug(c && c.categoria), itens: (c && Array.isArray(c.itens) ? c.itens : []).map(i => cat.itens[slug(c.categoria) + "/" + slug(i && i.nome)]).filter(Boolean) }))
    .filter(s => s.id !== "sec-" && s.itens.length);

  $("cats").innerHTML = secoes.map(s => `<a href="#${s.id}">${icon(s.c.icone)}${esc(s.c.categoria)}</a>`).join("");

  const destaques = cat.lista.filter(it => it.destaque);
  const promo = destaques.map(it => `
    <article class="promo" data-id="${esc(it.id)}">
      <div class="promo-burst" aria-hidden="true"><span><small>Só</small>${brl(it.preco).replace(",00", "")}</span></div>
      <div class="promo-body">
        <div class="promo-kicker">${esc(it.destaque)}</div>
        <h2 class="promo-name">${esc(it.nome)}</h2>
        ${it.ingredientes ? `<p class="promo-desc">${descHtml(it.ingredientes)}</p>` : ""}
        <div class="promo-row"><span class="sr-only">${brl(it.preco)}</span><button class="promo-btn add" type="button" data-id="${esc(it.id)}">Pedir este lanche</button></div>
        ${tagSacola(it.id)}
      </div>
    </article>`).join("");

  $("menu").innerHTML = (cat.lista.length ? "" : `<div class="nores"><strong>Cardápio indisponível</strong>Tente de novo em instantes.</div>`) + promo +
    secoes.map(({ c, id, itens }) => {
      const head = `<div class="sec-head"><div class="badge">${icon(c.icone)}</div>
        <div class="sec-title"><h2>${esc(c.categoria)}</h2><div class="sec-sub">${esc(c.subtitulo || itens.length + (itens.length === 1 ? " opção" : " opções"))}</div></div>
        <div class="rule" aria-hidden="true"></div></div>`;
      let body;
      if (c.icone === "porcao") body = `<div class="cards">${itens.map(it => `
        <div class="pcard" data-id="${esc(it.id)}"><span class="name">${esc(it.nome)}</span>
          ${it.ingredientes ? `<div class="desc">${descHtml(it.ingredientes)}</div>` : ""}
          ${tagSacola(it.id)}
          <div class="row">${etiqueta(it.preco)}${btnAdd(it)}</div></div>`).join("")}</div>`;
      else if (c.icone === "mais") body = `<div class="chips">${itens.map(it => `<div class="chip"><span class="name">${esc(it.nome)}</span>${etiqueta(it.preco)}</div>`).join("")}</div>`;
      else body = `<div class="list">${itens.map(it => linhaItem(it)).join("")}</div>`;
      return `<section id="${id}">${head}${body}</section>`;
    }).join("");

  /* quadro "Como fazer seu pedido": aberto na primeira visita; quem já sabe pode fechar e ele lembra */
  const como = $("como");
  if (como) {
    try { if (localStorage.getItem("bp-como") === "0") como.open = false; } catch (e) {}
    como.addEventListener("toggle", () => { try { localStorage.setItem("bp-como", como.open ? "1" : "0"); } catch (e) {} });
    const zap = $("zapDireto");
    if (zap && NUMERO_OK) { zap.href = "https://wa.me/" + NUMERO; zap.hidden = false; }
  }

  /* busca na tela */
  const busca = $("busca");
  function mostrarBusca() {
    const q = busca.value.trim();
    $("limpar").hidden = !q; if (typeof desenharRepetir === "function") desenharRepetir();
    $("menu").hidden = !!q; $("resultados").hidden = !q; $("cats").hidden = !!q; if (como) como.hidden = !!q;
    if (!q) { $("resultados").innerHTML = ""; return; }
    const r = buscar(q);
    $("resultados").innerHTML = r.length
      ? `<div class="results-head" role="status"><b>${r.length}</b> ${r.length === 1 ? "resultado" : "resultados"} para “${esc(q.slice(0, 60))}”</div><div class="list">${r.map(it => linhaItem(it, true)).join("")}</div>`
      : `<div class="nores" role="status"><strong>Nada encontrado</strong>Tente outro nome, como “x-tudo”, “frango” ou “bacon”.</div>`;
    marcarSacola();
  }
  busca.addEventListener("input", () => {
    mostrarBusca();
    const topo = document.querySelector(".checker").offsetTop + 18;
    if (window.scrollY > topo) window.scrollTo({ top: topo, behavior: "auto" });
  });
  busca.addEventListener("keydown", e => { if (e.key === "Enter") busca.blur(); if (e.key === "Escape") { busca.value = ""; mostrarBusca(); } });
  $("limpar").addEventListener("click", () => { busca.value = ""; mostrarBusca(); busca.focus(); });
  if (busca.value) mostrarBusca();                     // cliente digitou (ou o navegador preencheu) antes do cardápio terminar de carregar

  /* categoria ativa na barra */
  const links = [...document.querySelectorAll(".cats a")];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => {
        const on = a.getAttribute("href") === "#" + e.target.id;
        a.classList.toggle("on", on);
        if (on) { const bar = a.parentElement; bar.scrollTo({ left: a.offsetLeft - bar.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth" }); }
      });
    }), { rootMargin: "-140px 0px -60% 0px" });
    document.querySelectorAll("#menu section").forEach(s => io.observe(s));
  }

  /* ---------------- avisos ---------------- */
  let toastT;
  function avisar(t, ms) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms || 3200); }

  /* ---------------- janelas (com botão voltar do celular) ---------------- */
  let travaCliqueAte = 0, ultimoFoco = null;
  const aberta = () => ["ovItem", "ovBag"].find(id => !$(id).hidden) || null;
  let abertaEm = 0;
  function abrir(ov) {
    if (aberta() === ov) return;
    abertaEm = Date.now();
    ultimoFoco = document.activeElement;
    $(ov).hidden = false; document.body.classList.add("lock");
    try { history.pushState({ bp: ov }, ""); } catch (e) {}
  }
  function esconder(ov) {
    if ($(ov).hidden) return;
    $(ov).hidden = true; travaCliqueAte = Date.now() + 400;
    if (!aberta()) document.body.classList.remove("lock");
    if (ultimoFoco && document.contains(ultimoFoco)) try { ultimoFoco.focus({ preventScroll: true }); } catch (e) {}
  }
  function fechar(ov) {
    if (history.state && history.state.bp === ov) history.back();   // o popstate esconde
    else esconder(ov);
  }
  window.addEventListener("popstate", () => {
    const st = history.state && history.state.bp;
    ["ovItem", "ovBag"].forEach(id => { if (id !== st) esconder(id); });
  });
  if (history.state && history.state.bp) try { history.replaceState(null, ""); } catch (e) {}

  document.querySelectorAll(".overlay").forEach(ov => {
    ov.addEventListener("click", e => {
      if (e.target === ov && Date.now() - abertaEm < 450) return;      // 2º toque do toque duplo não fecha a janela
      if (e.target === ov || e.target.closest("[data-close]")) fechar(ov.id);
    });
  });
  document.addEventListener("keydown", e => {
    const ov = aberta(); if (!ov) return;
    if (e.key === "Escape") { e.preventDefault(); fechar(ov); return; }
    if (e.key === "Tab") {                                          // mantém o foco dentro da janela
      const f = [...$(ov).querySelectorAll('button:not([disabled]),a[href],input,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (i === -1) { e.preventDefault(); f[0].focus(); return; }
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------------- escolher lanche: conversa passo a passo ---------------- */
  const AVATAR = AVATAR0;
  const fala = (html, extra) => `<div class="bolha${extra ? " " + extra : ""}">${AVATAR}<div class="fala">${html}</div></div>`;
  const maxQtd = () => Math.max(1, Math.min(LIMITES.qtdItem, restante()));
  let F = null;                                     // estado da conversa do lanche aberto
  const novoJeito = (adds, obs) => ({ adds: new Set(adds || []), obs: obs || "" });
  const passosDe = it => it.tipo === "lanche" ? ["qtd", "jeito", "confere"] : ["qtd", "confere"];
  const NOMES_PASSO = { qtd: "Quantidade", jeito: "Do seu jeito", confere: "Conferir" };

  function abrirItem(id) {
    const it = cat.itens[id]; if (!it || it.tipo === "adicional") return;
    if (restante() < 1) { avisar(`Seu pedido já tem ${LIMITES.itensSacola} itens, que é o máximo por pedido. Para mais, fale direto com a lanchonete no WhatsApp.`, 6000); return; }
    F = { it, passo: "qtd", qtd: 1, modo: null, comum: novoJeito(), un: [], adicionando: false };
    $("itNome").textContent = it.nome;
    $("itDesc").innerHTML = descHtml(it.ingredientes);
    renderItem(); abrir("ovItem");
    try { $("ovItem").querySelector("[data-close]").focus({ preventScroll: true }); } catch (e) {}
  }
  function ajustarUnidades() {
    F.qtd = Math.min(Math.max(1, Math.floor(Number(F.qtd)) || 1), maxQtd());
    F.un = Array.from({ length: F.qtd }, (_, i) => F.un[i] || novoJeito(F.comum.adds));
    if (F.qtd === 1) F.modo = null;
  }
  const iguais = () => F.qtd === 1 || F.modo === "iguais";
  function linhasDoFluxo() {
    const bruto = iguais()
      ? [{ id: F.it.id, qtd: F.qtd, adds: [...F.comum.adds], obs: F.comum.obs }]
      : F.un.map(u => ({ id: F.it.id, qtd: 1, adds: [...u.adds], obs: u.obs }));
    return BP.validarSacola(bruto, cat);           // junta os que ficaram iguais e limpa o texto
  }
  const totalFluxo = () => BP.totalSacola(linhasDoFluxo(), cat);

  function painel(k, j, compacto) {
    if (F.it.tipo !== "lanche") return "";
    return `<div class="painel${compacto ? " compacto" : ""}">
      <div class="label">Quer algo a mais? <small>toque para marcar</small></div>
      <div class="opts">${cat.adicionais.map(a => `<button class="opt" type="button" data-k="${k}" data-add="${esc(a.id)}" aria-pressed="${j.adds.has(a.id)}"><span>${esc(a.nome)}</span><em>+ ${brl(a.preco)}</em></button>`).join("")}</div>
      <p class="nota" data-nota="${k}">${notaAdds(k, j)}</p>
      <label class="label" for="obs-${k}">Quer tirar alguma coisa? <small>opcional</small></label>
      <input class="field" id="obs-${k}" data-obs="${k}" maxlength="${LIMITES.obs}" value="${esc(j.obs)}" placeholder="Ex: sem tomate, sem cebola" autocomplete="off" enterkeyhint="done">
    </div>`;
  }
  function notaAdds(k, j) {
    const ns = [...j.adds].map(a => cat.itens[a].nome.toLowerCase());
    if (!ns.length) return k === "c" && F.qtd > 1 ? `Sem marcar nada, os ${F.qtd} vêm do jeito do cardápio.` : "Sem marcar nada, vem do jeito do cardápio.";
    const lista = ns.length === 1 ? ns[0] : ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1];
    if (k === "c" && F.qtd > 1) return `<b>Cada um</b> dos ${F.qtd} vem com ${lista} a mais.`;
    return `Vem com ${lista} a mais.`;
  }
  function progresso() {
    const ps = passosDe(F.it), i = ps.indexOf(F.passo);
    return `<ol class="prog" aria-label="Passo ${i + 1} de ${ps.length}">${ps.map((p, n) => `<li class="${n < i ? "feito" : n === i ? "agora" : ""}">${NOMES_PASSO[p]}</li>`).join("")}</ol>`;
  }

  function renderItem() {
    const it = F.it, nome = `<b>${esc(it.nome)}</b>`;
    let body = progresso(), foot = "";
    const voltar = `<button class="big ghost" type="button" data-acao="voltar">Voltar</button>`;
    if (F.passo === "qtd") {
      body += fala(`Quantos ${nome} você quer?`) + `
        <div class="qtdbox">
          <div class="stepper grande" role="group" aria-label="Quantidade">
            <button type="button" data-qd="-1" aria-label="Diminuir"${F.qtd <= 1 ? " disabled" : ""}>−</button><output aria-live="polite">${F.qtd}</output><button type="button" data-qd="1" aria-label="Aumentar"${F.qtd >= maxQtd() ? " disabled" : ""}>+</button>
          </div>
          <div class="atalhos">${[1, 2, 3, 4].filter(n => n <= maxQtd()).map(n => `<button type="button" class="chipq" data-setq="${n}" aria-pressed="${n === F.qtd}">${n}</button>`).join("")}</div>
        </div>
        ${F.qtd >= 6 ? fala(`É bastante coisa! Só conferindo: são <b>${F.qtd}</b> ${esc(it.nome)}, certo?`, "aviso") : ""}`;
      foot = `<button class="big" type="button" data-acao="continuar">Continuar</button>`;
    } else if (F.passo === "jeito") {
      if (F.qtd > 1 && !F.modo) {
        body += fala(`Os <b>${F.qtd} ${esc(it.nome)}</b> vão todos iguais?`) + `
          <div class="escolha2">
            <button type="button" data-modo="iguais"><b>Sim, todos iguais</b><small>Do mesmo jeito</small></button>
            <button type="button" data-modo="diferentes"><b>Não, cada um de um jeito</b><small>Ex: só 1 com ovo a mais</small></button>
          </div>`;
        foot = voltar;
      } else if (iguais()) {
        body += fala(F.qtd > 1 ? `Beleza! O que você marcar aqui vai em <b>cada um</b> dos ${F.qtd}.` : `Quer mudar alguma coisa no seu ${nome}?`) + painel("c", F.comum) +
          (F.qtd > 1 ? `<button class="trocar" type="button" data-modo="diferentes">Na verdade, cada um vai de um jeito</button>` : "");
        foot = `<div class="foot-row">${voltar}<button class="big" type="button" data-acao="continuar">Continuar</button></div>`;
      } else {
        body += fala(`Monte cada ${nome} do seu jeito. O que você não mexer vem do jeito do cardápio.`) +
          F.un.map((u, i) => `<div class="unid"><div class="unid-t">${esc(it.nome)} <span>${i + 1} de ${F.qtd}</span></div>${painel(String(i), u, true)}</div>`).join("") +
          `<button class="trocar" type="button" data-modo="iguais">Na verdade, vão todos iguais</button>`;
        foot = `<div class="foot-row">${voltar}<button class="big" type="button" data-acao="continuar">Continuar</button></div>`;
      }
    } else {
      const ls = linhasDoFluxo();
      const dicas = [], vistos = new Set();
      const juntaDicas = (k, j, q, ig) => BP.dicasObs(it, [...j.adds], j.obs, q, ig, cat).forEach(d => {
        if (vistos.has(d.texto)) return; vistos.add(d.texto); dicas.push({ ...d, k });
      });
      if (iguais()) juntaDicas("c", F.comum, F.qtd, F.qtd > 1); else F.un.forEach((u, i) => juntaDicas(String(i), u, 1, false));
      body += fala("Confere pra mim se está certinho:") + `
        <ul class="resumo">${ls.map(l => `<li><span class="q">${l.qtd}x</span><div><b>${esc(BP.frase(l, cat).replace(/^\d+ /, ""))}</b>${l.obs ? `<small>Obs: ${esc(l.obs)}</small>` : ""}</div><span class="v">${brl(BP.precoLinha(l, cat))}</span></li>`).join("")}</ul>
        ${dicas.map(d => fala(esc(d.texto) + acaoDica(d), "dica")).join("")}`;
      foot = `<div class="foot-row"><button class="big ghost" type="button" data-acao="voltar">Corrigir</button>
        <button class="big add-btn" type="button" data-acao="confirmar"><span>Adicionar ao pedido</span><span class="nw">${brl(totalFluxo())}</span></button></div>`;
    }
    $("itDesc").hidden = F.passo === "confere";
    $("itBody").innerHTML = body; $("itFoot").innerHTML = foot;
    $("itBody").scrollTop = 0;
  }
  function acaoDica(d) {
    const a = d.add ? cat.itens[d.add] : null;
    if (d.tipo === "add") return `<button class="dica-btn" type="button" data-dica="add" data-k="${d.k}" data-add="${esc(d.add)}">Marcar ${esc(a.nome.toLowerCase())} a mais</button>`;
    if (d.tipo === "conflito") return `<button class="dica-btn" type="button" data-dica="tirar" data-k="${d.k}" data-add="${esc(d.add)}">Tirar o adicional</button>`;
    if (d.tipo === "separar") return `<button class="dica-btn" type="button" data-dica="separar">Montar cada um</button>`;
    return "";
  }
  const jeitoDe = k => k === "c" ? F.comum : F.un[Number(k)];

  const sheetItem = $("ovItem");
  sheetItem.addEventListener("click", e => {
    if (!F) return;
    const t = e.target.closest("button"); if (!t || !sheetItem.contains(t)) return;
    if (t.dataset.setq) { F.qtd = Number(t.dataset.setq); ajustarUnidades(); renderItem(); return; }
    if (t.dataset.qd) { F.qtd += Number(t.dataset.qd); ajustarUnidades(); renderItem(); return; }
    if (t.dataset.modo === "iguais" || t.dataset.modo === "diferentes") {
      if (t.dataset.modo === "diferentes" && F.modo !== "diferentes") F.un = F.un.map(() => novoJeito(F.comum.adds));
      if (t.dataset.modo === "iguais" && F.modo === "diferentes") F.comum = novoJeito(F.un[0] ? F.un[0].adds : []);
      F.modo = t.dataset.modo; renderItem(); return;
    }
    if (t.dataset.dica) {
      if (t.dataset.dica === "separar") { F.un = F.un.map(() => novoJeito(F.comum.adds)); F.comum.obs = ""; F.modo = "diferentes"; F.passo = "jeito"; renderItem(); return; }
      const j = jeitoDe(t.dataset.k); if (!j || !cat.itens[t.dataset.add]) return;
      if (t.dataset.dica === "add") j.adds.add(t.dataset.add); else j.adds.delete(t.dataset.add);
      renderItem(); return;
    }
    if (t.dataset.add && t.dataset.k !== undefined) {
      const j = jeitoDe(t.dataset.k); if (!j || !cat.itens[t.dataset.add]) return;
      j.adds.has(t.dataset.add) ? j.adds.delete(t.dataset.add) : j.adds.add(t.dataset.add);
      t.setAttribute("aria-pressed", String(j.adds.has(t.dataset.add)));
      const n = sheetItem.querySelector(`[data-nota="${t.dataset.k}"]`); if (n) n.innerHTML = notaAdds(t.dataset.k, j);
      return;
    }
    const acao = t.dataset.acao; if (!acao) return;
    const ps = passosDe(F.it), i = ps.indexOf(F.passo);
    if (acao === "continuar") {
      if (F.passo === "qtd") ajustarUnidades();
      F.passo = ps[Math.min(i + 1, ps.length - 1)]; renderItem();
    } else if (acao === "voltar") {
      if (F.passo === "jeito" && F.modo && F.qtd > 1) { F.modo = null; renderItem(); return; }   // volta para "vão todos iguais?"
      F.passo = ps[Math.max(i - 1, 0)]; renderItem();
    } else if (acao === "confirmar") confirmarItem();
  });
  sheetItem.addEventListener("input", e => {
    const k = e.target.dataset && e.target.dataset.obs; if (k === undefined || !F) return;
    const j = jeitoDe(k); if (j) j.obs = e.target.value.slice(0, LIMITES.obs);
  });
  sheetItem.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.obs !== undefined) { e.preventDefault(); e.target.blur(); } });

  function confirmarItem() {
    if (!F || F.adicionando) return; F.adicionando = true;           // evita pôr duas vezes no toque duplo
    const ls = linhasDoFluxo(), pedido = BP.contar(ls), nome = F.it.nome;
    const chaves = new Set(sacola.map(BP.chave));
    const juntou = ls.some(l => chaves.has(BP.chave(l)));
    const antes = BP.contar(sacola);
    mudar(s => s.concat(ls));
    const entrou = BP.contar(sacola) - antes;
    fechar("ovItem");
    if (entrou < pedido) avisar(`Só cabem ${LIMITES.itensSacola} itens por pedido. Entraram ${entrou}.`, 6000);
    else if (juntou) avisar(`Juntei com o que já estava no seu pedido. Agora são ${qtdNaSacola(F.it.id)} ${nome}. Quando terminar, toque em "Ver meu pedido".`, 7000);
    else avisar(`Pronto! ${entrou}x ${nome} no seu pedido. Pode escolher mais lanches ou tocar em "Ver meu pedido" para enviar.`, 7000);
    const bb = $("bagbtn"); bb.classList.remove("bump"); void bb.offsetWidth; bb.classList.add("bump");
  }

  document.addEventListener("click", e => {
    if (Date.now() < travaCliqueAte || aberta()) return;
    const alvo = e.target.closest(".add, .item, .pcard, .promo"); if (!alvo) return;
    abrirItem(alvo.dataset.id);
  });

  /* ---------------- ver sacola e pedir ---------------- */
  let passoAtual = "Bag";
  function passo(p) {
    passoAtual = p;
    ["Bag", "Nome", "Ok"].forEach(s => { $("step" + s).hidden = s !== p; $("foot" + s).hidden = s !== p; });
    $("bagTitle").textContent = p === "Nome" ? "Quase pronto" : p === "Ok" ? "Pedido pronto" : "Seu pedido";
    $("bagHint").hidden = p !== "Bag";
  }
  function desenharSacola() {
    const vazia = !sacola.length;
    $("esvaziar").hidden = vazia; $("footBag").hidden = vazia || passoAtual !== "Bag";
    if (vazia) { $("bagFala").innerHTML = fala("Seu pedido ainda está vazio. Volte ao cardápio e toque em <b>Pedir</b> no lanche que você quer. Eu te ajudo a montar."); $("lines").innerHTML = ""; return; }
    const ordem = BP.agrupar(sacola), n = BP.contar(sacola);
    const separados = [...new Set(sacola.map(l => l.id))].filter(id => sacola.filter(l => l.id === id).length > 1);
    const muitos = sacola.filter(l => l.qtd >= 6);
    let conversa = `Você tem <b>${n} ${n === 1 ? "item" : "itens"}</b> no seu pedido. Dá para mudar a quantidade com o − e o +. Estando tudo certo, toque em <b>Pedir pelo WhatsApp</b>.`;
    if (separados.length) conversa += ` Os ${separados.map(id => esc(cat.itens[id].nome)).join(" e ")} aparecem separados porque vão de jeitos diferentes. Está certinho assim.`;
    $("bagFala").innerHTML = fala(conversa) + muitos.map(l => fala(`Só conferindo: são <b>${l.qtd} ${esc(cat.itens[l.id].nome)}</b> mesmo?`, "aviso")).join("");
    $("lines").innerHTML = ordem.map(l => {
      const it = cat.itens[l.id], k = esc(BP.chave(l));
      const ns = l.adds.map(a => cat.itens[a].nome.toLowerCase());
      const lista = ns.length > 1 ? ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1] : ns[0];
      const detalhe = ns.length ? (l.qtd > 1 ? "Cada um com " : "Com ") + lista + " a mais" : it.tipo === "lanche" ? "Do jeito do cardápio" : "";
      return `<div class="line">
        <div class="nm">${esc(it.nome)}</div><div class="lp">${brl(BP.precoLinha(l, cat))}</div>
        ${detalhe ? `<div class="ex">${esc(detalhe)}</div>` : ""}
        ${l.obs ? `<div class="ex"><b>Obs:</b> ${esc(l.obs)}</div>` : ""}
        <div class="ctl">
          <div class="stepper sm" role="group" aria-label="Quantidade de ${esc(it.nome)}">
            <button type="button" data-q="-1" data-k="${k}" aria-label="Diminuir">−</button><output>${l.qtd}</output><button type="button" data-q="1" data-k="${k}" aria-label="Aumentar"${l.qtd >= LIMITES.qtdItem || restante() < 1 ? " disabled" : ""}>+</button>
          </div>
          <button class="rm" type="button" data-rm="${k}">Remover</button>
        </div></div>`;
    }).join("");
  }
  // linhas são achadas pela chave (não pela posição), então outra aba mexendo não faz remover o item errado
  $("lines").addEventListener("click", e => {
    const q = e.target.closest("[data-q]"), r = e.target.closest("[data-rm]");
    if (q) mudar(s => { const l = s.find(x => BP.chave(x) === q.dataset.k); if (l) l.qtd += Number(q.dataset.q); return s.filter(x => x.qtd > 0); });
    else if (r) mudar(s => s.filter(x => BP.chave(x) !== r.dataset.rm));
  });
  $("bagbtn").onclick = () => { $("toast").hidden = true; passo("Bag"); desenharSacola(); abrir("ovBag"); try { $("ovBag").querySelector("[data-close]").focus({ preventScroll: true }); } catch (e) {} };
  $("esvaziar").onclick = () => mudar(() => []);

  const nomeSalvo = () => limpar(store.get("bp-nome", ""), LIMITES.nome);
  const textoPedido = () => BP.mensagem(sacola, $("nome").value, cat);
  const linkWhats = () => BP.urlWhats(NUMERO, textoPedido());
  function atualizarMsg() {
    const txt = textoPedido(), l = BP.urlWhats(NUMERO, txt);
    $("msg").innerHTML = esc(txt).replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
    $("msgLongo").hidden = !l.longo;
    $("enviar").href = NUMERO_OK ? l.url : "#";
  }
  $("irNome").onclick = () => {
    if (!sacola.length) return;
    $("nome").value = nomeSalvo(); $("nomeErr").hidden = true;
    passo("Nome"); atualizarMsg();
    setTimeout(() => { if (!$("nome").value) $("nome").focus(); }, 60);
  };
  $("nome").addEventListener("input", () => { $("nomeErr").hidden = true; atualizarMsg(); });
  $("nome").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("enviar").click(); } });
  $("voltar").onclick = () => { passo("Bag"); desenharSacola(); };

  let ultimoEnvio = 0;
  $("enviar").addEventListener("click", e => {
    const nome = limpar($("nome").value, LIMITES.nome);
    if (!NUMERO_OK) { e.preventDefault(); avisar("WhatsApp da lanchonete não configurado."); return; }
    if (!sacola.length) { e.preventDefault(); passo("Bag"); desenharSacola(); return; }
    if (nome.length < 2) { e.preventDefault(); $("nomeErr").hidden = false; $("nome").focus(); return; }
    if (Date.now() - ultimoEnvio < 2000) { e.preventDefault(); return; }   // evita abrir duas vezes
    ultimoEnvio = Date.now();
    store.set("bp-nome", nome);
    store.set("bp-ultimo", sacola.map(l => ({ ...l, adds: [...l.adds] })));
    $("enviar").href = linkWhats().url;                                     // monta com a sacola mais recente
    setTimeout(() => passo("Ok"), 300);
  });
  $("reabrir").onclick = () => { if (sacola.length) window.open(linkWhats().url, "_blank", "noopener"); };
  // Plano B: copiar o pedido para colar na conversa (WhatsApp que não abre, computador sem WhatsApp, pedido grande)
  function copiar(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise((ok, erro) => {
      const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? ok() : erro(); } catch (e) { erro(e); } finally { ta.remove(); }
    });
  }
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () => {
    if (!sacola.length) return;
    copiar(textoPedido()).then(() => avisar("Pedido copiado! Cole na conversa do WhatsApp."), () => avisar("Não consegui copiar. Segure o texto da mensagem e escolha copiar."));
  }));
  $("novo").onclick = () => { mudar(() => []); fechar("ovBag"); avisar("Tudo certo! Bom apetite!"); };


  /* ---------------- repetir o último pedido ---------------- */
  const repetirEl = $("repetir");
  const ultimoPedido = () => BP.validarSacola(store.get("bp-ultimo", []), cat);
  function desenharRepetir() {
    if (!repetirEl) return;
    const u = ultimoPedido();
    repetirEl.hidden = !u.length || sacola.length > 0 || !!busca.value.trim();
    if (repetirEl.hidden) return;
    const nomes = u.map(l => l.qtd + "x " + cat.itens[l.id].nome);
    $("repetirTxt").textContent = nomes.slice(0, 3).join(", ") + (nomes.length > 3 ? " e mais " + (nomes.length - 3) : "");
  }
  if (repetirEl) $("repetirBtn").onclick = () => {
    const u = ultimoPedido(); if (!u.length) { desenharRepetir(); return; }
    mudar(() => u); $("bagbtn").onclick();
  };

  /* ---------------- atualizar tela ---------------- */
  function marcarSacola() {
    document.querySelectorAll("[data-incart]").forEach(el => {
      const q = qtdNaSacola(el.dataset.incart); el.hidden = !q; if (q) el.textContent = "✓ " + q + " no seu pedido";
    });
  }
  function atualizarTudo() {
    const n = BP.contar(sacola), tot = BP.totalSacola(sacola, cat);
    $("bagbtn").hidden = !n;
    $("bagN").textContent = n;
    $("bagV").textContent = brl(tot);
    $("bagSub").textContent = (n === 1 ? "1 item" : n + " itens") + " · toque aqui para enviar";
    $("tot").textContent = brl(tot);
    marcarSacola(); desenharRepetir();
    if (aberta() === "ovBag") {
      if (passoAtual === "Bag") desenharSacola();
      else if (passoAtual === "Nome") { if (!n) { passo("Bag"); desenharSacola(); } else atualizarMsg(); }
    }
  }

  // outra aba mudou a sacola: atualiza esta também
  window.addEventListener("storage", e => {
    if (e.key !== CHAVE && e.key !== null) return;
    sacola = BP.validarSacola(store.get(CHAVE, []), cat); atualizarTudo();
  });

  if (!NUMERO_OK) console.warn("WHATSAPP inválido em cardapio.js: use 55 + DDD + número, só dígitos.");
  salvar();
  atualizarTudo();
})();
