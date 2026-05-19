# Google Authentication Setup

ReflectFlow now supports Firebase Google sign-in alongside email/password auth.

In Firebase Console:

1. Open Authentication > Sign-in method.
2. Enable Google as a provider and save it.
3. Open Authentication > Settings > Authorized domains.
4. Add every deployed domain that will use Google sign-in, including your Vercel production domain and any preview domains you trust.

Local development normally uses `localhost`, which Firebase includes by default. The Firestore profile write is stored at `users/{uid}/profile/main`, with a compatibility merge on `users/{uid}` for existing app data.
