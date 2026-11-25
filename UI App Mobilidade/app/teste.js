// Move Ijuí — modo de teste de usabilidade.
// Abra app/index.html?teste. A pessoa recebe 3 tarefas; o app detecta sozinho quando cada uma é concluída
// e registra tempo, toques, quantas vezes voltou e o caminho de telas. Os resultados ficam salvos neste
// navegador (localStorage) e podem ser copiados ou baixados em CSV no final.
(() => {
  if (!new URLSearchParams(location.search).has("teste")) return;

  const KEY = "moveIjuiTestes";
  const TASKS = [
    {
      title: "Ir de ônibus ao campus",
      text: "Você está na Praça da República e precisa chegar ao Campus UNIJUÍ de ônibus. Use o app para escolher o ônibus e acompanhar a viagem até chegar.",
      done: id => id === "s08" && state.dest === "Campus UNIJUÍ",
    },
    {
      title: "Pedir um carro para o HCI",
      text: "Agora você precisa ir ao HCI (Hospital de Caridade) de carro. Peça uma corrida pelo app até o motorista estar a caminho.",
      done: id => id === "s12" && state.dest === "HCI",
    },
    {
      title: "Descobrir se a linha está atrasada",
      text: "Você ouviu dizer que a sua linha de ônibus pode estar atrasada. Descubra pelo app de quanto é o atraso.",
      done: id => id === "s14",
    },
  ];
  const NAMES = {
    s01: "Início", s02: "Rotas", s03: "Linha 03", s04: "Pontos", s05: "Ao vivo", s06: "Corrida", s07: "Avaliar corrida",
    s08: "Viagem concluída", s09: "Pedir carro", s10: "Categoria", s11: "Buscando", s12: "Seu motorista",
    s14: "Alertas", s15: "Perfil", s16: "Modo motorista", s17: "Sem motoristas",
    s18: "Corrida cancelada", s19: "Corrida agendada", s20: "Favos",
    s21: "Bicicleta", s22: "Segurança", s23: "Pagamentos", s24: "Adicionar local", s25: "Ajuda",
  };
  const DEFAULT_STATE = { ...state };
  const saved = () => JSON.parse(localStorage.getItem(KEY) || "[]");

  const session = { participante: `P${saved().length + 1}`, data: new Date().toLocaleString("pt-BR"), tarefas: [] };
  let run = null; // tarefa em andamento

  // ---------- Interface por cima do app ----------
  const root = document.createElement("div");
  root.id = "test";
  root.innerHTML = `
    <div class="t-pill" hidden><span class="t-label"></span><button class="t-giveup">Desisti</button></div>
    <div class="t-sheet"><div class="t-card"></div></div>`;
  $("#app").appendChild(root);
  const pill = $(".t-pill", root), sheet = $(".t-sheet", root), card = $(".t-card", root);

  function showCard(html) { card.innerHTML = html; sheet.classList.add("show"); }
  function hideCard() { sheet.classList.remove("show"); }

  function intro() {
    showCard(`
      <div class="t-icon"><span class="ms">science</span></div>
      <h2>Teste do app Move Ijuí</h2>
      <p>Obrigado por ajudar! Vamos pedir <b>3 tarefas</b> simples. Não existe resposta certa ou errada: quem está sendo testado é o app, não você.</p>
      <p>Pense em voz alta enquanto usa: conte o que procura e o que espera que aconteça.</p>
      <label class="t-field">Nome ou código do participante<input id="t-name" value="${session.participante}"></label>
      <button class="btn primary" data-t="start">Começar</button>`);
  }

  function brief(i) {
    const t = TASKS[i];
    showCard(`
      <div class="t-step">Tarefa ${i + 1} de ${TASKS.length}</div>
      <h2>${t.title}</h2>
      <p>${t.text}</p>
      <button class="btn primary" data-t="go" data-i="${i}">Começar tarefa</button>`);
  }

  function startTask(i) {
    hideCard();
    // cada tarefa começa do zero, no Início
    Object.assign(state, DEFAULT_STATE); render(); setOffline(false);
    stack = []; show("s01", 0); history.replaceState(null, "", "#s01");
    run = { i, t0: performance.now(), toques: 0, voltar: 0, telas: ["s01"] };
    pill.hidden = false;
    $(".t-label", pill).textContent = `Tarefa ${i + 1} de ${TASKS.length}`;
  }

  function finishTask(sucesso) {
    if (!run) return;
    const t = TASKS[run.i];
    session.tarefas.push({
      tarefa: t.title, sucesso,
      tempo_s: Math.round((performance.now() - run.t0) / 100) / 10,
      toques: run.toques, voltar: run.voltar, telas: run.telas.map(id => NAMES[id] || id).join(" > "),
    });
    const i = run.i; run = null; pill.hidden = true;
    const next = i + 1 < TASKS.length;
    showCard(`
      <div class="t-icon ${sucesso ? "" : "warn"}"><span class="ms">${sucesso ? "check_circle" : "flag"}</span></div>
      <h2>${sucesso ? "Tarefa concluída!" : "Tudo bem, vamos seguir"}</h2>
      <p>${sucesso ? "Muito bem." : "Isso ajuda a gente a achar o que está confuso."} ${next ? "Quando quiser, passe para a próxima." : "Essa era a última."}</p>
      <button class="btn primary" data-t="${next ? "next" : "end"}" data-i="${i + 1}">${next ? "Próxima tarefa" : "Ver resultados"}</button>`);
  }

  function end() {
    const all = saved(); all.push(session); localStorage.setItem(KEY, JSON.stringify(all));
    const rows = session.tarefas.map((r, k) => `<tr><td>${k + 1}</td><td>${r.sucesso ? "✓" : "—"}</td><td>${r.tempo_s}s</td><td>${r.toques}</td><td>${r.voltar}</td></tr>`).join("");
    showCard(`
      <div class="t-icon"><span class="ms">insights</span></div>
      <h2>Obrigado, ${session.participante.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))}!</h2>
      <p>Resultados desta sessão (já salvos neste aparelho):</p>
      <table class="t-table"><tr><th>Tarefa</th><th>Ok</th><th>Tempo</th><th>Toques</th><th>Voltou</th></tr>${rows}</table>
      <div class="row gap-8 mt-16">
        <button class="btn sm tonal" data-t="copy">Copiar CSV</button>
        <button class="btn sm tonal" data-t="download">Baixar CSV</button>
      </div>
      <button class="btn primary mt-12" data-t="again">Novo participante</button>`);
  }

  // ---------- CSV ----------
  function csv(sessions) {
    const head = ["participante", "data", "tarefa", "sucesso", "tempo_s", "toques", "voltar", "telas"];
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = sessions.flatMap(s => s.tarefas.map(r => [s.participante, s.data, r.tarefa, r.sucesso ? "sim" : "nao", r.tempo_s, r.toques, r.voltar, r.telas].map(esc).join(",")));
    return [head.join(","), ...lines].join("\n");
  }
  window.moveIjuiCSV = csv;

  // ---------- Eventos ----------
  root.addEventListener("click", async e => {
    const b = e.target.closest("[data-t]");
    if (e.target.closest(".t-giveup")) return finishTask(false);
    if (!b) return;
    const a = b.dataset.t, i = +b.dataset.i;
    if (a === "start") { session.participante = ($("#t-name").value || session.participante).trim(); brief(0); }
    if (a === "go") startTask(i);
    if (a === "next") brief(i);
    if (a === "end") end();
    if (a === "copy") { await navigator.clipboard.writeText(csv([session])); toast("CSV copiado"); }
    if (a === "download") {
      const url = URL.createObjectURL(new Blob([csv([session])], { type: "text/csv" }));
      Object.assign(document.createElement("a"), { href: url, download: `teste-move-ijui-${session.participante}.csv` }).click();
    }
    if (a === "again") location.reload();
  });

  // conta toques no app (fora do painel de teste)
  document.addEventListener("click", e => { if (run && !root.contains(e.target)) run.toques++; }, true);
  window.onBack = () => { if (run) run.voltar++; };
  window.onScreen = id => {
    if (!run) return;
    if (run.telas[run.telas.length - 1] !== id) run.telas.push(id);
    if (TASKS[run.i].done(id)) setTimeout(() => finishTask(true), 700);
  };

  intro();
})();
