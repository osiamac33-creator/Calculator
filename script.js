(function () {
  'use strict';

  const displayEl = document.getElementById('display');
  const expressionEl = document.getElementById('expression');
  const keysEl = document.querySelector('.keys');
  const aiInput = document.getElementById('aiInput');
  const aiSubmit = document.getElementById('aiSubmit');
  const aiAnswer = document.getElementById('aiAnswer');

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

  // ---- Sound engine: short synthesised beeps, no audio files needed ----
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;

  const TONES = {
    digit: { freq: 480, duration: 0.045, type: 'sine', volume: 0.05 },
    operator: { freq: 600, duration: 0.05, type: 'square', volume: 0.03 },
    equals: { freq: 780, duration: 0.09, type: 'sine', volume: 0.06 },
    clear: { freq: 260, duration: 0.09, type: 'sawtooth', volume: 0.04 },
    backspace: { freq: 340, duration: 0.04, type: 'square', volume: 0.03 },
  };

  function playSound(name) {
    if (!audioCtx) return;
    const tone = TONES[name];
    if (!tone) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.freq, now);
    gainNode.gain.setValueAtTime(tone.volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.duration);
  }

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
    playSound('digit');
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
    playSound('digit');
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
    playSound('operator');
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
    playSound('equals');
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
    playSound('operator');
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
    playSound('backspace');
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
    playSound('clear');
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

    if (document.activeElement === aiInput) return;

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

  // ---- AI panel: type any question, get it solved automatically ----
  async function askAI(question) {
    aiAnswer.classList.remove('is-error');
    aiAnswer.classList.add('is-loading');
    aiAnswer.textContent = 'Thinking…';
    aiSubmit.disabled = true;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content:
                'You are the brain of a pocket calculator. Solve the problem below. ' +
                'Reply with ONLY the final answer, plus one short line of working if useful. ' +
                'Max 2 lines, no markdown, no preamble. Problem: ' + question,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Request failed: ' + response.status);

      const data = await response.json();
      const text = (data.content || [])
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n')
        .trim();

      aiAnswer.classList.remove('is-loading');
      aiAnswer.textContent = text || 'No answer returned.';
      playSound('equals');
    } catch (err) {
      aiAnswer.classList.remove('is-loading');
      aiAnswer.classList.add('is-error');
      aiAnswer.textContent = 'Could not reach the AI right now. This feature needs the page to be running inside Claude.';
      playSound('clear');
    } finally {
      aiSubmit.disabled = false;
    }
  }

  function submitAiQuestion() {
    const question = aiInput.value.trim();
    if (!question) return;
    playSound('operator');
    askAI(question);
  }

  if (aiSubmit && aiInput) {
    aiSubmit.addEventListener('click', submitAiQuestion);
    aiInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitAiQuestion();
      }
    });
  }

  updateDisplay();
})();
