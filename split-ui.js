"use strict";

(() => {
  const model = SplitBill;
  const project = () => data.split;
  const memberName = id => project().members.find(member => member.id === id)?.name ?? "";
  const createId = () => globalThis.crypto?.randomUUID?.() ??
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const cash = amount => {
    const fractional = String(amount % 100).padStart(2, "0").replace(/0+$/, "");
    return "NT$ " + fmt(Math.floor(amount / 100), 0) + (fractional ? "." + fractional : "");
  };
  let memberEdit = null;
  let expenseEdit = null;
  let pendingRecord = null;
  let participantRows = [];

  function button(text, action, className = "") {
    const node = el("button", className, text);
    node.type = "button";
    node.onclick = action;
    return node;
  }

  function saveProject(message) {
    const saved = save();
    $("splitStorageStatus").hidden = saved;
    $("splitStorageStatus").textContent = saved ? "" : "目前無法儲存到瀏覽器，請到設定下載 JSON 備份。";
    if (saved && message) toast(message);
  }

  function replaceProject(next, message) {
    model.validate(next);
    data.split = next;
    saveProject(message);
    render();
  }

  function resetMemberForm() {
    memberEdit = null;
    $("splitMemberName").value = "";
    $("splitAddMember").textContent = "加入成員";
    cancelMember.hidden = true;
  }

  function beginMemberEdit(member) {
    memberEdit = member.id;
    $("splitMemberName").value = member.name;
    $("splitAddMember").textContent = "儲存姓名";
    cancelMember.hidden = false;
    $("splitMemberName").select();
    $("splitMemberName").focus();
  }

  function deleteMember(member) {
    if (project().expenses.some(expense => expense.payer === member.id ||
        expense.shares.some(share => share.member === member.id))) {
      toast("這位成員仍有分帳支出，請先修改或刪除相關支出。");
      return;
    }
    if (!confirm(`移除成員「${member.name}」？`)) return;
    if (memberEdit === member.id) resetMemberForm();
    replaceProject({ ...project(), members: project().members.filter(row => row.id !== member.id) }, "已移除成員");
    $("splitMemberName").focus();
  }

  function renderMembers() {
    const list = $("splitMembers");
    list.replaceChildren();
    for (const member of project().members) {
      const editButton = button("改名", () => beginMemberEdit(member));
      const removeButton = button("移除", () => deleteMember(member));
      editButton.setAttribute("aria-label", `改名 ${member.name}`);
      removeButton.setAttribute("aria-label", `移除 ${member.name}`);
      const row = el("li", "split-member");
      const actions = el("div", "split-actions");
      actions.append(editButton, removeButton);
      row.append(el("strong", "", member.name), actions);
      list.append(row);
    }
    $("splitAddExpense").disabled = !project().members.length || project().expenses.length >= model.maxExpenses;
    $("splitRecordPending").hidden = !pendingRecord;
    if (pendingRecord) $("splitRecordPending").querySelector("p").textContent = project().members.length ?
      "已帶入消費金額，請新增支出並選擇付款人與分攤對象。" :
      "已帶入消費金額。加入成員後，就能選擇付款人與分攤對象。";
  }

  function renderExpenses() {
    const list = $("splitExpenses");
    list.replaceChildren();
    if (!project().expenses.length) {
      list.append(el("p", "split-empty", project().members.length ?
        "新增第一筆代墊支出，開始計算每人的分攤金額。" : "先加入成員，就可以記下每筆代墊。"));
      return;
    }
    for (const expense of [...project().expenses].reverse()) {
      const entry = el("article", "split-expense");
      const heading = el("div", "split-heading");
      heading.append(el("h3", "", expense.title), el("strong", "", cash(expense.amount)));
      const participants = expense.shares.map(share => memberName(share.member)).join("、");
      const actions = el("div", "split-actions");
      const editButton = button("編輯", () => openExpense(expense));
      const removeButton = button("刪除", () => {
        if (!confirm(`刪除分帳支出「${expense.title}」？`)) return;
        replaceProject({ ...project(), expenses: project().expenses.filter(row => row.id !== expense.id) }, "已刪除支出");
        $("splitAddExpense").focus();
      }, "danger");
      editButton.setAttribute("aria-label", `編輯 ${expense.title}`);
      removeButton.setAttribute("aria-label", `刪除 ${expense.title}`);
      actions.append(editButton, removeButton);
      entry.append(heading, el("p", "split-muted", `${memberName(expense.payer)} 代墊 · ${expense.mode === "equal" ? "平均分攤" : "自訂金額"}`),
        el("p", "split-muted", `分攤成員：${participants}`), actions);
      list.append(entry);
    }
  }

  function renderResults() {
    const { total, people, transfers } = model.settle(project());
    $("splitTotal").textContent = cash(total);
    $("splitCounts").textContent = `${people.length} 人 · ${project().expenses.length} 筆支出`;
    const target = $("splitTransfers");
    const hasExpenses = project().expenses.length > 0;
    target.replaceChildren();
    if (!transfers.length) {
      target.append(el("p", "split-empty", hasExpenses ?
        "目前每位成員的代墊與分攤已抵銷，無須轉帳。" : "加好支出後，這裡會顯示付款對象和金額。"));
    } else {
      const rows = el("ul", "split-list");
      for (const transfer of transfers) {
        const row = el("li", "split-transfer");
        row.append(el("span", "", `${memberName(transfer.from)} 付給 ${memberName(transfer.to)}`),
          el("strong", "", cash(transfer.amount)));
        rows.append(row);
      }
      target.append(rows);
    }
    $("splitBalances").hidden = !hasExpenses;
    const rows = $("splitBalanceRows");
    rows.replaceChildren();
    if (hasExpenses) {
      for (const person of people) {
        const row = el("tr");
        const name = el("th", "", person.name);
        name.scope = "row";
        const balance = person.balance === 0 ? "已抵銷" :
          `應${person.balance > 0 ? "收" : "付"} ${cash(Math.abs(person.balance))}`;
        row.append(name, el("td", "", cash(person.paid)), el("td", "", cash(person.owed)), el("td", "", balance));
        rows.append(row);
      }
    }
    $("splitOpenShare").disabled = !hasExpenses;
  }

  function render() {
    if (document.activeElement !== $("splitProjectName")) $("splitProjectName").value = project().name;
    renderMembers();
    renderExpenses();
    renderResults();
  }

  function updateParticipants() {
    const custom = $("splitMode").value === "custom";
    let count = 0;
    let sum = 0;
    let valid = true;
    for (const { selected, amount } of participantRows) {
      amount.hidden = !custom || !selected.checked;
      if (!selected.checked) continue;
      count++;
      if (custom) {
        try {
          sum += model.cents(amount.value);
        } catch {
          valid = false;
        }
      }
    }
    $("splitExpenseHelp").textContent = custom ?
      (valid && count ? `已分配 ${cash(sum)}，加總須等於代墊金額。` : "請填寫每位勾選成員的應付金額。") :
      `已選 ${count} 位。付款人若也要分攤，請一併勾選。`;
  }

  function expenseError(message) {
    $("splitExpenseError").hidden = !message;
    $("splitExpenseError").textContent = message;
  }

  function openExpense(expense = null) {
    const members = project().members;
    if (!members.length) {
      $("splitMemberName").focus();
      return;
    }
    if (!expense && project().expenses.length >= model.maxExpenses) {
      toast("已達分帳支出筆數上限。");
      return;
    }
    expenseEdit = expense;
    const form = $("splitExpenseForm");
    form.reset();
    $("splitExpenseTitle").textContent = expense ? "編輯支出" : pendingRecord ? "帶入消費紀錄" : "新增支出";
    $("splitExpenseName").value = expense?.title ?? pendingRecord?.title ?? "";
    const amount = expense?.amount ?? pendingRecord?.amount;
    $("splitAmount").value = amount ? String(amount / 100) : "";
    $("splitMode").value = expense?.mode ?? "equal";
    const payer = $("splitPayer");
    payer.replaceChildren(...members.map(member => new Option(member.name, member.id)));
    payer.value = expense?.payer ?? members[0].id;
    const storedShares = new Map(expense?.shares.map(share => [share.member, share.cents]));
    const choices = $("splitParticipants");
    choices.replaceChildren();
    participantRows = members.map(member => {
      const row = el("div", "split-picker");
      const label = el("label", "check");
      const selected = document.createElement("input");
      selected.type = "checkbox";
      selected.checked = !expense || storedShares.has(member.id);
      label.append(selected, el("span", "", member.name));
      const amount = document.createElement("input");
      amount.inputMode = "decimal";
      amount.maxLength = 22;
      amount.placeholder = "NT$ 0";
      amount.setAttribute("aria-label", `${member.name} 的分攤金額`);
      if (storedShares.has(member.id)) amount.value = String(storedShares.get(member.id) / 100);
      row.append(label, amount);
      choices.append(row);
      return { id: member.id, selected, amount };
    });
    expenseError("");
    updateParticipants();
    $("splitExpenseDialog").showModal();
    $("splitExpenseName").focus();
  }

  const cancelMember = button("取消改名", () => { resetMemberForm(); $("splitMemberName").focus(); });
  cancelMember.hidden = true;
  $("splitMemberForm").append(cancelMember);

  $("splitMemberForm").onsubmit = event => {
    event.preventDefault();
    const name = model.cleanText($("splitMemberName").value);
    const members = project().members;
    if (!name) { toast("請輸入成員姓名。"); return; }
    if (members.some(member => member.id !== memberEdit && model.nameKey(member.name) === model.nameKey(name))) {
      toast("已有同名成員，請用可辨識的暱稱。");
      return;
    }
    if (!memberEdit && members.length >= model.maxMembers) { toast("已達分帳成員人數上限。"); return; }
    const next = memberEdit ? members.map(member => member.id === memberEdit ? { ...member, name } : member) :
      [...members, { id: createId(), name }];
    replaceProject({ ...project(), members: next }, memberEdit ? "已更新姓名" : "已加入成員");
    resetMemberForm();
    $("splitMemberName").focus();
  };

  $("splitProjectName").oninput = event => {
    const name = model.cleanText(event.target.value);
    if (project().name === name) return;
    data.split = { ...project(), name };
    saveProject();
  };
  $("splitProjectName").onblur = event => { event.target.value = project().name; };

  $("splitAddExpense").onclick = () => openExpense();
  $("splitCancelRecord").onclick = () => { pendingRecord = null; renderMembers(); };
  $("splitExpenseForm").addEventListener("input", () => { expenseError(""); updateParticipants(); });
  $("splitPickAll").onclick = () => {
    participantRows.forEach(row => { row.selected.checked = true; });
    expenseError("");
    updateParticipants();
  };
  $("splitPickNone").onclick = () => {
    participantRows.forEach(row => { row.selected.checked = false; });
    expenseError("");
    updateParticipants();
  };

  $("splitExpenseForm").onsubmit = event => {
    event.preventDefault();
    try {
      const title = model.cleanText($("splitExpenseName").value);
      if (!title) throw Error("請輸入費用項目。");
      const amount = model.cents($("splitAmount").value);
      if (!amount) throw Error("代墊金額必須大於 0。");
      const chosen = participantRows.filter(row => row.selected.checked);
      if (!chosen.length) throw Error("請至少勾選一位分攤成員。");
      const mode = $("splitMode").value;
      const shares = mode === "equal" ? model.equalShares(amount, chosen.map(row => row.id)) :
        chosen.map(row => ({ member: row.id, cents: model.cents(row.amount.value) }));
      const payer = $("splitPayer").value;
      const expense = { id: expenseEdit?.id ?? createId(), title, amount, payer, mode, shares };
      const recordId = expenseEdit ? expenseEdit.recordId : pendingRecord?.recordId;
      if (recordId !== undefined) expense.recordId = recordId;
      const expenses = expenseEdit ? project().expenses.map(row => row.id === expense.id ? expense : row) :
        [...project().expenses, expense];
      replaceProject({ ...project(), expenses }, expenseEdit ? "已更新支出" : "已新增支出");
      if (!expenseEdit && pendingRecord) { pendingRecord = null; renderMembers(); }
      $("splitExpenseDialog").close();
      $("splitAddExpense").focus();
    } catch (error) {
      expenseError(error.message);
    }
  };

  window.addEventListener("split:record", event => {
    const record = event.detail;
    const existing = project().expenses.find(row => row.recordId === record.id);
    // Convert the original full expense once. Settlement works in integer cents.
    const amount = model.convertToCents(record.amount, record.currency === "TWD" ? 1 : record.rate);
    if (!existing && (!Number.isSafeInteger(amount) || amount <= 0 || amount > model.maxAmount)) {
      toast("原整筆紀錄換算後超出可帶入的分帳金額範圍。");
      return;
    }
    pendingRecord = existing ? null : { title: model.cleanText(record.title) || "未命名消費", amount, recordId: record.id };
    show("split");
    if (project().members.length) openExpense(existing);
    else $("splitMemberName").focus();
  });

  $("splitOpenShare").onclick = () => {
    const { total, transfers } = model.settle(project());
    const title = project().name ? `${project().name}｜分帳結果` : "旅遊小帳｜分帳結果";
    const lines = transfers.map(row => `${memberName(row.from)} 付給 ${memberName(row.to)} ${cash(row.amount)}`);
    const text = [title, `支出合計 ${cash(total)}（${project().expenses.length} 筆）`, "",
      ...(lines.length ? lines : ["目前無須轉帳。"])].join("\n");
    $("splitShareText").value = text;
    const query = new URLSearchParams({ text }).toString().replaceAll("+", "%20");
    $("splitLine").href = `https://line.me/R/share?${query}`;
    $("splitCopyStatus").textContent = "";
    $("splitShareDialog").showModal();
  };

  $("splitCopy").onclick = async () => {
    const field = $("splitShareText");
    try {
      await navigator.clipboard.writeText(field.value);
      $("splitCopyStatus").textContent = "已複製，可貼到 LINE 群組。";
    } catch {
      field.focus();
      field.select();
      const copied = document.execCommand("copy");
      $("splitCopyStatus").textContent = copied ? "已複製，可貼到 LINE 群組。" : "已選取文字，請手動複製。";
    }
  };

  window.addEventListener("split:render", render);
  window.addEventListener("split:reset", () => {
    pendingRecord = null;
    resetMemberForm();
    render();
  });
  render();
})();
