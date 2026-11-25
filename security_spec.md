# Maloxie Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict User Ownership & Verification**: Every document in `/users/{userId}` and its subcollections (`workouts`, `templates`, `exercises`, `prs`, `measurements`, `goals`, `programs`) belongs exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Parent Existence (Master Gate)**: No subcollection record (`workouts`, `templates`, `exercises`, `prs`, `measurements`, `goals`, `programs`) may be created unless the parent `/users/{userId}` profile document exists.
3. **Immutable Ownership & Creation Timestamps**: `userId`/`uid` and `createdAt` cannot be modified after creation. All server-tracked `createdAt` and `updatedAt` fields must equal `request.time`.
4. **Bounded Payloads & Valid IDs**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), all strings enforce explicit `.size()` bounds, and all arrays (`warmupItems`, `exercises`, `weeks`) enforce bounded `.size()` caps and element type checks.
5. **No Shadow Fields**: Every create checks `hasAll(...) && hasOnly(...)` and every update enforces `affectedKeys().hasOnly(...)` alongside full entity validation.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Workout Create**: `auth = null` writing `/users/u1/workouts/w1`.
2. **Unverified Email Write**: `auth = { uid: 'u1', token: { email_verified: false } }` creating `/users/u1`.
3. **Cross-User Read/List**: `u2` attempting `get` or `list` on `/users/u1/workouts`.
4. **Blanket User Listing**: Any signed-in user calling `list` on `/users`.
5. **Identity Spoofing in Payload**: `u1` creating `/users/u1/workouts/w1` with `userId: 'u2'`.
6. **Shadow Field Injection (Create)**: `u1` creating `/users/u1` with an extra field `{ isAdmin: true }`.
7. **Shadow Field Injection (Update)**: `u1` updating `/users/u1/goals/g1` with `{ bonusPoints: 999 }`.
8. **ID Poisoning**: `u1` writing `/users/u1/workouts/bad$id..slash` or a 300-char ID.
9. **Client Timestamp Forgery**: `u1` creating a workout with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
10. **Immutable Field Tampering**: `u1` updating `/users/u1/workouts/w1` and altering `createdAt` or `userId`.
11. **Array Exhaustion / Type Poisoning**: `u1` creating a workout with 50 exercises (`> 30`) or `exercises: ["not-a-map"]`.
12. **Out-of-Range Telemetry**: `u1` logging `energyLevel: 99` or `sleepQuality: 0` or `date: "invalid-date"`.
