/* Pega erros de digitação no cardapio.js (vírgula faltando, aspas abertas...) para a tela de verificação explicar. */
(function () {
  "use strict";
  window.__errosCardapio = [];
  window.addEventListener("error", function (e) {
    window.__errosCardapio.push({ arquivo: String(e.filename || "").split("/").pop(), linha: e.lineno || 0, msg: String(e.message || "") });
  });
})();
