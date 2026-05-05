"""Tests for openjarvis.evals.comparison.make_configs."""

from __future__ import annotations

from pathlib import Path

import pytest
import tomllib
from click.testing import CliRunner

from openjarvis.evals.comparison.make_configs import (
    BENCHMARKS,  # noqa: F401  (verify export)
    FRAMEWORKS,  # noqa: F401  (verify export)
    MODELS,
    main,
    materialize_config,
)


class TestMaterializeConfig:
    def test_emits_valid_toml(self, tmp_path: Path) -> None:
        out = materialize_config(
            framework="hermes",
            model="qwen-9b",
            benchmark="gaia",
            output_dir=tmp_path,
        )
        assert out.exists()
        with open(out, "rb") as fh:
            data = tomllib.load(fh)
        assert data["meta"]["framework"] == "hermes"
        assert data["benchmarks"][0]["backend"] == "hermes"
        assert data["models"][0]["name"] == MODELS["qwen-9b"]["model_id"]

    def test_filename_convention(self, tmp_path: Path) -> None:
        out = materialize_config(
            framework="hermes",
            model="qwen-9b",
            benchmark="gaia",
            output_dir=tmp_path,
        )
        assert out.name == "gaia-hermes-qwen-9b.toml"

    def test_mid_size_models_available(self, tmp_path: Path) -> None:
        qwen = materialize_config(
            framework="openjarvis",
            model="qwen-27b",
            benchmark="gaia",
            output_dir=tmp_path,
        )
        gemma = materialize_config(
            framework="openjarvis",
            model="gemma-31b",
            benchmark="gaia",
            output_dir=tmp_path,
        )

        with open(qwen, "rb") as fh:
            qwen_data = tomllib.load(fh)
        with open(gemma, "rb") as fh:
            gemma_data = tomllib.load(fh)

        assert qwen.name == "gaia-openjarvis-qwen-27b.toml"
        assert qwen_data["models"][0]["name"] == "Qwen/Qwen3.6-27B"
        assert gemma.name == "gaia-openjarvis-gemma-31b.toml"
        assert gemma_data["models"][0]["name"] == "google/gemma-4-31B-it"

    def test_unknown_framework_rejected(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="unknown framework"):
            materialize_config(
                framework="not-real",
                model="qwen-9b",
                benchmark="gaia",
                output_dir=tmp_path,
            )

    def test_unknown_benchmark_rejected(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="unknown benchmark"):
            materialize_config(
                framework="hermes",
                model="qwen-9b",
                benchmark="not-real",
                output_dir=tmp_path,
            )

    def test_idempotent(self, tmp_path: Path) -> None:
        out1 = materialize_config(
            framework="hermes",
            model="qwen-9b",
            benchmark="gaia",
            output_dir=tmp_path,
        )
        content1 = out1.read_text()
        out2 = materialize_config(
            framework="hermes",
            model="qwen-9b",
            benchmark="gaia",
            output_dir=tmp_path,
        )
        assert out1 == out2
        assert out2.read_text() == content1


class TestTemplateStripping:
    def test_no_substitution_in_comments(self, tmp_path: Path) -> None:
        """Documentation comments must not contain substituted text."""
        out = materialize_config(
            framework="hermes",
            model="qwen-9b",
            benchmark="gaia",
            output_dir=tmp_path,
        )
        text = out.read_text()
        # The substitution variables doc block uses <var> not {{var}};
        # if it leaks through, "<benchmark>" or similar would appear in output
        assert "<benchmark>" not in text
        assert "<framework>" not in text
        assert "{{benchmark}}" not in text  # Must be substituted
        # The output should start with [meta], not with a doc-comment header
        first_non_blank = next(line for line in text.splitlines() if line.strip())
        assert first_non_blank.startswith("[meta]"), (
            f"Expected first line to be [meta], got: {first_non_blank!r}"
        )


class TestCli:
    def test_all_tier1_emits_expanded_model_grid(self, tmp_path: Path) -> None:
        result = CliRunner().invoke(
            main,
            ["--all-tier1", "--output-dir", str(tmp_path)],
        )

        assert result.exit_code == 0, result.output
        assert len(list(tmp_path.glob("*.toml"))) == (
            len(FRAMEWORKS) * len(MODELS) * len(BENCHMARKS)
        )
        assert (tmp_path / "gaia-openjarvis-qwen-27b.toml").exists()
        assert (tmp_path / "gaia-openjarvis-gemma-31b.toml").exists()
