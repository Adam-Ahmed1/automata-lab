/* JSON integration and simulation traces around the NFA model. */
(() => {
  const reserved = new Set(['__proto__', 'constructor', 'prototype']);

  function list(value, label, maximum) {
    if (!Array.isArray(value) || value.length > maximum) {
      throw new Error(label + ' must be a list of at most ' + maximum + ' entries.');
    }
    if (value.some(item =>
      typeof item !== 'string' ||
      !item.length ||
      item.length > 64 ||
      /[\u0000-\u001f]/.test(item) ||
      reserved.has(item)
    )) {
      throw new Error(label + ' must contain nonempty text labels, without control characters or reserved object names.');
    }
    if (new Set(value).size !== value.length) {
      throw new Error(label + ' contains duplicate entries.');
    }

    return value;
  }

  function make(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error('A machine definition is required.');
    }

    const states = list(definition.states, 'States', 144);
    const alphabet = list(definition.alphabet, 'Alphabet', 12);
    const acceptStates = list(definition.acceptStates, 'Accepting states', 144);

    if (!states.length) {
      throw new Error('Add at least one state.');
    }
    if (alphabet.some(symbol => [...symbol].length !== 1)) {
      throw new Error('Each alphabet symbol must be exactly one Unicode character.');
    }
    if (alphabet.includes(EPSILON)) {
      throw new Error('Alphabet cannot contain ' + EPSILON + '.');
    }
    if (!states.includes(definition.startState)) {
      throw new Error('Choose a start state from the state set.');
    }
    if (acceptStates.some(state => !states.includes(state))) {
      throw new Error('Accepting states must belong to the state set.');
    }

    const source = definition.transitions;

    if (Object.prototype.toString.call(source) !== '[object Object]') {
      throw new Error('Provide a transition table.');
    }

    const transitions = Object.fromEntries(states.map(state => [state, {}]));

    for (const [state, row] of Object.entries(source)) {
      if (!states.includes(state)) {
        throw new Error('Transition rows must belong to the state set.');
      }
      if (Object.prototype.toString.call(row) !== '[object Object]') {
        throw new Error('Invalid transition row for state ' + state + '.');
      }

      for (const [symbol, targets] of Object.entries(row)) {
        if (!alphabet.includes(symbol) && symbol !== EPSILON) {
          throw new Error('Transition symbols must belong to the alphabet or be ' + EPSILON + '.');
        }

        const destinations = list(targets, 'Transition targets', 144);

        if (destinations.some(target => !states.includes(target))) {
          throw new Error('Transition targets must belong to the state set.');
        }

        transitions[state][symbol] = new Set(destinations);
      }
    }

    return new NFA(states, alphabet, transitions, definition.startState, acceptStates);
  }

  function serialize(machine) {
    const states = [...machine.getStates()];
    const alphabet = [...machine.getAlphabet()];
    const symbols = [...alphabet, EPSILON];
    const transitions = Object.fromEntries(states.map(state => [
      state,
      Object.fromEntries(symbols.map(symbol => [
        symbol,
        [...machine.transition(state, symbol)]
      ]))
    ]));

    return {
      states,
      alphabet,
      transitions,
      startState: machine.getStartState(),
      acceptStates: [...machine.getAcceptStates()]
    };
  }

  function run(machine, input) {
    if (typeof input !== 'string' || [...input].length > 256) {
      throw new Error('Use a string of up to 256 symbols.');
    }

    const alphabet = machine.getAlphabet();

    for (const symbol of input) {
      if (!alphabet.has(symbol)) {
        throw new Error(symbol + ' does not belong to the NFA alphabet.');
      }
    }

    const closures = new Map();

    function close(states) {
      const closed = new Set();

      for (const state of states) {
        if (closed.has(state)) {
          continue;
        }
        if (!closures.has(state)) {
          closures.set(state, machine.epsilonClosure(state));
        }
        for (const target of closures.get(state)) {
          closed.add(target);
        }
      }

      return closed;
    }

    function epsilonEdges(states) {
      const edges = [];

      for (const from of states) {
        for (const to of machine.transition(from, EPSILON)) {
          edges.push({ from, to, symbol: EPSILON });
        }
      }

      return edges;
    }

    let current = close([machine.getStartState()]);
    const trace = [{
      state: [...current],
      symbol: null,
      index: 0,
      edges: epsilonEdges(current)
    }];

    for (const [index, symbol] of [...input].entries()) {
      const destinations = new Set();
      const edges = [];

      for (const from of current) {
        for (const to of machine.transition(from, symbol)) {
          destinations.add(to);
          edges.push({ from, to, symbol });
        }
      }

      current = close(destinations);
      trace.push({
        state: [...current],
        symbol,
        index: index + 1,
        edges: edges.concat(epsilonEdges(current))
      });
    }

    const finalState = [...current];
    const accepted = finalState.some(state => machine.getAcceptStates().has(state));

    return { input, accepted, finalState, trace };
  }

  registerMachineType({
    id: 'nfa',
    label: 'NFA',
    capabilities: ['simulate', 'batch', 'transition', 'diagram', 'transition-table', 'edit'],
    serialize,

    describe(definition) {
      return serialize(make(definition));
    },

    operations: [
      {
        id: 'simulate',
        visible: false,

        run(payload) {
          return run(make(payload.definition), payload.input);
        }
      },
      {
        id: 'batch',
        visible: false,

        run(payload) {
          if (!Array.isArray(payload.inputs)) {
            throw new Error('Provide a list of strings.');
          }

          const inputs = payload.inputs.filter(input => input !== '');

          if (!inputs.length || inputs.length > 50) {
            throw new Error('Enter 1–50 strings to test.');
          }

          const machine = make(payload.definition);

          return inputs.map(input => {
            try {
              const { trace, ...result } = run(machine, input);

              return result;
            } catch (error) {
              return { input, error: error.message };
            }
          });
        }
      },
      {
        id: 'transition',
        visible: false,

        run(payload) {
          const machine = make(payload.definition);

          return {
            state: payload.state,
            symbol: payload.symbol,
            next: [...machine.transition(payload.state, payload.symbol)]
          };
        }
      },
      {
        id: 'convert',
        symbol: '→',
        defaultName: 'Converted DFA',
        successMessage: 'DFA created',
        title: 'Convert NFA to DFA',
        label: 'Create DFA',
        description: 'Build a DFA that accepts the same strings as this NFA.',
        fields: [
          {
            key: 'sourceId',
            modelKey: 'source',
            type: 'machine',
            label: 'Source NFA'
          },
          {
            key: 'name',
            type: 'text',
            label: 'Result name',
            placeholder: 'Converted DFA'
          }
        ],

        run(payload) {
          const converted = NFA.convertToDFA(make(payload.source));

          if (converted.getStates().size > 144) {
            throw new Error('This conversion would exceed the workspace limit of 144 states. Choose a smaller machine.');
          }

          return {
            kind: 'machine',
            type: 'dfa',
            definition: machineAdapters.get('dfa').serialize(converted)
          };
        }
      }
    ]
  });
})();
