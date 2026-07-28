"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BRAIN_CATEGORIES, type BrainCategory } from "@/lib/memory/categories";
import { getCategoryDetailAction, type CategoryDetail } from "@/app/(app)/life/brain/actions";

type AskResult = { answer: string; sources: { type: string; id: string; date: string | null }[] };

export function BrainClient() {
  const [question, setQuestion] = useState("");
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [asking, startAsking] = useTransition();
  const [openCategory, setOpenCategory] = useState<BrainCategory | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<CategoryDetail | null>(null);
  const [loadingCategory, startLoadingCategory] = useTransition();

  function submitQuestion() {
    const q = question.trim();
    if (!q) return;
    startAsking(async () => {
      try {
        const res = await fetch("/api/brain/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = (await res.json()) as AskResult;
        setAskResult(data);
      } catch (err) {
        console.error("BrainClient: ask failed", err);
        setAskResult({ answer: "Something went wrong asking the Brain -- try again.", sources: [] });
      }
    });
  }

  function toggleTile(category: BrainCategory) {
    if (openCategory === category) {
      setOpenCategory(null);
      setCategoryDetail(null);
      return;
    }
    setOpenCategory(category);
    setCategoryDetail(null);
    startLoadingCategory(async () => {
      try {
        const detail = await getCategoryDetailAction(category);
        setCategoryDetail(detail);
      } catch (err) {
        console.error(`BrainClient: getCategoryDetailAction failed for ${category}`, err);
        setCategoryDetail({ summary: "Couldn't load this category -- try again.", chunks: [] });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rtd-glass rounded-[10px] p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuestion();
            }}
            placeholder="Ask your Brain anything…"
            className="flex-1 min-w-0 bg-transparent border-b border-[var(--rtd-hairline)] text-subhead text-[var(--rtd-text)] placeholder:text-[var(--rtd-text-tertiary)] focus:outline-none py-1.5"
          />
          <button
            onClick={submitQuestion}
            disabled={asking || !question.trim()}
            className="rtd-tap-target text-subhead text-[var(--rtd-blue)] px-1.5 shrink-0"
          >
            {asking ? "Asking…" : "Ask"}
          </button>
        </div>
        {askResult && (
          <div className="flex flex-col gap-2 border-t border-[var(--rtd-hairline)] pt-2.5">
            <p className="text-subhead text-[var(--rtd-text)] leading-relaxed whitespace-pre-wrap">{askResult.answer}</p>
            {askResult.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {askResult.sources.map((s, i) => (
                  <span
                    key={i}
                    className="text-caption text-[var(--rtd-text-tertiary)] rounded-full border border-[var(--rtd-hairline)] px-2 py-0.5"
                  >
                    [{s.type}:{s.id}]{s.date ? ` ${s.date}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {BRAIN_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleTile(cat)}
            className="rtd-glass rounded-[10px] p-3 text-subhead font-medium text-center"
            style={{ color: openCategory === cat ? "var(--rtd-blue)" : "var(--rtd-text)" }}
          >
            {cat}
          </button>
        ))}
      </div>

      {openCategory && (
        <div className="rtd-glass rounded-[10px] p-3.5 flex flex-col gap-2.5">
          <span className="text-subhead font-semibold">{openCategory}</span>
          {loadingCategory && !categoryDetail && <span className="text-caption text-[var(--rtd-text-tertiary)]">Loading…</span>}
          {categoryDetail?.summary && <p className="text-subhead text-[var(--rtd-text-secondary)] leading-relaxed">{categoryDetail.summary}</p>}
          <div className="flex flex-col gap-1.5">
            {categoryDetail?.chunks.map((c) => {
              const key = `${c.sourceType}-${c.sourceId}`;
              const rowContent = (
                <div className="flex flex-col gap-0.5 py-1.5 border-b border-[var(--rtd-hairline)] last:border-b-0">
                  <span className="text-caption text-[var(--rtd-text-tertiary)]">{c.sourceDate ?? ""}</span>
                  <span className="text-subhead text-[var(--rtd-text)] line-clamp-2">{c.text}</span>
                </div>
              );
              return c.href ? (
                <Link key={key} href={c.href} className="block">
                  {rowContent}
                </Link>
              ) : (
                <div key={key}>{rowContent}</div>
              );
            })}
            {categoryDetail && categoryDetail.chunks.length === 0 && (
              <span className="text-caption text-[var(--rtd-text-tertiary)]">Nothing here yet.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
