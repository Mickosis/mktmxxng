import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, collection, increment, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
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

const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz'

const DAY = 24 * 60 * 60 * 1000

function invite(uid: string, expiresInDays = 7) {
  return { createdBy: uid, createdAt: serverTimestamp(), label: 'for carol', expiresAt: Timestamp.fromMillis(Date.now() + expiresInDays * DAY) }
}

async function redeem(db: ReturnType<typeof alice>, email: string, uid: string, token = TOKEN, label = 'for carol') {
  const b = writeBatch(db)
  b.set(doc(db, 'members', email), { role: 'member', displayName: uid, addedAt: serverTimestamp(), invite: token, inviteLabel: label })
  b.delete(doc(db, 'invites', token))
  return b.commit()
}

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

  it('cafes can carry up to 10 social links', async () => {
    await assertSucceeds(setDoc(doc(bob(), 'cafes', 'c1'), { ...cafe('bob'), links: ['https://www.tiktok.com/@x/video/1'] }))
    await assertFails(setDoc(doc(bob(), 'cafes', 'c2'), { ...cafe('bob'), links: Array.from({ length: 11 }, (_, i) => `https://x.com/${i}`) }))
    await assertFails(setDoc(doc(bob(), 'cafes', 'c3'), { ...cafe('bob'), links: 'https://x.com' }))
  })

  it('members rename only themselves, only the name', async () => {
    await assertSucceeds(updateDoc(doc(bob(), 'members', 'bob@example.com'), { displayName: 'Bobby' }))
    await assertFails(updateDoc(doc(bob(), 'members', 'bob@example.com'), { role: 'admin' }))
    await assertFails(updateDoc(doc(bob(), 'members', 'bob@example.com'), { displayName: '' }))
    await assertFails(updateDoc(doc(bob(), 'members', 'alice@example.com'), { displayName: 'not alice' }))
    // Renaming old visits: own visits only.
    await setDoc(doc(bob(), 'cafes', 'c1'), cafe('bob'))
    await setDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v1'), visit('bob'))
    await assertSucceeds(getDocs(query(collectionGroup(bob(), 'visits'), where('uid', '==', 'bob'))))
    await assertSucceeds(updateDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v1'), { displayName: 'Bobby' }))
    await assertFails(updateDoc(doc(alice(), 'cafes', 'c1', 'visits', 'v1'), { displayName: 'x' }))
  })

  it('pet-friendly must be a boolean', async () => {
    await assertSucceeds(setDoc(doc(bob(), 'cafes', 'p1'), { ...cafe('bob'), petFriendly: true }))
    await assertFails(setDoc(doc(bob(), 'cafes', 'p2'), { ...cafe('bob'), petFriendly: 'yes' }))
  })

  it('taxonomy is limited to tags and areas', async () => {
    await assertSucceeds(setDoc(doc(bob(), 'taxonomy', 'tags'), { list: ['coffee', 'brunch'] }))
    await assertFails(setDoc(doc(bob(), 'taxonomy', 'other'), { list: [] }))
  })

  it('invite links: admin creates, one person redeems once, link is deleted', async () => {
    await assertFails(setDoc(doc(bob(), 'invites', TOKEN), invite('bob')))
    await assertFails(setDoc(doc(alice(), 'invites', 'short'), invite('alice')))
    await assertFails(setDoc(doc(alice(), 'invites', TOKEN), invite('alice', 60)))
    await assertSucceeds(setDoc(doc(alice(), 'invites', TOKEN), invite('alice')))
    await assertSucceeds(getDoc(doc(anon(), 'invites', TOKEN)))
    await assertFails(getDocs(collection(bob(), 'invites')))
    await assertSucceeds(getDocs(collection(alice(), 'invites')))

    // Can't join without using up the invite, as admin, or under a fake label.
    await assertFails(setDoc(doc(carol(), 'members', 'carol@example.com'), { role: 'member', invite: TOKEN, inviteLabel: 'for carol' }))
    const db = carol()
    const b = writeBatch(db)
    b.set(doc(db, 'members', 'carol@example.com'), { role: 'admin', invite: TOKEN, inviteLabel: 'for carol' })
    b.delete(doc(db, 'invites', TOKEN))
    await assertFails(b.commit())
    await assertFails(redeem(carol(), 'carol@example.com', 'carol', TOKEN, 'VIP'))
    // Can't just delete someone's invite without joining.
    await assertFails(deleteDoc(doc(carol(), 'invites', TOKEN)))
    // Unverified email can't redeem.
    await assertFails(redeem(as('eve', 'eve@example.com', false), 'eve@example.com', 'eve'))

    await assertSucceeds(redeem(carol(), 'carol@example.com', 'carol'))
    await assertSucceeds(setDoc(doc(carol(), 'cafes', 'c9'), cafe('carol')))
    // The link is gone, so a second use fails.
    const gone = await getDoc(doc(anon(), 'invites', TOKEN))
    if (gone.exists()) throw new Error('invite should be deleted after use')
    await assertFails(redeem(as('dan', 'dan@example.com'), 'dan@example.com', 'dan'))
  })

  it('expired, missing or revoked invites cannot be redeemed', async () => {
    await assertFails(redeem(carol(), 'carol@example.com', 'carol', 'tok_doesnotexist_000000000'))
    const EXPIRED = 'tok_expired_abcdefghijklmnop'
    await setDoc(doc(alice(), 'invites', EXPIRED), invite('alice', -1))
    await assertFails(redeem(carol(), 'carol@example.com', 'carol', EXPIRED))
    await setDoc(doc(alice(), 'invites', TOKEN), invite('alice'))
    await assertSucceeds(deleteDoc(doc(alice(), 'invites', TOKEN)))
    await assertFails(redeem(carol(), 'carol@example.com', 'carol'))
  })

  it('members rename only themselves, only the name', async () => {
    await assertSucceeds(updateDoc(doc(bob(), 'members', 'bob@example.com'), { displayName: 'Bobby' }))
    await assertFails(updateDoc(doc(bob(), 'members', 'bob@example.com'), { role: 'admin' }))
    await assertFails(updateDoc(doc(bob(), 'members', 'bob@example.com'), { displayName: '' }))
    await assertFails(updateDoc(doc(bob(), 'members', 'alice@example.com'), { displayName: 'not alice' }))
    // Renaming old visits: own visits only.
    await setDoc(doc(bob(), 'cafes', 'c1'), cafe('bob'))
    await setDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v1'), visit('bob'))
    await assertSucceeds(getDocs(query(collectionGroup(bob(), 'visits'), where('uid', '==', 'bob'))))
    await assertSucceeds(updateDoc(doc(bob(), 'cafes', 'c1', 'visits', 'v1'), { displayName: 'Bobby' }))
    await assertFails(updateDoc(doc(alice(), 'cafes', 'c1', 'visits', 'v1'), { displayName: 'x' }))
  })

  it('taxonomy is limited to tags and areas', async () => {
    await assertSucceeds(setDoc(doc(bob(), 'taxonomy', 'tags'), { list: ['coffee', 'brunch'] }))
    await assertFails(setDoc(doc(bob(), 'taxonomy', 'other'), { list: [] }))
  })

  it('invite links: admin creates, one person redeems once', async () => {
    await assertFails(setDoc(doc(bob(), 'invites', TOKEN), invite('bob')))
    await assertFails(setDoc(doc(alice(), 'invites', 'short'), invite('alice')))
    await assertSucceeds(setDoc(doc(alice(), 'invites', TOKEN), invite('alice')))
    await assertSucceeds(getDoc(doc(anon(), 'invites', TOKEN)))
    await assertFails(getDocs(collection(bob(), 'invites')))
    await assertSucceeds(getDocs(collection(alice(), 'invites')))

    // Can't make yourself a member without consuming the invite, or as admin.
    await assertFails(setDoc(doc(carol(), 'members', 'carol@example.com'), { role: 'member', invite: TOKEN }))
    const db = carol()
    const b = writeBatch(db)
    b.set(doc(db, 'members', 'carol@example.com'), { role: 'admin', invite: TOKEN })
    b.update(doc(db, 'invites', TOKEN), { usedBy: 'carol', usedByEmail: 'carol@example.com', usedAt: serverTimestamp() })
    await assertFails(b.commit())
    // Unverified email can't redeem.
    await assertFails(redeem(as('eve', 'eve@example.com', false), 'eve@example.com', 'eve'))

    await assertSucceeds(redeem(carol(), 'carol@example.com', 'carol'))
    await assertSucceeds(setDoc(doc(carol(), 'cafes', 'c9'), cafe('carol')))
    // Second use fails.
    await assertFails(redeem(as('dan', 'dan@example.com'), 'dan@example.com', 'dan'))
  })

  it('missing or revoked invite cannot be redeemed', async () => {
    await assertFails(redeem(carol(), 'carol@example.com', 'carol', 'tok_doesnotexist_000000000'))
    await setDoc(doc(alice(), 'invites', TOKEN), invite('alice'))
    await assertSucceeds(deleteDoc(doc(alice(), 'invites', TOKEN)))
    await assertFails(redeem(carol(), 'carol@example.com', 'carol'))
  })
})
