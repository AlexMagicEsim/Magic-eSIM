#!/usr/bin/env node
// Thin wiring around seo/refresh-noop.mjs so the workflow asks a tested function
// instead of carrying the rule in shell. Prints one word — `push` or `skip` —
// on the first line and the reason on the second; never exits non-zero for a
// decision, because a non-zero exit in that step means «something broke», and
// «nothing to do» is not a breakage.
import { pushDecision } from '../seo/refresh-noop.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : String(process.argv[i + 1] ?? '');
};

const { push, reason } = pushDecision({
  branchExists: arg('branch-exists') === 'true',
  stagedTree: arg('staged-tree'),
  remoteTree: arg('remote-tree'),
  remoteBase: arg('remote-base'),
  mainSha: arg('main'),
});

process.stdout.write(`${push ? 'push' : 'skip'}\n${reason}\n`);
