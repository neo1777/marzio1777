# N1777 Design System → Flutter (marzio1777) — Integrazione

> **Cos'è.** Il design di Neo (cartella `~/Scrivania/Design`) integrato nel piano di migrazione a
> Flutter. Sostituisce il "base-default neutro" che l'annesso frontend teneva come segnaposto.
> Da oggi **il design system di marzio1777-Flutter è il N1777 Design System.** 2026-06-30.
>
> **Fonte autoritativa dei token:** [`tokens/colors_and_type.css`](tokens/colors_and_type.css) (copiato qui).
> **Implementazione Flutter di riferimento:** [`flutter-ref/`](flutter-ref/) (`tokens.dart` + `components/`), estratta dal progetto `n1777_dashboard`.
> **Riferimento visivo:** [`previews/`](previews/) (PNG dei componenti + `cruscotto-esempio.png`).

## 1. La lingua del sistema — "ottone su inchiostro"

> *brass on ink · caldo-su-freddo.* L'inchiostro è **freddo**, il testo è **caldo** (off-white,
> **mai bianco puro**), l'accento è **unico**: l'ottone (brass). Registro **editoriale** e
> disciplinato: molta aria, raggi mai morbidi, movimento "il giusto e quando serve".

Verificato sul `cruscotto-esempio.png`: sfondo ink profondo, hero in serif ottico (`Fraunces`) con
una parola in brass, card a bordo tenue, **numeri-display grandi** (Fraunces), **etichette maiuscole
tracciate** (Archivo), dati in mono (JetBrains). È una superficie *scura per natura* — non un
dark-mode aggiunto.

## 2. Decisione da confermare — l'identità di Marzio

marzio1777 oggi è **caldo/paese** (seppia + verde). Il N1777 DS è **editoriale/ink+brass**. Sono
due lingue diverse: va deciso *come* Marzio parla la nuova.

| Opzione | Cosa significa | Quando |
|---|---|---|
| **A — N1777 come base + Marzio tenant caldo** *(raccomandata)* | Adotti la **struttura** N1777 (token, tipografia, componenti, spacing, motion) come default; l'**accento e alcune superfici** sono override per-istanza via `TenantConfig` (Marzio = brass→verde/oro, o un caldo-su-ink). | Coerente con la direzione multi-tenant (§0.4): il design system è il base-default, ogni comunità si ri-veste. Preserva sia N1777 sia il carattere di Marzio. |
| **B — Adozione integrale N1777** | Marzio diventa ink+brass come il Cruscotto. Identità unica, zero deriva. | Se vuoi che marzio abbia *esattamente* il tuo linguaggio, senza tema caldo. |

> **Raccomandazione: A.** Il N1777 DS entra come `ThemeExtension` di base (i token sotto), e
> `TenantConfig` (già seme del multi-tenant) porta l'**override d'istanza**: `accent`, `fontDisplay`,
> ed eventuali superfici. Così l'argomento "estingui la deriva di palette tokenizzando ora" (piano
> §2.4) si chiude **sui token N1777**, non su una palette inventata. *Serve solo il tuo OK su A vs B.*

## 3. Token → Flutter (`ThemeData` + `ThemeExtension`)

La fonte è `colors_and_type.css`. La `flutter-ref/tokens.dart` è uno **scaffold grezzo da allineare**
(vedi §5). Mappatura autoritativa:

### Colore (semantic → Dart)
```
bg          #0E1116   ink-000   scaffold / pagina
bg-raised   #141821   ink-100   card / superficie sollevata
bg-overlay  #1B212C   ink-200   popover / menu / input
bg-hover    #232B38   ink-300
bg-active   #2D3645   ink-400
fg          #EAE7DF   paper-100 testo primario (off-white CALDO)
fg-muted    #98A1AE   slate-300 secondario
fg-subtle   #6B7480   slate-400 placeholder/terziario
fg-disabled #4A515D   slate-500
accent      #D6A24C   brass-500     ·  hover #E6B96A (brass-400)  ·  press #B98837 (brass-600)
fg-on-accent#1A130A   (testo su ottone: inchiostro caldo scuro, NON nero)
border      rgba(234,231,223,.12)   subtle .07   strong .20   accent rgba(214,162,76,.32)
ok #6FA878 (salvia) · warn #D8B860 (oro) · danger #C75D67 (rosa-rosso freddo) · info #6E8CA8 (ardesia)
```
→ Un `ThemeExtension<N1777Colors>` porta questi come campi tipizzati; `ColorScheme.dark` mappa
`primary=accent`, `surface=bg-raised`, `onSurface=fg`, `error=danger`, `outline=border`.

### Tipografia (Google Fonts, tutte OFL)
- **Fraunces** — display/editoriale (hero, numeri-display, h1–h3). Assi ottici, `SOFT 0 / WONK 0`.
- **Archivo** — UI/corpo, e le **etichette maiuscole tracciate** (`letter-spacing .14em`, il marcatore del sistema).
- **JetBrains Mono** — dati/codice (`ss01`, `zero` on).
> `google_fonts` (già in `n1777_dashboard`): `GoogleFonts.fraunces()`, `.archivo()`, `.jetBrainsMono()`.

Scala (rem→sp): display **64** · h1 40 · h2 30 · h3 22 · title 17 · body 15 · sm 13 · label **11 (uppercase, tracked .14em)** · mono 13.
Leading 1.1/1.28/1.55/1.7. → un `TextTheme` costruito una volta da questi.

