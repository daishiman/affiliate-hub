#!/usr/bin/env python3
"""guard-confirmed-chapter-overwrite hook の回帰テスト。

## テスト戦略

hook の判定精度を 3 つの観点で固定する:

1. **MUST_BLOCK (保護の担保)**: 確定物 (正本 spec-state.json / 確定章) への監査経路を
   経ない直接書換は、経路 (redirect / mutation / python / 動的 / 変数) を問わず遮断する。
   これを緩めると確定仕様が無断で書き換わるため、回帰の最重要ガード。
2. **MUST_PASS (過剰遮断の是正)**: 確定物に書き込まない操作 — 保護領域の read、記録・生成物
   (fetched-references.json / index.md / completeness-*) への正規書込、draft/新規章の編集、
   `2>/dev/null` を伴う read、リダイレクト先が具体的で安全な glob read、
   spec-state を --spec/--matrix で read しつつ別 segment で mutation する compile/validator、
   cp の source が確定物のケース — は通す。
   write-target モデル (references/hook-guard-protection-scope.md §2.2) が是正した過剰遮断の回帰ガード。
3. **KNOWN_GAP (既知の保護漏れ・現状固定)**: hook は「二重化補助」であり表層文字列判定ゆえ
   変数分割・引数経由 writer ですり抜ける (docstring 自認)。これらを「現状 pass」として固定し、
   意図せず挙動が変わった (= 偶然塞がった/更に緩んだ) 場合に検知する。塞ぐのは別 issue。

判定は実 root に依存しないよう、tempfile で確定/draft/index/記録を持つ fixture root を組み、
`bash_decision(cmd, root)` と `decide(payload, root)` を直接呼ぶ。

実行: python3 -m unittest discover plugins/system-spec-harness/hooks/tests
"""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

_HOOK_PATH = Path(__file__).resolve().parents[1] / "guard-confirmed-chapter-overwrite.py"
_spec = importlib.util.spec_from_file_location("guard_hook", _HOOK_PATH)
guard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(guard)


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class GuardTestBase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        spec_dir = self.root / "system-spec"
        # 正本 spec-state: security.web=確定 / security.mobile=対象外 (両終端) + draft 用 未収集
        _write(
            spec_dir / "spec-state.json",
            json.dumps(
                {
                    "schema_version": "1.0",
                    "requirements_foundation": {"confirmed": True, "approval_ref": "appr-1"},
                    "matrix": {
                        "security": {
                            "web": {"state": "確定", "qa_ref": "qa-1"},
                            "mobile": {"state": "対象外", "reason": "native なし"},
                        },
                        "frontend": {"web": {"state": "未収集"}},
                    },
                },
                ensure_ascii=False,
            ),
        )
        # 憲法章 (要件定義書・spec_cells 無・category=requirements-definition)。foundation confirmed → protected
        _write(
            spec_dir / "00-requirements-definition.md",
            "---\nstatus: confirmed\ncategory: requirements-definition\n---\n\n# 要件定義書 (上位概念)\n",
        )
        # 詳細正本 (docs/ 直下の *-spec.md)。手動維持・非再生成 → Bash 書込から保護 / Edit は許可
        _write(self.root / "docs" / "security-spec.md", "# security detail spec\n")
        _write(self.root / "docs" / "screen-inventory.md", "# overview (not a -spec file)\n")
        _write(self.root / "docs" / "features" / "feat-x" / "requirements-baseline.md", "# baseline\n")
        # 確定章 (全対応セル終端・非再オープン → protected)
        _write(
            spec_dir / "security.md",
            "---\nstatus: confirmed\ncategory: security\n"
            "spec_cells: [security.web, security.mobile]\n---\n\n# security\n",
        )
        # draft 章 (status:draft → pass)
        _write(spec_dir / "draft.md", "---\nstatus: draft\ncategory: frontend\n---\n\n# draft\n")
        # index (生成物・status 無し)
        _write(spec_dir / "index.md", "---\nkind: index\n---\n\n# index\n")
        # 記録 (取得ログ)
        _write(spec_dir / "fetched-references.json", json.dumps({"references": []}))

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def bash(self, cmd: str) -> int:
        return guard.bash_decision(cmd, self.root)[0]

    def write_tool(self, file_path: str) -> int:
        return guard.decide({"tool_name": "Write", "tool_input": {"file_path": file_path}}, self.root)[0]

    def edit_tool(self, file_path: str) -> int:
        return guard.decide({"tool_name": "Edit", "tool_input": {"file_path": file_path}}, self.root)[0]

    def multiedit_tool(self, file_path: str) -> int:
        return guard.decide({"tool_name": "MultiEdit", "tool_input": {"file_path": file_path}}, self.root)[0]

    def abspath(self, rel: str) -> str:
        return str(self.root / rel)


