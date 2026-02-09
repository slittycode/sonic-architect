# Using CLI LLMs with Sonic Architect

Sonic Architect is a browser-based SPA and cannot directly invoke CLI tools. However, several popular tools already bridge CLI/local models to HTTP APIs that Sonic Architect supports natively.

## Recommended: Use Ollama (simplest)

[Ollama](https://ollama.com) wraps any GGUF model behind a local HTTP API — exactly what Sonic Architect's **Ollama** provider expects.

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh   # Linux/macOS
# or download from https://ollama.com/download   # Windows/macOS

# Pull a model
ollama pull llama3.2
ollama pull mistral
ollama pull codellama

# Ollama starts a server at http://localhost:11434 automatically
# Sonic Architect connects to this endpoint
```

Then select **Ollama LLM** in Sonic Architect's settings panel. The app will auto-detect available models.

## Alternative: LM Studio

[LM Studio](https://lmstudio.ai) provides a GUI for downloading and running local models with an OpenAI-compatible HTTP API.

1. Download and install LM Studio
2. Download a model (e.g., Llama 3, Mistral, Phi)
3. Start the local server (default: `http://localhost:1234/v1`)
4. In Sonic Architect, select **OpenAI (ChatGPT)** and set:
   - **Base URL**: `http://localhost:1234/v1`
   - **API Key**: `lm-studio` (any non-empty string works)
   - **Model**: The model name shown in LM Studio

## Alternative: llama.cpp Server

If you use [llama.cpp](https://github.com/ggerganov/llama.cpp) directly:

```bash
# Start the HTTP server with a model
./llama-server -m models/llama-3.2-3b.gguf --port 8080

# Or with the OpenAI-compatible endpoint
./llama-server -m models/llama-3.2-3b.gguf --port 8080 --api-key none
```

Then in Sonic Architect, select **OpenAI (ChatGPT)** and set:

- **Base URL**: `http://localhost:8080/v1`
- **API Key**: `none`
- **Model**: `default`

## Alternative: Gemini CLI → Ollama Bridge

If you use the `gemini` CLI tool and want it accessible to Sonic Architect, the easiest approach is to use Ollama with a Gemini-compatible model, or use the **Gemini** provider directly with an API key.

## How It Works

All LLM providers in Sonic Architect follow the same pattern:

1. **Local DSP analysis** runs first (BPM, key, spectral features) — always client-side
2. **Feature summary** is sent as a text prompt to the LLM
3. **LLM response** enhances text descriptions (groove, instrumentation, FX recommendations)
4. If the LLM is unavailable, the app **falls back** to the local-only blueprint

The LLM never receives audio data — only numeric features extracted by the DSP engine.
