# Zemzemeh patches

Changes this fork carries on top of upstream Element Web. Keep this list current, and review it on each
rebase. Base: upstream `v1.12.33`, branch `zemzemeh/main`.

## Required recovery key

Zemzemeh requires device verification, and a user with no recovery key cannot verify a later device.

- `toasts/SetupEncryptionToast.tsx`: `set_up_recovery` opens a blocking dialog instead of a dismissible toast.
- `components/views/dialogs/security/RequiredRecoveryKeyDialog.tsx`: new. No skip, cancel or close; signing out
  is the only way out.
- `device-listener/DeviceListenerCurrentDevice.ts`: only working secret storage satisfies the check. The
  `io.element.recovery` and key backup account-data opt-outs, and dismissing other toasts, no longer do.
- `components/views/settings/encryption/ChangeRecoveryKeyBody.tsx`: `onCancelClick` is optional, and without it
  there is no cancel button.
- `i18n/strings/fa.json`: Persian for this flow. Machine-drafted; needs native review.

Upstream's "Can't confirm?" on the device verification screen is unchanged. It lets a user reset their identity,
which loses access to earlier encrypted history.

## Right-to-left interface

Upstream has no right-to-left support. Zemzemeh's users work in Persian.

- `apps/web/webpack.config.ts`: `postcss-rtlcss` generates `[dir="rtl"]` overrides at build time, so the 556
  left/right rules upstream keeps across 192 style files stay untouched and rebases stay clean. It runs on exit,
  after variables resolve. `safeBothPrefix` keeps a later reset winning over a flipped rule; it prefixes flippable
  rules with `[dir]`, so every page needs that attribute.
- `apps/web/src/vector/*/index.html`, `apps/web/src/vector/index.html`, `apps/web/src/usercontent/**/index.html`:
  `dir="ltr"` from the start, including when loading the language fails.
- `apps/web/src/vector/direction.ts`, `init.tsx`: `dir` follows the language (`fa`, `he`) at startup. Changing
  language already reloads the app.
- `apps/web/src/components/structures/MainSplit.tsx`: the right panel's handle is chosen in code, so it needs the
  side facing the room.
- `apps/web/res/css/_common.pcss`: Radix menus force `dir="ltr"` on themselves.
- `apps/web/res/css/views/rooms/_RoomHeader.pcss`: a Latin room name stays beside its avatar.
- `apps/web/res/css/views/rooms/_MessageComposer.pcss`: the send arrow points the way the text runs.

Do not patch `react-resizable-panels` for this: it orders panels by position on screen, so dragging and arrow keys
already follow the direction.

Check with `integrations/matrix/acceptance/rtl.cjs` in the Zemzemeh repository.

## Persian strings

- `apps/web/src/i18n/strings/fa.json`, `packages/shared-components/src/i18n/strings/fa.json`: 1,751 strings added,
  and a handful of existing ones corrected or aligned (`keyboard|space`, `common|space`, `common|threads`). All are
  machine-drafted and need native review. Developer tools strings stay in English.

Terms: room اتاق, space فضا, thread رشته گفتگو, device دستگاه, session نشست, recovery key کلید بازیابی, digital
identity هویت دیجیتال, widget ابزارک. On a rebase, upstream's translation updates may conflict with these files; keep
ours where upstream still has no string.
