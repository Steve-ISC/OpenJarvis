#!/usr/bin/env bash
# smoke_framework_comparison.sh
#
# One-task-per-cell sanity check for the framework-comparison harness.
# Run before kicking off a benchmark sweep.
#
# Required env vars:
#   HERMES_AGENT_PATH   - path to pinned hermes-agent checkout
#   OPENCLAW_PATH       - path to pinned openclaw checkout
#   JARVIS_MOCK_LLM_URL - OpenAI-compatible endpoint (Ollama or vLLM)
#
# Optional:
#   JARVIS_ALLOW_COMMIT_DRIFT=1  - bypass commit-pin enforcement
#   SMOKE_CONFIG_DIR             - generated config dir (default: results/comparison/configs)
#   SMOKE_OUTPUT_BASE            - smoke result dir (default: results/comparison/smoke)
#   SMOKE_MODEL                  - model slug to smoke (default: qwen-9b)
#   OPENJARVIS_BASELINE_CONFIG   - baseline OpenJarvis config for openjarvis cells
#   OPENJARVIS_DISTILLED_CONFIG  - distilled OpenJarvis config for openjarvis-distilled cells

set -euo pipefail

: "${HERMES_AGENT_PATH:?must be set}"
: "${OPENCLAW_PATH:?must be set}"
: "${JARVIS_MOCK_LLM_URL:?must be set (e.g. http://localhost:11434/v1)}"

# OpenClaw prerequisites: Node version + dist/ dir
NODE_VERSION=$(node --version 2>&1 || echo "v0")
NODE_MAJOR=$(echo "$NODE_VERSION" | sed -E 's/v([0-9]+)\..*/\1/')
if [ "$NODE_MAJOR" -lt 14 ]; then
  echo "WARNING: Node $NODE_VERSION may be too old for OpenClaw (needs ≥14.8)"
  echo "         OpenClaw runs may fail with 'SyntaxError: Unexpected reserved word'"
fi
if [ ! -f "$OPENCLAW_PATH/dist/entry.js" ]; then
  echo "WARNING: $OPENCLAW_PATH/dist/entry.js not found"
  echo "         OpenClaw needs 'pnpm install && pnpm build' before use"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SMOKE_CONFIG_DIR="${SMOKE_CONFIG_DIR:-results/comparison/configs}"
SMOKE_OUTPUT_BASE="${SMOKE_OUTPUT_BASE:-results/comparison/smoke}"
SMOKE_MODEL="${SMOKE_MODEL:-qwen-9b}"
OPENJARVIS_BASELINE_CONFIG="${OPENJARVIS_BASELINE_CONFIG:-${OPENJARVIS_CONFIG:-configs/openjarvis/config.toml}}"

echo "==> Verifying commit pins"
uv run python -c "
from openjarvis.evals.comparison.third_party import (
    load_third_party_config, verify_commit_pin,
)
cfg = load_third_party_config()
for name, entry in cfg.entries.items():
    print(f'  {name}: {entry.path}')
    verify_commit_pin(entry)
print('  all pins OK')
"

echo "==> Verifying model endpoint"
curl -sf "${JARVIS_MOCK_LLM_URL%/}/models" >/dev/null
echo "  endpoint OK: ${JARVIS_MOCK_LLM_URL%/}/models"

if [ ! -d "$SMOKE_CONFIG_DIR" ] || ! compgen -G "$SMOKE_CONFIG_DIR/*-${SMOKE_MODEL}.toml" >/dev/null; then
  echo "==> Materializing generated configs into $SMOKE_CONFIG_DIR"
  uv run python -m openjarvis.evals.comparison.make_configs \
    --all-tier1 \
    --output-dir "$SMOKE_CONFIG_DIR"
fi

echo "==> Running one-task smoke per (framework, benchmark)"
mkdir -p "$SMOKE_OUTPUT_BASE"
SMOKE_BENCHES=(toolcall15 pinchbench gaia)
SMOKE_FRAMEWORKS=(openjarvis openjarvis-distilled hermes openclaw)

run_cell() {
  local fwk="$1"
  local bench="$2"
  local config="$SMOKE_CONFIG_DIR/${bench}-${fwk}-${SMOKE_MODEL}.toml"
  local output_dir="$SMOKE_OUTPUT_BASE/${fwk}/${SMOKE_MODEL}/${bench}/"

  if [ ! -f "$config" ]; then
    echo "  ! missing config: $config"
    return 0
  fi

  echo "  - $fwk x $bench"
  case "$fwk" in
    openjarvis)
      OPENJARVIS_CONFIG="$OPENJARVIS_BASELINE_CONFIG" \
        uv run python -m openjarvis.evals run --config "$config" --max-samples 1 \
          --output-dir "$output_dir" \
        || echo "    FAILED (continuing)"
      ;;
    openjarvis-distilled)
      if [ -z "${OPENJARVIS_DISTILLED_CONFIG:-}" ]; then
        echo "    SKIPPED (set OPENJARVIS_DISTILLED_CONFIG for distilled smoke cells)"
        return 0
      fi
      OPENJARVIS_CONFIG="$OPENJARVIS_DISTILLED_CONFIG" \
        uv run python -m openjarvis.evals run --config "$config" --max-samples 1 \
          --output-dir "$output_dir" \
        || echo "    FAILED (continuing)"
      ;;
    *)
      uv run python -m openjarvis.evals run --config "$config" --max-samples 1 \
        --output-dir "$output_dir" \
        || echo "    FAILED (continuing)"
      ;;
  esac
}

for fwk in "${SMOKE_FRAMEWORKS[@]}"; do
  for bench in "${SMOKE_BENCHES[@]}"; do
    run_cell "$fwk" "$bench"
  done
done

echo "==> Generating T1 from smoke results"
uv run python -m openjarvis.evals.comparison.table_gen \
    --results-glob "$SMOKE_OUTPUT_BASE/**/summary.json" \
    --tables T1 \
    --output-dir "$SMOKE_OUTPUT_BASE/tables/"

echo "==> Verifying T1.tex non-empty"
test -s "$SMOKE_OUTPUT_BASE/tables/T1.tex" && echo "  OK: T1.tex emitted"

echo "==> Smoke validation complete"
