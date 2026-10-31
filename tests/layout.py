"""Teste de LAYOUT DE BOTÕES do cardápio (padrão de botões, seção 4 "Critérios de aceite").

Uso:  python3 layout.py [porta]      (padrão 8765)   ·   -v mostra também as linhas "ok"

Para cada aparelho da matriz abre UM contexto (reaproveitado em todos os estados), monta o
estado pela sacola no localStorage + reload e percorre a janela do lanche e a sacola com
cliques reais. Em cada estado mede, no próprio navegador:
  1. botões/links visíveis dentro da tela e sem conteúdo estourando (scrollWidth);
  2. alvo de toque >= 44x44 nos aparelhos de toque;
  3. #bagbtn com "Ver meu pedido" em 1 linha e altura <= 80px (<= 100px com zoom 1.3);
  4. toast sem encostar no #bagbtn; tocar no toast só fecha o aviso (some em até ~600ms, não abre
     janela nenhuma e não mexe na sacola). Antes era pointer-events:none, mas aí o toque vazava
     para o lanche de baixo (defeito achado pelos clientes) — o diretor trocou o critério.;
  5. nenhuma palavra de título partida no meio;
  6. sem rolagem horizontal.
Cada checagem é agrupada por (aparelho, estado, tipo); a mensagem de falha diz o elemento e a medida.
"""
import json, re, sys, time
from playwright.sync_api import sync_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith("-")]
VERBOSO = "-v" in sys.argv
PORTA = ARGS[0] if ARGS else "8765"
URL = f"http://127.0.0.1:{PORTA}/"

# nome, largura, altura, toque (is_mobile/has_touch), escala, zoom
APARELHOS = [
    ("320x568", 320, 568, True, 2, None), ("360x640", 360, 640, True, 3, None), ("360x800", 360, 800, True, 3, None),
    ("375x667", 375, 667, True, 2, None), ("390x844", 390, 844, True, 3, None), ("412x915", 412, 915, True, 3, None),
    ("430x932", 430, 932, True, 3, None), ("667x375", 667, 375, True, 2, None), ("844x390", 844, 390, True, 3, None),
    ("768x1024", 768, 1024, True, 2, None), ("1024x768", 1024, 768, True, 2, None),
    ("1366x768", 1366, 768, False, 1, None), ("1920x1080", 1920, 1080, False, 1, None),
    ("320x568 zoom1.3", 320, 568, True, 2, "1.3"), ("360x640 zoom1.3", 360, 640, True, 3, "1.3"),
    ("390x844 zoom1.3", 390, 844, True, 3, "1.3"),
]

# Exceções à regra dos 44x44 (seletor CSS -> motivo). O padrão só libera "links dentro de texto
# corrido"; esses já são reconhecidos automaticamente (um <a> cujo pai tem outro texto além dele).
# Qualquer outra exceção precisa estar AQUI, com justificativa — não afrouxe sem motivo.
EXCECOES_ALVO = {
    # (nenhuma até agora: todos os botões do site, inclusive ×, −/+, "Remover" e "Limpar meu pedido",
    #  devem ter 44x44 pelo padrão, seção 3.5)
}

ALTURA_BAG = {None: 80, "1.3": 100}

def pedido(*linhas):
    return json.dumps([{"id": i, "qtd": q, "adds": a, "obs": o} for (i, q, a, o) in linhas])

UM_ITEM = pedido(("hamburguer/x-tudo", 1, [], ""))
TRES_LINHAS = pedido(("hamburguer/x-tudo", 1, ["complementos/ovo", "complementos/bacon"], "sem tomate e sem cebola, por favor bem passado"),
                     ("file-de-frango/frango-tudo-especial", 2, ["complementos/catupiry"], ""),
                     ("porcoes/porcao-mista", 1, [], ""))
# 60 itens (o limite) e total alto (R$ 3.000+): mostra o aviso longo do toast ao tentar pedir mais
LIMITE = pedido(("porcoes/porcao-mista", 30, [], ""),
                ("lanches-especiais/x-especial", 30, ["complementos/catupiry", "complementos/bacon"], ""))

