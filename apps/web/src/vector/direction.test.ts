/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { textDirection } from "./direction.ts";

describe("textDirection", () => {
    it.each(["fa", "he", "FA", "fa-IR", "fa_IR", "he-IL"])("should be right to left for %s", (language) => {
        expect(textDirection(language)).toBe("rtl");
    });

    it.each(["en", "en_EN", "en-GB", "fr", "zh_Hans", "fake", "hebrew", ""])(
        "should be left to right for %s",
        (language) => {
            expect(textDirection(language)).toBe("ltr");
        },
    );
});
