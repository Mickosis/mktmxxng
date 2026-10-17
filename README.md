# MKTMXXNG

Makatimaxxing: a shared list of Makati cafes. Tag them (coffee, matcha, pastries, restaurant, or your own tags), file them by area, and print a random pick when you can't decide. "Matcha in Legazpi Village" gets you one place. Log each visit with a star rating and what you ordered, and the app remembers the best things to get.

Live at https://mickosis.github.io/mktmxxng/

- Anyone can browse and roll.
- Invited members (Google or email-link sign-in) add cafes and log visits.
- The admin invites members from the Members page.

## Stack

Vite + React + TypeScript, Firebase Auth + Firestore (free Spark plan), hosted on GitHub Pages, installable as a PWA.

## Develop

```sh
npm install
npm run dev
```

To run against local emulators (needs Java), start `npx firebase-tools emulators:start --only firestore,auth --project demo-mktmxxng`, then run `VITE_USE_EMULATORS=true npm run dev`.

Security rules tests:

```sh
npm run test:rules
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml`. Firestore rules deploy separately:

```sh
npx firebase-tools deploy --only firestore:rules
```

## First run

Sign in on the live site, then tap **Claim admin**. Only the first person can do this. After that, invite people from **Members**.
