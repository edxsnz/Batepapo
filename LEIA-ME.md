# Cardápio Lanchonete Bate Papo — Versão 3

## Arquivos

| Arquivo | Para que serve | Precisa editar? |
|---|---|---|
| `cardapio.js` | Lanches, preços, destaque e número do WhatsApp | **Sim, só este** |
| `index.html` | O site do cardápio | Não |
| `app.js` | Busca, sacola e pedido | Não |
| `core.js` | Regras de preço, validação e mensagem | Não |
| `carregar.js` | Faz o site se atualizar sozinho para quem já visitou (sem precisar "limpar cache") | Não |
| `_headers` | Regra de cache para Netlify/Cloudflare (no GitHub Pages é ignorado) | Não |
| `verificar.html` | Mostra os preços como o site entendeu e avisa de erros de digitação | Não (só abrir) |
| `conferir.html` + `conferir.js` | Página do atendente para conferir o valor do pedido | Não |
| `fonts/` | Fontes do site (hospedadas junto, sem depender do Google) | Não |

## Mudar um preço

Abra o `cardapio.js`, troque o número depois de `preco:` e salve. Use ponto nos centavos: `14.50`.

**Depois de salvar, abra `seusite/verificar.html`.** Ela lista todos os lanches com o preço que o site entendeu. Se faltar uma vírgula ou uma aspa, ela diz qual é a linha do erro. Sem ela, um erro de digitação deixaria o site "indisponível" sem você saber o motivo.

## Atualização automática

O GitHub Pages deixa o navegador guardar os arquivos por uns 10 minutos, então quem já tinha visitado o site podia continuar vendo preços antigos. O `carregar.js` resolve: a cada visita ele pergunta ao servidor se algo mudou (uma pergunta leve) e, se a página mudou, recarrega uma vez sozinho. **Você não precisa fazer nada além de salvar/subir os arquivos.** Se estiver sem internet, o cardápio abre normalmente com o que o navegador já tem.

Só na **primeira** vez depois de subir esta versão, quem tem o site aberto no celular pode precisar de uns 10 minutos (ou atualizar uma vez) para pegar o carregador; dali em diante é automático.

## Conferir o valor de um pedido

A mensagem que chega no WhatsApp não leva preço, de propósito. Para saber o valor:

1. Abra `seusite/conferir.html` (deixe salvo nos favoritos do celular da lanchonete).
2. Copie a mensagem do cliente no WhatsApp e cole na página.
3. O total aparece calculado com os preços oficiais. Linhas que não são do cardápio aparecem destacadas num aviso.

## Pedido grande ou WhatsApp que não abre

Na tela do pedido há o botão **Copiar pedido**: copia a mensagem para o cliente colar na conversa. Se o pedido for muito grande para caber no link do WhatsApp, o site avisa e sugere esse botão.

## Testes (para quem mexer no código)

```
cd tests
npm install
node --test unit.test.js                 # regras de preço, validação e mensagem
node --test saboteur.test.js             # SABOTADOR das regras: 20 mil sacolas lixo, textos venenosos, cardápio quebrado...
python3 -m http.server 8765 -d ..  &     # serve o site
python3 e2e.py                           # bateria no navegador (precisa de: pip install playwright)
python3 saboteur.py                      # SABOTADOR no navegador: macaco, armazenamento cheio, HTML adulterado, 2 abas, telas extremas...
python3 saboteur.py macaco               # roda só um cenário (macaco, storage, dom, abas, historico, busca, texto, cliques, ambiente, conferir, teclado, desempenho, privacidade, verificar, atualizacao)
```

O sabotador usa sementes fixas: se ele achar um defeito, o defeito aparece sempre igual até ser corrigido.

## Novidades da Versão 2

- **Pedir de novo:** depois que o cliente envia um pedido, o celular dele guarda esse pedido. Na próxima visita aparece "Já pediu por aqui antes?" com um botão que recoloca tudo no pedido. Os preços são sempre os atuais do `cardapio.js`, e lanche que saiu do cardápio é ignorado.
- **Imprimir o cardápio:** abra o site no computador e use Ctrl+P. Sai só o cardápio, em preto e branco, sem botões (4 páginas A4).
- **Ingredientes:** aparecem separados por pontos, e os molhos numa linha menor embaixo. Isso é só na tela, o texto no `cardapio.js` continua igual.
- **Celular deitado:** o botão "Pedir pelo WhatsApp" não sai mais da tela.

## Botões (revisão do time, Versão 2)

