# N1777 — Flutter/Dart: Piano di lavoro 2026/27
> **Vanilla only. No bullshit libraries.**
> Sorgente primaria: sprint N1777 | Coordinatore: neo1777
> Contesto: ristrutturazione sync fine giugno 2026
> Aggiornato: 2026-06-01

---

## 1. Cosa abbiamo costruito finora

### 1.1 Pipeline HTML → NotebookLM

Script deterministico: `scripts/html_to_notebooklm.py`
Sorgenti HTML (root + ricorsione non-infinita) → classifica (documenti vs UI) → dedup by md5 → converti (.md con html2text, .png con Chrome headless) → verifica contenuti.

- 24 artifact generati in `converted_for_notebooklm/` (27 sorgenti - 3 React kits saltati)
- `html_originali/` contiene gli HTML sorgenti piatti e dedupati
- `scraps/` e `uploads/` lasciati intatti (sono asset immagine utilizzati)
- Verifica: conteggi precisi, validità PNG (byte + formato), header YAML markdown, no stray files

Pattern: 1 dipendenza python (html2text) + Chrome headless già installato sul sistema.
Dedup per contenuto hash (md5), non per nome file — evita duplicati silenziosi.

### 1.2 Dashboard Preview

File: `converted_for_notebooklm/n1777-preview.html`
Dashboard desktop dark theme, layout sidebar + main content + right panel. Usa come riferimento N1777 Design System e i cowork screenshot.

**Design tokens estratti e formalizzati:**

| Token | Valore | Uso |
|-------|--------|-----|
| `--bg-app` | `#0a0a0c` | sfondo root |
| `--bg-surface` | `#151518` | sidebar, topbar |
| `--bg-card` | `#1a1a1f` | card, pannelli |
| `--bg-elevated` | `#212127` | hover, stati attivi |
| `--border` | `#252530` | bordi default |
| `--border-active` | `#35354a` | bordi focus |
| `--text-primary` | `#eeeef0` | testo principale |
| `--text-secondary` | `#9a9aa6` | testo secondario |
| `--text-muted` | `#5c5c6a` | timestamp, meta info |
| `--brass` | `#c9a227` | accent primario, brand, CTA |
| `--brass-hover` | `#d4af37` | hover brass |
| `--brass-dim` | `rgba(201,162,39,0.14)` | background brass |
| `--ink-red` | `#ef4444` | errori, negative |
| `--ink-green` | `#22c55e` | successo, positivo |
| `--ink-blue` | `#3b82f6` | info, link |
| `--ink-purple` | `#a855f7` | accent secondario |
| `--radius` | `16px` | card, pannelli |
| `--radius-sm` | `10px` | chip, bottoni piccoli |
| `--font-sans` | Inter 300-700 | UI moderna |
| `--font-mono` | JetBrains Mono 400-500 | codice, dati |
| `--font-serif` | Newsreader 300-400 | documentazione |

**Tipografia:**
- Inter: pesi 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- JetBrains Mono: 400 (regular), 500 (medium) — per codice e dati tecnici
- Newsreader: 300, 400 — per contenuti lunghi e documentazione
- Line-height: 1.55-1.7 per corpo testo, 1.2 per titoli
- Letter-spacing: -0.02em / -0.03em / -0.04em per titoli (più stretti = più moderno)

**Componenti previewed:**
- Sidebar: logo, nav group con badge, user card
- Topbar: breadcrumb, search box, icon buttons (notifiche, calendario)
- Stats row: 4 stat card (proposte attive, voti totali, quorum medio, tasso successo)
- Tabs: Tutte / In votazione / In revisione / Chiuse
- Proposals table: avatar iniziali, titoli, meta info, tag colorati, voti, status dot
- Right panel: info sistema (uptime, deploy, versione), attività recente con timeline, prossime scadenze
- Font picker sticky: toggle Inter / Mono / Serif

---

