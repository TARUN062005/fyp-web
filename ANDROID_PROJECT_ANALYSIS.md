# ANDROID_PROJECT_ANALYSIS.md

**Project:** EmergencyDTN  
**Path:** `D:\finalyearproject`  
**Package / applicationId:** `com.fyp.emergencydtn`  
**Stack:** Kotlin, Jetpack Compose, Hilt, Room, WorkManager, Google Nearby Connections, BouncyCastle  
**Analysis date:** 2026-08-01  
**Scope:** Documentation only — no code was modified.

---

## Executive summary (integration-critical)

EmergencyDTN is a **single-module, offline-first DTN mesh Android app**. Peers discover and exchange messages over **Google Nearby Connections** using epidemic flooding. There is **no Retrofit, Ktor, OkHttp networking layer, and no backend HTTP client**. Authentication is **one-time Google Sign-In** followed by **local biometric unlock** of Keystore-wrapped Ed25519 keys. Cloud sync stubs exist but are empty.

Any Android ↔ Web integration must be designed from scratch on the Android side (HTTP client, JWT storage, upload workers, certificate verification). The web backend already exposes mobile APIs; this app does not call them yet.

**Stable local identity today:** `userId = hex(SHA-256(Google account id))`.  
**Human-facing ID:** `EDTN-XXXXX` derived from the Ed25519 public key.  
**Wire protocol types:** `KEY_EXCHANGE`, `TEXT`, `ACK`, `BROADCAST`.

---

## 1. Complete folder structure

Excludes: `.git/`, `build/`, `.gradle/`, `.idea/`, `local.properties`.

```
D:\finalyearproject\
├── .gitignore
├── build.gradle.kts                          # Root plugins (apply false)
├── settings.gradle.kts                       # Single module :app
├── gradle.properties
├── gradlew / gradlew.bat
├── gradle\
│   ├── libs.versions.toml                    # Version catalog
│   ├── gradle-daemon-jvm.properties          # JDK 21 toolchain
│   └── wrapper\gradle-wrapper.properties     # Gradle 9.5.0
└── app\
    ├── build.gradle.kts
    ├── .gitignore
    └── src\
        ├── main\
        │   ├── AndroidManifest.xml
        │   ├── keepRules\rules.keep
        │   ├── res\
        │   │   ├── values\{colors,strings,themes}.xml
        │   │   ├── xml\{backup_rules,data_extraction_rules}.xml
        │   │   ├── drawable\ic_launcher_{background,foreground}.xml
        │   │   ├── font\ibm_plex_{mono_regular,sans_*}.ttf
        │   │   ├── mipmap-*/ic_launcher*.webp
        │   │   └── mipmap-anydpi\ic_launcher*.xml
        │   └── java\com\fyp\emergencydtn\
        │       ├── EmergencyDtnApp.kt
        │       ├── MainActivity.kt
        │       ├── data\
        │       │   ├── auth\
        │       │   │   ├── BiometricAuthManager.kt
        │       │   │   ├── GoogleAuthProvider.kt
        │       │   │   └── TokenStorage.kt
        │       │   ├── local\
        │       │   │   ├── database\
        │       │   │   │   ├── AppDatabase.kt
        │       │   │   │   ├── Converters.kt
        │       │   │   │   ├── Migrations.kt
        │       │   │   │   ├── dao\
        │       │   │   │   │   ├── UserDao.kt
        │       │   │   │   │   ├── MessageDao.kt
        │       │   │   │   │   ├── BroadcastDao.kt
        │       │   │   │   │   ├── DeviceDao.kt
        │       │   │   │   │   ├── DeliveryStatusDao.kt
        │       │   │   │   │   ├── RoutingHistoryDao.kt
        │       │   │   │   │   ├── ConversationSummaryRow.kt
        │       │   │   │   │   ├── InboundTimestampRow.kt
        │       │   │   │   │   └── RoutingHistoryRouteSummary.kt
        │       │   │   │   └── entity\
        │       │   │   │       ├── UserEntity.kt
        │       │   │   │       ├── MessageEntity.kt
        │       │   │   │       ├── BroadcastEntity.kt
        │       │   │   │       ├── DeviceEntity.kt
        │       │   │   │       ├── DeliveryStatus.kt
        │       │   │   │       ├── DeliveryStatusEntity.kt
        │       │   │   │       └── RoutingHistoryEntity.kt
        │       │   │   └── datastore\
        │       │   │       ├── PreferencesDataStore.kt
        │       │   │       └── ChatReadStore.kt
        │       │   └── repository\          # STUBS
        │       │       ├── MessageRepositoryImpl.kt
        │       │       ├── BroadcastRepositoryImpl.kt
        │       │       ├── DeviceRepositoryImpl.kt
        │       │       └── RoutingRepositoryImpl.kt
        │       ├── di\
        │       │   ├── AppModule.kt              # STUB
        │       │   ├── AuthModule.kt             # Empty Hilt module
        │       │   ├── DatabaseModule.kt         # LIVE
        │       │   ├── DtnModule.kt              # Empty Hilt module
        │       │   └── RepositoryModule.kt       # STUB
        │       ├── domain\
        │       │   ├── model\                    # mostly stubs except UserSession
        │       │   ├── naming\NameResolver.kt
        │       │   ├── repository\               # STUBS
        │       │   └── usecase\
        │       │       ├── auth\
        │       │       ├── broadcast\
        │       │       ├── messaging\
        │       │       └── profile\
        │       ├── dtn\
        │       │   ├── discovery\
        │       │   ├── transport\NearbyTransport.kt
        │       │   ├── routing\
        │       │   ├── queue\OfflineMessageQueue.kt
        │       │   ├── forwarding\MessageForwarder.kt   # STUB
        │       │   └── messaging\
        │       ├── security\                     # Crypto + TOFU trust
        │       ├── services\
        │       │   ├── DiscoveryForegroundService.kt   # LIVE
        │       │   └── SyncService.kt                  # STUB
        │       ├── workers\
        │       │   ├── MessageRetryWorker.kt           # LIVE
        │       │   └── SyncWorker.kt                   # STUB
        │       ├── location\
        │       ├── notifications\
        │       ├── utils\
        │       └── presentation\
        │           ├── navigation\
        │           ├── theme\
        │           ├── components\
        │           ├── viewmodels\
        │           └── ui\{login,home,chat,broadcast,emergency,map,mesh,settings,debug,messaging,components}\
        ├── test\java\com\fyp\emergencydtn\...   # 11 unit/simulation tests
        └── androidTest\...\ExampleInstrumentedTest.kt
```

