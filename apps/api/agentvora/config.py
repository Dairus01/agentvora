from pathlib import Path
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr, Field

_checkout = Path(__file__).resolve().parents[3]
ROOT = Path(
    os.getenv(
        "AGENTVORA_ROOT",
        str(_checkout if (_checkout / "apps/api").is_dir() else Path.cwd()),
    )
).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    groq_api_key: SecretStr = SecretStr("")
    database_url: str = "sqlite:///./data/agentvora.db"
    autonomous_enabled: bool = True
    autonomous_interval_minutes: int = Field(30, ge=1)
    autonomous_max_concurrent_runs: int = Field(2, ge=1, le=8)
    autonomous_min_confidence: float = Field(0.65, ge=0, le=1)
    autonomous_assets: str = "AAPL,MSFT,NVDA,BTC/USD,ETH/USD,SOL/USD"
    paper_starting_cash: float = Field(100000, gt=0)
    max_position_weight: float = Field(0.20, gt=0, le=1)
    max_invested_weight: float = Field(0.85, gt=0, le=1)
    min_cash_weight: float = Field(0.15, ge=0, le=1)
    max_trades_per_cycle: int = Field(3, ge=1)
    max_daily_loss: float = Field(0.05, gt=0, lt=1)
    transaction_cost_bps: float = Field(5, ge=0)
    slippage_bps: float = Field(2, ge=0)
    bootstrap_analysis: bool = False
    sec_edgar_user_agent: str = ""
    alpaca_api_key: SecretStr = SecretStr("")
    alpaca_secret_key: SecretStr = SecretStr("")
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    public_site_url: str = "http://localhost:3000"
    source_repository_url: str = ""
    environment: str = "development"
    admin_token: SecretStr = SecretStr("")
    tradingagents_llm_provider: str = "groq"
    tradingagents_quick_think_llm: str = "openai/gpt-oss-20b"
    tradingagents_deep_think_llm: str = "openai/gpt-oss-20b"
    agentvora_deep_model: str = ""
    tradingagents_max_debate_rounds: int = 1
    tradingagents_max_risk_rounds: int = 1
    tradingagents_max_tool_rounds: int = 8
    tradingagents_llm_max_retries: int = 4
    tradingagents_max_tokens: int = 2048
    tradingagents_temperature: float = 0.1


settings = Settings()
