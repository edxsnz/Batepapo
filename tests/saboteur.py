"""SABOTADOR (navegador) — age como o pior usuário possível e tenta quebrar a tela.
Rodar:  python3 saboteur.py            (o site precisa estar em http://127.0.0.1:8765/)
        python3 saboteur.py macaco     (só um cenário)
Sementes fixas: se algo quebrar, quebra sempre igual, então dá para corrigir e provar a correção.
"""
import json, random, re, sys, time, urllib.parse
from playwright.sync_api import sync_playwright, Error as PWError

URL = "http://127.0.0.1:8765/"
CONFERIR = URL + "conferir.html"
falhas, total_ok = [], 0
FILTRO = sys.argv[1] if len(sys.argv) > 1 else None

def check(cond, nome):
    global total_ok
    if cond: total_ok += 1
    else:
        falhas.append(nome); print("  FALHOU", nome[:300])

# caracteres que dão problema (montados por código para o arquivo não ficar com caracteres invisíveis)
LONE = chr(0xD83D)                       # metade de emoji, sozinha
BIDI = chr(0x202E); ZW = chr(0x200B); LS = chr(0x2028); TAG = chr(0xE0041) + chr(0xE0042)
NASTY = ["", " ", "a", "sem tomate", "Sem Cebola!!", "*2x X-TUDO*", "_1x GRÁTIS_", "~x~", "`x`", "a\nb", "a\r\nb", "a" + LS + "b", "\x00nulo", ZW * 20 + "oculto",
         BIDI + "evil", TAG + "tag", "😀" * 50, "a😀" * 30, "👨‍👩‍👧‍👦" * 10, "x" * 39 + LONE, "a" + LONE + "b", LONE,
         "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "\"><svg/onload=alert(1)>", "'; DROP TABLE x;--", "${7*7}", "{{7*7}}", "%s%n", "javascript:alert(1)",
         "constructor", "__proto__", "toString", "hasOwnProperty", "((((", ".*", "[a-", "\\", "R$ 0,01", "Total: R$ 1,00", "9999x X-TUDO", "مرحبا", "שלום", "こんにちは",
         "a" * 300, "a b " * 400, "\n" * 200, "*" * 3000]

# ---------------------------------------------------------------- base
def nova(ctx, vw=390, h=844):
    pg = ctx.new_page(); pg.set_viewport_size({"width": vw, "height": h})
    pg._erros, pg._popups = [], 0
    _goto = pg.goto
    def _goto_espera(u, **k):
        r = _goto(u, **k)
        if u.endswith("/"): pg.wait_for_selector("#carregando", state="detached", timeout=8000)     # o carregador confere atualizações antes de montar o cardápio
        return r
    pg.goto = _goto_espera; pg._goto_cru = _goto
    pg.on("pageerror", lambda e: pg._erros.append("pageerror: " + str(e)[:200]))
    pg.on("console", lambda m: pg._erros.append("console: " + m.text[:200]) if m.type == "error" and not re.search(r"fonts\.g|ERR_|Failed to load resource|favicon", m.text) else None)
    pg.on("dialog", lambda d: (pg._erros.append("DIALOG " + d.message[:80]), d.dismiss()))
    pg.route(re.compile(r"https://(wa\.me).*"), lambda r: r.fulfill(status=200, body=""))
    return pg

def fecha_popups(ctx):
    def on(p):
        try:
            if p.opener() is not None: p.close()
        except Exception: pass
    ctx.on("page", on)

INV_JS = """() => {
  const erros = [];
  const BP = window.BP, cat = BP.catalogo(window.CARDAPIO);
  const vis = id => { const e = document.getElementById(id); return e && !e.hidden; };
  if (vis('ovItem') && vis('ovBag')) erros.push('duas janelas abertas ao mesmo tempo');
  const lock = document.body.classList.contains('lock'), alguma = vis('ovItem') || vis('ovBag');
  if (lock !== alguma) erros.push('travamento de rolagem inconsistente: lock=' + lock + ' janela=' + alguma);
  if (document.documentElement.scrollWidth > innerWidth + 1) erros.push('rolagem lateral: ' + document.documentElement.scrollWidth + ' > ' + innerWidth);
  let guardada = []; try { guardada = JSON.parse(localStorage.getItem('bp-sacola-v2') || '[]'); } catch (e) {}
  const s = BP.validarSacola(guardada, cat);
  const n = BP.contar(s);
  if (n > 60) erros.push('mais de 60 itens: ' + n);
  const bagN = document.getElementById('bagN').textContent, bagV = document.getElementById('bagV').textContent;
  if (!document.getElementById('bagbtn').hidden) {
    if (String(n) !== bagN) erros.push('contador diz ' + bagN + ' mas a sacola guardada tem ' + n);
    if (BP.brl(BP.totalSacola(s, cat)) !== bagV) erros.push('total na tela ' + bagV + ' ≠ preço oficial ' + BP.brl(BP.totalSacola(s, cat)));
  }
  const txt = document.body.innerText;
  const lixo = txt.match(/undefined|NaN|\\[object|null\\b|function \\w+\\(/);
  if (lixo) erros.push('texto quebrado na tela: "' + lixo[0] + '"');
  const intruso = document.querySelectorAll('#menu img,#resultados img,#ovItem img,#ovBag img,iframe,object,embed,[onerror],[onload],[onclick],#menu script,#ovItem script,#ovBag script,#resultados script,#menu style');
  if (intruso.length) erros.push('elemento intruso na página: ' + intruso[0].outerHTML.slice(0, 80));
  const animando = document.getAnimations().some(a => a.playState === 'running' || a.playState === 'pending');
  for (const id of ['ovItem', 'ovBag']) if (vis(id) && !animando) {
    const bt = [...document.getElementById(id).querySelectorAll('.sh-foot button, .sh-foot a, #itFoot button')].filter(b => b.offsetParent);
    for (const b of bt) { const r = b.getBoundingClientRect(); if (r.bottom > innerHeight + 1 || r.top < -1) { erros.push('botão "' + b.textContent.trim().slice(0, 20) + '" fora da tela em ' + id + ' (top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' innerH=' + innerHeight + ' tr=' + getComputedStyle(b.closest('.sheet')).transform + ' sheetTop=' + Math.round(b.closest('.sheet').getBoundingClientRect().top) + ' anims=' + document.getAnimations().map(a => a.playState + ':' + (a.effect && a.effect.target ? a.effect.target.className : '')).join('|') + ' sheetH=' + Math.round(b.closest('.sheet').getBoundingClientRect().height) + ')'); break; } }
  }
  return erros;
}"""

def inv(pg, rot):
    try: e = pg.evaluate(INV_JS)
    except PWError as ex: e = ["não deu para checar: " + str(ex)[:100]]
    e = list(e) + pg._erros[:3]
    pg._erros.clear()
    check(not e, f"{rot}: {e[:3]}")
    return not e