## 2. Flutter — Timeline ufficiale e roadmap

### 2.1 Releases shipped (2025-2026)

| Release | Data | Dart | Key features |
|---------|------|------|-------------|
| 3.35 | Ago 2025 | 3.9 | Hot reload web (no flag), Widget Previewer, Create with AI |
| 3.38 | Nov 2025 | 3.10 | Dot shorthands, analyzer plugins, build hooks stabili, UIScene, Material 3 exp progressivo |
| 3.41 | Feb 2026 | 3.11 | Public Windows release, Material/Cupertino decoupling avviato, SDF fragment shader, content-sized views Linux |
| 3.44 | Mag 2026 | 3.12 | **HCPP Android**, **SwiftPM default iOS/macOS**, **GenUI SDK**, **Agentic Hot Reload**, **Canonical desktop steward**, **Material/Cupertino freeze** |

### 2.2 Roadmap 2026-2027 (da github.com/flutter/flutter Roadmap.md)

| Release | Target | Branch cutoff |
|---------|--------|---------------|
| 3.47 | Agosto 2026 | 2026-07-07 |
| 3.50 | Novembre 2026 | 2026-10-06 |
| 3.53 | Feb 2027 | 2027-01-05 |
| 3.56 | Mag 2027 | 2027-04-06 |

**Temi guida dichiarati dal Flutter team:**
- High-fidelity multiplatform (Impeller completo Android 10+, Wasm default web)
- Agentic UIs (GenUI + A2UI protocol, ephemeral code delivery)
- Open & sustainable operating model (Material/Cupertino come pacchetti standalone)
- Developer experience AI-native (Agentic Hot Reload consolidato, Agent Skills)
- Day-zero platform support (Android 17 day-zero, iOS 26+, multi-window desktop con Canonical)
- Dart evoluzione (Primary Constructors, Augmentations, build_runner migliorato, Dart/Wasm compilation)

**Breaking changes attesi:**
- 3.47: `Material` e `Cupertino` library deprecate (sostituite da `material_ui` e `cupertino_ui` packages)
- 3.47: `Listenable`, `AnimationStyle`, ecc. spostati in pacchetti Dart puri
- 3.50+: possibile rimozione KGP backward-compat (AGP 9+ built-in Kotlin)

---

## 3. Dart — Novità linguaggio

### 3.1 Dot shorthands (3.10)

```dart
// Prima
enum LogLevel { info, warning, error, debug }
logMessage('Failed', level: LogLevel.error);
// Dopo
logMessage('Failed', level: .error);
```

Funziona con: enum, costruttori, metodi statici, campi statici.

### 3.2 Analyzer plugins (3.10)

```yaml
analyzer:
  plugins:
    - custom_lint
```

Permette regole di analisi statica custom. Per progetti N1777: usa `custom_lint` invece di plugin custom.

### 3.3 Build hooks (3.10) — STABILI

```yaml
dependencies:
  my_native_lib:
    build:
      hooks:
        build: build_hook.dart
```

Sostituisce `native_assets`. Compila C++/Rust/Swift nel package Dart senza CMake/Gradle separati.

### 3.4 Fine-grained deprecation annotations

```dart
@Deprecated.extend()      // non si può estendere
@Deprecated.implement()   // non si può implementare
@Deprecated.subclass()    // né estendere né implementare
@Deprecated.mixin()       // non si può mixare
@Deprecated.instantiate() // non si può istanziare
@Deprecated.optional()    // parametro opzionale → required in futuro
```

Nuovo lint: `remove_deprecations_in_breaking_versions`.

### 3.5 Pub ecosystem (3.10-3.12)

- Cerca/sort/filtra liked packages nel profilo (`is:liked-by-me`)
- Disabilita manual publishing per sicurezza (`--enable-manual-publishing: false`)
- Packages con SwiftPM support ricevono + punti scoring

---

## 4. Architettura Flutter — Best practice 2026

