"""Bateria de testes no navegador (Chromium) contra o site servido por HTTP."""
import json, re, sys, time
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8765/"
AXE = open(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "node_modules", "axe-core", "axe.min.js")).read()
falhas, ok = [], 0

def check(cond, nome):
    global ok
    if cond: ok += 1; print("  ok  ", nome)
    else: falhas.append(nome); print("  FALHOU", nome)

def nova(ctx, vw=390, h=844):
    pg = ctx.new_page(); pg.set_viewport_size({"width": vw, "height": h})
    pg._erros = []
    pg.on("pageerror", lambda e: pg._erros.append(str(e)))
    pg.on("console", lambda m: pg._erros.append(m.text) if m.type == "error" and "fonts.g" not in m.text and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
    pg.route(re.compile(r"https://(fonts\.googleapis|fonts\.gstatic|wa\.me).*"), lambda r: r.fulfill(status=200, body=""))
    return pg

def abrir_item(pg, nome):
    pg.locator(f'.item:has(.name:text-is("{nome}")) .add').first.click()
    pg.wait_for_selector("#ovItem:not([hidden])")

def ate_conferir(pg, qtd=1, adds=(), obs="", modo="iguais"):
    """Responde a conversa até a tela de conferir."""
    if qtd <= 4: pg.click(f'#itBody [data-setq="{qtd}"]')
    else:
        for _ in range(qtd - 1): pg.click('#itBody [data-qd="1"]')
    pg.click('#itFoot [data-acao="continuar"]')
    if pg.locator('#itFoot [data-acao="confirmar"]').count(): return   # porção: vai direto para conferir
    if qtd > 1: pg.click(f'#itBody [data-modo="{modo}"]')
    for a in adds: pg.click(f'#itBody .opt[data-k="c"]:has-text("{a}")')
    if obs: pg.fill('#itBody [data-obs="c"]', obs)
    pg.click('#itFoot [data-acao="continuar"]')
    pg.wait_for_selector('#itFoot [data-acao="confirmar"]')

def adicionar(pg, nome, qtd=1, adds=(), obs=""):
    abrir_item(pg, nome); ate_conferir(pg, qtd, adds, obs)
    pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_selector("#ovItem", state="hidden"); pg.wait_for_timeout(450)

with sync_playwright() as p:
    b = p.chromium.launch()

    print("\n[1] Carrega sem erros, sem violar CSP, sem rolagem lateral (3 telas)")
    for vw in (320, 390, 1280):
        ctx = b.new_context(); pg = nova(ctx, vw)
        csp = []; pg.on("console", lambda m: csp.append(m.text) if "Content Security Policy" in m.text else None)
        pg.goto(URL); pg.wait_for_timeout(400)
        check(not pg._erros, f"{vw}px sem erros de script {pg._erros[:2]}")
        check(not csp, f"{vw}px sem violação de CSP {csp[:1]}")
        check(pg.evaluate("document.documentElement.scrollWidth") <= vw, f"{vw}px sem rolagem lateral")
        check(pg.locator(".item").count() == 31 and pg.locator(".pcard").count() == 4 and pg.locator(".promo").count() == 1, f"{vw}px todos os itens na tela")
        ctx.close()

    print("\n[2] Busca tolerante a erros")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    casos = {"xtudo": "X-Tudo", "x tudo": "X-Tudo", "xis tudo": "X-Tudo", "X-TUDO": "X-Tudo", "calabreza": "X-Calabresa", "frnago salada": "Frango Salada",
             "bacom": "X-Bacon", "catupiri": "X-Calabresa", "bauro": "Bauru", "misto": "Misto Quente", "egg": "X-Egg", "hamburguer duplo": "X-Tudo Duplo",
             "americno": "Americano", "vienence": "Vienense", "porção mista": "Porção Mista", "bate papo": "Bate Papo Especial", "file tudo": "Filé Tudo",
             "contra file": "Porção de Contra Filé"}
    for q, esperado in casos.items():
        pg.fill("#busca", q); pg.wait_for_timeout(20)
        nomes = pg.eval_on_selector_all("#resultados .item .name", "e=>e.map(x=>x.textContent)")
        check(esperado in nomes[:5], f'"{q}" acha {esperado} (top: {nomes[:3]})')
    pg.fill("#busca", "pizza calzone"); check(pg.locator(".nores").count() == 1, "busca sem resultado mostra aviso")
    pg.fill("#busca", "<img src=x onerror=window.__xss=1>"); pg.wait_for_timeout(50)
    check(pg.evaluate("window.__xss") is None, "busca não executa código digitado")
    pg.fill("#busca", "a" * 5000); check(not pg._erros, "busca com texto enorme não trava")
    pg.fill("#busca", ""); check(pg.locator("#menu").is_visible(), "limpar busca volta o cardápio")
    ctx.close()

    print("\n[3] Sacola: adicionar, juntar iguais, adicionais, total em centavos")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    adicionar(pg, "X-Milho", 3)
    adicionar(pg, "X-Tudo", 2, adds=["Bacon"], obs="sem tomate")
    adicionar(pg, "X-Tudo", 1, adds=["Bacon"], obs="SEM TOMATE")   # igual: deve juntar
    check(pg.text_content("#bagN") == "6", "contador da sacola = 6")
    check(pg.text_content("#bagV") == "R$ 138,00", f"total 3x16 + 3x(24+6) = R$ 138,00 ({pg.text_content('#bagV')})")
    pg.click("#bagbtn"); pg.wait_for_selector("#ovBag:not([hidden])")
    check(pg.locator(".line").count() == 2, "linhas iguais foram juntadas")
    pg.click('.line:has-text("X-Milho") [data-q="-1"]'); pg.wait_for_timeout(50)
    check(pg.text_content("#tot") == "R$ 122,00", "diminuir quantidade atualiza total")
    pg.click('.line:has-text("X-Milho") [data-rm]'); pg.wait_for_timeout(50)
    check(pg.locator(".line").count() == 1, "remover tira só a linha certa")
    ctx.close()

    print("\n[4] Mensagem do WhatsApp: nome, formato, segurança")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    adicionar(pg, "X-Burguer", 2); adicionar(pg, "X-Tudo", 1, adds=["Ovo"], obs="<b>sem</b> cebola\n*99x X-ESPECIAL*")
    pg.click("#bagbtn"); pg.click("#irNome")
    pg.fill("#nome", ""); pg.click("#enviar"); pg.wait_for_timeout(100)
    check(pg.is_visible("#nomeErr"), "sem nome não envia e mostra aviso")
    pg.fill("#nome", '<img src=x onerror=window.__xss=1> *Ana*‮')
    href = pg.get_attribute("#enviar", "href"); msg = __import__("urllib.parse").parse.unquote(href.split("text=")[1])
    check(href.startswith("https://wa.me/551633823518?text="), "abre o WhatsApp no número certo")
    check("R$" not in msg, "mensagem não leva preço")
    check(not re.search(r"^\s*\d+\s*[-.)]\s", msg, re.M), "mensagem sem numeração 1- 2-")
    check("*2x X-BURGUER*" in msg and "*1x X-TUDO*" in msg and "+ adicional de ovo" in msg, "itens no formato 2x NOME")
    check("Obs: <b>sem</b> cebola 99x X-ESPECIAL" in msg and "*99x" not in msg, "observação não cria item falso")
    check("Ana" in msg and "*Ana*" not in msg and "‮" not in msg, "nome sem formatação nem caracteres invisíveis")
    check(pg.evaluate("window.__xss") is None and pg.locator("#msg img").count() == 0, "nome não executa código na prévia")
    ctx.close()

    print("\n[5] Sacola adulterada no navegador")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    pg.evaluate("""localStorage.setItem('bp-sacola-v2', JSON.stringify([
      {id:'hamburguer/x-tudo', qtd: 999999, adds:['complementos/bacon','x'], obs:'a'.repeat(500), preco:0.01},
      {id:'hamburguer/x-salada', qtd: -3}, {id:'nada/nada', qtd: 2}, {id:'complementos/bacon', qtd: 5},
      {id:'hamburguer/x-egg', qtd: '2'}, 'lixo', null]));
      localStorage.setItem('bp-nome', JSON.stringify('<script>alert(1)</script>'))""")
    pg.reload(); pg.wait_for_timeout(300)
    check(pg.text_content("#bagN") == "32", f"quantidade limitada a 30 + 2 válidos ({pg.text_content('#bagN')})")
    check(pg.text_content("#bagV") == "R$ 934,00", f"preço vem do cardápio, não do navegador ({pg.text_content('#bagV')})")
    pg.evaluate("localStorage.setItem('bp-sacola-v2', '{quebrado')"); pg.reload(); pg.wait_for_timeout(200)
    check(not pg._erros and pg.is_hidden("#bagbtn"), "dado corrompido não quebra o site")
    ctx.close()

    print("\n[6] Concorrência: duplo toque, duas abas, envio duplo")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    abrir_item(pg, "X-Bacon")
    ate_conferir(pg)
    pg.evaluate("() => { const b = document.querySelector('#itFoot [data-acao=confirmar]'); b.click(); b.click(); b.click(); }")
    pg.wait_for_timeout(500)
    check(pg.text_content("#bagN") == "1", "toque triplo em Adicionar soma só 1")
    pg.locator('.item:has(.name:text-is("X-Salada")) .add').dblclick(); pg.wait_for_timeout(300)
    check(pg.locator("#ovItem:not([hidden])").count() == 1, "toque duplo no + abre só uma janela")
    pg.click("#ovItem [data-close]"); pg.wait_for_timeout(450)
    abrir_item(pg, "X-Egg"); ate_conferir(pg); pg.click('#itFoot [data-acao="confirmar"]')
    pg.mouse.click(200, 600); pg.wait_for_timeout(450)
    check(pg.locator("#ovItem:not([hidden])").count() == 0, "toque logo após adicionar não abre outro lanche sem querer")

    pg2 = nova(ctx); pg2.goto(URL); pg2.wait_for_timeout(200)
    check(pg2.text_content("#bagN") == "2", "segunda aba já abre com a sacola")
    pg2.click("#bagbtn"); pg2.wait_for_selector("#ovBag:not([hidden])")
    adicionar(pg, "X-Tudo", 1); pg2.wait_for_timeout(200)
    check(pg2.locator(".line").count() == 3 and pg2.text_content("#bagN") == "3", "aba 2 atualiza sozinha quando aba 1 muda")
    pg2.click('.line:has-text("X-Bacon") [data-rm]'); pg.wait_for_timeout(200)
    check(pg.text_content("#bagN") == "2", "remover na aba 2 reflete na aba 1")
    pg.evaluate("localStorage.setItem('bp-sacola-v2', JSON.stringify([{id:'hamburguer/x-egg',qtd:1}]))")  # muda por fora
    pg2.click('.line:has-text("X-Egg") [data-q="1"]'); pg2.wait_for_timeout(100)
    check(pg2.text_content("#bagN") == "2", "mudança usa a sacola mais recente (sem perder atualização)")

    pg2.click("#irNome"); pg2.fill("#nome", "Carlos")
    popups = []; ctx.on("page", lambda pp: popups.append(pp.url))
    pg2.evaluate("() => { const a = document.getElementById('enviar'); a.click(); a.click(); a.click(); }")
    pg2.wait_for_timeout(800)
    check(len(popups) == 1, f"toque triplo em enviar abre o WhatsApp uma vez só ({len(popups)})")
    check(pg2.is_visible("#stepOk"), "mostra tela de pedido pronto")
    ctx.close()

    print("\n[7] Limite de itens")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    adicionar(pg, "Misto Quente", 30); adicionar(pg, "X-Salada", 30)
    check(pg.text_content("#bagN") == "60", "chega no limite de 60")
    pg.locator('.item:has(.name:text-is("X-Bacon")) .add').click(); pg.wait_for_timeout(200)
    check(pg.locator("#ovItem:not([hidden])").count() == 0 and "máximo" in (pg.text_content("#toast") or ""), "acima do limite avisa e não abre")
    ctx.close()

    print("\n[8] Botão voltar do celular e teclado")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    abrir_item(pg, "X-Tudo"); pg.go_back(); pg.wait_for_timeout(500)
    check(pg.locator("#ovItem:not([hidden])").count() == 0 and pg.url.startswith(URL), "voltar fecha a janela e continua no site")
    abrir_item(pg, "X-Tudo"); pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    check(pg.locator("#ovItem:not([hidden])").count() == 0, "Esc fecha a janela")
    abrir_item(pg, "X-Tudo")
    for _ in range(25): pg.keyboard.press("Tab")
    check(pg.evaluate("document.getElementById('ovItem').contains(document.activeElement)"), "Tab não sai da janela aberta")
    pg.click('#ovItem [data-close]'); pg.wait_for_timeout(450); pg.go_back(); pg.wait_for_timeout(200)
    check(not pg._erros, "voltar depois de fechar não quebra")
    ctx.close()

    print("\n[11] Conversa guiada (o site ajuda o cliente)")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    check(pg.locator("#boas").count() == 1, "mostra boas-vindas na primeira visita")
    pg.click("#boasFechar"); pg.reload(); pg.wait_for_timeout(200)
    check(pg.locator("#boas").count() == 0, "boas-vindas não volta depois de fechar")
    abrir_item(pg, "X-Tudo"); pg.click('#itBody [data-setq="3"]'); pg.click('#itFoot [data-acao="continuar"]')
    check("vão todos iguais" in pg.text_content("#itBody"), "com 3 lanches pergunta se vão todos iguais")
    pg.click('#itBody [data-modo="iguais"]'); pg.click('#itBody .opt[data-k="c"]:has-text("Ovo")')
    check("Cada um dos 3 vem com ovo a mais" in pg.text_content('[data-nota="c"]'), "deixa claro que o adicional vai em cada um")
    pg.click('#itBody .opt[data-k="c"]:has-text("Ovo")')
    pg.fill('#itBody [data-obs="c"]', "1 com ovo a mais"); pg.click('#itFoot [data-acao="continuar"]')
    check(pg.locator('[data-dica="separar"]').count() == 1, 'percebe "1 com ovo" e sugere montar cada um')
    check(pg.locator('[data-dica="add"]').count() == 1, "sugere marcar o adicional de ovo")
    pg.click('[data-dica="separar"]')
    check(pg.locator("#itBody .unid").count() == 3, "abre um cartão para cada lanche")
    pg.click('#itBody .opt[data-k="0"]:has-text("Ovo")'); pg.click('#itFoot [data-acao="continuar"]')
    txt = pg.text_content("#itBody .resumo")
    check("1x" in txt and "X-Tudo com ovo a mais" in txt and "2x" in txt and "X-Tudo do jeito do cardápio" in txt, "conferência: 1 com ovo e 2 do jeito do cardápio")
    check(pg.text_content('#itFoot .nw') == "R$ 75,00", "total da conferência 3x24 + ovo 3 = R$ 75,00")
    pg.click('#itFoot [data-acao="voltar"]'); pg.click('#itFoot [data-acao="voltar"]')
    check(pg.locator('#itBody [data-modo="iguais"]').count() >= 1, "voltar retorna para a pergunta anterior")
    pg.click('#itBody [data-modo="diferentes"]'); pg.click('#itBody .opt[data-k="0"]:has-text("Ovo")'); pg.click('#itFoot [data-acao="continuar"]')
    pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(450)
    pg.click("#bagbtn"); pg.click("#irNome"); pg.fill("#nome", "Maria")
    msg = __import__("urllib.parse").parse.unquote(pg.get_attribute("#enviar", "href").split("text=")[1])
    check("*1x X-TUDO*\n   + adicional de ovo\n\n*2x X-TUDO*\n   do jeito do cardápio" in msg, "mensagem separa 1 com ovo e 2 do jeito do cardápio")
    pg.click("#ovBag [data-close]"); pg.wait_for_timeout(450)

    abrir_item(pg, "X-Tudo"); ate_conferir(pg, 1, adds=["Bacon"], obs="sem bacon, sem cebola")
    body = pg.text_content("#itBody")
    check(pg.locator('[data-dica="tirar"]').count() == 1, 'percebe conflito: marcou bacon e escreveu "sem bacon"')
    check("já vem sem cebola" in body, "avisa que o X-Tudo não leva cebola")
    pg.click('[data-dica="tirar"]')
    check(pg.text_content('#itFoot .nw') == "R$ 24,00", "tirar o adicional pela dica atualiza o valor")
    pg.click('#ovItem [data-close]'); pg.wait_for_timeout(450)

    pg.locator('.pcard:has-text("Porção Mista") .add').click(); pg.wait_for_selector("#ovItem:not([hidden])")
    pg.click('#itFoot [data-acao="continuar"]')
    check(pg.locator('#itFoot [data-acao="confirmar"]').count() == 1 and pg.locator("#itBody .opt").count() == 0, "porção pula adicionais e vai para conferir")
    pg.click('#ovItem [data-close]'); pg.wait_for_timeout(450)

    abrir_item(pg, "X-Salada")
    for _ in range(6): pg.click('#itBody [data-qd="1"]')
    check("É bastante coisa" in pg.text_content("#itBody"), "quantidade grande pede confirmação")
    pg.click('#ovItem [data-close]'); pg.wait_for_timeout(450)
    adicionar(pg, "X-Burguer", 1); adicionar(pg, "X-Burguer", 1)
    check("Juntei" in pg.text_content("#toast"), "avisa quando junta com o que já estava na sacola")
    check(not pg._erros, f"sem erros durante a conversa {pg._erros[:2]}")
    ctx.close()

    print("\n[9] Acessibilidade (axe-core)")
    for vw in (390, 1280):
        ctx = b.new_context(bypass_csp=True); pg = nova(ctx, vw); pg.goto(URL); pg.wait_for_timeout(300)
        pg.add_script_tag(content=AXE)
        r = pg.evaluate("async () => (await axe.run(document, {resultTypes:['violations']})).violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, ex:v.nodes[0].target}))")
        graves = [v for v in r if v["impact"] in ("serious", "critical")]
        check(not graves, f"{vw}px sem problemas graves de acessibilidade {graves}")
        if r: print("        avisos menores:", [(v['id'], v['impact'], v['n']) for v in r if v not in graves])
        ctx.close()

    print("\n[10] Página de conferência do atendente")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL)
    adicionar(pg, "X-Milho", 3); adicionar(pg, "X-Tudo", 2, adds=["Bacon", "Catupiry"]); adicionar(pg, "X-Egg", 1)
    total_site = pg.text_content("#bagV")
    pg.click("#bagbtn"); pg.click("#irNome"); pg.fill("#nome", "Bia")
    msg = __import__("urllib.parse").parse.unquote(pg.get_attribute("#enviar", "href").split("text=")[1])
    c = nova(ctx); c.goto(URL + "conferir.html"); c.fill("#txt", msg); c.click("#calc")
    check(c.text_content(".tot strong") == total_site, f"total recalculado = total do site ({total_site})")
    check(c.locator(".okmsg").count() == 1, "todos os itens reconhecidos")
    c.fill("#txt", msg.replace("*3x X-MILHO*", "*3x X-MILHO*\n*1x LANCHE GRÁTIS*") + "\nTotal: R$ 1,00"); c.click("#calc")
    check(c.text_content(".tot strong") == total_site and c.locator(".alerta li").count() == 2, "linhas inventadas são apontadas e não mudam o valor")
    c.fill("#txt", "<img src=x onerror=window.__xss=1>\n*1x <script>alert(1)</script>*"); c.click("#calc"); c.wait_for_timeout(100)
    check(c.evaluate("window.__xss") is None and not c._erros, "colar código não executa nada")
    ctx.close()

    print("\n[11] Copiar pedido (plano B quando o WhatsApp não abre)")
    ctx = b.new_context(permissions=["clipboard-read", "clipboard-write"]); pg = nova(ctx); pg.goto(URL)
    adicionar(pg, "X-Burguer", 2); pg.click("#bagbtn"); pg.click("#irNome"); pg.fill("#nome", "Carla")
    pg.click("#footNome [data-copiar]"); pg.wait_for_timeout(200)
    copiado = pg.evaluate("navigator.clipboard.readText()")
    check("*2x X-BURGUER*" in copiado and "*Cliente:* Carla" in copiado and "R$" not in copiado, "botão Copiar pedido copia a mensagem inteira, sem preço")
    check("copiado" in pg.text_content("#toast").lower(), "avisa que copiou")
    check(pg.locator("#msgLongo").is_hidden(), "pedido pequeno não mostra aviso de pedido grande")
    ctx.close()

    print("\n[12] Verificar cardápio")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL + "verificar.html"); pg.wait_for_timeout(300)
    check("Tudo certo" in pg.text_content("#out") and not pg._erros, "página de verificação mostra o cardápio sem erros")
    ctx.close()
    b.close()

print(f"\nRESULTADO: {ok} ok, {len(falhas)} falhas")
for f in falhas: print("  -", f)
sys.exit(1 if falhas else 0)