def abrir_item(pg, nome):
    pg.locator(f'.item:has(.name:text-is("{nome}")) .add').first.click()
    pg.wait_for_selector("#ovItem:not([hidden])")

def set_valor(pg, sel, valor):
    """Escreve no campo direto pelo JavaScript (passa por cima do maxlength e aceita metade de emoji)."""
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); }", [sel, valor])

def sacola(pg): return pg.evaluate("() => JSON.parse(localStorage.getItem('bp-sacola-v2') || '[]')")
def contar(pg): return pg.evaluate("() => window.BP.contar(window.BP.validarSacola(JSON.parse(localStorage.getItem('bp-sacola-v2') || '[]'), window.BP.catalogo(window.CARDAPIO)))")

# ---------------------------------------------------------------- 1. macaco
CANDIDATOS = """() => { const out = [];
  for (const el of document.querySelectorAll('button,a[href],.item,.pcard,.promo,input,.overlay,[data-close],.chip')) {
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
    const top = document.elementFromPoint(cx, cy); if (!top || !(el === top || el.contains(top))) continue;
    out.push([cx, cy, el.tagName, el.id || '']); }
  return out; }"""

def macaco(b, semente, vw, h, passos=110):
    rnd = random.Random(semente)
    ctx = b.new_context(); pg = nova(ctx, vw, h); pg.goto(URL); pg.wait_for_timeout(250); fecha_popups(ctx)
    rot = f"macaco#{semente} {vw}x{h}"
    acoes = []
    for i in range(passos):
        try:
            r = rnd.random()
            if pg.url.split("#")[0] != URL: pg.goto(URL); pg.wait_for_timeout(150)
            if r < 0.55:
                c = pg.evaluate(CANDIDATOS)
                if c:
                    x, y, tag, idd = rnd.choice(c); acoes.append(f"clique {tag}#{idd}")
                    n = rnd.choice([1, 1, 1, 2, 3])
                    for _ in range(n): pg.mouse.click(x + rnd.uniform(-1, 1), y + rnd.uniform(-1, 1))
            elif r < 0.70:
                alvo = pg.evaluate("() => { const l = [...document.querySelectorAll('input:not([type=hidden])')].filter(e => e.offsetParent); return l.length ? l[Math.floor(Math.random() * l.length)].id || l[0].dataset.obs && ('[data-obs=\"' + l[0].dataset.obs + '\"]') : null }")
                sel = "#" + alvo if alvo and not alvo.startswith("[") else alvo
                texto = rnd.choice(NASTY); acoes.append("digitar " + repr(texto[:15]))
                if sel: set_valor(pg, sel, texto)
            elif r < 0.78:
                k = rnd.choice(["Escape", "Tab", "Shift+Tab", "Enter", "Space", "ArrowDown", "ArrowUp", "Backspace"]); acoes.append("tecla " + k); pg.keyboard.press(k)
            elif r < 0.84:
                acoes.append("voltar/avançar"); (pg.go_back if rnd.random() < .7 else pg.go_forward)(timeout=1500)
            elif r < 0.88:
                acoes.append("recarregar"); pg.reload(); pg.wait_for_timeout(150)
            elif r < 0.93:
                acoes.append("rolar"); pg.mouse.wheel(0, rnd.randint(-1500, 1500))
            elif r < 0.96:
                nw, nh = rnd.choice([(240, 400), (320, 568), (390, 844), (768, 1024), (1280, 720), (568, 320)]); acoes.append(f"redimensionar {nw}x{nh}"); pg.set_viewport_size({"width": nw, "height": nh})
            else:
                acoes.append("buscar"); pg.evaluate("t => { const e = document.getElementById('busca'); e.value = t; e.dispatchEvent(new Event('input', {bubbles: true})); }", rnd.choice(NASTY))
            pg.wait_for_timeout(rnd.choice([0, 10, 30, 60]))
        except PWError as ex:
            if "closed" in str(ex).lower(): break          # a página foi fechada (ex: saiu do site pelo voltar): ok
        if pg.url.split("#")[0] != URL: pg.goto(URL); pg.wait_for_timeout(150)       # o "voltar" saiu do site: volta antes de conferir
        if i % 4 == 3 and not inv(pg, f"{rot} passo {i} (últimas ações: {acoes[-4:]})"): break
    inv(pg, f"{rot} final")
    ctx.close()

def cenario_macaco(b):
    print("\n[1] MACACO — clica, digita, volta, recarrega e redimensiona sem parar")
    for s in range(1, 7): macaco(b, s, 390, 844)
    for s, (vw, h) in {11: (320, 568), 12: (1280, 720), 13: (240, 400), 14: (568, 320)}.items(): macaco(b, s, vw, h)