### 4.1 Pattern ufficiale: MVVM (docs.flutter.dev/app-architecture)

```
lib/features/{feature}/
  data/
    models/          → entity pure (Dart), JSON serialization
    repositories/    → sorgente dati unica, nasconde dettagli implementativi
    services/        → API esterne, DB, platform plugins
  domain/            → OPTIONAL: use cases, entità pure Dart (testabili in console)
  presentation/
    controllers/     → ViewModel: logica UI, comandi, loading/error/success
    views/           → View: solo widget, composizione, eventi → ViewModel
    widgets/         → componenti riutilizzabili della feature
  {feature}_feature.dart → barrel export
```

### 4.2 Struttura progetto completa

```
lib/
├── main.dart                          # entry point, setup Riverpod scope
├── app.dart                           # MaterialApp/CupertinoApp config, theme
├── features/
│   ├── setaccio/
│   │   ├── data/
│   │   │   ├── models/
│   │   │   │   ├── proposal.dart       # sealed class Proposal
│   │   │   │   └── vote.dart           # sealed class VoteResult
│   │   │   ├── repositories/
│   │   │   │   └── proposal_repository.dart
│   │   │   └── services/
│   │   │       └── setaccio_api.dart   # Dio client, endpoints
│   │   ├── domain/                     # OPTIONAL
│   │   │   ├── vote_proposal.dart      # use case puro
│   │   │   └── entities/
│   │   │       └── proposal_entity.dart
│   │   ├── presentation/
│   │   │   ├── controllers/
│   │   │   │   ├── setaccio_controller.dart   # @riverpod Notifier
│   │   │   │   └── vote_controller.dart
│   │   │   ├── views/
│   │   │   │   ├── setaccio_view.dart         # ConsumerWidget
│   │   │   │   ├── proposal_detail_view.dart
│   │   │   │   └── vote_dialog.dart
│   │   │   └── widgets/
│   │   │       ├── proposal_card.dart
│   │   │       ├── vote_button.dart
│   │   │       └── tag_chip.dart
│   │   └── setaccio_feature.dart      # barrel export
│   └── agora/
│       └── ...                         # stessa struttura
├── core/
│   ├── design_system/
│   │   ├── tokens.dart                 # N1777 palette, spacing, typography
│   │   ├── colors.dart
│   │   ├── typography.dart
│   │   ├── spacing.dart
│   │   └── components/
│   │       ├── brass_button.dart
│   │       ├── ink_card.dart
│   │       ├── proposal_card.dart
│   │       └── tag_chip.dart
│   ├── routing/
│   │   └── app_router.dart             # goRouter config
│   ├── di/
│   │   └── service_locator.dart        # tutti i Provider globali
│   └── utils/
│       ├── debouncer.dart
│       └── result.dart                 # sealed class Result<T>
├── l10n/
│   ├── app_localizations.dart
│   └── translations/
└── generated/
    └── ...                             # JSON, l10n, routing auto-generati
```

**Regole ferree:**
- `features/` è autonomo: si aggiunge/rimuove senza toccare altre feature
- `core/` è condiviso, nessuna dipendenza da `features/`
- `domain/` è Dart puro, zero dipendenze Flutter — testabile in console con `dart run`
- Views usano `ConsumerWidget` + `ref.watch` / `ref.read` — niente `setState` per stato globale
- Comandi (azioni utente) sono metodi del ViewModel, chiamati dalla View tramite `ref.read(controller.notifier).azione()`

---

## 5. State Management — Riverpod (vanilla)

### 5.1 Perché Riverpod nel 2026

- Ufficiale Flutter Favorite (pub.dev)
- Sostituisce Provider (obsoleto)
- Zero BuildContext per leggere stato
- Type-safe, null-safe, compile-time checked (nessun `dynamic` a runtime)
- Dependency injection integrato — non servono `get_it`, `injectable`, `kiwi`
- 2.06M download/settimana