**Kotlin source count:** 170 `.kt` files (158 main + 11 unit tests + 1 instrumented test).

**Gradle modules:** only `:app` (`settings.gradle.kts`: `include(":app")`, root project name `EmergencyDTN`).

---

## 2. Gradle analysis

### 2.1 Root / settings / properties

| File | Role |
|------|------|
| `settings.gradle.kts` | Foojay toolchain resolver `1.0.0`; Google + Maven Central; single module `:app` |
| `build.gradle.kts` | Declares plugins with `apply false`: Android Application, Kotlin Compose, KSP, Hilt |
| `gradle.properties` | `-Xmx2048m`, `configuration-cache=true`, `kotlin.code.style=official`, `android.disallowKotlinSourceSets=false` (needed for KSP/Hilt on AGP 9) |
| Wrapper | **Gradle 9.5.0** |
| Daemon JVM | **JDK 21** toolchain (`gradle-daemon-jvm.properties`) |

### 2.2 App module (`app/build.gradle.kts`)

| Setting | Value |
|---------|-------|
| `namespace` / `applicationId` | `com.fyp.emergencydtn` |
| `minSdk` | 26 |
| `targetSdk` | 36 |
| `compileSdk` | 36 (minorApiLevel 1) |
| `versionCode` / `versionName` | 1 / `"1.0"` |
| Java compatibility | 11 |
| Compose | enabled |
| Release optimization / minify | **disabled** |

**Plugins applied:** `android.application`, `kotlin.compose`, `ksp`, `hilt.android`.

### 2.3 Version catalog (`gradle/libs.versions.toml`)

| Version key | Value | Purpose |
|-------------|-------|---------|
| `agp` | 9.3.1 | Android Gradle Plugin |
| `kotlin` | 2.2.10 | Kotlin + Compose compiler plugin |
| `ksp` | 2.2.10-2.0.2 | Room / Hilt annotation processing |
| `composeBom` | 2026.02.01 | Compose BOM |
| `coreKtx` | 1.10.1 | AndroidX Core KTX |
| `lifecycleRuntimeKtx` | 2.8.7 | Lifecycle + ViewModel Compose |
| `activityCompose` | 1.8.0 | Compose `ComponentActivity` / `FragmentActivity` host |
| `navigationCompose` | 2.8.5 | NavHost / typed routes |
| `room` | 2.7.2 | Local SQLite persistence |
| `datastore` | 1.1.1 | Preferences DataStore |
| `workManager` | 2.10.0 | Background message retry |
| `biometric` | 1.1.0 | BiometricPrompt |
| `playServicesNearby` | 19.3.0 | Nearby Connections P2P |
| `hilt` | 2.59.2 | Dependency injection |
| `hiltNavigationCompose` | 1.2.0 | `hiltViewModel()` + Hilt Work |
| `credentials` | 1.3.0 | Credential Manager (Google Sign-In) |
| `googleid` | 1.1.1 | Google ID token credential parsing |
| `securityCrypto` | 1.1.0-alpha06 | EncryptedSharedPreferences |
| `bouncycastle` | 1.78.1 | Ed25519 / X25519 (`bcprov-jdk18on`) |
| `fragment` | 1.8.6 | `FragmentActivity` for BiometricPrompt |
| `osmdroid` | 6.1.20 | Offline-capable OSM map |
| junit / espresso / androidx-junit | test stack | Unit + instrumented tests |

### 2.4 What each dependency group does

| Dependency group | Role in this app |
|------------------|------------------|
| Compose Material3 + icons + tooling | All UI screens and components |
| Navigation Compose | Screen graph (`AppNavGraph`) |
| Room + KSP | Entities / DAOs / migrations |
| DataStore Preferences | Emergency mode, chat read watermarks, KEY_CHANGE alerts |
| WorkManager + Hilt Work | `MessageRetryWorker` periodic / one-time queue flush |
| Biometric + Fragment | Unlock Keystore-wrapped session |
| Credentials + GoogleId | One-time Google account identity |
| Security Crypto | Encrypted local session preferences |
| BouncyCastle | Ed25519 keygen/sign/verify; X25519 ECDH seed derivation |
| Play Services Nearby | Advertise / discover / connect / payload transport |
| OSMdroid | Emergency map markers |
| Hilt | Constructor DI across app, services, workers, ViewModels |

### 2.5 Dependencies deliberately absent

- Retrofit, OkHttp, Ktor, Moshi, Gson (as HTTP stack)
- Firebase
- Google Maps SDK (OSMdroid used instead)
- Coil / Glide
- Certificate / PKI libraries (no X.509)
- Firebase Cloud Messaging

---

## 3. Android architecture

### 3.1 Package structure