# ---------------------------------------------------------------- 2. armazenamento hostil
def cenario_storage(b):
    print("\n[2] ARMAZENAMENTO — navegador que não guarda, guarda lixo ou está cheio")
    def contexto(init):
        ctx = b.new_context(); ctx.add_init_script(init); return ctx
    def add_dois(pg):
        pg.goto(URL); pg.wait_for_timeout(250)
        abrir_item(pg, "X-Salada"); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
        abrir_item(pg, "X-Bacon"); pg.click('#itBody [data-setq="2"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itBody [data-modo="iguais"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
    # 2a: o armazenamento enche NO MEIO do pedido (o primeiro item foi gravado, os outros não)
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250)
    def add(nome, qtd=1):
        abrir_item(pg, nome); pg.click(f'#itBody [data-setq="{qtd}"]') if qtd > 1 else None
        pg.click('#itFoot [data-acao="continuar"]')
        if qtd > 1: pg.click('#itBody [data-modo="iguais"]')
        pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(480)
    add("X-Salada")
    pg.evaluate("() => { Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError'); }; }")
    add("X-Bacon", 2); add("X-Burguer"); add("X-Egg")
    check(pg.text_content("#bagN") == "5", f"armazenamento encheu no meio do pedido: a sacola esqueceu itens (bagN={pg.text_content('#bagN')}, esperado 5)")
    pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])"); pg.click('.line:has-text("X-Salada") [data-q="1"]'); pg.wait_for_timeout(50)
    check(pg.text_content("#bagN") == "6", f"mudar quantidade com armazenamento cheio (bagN={pg.text_content('#bagN')}, esperado 6)")
    check(not pg._erros, f"2a sem erros {pg._erros[:2]}"); ctx.close()
    # 2b: ler falha sempre
    ctx = contexto("Storage.prototype.getItem = function () { throw new DOMException('negado', 'SecurityError'); }"); pg = nova(ctx)
    add_dois(pg); check(pg.text_content("#bagN") == "3", f"armazenamento que recusa ler (bagN={pg.text_content('#bagN')})"); check(not pg._erros, f"2b sem erros {pg._erros[:2]}"); ctx.close()
    # 2c: localStorage inteiro some (modo privado extremo / cookies bloqueados)
    ctx = contexto("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } })"); pg = nova(ctx)
    add_dois(pg); check(pg.text_content("#bagN") == "3", f"sem localStorage (bagN={pg.text_content('#bagN')})")
    pg.click("#bagbtn"); pg.click("#irNome"); set_valor(pg, "#nome", "Maria")
    check("text=" in pg.get_attribute("#enviar", "href"), "mesmo sem armazenamento dá para montar o pedido"); check(not pg._erros, f"2c sem erros {pg._erros[:2]}"); ctx.close()
    # 2d: valores envenenados
    venenos = {
        "null": "null", "zero": "0", "falso": "false", "texto": '"oi"', "objeto": "{}", "lista vazia": "[]", "json quebrado": "{[", "vazio": "",
        "proto": '[{"__proto__":{"id":"hamburguer/x-tudo","qtd":9},"id":"hamburguer/x-tudo","qtd":2}]',
        "id em lista": '[{"id":["hamburguer/x-tudo"],"qtd":[2],"adds":[["complementos/bacon"],"complementos/bacon"]}]',
        "constructor": '[{"id":"constructor","qtd":2},{"id":"__proto__","qtd":2},{"id":"toString","qtd":1}]',
        "preço no item": '[{"id":"hamburguer/x-tudo","qtd":1,"preco":0.01,"price":0,"total":0}]',
        "qtd absurda": '[{"id":"hamburguer/x-tudo","qtd":1e308},{"id":"hamburguer/x-salada","qtd":-1e308},{"id":"hamburguer/x-egg","qtd":"9".repeat(400)}]',
        "profundo": "[" * 20000 + "]" * 20000,
        "gigante": "[" + ",".join(['{"id":"hamburguer/x-tudo","qtd":1,"obs":"' + "a" * 200 + '"}'] * 15000) + "]",
        "obs invisível": '[{"id":"hamburguer/x-tudo","qtd":1,"obs":"' + "\\u202e\\u200b" * 50 + 'sem tomate"}]',
    }
    for nome, v in venenos.items():
        ctx = b.new_context(); pg = nova(ctx)
        pg.goto(URL); pg.evaluate("v => { localStorage.setItem('bp-sacola-v2', v); localStorage.setItem('bp-nome', '<img src=x onerror=alert(1)>' + String.fromCharCode(0xD83D)); }", v)
        t0 = time.time(); pg.reload(); pg.wait_for_timeout(300); dt = time.time() - t0
        check(dt < 4, f"sacola envenenada '{nome}' demorou {dt:.1f}s para abrir")
        if pg.locator("#bagbtn").is_visible():
            pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])"); pg.click("#irNome"); pg.wait_for_timeout(100)
            check("%EF%BF%BD" not in (pg.get_attribute("#enviar", "href") or ""), f"'{nome}': nome guardado com emoji cortado entrou no link")
        inv(pg, f"sacola envenenada '{nome}'"); ctx.close()
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    for k, v in {"bp-nome": "x" * 3_000_000, "bp-boasvindas": "talvez", "bp-sacola-v2": '{"length":99999999}'}.items(): pg.evaluate("([k, v]) => localStorage.setItem(k, v)", [k, v])
    pg.reload(); pg.wait_for_timeout(300); inv(pg, "nome guardado com 3 milhões de letras"); ctx.close()

# ---------------------------------------------------------------- 3. HTML adulterado pelo usuário
def cenario_dom(b):
    print("\n[3] ADULTERAÇÃO — o usuário mexe no HTML pelo DevTools antes de clicar")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250)
    for falso in ["__proto__", "constructor", "complementos/bacon", "", "x/y", 'hamburguer/x-tudo"><img src=x onerror=alert(1)>', "hamburguer/x-tudo\n", "HAMBURGUER/X-TUDO"]:
        pg.evaluate("v => { const a = document.querySelector('.item .add'); a.dataset.id = v; a.closest('.item').dataset.id = v; a.click(); }", falso)
        pg.wait_for_timeout(120)
        if pg.locator("#ovItem:not([hidden])").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
        inv(pg, f"botão com data-id={falso[:25]!r}")
    pg.reload(); pg.wait_for_timeout(250)
    abrir_item(pg, "X-Tudo")
    for sel, atrib, valores in [('[data-setq]', 'setq', ["abc", "-5", "1e9", "99999", "0.5", "", "NaN", "__proto__"]), ('[data-qd]', 'qd', ["NaN", "1e9", "-1e9", "abc", ""])]:
        for v in valores:
            pg.evaluate("([s, a, v]) => { const e = document.querySelector(s); if (e) { e.dataset[a] = v; e.click(); } }", [sel, atrib, v]); pg.wait_for_timeout(40)
            ok = pg.evaluate("() => { const o = document.querySelector('#itBody output'); return o ? o.textContent : 'x' }")
            check(re.fullmatch(r"\d+", ok or "") and 1 <= int(ok) <= 30, f"{atrib}={v!r} deixou a quantidade em {ok!r}")
    pg.click('#itBody [data-setq="3"]') if pg.locator('#itBody [data-setq="3"]').count() else None
    pg.click('#itFoot [data-acao="continuar"]')
    for v in ["xyz", "", "__proto__", "IGUAIS"]:
        pg.evaluate("v => { const e = document.querySelector('[data-modo]'); if (e) { e.dataset.modo = v; e.click(); } }", v); pg.wait_for_timeout(40)
    inv(pg, "data-modo adulterado")
    pg.click('#itFoot [data-acao="voltar"]'); pg.click('#itFoot [data-acao="continuar"]')      # recomeça a pergunta (o botão adulterado não vale mais)
    pg.click('#itBody [data-modo="iguais"]')
    for k, add in [("999", "complementos/bacon"), ("__proto__", "complementos/bacon"), ("-1", "x"), ("c", "__proto__"), ("c", "hamburguer/x-egg"), ("c", ""), ("0", "complementos/ovo")]:
        pg.evaluate("([k, a]) => { const e = document.querySelector('.opt'); if (e) { e.dataset.k = k; e.dataset.add = a; e.click(); } }", [k, add]); pg.wait_for_timeout(30)
    inv(pg, "adicional adulterado")
    pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]') if pg.locator('#itFoot [data-acao="continuar"]').count() else None
    if pg.locator('#itFoot [data-acao="confirmar"]').count(): pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
    inv(pg, "depois de confirmar com dados adulterados")
    n0 = contar(pg)
    pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])")
    for v in ["1e9", "abc", "-1e9", "", "0.0001", "NaN"]:
        pg.evaluate("v => { const e = document.querySelector('[data-q]'); if (e) { e.dataset.q = v; e.click(); } }", v); pg.wait_for_timeout(30)
        inv(pg, f"data-q={v!r}")
    for v in ["", "x", "__proto__", "999"]:
        pg.evaluate("v => { const e = document.querySelector('[data-rm],[data-q]'); if (e) { e.dataset.k = v; e.dataset.rm = v; e.click(); } }", v); pg.wait_for_timeout(30)
    inv(pg, "data-k e data-rm adulterados")
    # preços adulterados DEPOIS de carregado não podem mudar o total
    pg.evaluate("() => { try { window.CARDAPIO.forEach(c => c.itens.forEach(i => i.preco = 0.01)); } catch (e) {} try { window.BP.totalSacola = () => 0; } catch (e) {} try { window.BP.centavos = () => 1; } catch (e) {} }")
    pg.click('.line [data-q="1"]') if pg.locator('.line [data-q="1"]').count() else None
    inv(pg, "preços do cardapio.js e BP adulterados depois de carregar")
    ctx.close()

