import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, collection, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const cafe = (uid: string) => ({
  name: 'Toby\'s Estate',
  nameLower: 'toby\'s estate',
  tags: ['coffee'],
  area: 'Legazpi Village',
  address: '',
  mapsUrl: '',
  price: 2,
  notes: '',
  work: { wifi: true, outlets: false, laptop: true },
  visitCount: 0,
  ratingSum: 0,
  raters: {},
  createdBy: uid,
})

const visit = (uid: string) => ({ uid, displayName: uid, date: '2026-10-17', rating: 4, items: [{ name: 'flat white', rating: 5 }], note: '' })

function as(uid: string, email: string, verified = true) {
  return env.authenticatedContext(uid, { email, email_verified: verified }).firestore()
}

const alice = () => as('alice', 'alice@example.com')
const bob = () => as('bob', 'bob@example.com')
const carol = () => as('carol', 'carol@example.com')
const anon = () => env.unauthenticatedContext().firestore()

async function claim(db: ReturnType<typeof alice>, email: string, uid: string) {
  const b = writeBatch(db)
  b.set(doc(db, 'members', email), { role: 'admin' })
  b.set(doc(db, 'config', 'bootstrap'), { uid })
  return b.commit()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mktmxxng',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(() => env.cleanup())

beforeEach(() => env.clearFirestore())

describe('bootstrap', () => {
  it('first signed-in user can claim admin once', async () => {
    await assertSucceeds(claim(alice(), 'alice@example.com', 'alice'))
    await assertFails(claim(bob(), 'bob@example.com', 'bob'))
  })

  it('needs both docs in the same batch', async () => {
    await assertFails(setDoc(doc(alice(), 'members', 'alice@example.com'), { role: 'admin' }))
    await assertFails(setDoc(doc(alice(), 'config', 'bootstrap'), { uid: 'alice' }))
  })

  it('cannot claim for someone else\'s email', async () => {
    const db = alice()
    const b = writeBatch(db)
    b.set(doc(db, 'members', 'bob@example.com'), { role: 'admin' })
    b.set(doc(db, 'config', 'bootstrap'), { uid: 'alice' })
    await assertFails(b.commit())
  })

  it('unverified email cannot claim', async () => {
    await assertFails(claim(as('eve', 'eve@example.com', false), 'eve@example.com', 'eve'))
  })
})

describe('with admin alice and member bob', () => {
  beforeEach(async () => {
    await claim(alice(), 'alice@example.com', 'alice')
    await setDoc(doc(alice(), 'members', 'bob@example.com'), { role: 'member' })
  })

  it('anyone can read cafes and visits', async () => {
    await setDoc(doc(bob(), 'cafes', 'c1'), cafe('bob'))
    await assertSucceeds(getDoc(doc(anon(), 'cafes', 'c1')))
    await assertSucceeds(getDocs(collection(anon(), 'cafes', 'c1', 'visits')))
  })

  it('non-members cannot write', async () => {
    await assertFails(setDoc(doc(anon(), 'cafes', 'c1'), cafe('anon')))
    await assertFails(setDoc(doc(carol(), 'cafes', 'c1'), cafe('carol')))
    await assertFails(setDoc(doc(carol(), 'taxonomy', 'tags'), { list: ['x'] }))
  })

  it('members add and edit cafes but only admin deletes', async () => {
    await assertSucceeds(setDoc(doc(bob(), 'cafes', 'c1'), cafe('bob')))
    await assertFails(setDoc(doc(bob(), 'cafes', 'c2'), cafe('alice')))
    await assertSucceeds(updateDoc(doc(alice(), 'cafes', 'c1'), { notes: 'cash only' }))
    await assertFails(updateDoc(doc(alice(), 'cafes', 'c1'), { createdBy: 'alice' }))
    await assertFails(updateDoc(doc(bob(), 'cafes', 'c1'), { price: 9 }))
    await assertFails(deleteDoc(doc(bob(), 'cafes', 'c1')))
    await assertSucceeds(deleteDoc(doc(alice(), 'cafes', 'c1')))
  })

  it('visits belong to whoever logged them', async () => {
    await setDoc(doc(bob(), 'cafes', 'c1'), cafe('bob'))
    const db = bob()
    const b = writeBatch(db)
    b.set(doc(db, 'cafes', 'c1', 'visits', 'v1'), visit('bob'))
    b.update(doc(db, 'cafes', 'c1'), { visitCount: increment(1), ratingSum: increment(4), 'raters.bob': increment(1) })
    await assertSucceeds(b.commit())

    await assertFails(setDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v2'), visit('alice')))
    await assertFails(setDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v3'), { ...visit('bob'), rating: 6 }))
    await assertFails(updateDoc(doc(alice(), 'cafes', 'c1', 'visits', 'v1'), { rating: 1 }))
    await assertSucceeds(updateDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v1'), { rating: 5 }))
    await assertSucceeds(deleteDoc(doc(alice(), 'cafes', 'c1', 'visits', 'v1')))
  })

  it('only members read the member list; only admin changes it', async () => {
    await assertSucceeds(getDocs(collection(bob(), 'members')))
    await assertFails(getDocs(collection(carol(), 'members')))
    await assertSucceeds(getDoc(doc(carol(), 'members', 'carol@example.com')))
    await assertFails(setDoc(doc(bob(), 'members', 'carol@example.com'), { role: 'member' }))
    await assertSucceeds(setDoc(doc(alice(), 'members', 'carol@example.com'), { role: 'member' }))
    await assertFails(setDoc(doc(alice(), 'members', 'dan@example.com'), { role: 'owner' }))
    await assertFails(deleteDoc(doc(alice(), 'members', 'alice@example.com')))
    await assertSucceeds(deleteDoc(doc(alice(), 'members', 'bob@example.com')))
  })

  it('taxonomy is limited to tags and areas', async () => {
    await assertSucceeds(setDoc(doc(bob(), 'taxonomy', 'tags'), { list: ['coffee', 'brunch'] }))
    await assertFails(setDoc(doc(bob(), 'taxonomy', 'other'), { list: [] }))
  })
})
