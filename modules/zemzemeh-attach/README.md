# Zemzemeh Attach Module

Adds **Attach from Zemzemeh** to the composer's upload menu. It frames Zemzemeh's file picker in a dialog, tells the
picker which room the file is for, receives a validated file reference, and sends it to the room with the fork's
`sendFileReference`. No file content, token or credential reaches Element, and the picker's address never names the room.

Messages are accepted only from the framed picker's window at the configured origin, and sent only to that origin.

References render as a file card. The card asks Zemzemeh about the file each time it appears, and what Zemzemeh verifies
wins over the event's values, which are untrusted. When a chat session has expired, a hidden picker frame renews it
silently; if it cannot, the card offers a sign-in window. Opening a file is not part of the card yet.

This module needs the fork: `sendFileReference` is not in upstream's Module API. It does not remove Element's own upload
option; see `ZEMZEMEH_PATCHES.md` in the repository root.

```
"modules": [
    "/modules/zemzemeh-attach/lib/index.js"
],
"io.zemzemeh.attach": {
    "zemzemeh_origin": "https://files.example"
}
```

`zemzemeh_origin` must be an exact origin: `http` or `https`, with no path, trailing slash, query or credentials. A bad
value stops the module loading. Without the setting the module adds nothing.

Zemzemeh must allow Element's origin to frame the picker (`CHAT_ELEMENT_ORIGIN` on its frontend service).

## Copyright & License

Copyright 2026 Zemzemeh. Part of the Element Web fork and licensed as the repository root's LICENSE files describe.
