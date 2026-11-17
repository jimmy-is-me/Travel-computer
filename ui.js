"use strict";
// Keep preference changes separate from the accounting logic.
(function () {
  const initialTheme = ['light', 'dark', 'system'].includes(window.travelInitialTheme)
    ? window.travelInitialTheme : 'light';
  const needsPreferenceSave = data.theme !== initialTheme;
  data.theme = initialTheme;

  const parseOriginal = parse;
  parse = function (backupData) {
    const result = parseOriginal(backupData);
    if (!['light', 'dark', 'system'].includes(backupData.theme)) result.theme = 'light';
    return result;
  };

  const clearOriginal = $('confirmClear').onclick;
  $('confirmClear').onclick = function (event) {
    const previousData = data;
    clearOriginal.call(this, event);
    // The original handler replaces data only after a successful clear.
    if (data !== previousData) {
      data.theme = 'light';
      theme();
    }
  };

  const container = $('calcPage');
  const summaryCard = container.querySelector('.card');
  const keypad = $('keys');
  const saveButton = $('openSave');
  const note = container.querySelector('.note.center');
  const layout = document.createElement('div');
  layout.className = 'calculator-layout';
  const summaryColumn = document.createElement('div');
  summaryColumn.className = 'calculator-summary';
  const actionsColumn = document.createElement('div');
  actionsColumn.className = 'calculator-actions';
  container.insertBefore(layout, summaryCard);
  summaryColumn.append(summaryCard);
  actionsColumn.append(keypad, saveButton, note);
  layout.append(summaryColumn, actionsColumn);

  document.addEventListener('keydown', function (event) {
    const target = document.activeElement;
    if (page !== 'calc' || document.querySelector('dialog[open]') ||
        event.ctrlKey || event.metaKey || event.altKey ||
        target?.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName)) return;
    if (/^[0-9.+\-*/()]$/.test(event.key)) {
      event.preventDefault();
      press(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      press('back');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      press('C');
    } else if (event.key === 'Enter' && target === document.body) {
      event.preventDefault();
      press('=');
    }
  });

  theme();
  if (needsPreferenceSave) save();
})();
