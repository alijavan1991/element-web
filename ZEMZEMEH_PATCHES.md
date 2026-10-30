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
