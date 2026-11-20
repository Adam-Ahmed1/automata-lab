import { $, element, option } from './dom.js';
import { createDfaView } from './dfa-view.js';

export function createNfaView({ graph, onInspect, editor }) {
  const sharedView = createDfaView({ graph, onInspect, editor });

  function renderDefinition(machine) {
    sharedView.renderDefinition(machine);

    const symbols = [...machine.definition.alphabet, 'ε'];

    $('#query-symbol').replaceChildren(...symbols.map(symbol => option(
      symbol,
      symbol === 'ε' ? 'ε (no input)' : symbol === ' ' ? '␠ (space)' : symbol
    )));
    $('#transition-button').disabled = false;
    $('#transition-result').replaceChildren(element('span', {
      class: 'muted',
      text: 'Choose a state and symbol, including ε.'
    }));
  }

  function renderTable(machine) {
    const definition = machine.definition;
    const symbols = [...definition.alphabet, 'ε'];
    const table = element('table', { class: 'data-table' });

    table.append(element('caption', {
      class: 'sr-only',
      text: 'Transition function for ' + machine.name
    }));
    table.append(element('thead', {}, element('tr', {}, [
      element('th', { scope: 'col', text: 'State' }),
      ...symbols.map(symbol => element('th', {
        scope: 'col',
        text: symbol === ' ' ? '␠' : symbol
      }))
    ])));
    table.append(element('tbody', {}, definition.states.map(state => element('tr', {}, [
      element('th', { scope: 'row' }, element('button', {
        class: 'state-table-button',
        type: 'button',
        text: (state === definition.startState ? '→ ' : '') +
          (definition.acceptStates.includes(state) ? '◎ ' : '') + state,
        onclick: () => onInspect(state)
      })),
      ...symbols.map(symbol => {
        const targets = definition.transitions[state]?.[symbol] || [];

        return element('td', {
          class: 'mono',
          text: targets.length ? '{' + targets.join(', ') + '}' : '∅'
        });
      })
    ]))));
    $('#transition-table').replaceChildren(table);
  }

  function onTrace(states) {
    const select = $('#query-state');

    if (states.length && !states.includes(select.value)) {
      select.value = states[0];
    }
  }

  return { graph, editor, renderDefinition, renderTable, onTrace };
}
