# Agent roles and integration

Pinned upstream: `e8f5503e9b86d5c2710b0c76b1f686703968c9df`, retrieved 2026-10-17 from the official TauricResearch/TradingAgents repository. The full upstream tree and Apache license are retained, without nested Git history. Read `vendor/TRADINGAGENTS_COMMIT.txt` when upgrading.

The adapter is `apps/api/agentvora/agents.py`. It uses the current upstream AgentState, Propagator, ConditionalLogic, native `create_tier_client`, and unmodified researcher, research manager, trader, risk and portfolio-manager factories. It constructs a compatible LangGraph instead of invoking `TradingAgentsGraph.propagate` so Agentvora controls bounded data context, node events and accounting boundaries. Four analyst nodes are adapted to consume precomputed snapshots without external tool loops. This is an intentional integration change, not an upstream fork silently presented as unchanged behavior.

| Desk | Executed internal role(s) | Evidence |
|---|---|---|
| Market | Market Analyst | Source candles, deterministic trend, momentum and volatility |
| Fundamentals | Fundamentals Analyst | SEC/yfinance company facts; crypto explicitly excludes company statements |
| News | News Analyst | At most six deduplicated recent items, URLs, publication dates |
| Sentiment | Sentiment Analyst | Market positioning evidence; missing social data explicitly identified |
| Research Council | Bull Researcher, Bear Researcher, Research Manager, Trader | Independent reports, opposing cases, synthesis and transaction proposal |
| Risk & Portfolio | Aggressive Analyst, Neutral Analyst, Conservative Analyst, Portfolio Manager | Debate, portfolio context, final explicit conclusion |

Quick and deep tiers both default to `openai/gpt-oss-20b` through native `groq` support. `AGENTVORA_DEEP_MODEL=openai/gpt-oss-120b` is optional, never enabled automatically. Provider names are developer configuration only. Settings map environment variables into the native client. SDK retries and output caps apply; no extra compatibility service is introduced. Confidence is an advisory evidence-quality score, not a calibrated probability of returns.

No private model reasoning, `reasoning_content`, chain-of-thought tokens or raw model message lists are exposed. The event system carries explicit reports and lifecycle states. `<think>` and `<analysis>` blocks are removed from report content. React renders plain text, never raw model HTML. Node failures produce actual error status and no fill. Normal tests mock the model boundary while executing the real upstream council factories and graph routing.

The adapter adds one structured extraction after the final portfolio conclusion. It validates BUY/SELL/HOLD, confidence and allocation with Pydantic, and verifies agreement with the upstream rating. Invalid or ambiguous output fails closed. The deterministic broker remains the final authority.

Live-validation hardening (2026-10-18): two small vendor patches add native `json_schema` capability entries for the two GPT-OSS model IDs and enable strict constrained decoding for that schema path. This follows https://console.groq.com/docs/structured-outputs and avoids unreliable forced-tool responses. Agent factories remain unchanged. The adapter selects low reasoning effort on the native client, imposes 90-second request timeouts, and paces all calls against a shared conservative token budget (`TRADINGAGENTS_TOKENS_PER_MINUTE=7000`, configurable for the account limit). This is scheduling around the native client, not a replacement API layer. Requests exceeding that budget fail closed. Reports are retained in full; downstream context uses declared excerpts with each debate participant represented.

Credential failover: `GROQ_API_KEY` is primary and optional `GROQ_BACKUP_API_KEY` is the backup. A server-only HTTP authentication handler retries the same native-client request once with the backup after HTTP 401/403/429 or temporary HTTP 5xx responses. Successful responses and invalid requests do not trigger failover. Credentials are restricted to api.groq.com. Native model factories and structured output remain in use. Keys in one organization share quota: https://console.groq.com/docs/rate-limits .
