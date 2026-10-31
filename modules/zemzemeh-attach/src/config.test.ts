/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, test } from "vitest";

import { ModuleConfig } from "./config";

describe("ModuleConfig", () => {
    test.each(["https://files.example", "http://files.zemzemeh.localhost:18000"])("accepts the origin %s", (origin) => {
        expect(ModuleConfig.parse({ zemzemeh_origin: origin })).toEqual({ zemzemeh_origin: origin });
    });

    test.each([
        ["a path", "https://files.example/picker"],
        ["a trailing slash", "https://files.example/"],
        ["a query", "https://files.example?x=1"],
        ["credentials", "https://user:secret@files.example"],
        ["another scheme", "javascript://files.example"],
        ["no scheme", "files.example"],
        ["a wildcard", "*"],
        ["nothing", ""],
    ])("refuses %s", (_name, origin) => {
        expect(ModuleConfig.safeParse({ zemzemeh_origin: origin }).success).toBe(false);
    });

    test("refuses a missing origin", () => {
        expect(ModuleConfig.safeParse({}).success).toBe(false);
    });
});
