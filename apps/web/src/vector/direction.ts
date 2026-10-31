/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// The right-to-left languages this app ships strings for.
const RTL_LANGUAGES = new Set(["fa", "he"]);

/**
 * The text direction of the interface for a language.
 * @param language - a language tag such as "fa", "fa-IR" or "zh_Hans"
 */
export function textDirection(language: string): "ltr" | "rtl" {
    const primary = language.split(/[-_]/)[0].toLowerCase();
    return RTL_LANGUAGES.has(primary) ? "rtl" : "ltr";
}