# ---------------------------------------------------------------- 4. duas abas
def cenario_abas(b):
    print("\n[4] DUAS ABAS — mexendo na mesma sacola ao mesmo tempo")
    ctx = b.new_context(); A = nova(ctx); B = nova(ctx)
    A.goto(URL); A.evaluate("localStorage.setItem('bp-sacola-v2', JSON.stringify([{id:'hamburguer/x-tudo',qtd:1,adds:[],obs:''},{id:'hamburguer/x-salada',qtd:1,adds:[],obs:''}]))")
    A.reload(); B.goto(URL); A.wait_for_timeout(250); B.wait_for_timeout(250); fecha_popups(ctx)
    for p in (A, B): p.click("#bagbtn"); p.wait_for_selector("#ovBag:not([hidden])")
    for i in range(10):
        A.click('.line:has-text("X-Tudo") [data-q="1"]'); B.click('.line:has-text("X-Tudo") [data-q="1"]')
    check(contar(A) == 22, f"20 cliques alternados nas duas abas: esperado 22 itens, deu {contar(A)}")
    A.wait_for_timeout(150); check(A.text_content("#bagN") == B.text_content("#bagN") == "22", f"as duas abas mostram o mesmo número ({A.text_content('#bagN')} / {B.text_content('#bagN')})")
    # B remove o X-Tudo; A (que ainda mostra a linha) clica "+" — não pode ressuscitar nem mexer em outra linha
    B.click('.line:has-text("X-Tudo") [data-rm]'); B.wait_for_timeout(100)
    A.evaluate("() => { const l = [...document.querySelectorAll('.line')].find(x => x.textContent.includes('X-Tudo')); if (l) l.querySelector('[data-q=\"1\"]').click(); }")
    ids = [l["id"] for l in sacola(A)]
    check(ids == ["hamburguer/x-salada"] and sacola(A)[0]["qtd"] == 1, f"clique numa linha que outra aba removeu mexeu errado: {sacola(A)}")
    # limite de 60 com as duas abas adicionando
    A.evaluate("localStorage.setItem('bp-sacola-v2', JSON.stringify([{id:'hamburguer/x-tudo',qtd:30,adds:[],obs:''},{id:'hamburguer/x-salada',qtd:29,adds:[],obs:''}]))")
    A.reload(); B.reload(); A.wait_for_timeout(250)
    for p in (A, B):
        abrir_item(p, "X-Egg"); p.click('#itFoot [data-acao="continuar"]'); p.click('#itFoot [data-acao="continuar"]')
    A.click('#itFoot [data-acao="confirmar"]'); B.click('#itFoot [data-acao="confirmar"]'); A.wait_for_timeout(500); B.wait_for_timeout(300)
    check(contar(A) == 60, f"duas abas adicionando o último item: esperado 60, deu {contar(A)}")
    inv(A, "aba A depois da corrida"); inv(B, "aba B depois da corrida")
    # uma aba limpa tudo (localStorage.clear) enquanto a outra está com o pedido aberto
    B.click("#bagbtn"); B.wait_for_selector("#ovBag:not([hidden])"); B.click("#irNome")
    A.evaluate("localStorage.clear()"); B.wait_for_timeout(200)
    inv(B, "outra aba limpou tudo no meio do pedido")
    ctx.close()

# ---------------------------------------------------------------- 5. histórico e botão voltar
def cenario_historico(b):
    print("\n[5] HISTÓRICO — botão voltar do celular, recarregar e mexer no endereço")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250)
    h0 = pg.evaluate("history.length")
    for i in range(25):
        pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])"); pg.keyboard.press("Escape"); pg.wait_for_selector("#ovItem", state="hidden"); pg.wait_for_timeout(420)
    check(pg.evaluate("history.length") <= h0 + 2, f"abrir/fechar 25 vezes aumentou o histórico de {h0} para {pg.evaluate('history.length')}")
    inv(pg, "depois de 25 aberturas")
    pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])"); pg.go_back(); pg.wait_for_timeout(200)
    check(pg.locator("#ovItem").is_hidden(), "voltar fecha a janela"); pg.go_forward(); pg.wait_for_timeout(200)
    check(pg.locator("#ovItem").is_hidden(), "avançar não reabre janela fantasma"); inv(pg, "voltar + avançar")
    pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])")
    pg.evaluate("location.hash = '#sec-porcoes'"); pg.wait_for_timeout(200); inv(pg, "mudou o endereço com a janela aberta")
    pg.evaluate("history.pushState({bp:'ovBag'}, '')"); pg.evaluate("window.dispatchEvent(new PopStateEvent('popstate', {state: {bp: 'ovBag'}}))"); pg.wait_for_timeout(100); inv(pg, "popstate falso")
    pg.reload(); pg.wait_for_timeout(250); check(pg.locator("#ovItem").is_hidden() and pg.locator("#ovBag").is_hidden(), "recarregar com janela aberta volta ao cardápio"); inv(pg, "depois de recarregar")
    pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])")
    pg.evaluate("() => { document.querySelector('#ovItem [data-close]').click(); history.back(); document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); }"); pg.wait_for_timeout(500)
    inv(pg, "fechar por três caminhos ao mesmo tempo")
    # voltar até sair do site e voltar
    for _ in range(6):
        try: pg.go_back(timeout=1500)
        except PWError: break
    pg.goto(URL); pg.wait_for_timeout(200); inv(pg, "depois de sair e voltar")
    ctx.close()

# ---------------------------------------------------------------- 6. busca
def cenario_busca(b):
    print("\n[6] BUSCA — textos de ataque na barra de pesquisa")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250)
    extras = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "x" * 100000, "x tudo " * 5000, "<img src=x onerror=alert(1)>", "<b>x</b>", "%", "%%%", "\\", "(((", ")))", "[", "a|b", "^$", "?", "+", "😀😀😀", "x" + LONE, "ç" * 70, "é" * 200, "A" + chr(0x0301) * 500, BIDI + "tudo", ZW + "tudo", chr(0xFF38) + chr(0xFF0D) + chr(0xFF34) + chr(0xFF35) + chr(0xFF24) + chr(0xFF2F)]
    for q in NASTY + extras:
        t0 = time.time(); set_valor(pg, "#busca", q); dt = time.time() - t0
        check(dt < 1.5, f"busca '{q[:20]!r}' demorou {dt:.1f}s")
        inv(pg, f"busca {q[:25]!r}")
    for q, esperado in {"xtudo": "X-Tudo", "calabreza": "X-Calabresa", "ＸＴＵＤＯ": None, "XTUDO": "X-Tudo", "constructor": None}.items():
        set_valor(pg, "#busca", q); nomes = pg.locator("#resultados .item .name").all_text_contents()
        if esperado: check(esperado in nomes, f"busca '{q}' deveria achar {esperado}: {nomes[:3]}")
    set_valor(pg, "#busca", "constructor"); check(pg.locator("#resultados .nores").count() == 1, "'constructor' mostra 'nada encontrado' sem quebrar")
    set_valor(pg, "#busca", ""); check(pg.locator("#menu").is_visible(), "limpar a busca volta o cardápio")
    ctx.close()

