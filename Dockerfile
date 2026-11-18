# syntax=docker/dockerfile:1
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies: Python3, Pip, Tesseract OCR, and graphics/OpenCV libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install production Node.js dependencies
COPY package*.json ./
RUN npm install --production

# Copy Python requirements and install Python dependencies
COPY ai_engine/requirements.txt ./ai_engine/
RUN pip3 install --no-cache-dir --break-system-packages -r ai_engine/requirements.txt

# Copy the rest of the application files
COPY . .

# Pre-train the ONNX ETA prediction model and pre-seed the database at build time
RUN python3 ai_engine/train_eta_model.py && node database/seed.js

# Expose application port
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000

# Start CareTime server
CMD ["node", "server/index.js"]