class TestMustBlock(GuardTestBase):
    """確定物への監査経路を経ない書換は遮断する (保護の担保・回帰の要)。"""

    def test_redirect_to_spec_state(self):
        self.assertEqual(self.bash("echo x > system-spec/spec-state.json"), 2)

    def test_append_redirect_to_spec_state(self):
        self.assertEqual(self.bash("echo x >> system-spec/spec-state.json"), 2)

    def test_cp_to_spec_state(self):
        self.assertEqual(self.bash("cp /tmp/a system-spec/spec-state.json"), 2)

    def test_tee_to_spec_state(self):
        self.assertEqual(self.bash("echo x | tee system-spec/spec-state.json"), 2)

    def test_sed_inplace_spec_state(self):
        self.assertEqual(self.bash("sed -i 's/a/b/' system-spec/spec-state.json"), 2)

    def test_python_write_spec_state(self):
        self.assertEqual(self.bash("python3 -c \"open('system-spec/spec-state.json','w').write('x')\""), 2)

    def test_variable_redirect_to_spec_state(self):
        # 変数に正本パスのリテラルが残り、リダイレクト先が動的 → branch4 で遮断
        self.assertEqual(self.bash("F=system-spec/spec-state.json; echo x > $F"), 2)

    def test_redirect_to_confirmed_chapter(self):
        self.assertEqual(self.bash("echo x > system-spec/security.md"), 2)

    def test_cp_to_confirmed_chapter(self):
        self.assertEqual(self.bash("cp /tmp/a system-spec/security.md"), 2)

    def test_sed_inplace_confirmed_chapter(self):
        self.assertEqual(self.bash("sed -i 's/a/b/' system-spec/security.md"), 2)

    def test_glob_mutation_to_confirmed_area(self):
        # system-spec/*.md は列挙不能 glob = 確定物扱い + mutation + 動的 → 遮断
        self.assertEqual(self.bash("cp /tmp/a system-spec/*.md"), 2)

    def test_sed_glob_confirmed_area(self):
        self.assertEqual(self.bash("sed -i 's/a/b/' system-spec/*.md"), 2)

    def test_variable_resolved_redirect_to_spec_state(self):
        # 変数に正本パスを代入し $F を書込先にする → 一段解決して遮断 (a5w.1)
        self.assertEqual(self.bash("F=system-spec/spec-state.json; echo x > $F"), 2)

    def test_variable_resolved_cp_to_confirmed_chapter(self):
        # cp の宛先が変数解決で確定章になる → 遮断
        self.assertEqual(self.bash("D=system-spec/security.md; cp /tmp/a $D"), 2)

    def test_variable_split_resolved_now_blocked(self):
        # 旧 KnownGap: 変数分割回避。変数解決で system-spec/spec-state.json に還元され遮断 (FN 解消)
        self.assertEqual(self.bash("P=sys; Q=tem-spec; echo x > $P$Q/spec-state.json"), 2)

    def test_curly_var_resolved_tee_to_spec_state(self):
        self.assertEqual(self.bash("F=system-spec/spec-state.json; echo x | tee ${F}"), 2)

    def test_write_tool_spec_state(self):
        self.assertEqual(self.write_tool(self.abspath("system-spec/spec-state.json")), 2)

    def test_edit_tool_confirmed_chapter(self):
        self.assertEqual(self.edit_tool(self.abspath("system-spec/security.md")), 2)

    # ── a5w.2: MultiEdit を matcher/decide に追加 ──
    def test_multiedit_confirmed_chapter(self):
        # 従来 KnownGap: MultiEdit は decide 未処理で素通りしていた。確定章への MultiEdit を遮断。
        self.assertEqual(self.multiedit_tool(self.abspath("system-spec/security.md")), 2)

    def test_multiedit_spec_state(self):
        self.assertEqual(self.multiedit_tool(self.abspath("system-spec/spec-state.json")), 2)

    # ── a5w.2: 憲法章 (要件定義書) 保護。foundation confirmed → 保護 ──
    def test_write_tool_constitution_chapter(self):
        self.assertEqual(self.write_tool(self.abspath("system-spec/00-requirements-definition.md")), 2)

    def test_edit_tool_constitution_chapter(self):
        self.assertEqual(self.edit_tool(self.abspath("system-spec/00-requirements-definition.md")), 2)

    def test_multiedit_constitution_chapter(self):
        self.assertEqual(self.multiedit_tool(self.abspath("system-spec/00-requirements-definition.md")), 2)

    def test_redirect_to_constitution_chapter(self):
        self.assertEqual(self.bash("echo x > system-spec/00-requirements-definition.md"), 2)

    # ── a5w.1 残: docs/*-spec.md 詳細正本を Bash 書込 (clobber/sweep) から保護 ──
    def test_redirect_to_docs_detail_spec(self):
        self.assertEqual(self.bash("echo x > docs/security-spec.md"), 2)

    def test_sed_inplace_docs_detail_spec(self):
        self.assertEqual(self.bash("sed -i 's/a/b/' docs/security-spec.md"), 2)

    def test_cp_to_docs_detail_spec(self):
        self.assertEqual(self.bash("cp /tmp/a docs/security-spec.md"), 2)

    def test_glob_sweep_docs_dir(self):
        # docs/ 直下を sweep する glob は *-spec.md を巻き込みうる → 安全側で遮断
        self.assertEqual(self.bash("rm -f docs/*.md"), 2)

    def test_cp_glob_docs_spec(self):
        self.assertEqual(self.bash("cp /tmp/a docs/*-spec.md"), 2)