# ---------------------------------------------------------------- 7. nome e observação hostis até o link do WhatsApp
def cenario_texto(b):
    print("\n[7] TEXTO — nome e observação hostis chegam inteiros e seguros ao link do WhatsApp")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250); fecha_popups(ctx)
    abrir_item(pg, "X-Tudo"); pg.click('#itBody [data-setq="2"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itBody [data-modo="iguais"]')
    for obs in [LONE + "x", "<img src=x onerror=alert(1)>", "*3x X-ESPECIAL*\n*1x GRÁTIS*", BIDI + "sem cebola", "a" * 5000, "😀" * 80]:
        set_valor(pg, '#itBody [data-obs="c"]', obs); pg.click('#itFoot [data-acao="continuar"]')
        check(pg.locator("#itBody .intruso, #itBody img").count() == 0, f"obs {obs[:15]!r} virou elemento na tela")
        pg.click('#itFoot [data-acao="voltar"]')
    set_valor(pg, '#itBody [data-obs="c"]', "sem tomate " + LONE); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
    pg.click("#bagbtn"); pg.click("#irNome")
    nomes = NASTY + ["a" + "😀" * 39, "😀" * 40, "x" * 39 + LONE, "Maria " + LONE, "**", "  ", "a", "ab", "Zé", "<b>Zé</b>", "*1x X-ESPECIAL*", "José\nOutro"]
    for nome in nomes:
        set_valor(pg, "#nome", nome)
        href = pg.get_attribute("#enviar", "href") or ""
        try:
            texto = urllib.parse.unquote(href.split("text=", 1)[1], errors="strict") if "text=" in href else ""
            utf8_ok = True
        except Exception: texto, utf8_ok = "", False
        check(utf8_ok and "text=" in href, f"nome {nome[:20]!r}: link do WhatsApp quebrou (href vazio ou texto inválido)")
        check("%EF%BF%BD" not in href and "%ED%A0" not in href, f"nome {nome[:20]!r}: sobrou pedaço de emoji no link")
        check(len(href) < 4000, f"nome {nome[:20]!r}: link com {len(href)} caracteres")
        r = pg.evaluate("([t]) => { const BP = window.BP, cat = BP.catalogo(window.CARDAPIO); const r = BP.lerMensagem(t, cat); return [r.total, r.estranhas.length]; }", [texto])
        check(r[1] == 0 and r[0] == int(pg.evaluate("() => window.BP.totalSacola(window.BP.validarSacola(JSON.parse(localStorage.getItem('bp-sacola-v2')), window.BP.catalogo(window.CARDAPIO)), window.BP.catalogo(window.CARDAPIO))")),
              f"nome {nome[:20]!r}: a conferência do atendente não bate com o site ({r})")
        check("<img" not in (pg.inner_html("#msg") or ""), f"nome {nome[:20]!r}: virou HTML na mensagem")
        ok = len(re.sub(r"[\s*_~`]", "", nome)) >= 2
        pg.click("#enviar"); pg.wait_for_timeout(350)
        if not ok: check(pg.locator("#nomeErr").is_visible() or pg.locator("#stepOk").is_visible() is False, f"nome inválido {nome[:15]!r} deveria pedir outro nome")
        if pg.locator("#stepOk").is_visible(): pg.click("#ovBag [data-close]"); pg.wait_for_timeout(450); pg.click("#bagbtn"); pg.click("#irNome")
        inv(pg, f"nome {nome[:20]!r}")
    ctx.close()

# ---------------------------------------------------------------- 8. cliques frenéticos
def cenario_cliques(b):
    print("\n[8] FRENESI — cliques rápidos demais, toque duplo, metralhadora")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250); fecha_popups(ctx)
    abrir_item(pg, "X-Salada"); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]')
    pg.evaluate("() => { const b = document.querySelector('#itFoot [data-acao=confirmar]'); for (let i = 0; i < 25; i++) b.click(); }"); pg.wait_for_timeout(600)
    check(contar(pg) == 1, f"25 cliques no 'Pôr na sacola' puseram {contar(pg)} (esperado 1)")
    abrir_item(pg, "X-Salada"); pg.evaluate("() => { const b = document.querySelector('[data-qd=\"1\"]'); for (let i = 0; i < 300; i++) { const x = document.querySelector('[data-qd=\"1\"]'); if (x && !x.disabled) x.click(); } }")
    q = int(pg.text_content("#itBody output")); check(q <= 30 and q >= 1, f"300 cliques no '+' deixaram quantidade {q}")
    pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itBody [data-modo="diferentes"]') if pg.locator('#itBody [data-modo="diferentes"]').count() else None
    pg.evaluate("() => { for (let i = 0; i < 40; i++) { const x = document.querySelector('#itFoot [data-acao=continuar],#itFoot [data-acao=confirmar],#itFoot [data-acao=voltar]'); if (x) x.click(); } }"); pg.wait_for_timeout(100)
    inv(pg, "cliques no rodapé da conversa em rajada")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
    for i in range(4):   # enche a sacola até estourar o limite
        abrir_item(pg, "X-Burguer"); pg.click('#itBody [data-setq="4"]') if pg.locator('#itBody [data-setq="4"]').count() else None
        for _ in range(26):
            if pg.locator('#itBody [data-qd="1"]:not([disabled])').count(): pg.click('#itBody [data-qd="1"]')
        pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itBody [data-modo="iguais"]') if pg.locator('#itBody [data-modo="iguais"]').count() else None
        pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
        if pg.locator("#ovItem").is_visible(): pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
    check(contar(pg) <= 60, f"sacola com {contar(pg)} itens"); inv(pg, "sacola no limite")
    pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])")
    pg.evaluate("() => { for (let i = 0; i < 200; i++) { const x = document.querySelector('[data-q=\"1\"]:not([disabled])'); if (x) x.click(); } }")
    check(contar(pg) <= 60, f"200 cliques no '+' da sacola passaram de 60: {contar(pg)}"); inv(pg, "bag com mil cliques")
    pg.click("#irNome"); set_valor(pg, "#nome", "Maria")
    pg.evaluate("() => { const a = document.getElementById('enviar'); for (let i = 0; i < 10; i++) a.click(); }"); pg.wait_for_timeout(500)
    inv(pg, "10 cliques em Abrir no WhatsApp")
    ctx.close()