### 5.2 Installazione minima

```yaml
dependencies:
  flutter_riverpod: ^3.2.1
  riverpod_annotation: ^3.0.0      # per @riverpod annotation

dev_dependencies:
  riverpod_generator: ^3.0.0
  build_runner: ^2.4.0
```

**Vanilla principle**: 2 pacchetti. Non servono Bloc, GetX, MobX, Stacked.

### 5.3 Tre pattern core

**Pattern 1: Provider (stato sincrono)**

```dart
final themeProvider = Provider<ThemeData>((ref) {
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFFC9A227),
      brightness: Brightness.dark,
    ),
    useMaterial3: true,
  );
});
```

**Pattern 2: FutureProvider (stato asincrono)**

```dart
final proposalsProvider = FutureProvider.autoDispose<List<Proposal>>((ref) async {
  final api = ref.read(setaccioApiProvider);
  return api.fetchProposals();
});

// View: switch pattern — niente if/else spaghetti
final result = ref.watch(proposalsProvider);
return switch (result) {
  AsyncData(:final value) => ProposalList(proposals: value),
  AsyncError(:final error) => ErrorDisplay(error: error),
  _ => const LoadingIndicator(),
};
```

**Pattern 3: Notifier (azioni complesse)**

```dart
@riverpod
class VoteController extends _$VoteController {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> vote(String proposalId, int amount) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final api = ref.read(setaccioApiProvider);
      await api.vote(proposalId, amount);
    });
  }
}

// View: chiama azioni, mostra stati
ElevatedButton(
  onPressed: state.isLoading ? null : () => ref.read(voteControllerProvider.notifier).vote(id, 1),
  child: state.isLoading ? const CircularProgressIndicator() : const Text('Vote'),
);
```

### 5.4 Dependency Injection con Riverpod

```dart
// API client
final setaccioApiProvider = Provider<SetaccioApi>((ref) {
  return SetaccioApi(
    baseUrl: const String.fromEnvironment('API_URL', defaultValue: 'https://api.n1777.org'),
    dio: Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 5),
      headers: {'Accept': 'application/json'},
    )),
  );
});

// Repository: unico punto accesso ai dati
final proposalRepositoryProvider = Provider<ProposalRepository>((ref) {
  final api = ref.read(setaccioApiProvider);
  return ProposalRepository(api: api);
});
```

---

## 6. Navigazione — goRouter (ufficiale Flutter)

```yaml
dependencies:
  go_router: ^17.2.3  # maintained by flutter.dev, 2.95M download/settimana
```

```dart
final router = GoRouter(
  initialLocation: '/setaccio',
  routes: [
    GoRoute(
      path: '/setaccio',
      builder: (_, __) => const SetaccioView(),
    ),
    GoRoute(
      path: '/setaccio/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return ProposalDetailView(proposalId: id);
      },
    ),
    GoRoute(
      path: '/agora',
      builder: (_, __) => const AgoraView(),
    ),
  ],
  errorBuilder: (context, state) => NotFoundPage(error: state.error),
);

// In MaterialApp
MaterialApp.router(routerConfig: router)
```

Vanilla: goRouter di default supporta deep linking, type-safe routes, ShellRoute per bottom nav, redirect per auth.

---

## 7. Platform — Best practice 2026

### 7.1 iOS/macOS — Swift Package Manager (DEFAULT da 3.44)

- CocoaPods deprecato come default. Flutter CLI migra automaticamente.
- Add-to-App: `flutter build swift-package` per packaging nativo
- iOS UIScene lifecycle: obbligatorio per iOS 26+. Flutter CLI migra automaticamente se `AppDelegate` non è custom.
- iOS predictive text (experimental): `TextField.enableInlinePrediction = true`

```dart
TextField(
  enableInlinePrediction: true,  // iOS-only, accetta testo predetto con Space
)
```

