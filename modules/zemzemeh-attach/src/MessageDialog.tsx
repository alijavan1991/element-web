/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSX } from "react";

import type { DialogProps } from "@element-hq/element-web-module-api";

/**
 * Props for {@link MessageDialog}.
 */
export interface MessageDialogProps {
    /** What to tell the user. */
    text: string;
}

/**
 * A dialog that only tells the user something; they close it with the dialog's own button.
 */
export function MessageDialog({ text }: MessageDialogProps & DialogProps<void>): JSX.Element {
    return <p>{text}</p>;
}
