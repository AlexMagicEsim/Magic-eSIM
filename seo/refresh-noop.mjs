// ---------------------------------------------------------------------------
// seo/refresh-noop.mjs — should the automation branch be rewritten at all?
//
// WHY THIS EXISTS. The refresh runs on `workflow_run` from the catalogue job,
// and that job COMPLETES six times a day whether or not it commits anything. So
// the refresh rebuilds six times a day, and while a pull request is open it used
// to force-push every single time — with a byte-identical tree. Measured on
// 2026-09-16: PR #3 went 5615090 → 3f5f88b with tree 862913c89707 on both sides,
// after a catalogue run that had nothing to commit.
//
// That is not merely untidy. A force-push dismisses review approvals, so
// «review now, merge later» silently stops meaning anything on this PR; it
// re-registers a tests run that can never execute (GITHUB_TOKEN PRs land in
// action_required); and it buries the one force-push that WOULD matter — a real
// catalogue change — in a stream of identical ones.
//
// WHAT IS DELIBERATELY NOT CHANGED. Everything that decides WHETHER there is a
// change at all, the path allowlist, the foreign-commit guard, the lease, the
// concurrency group. This function runs AFTER all of them and can only ever turn
// «push an identical tree» into «leave it alone». It cannot suppress a real
// change: that would require the staged tree to equal the remote tree, which is
// the definition of there being nothing to say.
//
// FAIL-CLOSED MEANS «PUSH» HERE, and that is the opposite of most of this
// automation. Elsewhere the safe answer is to stop; here stopping is what leaves
// a stale pull request in front of a reviewer. So anything unknown, blank or
// unrecognised falls through to the behaviour that shipped before this file
// existed. Skipping is an optimisation and has to earn itself with two positive
// facts, never with the absence of one.
// ---------------------------------------------------------------------------

/**
 * @param {object} o
 * @param {boolean} o.branchExists   the remote automation branch is there
 * @param {string}  o.stagedTree     tree sha the next commit would carry
 * @param {string}  o.remoteTree     tree sha the remote branch head carries
 * @param {string}  o.remoteBase     merge-base(main, remote branch)
 * @param {string}  o.mainSha        main as this run sees it
 * @returns {{push: boolean, reason: string}}
 */
export function pushDecision({ branchExists, stagedTree, remoteTree, remoteBase, mainSha } = {}) {
  const given = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v.trim());

  if (branchExists !== true) {
    return { push: true, reason: 'ветки ещё нет — её нужно создать' };
  }
  if (!given(stagedTree) || !given(remoteTree) || !given(remoteBase) || !given(mainSha)) {
    // Not «probably fine». One unreadable sha and we do exactly what we did
    // before this check existed.
    return { push: true, reason: 'не удалось прочитать все sha — веду себя как раньше и пушу' };
  }
  if (stagedTree.trim() !== remoteTree.trim()) {
    return { push: true, reason: 'содержимое отличается от того, что на ветке' };
  }
  // Same content, but built on a different main: the pull request would still be
  // showing an older base, and its diff is computed against that base. Rebuild.
  if (remoteBase.trim() !== mainSha.trim()) {
    return { push: true, reason: 'дерево то же, но ветка собрана не от текущего main' };
  }
  return {
    push: false,
    reason: 'на ветке уже ровно это дерево поверх текущего main — переписывать нечего',
  };
}
