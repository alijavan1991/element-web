/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentType, type SVGAttributes } from "react";

/**
 * An option presented to the user for uploading a file.
 * @alpha Unlikely to change
 */
export type ComposerApiFileUploadOption = {
    /**
     * An unique string to refer to the type of upload
     * @example org.example.my_uploader
     */
    type: string;
    /**
     * Human-readable string used in labelling for the option.
     */
    label: string;
    /**
     * An icon to attach to the option. If omitted, no icon is shown.
     */
    icon?: ComponentType<SVGAttributes<SVGElement>>;
    /**
     * Function called when the option is selected.
     * @param roomId - The room ID of the room in focus.
     * @param relation - Whether or not a thread and/or reply is in focus.
     * @returns
     */
    onSelected: (
        roomId?: string,
        view?: ComposerApiTarget,
        relation?: {
            inReplyToEventId?: string;
            relType?: string;
            threadRootEventId?: string;
        },
    ) => Promise<void> | void;
};

/**
 * A reference to a file held by Zemzemeh. It carries no bytes, storage key, credential or URL.
 * @alpha Zemzemeh fork only
 */
export type ComposerApiFileReference = {
    schema: 1;
    /** 32 lowercase hexadecimal characters. */
    file_id: string;
    /** 64 lowercase hexadecimal characters. */
    file_version: string;
    /** The file's classification label, 1 to 64 characters. */
    classification: string;
    display: {
        /** At most 1024 characters. */
        name: string;
        content_type: string;
        size: number;
    };
};

/**
 * When handling composer interactions, this represents the target composer.
 * @alpha Likely to change. This is intentionally left as an object so it may be extended later.
 */
export type ComposerApiTarget = { view: "room" } | { view: "thread" };

/**
 * API to interact with the message composer.
 * @alpha Likely to change
 */
export interface ComposerApi {
    /**
     * Add a new file upload option for the user.
     * @throws If another option is already using the same `type`.
     * @alpha Likely to change
     */
    addFileUploadOption(option: ComposerApiFileUploadOption): void;
    /**
     * Open the file upload confirmation dialog. This may be used in conjunction
     * with `addFileUploadOption` to support an alternative file upload kind.
     * @param files - The files to prompt for
     * @param view - The target view to send the file into. Defaults to `{ view: "room" }`
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    openFileUploadConfirmation(files: File[], view: ComposerApiTarget): void;
    /**
     * Insert plaintext into the current composer.
     * @param plaintext - The plain text to insert
     * @param view - The target view to insert text into. Defaults to `{ view: "room" }`
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertPlaintextIntoComposer(plaintext: string, view: ComposerApiTarget): void;
    /**
     * Send a file reference to a room. Only the fields of {@link ComposerApiFileReference} are sent.
     * @param roomId - The room to send to.
     * @param reference - The reference. Rejects without sending if it does not match the schema.
     * @param relation - The reply and thread to keep, from the upload option's `onSelected`.
     * @param view - The composer whose reply state to clear once a reply is sent. Defaults to `{ view: "room" }`
     * @returns The event ID.
     * @alpha Zemzemeh fork only
     */
    sendFileReference(
        roomId: string,
        reference: ComposerApiFileReference,
        relation?: { inReplyToEventId?: string; threadRootEventId?: string },
        view?: ComposerApiTarget,
    ): Promise<string>;
}
