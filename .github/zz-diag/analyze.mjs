// Diagnostic only (branch diag/webkit-internal-error, never merged): reads Playwright's JSON report and every failure's
// trace, and counts WebKit «internal error» navigation failures apart from every other failure. Nothing is retried.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [report, label] = process.argv.slice(2);
const r = JSON.parse(readFileSync(report, 'utf8'));
const out = { label, total: 0, passed: 0, skipped: 0, failed: 0, internalError: 0, otherFailures: [], internalErrorTests: [], durationMs: r.stats?.duration ?? null };
function walk(s) {
  for (const sp of s.specs || []) for (const t of sp.tests || []) for (const res of t.results || []) {
    out.total++;
    if (res.status === 'passed') { out.passed++; continue; }
    if (res.status === 'skipped') { out.skipped++; continue; }
    out.failed++;
    const trace = (res.attachments || []).find((a) => a.name === 'trace' && a.path);
    let ie = false;
    if (trace) { try { ie = /internal error/.test(execFileSync('unzip', ['-p', trace.path], { maxBuffer: 1 << 28 }).toString('latin1')); } catch {} }
    const name = `${sp.file} › ${sp.title}`;
    const msg = (res.errors || []).map((e) => (e.message || '').split('\n')[0]).join(' | ').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 160);
    if (ie) { out.internalError++; out.internalErrorTests.push(name); } else out.otherFailures.push(`${name} :: ${msg}`);
  }
  for (const c of s.suites || []) walk(c);
}
for (const s of r.suites || []) walk(s);
writeFileSync(`summary-${label}.json`, JSON.stringify(out, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + JSON.stringify(out, null, 1) + '\n```\n');
console.log(JSON.stringify(out));
