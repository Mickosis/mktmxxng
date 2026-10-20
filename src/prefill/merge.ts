import { WORK_LABELS, type CafeInput, type WorkFlag } from '../types'
import type { Prefill } from './parse'

/** One field the pre-fill set, with what it was set to, e.g. { field: 'Area', value: 'Chino Roces' }. */
export type Filled = { field: string; value: string }

/** Fills only what's still empty in the form, and says what it filled. */
export function mergePrefill(form: CafeInput, p: Prefill): { next: CafeInput; filled: Filled[] } {
  const next: CafeInput = { ...form, work: { ...form.work } }
  const filled: Filled[] = []
  if (!form.name.trim() && p.name) {
    next.name = p.name
    filled.push({ field: 'Name', value: p.name })
  }
  if (!form.area.trim() && p.area) {
    next.area = p.area
    filled.push({ field: 'Area', value: p.area })
  }
  if (!form.address.trim() && p.address) {
    next.address = p.address
    filled.push({ field: 'Address', value: p.address })
  }
  const newTags = p.tags.filter((t) => !form.tags.includes(t))
  if (newTags.length) {
    next.tags = [...form.tags, ...newTags]
    filled.push({ field: newTags.length === 1 ? 'Tag' : 'Tags', value: newTags.join(', ') })
  }
  const newWork = p.work.filter((w: WorkFlag) => !form.work[w])
  if (newWork.length) {
    newWork.forEach((w) => (next.work[w] = true))
    filled.push({ field: 'Good for', value: newWork.map((w) => WORK_LABELS[w]).join(', ') })
  }
  if (p.petFriendly && !form.petFriendly) {
    next.petFriendly = true
    filled.push({ field: 'Pets', value: 'Pet-friendly' })
  }
  return { next, filled }
}
