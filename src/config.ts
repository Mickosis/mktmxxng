/**
 * Cloudflare Worker that reads TikTok/IG/FB captions (see worker/). Empty until it's deployed;
 * without it, full TikTok links still work through TikTok's own public oEmbed.
 */
export const PREVIEW_URL: string = import.meta.env.VITE_PREVIEW_URL || ''
