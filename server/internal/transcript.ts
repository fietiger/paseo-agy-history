import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderTimelineItem } from "@getpaseo/plugin/server/provider";

const VERSION = 1;
const MAX_ITEMS = 400;

interface StoredTranscript {
  version: number;
  conversationId: string;
  updatedAt: string;
  items: ProviderTimelineItem[];
}

export function transcriptDirectory(): string {
  const home = process.env.PASEO_HOME?.trim();
  const base = home && home.length > 0 ? home : path.join(os.homedir(), ".paseo");
  return path.join(base, "agy-history", "transcripts");
}

export class TranscriptStore {
  private items: ProviderTimelineItem[] = [];
  private loaded = false;
  private timer: NodeJS.Timeout | null = null;
  private writing: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(private readonly conversationId: string) {}

  /** Loads the transcript from disk. Never throws: an unreadable file starts empty. */
  async load(): Promise<ProviderTimelineItem[]> {
    if (this.loaded) return this.items;
    this.loaded = true;
    try {
      const raw = await readFile(this.file(), "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredTranscript>;
      if (Array.isArray(parsed.items)) this.items = parsed.items.slice(-MAX_ITEMS);
    } catch (error) {
      if (!isMissing(error)) console.error("[agy-history] transcript load failed", error);
    }
    return this.items;
  }

  /** Returns the stored items, with stale running tools marked complete. */
  replayItems(): ProviderTimelineItem[] {
    return this.items.map((item) =>
      item.type === "tool_call" && item.status === "running"
        ? { ...item, status: "completed", error: null }
        : item,
    );
  }

  /** Upserts one complete snapshot, keyed by item id. */
  record(item: ProviderTimelineItem): void {
    const index = this.items.findIndex((existing) => existing.id === item.id);
    if (index === -1) this.items.push(item);
    else this.items[index] = item;
    if (this.items.length > MAX_ITEMS) this.items = this.items.slice(-MAX_ITEMS);
    this.schedule();
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const payload: StoredTranscript = {
      version: VERSION,
      conversationId: this.conversationId,
      updatedAt: new Date().toISOString(),
      items: this.items,
    };
    const body = JSON.stringify(payload);
    this.writing = this.writing.then(async () => {
      try {
        const file = this.file();
        await mkdir(path.dirname(file), { recursive: true });
        const temporary = `${file}.${process.pid}.tmp`;
        await writeFile(temporary, body, "utf8");
        await rename(temporary, file);
      } catch (error) {
        console.error("[agy-history] transcript save failed", error);
      }
    });
    await this.writing;
  }

  private schedule(): void {
    this.dirty = true;
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 250);
  }

  private file(): string {
    return path.join(transcriptDirectory(), `${this.conversationId}.json`);
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
