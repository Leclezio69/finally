# Stage 1: Build Next.js frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim AS runtime

# Install uv
RUN pip install --no-cache-dir uv

# Set workdir for backend
WORKDIR /app/backend

# Copy backend project files
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
# Install dependencies only (no-dev, use locked versions)
RUN uv sync --no-dev --frozen

# Copy backend source code
COPY backend/ ./

# Copy frontend static build output
COPY --from=frontend-builder /app/frontend/out/ /app/static/

# Create db directory for SQLite
RUN mkdir -p /app/db

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run the FastAPI app
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
