/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixClient, UploadResponse } from "matrix-js-sdk/src/matrix";

const originals = new WeakMap<MatrixClient, MatrixClient["uploadContent"]>();

/**
 * Attachments come from Zemzemeh, so every upload is refused unless it goes through {@link uploadAvatar}.
 * A caller added upstream therefore fails closed. The server enforces this too; this only gives a clear error.
 */
export function guardUploads(client: MatrixClient): void {
    if (originals.has(client)) return;
    originals.set(client, client.uploadContent.bind(client));
    client.uploadContent = () => Promise.reject(new Error("Uploads are disabled: attachments come from Zemzemeh"));
}

/** Uploads an avatar. The server's gateway re-encodes it into a small image whatever is sent here. */
export function uploadAvatar(client: MatrixClient, file: File): Promise<UploadResponse> {
    const upload = originals.get(client);
    return upload ? upload(file) : client.uploadContent(file);
}
