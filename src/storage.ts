// Browser storage can be missing or throw (private mode, blocked site data); never let that break the app.
function wrap(get: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return get().getItem(key)
      } catch {
        return null
      }
    },
    set(key: string, value: string) {
      try {
        get().setItem(key, value)
      } catch {
        /* ignore */
      }
    },
    remove(key: string) {
      try {
        get().removeItem(key)
      } catch {
        /* ignore */
      }
    },
    getJSON<T>(key: string, fallback: T): T {
      const raw = this.get(key)
      if (!raw) return fallback
      try {
        return JSON.parse(raw) as T
      } catch {
        return fallback
      }
    },
    setJSON(key: string, value: unknown) {
      this.set(key, JSON.stringify(value))
    },
  }
}

export const storage = wrap(() => window.localStorage)
export const session = wrap(() => window.sessionStorage)