# ---------------------------------------------------------------- 9. ambiente hostil
def cenario_ambiente(b, p):
    print("\n[9] AMBIENTE — arquivo que não carrega, sem JavaScript, sem internet, telas e fontes extremas")
    for quem, esperado in [("cardapio.js", "Cardápio indisponível"), ("core.js", "Não foi possível carregar"), ("app.js", None)]:
        ctx = b.new_context(); pg = nova(ctx); pg.route(re.compile(r".*/" + re.escape(quem) + r"$"), lambda r: r.abort()); pg._goto_cru(URL); pg.wait_for_timeout(400)
        txt = pg.inner_text("body"); erros = [e for e in pg._erros if "pageerror" in e]
        check(not erros, f"sem {quem}: erro de script {erros[:1]}")
        check(len(txt.strip()) > 40, f"sem {quem}: página em branco")
        if esperado: check(esperado in txt, f"sem {quem}: deveria avisar '{esperado}'")
        else: check("Carregando" in txt or "indispon" in txt or "Não foi possível" in txt, f"sem {quem}: sem aviso nenhum na tela ({txt[:80]!r})")
        ctx.close()
    ctx = b.new_context(java_script_enabled=False); pg = ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(200)
    check("JavaScript" in pg.inner_text("body"), "sem JavaScript: aviso na tela"); ctx.close()
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(300); ctx.set_offline(True)
    abrir_item(pg, "X-Tudo"); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
    check(contar(pg) == 1, "sem internet o pedido continua sendo montado"); inv(pg, "offline"); ctx.close()
    # telas extremas, com janela aberta, também com fonte gigante
    for fonte in (None, "26px"):
        for vw, h in [(240, 400), (280, 500), (320, 568), (360, 640), (412, 915), (568, 320), (667, 375), (768, 1024), (1280, 720), (1920, 1080), (3840, 2160)]:
            ctx = b.new_context(); pg = nova(ctx, vw, h); pg.goto(URL); pg.wait_for_timeout(200)
            if fonte: pg.add_style_tag(content=f"html{{font-size:{fonte} !important}}")
            rot = f"{vw}x{h}" + (f" fonte {fonte}" if fonte else "")
            inv(pg, rot + " cardápio")
            pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])"); pg.wait_for_timeout(150); inv(pg, rot + " janela do lanche")
            pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.wait_for_timeout(100); inv(pg, rot + " conferir")
            pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
            pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])"); pg.wait_for_timeout(100); inv(pg, rot + " sacola")
            pg.click("#irNome"); pg.wait_for_timeout(120); set_valor(pg, "#nome", "Maria da Silva dos Santos Pereira de Albuquerque"); inv(pg, rot + " nome"); ctx.close()
    for nome in ["iPhone 13", "Pixel 7", "iPad Mini"]:
        ctx = b.new_context(**p.devices[nome]); pg = ctx.new_page()
        pg._erros = []; pg.on("pageerror", lambda e, pg=pg: pg._erros.append(str(e))); pg.route(re.compile(r"https://(wa\.me).*"), lambda r: r.fulfill(status=200, body=""))
        pg.goto(URL); pg.wait_for_timeout(250)
        pg.locator(".item .add").first.tap(); pg.wait_for_selector("#ovItem:not([hidden])")
        pg.tap('#itFoot [data-acao="continuar"]'); pg.tap('#itFoot [data-acao="continuar"]'); pg.tap('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(500)
        check(contar(pg) == 1, f"{nome}: pedido por toque"); inv(pg, f"{nome} por toque"); ctx.close()

# ---------------------------------------------------------------- 10. página do atendente
def cenario_conferir(b):
    print("\n[10] CONFERÊNCIA — colar lixo, mensagem forjada, texto gigante")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(CONFERIR); pg.wait_for_timeout(250)
    def colar(txt):
        t0 = time.time(); pg.evaluate("t => { document.getElementById('txt').value = t; document.getElementById('calc').click(); }", txt); return time.time() - t0
    casos = {
        "html": "*PEDIDO*\n*Cliente:* <img src=x onerror=alert(1)>\n*2x X-TUDO*\n   Obs: <script>alert(1)</script>\n<svg onload=alert(1)>\n",
        "gigante": "a" * 3_000_000, "espaços": "+ adicional de " + " " * 500000 + "x", "mil linhas": "*1x X-TUDO*\n   + adicional de ovo\n" * 40000, "bidi": "Cliente: " + BIDI * 100000,
        "forjada": "*Cliente:* Zé\n*0x X-TUDO*\n*999x X-TUDO*\n*2x X-TUDO*\n   + adicional de ovo\n   + adicional de ovo\n*1x PORÇÃO MISTA*\n   + adicional de bacon\nTotal: R$ 1,00\nDesconto 100%",
        "vazio": "", "só espaços": " \n \n ", "proto": "*1x __proto__*\n*1x constructor*\n+ adicional de toString",
    }
    for nome, txt in casos.items():
        dt = colar(txt); check(dt < 3, f"conferir '{nome}' demorou {dt:.1f}s")
        check(pg.locator("#out img, #out script, #out svg, #out iframe").count() == 0, f"conferir '{nome}': HTML do pedido virou elemento")
        check(not pg._erros, f"conferir '{nome}': erro {pg._erros[:1]}"); pg._erros.clear()
    colar(casos["forjada"]); out = pg.inner_text("#out")
    check("Atenção" in out, "pedido forjado não gerou alerta"); check("R$ 48,00" in out or "R$ 48" in out or "Total" in out, "pedido forjado sem total")
    tot = pg.evaluate("() => document.querySelector('#out .tot strong')?.textContent")
    esperado = pg.evaluate("() => { const BP = window.BP, c = BP.catalogo(window.CARDAPIO); return BP.brl((c.itens['hamburguer/x-tudo'].preco + c.itens['complementos/ovo'].preco) * 2 + c.itens['porcoes/porcao-mista'].preco); }")
    check(tot == esperado, f"pedido forjado: vale só 2x X-TUDO com 1 ovo + 1 Porção Mista = {esperado}, a conferência mostrou {tot}")
    colar(casos["mil linhas"]); check("grande demais" in pg.inner_text("#out") or "Atenção" in pg.inner_text("#out"), "mensagem enorme não foi sinalizada")
    ctx.close()

# ---------------------------------------------------------------- 11. teclado
def cenario_teclado(b):
    print("\n[11] TECLADO — só com Tab e Enter, o foco nunca escapa da janela")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pg.wait_for_timeout(250)
    pg.locator(".add").first.focus(); pg.keyboard.press("Enter"); pg.wait_for_selector("#ovItem:not([hidden])")
    for i in range(40):
        pg.keyboard.press("Tab" if i % 5 else "Shift+Tab")
        dentro = pg.evaluate("() => document.getElementById('ovItem').contains(document.activeElement)")
        if not dentro: check(False, f"foco escapou da janela no Tab {i}: {pg.evaluate('document.activeElement.outerHTML.slice(0,60)')}"); break
    else: check(True, "foco preso na janela")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(450); check(pg.locator("#ovItem").is_hidden(), "Esc fecha"); inv(pg, "teclado")
    ctx.close()

# ---------------------------------------------------------------- 12. desempenho e vazamento
def cenario_desempenho(b):
    print("\n[12] DESEMPENHO — carga, sacola cheia, digitação e vazamento de memória")
    ctx = b.new_context(); pg = nova(ctx); t0 = time.time(); pg.goto(URL); pg.wait_for_load_state("domcontentloaded"); pg.wait_for_timeout(100); dt = time.time() - t0
    check(dt < 2.5, f"abrir o site levou {dt:.1f}s")
    pg.evaluate("() => localStorage.setItem('bp-sacola-v2', JSON.stringify(window.BP.catalogo(window.CARDAPIO).lista.slice(0, 20).map((i, n) => ({id: i.id, qtd: 1, adds: [], obs: 'obs ' + n}))))"); pg.reload(); pg.wait_for_timeout(250)
    t0 = time.time(); pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])"); check(time.time() - t0 < 1.0, "abrir sacola com 20 linhas demorou"); inv(pg, "sacola com 20 linhas")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
    t0 = time.time()
    for i in range(150): set_valor(pg, "#busca", random.Random(i).choice(["x", "xt", "xtu", "xtud", "xtudo ba", "frango sal", "calabr", "bacom", "queijo"]))
    check((time.time() - t0) / 150 < 0.05, f"digitar na busca demora {(time.time() - t0) / 150 * 1000:.0f}ms por letra")
    set_valor(pg, "#busca", "")
    pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])"); pg.click('#itFoot [data-acao="continuar"]'); pg.keyboard.press("Escape"); pg.wait_for_selector("#ovItem", state="hidden"); pg.wait_for_timeout(420)
    n0 = pg.evaluate("document.getElementsByTagName('*').length")
    for i in range(60):
        pg.locator(".add").first.click(); pg.wait_for_selector("#ovItem:not([hidden])"); pg.click('#itFoot [data-acao="continuar"]'); pg.keyboard.press("Escape"); pg.wait_for_selector("#ovItem", state="hidden"); pg.wait_for_timeout(420)
    n1 = pg.evaluate("document.getElementsByTagName('*').length")
    check(n1 <= n0 + 30, f"abrir/fechar 60 vezes: elementos na página foram de {n0} para {n1}"); inv(pg, "depois de 60 aberturas")
    ctx.close()