### 7.2 Android — Hybrid Composition++ (HCPP 3.44)

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<meta-data
    android:name="io.flutter.embedding.android.EnableHcpp"
    android:value="true" />
```

```bash
flutter run --enable-hcpp
```

Risolve: screen tearing, input rotto in PlatformViews, SurfaceView, CPU overhead.
Requisito: Android API 28+, GPU Vulkan-capable.

Display corner radii (pixel-perfect su schermi arrotondati):
```dart
final radii = MediaQuery.displayCornerRadiiOf(context);
Padding(padding: EdgeInsets.only(top: radii.top), child: content);
```

Android 17: day-zero support pianificato per 3.47-3.50.

### 7.3 Desktop — Canonical lead maintainer

Canonical guida lo sviluppo di Linux/Windows/macOS embedders.
- Multi-window (experimental, main channel): `FlutterMultiWindow`
- Tooltip e dialog windows nativi cross-platform
- Content-sized views su Linux
- Windows stylus: pressure + rotation tracking

### 7.4 Web — WebAssembly default

```bash
flutter build web --wasm       # default per release builds da 3.44
flutter run -d chrome --wasm   # run con wasm
```

Novità:
- `prefers-reduced-motion` rispettato automaticamente
- `aria-description` per validation errors (accessibilità)
- `--base-href` support in `flutter run`

---

## 8. Impeller — Motore grafico (3.35+)

### 8.1 Vulkan backend (default)

- Memory management caches migliorata
- GPU/CPU synchronization più efficiente
- Frame dropping ridotto

### 8.2 SDF Circles

Circle renderizzate come Signed-Distance Functions → anti-aliasing perfetto.
Usa `CircleAvatar`, `ClipOval` — automatico.

### 8.3 FragmentShader API migliorata (3.41+)

```dart
// Bind uniform per NOME invece di indice manuale
void setUp(ui.FragmentShader shader) {
  shader.getUniformFloat('foobar').set(1.234);
}

// Sinc image decode — zero lag frame
ui.Image image = picture.toImageSync(128, 128, targetFormat: ui.TargetPixelFormat.rFloat32);
shader.setImageSampler(0, image);

// 128-bit float textures per LUT (GPU photo filters)
```

Shader compiler warnings per incompatibilità Skia — cross-platform debugging più facile.

---

## 9. AI-Native Apps — GenUI, Genkit, Gemma (3.44)

### 9.1 GenUI SDK

AI genera UI in tempo reale. A2UI protocol (open-source Google).

```dart
final genui = GenUIClient(apiKey: kGeminiApiKey);
final response = await genui.generateUI(
  prompt: 'Crea un form per la prenotazione',
  context: {'user_preferences': userPrefs},
);
```

500% download da inizio 2026. Esempio: "Finnish It!" app su Play Store.

### 9.2 Genkit Dart (preview)

```dart
import 'package:genkit/genkit.dart';
import 'package:genkit_google_genai/genkit_google_genai.dart';

final ai = Genkit(plugins: [googleAI()]);
final response = await ai.generate(
  model: googleAI.gemini('gemini-flash-latest'),
  prompt: 'Analizza questa proposta di voto',
);
```

Model-agnostic (Google, Anthropic, OpenAI). Server-side o client-side.

### 9.3 On-device AI — flutter_gemma + LiteRT-LM

```dart
final gemma = LiteRTModel.load('gemma-4-it');
final response = await gemma.generate('Riassumi: ...');
```

GPU/NPU acceleration su tutti e 6 i Piattaforme Flutter.

### 9.4 Agentic Hot Reload + Agent Skills

- Coding agent si connette a running app → hot-reload automatico
- MCP server + Dart & Flutter Agent Skills per task-oriented domain expertise
- Hardened dependency search: agents leggono dipendenze senza accesso completo a pub cache

---

## 10. Architettura UI — Design System N1777

### 10.1 Tokens estratti dalla preview

**Colori (dark theme brass):**

| Token | Hex/RGBA | Usage |
|-------|----------|-------|
| `--bg-app` | `#0a0a0c` | root background |
| `--bg-surface` | `#151518` | sidebar, topbar |
| `--bg-card` | `#1a1a1f` | cards, panels |
| `--bg-elevated` | `#212127` | hover, active states |
| `--border` | `#252530` | default borders |
| `--text-primary` | `#eeeef0` | primary text |
| `--text-secondary` | `#9a9aa6` | secondary text |
| `--text-muted` | `#5c5c6a` | timestamps, meta |
| `--brass` | `#c9a227` | primary accent, brand, CTA |
| `--brass-dim` | `rgba(201,162,39,0.14)` | brass background |
| `--ink-red` | `#ef4444` | errors |
| `--ink-green` | `#22c55e` | success |
| `--ink-blue` | `#3b82f6` | info |
| `--ink-purple` | `#a855f7` | accent |

