/**
 * LRU Cache implementation for PDF page rendering
 * Stores rendered canvases to avoid re-rendering when scrolling
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  lastAccessed: number;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheEntry<T>>;

  constructor(capacity: number = 20) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   * Updates last accessed time
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Update access time
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * Set a value in the cache
   * Evicts least recently used entry if at capacity
   */
  set(key: string, value: T): void {
    // If key exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastAccessed = Date.now();
      return;
    }

    // If at capacity, evict LRU entry
    if (this.cache.size >= this.capacity) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, {
      key,
      value,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove a specific entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get all keys in cache (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Specialized cache for rendered PDF pages
 * Key format: "docId:pageNum:scale"
 */
export class PDFPageCache extends LRUCache<HTMLCanvasElement> {
  constructor(capacity: number = 20) {
    super(capacity);
  }

  /**
   * Generate a cache key for a rendered page
   */
  static makeKey(docId: string, pageNum: number, scale: number): string {
    return `${docId}:${pageNum}:${scale.toFixed(2)}`;
  }

  /**
   * Get a rendered page canvas
   */
  getPage(
    docId: string,
    pageNum: number,
    scale: number
  ): HTMLCanvasElement | undefined {
    return this.get(PDFPageCache.makeKey(docId, pageNum, scale));
  }

  /**
   * Cache a rendered page canvas
   */
  setPage(
    docId: string,
    pageNum: number,
    scale: number,
    canvas: HTMLCanvasElement
  ): void {
    this.set(PDFPageCache.makeKey(docId, pageNum, scale), canvas);
  }

  /**
   * Check if a page is cached
   */
  hasPage(docId: string, pageNum: number, scale: number): boolean {
    return this.has(PDFPageCache.makeKey(docId, pageNum, scale));
  }

  /**
   * Clear all pages for a specific document
   */
  clearDocument(docId: string): void {
    const keysToDelete = this.keys().filter((key) =>
      key.startsWith(`${docId}:`)
    );
    keysToDelete.forEach((key) => this.delete(key));
  }
}

/**
 * Global singleton cache instance
 * Can be imported and used across the app
 */
export const globalPageCache = new PDFPageCache(30);