```
com.fyp.emergencydtn
├── presentation/     # Compose UI, navigation, theme, ViewModels
├── domain/           # Use cases, naming; repository interfaces are stubs
├── data/             # Auth, Room, DataStore; repository impls are stubs
├── dtn/              # Discovery, transport, epidemic routing, codecs, queue
├── security/         # Keys, encrypt/sign, TOFU trust, key exchange
├── services/         # Foreground discovery service (+ sync stub)
├── workers/          # WorkManager (+ sync stub)
├── location/         # One-shot GPS for SOS
├── notifications/    # High-priority emergency alerts
├── di/               # Hilt modules
└── utils/            # Permissions, battery, stubs
```

### 3.2 Intended layers vs actual practice

**Intended (Clean Architecture-ish):**

```
presentation → domain use cases → data / dtn / security → Android platform
```

**Actual practice:**

- Auth, messaging send/receive, broadcast, and profile paths use **use cases**.
- Many ViewModels inject **DAOs, PeerDirectory, NearbyTransport, DataStore** directly.
- Repository interfaces and implementations are **comment-only stubs** and unused.
- DTN + security packages sit beside data/domain rather than behind a repository boundary.

### 3.3 Primary data flows

#### A. First-run authentication

```
LoginScreen
  → LoginViewModel
  → SignInUseCase.signInWithGoogle
  → GoogleAuthProvider (Credential Manager)
  → userId = SHA-256(googleId)
  → generate Ed25519 keypair
  → BiometricAuthManager encrypt Cipher
  → KeyManager wrap private key + session token
  → TokenStorage (EncryptedSharedPreferences)
  → UserEntity insert (packed ed|x public keys, emergencyId, fingerprint)
  → IdentityKeyHolder unlocked
  → KeyExchangeManager.onIdentityUnlocked()
  → navigate Home
```

#### B. Return authentication

```
GetSessionUseCase → NeedsBiometric
  → SignInUseCase.unlockWithBiometric
  → unwrap Keystore AES-GCM blob
  → load identity into IdentityKeyHolder
  → KeyExchangeManager.onIdentityUnlocked()
```

#### C. Mesh discovery / transport

```
HomeScreen grants permissions
  → start DiscoveryForegroundService (FGS connectedDevice)
  → NearbyDiscoveryManager advertise + discover (SERVICE_ID, P2P_CLUSTER)
  → NearbyTransport.requestConnection / auto-accept
  → KeyExchangeManager sends KEY_EXCHANGE
  → OfflineMessageQueue.processPending()
```

#### D. Encrypted 1:1 TEXT

```
Chat UI → SendMessageUseCase
  → Room MessageEntity PENDING (plaintext content locally)
  → SecureMessageService.prepareOutbound (encrypt + sign → OutboundWireCache)
  → OfflineMessageQueue
  → direct send if peer endpoint known, else EpidemicRouter flood
  → recipient ReceiveMessageUseCase (TOFU + decrypt)
  → ACK flood
  → sender marks DELIVERED
```

#### E. Broadcast / SOS

```
SendBroadcastUseCase
  → sign-only plaintext BroadcastEntity
  → also queued as MessageEntity with receiverId = bc:<meta...>
  → epidemic forward
  → ReceiveBroadcastUseCase → notify + relay
```

---

## 4. Authentication system

### 4.1 Current login flow

| Stage | Behavior |
|-------|----------|
| First launch | Google Credential Manager sign-in **once** |
| Identity derivation | `userId = SHA-256(GoogleIdTokenCredential.id)` as hex string |
| Key generation | BouncyCastle Ed25519; X25519 derived via `SHA-256(ed25519Private)` as seed |
| Seal | AES-256-GCM in Android Keystore alias `emergency_dtn_session_aes`, user-auth required; wraps `len‖privateKey‖sessionToken` |
| Persistence | EncryptedSharedPreferences file `emergency_dtn_secure_session` |
| Later opens | Offline biometric / device credential only — **Google is not called again** |
| Sign-out | `SignOutUseCase.kt` is a **stub** — logout not implemented |

### 4.2 Google auth

- File: `data/auth/GoogleAuthProvider.kt`
- Uses `GetGoogleIdOption` with `serverClientId` from `R.string.default_web_client_id`
- `setFilterByAuthorizedAccounts(false)`, `setAutoSelectEnabled(false)`
- Returns `GoogleAccountProfile(stableId, displayName, email?)`
- **ID token is never sent to a backend** — only the Google account `id` is hashed locally

Hardcoded client ID in `res/values/strings.xml`:

```xml
<string name="app_name">EmergencyDTN</string>
<string name="default_web_client_id">697389172841-h2rtu8f58i7blr20jb9farur6tpko9pr.apps.googleusercontent.com</string>
```

### 4.3 Biometric login

- File: `data/auth/BiometricAuthManager.kt`
- Authenticators: `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`
- CryptoObject used on API 30+
- Encryption path used at first Google sign-in; decryption path used on unlock
- `BiometricUnlockUseCase.kt` is a stub — real logic lives in `SignInUseCase.unlockWithBiometric`

### 4.4 Token storage

File: `data/auth/TokenStorage.kt`

| Method | Role |
|--------|------|
| `hasLocalSession()` | wrapped session present AND non-blank userId |
| `getUserId()` / `getDisplayName()` / `getWrappedSession()` | readers |
| `saveLocalSession(userId, displayName, wrappedSession)` | persist after first login |
| `updateDisplayName(displayName)` | profile edit |
| `hasCompletedGoogleSignIn()` | gate for UI |
| `clear()` | wipe prefs (not wired to a working sign-out flow) |

Prefs keys: `user_id`, `display_name`, `wrapped_session`, `google_sign_in_completed`.  
MasterKey + AES256_GCM EncryptedSharedPreferences.

### 4.5 Session model / UI states

- Domain: `UserSession(userId, displayName)`
- `GetSessionUseCase` → `SessionStatus` = `{ NoSession, LocalSessionExists }`
- `LoginUiState`: CheckingSession → NeedsGoogleSignIn | NeedsBiometric → Working → Authenticated | Error