**Spacing:**
- Card padding: 1.25rem-2rem
- Grid gap: 1.5rem-2rem
- Border radius: 16px (card), 10px (small), 8px (chips)

**Tipografia:**
- Inter: 300-700 per UI
- JetBrains Mono: 400-500 per codice/dati
- Newsreader: 300-400 per documentazione
- Line-height: 1.55 corpo, 1.2 titoli
- Letter-spacing: -0.02/-0.03/-0.04em per titoli

**Componenti Flutter da implementare:**

| Componente | Note |
|-----------|------|
| `BrassButton` | Primary CTA, FAB, variant filled/outline/ghost |
| `InkCard` | Card base con hover border brass |
| `ProposalCard` | Card proposta: avatar, titolo, countdown, body, tag, vote buttons |
| `BrassBadge` | Status badge: attiva/in votazione/chiusa |
| `TagChip` | Tag colorati: governance(brass), infrastruttura(blue), budget(green) |
| `StatusDot` | Indicatore stato: verde=attiva, giallo=in votazione, grigio=chiusa |
| `SearchBox` | Input ricerca con icona, focus brass border |
| `StatCard` | Card statistica con icona, valore mono, change indicator |
| `FilterPill` | Pill filtro orizzontale, active=white bg |

---

## 11. Performance — Checklist 2026

### 11.1 Impeller

- Default su Android API 28+ (Vulkan backend)
- SDF circles: anti-aliasing automatico per CircleAvatar, ClipOval
- FragmentShader: uniform by name, sync image decode

### 11.2 Isolati (concurrency)

```dart
Future<List<Proposal>> parseInIsolate(String json) async {
  return compute(_parseProposals, json);
}

List<Proposal> _parseProposals(String json) {
  final decoded = jsonDecode(json) as List;
  return decoded.map((p) => Proposal.fromJson(p)).toList();
}
```

`compute` è built-in Flutter. Non serve `isolates_extension`.

### 11.3 Deferred Components

```yaml
flutter:
  deferred-components:
    - name: setaccio_feature
      library: setaccio_feature
      include: /assets/setaccio/**

import 'package:app/setaccio_feature.dart' deferred as setaccio;
Future<void> openSetaccio() async => await setaccio.loadLibrary();
```

Riduce APK/IPA size del 30-40%.

### 11.4 HCPP (Android 3.44)

- Screen tearing eliminato
- Touch input affidabile
- SurfaceView supportato

### 11.5 Lazy loading liste

```dart
ListView.builder(
  itemCount: proposals.length,
  itemExtent: 120,        // hint per性能
  prototypeItem: ProposalCard(proposal: proposals.first), // pre-calcola
  cacheExtent: 500,       // pixel pre-caricati
  addAutomaticKeepAlives: false,  // se non serve keep-alive
)
```

---

## 12. Testing — Vanilla (nessun framework custom)

### 12.1 Unit test (Dart puro)

