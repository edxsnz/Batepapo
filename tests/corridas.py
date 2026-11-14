"""Testes de corrida (race conditions) e de situações reais que os outros testes não cobriam.
Uso: python3 corridas.py [porta]   (padrão 8768)"""
import json, re, sys, time
from playwright.sync_api import sync_playwright

PORTA = sys.argv[1] if len(sys.argv) > 1 else "8765"
URL = f"http://127.0.0.1:{PORTA}/"
falhas, ok = [], 0

def check(cond, nome):
    global ok
    if cond: ok += 1; print("  ok  ", nome)
    else: falhas.append(nome); print("  FALHOU", nome)

def nova(ctx, vw=390, h=844):
    pg = ctx.new_page(); pg.set_viewport_size({"width": vw, "height": h})
    pg._erros = []
    pg.on("pageerror", lambda e: pg._erros.append(str(e)))
    pg.route(re.compile(r"https://wa\.me.*"), lambda r: r.fulfill(status=200, body="ok"))
    return pg

def pronto(pg): pg.wait_for_selector("#carregando", state="detached", timeout=15000)

def abrir_item(pg, nome):
    pg.locator(f'.item:has(.name:text-is("{nome}")) .add').first.click()
    pg.wait_for_selector("#ovItem:not([hidden])")

def passo_item(pg):
    return pg.evaluate("""() => { const a = document.querySelector('.prog li.agora'); return a ? a.textContent : null }""")

def adicionar(pg, nome):
    abrir_item(pg, nome)
    for _ in range(4):
        if pg.locator('#itFoot [data-acao="confirmar"]').count(): break
        pg.click('#itFoot [data-acao="continuar"]')
    pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_selector("#ovItem", state="hidden"); pg.wait_for_timeout(450)

