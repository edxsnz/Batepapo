// =====================================================================
//  CARDÁPIO DA LANCHONETE BATE PAPO
//
//  Para mudar um preço: troque só o número depois de "preco:".
//  Use PONTO nos centavos  →  14.50  (não 14,50)
//
//  Para tirar um lanche: apague a linha dele.
//  Para colocar um lanche: copie uma linha e troque nome, preço e ingredientes.
//  Cada lanche precisa ter um nome diferente dos outros.
//
//  Para destacar um lanche no topo do site: coloque  destaque: "Especial da casa"
//  (o texto entre aspas é o selo que aparece).
// =====================================================================

// Número do WhatsApp que recebe os pedidos (55 + DDD + número, só dígitos)
window.WHATSAPP = "551633823518";

const MOLHOS = "Maionese, Ketchup e Mostarda";

window.CARDAPIO = [
  {
    categoria: "Hambúrguer",
    icone: "burger",
    itens: [
      { nome: "X-Salada",                 preco: 12,    ingredientes: "Pão, Hambúrguer, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Salada Bacon",           preco: 15,    ingredientes: "Pão, Hambúrguer, Queijo, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Bacon",                  preco: 15,    ingredientes: "Pão, Hambúrguer, Queijo, Bacon, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Egg",                    preco: 15,    ingredientes: "Pão, Hambúrguer, Queijo, Ovo, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Milho",                  preco: 14.50, ingredientes: "Pão, Hambúrguer, Queijo, Milho, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Burguer",                preco: 12,    ingredientes: "Pão, Hambúrguer, Queijo, Presunto, Batata Palha, " + MOLHOS },
      { nome: "Big Master",               preco: 17,    ingredientes: "Pão, 2 Hambúrgueres, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Tudo",                   preco: 22,    ingredientes: "Pão, Hambúrguer, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Tudo Milho e Calabresa", preco: 27,    ingredientes: "Pão, Hambúrguer, Queijo, Presunto, Ovo, Bacon, Milho, Calabresa, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Calabresa",              preco: 19,    ingredientes: "Pão, Calabresa, Queijo, Bacon, Catupiry, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Tudo Duplo",             preco: 29,    ingredientes: "Pão, 2 Hambúrgueres, 2 Ovos, Queijo, Presunto, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Filé de Frango",
    icone: "frango",
    itens: [
      { nome: "Frango Salada",        preco: 15, ingredientes: "Pão, Filé de Frango, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Salada Bacon",  preco: 20, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Salada Egg",    preco: 19, ingredientes: "Pão, Filé de Frango, Queijo, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Tudo",          preco: 25, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Tudo Especial", preco: 28, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Ovo, Bacon, Milho, Calabresa, Catupiry, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Contra Filé",
    icone: "file",
    itens: [
      { nome: "Filé Salada",        preco: 15, ingredientes: "Pão, Filé, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Salada Bacon",  preco: 20, ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Salada Egg",    preco: 19, ingredientes: "Pão, Filé, Queijo, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Tudo",          preco: 25, ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Tudo Especial", preco: 28, ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Ovo, Milho, Calabresa, Catupiry, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Bate Papo Especial", preco: 27, destaque: "Especial da casa", ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Milho, Calabresa, Catupiry, Cebola, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Lanches Especiais",
    icone: "estrela",
    itens: [
      { nome: "Vienense",           preco: 24, ingredientes: "Pão, Contra Filé, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, " + MOLHOS },
      { nome: "Mix Lanches",        preco: 24, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, " + MOLHOS },
      { nome: "Americano Especial", preco: 30, ingredientes: "Pão, Contra Filé, Queijo, Presunto, 2 Ovos, Bacon, Catupiry, Alface, Tomate, " + MOLHOS },
      { nome: "X-Especial",         preco: 32, ingredientes: "Pão, Hambúrguer, Contra Filé, Ovo, Calabresa, Catupiry, Bacon, Milho, Presunto, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Tradicionais",
    icone: "sanduiche",
    itens: [
      { nome: "Misto Quente",          preco: 10, ingredientes: "Pão, Presunto, Mussarela, " + MOLHOS },
      { nome: "Bauru",                 preco: 17, ingredientes: "Pão, Contra Filé, Queijo, Cebola, Tomate, " + MOLHOS },
      { nome: "Bauru de Presunto",     preco: 13, ingredientes: "Pão, Queijo, Presunto, Tomate, Cebola, " + MOLHOS },
      { nome: "Americano",             preco: 18, ingredientes: "Pão, Contra Filé, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Americano de Presunto", preco: 14, ingredientes: "Pão, Queijo, Presunto, Ovo, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Porções",
    icone: "porcao",
    itens: [
      { nome: "Porção de Calabresa",   preco: 25 },
      { nome: "Porção de Contra Filé", preco: 40 },
      { nome: "Porção de Frango",      preco: 40 },
      { nome: "Porção Mista",          preco: 50, ingredientes: "Contra Filé, Frango, Cebola, Calabresa e Tomate" },
    ],
  },
  {
    categoria: "Complementos",
    icone: "mais",
    subtitulo: "Escolha ao adicionar seu lanche",
    itens: [
      { nome: "Ovo",        preco: 3 },
      { nome: "Hambúrguer", preco: 5 },
      { nome: "Bacon",      preco: 4 },
      { nome: "Presunto",   preco: 3 },
      { nome: "Milho",      preco: 3 },
      { nome: "Queijo",     preco: 4 },
      { nome: "Catupiry",   preco: 4 },
      { nome: "Calabresa",  preco: 4 },
    ],
  },
];