class TestMustPass(GuardTestBase):
    """確定物に書き込まない操作は通す (過剰遮断の是正・MVP の回帰ガード)。"""

    def test_read_spec_state(self):
        self.assertEqual(self.bash("jq . system-spec/spec-state.json"), 0)

    def test_find_with_devnull(self):
        self.assertEqual(self.bash("find system-spec -name '*.md' 2>/dev/null"), 0)

    def test_wc_glob_read_to_tmp(self):
        self.assertEqual(self.bash("wc -l system-spec/*.md > /tmp/x"), 0)

    def test_grep_glob_read_to_tmp(self):
        self.assertEqual(self.bash("grep -l confirmed system-spec/*.md > /tmp/x"), 0)

    def test_read_then_echo_exit(self):
        # `; echo $?` の $ が動的指標だが read のみ → 通す
        self.assertEqual(self.bash("jq . system-spec/spec-state.json; echo $?"), 0)

    def test_fetched_references_cp(self):
        self.assertEqual(self.bash("cp /tmp/a system-spec/fetched-references.json"), 0)

    def test_fetched_references_cp_variable(self):
        # このセッションで頻出: scratchpad から記録を更新。$SCRATCH の $ で誤爆していた
        self.assertEqual(self.bash("cp $SCRATCH/x.json system-spec/fetched-references.json"), 0)

    def test_fetched_references_redirect(self):
        self.assertEqual(self.bash("echo x > system-spec/fetched-references.json"), 0)

    def test_build_fetched_references_out(self):
        # 正規 writer の --out 呼び出し ($ を含む) が通る
        self.assertEqual(
            self.bash("python3 build-fetched-references.py assemble --out system-spec/fetched-references.json"),
            0,
        )

    def test_index_md_write(self):
        self.assertEqual(self.bash("echo x > system-spec/index.md"), 0)

    def test_completeness_report_write(self):
        self.assertEqual(self.bash("cp $X system-spec/completeness-report.json"), 0)

    def test_draft_chapter_sed(self):
        self.assertEqual(self.bash("sed -i 's/a/b/' system-spec/draft.md"), 0)

    def test_draft_chapter_cp(self):
        self.assertEqual(self.bash("cp /tmp/a system-spec/draft.md"), 0)

    def test_new_chapter_cp(self):
        # 不在の具体 .md = 新規 draft 作成 → 通す
        self.assertEqual(self.bash("cp /tmp/a system-spec/newchap.md"), 0)

    def test_read_only_cat(self):
        self.assertEqual(self.bash("cat system-spec/security.md"), 0)

    def test_self_plugin_path_not_triggered(self):
        # system-spec-harness/ は保護領域 system-spec/ の部分文字列だが発火しない
        self.assertEqual(self.bash("cat plugins/system-spec-harness/hooks/x.py > /tmp/y"), 0)

    def test_write_tool_non_system_spec(self):
        self.assertEqual(self.write_tool("/tmp/x.md"), 0)

    def test_write_tool_draft_chapter(self):
        self.assertEqual(self.write_tool(self.abspath("system-spec/draft.md")), 0)

    def test_write_tool_index(self):
        self.assertEqual(self.write_tool(self.abspath("system-spec/index.md")), 0)

    def test_write_tool_fetched_references(self):
        self.assertEqual(self.write_tool(self.abspath("system-spec/fetched-references.json")), 0)

    # ── a5w.1: 参照↔書込 conflation 解消で通るようになった FP 群 (回帰ガード) ──
    def test_compound_rm_scratch_then_compile_reads_specstate(self):
        # このセッションで頻発した誤爆: scratch を rm しつつ spec-state を --spec で read する compile。
        # spec-state は read arg、rm の対象は scratch → 通す。
        self.assertEqual(
            self.bash("rm -rf /tmp/scratch && python3 compile.py "
                      "--spec system-spec/spec-state.json --out-dir /tmp/scratch"), 0)

    def test_var_scratch_mutation_with_specstate_read_arg(self):
        # 変数 scratch を rm/out-dir にしつつ spec-state を read。$SCRATCH は保護領域外へ解決 → 通す。
        self.assertEqual(
            self.bash("SCRATCH=/tmp/x; rm -rf $SCRATCH; python3 c.py "
                      "--spec system-spec/spec-state.json --out-dir $SCRATCH"), 0)

    def test_cp_specstate_as_source(self):
        # cp の source が spec-state (読取)・宛先は /tmp → 通す (旧 hook は refs+mutation で誤爆)
        self.assertEqual(self.bash("cp system-spec/spec-state.json /tmp/backup.json"), 0)

    def test_cp_confirmed_chapter_as_source(self):
        # 確定章を source に read して /tmp へ複製 → 通す
        self.assertEqual(self.bash("cp system-spec/security.md /tmp/security.bak"), 0)

    def test_validator_reads_specstate_after_prior_mutation(self):
        # 別 segment の mutation (rm) と、spec-state を read する validator の共起 → 通す
        self.assertEqual(
            self.bash("rm /tmp/old && python3 validate-coverage-matrix.py "
                      "--matrix system-spec/spec-state.json --require-complete"), 0)

    def test_env_prefix_compile_reads_specstate(self):
        # env -i で out-dir を渡し spec-state を --spec read。protected 書込先なし → 通す。
        self.assertEqual(
            self.bash("env -i OUTD=/tmp/o python3 c.py "
                      "--spec system-spec/spec-state.json --out-dir /tmp/o"), 0)

    def test_constitution_chapter_passes_when_foundation_draft(self):
        # a5w.2: foundation が未確定 (draft) なら憲法章は保護しない (誤爆回避優先)
        _write(
            self.root / "system-spec" / "spec-state.json",
            json.dumps(
                {
                    "schema_version": "1.0",
                    "requirements_foundation": {"confirmed": False},
                    "matrix": {"security": {"web": {"state": "確定", "qa_ref": "qa-1"}}},
                },
                ensure_ascii=False,
            ),
        )
        self.assertEqual(self.write_tool(self.abspath("system-spec/00-requirements-definition.md")), 0)

    # ── a5w.1 残: docs/*-spec.md は Edit/Write ツール authoring と read を阻害しない ──
    def test_edit_tool_docs_detail_spec_allowed(self):
        # 意図的 authoring (Edit ツール) は許可 (Bash 書込のみ遮断)
        self.assertEqual(self.edit_tool(self.abspath("docs/security-spec.md")), 0)

    def test_write_tool_docs_detail_spec_allowed(self):
        self.assertEqual(self.write_tool(self.abspath("docs/security-spec.md")), 0)

    def test_read_docs_detail_spec(self):
        self.assertEqual(self.bash("cat docs/security-spec.md"), 0)

    def test_cp_docs_detail_spec_as_source(self):
        # 詳細正本を source に読んで /tmp へ複製 → 通す
        self.assertEqual(self.bash("cp docs/security-spec.md /tmp/sec.bak"), 0)

    def test_redirect_to_docs_non_spec(self):
        # docs/ 直下でも -spec.md でない overview 文書は保護対象外
        self.assertEqual(self.bash("echo x > docs/screen-inventory.md"), 0)

    def test_redirect_to_docs_subdir(self):
        # docs/features/... は直下でない → 保護対象外 (feature 成果物の書込を妨げない)
        self.assertEqual(self.bash("echo x > docs/features/feat-x/requirements-baseline.md"), 0)

    def test_redirect_to_new_docs_spec_allowed(self):
        # 不在の docs/*-spec.md への Bash 書込 = 新規作成 → 妨げない (確定章と一貫)
        self.assertEqual(self.bash("echo x > docs/newthing-spec.md"), 0)