---

## 5. Database analysis

### 5.1 Database config

| Item | Value |
|------|-------|
| Name | `emergency_dtn.db` |
| Version | **9** |
| `exportSchema` | `false` |
| Migrations present | `6→7`, `7→8`, `8→9` only |
| Fallback | `fallbackToDestructiveMigration(true)` for missing paths |

### 5.2 Entities and fields

#### `users` / `UserEntity`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String PK | SHA-256 of Google id for local user; peer userIds for TOFU pins |
| `displayName` | String | |
| `publicKey` | String | Packed `ed25519Base64|x25519Base64` |
| `createdAt` | Long | |
| `emergencyId` | String? | `EDTN-XXXXX` |
| `publicKeyFingerprint` | String | default `""` |
| `phoneNumber` | String? | |
| `emergencyContactNumber` | String? | |

#### `messages` / `MessageEntity`

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | String PK | |
| `senderId` | String | |
| `receiverId` | String | empty for ACK; `bc:...` for queued broadcasts |
| `messageType` | String | `TEXT` / `ACK` / `BROADCAST` |
| `content` | String | plaintext locally; wire may be `enc:v1:...` |
| `timestamp` | Long | |
| `ttl` | Long | |
| `signature` | String | |
| `hopCount` | Int | |
| `deliveryStatus` | DeliveryStatus | PENDING / SENT / DELIVERED / FAILED |
| `senderPublicKey` | String | Ed25519 |
| `senderX25519PublicKey` | String | |
| `isDeletedForMe` | Boolean | local soft-delete tombstone |

#### `broadcasts` / `BroadcastEntity`

