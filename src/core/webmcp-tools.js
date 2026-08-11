// WebMCP tool definitions for the patcher: names, descriptions, input schemas
// and annotations only. The execute functions — which touch the DOM through
// window.__patch / window.__cdpHost — are attached in webmcp.js, keeping this
// module importable from Node so scripts/validate-webmcp-tools.mjs can check
// every definition against the budgets below without a browser.
//
// Budgets follow the WebMCP authoring guidance: short names, descriptions that
// say what the tool does AND when to reach for it, and compact line-oriented
// output (an agent pays for every token it reads back).

export const NAME_MAX = 30;          // tool name length
export const DESC_MAX = 500;         // tool description length
export const PARAM_DESC_MAX = 150;   // per-parameter description length
export const OUTPUT_SOFT_MAX = 1500; // soft cap for a tool's text output

// The MCP-shaped result wrapper every execute returns (bridge-compatible).
export const text = (s) => ({ content: [{ type: 'text', text: s }] });

const READ = { readOnlyHint: true };
// Read tools whose output embeds user data (patch/node/file names) carry
// untrustedContentHint so an agent treats that text as data, not instructions.
const READ_UNTRUSTED = { readOnlyHint: true, untrustedContentHint: true };

const nodeId = (what) => ({ type: 'string', description: `Node id ${what} (e.g. 'n3', from get_patch)` });

