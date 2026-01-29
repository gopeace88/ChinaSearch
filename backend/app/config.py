from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./china_search.db"

    # GLM (text-only, good for librarian/explore tasks)
    glm_api_key: str = ""
    glm_model: str = "glm-4.7"

    # Claude Code CLI (orchestrator + optionally cheap vision worker via model alias)
    claude_cli_path: str = "claude"
    claude_model_main: str = "sonnet"  # main analyst/orchestrator
    claude_model_cheap: str = "haiku"  # cheap worker (esp. light OCR/summary)

    # Gemini CLI (great for web search/summarize; vision support depends on CLI/env)
    gemini_cli_path: str = "gemini"

    max_iterations: int = 20

    # Where to store per-iteration artifacts (task outputs, evidence bundles, etc.)
    artifacts_dir: str = "./artifacts"

    model_config = {"env_file": ".env"}


settings = Settings()
