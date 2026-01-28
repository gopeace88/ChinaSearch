from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./china_search.db"
    glm_api_key: str = ""
    glm_model: str = "glm-4"
    claude_cli_path: str = "claude"
    gemini_cli_path: str = "gemini"
    max_iterations: int = 20

    model_config = {"env_file": ".env"}


settings = Settings()
