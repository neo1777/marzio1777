> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

> **🎨 AGGIORNAMENTO 2026-06-30 — design integrato.** La "base-default neutra" che questo annesso proponeva (gap #5) è **superata**: la cartella design di Neo è arrivata ed è il **N1777 Design System** (brass su ink; Fraunces/Archivo/JetBrains). La fonte autoritativa (token, tipografia, componenti, implementazione Flutter di riferimento + le decisioni) è ora **[`design-system-N1777/00-INTEGRAZIONE.md`](design-system-N1777/00-INTEGRAZIONE.md)**. Il resto di questo annesso — adaptive/responsive, safe-area, stati vuoto/errore/caricamento, a11y `Semantics`, i 42 `alert()`→`SnackBar`, la cura per pagina — **resta valido, applicato ai token N1777**.

### Verifica del piano attuale (gap trovati)

Ho verificato §2.4 (Theming), §3.1 (Shell/tema/primitive), §3.2 (pagine), §7 (trade-off CanvasKit) contro `src/index.css`, `src/components/ui/index.tsx`, `src/config/tenant.ts`, `src/components/Layout.tsx` e grep sul codice reale. Il piano è solido sull'impianto (ThemeData + ThemeExtension, go_router shell, ThemeMode al posto del `MutationObserver`), ma ha cinque imprecisioni load-bearing sulla dimensione frontend-design e tre omissioni.

1. **[ERRORE load-bearing] "Due superfici (seppia/giorno e notte/dark-flame)" è sbagliato: le superfici sono TRE.** Il piano §2.4 tratta "dark = dark-flame" e dice "la superficie dark-flame forzata dell'Ainulindalë diventa un `Theme(...)`". Ma nel codice il dark mode della *Comunità* NON è dark-flame: `.dark body { background-color: #0d1310 }` (verde-notte) con palette hardcoded `#151e18` (card/sidebar), `#24352b` (border), `#42a83a` (verde acceso) — verificato in 21 file. Il dark-flame (`#0A0A0F`/`#FFA000`/`#16161D`) vive solo nei token semantici `@theme` e nelle 9 pagine/primitive audio. Sono **due mondi scuri distinti**: verde-notte (Comunità) e dark-flame (Ainulindalë). Se in Flutter mappi i token semantici → `ThemeData.dark`, fai diventare *tutta* l'app dark-flame in dark mode e **regredisci** l'identità verde-notte. Correzione: `ThemeData` light (seppia) + `ThemeData` dark (verde-notte) + un `Theme(...)` scoped dark-flame che avvolge solo il sottoalbero Ainulindalë (più, semanticamente, i due accenti di gioco: Concept A verde+ambra, Concept B blu indaco+oro — `TECHNICAL_DOCS_IT.md:644-646`). Il dossier lo coglie come [INFERENZA] alla riga 1070; il piano lo appiattisce.

2. **[STIMA da correggere] La "deriva di 70+ hex inline" è in realtà ~992.** Il piano §2.4 cita "72 occorrenze di `bg-[#2D5A27]`, 62 di `#111814`…" e conclude "70+ hex inline". Il grep reale: **992 occorrenze** di `(bg|text|border|ring)-[#hex]` in `src/`; il `72` è solo il singolo colore `#2D5A27`. I token di brand `marzio-*` sono usati come classe **1 volta sola** (`bg-marzio-verde` nell'Avatar) — non "~9". La tokenizzazione è quindi un lavoro ~14× più grande di quanto implica il piano (mechanico ma voluminoso): va riflesso nell'effort di Fase 0/2, altrimenti la "estinzione della deriva" diventa un debito che scivola in Fase 2 pagina per pagina.

3. **[OMISSIONE] Bug latente safe-area non rilevato.** `pb-safe` e `pt-safe` sono usati su `Layout.tsx:296` (la **bottom-nav** mobile) e `FullScreenPlayer.tsx:53`, ma **non sono definiti** in `src/index.css` (solo `.pb-nav-safe` lo è) né sono utility Tailwind v4 native → sono **no-op**. Cioè oggi la home-indicator iOS NON è rispettata sulla nav. Il porting non deve replicare il no-op: in Flutter si risolve **correttamente** con `SafeArea`. Va segnato come "fix in porting", non come parità 1:1.

4. **[OMISSIONE] Nessun piano per i 42 `alert()`.** Il dossier nota "toast system globale rinviato (resta `alert()`)"; il grep conferma **42 `alert()` in 11 pagine**. Il piano sceglie Riverpod ma non dice cosa diventano gli `alert()`. Flutter ha `ScaffoldMessenger`/`SnackBar` nativo: il porting è il momento per chiudere quel parking-lot a costo ~zero, non per trascinarlo. Va messo a piano (vedi checklist, stato errore).

5. **[OMISSIONE strutturale, esplicita nel mio mandato] Manca il design-system come asset parametrizzabile.** Il piano lega i colori a `TenantConfig` (giusto, §2.4/§6.4), ma `TenantConfig` Dart oggi (verificato in `tenant.ts`) porta solo `id/name/fullName/map/storage` — **zero token di design**. Non c'è (a) un contratto di token, (b) una BASE-DEFAULT NEUTRA, (c) un punto d'innesto per la cartella design che Neo passerà. Senza, ogni superficie e proporzione resta sparsa nei widget come oggi è sparsa negli hex inline. Il corpo qui sotto colma questo.

Nota di metodo a favore del piano: gran parte dei fix R1-R5 (`.pb-nav-safe`, `min(vh,dvh)`, regola flex `min-h-0`, child-scroll sotto parent `overflow-hidden`, z-index su Leaflet) sono **workaround a problemi CSS/flexbox/viewport che in Flutter non esistono** (`Scaffold` inset-a la bottom bar, `SafeArea`, `MediaQuery.viewInsets` per la tastiera, `Stack` con z-order = ordine figli). Il porting deve trasportare **l'intento e le lezioni** (safe-area rispettata, contenuto scrollabile, modali che stanno nel viewport, filtro mappa sopra i marker, a11y del datetime, tap-target) — non la meccanica CSS. Questo, paradossalmente, è un argomento *a favore* della migrazione che il piano sottoutilizza.

---

## Frontend, design, adaptive e usabilità in Flutter

**Perché questa sezione.** La parità di marzio1777 non si gioca solo sul data-layer: si gioca su tre superfici cromatiche, una shell responsive a un breakpoint, primitive UI scritte a mano con semantica a11y precisa, e una manciata di proporzioni che fanno "sembrare Marzio". Tutto questo oggi vive metà in token (`@theme`) e metà in 992 hex inline. Il porting è l'occasione, a costo marginale, per **incanalare il 100% del colore e delle proporzioni in un solo contratto di token**, parametrizzabile per `TenantConfig`, pronto ad assorbire la cartella design in arrivo. In Flutter non esiste l'escape hatch `bg-[#...]`: tutto passa da `Theme.of(context)`, quindi la deriva **non può ripresentarsi per costruzione** — è il principale guadagno strutturale di questa dimensione.

### A. Portare il design system in Flutter

#### A.1 Le tre superfici → `ThemeData` × 2 + `Theme` scoped × 1

Mappatura verificata sul codice:

| Superficie (sorgente) | Quando | Valori reali | Target Flutter |
|---|---|---|---|
| **Seppia / giorno** (Comunità light) | default, `body` light | bg `#F7F5F0`; brand verde `#2D5A27`, oro `#F5A623`, azzurro `#4A90E2`, grigio `#8C928D` (`index.css:7-12,107`) | `ThemeData(brightness: light)` + `MarzioColors` brand |
| **Verde-notte** (Comunità dark) | `.dark` sull'app | bg `#0d1310`; card/sidebar `#151e18`; border `#24352b`; hover `#1a261f`; verde acceso `#42a83a`; pill/polaroid `#111814` (`index.css:110-126`, `Layout.tsx`) | `ThemeData(brightness: dark)` + `MarzioColors` dark |
| **Dark-flame** (Ainulindalë, forzata) | sempre, dentro il modulo audio + giochi-accent | bg `#0A0A0F`; fg `#F5F0E1`; card `#16161D`; primary ambra `#FFA000`; accent crimson `#C2410C`; muted `#1A1A24`/`#879B8F`; ring `#FFA000`; oro Gagliardetti `#D4A856`; glow `rgba(255,160,0,.4)` (`index.css:19-37`, `TECHNICAL_DOCS_IT.md:648-657`) | `Theme(data: flameTheme, child: …)` che **avvolge solo** il subtree Ainulindalë |

Razionale del subtree scoped invece di un terzo `ThemeMode`: oggi la regola è "il modulo audio forza dark per immersione, anche con app in light" (`TECHNICAL_DOCS_IT.md:659`). Un terzo valore di `ThemeMode` non esiste; la semantica corretta è "questo ramo dell'albero ha un tema diverso dal resto", che in Flutter è esattamente `Theme(data:…, child:…)` — l'equivalente puntuale del `bg-[#0A0A0F]` parent-forced di oggi, ma esplicito e ereditato da tutti i discendenti senza `MutationObserver`.

Il toggle light/dark (oggi `localStorage 'theme'` + `classList.toggle('.dark')`, `Layout.tsx:17-30`) diventa un `StateProvider<ThemeMode>` Riverpod persistito con `shared_preferences`, passato a `MaterialApp.themeMode`. Le 3 pagine che oggi osservano la classe `.dark` via `MutationObserver` (LaMappa/IlBaule/LAlberone, per ricolorare Leaflet/canvas) **perdono l'observer**: `Theme.of(context).brightness` rebuilda reattivamente — un netto.

#### A.2 Il contratto di token come `ThemeExtension`

Il colore non basta: vanno tokenizzati anche spaziatura, raggi, tipografia, elevazioni, durate motion e le dimensioni-componente (le proporzioni che "fanno Marzio"). Tutto in `ThemeExtension` così che `Theme.of(context).extension<MarzioColors>()!` sia l'unico accesso, e la cartella design futura li riscriva senza toccare i consumer.

```dart
// lib/src/common/theme/tokens/design_tokens.dart  — IL CONTRATTO (immutabile)

@immutable
class MarzioColors extends ThemeExtension<MarzioColors> {
  // Brand (palette marzio, oggi usata via classe 1 sola volta → da riportare ovunque)
  final Color seppia, verde, oro, azzurro, grigio;
  // Accenti di dominio (oggi sparsi in hex inline)
  final Color verdeAcceso;       // #42a83a (dark community)
  final Color flameAmber;        // #FFA000 (Ainulindalë primary)
  final Color flameCrimson;      // #C2410C
  final Color gagliardettiGold;  // #D4A856
  final Color glow;              // rgba(255,160,0,.4)
  // Accenti di gioco
  final Color huntPrimary, huntAccent;   // Concept A: verde + ambra
  final Color quizPrimary, quizAccent;   // Concept B: indaco + oro
  const MarzioColors({ required this.seppia, /* … */ });
  @override MarzioColors copyWith({ /* … */ }) => …;
  @override MarzioColors lerp(MarzioColors? o, double t) => …; // per transition-colors 300ms
}

@immutable
class MarzioSpacing extends ThemeExtension<MarzioSpacing> {
  // scala a base 4px verificata nel codice (Tailwind 1=4,1.5=6,2=8,3=12,4=16,6=24,8=32)
  final double xs, sm, md, lg, xl, xxl; // 4,8,12,16,24,32
  const MarzioSpacing({ /* … */ });
}

@immutable
class MarzioRadii extends ThemeExtension<MarzioRadii> {
  final double sm, md, lg, xl2, full; // rounded-md=6, lg=8, 2xl=16
}

@immutable
class MarzioSizing extends ThemeExtension<MarzioSizing> {
  // proporzioni-componente estratte da ui/index.tsx e Layout.tsx (vedi A.4)
  final double btnSm, btnMd, btnLg, btnIcon;     // 36,40,44,40
  final double fieldH, switchW, switchH, thumb;  // 40,44,24,20
  final double navH, sidebarW;                   // 64,256
  final double tapMin, focusRing;                // 48 (Material) / 56 (HUD), 2
  final double avatarXs, avatarSm, avatarMd, avatarLg, avatarXl; // 20,32,40,64,96
}

@immutable
class MarzioMotion extends ThemeExtension<MarzioMotion> {
  final Duration themeSwitch;  // 300ms (transition-colors duration-300)
  final Duration fast, normal; // micro-interazioni
  final Curve dropIn;          // cubic-bezier(.175,.885,.32,1.275) dei marker
}
```

Tipografia (`index.css:1,39-40,106`): `Inter` (400/500/600) default + `Playfair Display` (serif, titoli brand). In Flutter: **bundlare i font** in `pubspec.yaml` (non `google_fonts` runtime — viola "leggero/offline-first" della PWA e aggiunge fetch; i font vanno in `assets/fonts/`, precaricati come oggi sono in `@import`). Costruire un `TextTheme` con `fontFamily: 'Inter'` di default e uno stile `serif` (`Playfair`) per `displayLarge`/`headline*` usati dai titoli brand (`marzio1777`, "Accesso in Attesa", H2 overlay — `Layout.tsx:180`). Il plugin `@tailwindcss/typography` (rendering markdown dei doc in `Istruzioni.tsx`) → `flutter_markdown` con uno `MarkdownStyleSheet` derivato dallo stesso `TextTheme`.

#### A.3 Le primitive `ui/index.tsx` → widget (mappatura 1:1, semantica a11y inclusa)

Le primitive sono scritte a mano, token-driven e già a11y-curate — portano pulitissime. Tabella verificata su `ui/index.tsx`:

| Primitiva (sorgente) | Widget Flutter | Note di fedeltà da rispettare |
|---|---|---|
| `Button` 6 var × 4 size (`:70-106`) | `MarzioButton` su `ButtonStyle` | 6 varianti (default/secondary/ghost/destructive/outline/link), 4 size (h 36/40/44, icon 40²), `gap-2`=8, radius 6; **`focus-visible:ring-2 ring-offset-2`** → `FocusRing`/`MaterialState.focused` con `MarzioSizing.focusRing`; `disabled:opacity-50` → `.disabled` state |
| `Input`/`Textarea`/`Label` (`:108-131`) | `TextField` + `InputDecoration` | `FIELD_BASE` condiviso → un `InputDecorationTheme` unico; Input h40, Textarea minLines (≈80px), focus ring, `placeholder:text-muted-foreground`, `disabled` state |
| `Switch` ARIA (`:133-175`) | `Switch.adaptive` **+ `Semantics(toggled:)`** | load-bearing: oggi è `role="switch" aria-checked` *come button* perché annunci come switch; in Flutter `Switch` ha già `Semantics` di toggle — **verificare con TalkBack/VoiceOver** che annunci "interruttore", non "casella". Dimensioni 24×44 thumb 20, `bg-primary` se on |
| `Card` + sub (`:177-200`) | `MarzioCard` (`Container`+`DecoratedBox`) | radius `lg`=8, `border`, `bg-card`, `shadow-sm` → `elevation`/`BoxShadow`; Header `p-6`=24 `space-y-1.5`=6; Title `text-xl`(20) semibold; Desc `text-sm`(14) muted |
| `ScrollArea` (`:202-211`) | `SingleChildScrollView`/`Scrollbar` | scrollbar slim 6px (`index.css:70-102`) → `ScrollbarThemeData(thickness:6, radius:3)`; `.scrollbar-hide` → `ScrollConfiguration(scrollbars:false)` |
| `Dialog`/`DialogContent` (`:213-276`) | `showDialog` + `Dialog` | Escape+click-outside → `barrierDismissible:true`; body-scroll-lock → automatico; **`max-h-[min(90vh,90dvh)] overflow-y-auto`** → `ConstrainedBox(maxHeight: MediaQuery.size.height*.9)` + body scrollabile (su Flutter il problema URL-bar Safari **sparisce**, niente juggling dvh); `max-w-lg`=512; `DialogFooter` `flex-col-reverse sm:flex-row` → `OverflowBar`/responsive (bottoni impilati-inverso su mobile); **No focus-trap oggi** → in Flutter il dialog **trappa il focus di default**: è un *miglioramento* a11y gratis, tenerlo |
| `Avatar` offline-safe (`:11-68`) | `MarzioAvatar` | `Image.network(errorBuilder:)` → fallback iniziale su `bg-marzio-verde`; **niente CDN DiceBear/picsum** (regola offline-safe); 5 taglie 20→96; `role="img"+aria-label` → `Semantics(label:, image:true)` |
| `ErrorBoundary` (`components/ErrorBoundary.tsx`) | `runZonedGuarded` + `ErrorWidget.builder` + `FlutterError.onError` | la "schermata nera = tree smontata da throw" non esiste uguale; replicare la CTA "Torna alla Piazza"/"Ricarica" come fallback widget |

#### A.4 Adaptive / responsive: dal breakpoint `md` a `LayoutBuilder`

Lo shell (`Layout.tsx`, verificato): root `h-[100dvh] flex flex-col md:flex-row` → mobile colonna (header `absolute top-0` + bottom-nav `fixed bottom-0 h-16`), desktop riga (sidebar `hidden md:flex w-64 rounded-2xl`). Due soli breakpoint Tailwind in uso: `sm`=640px (DialogFooter), `md`=768px (shell). Mappatura:

- **Breakpoint unico in costante**, non sparso: `class Breakpoints { static const sm = 640.0, md = 768.0; }` in `common/`. Decidere la forma shell con `LayoutBuilder`/`MediaQuery.sizeOf(context).width >= Breakpoints.md`.
- **Shell adattiva** via `StatefulShellRoute.indexedStack` (già scelto dal piano §2.3) + uno `AdaptiveScaffold`:
  - `< md` → `Scaffold(appBar: …, bottomNavigationBar: NavigationBar(...))`. La `NavigationBar` Material gestisce da sola l'inset della home-indicator (**fix nativo del bug `pb-safe` no-op**) e insetta il `body` (fine del `.pb-nav-safe` manuale).
  - `>= md` → `Row(children: [NavigationRail/sidebar w=256, Expanded(child: …)])`. La sidebar `rounded-2xl` (16) con `Card`/`Container`.
- **Le pezze viewport evaporano, l'intento resta**: `h-[100dvh]`/`min(vh,dvh)` → non servono (Flutter non ha il problema URL-bar nello stesso modo); `.pb-nav-safe`/`pb-safe` → `SafeArea` + inset automatico dello `Scaffold`; regola flex `min-h-0` e child-scroll sotto `overflow-hidden` → `Expanded`+`ListView`/`SingleChildScrollView` (il footgun non esiste). **Da verificare a runtime su device reale**, non darlo per scontato (è la lezione R5: niente "fix sistemico" senza sweep).
- **Z-index → ordine nello `Stack`**: il filtro mappa portato a `z-[1100]` per stare sopra i pane Leaflet (R3) → in `flutter_map` gli overlay sono figli di uno `Stack`/`children` del map; l'ordine di dichiarazione è lo z-order. La policy numerica Leaflet sparisce; resta la regola "il filtro va sopra i marker" = "dopo nello Stack".
- **Proporzioni come token, non magic number**: tutte le misure di A.2 (`MarzioSizing`) vengono da `ui/index.tsx`/`Layout.tsx`. Regola di porting: **nessun `SizedBox(height: 40)` letterale** nei widget → sempre `sizing.fieldH`. Così la cartella design può ribilanciare densità/tap-target da un punto.
- **Tap-target**: oggi dichiarato ≥56px su HUD mobile e `min-h-[48px]` sulle CTA (`TECHNICAL_DOCS_IT.md:661`, `STATO_PROGETTO.md:1318`). In Flutter: `MaterialTapTargetSize.padded` (48 minimo) globale + override 56 sugli elementi HUD AR/quiz via `sizing.tapMin`.

### B. La BASE-DEFAULT NEUTRA (pronta ad assorbire la cartella design)

**Perché.** Neo passerà una cartella design. Se i valori marzio fossero cablati nel `theme_builder`, assorbirla sarebbe un refactor. Invece: il `theme_builder` è una **funzione pura `ThemeData buildTheme(DesignTokens, Brightness, {bool flame})`**; i valori vivono in istanze di `DesignTokens`; la cartella design diventa **una nuova istanza** (o un parser → istanza). Zero consumer toccati.

#### B.1 Struttura file (l'innesto)

```
lib/src/common/theme/
  tokens/
    design_tokens.dart    # IL CONTRATTO: DesignTokens {colors, spacing, radii, sizing, typography, motion}
    tokens_neutral.dart    # BASE-DEFAULT NEUTRO  → const DesignTokens kNeutralTokens
    tokens_marzio.dart     # marzio 1:1 (riproduce l'aspetto di oggi) → const DesignTokens kMarzioTokens
  theme_builder.dart       # buildLight/buildDark/buildFlame(DesignTokens) → ThemeData
  marzio_theme_data.dart   # estensioni ThemeExtension (A.2)
```

`DesignTokens` è un **super-tipo immutabile** che aggrega tutte le `ThemeExtension` di A.2 + `ColorScheme` seed. La cartella design in arrivo si innesta in **uno** di due modi, entrambi previsti:
- **(i) trascrizione manuale** → si scrive `tokens_<comunita>.dart` come `kMarzioTokens` ma coi valori nuovi;
- **(ii) loader** → se la cartella design ha un formato dichiarativo (JSON/Style Dictionary/export Figma tokens), un `DesignTokens.fromJson(Map)` la parsa a build-time (`--dart-define` del path o asset). Predisporre `fromJson`/`toJson` nel contratto **ora**, così l'innesto (ii) è gratis.

#### B.2 Il NEUTRO: cos'è e perché

`kNeutralTokens` è un design **non-marzio, non-flame**: una base grigio/neutra, accessibile (contrasto AA garantito), proporzioni Material standard. Serve a tre cose: (1) è il **default di `TenantConfig`** quando una comunità non porta un suo design; (2) è il **banco di prova del parametrismo** — se l'app è "bella" anche in neutro, vuol dire che nessuna proporzione/colore è cablata; (3) è il **fondale su cui la cartella design si sovrappone**: ciò che la cartella non specifica, eredita dal neutro (merge), così non si rompe nulla se il design è parziale.

Valori NEUTRO proposti (tutti sovrascrivibili):

| Token | Neutro | Razionale |
|---|---|---|
| `colors.primary` | `#3B6FB0` (blu neutro) | accessibile su bianco e su scuro; non evoca Marzio |
| `colors.surface` light / dark | `#FAFAFA` / `#121214` | grigi puri, non seppia/non flame |
| `spacing` | 4/8/12/16/24/32 | scala reale del codice (continuità) |
| `radii` | 6/8/16 | `rounded-md/lg/2xl` reali |
| `sizing` btn/field/nav/sidebar | 36-40-44 / 40 / 64 / 256 | proporzioni reali estratte |
| `typography` | `Inter` + serif di sistema | Inter resta (è neutro e leggibile); il serif brand è opzionale |
| `motion.themeSwitch` | 300ms | `transition-colors duration-300` reale |

#### B.3 Legame a `TenantConfig`

Estendere il `TenantConfig` Dart (oggi `id/name/fullName/map/storage` — `tenant.ts`) con un campo design, **senza** rompere la non-preclusione multi-tenant del piano §6.4:

```dart
class TenantConfig {
  final String id, name, fullName;
  final MapConfig map;
  final StorageConfig storage;
  final DesignTokens design;   // NUOVO — default kNeutralTokens
  const TenantConfig({ /* … */, this.design = kNeutralTokens });
}
const kMarzioTenant = TenantConfig(id:'marzio', /* … */, design: kMarzioTokens);
```

`MaterialApp` legge `tenant.design` via provider: `theme: buildLight(tenant.design)`, `darkTheme: buildDark(tenant.design)`, e l'Ainulindalë avvolge in `Theme(data: buildFlame(tenant.design))`. **Regola d'oro del porting**: nessun colore/dimensione fuori da `tenant.design`; nessun `Color(0xFF...)` letterale nei widget (l'equivalente Dart del `bg-[#...]` proibito). Verifica: un lint custom o `grep -rn "Color(0xFF" lib/src/features` deve restare quasi vuoto (eccezioni motivate, come oggi `bg-marzio-verde` nell'Avatar è l'unica brand-class legittima).

### C. Checklist di cura frontend per ogni pagina

Da applicare come **gate** a ogni pagina portata (23 pagine), sullo stile dei gate del lettore-critico. Ogni voce ha il "come verificare". È la rete che impedisce che la cura UX di R1-R5 si perda nel volume di Fase 2.

**1. Layout & responsive**
- [ ] Si comporta a `< md (768)` (colonna, NavigationBar) e `>= md` (riga, sidebar). *Verifica*: ridimensiona la finestra web + esegui su un device stretto (≤360px) e tablet.
- [ ] Il contenuto lungo scrolla; l'ultimo elemento non finisce sotto la nav. *Verifica*: scrolla fino in fondo su iPhone reale/simulatore con home-indicator (il bug `pb-safe` di oggi NON deve ripresentarsi).
- [ ] `SafeArea` su top/bottom/notch dove serve; tastiera non copre i campi (`MediaQuery.viewInsets`). *Verifica*: apri un form, alza la tastiera, l'input attivo resta visibile.
- [ ] Modali dentro il viewport, body scrollabile (max ~90% altezza). *Verifica*: modale con contenuto lungo su schermo basso.

**2. Proporzioni**
- [ ] Tutte le misure da `MarzioSizing`/`MarzioSpacing`, zero magic number. *Verifica*: `grep` di `SizedBox(height:`/`EdgeInsets.all(` con letterali numerici → quasi vuoto.
- [ ] Tap-target ≥48 (Material), ≥56 su HUD AR/quiz/player. *Verifica*: `flutter` debug paint + ispezione manuale dei controlli piccoli.
- [ ] Densità coerente fra le pagine (stessa altezza pulsanti/campi/card). *Verifica*: confronto a vista tra due pagine sorelle.

**3. Visualizzazioni / dati**
- [ ] Liste lunghe → `ListView.builder` (lazy), non `Column` in `SingleChildScrollView`. *Verifica*: feed Piazza/biblioteca con 200+ item, scroll fluido.
- [ ] Mappa: filtro/overlay sopra i marker (ordine `Stack`); centro default Marzio `[45.9238, 8.8655]` prima del GPS. *Verifica*: il filtro non finisce sotto un popup.
- [ ] Immagini: `cacheWidth`/`cacheHeight` per cover ≤50KB e foto; `errorBuilder` ovunque. *Verifica*: offline → niente icona-rotta, parte il fallback.
- [ ] Animazioni rispettano `MediaQuery.disableAnimations`/`reduce motion` (oggi `useReducedMotion`). *Verifica*: attiva "Riduci movimento" di sistema → il wobble/pulse si spegne (lezione R1/R5: AR wobble rimosso).

**4. Usabilità**
- [ ] Ogni azione `async` disabilita il trigger e mostra progresso (no doppio-tap). *Verifica*: tap rapido doppio su "Salva" → una sola scrittura.
- [ ] Pulsanti azione disabilitati con **hint testuale** quando le precondizioni mancano (pattern wizard GameCreator). *Verifica*: step wizard incompleto → "Avanti" disabled + hint ambra.
- [ ] Stato preservato tra i tab della shell (`indexedStack`). *Verifica*: scrolli la Piazza, vai su Profilo, torni → posizione mantenuta (miglioramento vs `lazy()` React).

**5. Accessibilità (a11y)**
- [ ] Focus ring visibile su ogni controllo interattivo (porting di `focus-visible:ring-2`). *Verifica*: naviga con Tab da tastiera (web) → ogni stop è visibile.
- [ ] `Semantics` corretti: `Switch` annuncia "interruttore", `Avatar` ha label, bottoni-icona hanno `tooltip`/`Semantics(label:)`. *Verifica*: TalkBack/VoiceOver su 3 controlli chiave.
- [ ] `Semantics(liveRegion: true)` su leaderboard, cambio round, "Risposta Registrata", queue update, errori (porting di `aria-live="polite"`). *Verifica*: screen reader annuncia il cambio senza spostare il focus.
- [ ] Contrasto AA sul testo; AAA su HUD AR/player (testo bianco + ombra). *Verifica*: contrast checker sui token + ispezione HUD su sfondo camera.
- [ ] Form datetime/critici con label esplicita + hint (porting a11y kickoff R4). *Verifica*: campo kickoff ha label, formato e vincolo "≥30s nel futuro".

**6. Stati vuoto / errore / caricamento (i tre stati, sistematici)**
- [ ] **Loading**: con Riverpod, ogni pagina data-driven usa `asyncValue.when(loading: …)` con uno **skeleton/spinner condiviso** (`MarzioLoading`), non un widget ad-hoc per pagina (oggi ognuna ha il suo). *Verifica*: throttle rete → stato di caricamento coerente ovunque.
- [ ] **Empty**: empty-state **illustrato + CTA** (porting del pattern "Torna al Paese" guest, `min-h 48`), un `MarzioEmptyState(icon, title, message, action)` riusato dalle 14 pagine che oggi gestiscono il vuoto ad-hoc. *Verifica*: lista vuota → messaggio + azione, non schermo bianco.
- [ ] **Error**: i **42 `alert()`** diventano `ScaffoldMessenger.showSnackBar` con `err` reale in superficie (porting della regola "surface err.message", mai stringhe generiche) — chiudere il parking-lot "toast globale" del dossier in porting. *Verifica*: forza un errore di scrittura → SnackBar con il messaggio reale, non un dialog bloccante.
- [ ] `ErrorBoundary` globale (`runZonedGuarded`+`ErrorWidget.builder`) con CTA di recupero. *Verifica*: throw in un widget → fallback "Torna alla Piazza", non crash.

**7. Purezza del tema (la rete anti-deriva)**
- [ ] Zero `Color(0xFF...)` letterale nel widget; tutto da `Theme.of(context)` / `extension<MarzioColors>()`. *Verifica*: `grep -rn "Color(0xFF" lib/src/features/<pagina>` quasi vuoto.
- [ ] La pagina è leggibile in **tutte e tre** le superfici se applicabile (light, verde-notte, e dark-flame se è un ramo audio/gioco). *Verifica*: toggle ThemeMode + apertura del ramo Ainulindalë.
- [ ] La pagina regge anche con `kNeutralTokens` (nessun colore "hardcoded marzio"). *Verifica*: avvia con `TenantConfig` neutro → niente verde/ambra fuori posto.

### D. Sequenza operativa (innesto nelle fasi del piano)

1. **Fase 0** — creare `lib/src/common/theme/tokens/{design_tokens,tokens_neutral,tokens_marzio}.dart` + `theme_builder.dart`; trascrivere `kMarzioTokens` 1:1 dai valori reali (tabella A.1); estendere `TenantConfig` con `design`; cablare `MaterialApp` (light seppia / dark verde-notte) + helper `flameTheme`. Portare le primitive `ui/*` (A.3). *Fatto*: La Piazza in tutte e tre le superfici con zero hex letterali; `kNeutralTokens` non rompe la pagina.
2. **Fase 1** — definire `fromJson`/`toJson` su `DesignTokens` (innesto loader (ii) pronto); HUD AR/player con tap-target 56 e contrasto AAA.
3. **Fase 2** — applicare la checklist C a ogni pagina portata; introdurre `MarzioLoading`/`MarzioEmptyState` e la migrazione `alert()`→`SnackBar` come parte del template di pagina (non a fine corsa). *Fatto*: nessuna pagina con loading/empty/error ad-hoc; `grep Color(0xFF` quasi vuoto.
4. **All'arrivo della cartella design** — scrivere `tokens_marzio.dart` aggiornato (o `DesignTokens.fromJson` sul formato fornito). Nessun consumer cambia. *Verifica*: l'app cambia pelle ricostruendo solo `tenant.design`; la checklist C passa ancora.

**File di riferimento (verificati alla fonte):** `/home/neo1777/Scrivania/marzio1777-main/src/index.css`, `/home/neo1777/Scrivania/marzio1777-main/src/components/ui/index.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/components/Layout.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/config/tenant.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/components/audio/FullScreenPlayer.tsx` (uso `pt-safe`/`pb-safe` no-op).