### Spazio · raggi · elevazione · movimento
- **Spazio** base 4px: 4·8·12·16·20·24·32·40·48·64·80·96.
- **Raggi** (disciplinati, mai morbidi): xs 3 · sm 6 · md 10 · lg 14 · pill 999.
- **Elevazione** = luce + bordo + ombra morbida. Ombre sm/md/lg + **sheen** (`inset 0 1px 0 rgba(234,231,223,.045)` — riflesso superiore che dà spessore) + **ring** focus brass (`0 0 0 3px rgba(214,162,76,.30)`).
- **Movimento**: `ease-out cubic-bezier(0.2,0,0,1)`, durate **120/180/260ms**. Breve e funzionale.
> In Flutter: sheen = un `BoxDecoration` con top inner highlight; ring = focus decoration su `FocusNode`; durate = costanti `Duration`.

## 4. Componenti → widget

La `flutter-ref/components/` ha già `BrassButton` (filled/outlined/ghost) e `BrassCard`; le preview
coprono buttons+stati, card, input, badges, menu, spacing, motion, tipografia. Mappa:

| N1777 | Widget Flutter | Note |
|---|---|---|
| `BrassButton` filled/outlined/ghost | `ElevatedButton`/`OutlinedButton`/`TextButton` con gli stili del `ThemeData` | filled = brass su fg-on-accent; outlined/ghost = testo brass |
| `BrassCard` | `Card` (bordo `border`, radius lg 14, sheen) | rimpiazza le primitive `ui/Card` di React |
| Stat card (numero-display) | `Card` + `Fraunces` size display + label uppercase | il pattern del Cruscotto (42 / 1 777 / 8 / 0%) |
| Etichetta | `Text` Archivo 11 uppercase tracked | il marcatore editoriale — usalo per le sezioni |
| Input | `TextField` con `inputDecorationTheme` (fill bg-overlay, focus brass 1.5) | |
| Badge / Menu | da `preview/comp-badges`, `comp-menu` | popover su bg-overlay |
| Dato/mono | `Text` JetBrains Mono | conteggi, id, timestamp |

Queste **rimpiazzano** le primitive scritte a mano `src/components/ui/*` di React (Button/Switch/
Dialog/Card…): nel porting non si reinventano, si adottano i widget N1777.

## 5. Allineamenti da fare (la ref Dart è grezza)

`flutter-ref/tokens.dart` è "extracted from cowork screenshots" e **diverge dal CSS autoritativo** —
va allineato prima dell'uso:
- **Font**: usa `Inter`/`Newsreader` → devono diventare **`Archivo`/`Fraunces`** (via `google_fonts`).
- **Brass**: `#C9A227` → **`#D6A24C`** (brass-500 del CSS); aggiungi hover `#E6B96A`, press `#B98837`.
- **Mancano** dal Dart: la **scala tipografica completa** + `TextTheme`, i **colori semantici** (ok/warn/danger/info), **sheen**, **ring** focus, le **durate** di motion, `fg-on-accent #1A130A`.
- `BrassButton` ha `fontFamily:'Inter'` hardcoded → togliere, ereditare dal tema.
> In pratica: si prende la struttura di `tokens.dart` (buona: `ThemeData` M3 + component themes) e la si **riempie dal CSS** come single source of truth.

## 6. Come si innesta nel piano

- **Supera `PLAN_ANNEX_frontend-design.md` §base-default**: quel segnaposto è chiuso. Il resto di
  quell'annesso (adaptive/responsive `LayoutBuilder`/`MediaQuery`, safe-area, stati vuoto/errore/
  caricamento, a11y `Semantics`, cura per pagina) **resta valido**, ora applicato ai token N1777.
- **Piano §2.4 (theming)**: la decisione "Tailwind→ThemeData + ThemeExtension, estingui la deriva"
  si concretizza **qui**: la `ThemeExtension` porta i token N1777; l'override per-istanza è `TenantConfig`.
- **A11y**: off-white caldo su ink freddo va **verificato WCAG** (paper-100 su ink-000 ≈ ottimo; ma
  `fg-subtle`/`fg-disabled` su bg vanno controllati); il **ring** brass è già il focus-indicator; le
  etichette 11px uppercase non devono restare l'unico veicolo d'informazione (screen-reader + `Semantics`).
- **Riuso diretto**: `n1777_dashboard` usa **Riverpod + go_router + google_fonts** — *lo stesso stack
  del piano*. La cartella `lib/core/design_system/` è **sollevabile** nel progetto marzio-Flutter e
  allineata (§5), invece di ricostruirla.

## 7. Assets in questa cartella
- `tokens/colors_and_type.css` — **fonte di verità** dei token.
- `flutter-ref/tokens.dart`, `flutter-ref/components/{brass_button,brass_card}.dart` — scaffold Dart da allineare.
- `co-design-piano-lavoro.md` — il piano di co-design N1777 (intento, processo).
- `previews/*.png` — riferimento visivo (colori, tipografia, componenti, spacing, motion) + `cruscotto-esempio.png`.
- Progetto completo di origine (non copiato): `~/Scrivania/Design/n1777_dashboard/` + `~/Scrivania/Design/Design/N1777 Design System/`.
