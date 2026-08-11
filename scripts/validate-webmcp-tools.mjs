// Check the WebMCP tool definitions against the authoring budgets they declare
// (src/core/webmcp-tools.js): legal unique names, descriptions present and
// within budget, schemas serialisable, read tools annotated read-only. Runs in
// Node (the defs module is deliberately DOM-free); wired into `npm test`.
import assert from 'node:assert/strict';
import { TOOL_DEFS, NAME_MAX, DESC_MAX, PARAM_DESC_MAX } from '../src/core/webmcp-tools.js';

const READ_TOOLS = new Set(['get_patch', 'describe_node', 'search_effects', 'describe_effect', 'list_sounds']);

assert.equal(TOOL_DEFS.length, 14, 'expected 14 tools');

const names = new Set();
for (const t of TOOL_DEFS) {
  const where = `tool '${t.name}'`;
  assert.match(t.name, new RegExp(`^[a-zA-Z0-9_.-]{1,${NAME_MAX}}$`), `${where}: illegal name`);
  assert.ok(!names.has(t.name), `${where}: duplicate name`);
  names.add(t.name);

  assert.ok(t.title?.length, `${where}: missing title`);
  assert.ok(t.description?.length, `${where}: missing description`);
  assert.ok(t.description.length <= DESC_MAX, `${where}: description ${t.description.length} > ${DESC_MAX} chars`);

  // Schema must be a plain JSON-serialisable JSON-Schema object.
  assert.equal(t.inputSchema?.type, 'object', `${where}: inputSchema.type must be 'object'`);
  assert.deepEqual(JSON.parse(JSON.stringify(t.inputSchema)), t.inputSchema, `${where}: inputSchema not JSON-serialisable`);
  for (const [pname, prop] of Object.entries(t.inputSchema.properties || {})) {
    assert.ok(prop.description?.length, `${where}: param '${pname}' missing description`);
    assert.ok(prop.description.length <= PARAM_DESC_MAX, `${where}: param '${pname}' description ${prop.description.length} > ${PARAM_DESC_MAX} chars`);
  }
  for (const req of t.inputSchema.required || []) {
    assert.ok(t.inputSchema.properties?.[req], `${where}: required '${req}' not in properties`);
  }

  if (READ_TOOLS.has(t.name)) assert.ok(t.annotations?.readOnlyHint, `${where}: read tool missing readOnlyHint`);
  else assert.ok(!t.annotations?.readOnlyHint, `${where}: mutating tool wrongly marked readOnlyHint`);
}

console.log(`webmcp tools: OK — ${TOOL_DEFS.length} definitions within budgets`);
