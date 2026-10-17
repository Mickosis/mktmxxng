import type { CafeInput, WorkFlag } from '../types'
import type { Prefill } from './parse'

/** Fills only what's still empty in the form, and says what it filled. */
export function mergePrefill(form: CafeInput, p: Prefill): { next: CafeInput; filled: string[] } {
  const next: CafeInput = { ...form, work: { ...form.work } }
  const filled: string[] = []
  if (!form.name.trim() && p.name) {
    next.name = p.name
    filled.push('name')
  }
  if (!form.area.trim() && p.area) {
    next.area = p.area
    filled.push('area')
  }
  if (!form.address.trim() && p.address) {
    next.address = p.address
    filled.push('address')
  }
  const newTags = p.tags.filter((t) => !form.tags.includes(t))
  if (newTags.length) {
    next.tags = [...form.tags, ...newTags]
    filled.push(newTags.length === 1 ? '1 tag' : `${newTags.length} tags`)
  }
  const newWork = p.work.filter((w: WorkFlag) => !form.work[w])
  if (newWork.length) {
    newWork.forEach((w) => (next.work[w] = true))
    filled.push('work details')
  }
  if (p.petFriendly && !form.petFriendly) {
    next.petFriendly = true
    filled.push('pet-friendly')
  }
  return { next, filled }
}
