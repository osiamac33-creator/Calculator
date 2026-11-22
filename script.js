(function () {
  'use strict';

  const displayEl = document.getElementById('display');
  const expressionEl = document.getElementById('expression');
  const keysEl = document.querySelector('.keys');

  const initialState = () => ({
    displayValue: '0',
    expressionValue: '',
    firstOperand: null,
    operator: null,
    waitingForSecondOperand: false,
    justEvaluated: false,
  });

  let state = initialState();

  const MAX_DIGITS = 14;

  function formatNumber(num) {
    if (!isFinite(num)) return 'Error';
    let rounded = Math.round((num + Number.EPSILON) * 1e10) / 1e10;
    let str = rounded.toString();
    if (str.replace(/[-.]/g, '').length > MAX_DIGITS) {
      str = rounded.toExponential(6);
    }
    return str;
  }

  function calculate(first, second, operator) {
    switch (operator) {
      case '+':
        return first + second;
      case '−':
        return first - second;
      case '×':
        return first * second;
      case '÷':
        return second === 0 ? Infinity : first / second;
      default:
        return second;
    }
  }

  function updateDisplay() {
    displayEl.textContent = state.displayValue;
    expressionEl.textContent = state.expressionValue || '\u00A0';

    const len = state.displayValue.replace('-', '').length;
    displayEl.classList.toggle('is-long', len > 8 && len <= 12);
    displayEl.classList.toggle('is-longer', len > 12);
  }

  function resetIfError() {
    if (state.displayValue === 'Error') {
      state = initialState();
    }
  }

  function inputDigit(digit) {
    resetIfError();
    if (state.justEvaluated) {
      state.expressionValue = '';
      state.justEvaluated = false;
    }
    if (state.waitingForSecondOperand) {
      state.displayValue = digit;
      state.waitingForSecondOperand = false;
    } else {
      if (state.displayValue.replace('-', '').length >= MAX_DIGITS) return;
      state.displayValue = state.displayValue === '0' ? digit : state.displayValue + digit;
    }
    updateDisplay();
  }

  function inputDecimal() {
    resetIfError();
    if (state.justEvaluated) {
      state.expressionValue = '';
      state.justEvaluated = false;
    }
    if (state.waitingForSecondOperand) {
      state.displayValue = '0.';
      state.waitingForSecondOperand = false;
      updateDisplay();
      return;
    }
    if (!state.displayValue.includes('.')) {
      state.displayValue += '.';
    }
    updateDisplay();
  }

  function handleOperator(nextOperator) {
    resetIfError();
    const inputValue = parseFloat(state.displayValue);
    state.justEvaluated = false;

    if (state.operator && state.waitingForSecondOperand) {
      state.operator = nextOperator;
      state.expressionValue = `${formatNumber(state.firstOperand)} ${nextOperator}`;
      updateDisplay();
      return;
    }

    if (state.firstOperand === null) {
      state.firstOperand = inputValue;
    } else if (state.operator) {
      const result = calculate(state.firstOperand, inputValue, state.operator);
      state.displayValue = formatNumber(result);
      state.firstOperand = result;
    }

    state.operator = nextOperator;
    state.waitingForSecondOperand = true;
    state.expressionValue = `${formatNumber(state.firstOperand)} ${nextOperator}`;
    updateDisplay();
  }

  function handleEquals() {
    resetIfError();
    if (state.operator === null || state.waitingForSecondOperand) return;

    const inputValue = parseFloat(state.displayValue);
    const result = calculate(state.firstOperand, inputValue, state.operator);

    state.expressionValue = `${formatNumber(state.firstOperand)} ${state.operator} ${formatNumber(inputValue)} =`;
    state.displayValue = formatNumber(result);
    state.firstOperand = null;
    state.operator = null;
    state.waitingForSecondOperand = true;
    state.justEvaluated = true;
    updateDisplay();
  }

  function handlePercent() {
    resetIfError();
    const current = parseFloat(state.displayValue);
    let percentValue;
    if (state.operator && state.firstOperand !== null) {
      percentValue = state.firstOperand * (current / 100);
    } else {
      percentValue = current / 100;
    }
    state.displayValue = formatNumber(percentValue);
    state.waitingForSecondOperand = false;
    updateDisplay();
  }

  function handleBackspace() {
    resetIfError();
    if (state.waitingForSecondOperand || state.justEvaluated) return;
    if (state.displayValue.length <= 1 || (state.displayValue.length === 2 && state.displayValue.startsWith('-'))) {
      state.displayValue = '0';
    } else {
      state.displayValue = state.displayValue.slice(0, -1);
    }
    updateDisplay();
  }

  function handleClear() {
    state = initialState();
    updateDisplay();
  }

  function flashKey(selector) {
    const btn = keysEl.querySelector(selector);
    if (!btn) return;
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 100);
  }

  keysEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.key');
    if (!btn) return;
    const { action, digit, operator } = btn.dataset;

    switch (action) {
      case 'digit':
        inputDigit(digit);
        break;
      case 'decimal':
        inputDecimal();
        break;
      case 'operator':
        handleOperator(operator);
        break;
      case 'equals':
        handleEquals();
        break;
      case 'percent':
        handlePercent();
        break;
      case 'backspace':
        handleBackspace();
        break;
      case 'clear':
        handleClear();
        break;
    }
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
      inputDigit(key);
      flashKey(`[data-digit="${key}"]`);
    } else if (key === '.') {
      inputDecimal();
      flashKey('[data-action="decimal"]');
    } else if (key === '+' || key === '-') {
      const op = key === '+' ? '+' : '−';
      handleOperator(op);
      flashKey(`[data-operator="${op}"]`);
    } else if (key === '*' || key.toLowerCase() === 'x') {
      handleOperator('×');
      flashKey('[data-operator="×"]');
    } else if (key === '/') {
      event.preventDefault();
      handleOperator('÷');
      flashKey('[data-operator="÷"]');
    } else if (key === 'Enter' || key === '=') {
      event.preventDefault();
      handleEquals();
      flashKey('[data-action="equals"]');
    } else if (key === 'Backspace') {
      handleBackspace();
      flashKey('[data-action="backspace"]');
    } else if (key === 'Escape') {
      handleClear();
      flashKey('[data-action="clear"]');
    } else if (key === '%') {
      handlePercent();
      flashKey('[data-action="percent"]');
    }
  });

  updateDisplay();
})();
