/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PickerDialog } from "./PickerDialog";

const ORIGIN = "https://files.example";
const ROOM = "!room:chat.example";
const CONTENT = {
    msgtype: "io.zemzemeh.file_ref",
    body: "Zemzemeh file",
    schema: 1,
    file_id: "f".repeat(32),
    file_version: "a".repeat(64),
    classification: "internal",
    display: { name: "report.pdf", content_type: "application/pdf", size: 1024 },
};

function setup(language = "en") {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const view = render(
        <PickerDialog
            origin={ORIGIN}
            roomId={ROOM}
            language={language}
            title="Attach"
            onSubmit={onSubmit}
            onCancel={onCancel}
        />,
    );
    const frame = view.container.querySelector("iframe")!;
    const post = vi.fn();
    const source = { postMessage: post } as unknown as Window;
    Object.defineProperty(frame, "contentWindow", { configurable: true, value: source });
    const send = (data: unknown, overrides: { origin?: string; source?: unknown } = {}) =>
        act(() => {
            const event = new MessageEvent("message", { data, origin: overrides.origin ?? ORIGIN });
            Object.defineProperty(event, "source", { value: "source" in overrides ? overrides.source : source });
            window.dispatchEvent(event);
        });
    return { ...view, frame, post, onSubmit, send };
}

describe("PickerDialog", () => {
    afterEach(cleanup);

    test("frames the picker at the configured origin, sandboxed", () => {
        const { frame } = setup();
        expect(frame.getAttribute("src")).toBe(`${ORIGIN}/chat/picker?lang=en`);
        expect(frame.getAttribute("sandbox")).toBe(
            "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
        );
        expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
        expect(frame.getAttribute("title")).toBe("Attach");
    });

    test.each([
        ["fa", "fa"],
        ["fa-IR", "fa"],
        ["en-GB", "en"],
        ["de", "en"],
    ])("maps Element's language %s to the picker's %s", (language, expected) => {
        expect(setup(language).frame.getAttribute("src")).toBe(`${ORIGIN}/chat/picker?lang=${expected}`);
        cleanup();
    });

    test("no room ID appears in the frame's address", () => {
        expect(setup().frame.getAttribute("src")).not.toContain("room");
    });

    test("answers ready with the room, addressed to the exact origin", () => {
        const { post, send } = setup();
        send({ type: "zemzemeh.picker.ready" });
        expect(post).toHaveBeenCalledExactlyOnceWith({ type: "zemzemeh.picker.init", roomId: ROOM }, ORIGIN);
    });

    test("submits a selected reference", () => {
        const { onSubmit, send } = setup();
        send({ type: "zemzemeh.picker.selected", content: { ...CONTENT, url: "mxc://evil" } });
        expect(onSubmit).toHaveBeenCalledExactlyOnceWith(CONTENT);
    });

    test.each([
        ["another origin", { origin: "https://evil.example" }],
        ["a lookalike origin", { origin: `${ORIGIN}.evil.example` }],
        ["another window", { source: {} }],
        ["no window", { source: null }],
    ])("ignores messages from %s", (_name, overrides) => {
        const { post, onSubmit, send } = setup();
        send({ type: "zemzemeh.picker.ready" }, overrides);
        send({ type: "zemzemeh.picker.selected", content: CONTENT }, overrides);
        expect(post).not.toHaveBeenCalled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test("ignores malformed messages", () => {
        const { post, onSubmit, send } = setup();
        send("text");
        send({ type: "zemzemeh.picker.selected", content: { ...CONTENT, file_id: "nope" } });
        expect(post).not.toHaveBeenCalled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test("stops listening when closed", () => {
        const { onSubmit, send, unmount } = setup();
        unmount();
        send({ type: "zemzemeh.picker.selected", content: CONTENT });
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