JS = r"""
window.__L = (() => {
  const SEL = 'button, a[href], summary, [role=button], .opt, .chipq, input[type=button], input[type=submit]';
  const nome = e => {
    const t = (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
      (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (t ? ` "${t}"` : '');
  };
  const f = n => Math.round(n * 10) / 10;
  const visivel = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden=true]');
  // Raiz que o usuário enxerga: com uma janela aberta, só a janela (o resto está coberto pelo overlay).
  const raiz = () => [...document.querySelectorAll('.overlay')].find(o => !o.hidden && visivel(o)) || document.body;
  const fixo = e => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true; return false; };
  const textoCorrido = e => e.tagName === 'A' && e.parentElement &&
    [...e.parentElement.childNodes].some(n => n !== e && (n.textContent || '').trim() && !(n.nodeType === 1 && n.matches(SEL)));

  /* Checagens 1 e 2: botões/links.
     Regra das áreas roláveis: subindo pelos ancestrais, cada contêiner com overflow auto/scroll
     (lista horizontal de categorias, corpo rolável da janela) RECORTA o retângulo do botão — o que
     está fora da parte visível do contêiner se alcança rolando e não conta; se o recorte zera, o botão
     é ignorado. Já um ancestral com overflow hidden/clip NÃO recorta de graça: se o botão passa dele,
     o botão está cortado de verdade (falha). O que sobra do recorte tem que caber na tela.
     Na página (fora de janela/elemento fixo) só a horizontal conta: rolar para baixo é normal.
     O tamanho mínimo de toque é medido no retângulo inteiro do botão (não no recorte). */
  function botoes(toque, excecoes) {
    const vw = document.documentElement.clientWidth, vh = innerHeight, R = raiz();
    const fora = [], estouro = [], pequenos = [];
    const vistos = new Set();
    for (const e of R.querySelectorAll(SEL)) {
      if (!visivel(e) || vistos.has(e)) continue;
      vistos.add(e);
      const r0 = e.getBoundingClientRect();
      if (r0.width < 1 || r0.height < 1) continue;
      let r = {l: r0.left, t: r0.top, r: r0.right, b: r0.bottom}, cortado = null, sumiu = false;
      for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        const ox = cs.overflowX, oy = cs.overflowY;
        if (ox === 'visible' && oy === 'visible') continue;
        const q = a.getBoundingClientRect();
        const rola = /auto|scroll/.test(ox + oy);
        if (!rola && !cortado && (r.l < q.left - 1 || r.r > q.right + 1 || r.t < q.top - 1 || r.b > q.bottom + 1))
          cortado = `${nome(a)} corta: botão x ${f(r.l)}–${f(r.r)} y ${f(r.t)}–${f(r.b)}, contêiner x ${f(q.left)}–${f(q.right)} y ${f(q.top)}–${f(q.bottom)}`;
        r = {l: Math.max(r.l, q.left), t: Math.max(r.t, q.top), r: Math.min(r.r, q.right), b: Math.min(r.b, q.bottom)};
        if (r.r - r.l < 1 || r.b - r.t < 1) { sumiu = true; break; }
      }
      if (sumiu) continue;
      const vert = fixo(e);
      const sai = [];
      if (r.l < -1) sai.push(`esquerda ${f(r.l)}`);
      if (r.r > vw + 1) sai.push(`direita ${f(r.r)} > ${vw} (${f(r.r - vw)}px fora)`);
      if (vert && r.t < -1) sai.push(`topo ${f(r.t)}`);
      if (vert && r.b > vh + 1) sai.push(`base ${f(r.b)} > ${vh}`);
      if (sai.length) fora.push(`${nome(e)}: ${sai.join(', ')}`);
      if (cortado) fora.push(`${nome(e)}: ${cortado}`);
      // conteúdo estourando: no próprio botão e nos filhos diretos (elementos com caixa).
      // Exceção de medida (não de critério): um selo position:absolute de propósito saindo da caixa
      // de um filho (ex.: o contador "60" no canto do ícone da sacola) também aumenta o scrollWidth
      // do filho. Nesse caso medimos o conteúdo normal do filho pelos retângulos, sem o selo.
      for (const c of [e, ...e.children]) {
        if (c !== e && (!visivel(c) || !c.clientWidth)) continue;
        if (c.scrollWidth <= c.clientWidth + 1) continue;
        const abs = [...c.querySelectorAll('*')].filter(d => /absolute|fixed/.test(getComputedStyle(d).position));
        if (abs.length) {
          const q = c.getBoundingClientRect();
          let excesso = 0;
          const w = document.createTreeWalker(c, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {acceptNode: n => abs.some(a => a.contains(n)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
          let n; while ((n = w.nextNode())) {
            let rs; if (n.nodeType === 3) { const rg = document.createRange(); rg.selectNodeContents(n); rs = rg.getClientRects(); } else rs = n.getClientRects();
            for (const r1 of rs) if (r1.width) excesso = Math.max(excesso, r1.right - q.right, q.left - r1.left);
          }
          if (excesso <= 1) continue;
        }
        estouro.push(`${nome(e)}${c === e ? '' : ' > ' + nome(c)}: scrollWidth ${c.scrollWidth} > clientWidth ${c.clientWidth}`);
      }
      if (toque && (r0.width < 43.5 || r0.height < 43.5) && !textoCorrido(e) && !excecoes.some(s => e.matches(s)))
        pequenos.push(`${nome(e)}: ${f(r0.width)}x${f(r0.height)}`);
    }
    return {n: vistos.size, fora, estouro, pequenos};
  }

  // linhas ocupadas por um Range (agrupa retângulos pelo topo)
  function linhas(rg) {
    const tops = [...rg.getClientRects()].filter(q => q.width > 0.5).map(q => q.top).sort((a, b) => a - b);
    let n = 0, ult = -1e9; for (const t of tops) if (t > ult + 3) { n++; ult = t; }
    return n;
  }

  /* Checagem 5: cada palavra de título numa linha só. Palavra = trecho sem espaço e sem hífen
     ("X-Tudo" pode ir para a linha de baixo depois do hífen, que é ponto de quebra natural;
     o que não pode é "Hambúr|guer"). */
  function palavras(sel) {
    const R = raiz(), ruins = [];
    for (const el of R.querySelectorAll(sel)) {
      if (!visivel(el)) continue;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        if (!n.parentElement || !n.parentElement.getClientRects().length) continue;
        for (const m of n.textContent.matchAll(/[^\s\-‐–—]+/g)) {
          if (m[0].length < 2) continue;
          const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
          const k = linhas(rg);
          if (k > 1) ruins.push(`${nome(el)}: "${m[0]}" em ${k} linhas`);
        }
      }
    }
    return ruins;
  }

  // Checagem 3: #bagbtn
  function bag() {
    const b = document.getElementById('bagbtn');
    if (!b || b.hidden || !visivel(b)) return null;
    const r = b.getBoundingClientRect();
    let tit = null;
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const i = n.textContent.search(/ver meu pedido/i);
      if (i >= 0) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 14); tit = linhas(rg); break; }
    }
    return {h: f(r.height), w: f(r.width), tit};
  }

  // Checagem 4: toast x #bagbtn
  function toast() {
    const t = document.getElementById('toast'), b = document.getElementById('bagbtn');
    if (!t || t.hidden || !visivel(t)) return null;
    const a = t.getBoundingClientRect();
    const res = {texto: t.innerText.slice(0, 40), sobre: 0, cx: (a.left + a.right) / 2, cy: (a.top + a.bottom) / 2};
    if (b && !b.hidden && visivel(b)) {
      const q = b.getBoundingClientRect();
      const ix = Math.min(a.right, q.right) - Math.max(a.left, q.left), iy = Math.min(a.bottom, q.bottom) - Math.max(a.top, q.top);
      if (ix > 0.5 && iy > 0.5) res.sobre = f(iy);
      res.folga = f(q.top - a.bottom);
    }
    return res;
  }

  // Checagem 6: rolagem horizontal da página (tenta rolar para a direita) e do corpo da janela aberta
  function horizontal() {
    const y = scrollY; scrollTo(99999, y);
    const x = scrollX; scrollTo(0, y);
    const out = [];
    if (x > 0) out.push(`página rola ${x}px para o lado (scrollWidth ${document.documentElement.scrollWidth}, innerWidth ${innerWidth})`);
    const R = raiz();
    if (R !== document.body)
      for (const c of R.querySelectorAll('.sheet, .sh-body, .sh-foot, .sh-head'))
        if (visivel(c) && c.scrollWidth > c.clientWidth + 1) out.push(`${nome(c)}: scrollWidth ${c.scrollWidth} > clientWidth ${c.clientWidth}`);
    return out;
  }
  return {botoes, palavras, bag, toast, horizontal};
})();
"""