class TestKnownGaps(GuardTestBase):
    """既知の保護漏れ (FN)。hook は二重化補助ゆえ表層回避を許す。現状 pass を固定し挙動変化を検知。

    注: 従来 KnownGap だった変数分割回避 (`P=sys; Q=tem-spec; echo x > $P$Q/...`) は
    a5w.1 の変数解決導入で解消し、TestMustBlock::test_variable_split_resolved_now_blocked へ昇格した。
    """

    def test_nested_shell_var_mutation_evasion_currently_passes(self):
        # `env -i F=<spec-state> sh -c 'cp x $F'`: mutation が sh -c の引用文字列内にあり、
        # segment 先頭 tool 検出が wrapper/option に阻まれて cp の宛先 $F を抽出できない。
        # 二重化補助ゆえ許容 (表層回避)。現実の偶発上書き経路ではない。塞ぐのは follow-up。
        self.assertEqual(
            self.bash("env -i F=system-spec/spec-state.json sh -c 'cp x $F'"), 0)

    def test_arg_based_writer_currently_passes(self):
        # --out で自前 open するラッパーは書込指標 (>/mutation/py open) を持たず素通り (Class2 FN)
        self.assertEqual(self.bash("python3 apply-spec-transition.py --out system-spec/spec-state.json"), 0)


