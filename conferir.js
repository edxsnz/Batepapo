/* Página do atendente: recalcula o pedido com os preços oficiais do cardapio.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const BP = window.BP;
  if (!BP) { $("out").innerHTML = '<div class="alerta"><b>Não foi possível carregar.</b> Atualize a página.</div>'; return; }
  const cat = BP.catalogo(window.CARDAPIO);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function calcular() {
    const texto = $("txt").value;
    if (!texto.trim()) { $("out").innerHTML = ""; return; }
    const r = BP.lerMensagem(texto, cat);
    let h = "";
    if (!r.linhas.length) {
      h = `<div class="alerta"><b>Nenhum item do cardápio encontrado.</b> Confira se a mensagem foi colada inteira.</div>`;
    } else {
      h = `<div class="card">
        ${r.cliente ? `<div class="cli">Cliente: ${esc(BP.limpar(r.cliente, 40))}</div>` : ""}
        <table><tbody>${r.linhas.map(l => `<tr><td>
            <div class="nm">${l.qtd}x ${esc(l.item.nome)}</div>
            ${l.adds.length ? `<div class="sub">+ ${l.adds.map(a => esc(a.nome)).join(", ")}${l.qtd > 1 ? " (em cada)" : ""}</div>` : ""}
            ${l.obs ? `<div class="sub">Obs: ${esc(l.obs)}</div>` : ""}
            <div class="sub">${l.qtd} × ${BP.brl(l.unit)}</div>
          </td><td class="v">${BP.brl(l.subtotal)}</td></tr>`).join("")}</tbody></table>
        <div class="tot"><span>Total</span><strong>${BP.brl(r.total)}</strong></div>
      </div>`;
    }
    if (r.estranhas.length) {
      h += `<div class="alerta"><b>Atenção:</b> estas linhas não são do cardápio e não entraram na conta. Confirme com o cliente:<ul>${r.estranhas.slice(0, 20).map(t => `<li>${esc(t.slice(0, 120))}</li>`).join("")}</ul></div>`;
    } else if (r.linhas.length) {
      h += `<p class="okmsg">Todos os itens foram reconhecidos.</p>`;
    }
    $("out").innerHTML = h;
  }
  $("calc").addEventListener("click", calcular);
  $("txt").addEventListener("paste", () => setTimeout(calcular, 0));
  $("limpa").addEventListener("click", () => { $("txt").value = ""; $("out").innerHTML = ""; $("txt").focus(); });
})();