| Field | Type | Notes |
|-------|------|-------|
| `broadcastId` | String PK | |
| `senderId` | String | |
| `content` | String | plaintext (sign-only on wire) |
| `timestamp` / `ttl` | Long | |
| `radius` | Double | default 500.0 meters |
| `signature` / `senderPublicKey` / `senderX25519PublicKey` | String | |
| `hopCount` | Int | |
| `severity` | String | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` |
| `latitude` / `longitude` | Double? | SOS telemetry |
| `batteryPercentage` | Int? | SOS telemetry |

#### `devices` / `DeviceEntity`

| Field | Type | Notes |
|-------|------|-------|
| `deviceId` | String PK | stable peer user id when known |
| `peerUserId` | String | |
| `displayName` | String | |
| `lastSeen` | Long | |
| `signalStrength` | Int | |
| `isTrusted` | Boolean | |
| `lastKnownLatitude` / `lastKnownLongitude` | Double? | from SOS shares |
| `lastLocationAt` | Long? | |

#### `routing_history` / `RoutingHistoryEntity`

| Field | Type |
|-------|------|
| `id` | Long PK autoGenerate |
| `messageId` | String |
| `fromDeviceId` | String |
| `toDeviceId` | String |
| `timestamp` | Long |

#### `delivery_status` / `DeliveryStatusEntity`

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | String PK | |
| `status` | DeliveryStatus | |
| `lastAttempt` | Long | |
| `retryCount` | Int | |

**Note:** DAO exists, but the main messaging path updates `messages.deliveryStatus` instead of this table.

### 5.3 Relationships

No Room `@ForeignKey` or `@Relation` annotations. Logical links only:

- messages ↔ users via `senderId` / `receiverId`
- broadcasts ↔ users via `senderId`
- routing_history ↔ message/broadcast id
- devices ↔ `peerUserId`

### 5.4 Migrations (exact SQL)

**6 → 7**

```sql
ALTER TABLE users ADD COLUMN emergencyId TEXT
ALTER TABLE users ADD COLUMN publicKeyFingerprint TEXT NOT NULL DEFAULT ''
ALTER TABLE users ADD COLUMN phoneNumber TEXT
ALTER TABLE users ADD COLUMN emergencyContactNumber TEXT
```

**7 → 8**

```sql
ALTER TABLE messages ADD COLUMN isDeletedForMe INTEGER NOT NULL DEFAULT 0
```

**8 → 9**

```sql
ALTER TABLE broadcasts ADD COLUMN latitude REAL
ALTER TABLE broadcasts ADD COLUMN longitude REAL
ALTER TABLE broadcasts ADD COLUMN batteryPercentage INTEGER
ALTER TABLE devices ADD COLUMN lastKnownLatitude REAL
ALTER TABLE devices ADD COLUMN lastKnownLongitude REAL
ALTER TABLE devices ADD COLUMN lastLocationAt INTEGER
```

### 5.5 High-signal DAO queries

- `MessageDao.observeThread`, `getConversationSummaries`, `countUnreadFromPeer`, `getPendingRetryMessagesOnce`, soft-delete helpers
- `BroadcastDao.getActiveBroadcasts(now)`
- `RoutingHistoryDao.getHistoryForMessageOnce` + `getRouteSummary` / `RouteChainBuilder`
- Unread count from SQL is effectively a placeholder (often 0); ViewModels recompute unread via `ChatReadStore`

---

## 6. Networking

### 6.1 HTTP / REST

**None.**

- No Retrofit / Ktor / OkHttp client modules
- `INTERNET` permission exists for Google Sign-In / Credential Manager / Play Services
- `SyncService.kt` and `SyncWorker.kt` are comment-only stubs

### 6.2 Interceptors

Not applicable — no HTTP stack.

### 6.3 External non-HTTP services used

1. **Google Credential Manager / Google ID** — first-launch interactive sign-in
2. **Google Play Services Nearby Connections** — advertise / discover / connect / byte payloads

---

## 7. DTN system

### 7.1 Transport (`NearbyTransport`)

- Wraps Nearby `ConnectionsClient`
- Auto-accepts incoming connections
- Exposes `incomingPayloads` flow and `connectedEndpoints: StateFlow<Set<String>>`
- Sends raw byte arrays to endpoint IDs

### 7.2 Discovery (`NearbyDiscoveryManager`)

| Constant | Value |
|----------|-------|
| `SERVICE_ID` | `com.fyp.emergencydtn.nearby` |
| Strategy | `Strategy.P2P_CLUSTER` |
| Endpoint name format | `displayName::userId` (`PeerDirectory`) |

Advertises and discovers simultaneously; requests connections to discovered peers.

`PeerDiscoveryManager.kt` is a stub (unused).

### 7.3 Routing (`EpidemicRouter`)

| Rule | Value |
|------|-------|
| Algorithm | Epidemic flood to all connected endpoints |
| Max hop count | **5** |
| TTL | drop if `now > timestamp + ttl` |
| Trust before forward | TOFU verify via `SecureMessageService` / `PeerTrustPolicy` |
| History | inserts `RoutingHistoryEntity` on successful forward |
| Dedupe | `DuplicateFilter` — max 2000 seen messageIds; max 8000 (messageId, endpoint) forward pairs |

Key methods:

- `forwardToConnectedPeers(message, excludeEndpointId?, incrementHop = true)`
- `forwardBroadcast(broadcast, ...)`
- `isExpired(...)`, `isForLocalUser(message)`

### 7.4 Message flow (wire protocol)

| `messageType` | Codec | Content | Crypto |
|---------------|-------|---------|--------|
| `KEY_EXCHANGE` | JSON in `KeyExchangeManager` | userId, displayName, ed25519, x25519, timestamp, signature | Ed25519 sign of `userId\|ed\|x\|timestamp` |
| `TEXT` | `MessagePayloadCodec` | encrypted body `enc:v1:<iv>:<ct>` | X25519 ECDH → AES-GCM + Ed25519 sign |
| `ACK` | `MessagePayloadCodec` | `content` = original `messageId` | sign-only |
| `BROADCAST` | `BroadcastPayloadCodec` | plaintext + severity + optional SOS telemetry | sign-only |

#### TEXT / ACK JSON fields (encode always)

`messageId`, `senderId`, `receiverId`, `messageType`, `content`, `timestamp`, `ttl`, `signature`, `hopCount`, `deliveryStatus`, `senderPublicKey`, `senderX25519PublicKey`

Canonical TEXT signature fields:  
`messageId|senderId|receiverId|messageType|content|timestamp|ttl`  
(**hopCount is not signed**)

#### BROADCAST JSON fields

Always: `messageType`, `broadcastId`, `senderId`, `content`, `timestamp`, `ttl`, `radius`, `signature`, `senderPublicKey`, `senderX25519PublicKey`, `hopCount`, `severity`  
Optional if non-null: `latitude`, `longitude`, `batteryPercentage`

Detection: `messageType == "BROADCAST"`.

#### KEY_EXCHANGE JSON fields

`messageType`, `userId`, `displayName`, `ed25519PublicKey`, `x25519PublicKey`, `timestamp`, `signature`

### 7.5 Incoming dispatch (`IncomingMessageRouter`)

```
when {
  KeyExchangeManager.isKeyExchangePayload(bytes) → keyExchangeManager.handleIncoming(...)
  BroadcastPayloadCodec.isBroadcastPayload(bytes) → receiveBroadcastUseCase(...)
  else → receiveMessageUseCase(...)  // TEXT / ACK
}
```

### 7.6 Offline queue

- `OfflineMessageQueue` retries PENDING TEXT/BROADCAST on peer connect and via WorkManager
- Broadcasts mapped into message queue via `BroadcastRoutingMapper`  
  `receiverId = bc:<radius>:<severity>:<lat>:<lng>:<battery>`
- Default TTL for TEXT/ACK/Broadcast: **24 hours**
- Default broadcast radius: **500.0 meters**

### 7.7 Encryption and certificates

**There is no X.509 / CA / certificate PKI in the Android app.**

Trust model is **TOFU** (Trust On First Use):

| Component | Role |
|-----------|------|
| `KeyManager` | Keystore AES wrap + Ed25519 generation |
| `IdentityKeyHolder` | In-memory unlocked keys (lost on process death until biometric unlock) |
| `IdentityDisplayIds` | `EDTN-*` + fingerprint helpers |
| `EncryptionService` | X25519 ECDH + AES-GCM (`enc:v1:`) |
| `SignatureService` | Ed25519 sign/verify |
| `SecureMessageService` | prepareOutbound / signed broadcast / verify |
| `KeyExchangeManager` | Nearby KEY_EXCHANGE advertise/handle |
| `PeerKeyStore` | Pin store + KEY_CHANGE alerts |
| `PeerTrustPolicy` / `PeerTrustResult` | FirstContact / Matched / Rejected |
| `ReplayGuard` | clock skew 5 min; TTL; max age 7 days; dedupe |
| `OutboundWireCache` | Encrypted wire copies for retry without re-encrypt issues |

Reject reasons include: `INVALID_FIRST_CONTACT`, `INVALID_SIGNATURE`, `KEY_CHANGE`.  
KEY_CHANGE alerts persist in DataStore; UI can acknowledge or accept claimed key.

### 7.8 Emergency mode loop

`DiscoveryForegroundService` every **60 seconds** when emergency mode is on:

1. Refresh discovery
2. One-shot GPS (`LocationProvider`)
3. Read battery (`BatteryReader`)
4. Send distress broadcast

Distress content: `"EMERGENCY DISTRESS — needs assistance"`  
Severity: `CRITICAL`  
SOS countdown in UI: **4 seconds** (`EmergencyViewModel`)

---

## 8. UI analysis

### 8.1 Screens and routes

| Route constant | Path | Screen |
|----------------|------|--------|
| `Login` | `login` | `LoginScreen` |
| `Home` | `home` | `HomeScreen` |
| `MeshGraph` | `mesh_graph` | `MeshGraphScreen` |
| `Chat` | `chat` | `ChatListScreen` |
| `ChatDetail` | `chat/{peerId}` | `ChatDetailScreen` |
| `Broadcast` | `broadcast` | `BroadcastScreen` |
| `Emergency` | `emergency` | `EmergencyScreen` |
| `EmergencyMap` | `emergency/map` | `MapScreen` (OSMdroid) |
| `Settings` | `settings` | `SettingsScreen` |
| `DatabaseDebug` | `database_debug` | `DatabaseDebugScreen` |

Bottom bar destinations (`AppDestination` / `bottomBarRoutes`): Home, Chat, Alerts (Broadcast), SOS (Emergency), Settings.

Secondary (no primary tab): Mesh graph, chat detail, emergency map, database debug.

Auth gate: start at Login; bottom nav never shown before Authenticated; back stack never returns to Login after success.

`MessagingScreen` / `MessagingViewModel` are stubs (superseded by Chat*).  
`PlaceholderScreen` is a generic placeholder component.

### 8.2 Navigation graph behavior (`AppNavGraph`)

- `startDestination = Routes.Login`
- Scaffold + snackbar host + conditional bottom bar
- Bottom bar hidden when Emergency SOS is focused
- Bottom bar also visible on chat routes, emergency map, mesh graph
- Tab navigation: `popUpTo(Home) { saveState=true }`, `launchSingleTop`, `restoreState`
- Login → Home pops Login inclusive
- `NavGraph.kt` is a thin wrapper calling `AppNavGraph`

### 8.3 ViewModels

| ViewModel | Role |
|-----------|------|
| `LoginViewModel` | Session check / Google / biometric |
| `HomeViewModel` | Mesh strip, peers, recent msgs/broadcasts, emergency toggle, battery, KEY_CHANGE ids |
| `ChatListViewModel` | Conversation summaries + unread via `ChatReadStore` |
| `ChatViewModel` | Thread, send, search, soft-delete, peer key-change alert |
| `BroadcastViewModel` | Compose + feed + route summary + severity filter |
| `EmergencyViewModel` | SOS countdown, distress send, emergency mode timeline |
| `MapViewModel` | Markers (Self / Peer / Sos) from device lastKnown + broadcasts |
| `MeshGraphViewModel` | Mesh node graph model |
| `SettingsViewModel` | Profile edit, theme, biometric re-check, emergency mode |
| `DatabaseDebugViewModel` | Room table inspection |
| `MessagingViewModel` | Stub |

### 8.4 Theme / components (summary)

- Fonts: IBM Plex Sans / Mono (bundled TTFs)
- Theme tokens: Color, Type, Spacing, Shape, Elevation, StatusColors
- Theme preference: System / Light / Dark (`ThemePreference`)
- Notable components: `BottomNavigationBar`, `TopAppBar`, `DeviceCard`, `BroadcastCard`, `MessageBubble`, `MessageComposer`, `MeshPulseStrip`, `NodeGraphView`, `PeerProfileSheet`, `IdentityWarningBanner`, `ErrorBanner`, `PrimaryActionButton`, `StatusBadge`, `EmergencyCard`, `SkeletonLoader`, `AppSnackbarHost`, etc.

---

## 9. Background processing

| Component | Status | Behavior |
|-----------|--------|----------|
| `DiscoveryForegroundService` | **Live** | FGS type `connectedDevice`; discovery, router, queue, key exchange, emergency loop |
| `MessageRetryWorker` | **Live** | Periodic every **15 minutes** + one-time on peer connect; calls `OfflineMessageQueue.processPending()` |
| `EmergencyDtnApp` | **Live** | `@HiltAndroidApp`; implements `Configuration.Provider` with `HiltWorkerFactory`; schedules periodic retry; disables default WorkManager initializer in manifest |
| `SyncWorker` | **Stub** | No cloud sync |
| `SyncService` | **Stub** | No cloud sync |

### Manifest highlights

**Permissions:** INTERNET, USE_BIOMETRIC, BLUETOOTH (+ADMIN maxSdk 30), BLUETOOTH_ADVERTISE/CONNECT/SCAN, ACCESS_WIFI_STATE, CHANGE_WIFI_STATE, ACCESS_COARSE/FINE_LOCATION, NEARBY_WIFI_DEVICES, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CONNECTED_DEVICE, POST_NOTIFICATIONS.

**Components:**

- Activity: `MainActivity` (launcher, exported)
- Service: `DiscoveryForegroundService` (not exported, `foregroundServiceType=connectedDevice`)
- Provider: androidx Startup with WorkManagerInitializer **removed** (custom Hilt WM config)

---

## 10. Complete API list

### 10.1 HTTP REST endpoints used by the app

**Empty.** No base URL, no `@GET`/`@POST`, no cloud sync calls.

### 10.2 External platform APIs

1. Google Credential Manager / Google ID Sign-In (first launch)
2. Google Nearby Connections (mesh)

### 10.3 P2P wire “API” (integration contract for mesh)

| Type | Direction | Purpose |
|------|-----------|---------|
| `KEY_EXCHANGE` | bidirectional on connect | Advertise identity + public keys |
| `TEXT` | peer → peer (possibly multi-hop) | Encrypted chat |
| `ACK` | recipient → network | Delivery receipt (`content` = original messageId) |
| `BROADCAST` | origin → epidemic | Signed alert / SOS |

Nearby service discovery ID: **`com.fyp.emergencydtn.nearby`**.

---

## 11. File-by-file explanation

### 11.1 App entry / DI

| Path | Purpose |
|------|---------|
| `EmergencyDtnApp.kt` | Hilt app; WorkManager config; schedule periodic retry |
| `MainActivity.kt` | `FragmentActivity`; theme + `AppNavGraph` |
| `di/DatabaseModule.kt` | Room builder, DAO providers, migrations |
| `di/AuthModule.kt` | Empty module (constructors use `@Inject`) |
| `di/DtnModule.kt` | Empty module |
| `di/AppModule.kt` | Stub |
| `di/RepositoryModule.kt` | Stub |

### 11.2 Auth

| Path | Purpose |
|------|---------|
| `data/auth/GoogleAuthProvider.kt` | Credential Manager Google sign-in |
| `data/auth/TokenStorage.kt` | Encrypted session prefs |
| `data/auth/BiometricAuthManager.kt` | BiometricPrompt + Cipher |
| `domain/usecase/auth/SignInUseCase.kt` | First login + biometric unlock pipeline |
| `domain/usecase/auth/GetSessionUseCase.kt` | Session presence check |
| `domain/usecase/auth/SignOutUseCase.kt` | Stub |
| `domain/usecase/auth/BiometricUnlockUseCase.kt` | Stub |
| `domain/model/UserSession.kt` | Session DTO |
| `domain/model/User.kt` | Stub |

### 11.3 Database / DataStore

| Path | Purpose |
|------|---------|
| `AppDatabase.kt` | v9, 6 entities |
| `Migrations.kt` | 6→7, 7→8, 8→9 |
| `Converters.kt` | DeliveryStatus enum converters |
| `entity/*` | Schema (§5) |
| `dao/*` | CRUD + chat/broadcast/routing queries |
| `dao/RoutingHistoryRouteSummary.kt` | Route summary builders |
| `datastore/PreferencesDataStore.kt` | Emergency mode + KEY_CHANGE persistence |
| `datastore/ChatReadStore.kt` | Per-peer last-read watermarks |

### 11.4 Repositories (all stubs)

`domain/repository/*` and `data/repository/*` — comments only; unused by live paths.

### 11.5 Domain use cases (live unless noted)

| File | Role |
|------|------|
| `SendMessageUseCase` | Create TEXT, prepareOutbound, enqueue |
| `ReceiveMessageUseCase` | Decode, TOFU, decrypt/ACK/relay |
| `AckMessageUseCase` | Mark original DELIVERED |
| `ClearChatUseCase` / `DeleteMessageForMeUseCase` | Soft-delete |
| `GetMessagesUseCase` | Stub |
| `SendBroadcastUseCase` / `ReceiveBroadcastUseCase` / `GetBroadcastsUseCase` | Broadcast pipeline |
| `EditProfileUseCase` | Local profile + refresh Nearby endpoint name |
| `NameResolver.kt` | userId → displayName / emergencyId |

### 11.6 DTN

| File | Role |
|------|------|
| `NearbyTransport.kt` | Payload I/O + connection set |
| `NearbyDiscoveryManager.kt` | Advertise/discover/auto-connect |
| `PeerDirectory.kt` | endpoint ↔ userId maps |
| `PeerDiscoveryManager.kt` | Stub |
| `EpidemicRouter.kt` | Flood + history |
| `DuplicateFilter.kt` | Dedupe |
| `BroadcastRouteSummary.kt` | UI route helper |
| `OfflineMessageQueue.kt` | Pending retry |
| `IncomingMessageRouter.kt` | Type dispatch |
| `MessagePayloadCodec.kt` / `BroadcastPayloadCodec.kt` | JSON encode/decode |
| `BroadcastRoutingMapper.kt` | Broadcast ↔ queue MessageEntity |
| `MessageForwarder.kt` | Unused stub object |

### 11.7 Security

| File | Role |
|------|------|
| `KeyManager.kt` | Keystore AES + Ed25519 gen + wrap |
| `IdentityKeyHolder.kt` | RAM unlocked keys |
| `IdentityDisplayIds.kt` | EDTN + fingerprint |
| `EncryptionService.kt` | X25519 + AES-GCM |
| `SignatureService.kt` | Ed25519 |
| `SecureMessageService.kt` | Outbound/inbound crypto orchestration |
| `KeyExchangeManager.kt` | Nearby KEY_EXCHANGE |
| `PeerKeyStore.kt` | Pins + alerts |
| `PeerTrustPolicy.kt` / `PeerTrustResult.kt` | Trust outcomes |
| `ReplayGuard.kt` | Freshness + dedupe |
| `OutboundWireCache.kt` | Encrypted wire cache |

### 11.8 Services / workers / location / notifications / utils

| File | Role |
|------|------|
| `DiscoveryForegroundService.kt` | FGS mesh + emergency loop |
| `SyncService.kt` / `SyncWorker.kt` | Stubs |
| `MessageRetryWorker.kt` | Queue flush worker |
| `LocationProvider.kt` / `LocationFix.kt` | One-shot SOS GPS |
| `EmergencyNotificationManager.kt` | High-priority broadcast alerts |
| `PermissionHelper.kt` | Nearby + location + notifications |
| `BatteryReader.kt` | Battery % for SOS |
| `Constants.kt` / `Result.kt` / `Extensions.kt` | Stubs |

### 11.9 Presentation screens

| Screen | VM | Notes |
|--------|----|-------|
| `LoginScreen` | Login | Brand + Google / Unlock |
| `HomeScreen` | Home | Mesh health, peers, shortcuts; starts FGS after permissions |
| `ChatListScreen` / `ChatDetailScreen` | ChatList / Chat | Conversations + composer |
| `BroadcastScreen` | Broadcast | Feed + compose alerts |
| `EmergencyScreen` | Emergency | SOS countdown / mode |
| `MapScreen` | Map | OSMdroid markers |
| `MeshGraphScreen` | MeshGraph | Mesh topology UI |
| `SettingsScreen` | Settings | Profile, theme, biometric, debug entry |
| `DatabaseDebugScreen` | DatabaseDebug | Dev inspection |
| `MessagingScreen` | Messaging | Stub |

### 11.10 Tests

1. `ExampleUnitTest.kt`
2. `RoutingHistoryRouteSummaryTest.kt`
3. `BroadcastEpidemicRoutingTest.kt`
4. `BroadcastSignOnlyTest.kt`
5. `BroadcastRouteSummaryTest.kt`
6. `DuplicateFilterTest.kt`
7. `RelayVerifyBeforeForwardTest.kt`
8. `IdentityDisplayIdsTest.kt`
9. `PeerKeyChangeAlertContractTest.kt`
10. `PeerTrustPolicyTest.kt`
11. `MeshEndToEndSimulationTest.kt`
12. `ExampleInstrumentedTest.kt` (androidTest)

### 11.11 Complete stub inventory (27+)

Comment-only or unused stubs:

1. `BroadcastRepositoryImpl.kt`
2. `DeviceRepositoryImpl.kt`
3. `MessageRepositoryImpl.kt`
4. `RoutingRepositoryImpl.kt`
5. `AppModule.kt`
6. `RepositoryModule.kt`
7. `domain/model/Broadcast.kt`
8. `domain/model/DeliveryStatus.kt`
9. `domain/model/Message.kt`
10. `domain/model/RoutingHistory.kt`
11. `domain/model/User.kt`
12. `domain/repository/BroadcastRepository.kt`
13. `domain/repository/DeviceRepository.kt`
14. `domain/repository/MessageRepository.kt`
15. `domain/repository/RoutingRepository.kt`
16. `BiometricUnlockUseCase.kt`
17. `SignOutUseCase.kt`
18. `GetMessagesUseCase.kt`
19. `PeerDiscoveryManager.kt`
20. `MessagingScreen.kt`
21. `MessagingViewModel.kt`
22. `SyncService.kt`
23. `Constants.kt`
24. `Extensions.kt`
25. `Result.kt`
26. `SyncWorker.kt`
27. `MessageForwarder.kt` (empty object)

Plus empty Hilt modules: `AuthModule.kt`, `DtnModule.kt`.

---

## 12. Missing pieces and technical debt

1. **No cloud/web API layer** — Android↔Web sync (auth, upload, download, identity registry) must be invented on the app side.
2. **Google ID token never verified server-side** — identity is a local hash; spoofable if a future API trusts client-supplied `userId` without Google verification.
3. **Identity mismatch risk with web backend** — Android uses `SHA-256(googleId)` as `userId`; web backend uses Mongo `User._id` and `emergencyId` / `googleAccountId`. Integration must map these carefully.
4. **No sign-out / account wipe** — Keystore material, Room, and prefs survive.
5. **Repository layer abandoned** — ViewModels talk to DAOs; harder to share logic with a future sync layer.
6. **Many skeleton files** — Sync*, Messaging*, domain models, Constants, Result, PeerDiscoveryManager, MessageForwarder, AppModule, RepositoryModule.
7. **Incomplete migrations** — only 6→9; destructive fallback wipes DB on older upgrades; `exportSchema=false`.
8. **`delivery_status` table underused** — status lives on `messages`.
9. **TOFU, not certificates** — Android does not yet verify server-issued Ed25519 IdentityCertificates from the web backend.
10. **Broadcasts are plaintext on the wire** — intentional for SOS readability; privacy tradeoff.
11. **ACK `receiverId` empty** — epidemic ACK may be noisy; ACK fails if original message is not local.
12. **Hardcoded OAuth Web client ID** committed in `strings.xml`.
13. **Release minify off**; `security-crypto` still alpha.
14. **Process death locks crypto** — keys only in RAM (`IdentityKeyHolder`); outbound encrypt/sign requires unlock.
15. **No multi-module / shared schema package** with the web project.
16. **Unread SQL placeholder** — ViewModel recomputes via DataStore.
17. **No device registration / JWT / refresh token storage** for backend sessions.
18. **No upload path** for SOS/broadcasts when connectivity to the internet returns.
19. **No cluster pull UI** — web clusters API unused.
20. **Destructive Room fallback + no backend** = local data loss with no recovery channel.

---

## Integration notes for a future Android ↔ Web bridge

### What the web backend already expects (not implemented in app)

- `POST /auth/google` with Google `idToken` + device `publicKey`
- Mobile JWT access/refresh tokens
- `POST /sos/upload` or `POST /broadcast/upload` with Mongo ObjectId sender/uploader fields
- Bake `cert-signing-public.pem` and verify `IdentityCertificate`
- Headers `Authorization: Bearer`, optional `X-Device-Id`, `X-App-Version`

### What Android already has that can be reused

- Google Sign-In client ID (must match backend `GOOGLE_CLIENT_ID`)
- Ed25519 + X25519 keypair model and packed public key format
- `emergencyId` / fingerprint generators (`IdentityDisplayIds`)
- Broadcast severity enum and SOS telemetry fields (lat/lng/battery)
- Wire JSON shapes for mesh (separate from HTTP DTOs)
- WorkManager / FGS patterns that could host an online sync worker
- Empty `SyncWorker` / `SyncService` placeholders as natural insertion points

### Minimum new Android surface

1. HTTP client + base URL config
2. Exchange Google ID token with backend; store JWT pair securely
3. Map local `userId` ↔ backend profile (`emergencyId`, Mongo `_id`)
4. Verify / store IdentityCertificate
5. When online, upload SOS/broadcast reports with stable `messageId` idempotency
6. Optionally pull clusters for map/admin-aligned situational awareness
7. Implement real `SignOutUseCase` (revoke refresh + clear local secrets)

---

*End of ANDROID_PROJECT_ANALYSIS.md*
