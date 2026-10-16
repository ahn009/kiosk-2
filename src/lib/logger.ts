// Minimal structured logger for server code. Emits one JSON object per
// line so log aggregators can parse it. Never log secrets, tokens, face
// embeddings, or raw credentials — callers are responsible for redaction.
type Fields = Record<string, unknown>;

function emit(level: "debug" | "info" | "warn" | "error", msg: string, fields?: Fields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "sentinel-kiosk",
    msg,
    ...fields,
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else if (level === "debug" && process.env.NODE_ENV === "production") {
    return; // drop debug in production
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
