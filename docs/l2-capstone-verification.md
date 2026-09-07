# L2 Capstone Verification

## Scope

This report verifies the findings in the August 31, 2026 L2 review against the current repository. It distinguishes implementation verified in this workspace from remaining hardening work. It is not a replacement for an assessor's independent review.

## Verification Performed

On September 3, 2026, the following offline checks ran successfully from `backend`:

```text
python -m pytest tests/test_mcp_policy_loop.py -q
7 passed in 2.55s

python scripts/smoke_l2_agent.py
[OK] wrote docs/l2-agent-trace.md
```

The smoke run discovered 10 tools, rejected an unknown tool and invalid arguments without crashing, selected and called `rank_top_opportunity`, reflected over the observation, and wrote a reproducible transcript to `docs/l2-agent-trace.md`.

## Review Findings Status

| Original finding | Current status | Current evidence |
| --- | --- | --- |
| Fixed workflow was presented as autonomous reasoning | Closed for chat. Batch discovery remains intentionally deterministic. | `backend/app/agents/policy_agent.py` implements a bounded decide, act, observe, finish loop. `backend/app/agents/orchestrator.py` delegates chat to `PolicyAgent`. |
| No MCP or equivalent tool boundary | Closed. | `backend/app/mcp/protocol.py` exposes `MCPToolServer`, `list_tools`, `call_tool`, typed results, and recoverable errors. `backend/app/mcp/tool_server.py` registers the EduPath tools. |
| No runtime tool discovery | Closed. | `PolicyAgent.run()` calls `client.list_tools()` before each loop and provides the discovered schemas to the policy prompt. |
| Keyword routing chose actions | Closed for the primary chat path. | `PolicyAgent._decide()` requests a structured policy decision from `LLMService.complete_json()`; the deterministic fallback is limited to offline recovery when a model response is invalid or unavailable. |
| No tool-call observation loop or recovery | Closed. | The policy loop records `discover_tools`, `decide`, `act_observe`, `recover`, and `reflect` trace phases. `tests/test_mcp_policy_loop.py` tests unknown-tool and missing-argument recovery. |
| No reflection against the final answer | Closed. | `backend/app/agents/reflection_agent.py` checks unsupported URLs, funding amounts, deadlines, failed observations, unsafe claims, and acceptance-probability wording before publishing a reply. |
| No grounded final answer | Closed, with a documented rule-based reflection implementation. | `ReflectionAgent` derives allowable URLs, amounts, and deadlines from observations and revises unsafe drafts. `test_reflection_revises_ungrounded_claims` verifies a correction. |
| Missing offline runnable evidence | Closed in this workspace. | `backend/scripts/smoke_l2_agent.py`, `backend/tests/test_mcp_policy_loop.py`, `docs/l2-agent-trace.md`, and the passing commands above. |
| Backend dependencies unavailable in review environment | Environment issue, resolved locally. | `backend/requirements.txt` lists the required packages; the local virtual environment ran the focused tests and smoke script successfully. |

## Hardening Completed After Verification

The following recommendations were implemented after the initial verification:

1. `backend/app/mcp/fastmcp_server.py` now exposes a testable stdio bridge. `backend/tests/test_l2_hardening.py` verifies tool listing, valid invocation, malformed JSON recovery, and invalid-argument recovery.
2. `backend/app/tools/discovery_tools.py` converts fetched HTML to bounded visible text and removes script, style, template, SVG, and noscript content before it can enter an LLM prompt. `ExtractionAgent` repeats this sanitization at its own boundary, protecting direct callers as well.
3. MCP match and ranking responses now include the persisted `source_verified` and `last_verified_at` provenance fields so the policy and UI can identify unverified or stale source data.
4. The MCP protocol now supports declarative `requiresConfirmation` annotations. `PolicyAgent` stops before invoking any tool that declares this requirement and records a `confirmation_gate` trace event.

## Remaining Work

No original L2 core requirement remains unimplemented. The final two reproducibility recommendations are now addressed:

1. `backend/tests/test_live_provider_contracts.py` provides explicit opt-in contracts for the configured LLM and a trusted live discovery URL. They run only when `RUN_LIVE_PROVIDER_TESTS=true`, so the normal suite remains offline, deterministic, and cost-free.
2. `.github/workflows/backend-tests.yml` creates a clean Python 3.12 environment, installs `backend/requirements.txt`, and runs the complete offline test suite on each push and pull request.

To run the optional live checks locally, set `RUN_LIVE_PROVIDER_TESTS=true` and run `python -m pytest tests/test_live_provider_contracts.py -m live_provider -q` from `backend`. This uses the locally configured `LLM_API_KEY` and makes a real request to a trusted source, so it should only run with deliberate approval.

## Resubmission Evidence

For a resubmission, provide this report together with:

- `docs/architecture.md`, which documents the policy loop and MCP boundary.
- `docs/l2-agent-trace.md`, the generated offline transcript.
- `backend/tests/test_mcp_policy_loop.py`, the focused automated tests.
- `backend/scripts/smoke_l2_agent.py`, the reproducible demonstration script.

The current implementation should be evaluated as an LLM-controlled chat policy loop over a typed MCP-compatible tool boundary. The scheduled batch discovery graph is a separate, deterministic workflow tool and should not be represented as the agentic decision loop.