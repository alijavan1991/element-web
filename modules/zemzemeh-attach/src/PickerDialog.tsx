/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX, useEffect, useRef } from "react";

import type { DialogProps } from "@element-hq/element-web-module-api";
import { type FileRefContent, parsePickerMessage, PICKER_SANDBOX } from "./protocol";

/**
 * Props for {@link PickerDialog}.
 */
export interface PickerDialogProps {
    /** The exact origin of Zemzemeh. */
    origin: string;
    /** The room the file is being attached to. It goes to the picker by message, never in the address. */
    roomId: string;
    /** Element's language, as an IETF tag. */
    language: string;
    /** The accessible name of the frame. */
    title: string;
}

function pickerLanguage(language: string): "fa" | "en" {
    return language.toLowerCase().split(/[-_]/)[0] === "fa" ? "fa" : "en";
}

/**
 * Frames Zemzemeh's file picker and passes on the reference it selects. The picker holds the session and the file
 * list, so no token or file content reaches Element.
 */
export function PickerDialog({
    origin,
    roomId,
    language,
    title,
    onSubmit,
}: PickerDialogProps & DialogProps<FileRefContent>): JSX.Element {
    const frame = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const onMessage = (event: MessageEvent): void => {
            const picker = frame.current?.contentWindow;
            if (!picker || event.source !== picker || event.origin !== origin) return;
            const message = parsePickerMessage(event.data);
            if (message?.type === "ready") {
                picker.postMessage({ type: "zemzemeh.picker.init", roomId }, origin);
            } else if (message?.type === "selected") {
                onSubmit(message.content);
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [origin, roomId, onSubmit]);

    return (
        <iframe
            ref={frame}
            src={`${origin}/chat/picker?lang=${pickerLanguage(language)}`}
            title={title}
            sandbox={PICKER_SANDBOX}
            referrerPolicy="no-referrer"
            style={{ display: "block", width: "100%", height: "min(70vh, 560px)", border: 0 }}
        />
    );
}
