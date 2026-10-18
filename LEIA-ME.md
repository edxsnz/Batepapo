# Cardápio Lanchonete Bate Papo

## Arquivos

| Arquivo | Para que serve | Precisa editar? |
|---|---|---|
| `cardapio.js` | Lanches, preços, destaque e número do WhatsApp | **Sim, só este** |
| `index.html` | O site do cardápio | Não |
| `app.js` | Busca, sacola e pedido | Não |
| `core.js` | Regras de preço, validação e mensagem | Não |
| `conferir.html` + `conferir.js` | Página do atendente para conferir o valor do pedido | Não |

## Mudar um preço

Abra o `cardapio.js`, troque o número depois de `preco:` e salve. Use ponto nos centavos: `14.50`.

## Conferir o valor de um pedido

A mensagem que chega no WhatsApp não leva preço, de propósito. Para saber o valor:

1. Abra `seusite/conferir.html` (deixe salvo nos favoritos do celular da lanchonete).
2. Copie a mensagem do cliente no WhatsApp e cole na página.
3. O total aparece calculado com os preços oficiais. Linhas que não são do cardápio aparecem em vermelho.

## Testes (para quem mexer no código)

```
cd tests
npm install
node --test unit.test.js                 # regras de preço, validação e mensagem
python3 -m http.server 8765 -d ..  &     # serve o site
python3 e2e.py                           # bateria no navegador (precisa de: pip install playwright)
```
