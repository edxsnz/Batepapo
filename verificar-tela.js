/* Tela "Verificar cardápio": mostra o que o site entendeu do cardapio.js e avisa de qualquer erro. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const alerta = (titulo, corpo) => `<div class="alerta"><b>${titulo}</b><br>${corpo}</div>`;
  const DICAS = "<ul><li>Falta uma <b>vírgula</b> no fim de alguma linha?</li><li>Alguma aspa <code>\"</code> ficou aberta?</li><li>O preço está com ponto (<code>14.50</code>) e não com vírgula (<code>14,50</code>)?</li><li>Dica: desfaça a última mudança e veja se o erro some.</li></ul>";

  function mostrar() {
    const erros = window.__errosCardapio || [];
    const doCardapio = erros.filter(e => e.arquivo === "cardapio.js");
    if (doCardapio.length) {
      const e = doCardapio[0];
      $("out").innerHTML = alerta("O arquivo cardapio.js tem um erro de digitação" + (e.linha ? ` perto da linha ${e.linha}` : "") + ".",
        `O site mostra "Cardápio indisponível" até isso ser corrigido.<br><span class="sub">Mensagem do navegador: ${esc(e.msg)}</span>${DICAS}`);
      return;
    }
    if (!window.BP || !Array.isArray(window.CARDAPIO)) {
      $("out").innerHTML = alerta("Não consegui ler o cardápio.", "Confira se os arquivos <code>cardapio.js</code> e <code>core.js</code> estão na mesma pasta desta página.");
      return;
    }
    const BP = window.BP, cat = BP.catalogo(window.CARDAPIO);
    let h = "";
    if (cat.avisos.length) h += alerta("Estes itens foram ignorados pelo site:", `<ul>${cat.avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>`);
    const numero = String(window.WHATSAPP || "").replace(/\D/g, "");
    if (!/^55\d{10,11}$/.test(numero)) h += alerta("O número do WhatsApp está errado.", "Use 55 + DDD + número, só dígitos. Exemplo: <code>551633823518</code>.");
    else h += `<p class="sub">WhatsApp que recebe os pedidos: <b>(${esc(numero.slice(2, 4))}) ${esc(numero.slice(4, -4))}-${esc(numero.slice(-4))}</b></p>`;
    const dest = cat.lista.filter(i => i.destaque);
    if (dest.length !== 1) h += alerta("Atenção ao destaque.", `Hoje ${dest.length === 0 ? "nenhum lanche está" : dest.length + " lanches estão"} com <code>destaque</code>. O normal é 1 (o "Especial da casa" que aparece no topo do site).`);
    else h += `<p class="sub">Lanche em destaque no topo: <b>${esc(dest[0].nome)}</b> (${BP.brl(dest[0].preco)})</p>`;
    const total = cat.lista.length + cat.adicionais.length;
    h += `<p class="okmsg">${cat.avisos.length ? "Confira os avisos acima." : `Tudo certo: ${total} itens lidos, nenhum problema.`}</p>`;
    const porCat = new Map();
    Object.values(cat.itens).forEach(i => { if (!porCat.has(i.categoria)) porCat.set(i.categoria, []); porCat.get(i.categoria).push(i); });
    porCat.forEach((itens, nome) => {
      h += `<div class="card"><h2>${esc(nome)}</h2><table><tbody>${itens.map(i => `<tr><td>${esc(i.nome)}${i.destaque ? ` <span class="sub">· ${esc(i.destaque)}</span>` : ""}</td><td class="v">${BP.brl(i.preco)}</td></tr>`).join("")}</tbody></table></div>`;
    });
    $("out").innerHTML = h;
  }
  if (document.readyState === "complete") mostrar(); else window.addEventListener("load", mostrar);
})();
