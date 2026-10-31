# Zemzemeh Attach Module

Adds **Attach from Zemzemeh** to the composer's upload menu. It frames Zemzemeh's file picker in a dialog, tells the
picker which room the file is for, and receives a validated file reference. No file content, token or credential
reaches Element, and the room ID never appears in an address.

Messages are accepted only from the framed picker's window at the configured origin, and sent only to that origin.

This module does not send the reference event yet, and it does not remove Element's own upload option. Both are later
fork changes; see `ZEMZEMEH_PATCHES.md` in the repository root.

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
