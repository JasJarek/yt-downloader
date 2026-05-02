# Stage 1: Download sidecar binaries
FROM debian:bookworm-slim AS sidecars

RUN apt-get update && apt-get install -y curl xz-utils unzip && rm -rf /var/lib/apt/lists/*

WORKDIR /sidecars

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp \
    && chmod +x yt-dlp

RUN curl -L https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linux64-gpl.tar.xz \
      -o ffmpeg.tar.xz \
    && tar -xf ffmpeg.tar.xz \
    && cp ffmpeg-master-latest-linux64-gpl/bin/ffmpeg ./ffmpeg \
    && chmod +x ffmpeg \
    && rm -rf ffmpeg.tar.xz ffmpeg-master-latest-linux64-gpl

# Stage 2: Build the Tauri app
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup
ENV PATH=$CARGO_HOME/bin:$PATH

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    file \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# pnpm
RUN curl -fsSL https://get.pnpm.io/install.sh | sh - \
    && pnpm --version

# Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain stable --no-modify-path \
    && rustc --version && cargo --version

WORKDIR /app

# Install frontend dependencies (cache layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy Rust dependency files (cache layer)
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./src-tauri/

# Warm up Rust dependency cache with a dummy lib
RUN mkdir -p src-tauri/src && \
    echo 'pub fn run() {}' > src-tauri/src/lib.rs && \
    echo 'fn main() {}' > src-tauri/src/main.rs && \
    cd src-tauri && cargo fetch

# Copy sidecar binaries from stage 1
COPY --from=sidecars /sidecars/yt-dlp ./src-tauri/binaries/yt-dlp
COPY --from=sidecars /sidecars/ffmpeg  ./src-tauri/binaries/ffmpeg

# Copy full source
COPY . .

# Build frontend then Tauri
RUN pnpm build && \
    pnpm tauri build --config src-tauri/tauri.linux.conf.json

# Stage 3: Collect artifacts
FROM scratch AS artifacts

COPY --from=builder /app/src-tauri/target/release/bundle/deb/*.deb /
COPY --from=builder /app/src-tauri/target/release/bundle/appimage/*.AppImage /