# ---------------------------------------------------------------- 13. privacidade
def cenario_privacidade(b):
    print("\n[13] PRIVACIDADE — nenhum pedido a sites de fora, fontes próprias, CSP sem violação")
    for pagina in (URL, CONFERIR):
        ctx = b.new_context(); pg = ctx.new_page(); pedidos, csp = [], []
        pg.on("request", lambda r: pedidos.append(r.url)); pg.on("console", lambda m: csp.append(m.text) if "Content Security Policy" in m.text else None)
        pg.goto(pagina); pg.wait_for_timeout(600)
        fora = [u for u in pedidos if not u.startswith(URL) and not u.startswith("data:")]
        check(not fora, f"{pagina.split('/')[-1] or 'index'}: pedidos para fora do site: {fora[:3]}")
        check(not csp, f"{pagina.split('/')[-1] or 'index'}: violação de CSP {csp[:1]}")
        ok = pg.evaluate("async () => { const fs = ['16px \"Bowlby One\"', '700 16px \"Barlow Condensed\"', '800 16px \"Barlow Condensed\"', '400 16px Figtree', '700 16px Figtree']; return Promise.all(fs.map(async f => (await document.fonts.load(f, 'Aç')).length > 0)); }")
        check(all(ok), f"fontes próprias não carregaram: {ok}")
        csp_meta = pg.evaluate("() => document.querySelector('meta[http-equiv=Content-Security-Policy]').content")
        check("googleapis" not in csp_meta and "gstatic" not in csp_meta and "'unsafe-eval'" not in csp_meta and "script-src 'self'" in csp_meta, f"CSP afrouxada: {csp_meta[:120]}")
        ctx.close()

# ---------------------------------------------------------------- 14. página "Verificar cardápio"
def cenario_verificar(b):
    print("\n[14] VERIFICAR — a página que ajuda quem edita o cardapio.js a achar o erro")
    VER = URL + "verificar.html"
    def abrir(modifica=None):
        ctx = b.new_context(); pg = nova(ctx)
        if modifica:
            def rota(r):
                resp = r.fetch(); r.fulfill(response=resp, body=modifica(resp.text()))
            pg.route(re.compile(r".*/cardapio\.js$"), rota)
        pg.goto(VER); pg.wait_for_timeout(500); return ctx, pg
    ctx, pg = abrir(); out = pg.inner_text("#out")
    check("Tudo certo: 43 itens lidos" in out, f"cardápio certo deveria dizer 'Tudo certo: 43 itens' → {out[:120]!r}"); check("R$ 16,80" in out and "R$ 22,50" in out, "mostra os preços com centavos"); check("(16) 3382-3518" in out, "mostra o WhatsApp formatado")
    check(not pg._erros, f"sem erros {pg._erros[:1]}"); ctx.close()
    ctx, pg = abrir(lambda s: s.replace('nome: "X-Bacon",', 'nome: "X-Bacon" preco: 5,', 1)); out = pg.inner_text("#out")
    check("erro de digitação" in out and re.search(r"linha \d+", out), f"erro de sintaxe deveria dizer a linha → {out[:160]!r}"); ctx.close()
    ctx, pg = abrir(lambda s: s.replace('preco: 22.50', 'preco: "abc"').replace('preco: 16,', 'preco: null,').replace('nome: "X-Egg",', 'nome: "X-Salada",')); out = pg.inner_text("#out")
    check("foram ignorados" in out and "Preço inválido" in out and "Nome repetido" in out, f"itens ruins deveriam ser listados → {out[:200]!r}"); ctx.close()
    ctx, pg = abrir(lambda s: s.replace('"551633823518"', '"123"')); out = pg.inner_text("#out"); check("número do WhatsApp está errado" in out, "número errado é apontado"); ctx.close()
    ctx, pg = abrir(lambda s: s.replace('destaque: "Especial da casa", ', '')); out = pg.inner_text("#out"); check("destaque" in out and "nenhum" in out, "sem destaque é apontado"); ctx.close()

