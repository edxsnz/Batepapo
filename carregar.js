/* Lanchonete Bate Papo — carregador que mantém o site sempre atualizado.

   Por que existe: hospedagens grátis (GitHub Pages) deixam o navegador guardar os arquivos por uns 10 minutos.
   Quem já visitou o site continuava vendo preços antigos até "forçar a atualização".

   O que faz, a cada visita:
   1. Pergunta ao servidor se a página ou os scripts mudaram (pergunta leve: se nada mudou, vem só "304 não mudou").
   2. Carrega os scripts já atualizados.
   3. Se a própria página (index.html) mudou desde a última visita, recarrega UMA vez sozinho.
   Se estiver sem internet ou o servidor demorar, o cardápio abre normalmente com o que o navegador já tem.

   Este arquivo é pequeno e quase nunca muda. Para mudar preços: só o cardapio.js. */
(function () {
  "use strict";
  var el = document.currentScript;
  var lista = ((el && el.getAttribute("data-scripts")) || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var pagina = location.href.split("#")[0];
  var chave = "bp-versao:" + location.pathname;

  function hash(s) {                                   // impressão digital curta do conteúdo
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + "." + s.length;
  }
  function ler(k, sess) { try { return (sess ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }
  function gravar(k, v, sess) { try { (sess ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }

  var comecou = false;
  function iniciar() {                                  // carrega os scripts em ordem, um depois do outro
    if (comecou) return; comecou = true;
    (function proximo(i) {
      if (i >= lista.length) return;
      var s = document.createElement("script");
      s.src = lista[i];
      s.onload = s.onerror = function () { proximo(i + 1); };
      document.body.appendChild(s);
    })(0);
  }
  function buscar(url) {
    return fetch(url, { cache: "no-cache", credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : ""; }, function () { return ""; });
  }

  var espera = setTimeout(iniciar, 2500);               // servidor lento: não deixa o cardápio esperando
  if (!window.fetch || !window.Promise) { clearTimeout(espera); iniciar(); return; }

  Promise.all([buscar(pagina)].concat(lista.map(buscar))).then(function (r) {
    clearTimeout(espera);
    var pg = r[0], scripts = r.slice(1);
    if (pg && scripts.every(Boolean)) {                 // só decide se conseguiu ler tudo (sem internet, não mexe em nada)
      var nova = hash(pg) + "|" + hash(scripts.join("#separador#")), antiga = ler(chave);
      gravar(chave, nova);
      var mudouPagina = antiga && antiga.split("|")[0] !== nova.split("|")[0];
      var mudouScripts = antiga && antiga.split("|")[1] !== nova.split("|")[1];
      var jaRodou = comecou;                            // se os scripts já rodaram (servidor lento), podem ser os velhos
      var agora = Date.now();
      var recentes = (ler("bp-recarregou", true) || "").split(",").map(Number).filter(function (n) { return n && agora - n < 60000; });
      if ((mudouPagina || (jaRodou && mudouScripts)) && recentes.length < 2) {   // no máximo 2 recargas por minuto: nunca entra em laço
        recentes.push(agora); gravar("bp-recarregou", recentes.join(","), true);
        location.reload();
        return;
      }
    }
    iniciar();
  });
})();
