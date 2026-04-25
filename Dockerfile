FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# HuggingFace Spaces runs as user 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Copy files
COPY --chown=user backend/ ./backend/
COPY --chown=user frontend-vanilla/ ./frontend-vanilla/

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Pre-cache HuggingFace models
RUN python -c "\
from transformers import ViTForImageClassification, ViTImageProcessor; \
ViTImageProcessor.from_pretrained('dima806/deepfake_vs_real_image_detection'); \
ViTForImageClassification.from_pretrained('dima806/deepfake_vs_real_image_detection'); \
ViTImageProcessor.from_pretrained('prithivMLmods/Deep-Fake-Detector-v2-Model'); \
ViTForImageClassification.from_pretrained('prithivMLmods/Deep-Fake-Detector-v2-Model'); \
print('Models cached')"

WORKDIR /home/user/app/backend

RUN mkdir -p uploads

# HuggingFace Spaces uses port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
