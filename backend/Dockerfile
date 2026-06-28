# Use a Debian-based Node image to ensure better-sqlite3 compiles correctly
FROM node:18-bullseye

# Hugging Face Spaces require the app to run under a non-root user (ID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy package.json and install dependencies
COPY --chown=user package.json ./
RUN npm install

# Copy all other backend files
COPY --chown=user . .

# Hugging Face routes external traffic to this specific port
EXPOSE 7860
ENV PORT=7860

# Start the server
CMD ["node", "server.js"]