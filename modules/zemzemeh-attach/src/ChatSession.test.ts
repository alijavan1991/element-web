/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ChatSession } from "./ChatSession";

const ORIGIN = "https://files.example";

const frames = (): HTMLIFrameElement[] => [...document.querySelectorAll<HTMLIFrameElement>("iframe")];

function answer(frame: HTMLIFrameElement, overrides: { origin?: string; source?: unknown; type?: string } = {}): void {
    // The frame always has its own window, so a message from elsewhere is ignored for being from elsewhere.
    const own = {};
    Object.defineProperty(frame, "contentWindow", { configurable: true, value: own });
    const event = new MessageEvent("message", {
        data: { type: overrides.type ?? "zemzemeh.picker.ready" },
        origin: overrides.origin ?? ORIGIN,
    });
    Object.defineProperty(event, "source", { value: "source" in overrides ? overrides.source : own });
    window.dispatchEvent(event);
}

describe("ChatSession", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.replaceChildren();
    });

    test("signs in through a hidden picker frame, which says ready only with a session", async () => {
        const refresh = new ChatSession(ORIGIN).refresh();
        const [frame] = frames();
        expect(frame.getAttribute("src")).toBe(`${ORIGIN}/chat/picker`);
        expect(frame.hidden).toBe(true);
        expect(frame.getAttribute("sandbox")).toContain("allow-same-origin");
        answer(frame);
        await expect(refresh).resolves.toBe(true);
        expect(frames()).toEqual([]);
    });

    test("many cards share one attempt", async () => {
        const session = new ChatSession(ORIGIN);
        const results = [session.refresh(), session.refresh(), session.refresh()];
        expect(frames()).toHaveLength(1);
        answer(frames()[0]);
        await expect(Promise.all(results)).resolves.toEqual([true, true, true]);
    });

    test("gives up when no answer comes, and removes the frame", async () => {
        const refresh = new ChatSession(ORIGIN).refresh();
        await vi.advanceTimersByTimeAsync(10_000);
        await expect(refresh).resolves.toBe(false);
        expect(frames()).toEqual([]);
    });

    test.each([
        ["another origin", { origin: "https://evil.example" }],
        ["another window", { source: {} }],
        ["no window", { source: null }],
        ["another message", { type: "zemzemeh.picker.selected" }],
    ])("does not count a message from %s", async (_name, overrides) => {
        const refresh = new ChatSession(ORIGIN).refresh();
        answer(frames()[0], overrides);
        await vi.advanceTimersByTimeAsync(10_000);
        await expect(refresh).resolves.toBe(false);
    });

    test("after a failure it waits before trying again, so scrolling cards do not keep framing", async () => {
        const session = new ChatSession(ORIGIN);
        const first = session.refresh();
        await vi.advanceTimersByTimeAsync(10_000);
        await first;
        await expect(session.refresh()).resolves.toBe(false);
        expect(frames()).toEqual([]);

        await vi.advanceTimersByTimeAsync(60_000);
        void session.refresh();
        expect(frames()).toHaveLength(1);
    });

    test("a person asking to try again does not wait", async () => {
        const session = new ChatSession(ORIGIN);
        const first = session.refresh();
        await vi.advanceTimersByTimeAsync(10_000);
        await first;
        const again = session.refresh(true);
        expect(frames()).toHaveLength(1);
        answer(frames()[0]);
        await expect(again).resolves.toBe(true);
    });

    test("stops listening once finished", async () => {
        const remove = vi.spyOn(window, "removeEventListener");
        const refresh = new ChatSession(ORIGIN).refresh();
        answer(frames()[0]);
        await refresh;
        expect(remove).toHaveBeenCalledWith("message", expect.any(Function));
    });
});
