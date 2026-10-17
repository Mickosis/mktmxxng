import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { firebaseConfig } from './firebase-config'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

export const db = initializeFirestore(
  app,
  useEmulators ? {} : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
