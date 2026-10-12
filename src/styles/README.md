# Styles

```
styles/
├── main.scss          Global entry, imported once in src/app/main.tsx. Declares layers: reset < base < ui.
├── base/              Global CSS
│   ├── _reset.scss    Box sizing, no default margins, controls inherit the font
│   ├── _themes.scss   Color tokens as CSS variables, light and [data-theme='dark']
│   └── _base.scss     body, focus ring
└── abstracts/         Sass only, no CSS output. `@use '@/styles/abstracts' as *;`
    ├── _tokens.scss       $color-*, $radius-*, $weight-*, sizes, motion
    ├── _functions.scss    space(n) → n × 4px
    ├── _breakpoints.scss  @include up(sm | lg)
    ├── _typography.scss   @include text(label), heading(display), eyebrow
    └── _mixins.scss       dark, hover, flex, center, square, truncate, visually-hidden, icon-tile, surface, spinner
```

Component styles live next to the component: `src/ui/Button/Button.module.scss`,
`src/features/auth/pages/LoginPage/LoginPage.module.scss`. See the Styles section in `CLAUDE.md`.

```scss
@use '@/styles/abstracts' as *;

.card {
  @include flex(column, $gap: space(3));
  padding: space(4);
  color: $color-ink;

  @include up(lg) {
    padding: space(6);
  }

  @include dark {
    color: $color-lime;
  }
}
```
