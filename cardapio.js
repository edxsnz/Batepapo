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
      { nome: "X-Salada",                 preco: 13,    ingredientes: "Pão, Hambúrguer, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Salada Bacon",           preco: 17,    ingredientes: "Pão, Hambúrguer, Queijo, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Bacon",                  preco: 16.80,    ingredientes: "Pão, Hambúrguer, Queijo, Bacon, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Egg",                    preco: 17,    ingredientes: "Pão, Hambúrguer, Queijo, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Milho",                  preco: 16, ingredientes: "Pão, Hambúrguer, Queijo, Milho, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Burguer",                preco: 13,    ingredientes: "Pão, Hambúrguer, Queijo, Presunto, Batata Palha, " + MOLHOS },
      { nome: "Big Master",               preco: 19,    ingredientes: "Pão, 2 Hambúrgueres, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Tudo",                   preco: 24,    ingredientes: "Pão, Hambúrguer, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Tudo Milho e Calabresa", preco: 29,    ingredientes: "Pão, Hambúrguer, Queijo, Presunto, Ovo, Bacon, Milho, Calabresa, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Calabresa",              preco: 20,    ingredientes: "Pão, Calabresa, Queijo, Bacon, Catupiry, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "X-Tudo Duplo",             preco: 32,    ingredientes: "Pão, 2 Hambúrgueres, 2 Ovos, Queijo, Presunto, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Filé de Frango",
    icone: "frango",
    itens: [
      { nome: "Frango Salada",        preco: 17, ingredientes: "Pão, Filé de Frango, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Salada Bacon",  preco: 23, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Salada Egg",    preco: 22, ingredientes: "Pão, Filé de Frango, Queijo, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Tudo",          preco: 27, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Frango Tudo Especial", preco: 32, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Ovo, Bacon, Milho, Calabresa, Catupiry, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Contra Filé",
    icone: "file",
    itens: [
      { nome: "Filé Salada",        preco: 17, ingredientes: "Pão, Filé, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Salada Bacon",  preco: 23, ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Salada Egg",    preco: 22.50, ingredientes: "Pão, Filé, Queijo, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Tudo",          preco: 28, ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Filé Tudo Especial", preco: 33, ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Ovo, Milho, Calabresa, Catupiry, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Bate Papo Especial", preco: 32, destaque: "Especial da casa", ingredientes: "Pão, Filé, Queijo, Presunto, Bacon, Milho, Calabresa, Catupiry, Cebola, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Lanches Especiais",
    icone: "estrela",
    itens: [
      { nome: "Vienense",           preco: 27, ingredientes: "Pão, Contra Filé, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, " + MOLHOS },
      { nome: "Mix Lanches",        preco: 27, ingredientes: "Pão, Filé de Frango, Queijo, Presunto, Ovo, Bacon, Alface, Tomate, " + MOLHOS },
      { nome: "Americano Especial", preco: 33, ingredientes: "Pão, Contra Filé, Queijo, Presunto, 2 Ovos, Bacon, Catupiry, Alface, Tomate, " + MOLHOS },
      { nome: "X-Especial",         preco: 35, ingredientes: "Pão, Hambúrguer, Contra Filé, Ovo, Calabresa, Catupiry, Bacon, Milho, Presunto, Queijo, Alface, Tomate, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Tradicionais",
    icone: "sanduiche",
    itens: [
      { nome: "Misto Quente",          preco: 10, ingredientes: "Pão, Presunto, Mussarela, " + MOLHOS },
      { nome: "Bauru",                 preco: 18, ingredientes: "Pão, Contra Filé, Queijo, Cebola, Tomate, " + MOLHOS },
      { nome: "Bauru de Presunto",     preco: 13, ingredientes: "Pão, Queijo, Presunto, Tomate, Cebola, " + MOLHOS },
      { nome: "Americano",             preco: 20, ingredientes: "Pão, Contra Filé, Ovo, Alface, Tomate, Batata Palha, " + MOLHOS },
      { nome: "Americano de Presunto", preco: 15, ingredientes: "Pão, Queijo, Presunto, Ovo, Batata Palha, " + MOLHOS },
    ],
  },
  {
    categoria: "Porções",
    icone: "porcao",
    itens: [
      { nome: "Porção de Calabresa",   preco: 30 },
      { nome: "Porção de Contra Filé", preco: 50 },
      { nome: "Porção de Frango",      preco: 45 },
      { nome: "Porção Mista",          preco: 55, ingredientes: "Contra Filé, Frango, Cebola, Calabresa e Tomate" },
    ],
  },
  {
    categoria: "Complementos",
    icone: "mais",
    subtitulo: "Escolha ao adicionar seu lanche",
    itens: [
      { nome: "Ovo",        preco: 3 },
      { nome: "Hambúrguer", preco: 7 },
      { nome: "Bacon",      preco: 6 },
      { nome: "Presunto",   preco: 4 },
      { nome: "Milho",      preco: 3 },
      { nome: "Queijo",     preco: 5 },
      { nome: "Catupiry",   preco: 7 },
      { nome: "Calabresa",  preco: 6 },
    ],
  },
];
