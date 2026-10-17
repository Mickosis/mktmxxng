/**
 * Cloudflare Worker that reads TikTok/IG/FB captions (see worker/). Set VITE_PREVIEW_URL to point
 * at another deploy, e.g. `wrangler dev` locally. If it's down, full TikTok links still work
 * through TikTok's own public oEmbed.
 */
export const PREVIEW_URL: string = import.meta.env.VITE_PREVIEW_URL || 'https://mktmxxng-preview.mickosis.workers.dev'