```dart
test('vote increments count', () {
  final proposal = Proposal(id: '1', votes: 5);
  final voted = proposal.copyWith(votes: proposal.votes + 1);
  expect(voted.votes, 6);
});
```

### 12.2 Widget test

```dart
testWidgets('ProposalCard renders title and vote button', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(home: ProposalCard(proposal: Proposal(id: '1', title: 'Test'))),
    ),
  );
  expect(find.text('Test'), findsOneWidget);
  expect(find.byType(ElevatedButton), findsOneWidget);
});
```

### 12.3 Integration test

```dart
void main() {
  test('full user flow: login → vote → logout', () async {
    final app = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
    await app.convertFlutterSurfaceToImage();
    // ... azioni utente simulate
  });
}
```

Vanilla: `flutter_test` built-in. Non serve `mocktail` se usi Riverpod + repository astratti.

---

## 13. Tooling — AI-Assisted Development (2026)

### 13.1 Agentic Hot Reload (3.44)

```bash
flutter run
# Agente (Antigravity / Claude Code / Cursor) modifica codice
# → hot-reload automatico senza setup aggiuntivo
# MCP server integrato
```

### 13.2 Agent Skills

Skills predefinite per: integration tests, localization, CI/CD, migration M3, ecc.
Usano `mcp_server` integrato — meno token, più accurate.

### 13.3 Widget Previewer

Preview standalone widgets in isolamento. Uso memoria -50% grazie a Dart Analysis Server.

---

## 14. Progetto minimo (pubspec.yaml)

```yaml
name: n1777_app
description: N1777 Design System — Flutter implementation
version: 1.0.0+1

environment:
  sdk: ">=3.2.0 <4.0.0"
  flutter: ">=3.44.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^3.2.1       # State + DI
  go_router: ^17.2.3             # Navigazione
  google_fonts: ^6.2.1           # Font: Inter, JetBrains Mono, Newsreader

  # Opzionali:
  # flutter_gemma: ^0.x.x        # AI on-device
  # genui: ^0.x.x                # Generative UI
  # firebase_ai: ^1.x.x          # Gemini client-side

dev_dependencies:
  flutter_test:
    sdk: flutter
  riverpod_generator: ^3.0.0    # Solo se usi @riverpod annotation
  build_runner: ^2.4.0
  custom_lint: ^0.7.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/fonts/
```

**Totale dipendenze production: 3-4 pacchetti.** Tutto il resto è Dart/Flutter puro.

---

## 15. Roadmap prossimi passi N1777

| Fase | Release target | Cosa include |
|------|---------------|-------------|
| **Now** | Flutter 3.44 | MVP: sidebar + proposals list + vote + detail |
| **3.47** | Ago 2026 | Migrazione a `material_ui` package standalone, Antigora views |
| **3.50** | Nov 2026 | GenUI integration, on-device AI con flutter_gemma, multi-window desktop |
| **3.53** | Feb 2027 | Full A2UI protocol, ephemeral code delivery, Jaspr web alternative |
| **3.56** | Mag 2027 | Dart Primary Constructors, Augmentations, full decoupling completato |

---

## 16. Cheat sheet — DO / DON'T

### FARE

| Azione | Perché |
|--------|--------|
| `flutter upgrade` → 3.44 | Ultima stable |
| SwiftPM (iOS/macOS) | CocoaPods deprecato da 3.44 |
| HCPP (Android) | Screen tearing + input fixes |
| goRouter + Riverpod | Pattern ufficiale Flutter team |
| MVVM per-feature | Separazione responsabilità, testabilità |
| Font picker sticky | UX preview design system |
| Dot shorthands | Codice più conciso (`.error` vs `LogLevel.error`) |
| UIScene lifecycle | Obbligatorio iOS 26+ |
| WASM web | `flutter build web --wasm` |

### NON FARE

