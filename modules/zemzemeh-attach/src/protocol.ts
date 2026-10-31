/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod/mini";

/**
 * The content of a file reference event. Unknown fields are stripped, so nothing the picker adds can reach a Matrix event.
 */
export const FileRefContent = z.object({
    msgtype: z.literal("io.zemzemeh.file_ref"),
    body: z.literal("Zemzemeh file"),
    schema: z.literal(1),
    file_id: z.string().check(z.regex(/^[0-9a-f]{32}$/)),
    file_version: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
    classification: z.string().check(z.minLength(1), z.maxLength(64)),
    display: z.object({
        name: z.string().check(z.maxLength(1024)),
        content_type: z.string(),
        size: z.number().check(z.int(), z.nonnegative()),
    }),
});

export type FileRefContent = z.infer<typeof FileRefContent>;

const SelectedMessage = z.object({ type: z.literal("zemzemeh.picker.selected"), content: FileRefContent });

/**
 * A message the picker may send to the dialog.
 */
export type PickerMessage = { type: "ready" } | { type: "selected"; content: FileRefContent };

/**
 * Validate a message from the picker frame.
 * @param data - The message data, which the caller has already checked came from the picker's window and origin.
 * @returns The message, or null if it is not one the picker may send.
 */
export function parsePickerMessage(data: unknown): PickerMessage | null {
    if (typeof data !== "object" || data === null) return null;
    if ((data as { type?: unknown }).type === "zemzemeh.picker.ready") return { type: "ready" };
    const selected = SelectedMessage.safeParse(data);
    return selected.success ? { type: "selected", content: selected.data.content } : null;
}
