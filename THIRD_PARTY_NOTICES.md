# Third-party notices

Agentvora integrates Tauric Research's **TradingAgents** multi-agent financial research framework under **Apache License 2.0**. Agentvora did not author TradingAgents. The official upstream source, README attribution, copyright headers and LICENSE are preserved in `vendor/TradingAgents`. Upstream commit and retrieval date appear in `vendor/TRADINGAGENTS_COMMIT.txt`.

Agentvora's integration and adapted bounded analysts live in `apps/api/agentvora/agents.py`; the vendored implementation is not rewritten. Its native provider client, graph state and council factories remain upstream code. There is no nested upstream Git history. Any upstream NOTICE file must be retained on future upgrades; the retrieved revision had no root NOTICE.

The interactive market chart uses an original Agentvora SVG renderer. The former Lightweight Charts dependency is no longer included in the application. Its historical license copy remains archived in `docs/licenses`.

DM Sans and IBM Plex Mono are distributed under the SIL Open Font License. Their notices are retained in `docs/licenses`. Lucide icons, React, Vite, TanStack Query, React Router, Tailwind and the Python dependencies retain their respective licenses in installed distributions. Source manifests and lockfiles identify exact resolved dependencies. Dependencies are not represented as Agentvora-authored code.

The root Apache-2.0 license applies to original Agentvora code. Market data, news and the source recording are not relicensed by this source distribution. The recording and extracted reference imagery are excluded from the downloadable package.