falhas, ok = [], 0
por_tipo = {}

def check(cond, nome, tipo):
    global ok
    if cond:
        ok += 1
        if VERBOSO: print("  ok  ", nome)
    else:
        falhas.append(nome); por_tipo[tipo] = por_tipo.get(tipo, 0) + 1
        print("  FALHOU", nome)

def lista(itens, mx=4):
    return "; ".join(itens[:mx]) + (f" (+{len(itens) - mx})" if len(itens) > mx else "")

def rodar(browser, ap):
    nome, w, h, toque, dsf, zoom = ap
    ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=toque, has_touch=toque,
                              device_scale_factor=dsf, reduced_motion="reduce", locale="pt-BR")
    ctx.add_init_script(JS)
    # nunca sair da página: WhatsApp/links externos bloqueados
    ctx.add_init_script("""window.open = () => null;
      document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('#enviar, #zapDireto, a[href*="wa.me"], a[href*="whatsapp"]'); if (a) e.preventDefault(); }, true);""")
    ctx.route(re.compile(r"https://(wa\.me|api\.whatsapp|fonts\.g).*"), lambda r: r.fulfill(status=200, body=""))
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    excecoes = list(EXCECOES_ALVO)
    n_antes = len(falhas)

    def carregar(sacola=None, ultimo=None):
        pg.goto(URL); pg.wait_for_selector("#carregando", state="detached")
        pg.evaluate("([s,u]) => { localStorage.clear(); if (s) localStorage.setItem('bp-sacola-v2', s); if (u) localStorage.setItem('bp-ultimo', u); }", [sacola, ultimo])
        pg.reload(); pg.wait_for_selector("#carregando", state="detached")
        pg.evaluate("document.fonts.ready")
        if zoom: pg.evaluate(f"document.documentElement.style.zoom = '{zoom}'")
        pg.wait_for_timeout(120)

    def medir(estado, titulos=None, bag=False, toast=False):
        rot = f"{nome} · {estado}"
        r = pg.evaluate("([t,x]) => window.__L.botoes(t,x)", [toque, excecoes])
        check(not r["fora"], f"{rot} · botões dentro da tela ({r['n']} medidos) {lista(r['fora'])}", "1. botão fora da tela/cortado")
        check(not r["estouro"], f"{rot} · conteúdo dos botões cabe {lista(r['estouro'])}", "1. conteúdo estourando o botão")
        if toque:
            check(not r["pequenos"], f"{rot} · alvos de toque >= 44x44 {lista(r['pequenos'], 6)}", "2. alvo de toque < 44x44")
        if bag:
            b = pg.evaluate("window.__L.bag()")
            check(b is not None, f"{rot} · #bagbtn aparece", "3. #bagbtn")
            if b:
                lim = ALTURA_BAG[zoom]
                check(b["tit"] == 1, f"{rot} · #bagbtn \"Ver meu pedido\" em 1 linha (medido: {b['tit']} linhas)", "3. #bagbtn título em várias linhas")
                check(b["h"] <= lim, f"{rot} · #bagbtn altura {b['h']}px <= {lim}px", "3. #bagbtn alto demais")
        if toast:
            t = pg.evaluate("window.__L.toast()")
            check(t is not None, f"{rot} · toast aparece", "4. toast")
            if t:
                check(t["sobre"] == 0, f"{rot} · toast não cobre o #bagbtn (sobreposição {t['sobre']}px, folga {t.get('folga')}px, \"{t['texto']}\")", "4. toast cobre o #bagbtn")
        if titulos:
            p = pg.evaluate("s => window.__L.palavras(s)", titulos)
            check(not p, f"{rot} · palavras de título inteiras {lista(p)}", "5. palavra de título partida")
        hz = pg.evaluate("window.__L.horizontal()")
        check(not hz, f"{rot} · sem rolagem horizontal {lista(hz)}", "6. rolagem horizontal")
        if toast and t:
            # 4b. tocar no centro do aviso: ele some, nada abre, a sacola não muda (toque não vaza)
            antes = pg.evaluate("localStorage.getItem('bp-sacola-v2')")
            if toque: pg.touchscreen.tap(t["cx"], t["cy"])
            else: pg.mouse.click(t["cx"], t["cy"])
            try:
                pg.wait_for_function("() => { const e = document.getElementById('toast'); return !e || e.hidden || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden' || +getComputedStyle(e).opacity === 0; }", timeout=600)
                sumiu = True
            except Exception:
                sumiu = False
            pg.wait_for_timeout(150)
            abertas = pg.evaluate("['ovItem','ovBag'].filter(i => { const o = document.getElementById(i); return o && !o.hidden && o.getClientRects().length; })")
            depois = pg.evaluate("localStorage.getItem('bp-sacola-v2')")
            check(sumiu, f"{rot} · tocar no toast fecha o aviso em até 600ms", "4. toque no toast não fecha o aviso")
            check(not abertas, f"{rot} · tocar no toast não abre janela (abriu: {', '.join('#' + a for a in abertas)})", "4. toque no toast vaza e abre janela")
            check(antes == depois, f"{rot} · tocar no toast não muda a sacola" + ("" if antes == depois else f" (antes {len(json.loads(antes or '[]'))} linhas, depois {len(json.loads(depois or '[]'))} linhas)"), "4. toque no toast muda a sacola")

    JANELA = ".sheet h3"
    # --- vazio (com "Pedir de novo") + busca ---
    carregar(None, TRES_LINHAS)
    medir("vazio", titulos="main h2, main .name, .promo h2, .promo h3")
    pg.fill("#busca", "frango"); pg.wait_for_timeout(200)
    medir("busca", titulos="#resultados .name")
    # --- 1 item + janela do lanche em cada passo (cliques reais) ---
    carregar(UM_ITEM)
    medir("1 item", bag=True)
    b = pg.locator('button.add[aria-label="Pedir X-Tudo"]').first
    b.scroll_into_view_if_needed(); b.click()
    pg.wait_for_selector("#ovItem:not([hidden])"); pg.wait_for_timeout(150)
    medir("lanche: quantidade", titulos=JANELA)
    for _ in range(9): pg.click('#ovItem [data-qd="1"]')
    medir("lanche: quantidade 10")
    pg.click('#itFoot [data-acao="continuar"]'); pg.wait_for_timeout(120)
    medir("lanche: iguais ou diferentes?")
    pg.click('#ovItem [data-modo="diferentes"]'); pg.wait_for_timeout(120)
    medir("lanche: do seu jeito (diferentes)")
    pg.locator("#ovItem .trocar").first.click(); pg.wait_for_timeout(120)
    for a in ("complementos/catupiry", "complementos/bacon", "complementos/hamburguer"):
        pg.locator(f'#ovItem .opt[data-add="{a}"]').first.click()
    medir("lanche: do seu jeito (3 adicionais)")
    pg.click('#itFoot [data-acao="continuar"]'); pg.wait_for_selector('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(120)
    medir("lanche: conferir (10x com adicionais)")
    pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_selector("#ovItem", state="hidden"); pg.wait_for_timeout(250)
    medir("depois de adicionar (toast)", bag=True, toast=True)
    # --- 3 linhas com adicionais + sacola em cada passo ---
    carregar(TRES_LINHAS)
    medir("3 linhas", bag=True)
    pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])"); pg.wait_for_timeout(150)
    medir("sacola: lista", titulos=JANELA)
    pg.evaluate("document.querySelector('#stepBag').scrollTop = 1e6"); pg.wait_for_timeout(80)
    medir("sacola: lista rolada até o fim")
    pg.click("#irNome"); pg.wait_for_selector("#footNome:not([hidden])"); pg.wait_for_timeout(150)
    medir("sacola: nome", titulos=JANELA)
    pg.fill("#nome", "Maria Aparecida"); pg.click("#enviar"); pg.wait_for_selector("#footOk:not([hidden])"); pg.wait_for_timeout(150)
    medir("sacola: enviado", titulos=JANELA)
    # --- 60 itens / total alto + aviso longo do limite ---
    carregar(LIMITE)
    medir("60 itens", bag=True)
    pg.locator(".list .add").first.click(); pg.wait_for_timeout(250)
    medir("60 itens: aviso do limite (toast)", bag=True, toast=True)
    carregar(LIMITE)   # o toque no toast pode ter aberto uma janela (defeito): recomeça limpo
    pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])"); pg.wait_for_timeout(150)
    medir("60 itens: sacola")
    ctx.close()
    return len(falhas) - n_antes

with sync_playwright() as p:
    browser = p.chromium.launch()
    t0 = time.time()
    print(f"Layout de botões em {URL} — {len(APARELHOS)} aparelhos")
    for ap in APARELHOS:
        t = time.time()
        print(f"\n[{ap[0]}]")
        try:
            nf = rodar(browser, ap)
        except Exception as e:
            nf = 1; check(False, f"{ap[0]} · o teste não conseguiu percorrer o fluxo: {repr(e)[:300]}", "0. erro ao percorrer o fluxo")
        print(f"  {ap[0]}: {nf} falhas ({time.time() - t:.1f}s)")
    browser.close()

print("\nFalhas por tipo:")
for k in sorted(por_tipo): print(f"  {por_tipo[k]:4d}  {k}")
print(f"\nRESULTADO: {ok} ok, {len(falhas)} falhas ({time.time() - t0:.0f}s)")
sys.exit(1 if falhas else 0)