export const TOOL_DEFS = [
  {
    name: 'get_patch',
    title: 'Get current patch',
    description: 'Read the patch on the cdp-web canvas: name, tempo, every node with its parameter values, and the cables between them. Call this first to see what you and the user are looking at, and again after changes you did not make yourself. detail:\'full\' returns the raw cdp-web-patch JSON document (large) — only for saving or load_patch.',
    inputSchema: {
      type: 'object',
      properties: {
        detail: { type: 'string', enum: ['summary', 'full'], description: "'summary' (default) is a compact overview; 'full' is the raw patch JSON" },
      },
    },
    annotations: READ_UNTRUSTED,
  },
  {
    name: 'describe_node',
    title: 'Describe one node',
    description: 'Inspect one node of the current patch by id: each parameter\'s current value, default and allowed range or choices, whether an envelope or cable drives it, plus the node\'s ports and connections. Use before set_params or connect to get exact parameter and port names.',
    inputSchema: {
      type: 'object',
      properties: { id: nodeId('to describe') },
      required: ['id'],
    },
    annotations: READ_UNTRUSTED,
  },
  {
    name: 'search_effects',
    title: 'Search the effect catalog',
    description: 'Search the catalog of ~250 CDP effects and sound generators by keyword over names, descriptions and categories. Returns ids for add_node and describe_effect. Use when choosing how to realise a sound-design idea; an empty query with a category browses that category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Keywords, e.g. 'stretch grain' — all must match" },
        category: { type: 'string', description: "Restrict to one category, e.g. 'Spectral'" },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
    annotations: READ,
  },
  {
    name: 'describe_effect',
    title: 'Describe a catalog effect',
    description: 'Full specification of one catalog effect or generator id: what it does, every parameter with range/choices/default, whether it can take an envelope, and any free-text data it accepts. Use before add_node or before set_params on a node of that type.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: "Effect or generator id from search_effects, e.g. 'blur.blur' or 'wave'" } },
      required: ['id'],
    },
    annotations: READ,
  },
  {
    name: 'list_sounds',
    title: 'List available audio',
    description: 'List the audio set_source can load: the bundled demo sounds and the WAV files in the app\'s local audio store (with their keys). Use before set_source when you do not already know what to load.',
    inputSchema: { type: 'object', properties: {} },
    annotations: READ_UNTRUSTED,
  },
  {
    name: 'load_patch',
    title: 'Load or reset the whole patch',
    description: 'Replace the whole patch with a cdp-web-patch v1 JSON document (as returned by get_patch detail:\'full\'), or start a fresh default patch when called without one. This discards the current canvas (the user can Edit ▸ Undo) — prefer add_node/connect/set_params for incremental edits. Returns the new patch summary.',
    inputSchema: {
      type: 'object',
      properties: {
        patch: { type: 'string', description: 'cdp-web-patch v1 document as a JSON string; omit to reset to the default Source → Output patch' },
      },
    },
  },
  {
    name: 'add_node',
    title: 'Add a node',
    description: "Add one node to the patch: type 'transform' with an effectId or 'generator' with a genId (ids from search_effects), or a plain 'source', 'output', 'pvocAnalyse', 'pvocResynth', 'pick' or 'gather'. The node appears on the canvas unconnected — cable it with connect. Returns the new node's id, ports and parameters.",
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['transform', 'generator', 'source', 'output', 'pvocAnalyse', 'pvocResynth', 'pick', 'gather'], description: 'Kind of node to add' },
        effectId: { type: 'string', description: "Catalog effect id (type 'transform' only)" },
        genId: { type: 'string', description: "Catalog generator id (type 'generator' only)" },
      },
      required: ['type'],
    },
  },
  {
    name: 'connect',
    title: 'Cable two nodes',
    description: "Cable from_node's output into to_node's input. Ports default to the out port and the first compatible input, so the two node ids usually suffice; name ports for multi-input nodes or 'param:<name>' envelope inputs. A failure explains why and how to fix a domain mismatch (e.g. insert a PVOC Analyse node).",
    inputSchema: {
      type: 'object',
      properties: {
        from_node: nodeId('whose output to take'),
        from_port: { type: 'string', description: "Output port name (default: the node's out port)" },
        to_node: nodeId('to feed into'),
        to_port: { type: 'string', description: "Input port name, e.g. 'in', 'in2', 'bank', 'param:freq' (default: first compatible input)" },
      },
      required: ['from_node', 'to_node'],
    },
  },
  {
    name: 'disconnect',
    title: 'Remove a cable',
    description: 'Remove the cable between two nodes, optionally narrowed by port names when several cables join them. An error lists the cables that do exist.',
    inputSchema: {
      type: 'object',
      properties: {
        from_node: nodeId('at the cable\'s source end'),
        from_port: { type: 'string', description: 'Output port name (optional)' },
        to_node: nodeId('at the cable\'s destination end'),
        to_port: { type: 'string', description: 'Input port name (optional)' },
      },
      required: ['from_node', 'to_node'],
    },
  },
  {
    name: 'delete_node',
    title: 'Delete a node',
    description: 'Delete one node and its cables from the patch. The user can Edit ▸ Undo. The last Output node cannot be deleted.',
    inputSchema: {
      type: 'object',
      properties: { id: nodeId('to delete') },
      required: ['id'],
    },
  },
  {
    name: 'set_params',
    title: 'Set node parameters',
    description: "Set one or more parameter values on one node — the main editing tool. Values are applied through the node's own controls, so out-of-range values are clamped and the response reports what was actually applied. Optional data sets the node's free-text data (chord notes, click times…). Fails with the valid names if a parameter does not exist, or if an envelope or cable is driving it.",
    inputSchema: {
      type: 'object',
      properties: {
        id: nodeId('to edit'),
        params: {
          type: 'object',
          description: 'Map of parameter name → value; numbers for sliders, the choice value for discrete params',
          additionalProperties: { type: ['number', 'string'] },
        },
        data: { type: 'string', description: "Free-text data for nodes that take it (e.g. a Chord generator's notes)" },
      },
      required: ['id'],
    },
  },
  {
    name: 'set_source',
    title: 'Load audio into a Source',
    description: "Load audio into a Source node: a demo sound name from list_sounds (e.g. 'marimba'), a stored WAV key, or a WAV file URL to fetch (its server must allow CORS). Targets the first empty Source node unless node names one. Returns the loaded audio's duration, channels and sample rate.",
    inputSchema: {
      type: 'object',
      properties: {
        sound: { type: 'string', description: 'Demo sound name, stored WAV key, or WAV URL' },
        node: { type: 'string', description: 'Source node id to load into (default: first empty Source)' },
      },
      required: ['sound'],
    },
  },
  {
    name: 'render',
    title: 'Render the patch',
    description: "Run the patch through its Output node and report the rendered result's duration, channels and sample rate (never the audio bytes — the sound lives in the app). Set play:true to also start playback so the user hears it too. Waits for the CDP engine if it is still loading; fails if nothing feeds the Output node.",
    inputSchema: {
      type: 'object',
      properties: {
        play: { type: 'boolean', description: 'Start playback of the result in the app (default false)' },
      },
    },
  },
  {
    name: 'undo',
    title: 'Undo / redo',
    description: 'Step the patch edit history: undo the most recent change, or redo one with redo:true. Returns the new patch summary and history position. Use after an edit that made things worse, or when the user asks to go back.',
    inputSchema: {
      type: 'object',
      properties: {
        redo: { type: 'boolean', description: 'Redo instead of undo (default false)' },
      },
    },
  },
];