- Todos os botões seguem um padrão único (tokens `--btn-h`, `--r-btn`, `--sh-btn`... no começo do CSS): pelo menos 44px para o dedo (48px nos principais), mesma sombra e mesmo "afundar" ao tocar, foco visível no teclado.
- "Adicionar ao pedido", "Ver meu pedido" e os botões das janelas se reorganizam sozinhos em tela pequena ou com fonte grande: nada sai da tela e o preço nunca é cortado.
- O aviso "Pronto!" fica acima do botão "Ver meu pedido"; tocar nele só fecha o aviso.
- Teste de layout: `cd tests && python3 layout.py` (com o site em http://127.0.0.1:8765/). Ele confere 16 tamanhos de tela (celular pequeno, comum, grande, deitado, fonte grande, tablet e PC) em 18 situações do pedido e reprova botão fora da tela, cortado, pequeno demais, aviso cobrindo o botão ou palavra de título partida.

## Visual da Versão 3

- **Ideia:** o quadro de letras de feltro com os preços, pendurado na parede de azulejo da lanchonete, com o barrado de azulejo vermelho embaixo. O quadro aparece na capa e no rodapé; o resto do site é limpo, para ficar fácil de ler.
- **Quadro da capa:** mostra alguns lanches com o preço de verdade, puxado do `cardapio.js` (muda sozinho quando você muda o preço). Tocar numa linha abre o pedido daquele lanche. No celular aparecem 4 lanches; no computador, 6.
- **Cores** (no começo do CSS do `index.html`): verde-feltro `#1e3b30`, letra `#f2f0e6`, azulejo `#f6f8f5`, mostarda `#f2b807` (botão Pedir), ketchup `#c8321f` (avisos e barrado), verde do WhatsApp `#15803f` só no botão de enviar. O amarelo mostarda é só para botões (o que dá para tocar); o destaque da casa é um quadrinho de feltro.
- **Letras:** Barlow Condensed (quadro, nomes e preços) e Figtree (textos). Caixa-alta só no quadro, como as letrinhas de verdade.
- **Ingredientes** aparecem como frase ("Pão, filé, queijo, alface, tomate e batata palha."); no `cardapio.js` continuam escritos do mesmo jeito.
- As páginas `conferir.html` e `verificar.html` usam o mesmo visual.
- **Quem já pediu** vê o "Como pedir por aqui" fechado e o "Pedir de novo" no topo (chega mais rápido aos lanches). Quem abrir o "Como pedir" de novo continua vendo ele aberto.
- **Molhos:** quando todos os lanches de uma seção vêm com maionese, ketchup e mostarda, isso aparece uma vez embaixo do título da seção, em vez de repetir em cada lanche.

## Prévia ao compartilhar o link (WhatsApp, Facebook, Instagram)

- A imagem é o arquivo `compartilhar.jpg` (1200 × 630). Ela precisa estar na mesma pasta do `index.html` no GitHub.
- As tags ficam no começo do `index.html` e usam o endereço completo `https://edxsnz.github.io/Batepapo/`. Se o endereço do site mudar (outro nome de repositório ou domínio próprio), troque esse endereço nas linhas indicadas.
- O WhatsApp guarda a prévia de um link por um tempo. Se você já tinha mandado o link antes, a prévia nova pode demorar a aparecer nessa conversa; em conversas novas ela já vem certa. Para testar na hora, mande o link com algo no final, por exemplo `https://edxsnz.github.io/Batepapo/?v=2`.

## Revisão de qualidade, segurança e corridas (novembro de 2026)

O que foi corrigido (cada item tem teste em `tests/corridas.py`):
- **Atualização no meio do pedido:** se uma versão nova do site chega enquanto o cliente escolhe um lanche (internet lenta, iPhone), a página não recarrega mais na cara dele. Ela espera a janela fechar e o campo de texto ficar vazio, e aí se atualiza sozinha.
- **Scripts sempre novos:** o `carregar.js` coloca uma "impressão digital" no endereço de cada script (`app.js?v=...`), então o navegador nunca usa um script velho guardado.
- **Botão voltar do celular:** volta um passo (de "Do seu jeito" para "Quantidade", da tela do nome para o pedido) em vez de fechar tudo.
- **Toques em rajada:** vários toques seguidos em Voltar/Corrigir ou Esc repetido não somam mais vários "voltar" (antes podiam tirar a pessoa do site).
- **Desfazer:** remover um lanche, baixar para zero ou "Limpar meu pedido" mostra um aviso com o botão **Desfazer**. Com a janela aberta, o aviso aparece no alto da tela e não cobre os botões.
- **Pedido já enviado:** se o pedido foi enviado há mais de 3 horas e não mudou, o site começa com o pedido vazio na próxima visita (o "Pedir de novo" continua lá).
- **Lanche que saiu do cardápio:** se você tirar um lanche do `cardapio.js`, quem tinha ele no pedido vê um aviso e o resto do pedido continua.
- **Página do atendente (`conferir.html`):** confere sozinha enquanto cola ou digita, e entende a mensagem copiada do WhatsApp Web/Desktop (com o "[18:07, 13/11/2026] Rita:" na frente) e de conversa exportada do celular.
- **Ícone na tela inicial:** "Adicionar à tela inicial" no celular agora mostra o ícone do quadro de feltro e abre como aplicativo (`manifest.webmanifest` e pasta `icones/`).
- **iPhone:** rolar até o fim de uma janela não puxa mais o cardápio que está atrás.

Testes: `cd tests && python3 corridas.py` (com o site em http://127.0.0.1:8765/; usa a porta 8791 para simular internet lenta).