with sync_playwright() as p:
    b = p.chromium.launch()

    print("\n[1] Corrida no carregador: atualização chega devagar, com o cliente no meio do pedido")
    import subprocess, os
    lento = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "servidor_lento.py"),
                              os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "8791", "4.5"])
    time.sleep(0.8)
    try:
        U2 = "http://127.0.0.1:8791/"
        ctx = b.new_context(); pg = nova(ctx)
        # como no iPhone: o navegador usa na hora o script que já tem guardado, enquanto a conferência da atualização demora
        import pathlib
        raiz = pathlib.Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        def scripts_na_hora(route):
            if route.request.resource_type == "script":
                nome = route.request.url.split("/")[-1].split("?")[0]
                route.fulfill(status=200, content_type="text/javascript", body=(raiz / nome).read_text(encoding="utf-8"))
            else: route.continue_()
        pg.route(re.compile(r".*\.js(\?.*)?$"), scripts_na_hora)
        pg.goto(U2, wait_until="commit"); pg.wait_for_selector("#carregando", state="detached", timeout=15000); pg.wait_for_timeout(5500)
        pg.evaluate("localStorage.setItem('bp-versao:' + location.pathname, (localStorage.getItem('bp-versao:' + location.pathname) || 'x').split('|')[0] + '|velho')")
        pg.evaluate("window.__marca = 1")
        pg.reload(wait_until="commit"); pg.wait_for_selector("#carregando", state="detached", timeout=15000)   # 2,5 s: o cardápio abre com o que tem
        pg.evaluate("window.__marca = 2")
        abrir_item(pg, "X-Tudo"); pg.click('#itBody [data-setq="2"]'); pg.click('#itFoot [data-acao="continuar"]')
        pg.wait_for_timeout(4500)                                      # a resposta lenta chega com o cliente escolhendo
        vivo = pg.evaluate("window.__marca === 2 && !document.getElementById('ovItem').hidden")
        check(vivo, "a atualização não recarrega a página com a janela do lanche aberta (o cliente não perde o que escolheu)")
        if vivo:
            pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
            if pg.is_visible("#ovItem"): pg.keyboard.press("Escape")
            recarregou = False
            for _ in range(16):                                   # a recarga derruba a conferência no meio: confere de novo
                pg.wait_for_timeout(500)
                try:
                    if pg.evaluate("window.__marca") != 2: recarregou = True; break
                except Exception: pass
            check(recarregou, "fechou a janela: aí sim a página se atualiza sozinha")
        ctx.close()
    finally:
        lento.terminate()

    print("\n[2] Botão voltar do celular volta um passo (não fecha tudo)")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pronto(pg)
    abrir_item(pg, "X-Tudo")
    pg.click('#itFoot [data-acao="continuar"]'); pg.wait_for_timeout(200)
    check(passo_item(pg) == "Do seu jeito", "passo 2 aberto")
    pg.go_back(); pg.wait_for_timeout(400)
    check(pg.is_visible("#ovItem") and passo_item(pg) == "Quantidade", "voltar do celular no passo 2 volta para Quantidade")
    pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]'); pg.wait_for_timeout(200)
    pg.click('#itFoot [data-acao="voltar"]'); pg.wait_for_timeout(400)
    check(passo_item(pg) == "Do seu jeito", "botão Corrigir volta um passo")
    pg.go_back(); pg.wait_for_timeout(300); pg.go_back(); pg.wait_for_timeout(400)
    check(pg.is_hidden("#ovItem"), "voltando mais, a janela fecha")
    adicionar(pg, "X-Salada")
    pg.click("#bagbtn"); pg.click("#irNome"); pg.wait_for_timeout(200)
    check(pg.is_visible("#stepNome"), "tela do nome aberta")
    pg.go_back(); pg.wait_for_timeout(400)
    check(pg.is_visible("#ovBag") and pg.is_visible("#stepBag"), "voltar do celular na tela do nome volta para o pedido")
    pg.go_back(); pg.wait_for_timeout(400)
    check(pg.is_hidden("#ovBag"), "voltar de novo fecha o pedido")
    # adicionar e fechar com várias páginas no histórico não deixa a janela travada
    abrir_item(pg, "X-Bacon"); pg.click('#itFoot [data-acao="continuar"]'); pg.click('#itFoot [data-acao="continuar"]')
    pg.click('#itFoot [data-acao="confirmar"]'); pg.wait_for_timeout(700)
    check(pg.is_hidden("#ovItem") and not pg.evaluate("document.body.classList.contains('lock')"), "depois de adicionar (3 passos), a janela fecha e a página rola de novo")
    check(not pg._erros, f"sem erros de script {pg._erros[:2]}")
    ctx.close()

    print("\n[3] Desfazer: remover um lanche ou limpar o pedido sem querer")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pronto(pg)
    adicionar(pg, "X-Salada"); adicionar(pg, "X-Bacon")
    pg.click("#bagbtn")
    pg.locator('#lines .line:has(.nm:text-is("X-Bacon")) [data-rm]').click(); pg.wait_for_timeout(200)
    check(pg.locator("#lines .line").count() == 1, "removeu o X-Bacon")
    check(pg.is_visible("#toast [data-desfazer]"), "aparece o botão Desfazer")
    if pg.is_visible("#toast [data-desfazer]"):
        box = pg.locator("#toast").bounding_box(); foot = pg.locator("#footBag").bounding_box()
        check(box["y"] + box["height"] <= foot["y"] or box["y"] >= foot["y"] + foot["height"], "o aviso não cobre os botões do pedido")
        pg.click("#toast [data-desfazer]"); pg.wait_for_timeout(200)
        check(pg.locator("#lines .line").count() == 2, "Desfazer devolve o X-Bacon")
    pg.click("#esvaziar"); pg.wait_for_timeout(200)
    check(pg.evaluate("JSON.parse(localStorage.getItem('bp-sacola-v2')).length") == 0, "Limpar esvazia o pedido")
    if pg.is_visible("#toast [data-desfazer]"):
        pg.click("#toast [data-desfazer]"); pg.wait_for_timeout(200)
    check(pg.evaluate("JSON.parse(localStorage.getItem('bp-sacola-v2')).length") == 2, "Desfazer devolve o pedido inteiro")
    ctx.close()

    print("\n[4] Pedido enviado ontem não fica preso no botão 'Ver meu pedido'")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pronto(pg)
    adicionar(pg, "X-Tudo")
    pg.click("#bagbtn"); pg.click("#irNome"); pg.fill("#nome", "Rita")
    pg.click("#enviar"); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('bp-enviado-em', JSON.stringify(Date.now() - 5 * 3600 * 1000))")   # 5 horas depois
    pg.reload(); pronto(pg); pg.wait_for_timeout(300)
    check(pg.is_hidden("#bagbtn"), "pedido já enviado há horas: o site começa com o pedido vazio")
    check(pg.is_visible("#repetir"), "e oferece 'Pedir de novo'")
    pg.evaluate("localStorage.setItem('bp-sacola-v2', JSON.stringify([{id:'hamburguer/x-salada',qtd:1,adds:[],obs:''}]))")
    pg.reload(); pronto(pg); pg.wait_for_timeout(300)
    check(pg.is_visible("#bagbtn"), "pedido novo, diferente do enviado: continua guardado")
    ctx.close()

    print("\n[5] Lanche que saiu do cardápio some do pedido com aviso")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pronto(pg)
    pg.evaluate("localStorage.setItem('bp-sacola-v2', JSON.stringify([{id:'hamburguer/x-salada',qtd:1,adds:[],obs:''},{id:'hamburguer/x-antigo-que-saiu',qtd:2,adds:[],obs:''}]))")
    pg.reload(); pronto(pg); pg.wait_for_timeout(300)
    check(pg.is_visible("#toast") and "cardápio" in (pg.text_content("#toast") or ""), f"avisa que um lanche saiu do cardápio ({(pg.text_content('#toast') or '')[:60]})")
    check(pg.text_content("#bagN") == "1", "o resto do pedido continua")
    ctx.close()

    print("\n[6] Página do atendente: mensagem copiada do WhatsApp Web/Desktop e conta automática")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL + "conferir.html"); pg.wait_for_timeout(1200)
    msg = ("[18:07, 13/11/2026] Rita: *PEDIDO - LANCHONETE BATE PAPO*\n\n*Cliente:* Rita\n\n------------------------------\n\n"
           "*2x X-TUDO*\n   + adicional de bacon (em cada)\n\n------------------------------\n\nObrigado!")
    pg.fill("#txt", msg); pg.wait_for_timeout(700)                 # digitou/colou: sem apertar Calcular
    out = pg.text_content("#out") or ""
    check("R$ 60,00" in out, f"conta sozinha, sem apertar o botão (2 × (24 + 6) = R$ 60,00) [{out[:80]}]")
    check("não são do cardápio" not in out, "o carimbo '[18:07, 13/11/2026] Rita:' do WhatsApp Web não vira linha estranha")
    msg2 = "13/11/2026 18:07 - Rita: *1x X-SALADA*"
    pg.fill("#txt", msg2); pg.wait_for_timeout(700)
    check("R$ 13,00" in (pg.text_content("#out") or ""), "também entende o formato de conversa exportada do celular")
    ctx.close()

    print("\n[7] Duas abas ao mesmo tempo")
    ctx = b.new_context(); a = nova(ctx); a.goto(URL); pronto(a); c = nova(ctx); c.goto(URL); pronto(c)
    adicionar(a, "X-Salada"); c.wait_for_timeout(300)
    check(c.text_content("#bagN") == "1", "a outra aba vê o lanche que entrou")
    abrir_item(c, "X-Bacon"); c.click('#itFoot [data-acao="continuar"]'); c.click('#itFoot [data-acao="continuar"]')
    a.click("#bagbtn"); a.click("#esvaziar"); c.wait_for_timeout(300)
    c.click('#itFoot [data-acao="confirmar"]'); c.wait_for_timeout(500)
    itens = c.evaluate("JSON.parse(localStorage.getItem('bp-sacola-v2')).map(l => l.id)")
    check(itens == ["hamburguer/x-bacon"], f"aba A limpou enquanto a aba B escolhia: fica só o X-Bacon, sem 'ressuscitar' o X-Salada ({itens})")
    check(not a._erros and not c._erros, "sem erros de script nas duas abas")
    ctx.close()

    print("\n[9] Toques em rajada e Esc repetido nunca tiram a pessoa do site")
    ctx = b.new_context(); pg = nova(ctx)
    pg.goto(URL + "conferir.html"); pg.wait_for_timeout(800)          # uma página antes no histórico (como vir do Google)
    pg.goto(URL); pronto(pg)
    for rodada in range(3):
        abrir_item(pg, "X-Tudo")
        pg.evaluate("""() => { for (let i = 0; i < 40; i++) { const x = document.querySelector('#itFoot [data-acao=continuar],#itFoot [data-acao=voltar],#itFoot [data-acao=confirmar]'); if (x) x.click(); } }""")
        pg.wait_for_timeout(300)
        for _ in range(6): pg.keyboard.press("Escape")
        pg.wait_for_timeout(1200)
    check(pg.url.rstrip("/").endswith("127.0.0.1:" + PORTA) and pg.evaluate("!!window.BP"), f"continua no cardápio depois de 3 rajadas ({pg.url})")
    check(pg.is_hidden("#ovItem") and not pg.evaluate("document.body.classList.contains('lock')"), "janela fechada e página rolando normalmente")
    adicionar(pg, "X-Salada"); pg.click("#bagbtn")
    if pg.is_visible("#ovBag"):
        pg.click("#irNome")
        pg.evaluate("""() => { for (let i = 0; i < 30; i++) { document.getElementById('voltar').click(); document.getElementById('irNome').click(); } }""")
        pg.wait_for_timeout(300)
        for _ in range(6): pg.keyboard.press("Escape")
        pg.wait_for_timeout(1200)
        check(pg.url.rstrip("/").endswith("127.0.0.1:" + PORTA) and pg.is_hidden("#ovBag"), "rajada no pedido (Voltar/Pedir pelo WhatsApp) também não sai do site")
    check(not pg._erros, f"sem erros de script {pg._erros[:2]}")
    ctx.close()

    print("\n[8] Ícone para a tela inicial do celular")
    ctx = b.new_context(); pg = nova(ctx); pg.goto(URL); pronto(pg)
    man = pg.evaluate("(document.querySelector('link[rel=manifest]') || {}).href || ''")
    ati = pg.evaluate("(document.querySelector('link[rel=apple-touch-icon]') || {}).href || ''")
    check(bool(man) and bool(ati), "tem manifesto e ícone para 'Adicionar à tela inicial'")
    if man:
        r = pg.request.get(man); j = r.json() if r.ok else {}
        check(j.get("name") and j.get("icons") and all(pg.request.get(URL + i["src"]).ok for i in j["icons"]), "manifesto válido e ícones existem")
    ctx.close()
    b.close()

print(f"\nRESULTADO: {ok} ok, {len(falhas)} falhas")
sys.exit(1 if falhas else 0)