# ---------------------------------------------------------------- 15. atualização automática (cache do navegador)
def servidor_estilo_github_pages(pasta, porta):
    """Servidor que imita o GitHub Pages: o navegador pode guardar cada arquivo por 10 minutos (max-age=600), com ETag."""
    import http.server, mimetypes, os, threading
    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            caminho = self.path.split("?")[0].split("#")[0]
            f = os.path.join(pasta, caminho.lstrip("/") or "index.html")
            if os.path.isdir(f): f = os.path.join(f, "index.html")
            if not os.path.isfile(f): self.send_response(404); self.end_headers(); return
            st = os.stat(f); etag = f'"{st.st_mtime_ns}-{st.st_size}"'
            self.send_response(304 if self.headers.get("If-None-Match") == etag else 200)
            self.send_header("ETag", etag); self.send_header("Cache-Control", "max-age=600")
            self.send_header("Content-Type", (mimetypes.guess_type(f)[0] or "application/octet-stream") + ("; charset=utf-8" if f.endswith((".html", ".js")) else ""))
            if self.headers.get("If-None-Match") == etag: self.end_headers(); return
            dados = open(f, "rb").read(); self.send_header("Content-Length", str(len(dados))); self.end_headers(); self.wfile.write(dados)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", porta), H); threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv

def cenario_atualizacao(b, origem=None, esperado_ok=True):
    import os, shutil, tempfile
    print("\n[15] ATUALIZAÇÃO — quem já visitou vê a versão nova sem 'forçar atualização'")
    aqui = os.path.dirname(os.path.abspath(__file__))
    site = origem or (os.path.join(aqui, "..") if os.path.exists(os.path.join(aqui, "..", "index.html")) else os.path.join(aqui, "..", "site"))
    tmp = tempfile.mkdtemp(); pasta = os.path.join(tmp, "site"); shutil.copytree(site, pasta, ignore=shutil.ignore_patterns("tests", "node_modules"))
    srv = servidor_estilo_github_pages(pasta, 8766); U = "http://127.0.0.1:8766/"
    def lendo(arq): return open(os.path.join(pasta, arq), encoding="utf8").read()
    def gravando(arq, texto): open(os.path.join(pasta, arq), "w", encoding="utf8").write(texto); os.utime(os.path.join(pasta, arq), None)
    def preco(pg): return pg.evaluate("() => document.querySelector('.item:has(.name) .int') && [...document.querySelectorAll('.item')].find(i => i.querySelector('.name').textContent === 'X-Tudo').querySelector('.int').textContent")
    def abrir(pg):
        pg.goto(U); pg.wait_for_timeout(1200)
        try: pg.wait_for_selector(".item", timeout=3000)
        except PWError: pass
        pg.wait_for_timeout(600)
    ctx = b.new_context(); pg = ctx.new_page(); pg._erros = []          # sem route: com interceptação o Playwright desliga o cache e o teste não mostraria o problema
    pg.on("pageerror", lambda e: pg._erros.append(str(e))); abrir(pg)
    check(preco(pg) == "24" and "Cardápio |" in pg.title(), f"primeira visita: preço {preco(pg)}, título {pg.title()!r}")
    # 1) só o cardapio.js muda (o dono mexeu num preço)
    gravando("cardapio.js", re.sub(r'(nome: "X-Tudo",\s+preco: )24', r"\g<1>25", lendo("cardapio.js"))); abrir(pg)
    r1 = preco(pg); check((r1 == "25") == esperado_ok, f"depois de mudar só o preço: o visitante vê {r1} (esperado {'25' if esperado_ok else '24 (velho: o teste prova o problema)'})")
    # 2) só o index.html muda (visual/texto)
    gravando("index.html", lendo("index.html").replace("<title>Cardápio |", "<title>Cardápio NOVO |", 1)); abrir(pg)
    check(("NOVO" in pg.title()) == esperado_ok, f"depois de mudar só a página: título {pg.title()!r}")
    # 3) mudam os dois juntos
    gravando("cardapio.js", lendo("cardapio.js").replace("preco: 25", "preco: 26", 1)); gravando("index.html", lendo("index.html").replace("Cardápio NOVO |", "Cardápio NOVÍSSIMO |", 1)); abrir(pg)
    check((preco(pg) == "26" and "NOVÍSSIMO" in pg.title()) == esperado_ok, f"os dois ao mesmo tempo: preço {preco(pg)}, título {pg.title()!r}")
    if esperado_ok:
        # sem mudança: não pode ficar recarregando
        n0 = pg.evaluate("performance.getEntriesByType('navigation').length"); abrir(pg); pg.wait_for_timeout(1500)
        check(not pg._erros, f"sem erros na atualização {pg._erros[:2]}")
        recarregos = []; pg.on("framenavigated", lambda f: recarregos.append(f.url) if f == pg.main_frame else None); pg.wait_for_timeout(2500)
        check(len(recarregos) == 0, f"página parada não deveria recarregar sozinha ({len(recarregos)} vezes)")
        # servidor muda o tempo todo (ex.: CDN que injeta data): nunca entra em laço de recarga
        orig = lendo("index.html"); cont = {"n": 0}
        for i in range(4):
            gravando("index.html", orig.replace("</body>", f"<!--{i}--></body>", 1)); pg.goto(U); pg.wait_for_timeout(500)
        nav = []; pg.on("framenavigated", lambda f: nav.append(1) if f == pg.main_frame else None); pg.wait_for_timeout(3000)
        check(len(nav) <= 1, f"página que muda a cada visita não pode entrar em laço de recarga ({len(nav)})")
        # sem internet / servidor fora do ar: abre com o que já tem
        ctx.set_offline(True); pg.goto(U); pg.wait_for_timeout(1500)
        pg.wait_for_timeout(800); check(pg.locator(".item").count() > 0, "sem internet o cardápio abre com o que o navegador já guardou")
        ctx.set_offline(False)
    srv.shutdown(); ctx.close(); shutil.rmtree(tmp, ignore_errors=True)

CENARIOS = [("macaco", lambda b, p: cenario_macaco(b)), ("storage", lambda b, p: cenario_storage(b)), ("dom", lambda b, p: cenario_dom(b)), ("abas", lambda b, p: cenario_abas(b)),
            ("historico", lambda b, p: cenario_historico(b)), ("busca", lambda b, p: cenario_busca(b)), ("texto", lambda b, p: cenario_texto(b)), ("cliques", lambda b, p: cenario_cliques(b)),
            ("ambiente", cenario_ambiente), ("conferir", lambda b, p: cenario_conferir(b)), ("teclado", lambda b, p: cenario_teclado(b)), ("desempenho", lambda b, p: cenario_desempenho(b)), ("privacidade", lambda b, p: cenario_privacidade(b)), ("verificar", lambda b, p: cenario_verificar(b)), ("atualizacao", lambda b, p: cenario_atualizacao(b))]

if __name__ == "__main__":
    with sync_playwright() as p:
        b = p.chromium.launch()
        for nome, fn in CENARIOS:
            if FILTRO and FILTRO != nome: continue
            t0 = time.time()
            try: fn(b, p)
            except Exception as ex:
                falhas.append(f"cenário '{nome}' quebrou no meio: {type(ex).__name__}: {str(ex)[:250]}"); print("  QUEBROU", nome, str(ex)[:300])
            print(f"   ({nome}: {time.time() - t0:.0f}s)")
        b.close()
    print(f"\nSABOTADOR: {total_ok} defesas aguentaram, {len(falhas)} falhas")
    for f in falhas: print(" -", f[:400])
    sys.exit(1 if falhas else 0)
