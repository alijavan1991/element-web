/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, test } from "vitest";

import { parsePickerMessage } from "./protocol";

const CONTENT = {
    msgtype: "io.zemzemeh.file_ref",
    body: "Zemzemeh file",
    schema: 1,
    file_id: "f".repeat(32),
    file_version: "a".repeat(64),
    classification: "internal",
    display: { name: "report.pdf", content_type: "application/pdf", size: 1024 },
};

describe("parsePickerMessage", () => {
    test("accepts ready", () => {
        expect(parsePickerMessage({ type: "zemzemeh.picker.ready" })).toEqual({ type: "ready" });
    });

    test("accepts a selected reference", () => {
        expect(parsePickerMessage({ type: "zemzemeh.picker.selected", content: CONTENT })).toEqual({
            type: "selected",
            content: CONTENT,
        });
    });

    test("strips unknown fields, so nothing extra can reach a Matrix event", () => {
        const parsed = parsePickerMessage({
            type: "zemzemeh.picker.selected",
            extra: true,
            content: {
                ...CONTENT,
                url: "mxc://evil",
                token: "secret",
                display: { ...CONTENT.display, url: "mxc://evil" },
            },
        });
        expect(parsed).toEqual({ type: "selected", content: CONTENT });
    });

    test.each([
        ["text", "hello"],
        ["null", null],
        ["an unknown type", { type: "zemzemeh.picker.other" }],
        ["no content", { type: "zemzemeh.picker.selected" }],
        ["another msgtype", { ...CONTENT, msgtype: "m.file" }],
        ["another schema", { ...CONTENT, schema: 2 }],
        ["a short file ID", { ...CONTENT, file_id: "abc" }],
        ["an uppercase file ID", { ...CONTENT, file_id: "F".repeat(32) }],
        ["a short version", { ...CONTENT, file_version: "abc" }],
        ["an empty label", { ...CONTENT, classification: "" }],
        ["a long label", { ...CONTENT, classification: "x".repeat(65) }],
        ["no display", { ...CONTENT, display: undefined }],
        ["a long name", { ...CONTENT, display: { ...CONTENT.display, name: "x".repeat(1025) } }],
        ["a negative size", { ...CONTENT, display: { ...CONTENT.display, size: -1 } }],
        ["a fractional size", { ...CONTENT, display: { ...CONTENT.display, size: 1.5 } }],
    ])("refuses %s", (_name, content) => {
        const data =
            typeof content === "object" && content && "msgtype" in content
                ? { type: "zemzemeh.picker.selected", content }
                : content;
        expect(parsePickerMessage(data)).toBeNull();
    });
});
