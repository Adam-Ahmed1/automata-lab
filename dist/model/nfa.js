class NFA {
    #states;
    #alphabet;
    #delta;
    #startState;
    #acceptStates
    
    constructor(...definition) {
        if (definition.length !== 5) {
            throw new Error("Input is an incorrect NFA definition.");
        }

        this.#states = new Set(definition[0]);
        this.#alphabet = new Set(definition[1]);
        if (this.#alphabet.has(EPSILON)) {
            throw new Error(`Alphabet cannot contain ${EPSILON}`);
        }

        this.#delta = structuredClone(definition[2]);
        this.#validtateDelta();
        
        this.#startState = definition[3];
        if (!(this.#states.has(this.#startState))) {
            throw new Error('Start state is not one of the NFA\'s states.');
        }
        
        this.#acceptStates = new Set(definition[4]);
        if (!(this.#acceptStates.isSubsetOf(this.#states))) {
            throw new Error('Set of accept states should be a subset of the NFA\'s states.');
        }
    }

    getStates() {
        return this.#states;
    }

    getAlphabet() {
        return this.#alphabet;
    }

    getStartState() {
        return this.#startState;
    }

    getAcceptStates() {
        return this.#acceptStates;
    }

    transition(currentState, inputSymbol) {
        if (!this.#states.has(currentState)) {
            throw new Error(`${currentState} is not one of the NFA's states.`);
        }
        
        if (!this.#alphabet.has(inputSymbol) && inputSymbol !== EPSILON) {
            throw new Error(`${inputSymbol} is neither a symbol in the NFA's alphabet nor ε.`);
        }

        return new Set(this.#delta[currentState][inputSymbol] ?? []); // empty set is getting stuck.
    }

    accepts(string) {
        const DFA = NFA.convertToDFA(this);
        return DFA.accepts(string);
    }

    simulate(string) {
        const DFA = NFA.convertToDFA(this);
        return DFA.simulate(string);
    }

    static convertToDFA(nfa) {
        if (!(nfa instanceof NFA)) {
            throw new Error(`${nfa} is not an NFA instance.`);
        }

        const subsetId = subset => JSON.stringify([...subset].sort());
        const subsets = nfa.getAllSubsets([...nfa.getStates()]);
        const states = subsets.map(subsetId);
        const alphabet = nfa.getAlphabet();
        const start = subsetId(nfa.epsilonClosure(nfa.getStartState()));

        const accepting = nfa.getAcceptStates();
        const acceptStates = subsets
            .filter(subset => subset.some(state => accepting.has(state)))
            .map(subsetId);

        const delta = {};
        for (const subset of subsets) {
            const from = subsetId(subset);
            delta[from] = {};

            for (const symbol of alphabet) {
                let destination = new Set();
                for (const state of subset) {
                    for (const next of nfa.transition(state, symbol)) {
                        destination = destination.union(nfa.epsilonClosure(next));
                    }
                }
                delta[from][symbol] = subsetId(destination);
            }
        }

        return new DFA([states, alphabet, delta, start, acceptStates]);
    }

    // Source - https://stackoverflow.com/a/47147597
    // Posted by MennyMez
    // Retrieved 2026-11-16, License - CC BY-SA 3.0
    getAllSubsets(theArray) {
        return theArray.reduce((subsets, value) => subsets.concat(subsets.map(set => [value,...set])), [[]]);
    };

    epsilonClosure(state) {
        const visited = new Set([state]);
        const pending = [state];

        while (pending.length > 0) {
            const currentState = pending.pop();
            for (const stateI of this.transition(currentState, EPSILON)) {
                if (!(visited.has(stateI))) {
                    visited.add(stateI);
                    pending.push(stateI);
                }
            }
        }

        return visited;
    }

    #validtateDelta() {
        const allStates = new Set();
        for (const key in this.#delta) allStates.add(key);

        // #1 Checking all states are in the transition function
        if (!(allStates.isSubsetOf(this.#states) && this.#states.isSubsetOf(allStates))) {
            throw new Error('All states should be included in delta as a current state.');
        }

        const allInputs = new Set();
        const sigmaEpsilon = new Set(this.#alphabet).add(EPSILON);
        for (const [state, row] of Object.entries(this.#delta)) {
            if (Object.prototype.toString.call(row) !== '[object Object]') {
                throw new Error(`Invalid transition row for state ${state}.`);
            }
            for (const symbol of Object.keys(row)) {
                allInputs.add(symbol);
            }
        }
        
        // #2 Ensuring valid input for all transitions
        if (!(allInputs.isSubsetOf(sigmaEpsilon))) {
            throw new Error('Some inputs do not belong to the NFA\'s alphabet.');
        }

        let allOutputStates = new Set();
        for (const key in this.#delta) {
            for (const symbol in this.#delta[key]) {
                allOutputStates = allOutputStates.union(this.#delta[key][symbol]);
            }
        }

        // #3 Ensuring all destination states are in the NFA states
        if (!(allOutputStates.isSubsetOf(this.#states))) {
            throw new Error('Invalid destination states.');
        }
    }

}

/*
    transition function structure
    delta = {
        'q1': {
            'ε': new Set(['q1', 'q2']),
            '0': new Set(['q1', 'q2']),
            '1': new Set(['q3'])
        },
        
        'q2': {
            '0': new Set(['q2', 'q3'])
        }
    }
*/