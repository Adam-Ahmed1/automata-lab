# Extending Automata Lab

The model classes, integration adapters, and interface are separate. Models live in `dist/model` and are maintained by the project author.

The worker loads model scripts and registers `dist/adapters/dfa.js` and `dist/adapters/nfa.js`. Each adapter validates JSON definitions, constructs model instances, and exposes operation metadata through the worker catalog. UI views are registered in `dist/app.js`.

NFA JSON definitions use arrays for each transition's targets, including the `ε` key. Omitted rows or symbols become empty target lists. The adapter converts arrays to model Sets and serializes them back to arrays for browser storage and exports.

NFA simulation traces contain an array of active states after ε-closure at each input position. Trace edges include consumed-symbol moves and ε moves. `dist/ui/nfa-view.js`, the shared editor, and the shared graph handle these sets. Simulation allows an empty string. Batch input continues to ignore blank lines.

The conversion operation calls `NFA.convertToDFA` and returns a DFA definition usable by the existing DFA tools. Converted machines share the workspace limit of 144 states. Worker timeouts terminate the busy worker so subsequent requests can start a fresh one.
