"""Detection and install hints for the upstream Pearl Python packages.

The cpu-pearl provider depends on three upstream packages from the Pearl
research project:

- ``pearl_mining`` (PyO3 binding to the pure-Rust mining algorithm)
- ``pearl_gateway`` (JSON-RPC bridge to ``pearld``)
- ``miner_base`` (PyTorch reference of NoisyGEMM, used for parity validation)

These are not on PyPI as of 2026-05; the implementation plan covers a
build-from-pin fallback in :func:`build_from_pin` (Task 4). This module is
the single source of truth for "is the user's environment ready?" and is
called from :class:`~openjarvis.mining.cpu_pearl.CpuPearlProvider.detect`
plus ``jarvis mine doctor``.
"""
from __future__ import annotations

import importlib.util
import sys


def _module_importable(name: str) -> bool:
    """True if ``import name`` would succeed in the current environment.

    Behavior:
    - If ``name`` is already in ``sys.modules``, return ``True`` (already imported).
    - Otherwise call :func:`importlib.util.find_spec`. If it raises ``ValueError``
      (which happens for partially-initialized packages whose ``__spec__`` is
      None), treat the module as not-importable and return ``False``.
    - Otherwise return ``True`` iff ``find_spec`` returned a non-None spec.

    The ``sys.modules`` check exists so that test stubs created via
    ``types.ModuleType()`` (which lack ``__spec__``) are treated as available
    without crashing on the ``find_spec`` call.
    """
    if name in sys.modules:
        return True
    try:
        return importlib.util.find_spec(name) is not None
    except ValueError:
        return False


def pearl_packages_available() -> bool:
    """All three Pearl Python packages importable.

    Returns ``False`` if any are missing. Use :func:`install_hint` to
    surface the next step to the user.
    """
    return all(
        _module_importable(m)
        for m in ("pearl_mining", "pearl_gateway", "miner_base")
    )


def install_hint() -> str:
    """Human-readable instruction for installing the Pearl packages.

    Today (no PyPI publication) we point at the optional extra. When Pearl
    publishes wheels, the message stays correct because the extra still works.
    """
    return (
        "install with `uv sync --extra mining-pearl-cpu`. "
        "If Pearl wheels are not on PyPI yet, see "
        "tools/pearl-reference-oracle/README.md for the build-from-pin path."
    )
