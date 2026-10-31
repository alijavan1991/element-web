/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ComposerApiFileReference } from "@element-hq/element-web-module-api";
import type { RoomMessageEventContent } from "matrix-js-sdk/src/types";

const isText = (value: unknown, min: number, max: number): value is string =>
    typeof value === "string" && value.length >= min && value.length <= max;

/**
 * Build the content of a file reference event, field by field, so nothing else a module passes can reach a Matrix event.
 * @param reference - The reference to send.
 * @param inReplyToEventId - The event this replies to, if any.
 * @throws If the reference does not match the schema.
 */
export function fileReferenceContent(
    reference: ComposerApiFileReference,
    inReplyToEventId?: string,
): RoomMessageEventContent {
    const { schema, file_id: fileId, file_version: fileVersion, classification, display } = reference;
    if (
        schema !== 1 ||
        typeof fileId !== "string" ||
        !/^[0-9a-f]{32}$/.test(fileId) ||
        typeof fileVersion !== "string" ||
        !/^[0-9a-f]{64}$/.test(fileVersion) ||
        !isText(classification, 1, 64) ||
        !isText(display?.name, 0, 1024) ||
        typeof display.content_type !== "string" ||
        !Number.isSafeInteger(display.size) ||
        display.size < 0
    ) {
        throw new Error("Invalid file reference");
    }
    const content = {
        msgtype: "io.zemzemeh.file_ref",
        // A fixed string, so reply previews and other clients show no filename.
        body: "Zemzemeh file",
        schema,
        file_id: fileId,
        file_version: fileVersion,
        classification,
        display: { name: display.name, content_type: display.content_type, size: display.size },
        ...(inReplyToEventId ? { "m.relates_to": { "m.in_reply_to": { event_id: inReplyToEventId } } } : {}),
    };
    // The SDK's type lists only standard message types; this custom one is agreed with the module's renderer.
    return content as unknown as RoomMessageEventContent;
}
