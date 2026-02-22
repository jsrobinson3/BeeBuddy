FROM python:3.12-slim

# Create non-root user matching typical host UID (overridable via build arg)
ARG UID=1000
ARG GID=1000
RUN groupadd -g $GID appuser && useradd -m -u $UID -g $GID appuser

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (system-wide so both root and appuser can use it)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && mv /root/.local/bin/uv /usr/local/bin/uv \
    && mv /root/.local/bin/uvx /usr/local/bin/uvx

# Copy dependency files
COPY pyproject.toml uv.lock* ./
RUN chown -R appuser:appuser /app

# Install dependencies as appuser (so .venv is owned by appuser)
USER appuser
RUN uv sync --frozen --no-dev

# Copy application code
COPY --chown=appuser:appuser . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