| Azione | Perché |
|--------|--------|
| `setState` per stato globale | Usa Riverpod |
| Bloc/GetX/MobX | Riverpod copre tutto con meno codice |
| Provider (package vecchio) | Sostituito da Riverpod |
| Logica nel `build()` | Logica → ViewModel |
| `initState` per API calls | Usa FutureProvider + ref.watch |
| Dipendenze cicliche features→core | Core non dipende da features |
| `print()` per debug | Usa `debugPrint()` o logging package |
| Hardcoded API URLs | `String.fromEnvironment()` + `--dart-define` |
| Scaricare librerie "giant" | Vanilla first: se puoi farlo con Dart/Flutter puro, non aggiungere dipendenze |

---

## 17. Monitoraggio e aggiornamenti

- `docs.flutter.dev/whats-new` — releases ufficiali
- `blog.flutter.dev` — approfondimenti tecnici
- `github.com/flutter/flutter/blob/main/docs/roadmap/Roadmap.md` — roadmap pubblico
- `pub.dev/packages/riverpod` — changelog state management
- `pub.dev/packages/go_router` — changelog navigazione
- `docs.flutter.dev/ai/create-with-ai` — AI integration guide

**Prossimo aggiornamento previsto:** dopo Flutter 3.47 (Agosto 2026)

---

## 18. N1777 Co-Design Sprint — Piano operativo

Scadenza macro: **30 Giugno 2026**.

### Sprint A — Core + Design System (1-10 Giugno)
- [x] Definizione palette e tipografia in `core/design_system/tokens.dart`
- [x] Componenti base: `BrassButton`, `InkCard`, `ProposalCard`
- [ ] Setup progetto Flutter con Riverpod + goRouter
- [ ] Pagina Login/Onboarding
- [ ] Navigazione: sidebar + bottom bar

### Sprint B — Setaccio + Voting (11-20 Giugno)
- [ ] Data layer: `ProposalRepository`, `SetaccioApi`
- [ ] Controller: `SetaccioController`, `VoteController`
- [ ] Views: `SetaccioView` (lista), `ProposalDetailView`
- [ ] Integrazione votazione real-time

### Sprint C — Agora + Polish (21-30 Giugno)
- [ ] Feature Agora: chat, thread, proposte discussione
- [ ] Animazioni: Hero, implicit animations
- [ ] Accessibilità: semantics, focus, screen reader
- [ ] Testing: unit + widget + integration smoke test
- [ ] Preview HTML aggiornata con Flutter web embedding

### Deliverables finali
1. App Flutter desktop-ready (Linux/Windows/macOS)
2. Preview HTML in `converted_for_notebooklm/n1777-preview.html`
3. Documentazione design tokens in `core/design_system/`
4. Questo piano aggiornato

---

## 19. Fonti

- Flutter blog: "What's new in Flutter 3.44" — Khanh Nguyen, Maggio 2026
- Flutter blog: "Flutter & Dart's 2026 roadmap" — Emma Twersky, Feb 2026
- Flutter blog: "That's a wrap: Everything Flutter at Google I/O 2026" — Emma Twersky, Maggio 2026
- docs.flutter.dev/app-architecture — guida ufficiale MVVM (agg. 2026-05-05)
- github.com/flutter/website/blob/main/src/content/install/archive.md — 2026 schedule
- github.com/flutter/flutter/blob/main/docs/roadmap/Roadmap.md — roadmap pubblico
- pub.dev/packages/riverpod — 3.2.1
- pub.dev/packages/go_router — 17.2.3
- pub.dev/packages/genui — Generative UI SDK
- pub.dev/packages/flutter_gemma — on-device AI
- dart.dev/blog/announcing-dart-3-10 — dot shorthands, analyzer plugins, build hooks
- docs.flutter.dev/release/whats-new — changelog ufficiale

---

*File generato il 2026-06-01. Aggiornamento: 2026-06-01T06:07:25+02:00.*
*Autore: Kilo (assistente) per neo1777.*
*Stato: DRAFT — in progress (Sprint A)*
