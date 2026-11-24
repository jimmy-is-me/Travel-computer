"use strict";

const SplitBill = (() => {
  const maxAmount = 100_000_000_000_000; // NT$1 trillion, in cents
  const maxMembers = 100;
  const maxExpenses = 2_000;
  const empty = () => ({ name: "", members: [], expenses: [] });
  const cleanText = value => value.trim().replace(/\s+/gu, " ");
  const nameKey = value => cleanText(value).normalize("NFKC").toLowerCase();
  const validText = (value, size) => typeof value === "string" && value === cleanText(value) && value.length <= size;
  const validId = value => typeof value === "string" && /^[a-z0-9-]{1,150}$/i.test(value);

  function cents(input) {
    const [whole, fraction = ""] = input.trim().split(".");
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input.trim())) {
      throw Error("請輸入有效的台幣金額，最多兩位小數。");
    }
    const amount = Number(whole.replaceAll(",", "")) * 100 + Number(fraction.padEnd(2, "0"));
    if (!Number.isSafeInteger(amount) || amount > maxAmount) throw Error("金額超過上限。");
    return amount;
  }

  function convertToCents(amount, rate) {
    const decimal = number => {
      const [mantissa, exponent = "0"] = String(number).split("e");
      const [whole, fraction = ""] = mantissa.split(".");
      return [BigInt(whole + fraction), Number(exponent) - fraction.length];
    };
    const [amountDigits, amountScale] = decimal(amount);
    const [rateDigits, rateScale] = decimal(rate);
    const product = amountDigits * rateDigits;
    const scale = amountScale + rateScale + 2;
    if (scale >= 0) return Number(product * 10n ** BigInt(scale));
    const divisor = 10n ** BigInt(-scale);
    return Number((product + divisor / 2n) / divisor);
  }

  function equalShares(amount, members) {
    if (!members.length) throw Error("請至少勾選一位分攤成員。");
    const base = Math.floor(amount / members.length);
    const remainder = amount % members.length;
    return members.map((member, index) => ({ member, cents: base + Number(index < remainder) }));
  }

  function validate(project) {
    if (!project || !validText(project.name, 60) || !Array.isArray(project.members) ||
        !Array.isArray(project.expenses) || project.members.length > maxMembers ||
        project.expenses.length > maxExpenses) throw Error("分帳資料格式錯誤。");

    const members = new Set();
    const names = new Set();
    for (const { id, name } of project.members) {
      if (!validId(id) || members.has(id) || !validText(name, 40) || !name || names.has(nameKey(name))) {
        throw Error("分帳成員資料有誤或重複。");
      }
      members.add(id);
      names.add(nameKey(name));
    }

    const expenses = new Set();
    const records = new Set();
    let total = 0;
    for (const expense of project.expenses) {
      const { id, title, amount, payer, mode, shares, recordId } = expense;
      if (!validId(id) || expenses.has(id) || !validText(title, 100) || !title ||
          !Number.isSafeInteger(amount) || amount <= 0 || amount > maxAmount ||
          !members.has(payer) || !["equal", "custom"].includes(mode) ||
          !Array.isArray(shares) || !shares.length || shares.length > members.size ||
          (recordId !== undefined && (typeof recordId !== "string" || !recordId ||
            recordId.length > 150 || records.has(recordId)))) throw Error("分帳支出資料有誤或重複。");

      const participants = new Set();
      let sum = 0;
      for (const share of shares) {
        if (!members.has(share.member) || participants.has(share.member) ||
            !Number.isSafeInteger(share.cents) || share.cents < 0 || share.cents > amount) {
          throw Error("分攤對象或金額有誤。");
        }
        participants.add(share.member);
        sum += share.cents;
      }
      if (sum !== amount) throw Error("各成員分攤金額加總必須等於代墊金額。");
      total += amount;
      if (!Number.isSafeInteger(total)) throw Error("全部支出加總超過可計算範圍。");
      if (mode === "equal" && equalShares(amount, [...participants]).some((share, i) => share.cents !== shares[i].cents)) {
        throw Error("平均分攤金額有誤。");
      }
      expenses.add(id);
      if (recordId !== undefined) records.add(recordId);
    }
    return project;
  }

  function settle(project) {
    const balances = new Map(project.members.map(member =>
      [member.id, { ...member, paid: 0, owed: 0, balance: 0 }]));
    let total = 0;
    for (const expense of project.expenses) {
      total += expense.amount;
      balances.get(expense.payer).paid += expense.amount;
      for (const share of expense.shares) balances.get(share.member).owed += share.cents;
    }
    const people = [...balances.values()];
    for (const person of people) person.balance = person.paid - person.owed;
    const creditors = people.filter(person => person.balance > 0)
      .sort((a, b) => b.balance - a.balance).map(person => ({ id: person.id, left: person.balance }));
    const debtors = people.filter(person => person.balance < 0)
      .sort((a, b) => a.balance - b.balance).map(person => ({ id: person.id, left: -person.balance }));
    const transfers = [];
    for (let d = 0, c = 0; d < debtors.length && c < creditors.length;) {
      const from = debtors[d];
      const to = creditors[c];
      const amount = Math.min(from.left, to.left);
      transfers.push({ from: from.id, to: to.id, amount });
      from.left -= amount;
      to.left -= amount;
      if (!from.left) d++;
      if (!to.left) c++;
    }
    return { total, people, transfers };
  }

  return { empty, cents, convertToCents, equalShares, validate, settle, cleanText, nameKey, maxMembers, maxExpenses, maxAmount };
})();
