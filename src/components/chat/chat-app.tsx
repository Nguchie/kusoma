"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

export type ChatStudent = {
  id: string;
  first_name: string;
  grade: number;
};

export type ChatMessage = {
  id: string;
  direction: string;
  content_type: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

type Screen = "identify" | "picker" | "thread";

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return "Something went wrong.";
}

export function ChatApp({
  initialStudent,
}: {
  initialStudent: ChatStudent | null;
}) {
  const [screen, setScreen] = useState<Screen>(
    initialStudent ? "thread" : "identify",
  );
  const [student, setStudent] = useState<ChatStudent | null>(initialStudent);
  const [candidates, setCandidates] = useState<ChatStudent[]>([]);
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resetToIdentify() {
    try {
      await fetch("/api/chat/logout", { method: "POST" });
    } catch {
      /* still leave the thread */
    }
    setScreen("identify");
    setStudent(null);
    setCandidates([]);
    setError(null);
  }

  async function identify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/chat/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as {
        student?: ChatStudent;
        candidates?: ChatStudent[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not find that phone.");
        return;
      }
      if (data.student) {
        setStudent(data.student);
        setScreen("thread");
        return;
      }
      if (data.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
        setScreen("picker");
        return;
      }
      setError("No student found for that phone.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function selectStudent(studentId: string) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/chat/select-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = (await response.json()) as {
        student?: ChatStudent;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not select that student.");
        return;
      }
      if (!data.student) {
        setError("Could not select that student.");
        return;
      }
      setStudent(data.student);
      setScreen("thread");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-white dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold tracking-tight">Kusoma</p>
          {student ? (
            <p className="text-xs text-zinc-500">
              {student.first_name} · Grade {student.grade}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">Student chat</p>
          )}
        </div>
        {screen === "thread" ? (
          <button
            type="button"
            className="text-xs text-zinc-500 underline"
            onClick={resetToIdentify}
          >
            Different phone
          </button>
        ) : null}
      </header>

      {screen === "identify" ? (
        <form
          onSubmit={identify}
          className="flex flex-1 flex-col justify-center gap-4 px-4 py-10"
        >
          <h1 className="text-xl font-semibold">Enter your phone</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Use the Kenyan number your tutor registered.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Phone
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : null}

      {screen === "picker" ? (
        <div className="flex flex-1 flex-col gap-3 px-4 py-8">
          <h1 className="text-xl font-semibold">Who is learning?</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            More than one student uses this phone.
          </p>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {candidates.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => selectStudent(item.id)}
                  className={`${secondaryButtonClass} w-full text-left`}
                >
                  {item.first_name} · Grade {item.grade}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-sm text-zinc-500 underline"
            onClick={resetToIdentify}
          >
            Use a different phone
          </button>
        </div>
      ) : null}

      {screen === "thread" && student ? (
        <ChatThread student={student} onUnauthorized={resetToIdentify} />
      ) : null}
    </main>
  );
}

function ChatThread({
  student,
  onUnauthorized,
}: {
  student: ChatStudent;
  onUnauthorized: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  const lastCreatedAt = useMemo(
    () => messages.at(-1)?.created_at ?? "",
    [messages],
  );

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const seen = new Set(current.map((item) => item.id));
      const next = incoming.filter((item) => !seen.has(item.id));
      if (next.length === 0) return current;
      return [...current, ...next];
    });
  }, []);

  const loadAll = useCallback(async () => {
    const response = await fetch("/api/chat/messages");
    if (response.status === 401) {
      onUnauthorized();
      return;
    }
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    const data = (await response.json()) as { messages?: ChatMessage[] };
    setMessages(data.messages ?? []);
  }, [onUnauthorized]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAll();
      } catch {
        if (!cancelled) setError("Could not load messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll, student.id]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setInterval(async () => {
      if (sendingRef.current) return;
      try {
        const params = lastCreatedAt
          ? `?since=${encodeURIComponent(lastCreatedAt)}`
          : "";
        const response = await fetch(`/api/chat/messages${params}`);
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as { messages?: ChatMessage[] };
        mergeMessages(data.messages ?? []);
      } catch {
        /* keep last thread */
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [lastCreatedAt, loading, mergeMessages, onUnauthorized]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text && !file) return;
    setError(null);
    setPending(true);
    sendingRef.current = true;
    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        if (text) form.append("body", text);
        form.append("image", file);
        response = await fetch("/api/chat/message", {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
      }
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setBody("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadAll();
    } catch {
      setError("Network error. Try again.");
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Send a homework problem to get started. Type{" "}
            <span className="font-medium">start</span> if your tutor assigned
            practice.
          </p>
        ) : (
          messages.map((item) => (
            <MessageBubble key={item.id} message={item} />
          ))
        )}
        {pending ? (
          <p className="text-xs text-zinc-500">Kusoma is thinking…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800"
      >
        {error ? (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {file ? (
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="truncate">Photo: {file.name}</span>
            <button
              type="button"
              className="underline"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-image">
            Attach a homework photo
          </label>
          <input
            id="chat-image"
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className={`${secondaryButtonClass} shrink-0 px-3`}
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            Photo
          </button>
          <textarea
            rows={2}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Homework, an answer, or start"
            className={`${inputClass} min-h-[44px] flex-1 resize-none`}
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || (!body.trim() && !file)}
            className={`${primaryButtonClass} shrink-0`}
          >
            {pending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={`flex ${outbound ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
          outbound
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        }`}
      >
        {message.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.image_url}
            alt="Homework"
            className="mb-2 max-h-56 w-full rounded-lg object-contain"
          />
        ) : null}
        {message.body ? (
          <p className="whitespace-pre-wrap">{message.body}</p>
        ) : null}
      </div>
    </div>
  );
}
