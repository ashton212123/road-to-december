"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type RecorderState = "idle" | "recording" | "processing" | "error";

/** MediaRecorder.isTypeSupported prefers mp4 (iOS Safari) then webm/opus
 * (everywhere else) -- picking the browser's own best-supported type instead
 * of hardcoding one is what makes this work on both platforms without a
 * runtime check on user agent. */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function JournalRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const [, startTransition] = useTransition();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  async function submitForm(form: FormData, failureMessage: string) {
    setState("processing");
    try {
      const res = await fetch("/api/journal/transcribe", { method: "POST", body: form });
      if (!res.ok) {
        setErrorMsg(failureMessage);
        setShowFallback(true);
        setState("error");
        return;
      }
      setFallbackText("");
      setShowFallback(false);
      setErrorMsg(null);
      setState("idle");
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("JournalRecorder: submit failed", err);
      setErrorMsg(failureMessage);
      setShowFallback(true);
      setState("error");
    }
  }

  async function startRecording() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const form = new FormData();
        form.append("audio", blob, `journal.${extensionFor(blobType)}`);
        submitForm(form, "Transcription failed -- your recording didn't come through. Type your entry instead.");
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setErrorMsg("Microphone access was denied or unavailable -- type your entry instead.");
      setShowFallback(true);
      setState("idle");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function submitTypedFallback() {
    const text = fallbackText.trim();
    if (!text) return;
    const form = new FormData();
    form.append("text", text);
    submitForm(form, "Couldn't save that -- try again.");
  }

  return (
    <div className="rtd-glass rounded-[10px] p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        {state === "recording" ? (
          <Button type="button" variant="secondary" onClick={stopRecording}>
            Stop recording
          </Button>
        ) : (
          <Button type="button" disabled={state === "processing"} onClick={startRecording}>
            {state === "processing" ? "Processing…" : "Record entry"}
          </Button>
        )}
        {!showFallback && (
          <button type="button" onClick={() => setShowFallback(true)} className="text-caption text-[var(--rtd-text-tertiary)]">
            or type instead
          </button>
        )}
      </div>
      {errorMsg && <p className="text-caption text-[var(--rtd-red)]">{errorMsg}</p>}
      {showFallback && (
        <div className="flex flex-col gap-2">
          <textarea
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            rows={4}
            placeholder="Type today's entry…"
            className="rounded-[8px] bg-white/[0.06] px-3.5 py-2.5 text-subhead outline-none resize-none focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          />
          <Button
            type="button"
            disabled={!fallbackText.trim() || state === "processing"}
            onClick={submitTypedFallback}
            className="self-start"
          >
            Save entry
          </Button>
        </div>
      )}
    </div>
  );
}
