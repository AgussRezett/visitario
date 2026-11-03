# Versions

Visitario shows its version (`major.minor.patch`, from `package.json`) at the bottom of the
sidebar and of "Mi perfil"; its tooltip adds the commit Vercel built.

- **major**: the platform generation (2 = Visitario v2) or a change that breaks how people work.
- **minor**: a release with new features (`feat:` commits).
- **patch**: a release with fixes only (`fix:`, `style:`).

Bump `package.json` in the release PR. 2.1.0 is the first numbered release (reports panel).
