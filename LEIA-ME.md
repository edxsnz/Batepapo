# Cardápio Lanchonete Bate Papo

## Arquivos

| Arquivo | Para que serve | Precisa editar? |
|---|---|---|
| `cardapio.js` | Lanches, preços, destaque e número do WhatsApp | **Sim, só este** |
| `index.html` | O site do cardápio | Não |
| `app.js` | Busca, sacola e pedido | Não |
| `core.js` | Regras de preço, validação e mensagem | Não |
| `verificar.html` | Mostra os preços como o site entendeu e avisa de erros de digitação | Não (só abrir) |
| `conferir.html` + `conferir.js` | Página do atendente para conferir o valor do pedido | Não |
| `fonts/` | Fontes do site (hospedadas junto, sem depender do Google) | Não |

## Mudar um preço

Abra o `cardapio.js`, troque o número depois de `preco:` e salve. Use ponto nos centavos: `14.50`.

**Depois de salvar, abra `seusite/verificar.html`.** Ela lista todos os lanches com o preço que o site entendeu. Se faltar uma vírgula ou uma aspa, ela diz qual é a linha do erro. Sem ela, um erro de digitação deixaria o site "indisponível" sem você saber o motivo.

## Conferir o valor de um pedido

A mensagem que chega no WhatsApp não leva preço, de propósito. Para saber o valor:

1. Abra `seusite/conferir.html` (deixe salvo nos favoritos do celular da lanchonete).
2. Copie a mensagem do cliente no WhatsApp e cole na página.
3. O total aparece calculado com os preços oficiais. Linhas que não são do cardápio aparecem em vermelho.

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
python3 saboteur.py macaco               # roda só um cenário (macaco, storage, dom, abas, historico, busca, texto, cliques, ambiente, conferir, teclado, desempenho, privacidade, verificar)
```

O sabotador usa sementes fixas: se ele achar um defeito, o defeito aparece sempre igual até ser corrigido.
