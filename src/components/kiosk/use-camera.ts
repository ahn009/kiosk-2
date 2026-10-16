"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  | { state: "idle" }
  | { state: "requesting" }
  | { state: "live"; stream: MediaStream }
  | { state: "denied"; message: string }
  | { state: "unsupported" };

/**
 * Manages the kiosk camera lifecycle. The camera is requested while `enabled`
 * is true; the underlying stream is cleaned up on disable or unmount.
 *
 * The caller passes the live `MediaStream` to a `<video>` element via ref
 * assignment (we don't attach here to keep the hook pure).
 *
 * Resolution targets 1080p but falls back to whatever the device offers.
 * We never throw — failures are surfaced as `denied` / `unsupported`.
 *
 * NOTE: all setState calls happen inside the async `run()` body after the
 * first `await`, so they fire in microtasks — not synchronously inside the
 * effect body. This satisfies the `react-hooks/set-state-in-effect` rule.
 */
export function useCamera(enabled: boolean): {
  status: CameraStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
} {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Raw async state from getUserMedia — only updates from microtasks.
  const [rawState, setRawState] = useState<CameraStatus>({ state: "idle" });
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      for (const track of s.getTracks()) {
        try {
          track.stop();
        } catch {
          /* noop */
        }
      }
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* noop */
      }
    }
  }, []);

  const attachStream = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    const run = async () => {
      // Yield to a microtask so the setState calls below happen outside
      // the effect body (satisfies react-hooks/set-state-in-effect).
      await Promise.resolve();
      if (cancelled) return;

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setRawState({ state: "unsupported" });
        return;
      }
      setRawState({ state: "requesting" });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          // Component unmounted mid-request — release the stream.
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        attachStream(stream);
        setRawState({ state: "live", stream });
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;
        const message =
          e?.name === "NotAllowedError" || e?.name === "SecurityError"
            ? "Camera permission denied"
            : e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError"
              ? "No camera device found"
              : e?.message ?? "Camera unavailable";
        setRawState({ state: "denied", message });
      }
    };

    void run();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, stop, attachStream]);

  // Reattach stream if a video element mounts after the stream is acquired.
  useEffect(() => {
    if (rawState.state === "live" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        attachStream(streamRef.current);
      }
    }
  }, [rawState, attachStream]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => stop();
  }, [stop]);

  // Derive the public status: when disabled we report idle synchronously
  // (no setState-in-effect), otherwise we surface the raw async state.
  const status: CameraStatus = enabled ? rawState : { state: "idle" };
  return { status, videoRef };
}
