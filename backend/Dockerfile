# Use an official lightweight Python image
FROM python:3.10-slim

# Hugging Face Spaces require the app to run as a non-root user (ID 1000)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /home/user/app

# Copy requirements and install dependencies
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend files
COPY --chown=user . .

# Hugging Face routes external traffic to this specific port
EXPOSE 7860
ENV PORT=7860

# Start the FastAPI server on port 7860
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]