class TestProtectionRegistry(GuardTestBase):
    """明示レジストリ (_PROTECTION_RULES / _match_protection) の契約を直接固定する (提案1)。"""

    def _match(self, rel, bash):
        return guard._match_protection(self.abspath(rel), self.root, bash=bash)

    def test_spec_state_rule_id(self):
        hit = self._match("system-spec/spec-state.json", True)
        self.assertIsNotNone(hit)
        self.assertEqual(hit[0], "canonical-spec-state")

    def test_confirmed_chapter_rule_id(self):
        hit = self._match("system-spec/security.md", True)
        self.assertEqual(hit[0], "confirmed-or-constitution-chapter")

    def test_constitution_via_chapter_rule(self):
        hit = self._match("system-spec/00-requirements-definition.md", True)
        self.assertEqual(hit[0], "confirmed-or-constitution-chapter")

    def test_docs_detail_rule_id_bash(self):
        hit = self._match("docs/security-spec.md", True)
        self.assertEqual(hit[0], "docs-detail-spec")

    def test_docs_detail_scope_is_bash_only(self):
        # scope="bash" ゆえ Write/Edit/MultiEdit 経路 (bash=False) では適用されない (authoring 許可)
        self.assertIsNone(self._match("docs/security-spec.md", False))

    def test_spec_state_applies_both_scopes(self):
        # scope="all" は bash=False でも適用される
        self.assertIsNotNone(self._match("system-spec/spec-state.json", False))

    def test_exempt_not_matched(self):
        self.assertIsNone(self._match("system-spec/fetched-references.json", True))

    def test_non_protected_not_matched(self):
        self.assertIsNone(self._match("docs/screen-inventory.md", True))
        self.assertIsNone(self._match("/tmp/whatever.md", True))


if __name__ == "__main__":
    unittest.main(verbosity=2)
