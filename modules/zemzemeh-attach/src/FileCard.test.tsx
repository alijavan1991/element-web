/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { I18nApi, MatrixEvent } from "@element-hq/element-web-module-api";
import type { ChatSession } from "./ChatSession";
import { FileCard } from "./FileCard";

const ORIGIN = "https://files.example";
const ROOM = "!room:chat.example";
const FILE = "f".repeat(32);
const VERSION = "a".repeat(64);
const CONTENT = {
    msgtype: "io.zemzemeh.file_ref",
    body: "Zemzemeh file",
    schema: 1,
    file_id: FILE,
    file_version: VERSION,
    classification: "internal",
    display: { name: "from-event.pdf", content_type: "application/pdf", size: 1024 },
};
const VERIFIED = {
    state: "available",
    name: "verified.pdf",
    content_type: "application/pdf",
    size: 2048,
    classification: "confidential",
    version: VERSION,
    access: "room",
};

const reply = (status: number, body: unknown = {}): Response =>
    ({ status, ok: status < 400, json: async () => body }) as unknown as Response;

function setup(content: unknown = CONTENT, refresh = vi.fn(async () => true)) {
    const i18n = { language: "en", translate: (key: string) => key } as unknown as I18nApi;
    const mxEvent = { roomId: ROOM, content, type: "m.room.message" } as unknown as MatrixEvent;
    const session = { refresh } as unknown as ChatSession;
    const view = render(<FileCard mxEvent={mxEvent} origin={ORIGIN} i18n={i18n} session={session} />);
    return { ...view, refresh };
}

describe("FileCard", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    test.each([
        ["a bad file ID", { ...CONTENT, file_id: "nope" }],
        ["no display", { ...CONTENT, display: undefined }],
        ["another schema", { ...CONTENT, schema: 2 }],
        ["a name that is not text", { ...CONTENT, display: { ...CONTENT.display, name: { toString: "x" } } }],
    ])("a malformed event with %s is no card and asks Zemzemeh nothing", async (_name, content) => {
        setup(content);
        expect(screen.getByText("zemzemeh_card_invalid")).toBeTruthy();
        expect(screen.queryByTestId("zemzemeh-file-card")).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("asks Zemzemeh for this room and version, with the session cookie and nothing else", async () => {
        fetchMock.mockResolvedValue(reply(200, VERIFIED));
        setup();
        await screen.findByText("verified.pdf");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${ORIGIN}/api/chat/refs/${FILE}?room_id=${encodeURIComponent(ROOM)}&version=${VERSION}`);
        expect(init.credentials).toBe("include");
        expect(init.referrerPolicy).toBe("no-referrer");
        expect(init.headers).toBeUndefined();
    });

    test("verified metadata wins over the event's values", async () => {
        fetchMock.mockResolvedValue(reply(200, VERIFIED));
        setup();
        await screen.findByText("verified.pdf");
        expect(screen.queryByText("from-event.pdf")).toBeNull();
        expect(screen.getByTestId("zemzemeh-file-card").textContent).toContain("zemzemeh_label_confidential");
        expect(screen.queryByText("zemzemeh_card_unverified")).toBeNull();
    });

    test("while checking it shows none of the event's values, so a lie is never shown without its warning", async () => {
        fetchMock.mockReturnValue(new Promise(() => {}));
        setup();
        expect(screen.getByRole("status").textContent).toBe("zemzemeh_card_checking");
        const card = screen.getByTestId("zemzemeh-file-card").textContent;
        expect(card).not.toContain("from-event.pdf");
        expect(card).not.toContain("zemzemeh_label_internal");
    });

    test("an available file opens in the viewer, in its own tab, for this room and version", async () => {
        fetchMock.mockResolvedValue(reply(200, VERIFIED));
        setup();
        const link = await screen.findByRole("link", { name: "zemzemeh_card_open" });
        expect(link.getAttribute("href")).toBe(
            `${ORIGIN}/chat/view/${FILE}?room_id=${encodeURIComponent(ROOM)}&version=${VERSION}&lang=en`,
        );
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    test.each([
        ["changed", () => reply(200, { state: "changed" }), "zemzemeh_card_changed"],
        ["unavailable", () => reply(404), "zemzemeh_card_unavailable"],
        ["unreachable", () => reply(503), "zemzemeh_card_retry_text"],
    ])("a file that is %s has nothing to open", async (_name, answer, text) => {
        fetchMock.mockResolvedValue(answer());
        setup();
        await screen.findByText(text);
        expect(screen.queryByRole("link")).toBeNull();
    });

    test("event values are shown as text, never as markup", async () => {
        const name = '<img src=x onerror="alert(1)">';
        fetchMock.mockResolvedValue(reply(404));
        const { container } = setup({ ...CONTENT, display: { ...CONTENT.display, name } });
        await screen.findByText(name);
        expect(container.querySelector("img")).toBeNull();
    });

    test("an unknown label is shown as it is", async () => {
        fetchMock.mockResolvedValue(reply(200, { ...VERIFIED, classification: "team-only" }));
        setup();
        await screen.findByText("verified.pdf");
        expect(screen.getByTestId("zemzemeh-file-card").textContent).toContain("team-only");
    });

    test("a changed file says so and labels the event's values as the sender's", async () => {
        fetchMock.mockResolvedValue(reply(200, { state: "changed" }));
        setup();
        await screen.findByText("zemzemeh_card_changed");
        expect(screen.getByText("from-event.pdf")).toBeTruthy();
        expect(screen.getByText("zemzemeh_card_unverified")).toBeTruthy();
    });

    test("a refusal says the file is unavailable and labels the event's values as the sender's", async () => {
        fetchMock.mockResolvedValue(reply(404));
        setup();
        await screen.findByText("zemzemeh_card_unavailable");
        expect(screen.getByText("from-event.pdf")).toBeTruthy();
        expect(screen.getByText("zemzemeh_card_unverified")).toBeTruthy();
    });

    test.each([
        ["an outage", () => reply(503)],
        ["a malformed answer", () => reply(200, { state: "available", name: 1 })],
    ])("%s offers another try, which works once Zemzemeh answers", async (_name, first) => {
        fetchMock.mockResolvedValueOnce(first());
        setup();
        await screen.findByText("zemzemeh_card_retry_text");
        expect(screen.getByText("zemzemeh_card_unverified")).toBeTruthy();
        fetchMock.mockResolvedValueOnce(reply(200, VERIFIED));
        fireEvent.click(screen.getByRole("button", { name: "zemzemeh_card_try_again" }));
        await screen.findByText("verified.pdf");
    });

    test("an unreachable Zemzemeh offers another try", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        setup();
        expect(await screen.findByText("zemzemeh_card_retry_text")).toBeTruthy();
    });

    test("an answer that never comes offers another try instead of checking forever", async () => {
        const deadline = new AbortController();
        const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
        fetchMock.mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
                }),
        );
        setup();
        expect(timeout).toHaveBeenCalledExactlyOnceWith(15_000);
        expect(screen.getByRole("status")).toBeTruthy();
        deadline.abort();
        expect(await screen.findByText("zemzemeh_card_retry_text")).toBeTruthy();
        timeout.mockRestore();
    });

    test("an expired session is renewed once without asking, then the card loads", async () => {
        fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200, VERIFIED));
        const { refresh } = setup();
        await screen.findByText("verified.pdf");
        expect(refresh).toHaveBeenCalledExactlyOnceWith(false);
    });

    test("when it cannot be renewed the card offers a sign-in window and another try", async () => {
        fetchMock.mockResolvedValue(reply(401));
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        const { refresh } = setup(
            CONTENT,
            vi.fn(async () => false),
        );
        await screen.findByText("zemzemeh_card_signin_text");
        expect(screen.getByText("zemzemeh_card_unverified")).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledOnce();

        fireEvent.click(screen.getByRole("button", { name: "zemzemeh_card_signin" }));
        expect(open).toHaveBeenCalledExactlyOnceWith(
            `${ORIGIN}/auth/chat/login?interactive=true&next=/chat/signed-in`,
            "_blank",
            "noopener",
        );

        fetchMock.mockReset();
        fetchMock.mockResolvedValue(reply(200, VERIFIED));
        fireEvent.click(screen.getByRole("button", { name: "zemzemeh_card_try_again" }));
        await screen.findByText("verified.pdf");
        expect(refresh).toHaveBeenCalledOnce();
    });

    test("a manual try after a failed renewal renews again, past the wait between attempts", async () => {
        fetchMock.mockResolvedValue(reply(401));
        const { refresh } = setup(
            CONTENT,
            vi.fn(async () => false),
        );
        await screen.findByText("zemzemeh_card_signin_text");
        fireEvent.click(screen.getByRole("button", { name: "zemzemeh_card_try_again" }));
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
        expect(refresh).toHaveBeenLastCalledWith(true);
    });

    test("stays within narrow columns and lets the name run its own direction", async () => {
        fetchMock.mockResolvedValue(reply(200, VERIFIED));
        setup();
        const name = await screen.findByText("verified.pdf");
        expect(name.tagName).toBe("BDI");
        const card = screen.getByTestId("zemzemeh-file-card");
        expect(card.style.maxWidth).toBe("100%");
        expect(card.style.overflowWrap).toBe("anywhere");
    });

    test("stops asking when it leaves the timeline", async () => {
        fetchMock.mockReturnValue(new Promise(() => {}));
        const { unmount } = setup();
        const { signal } = fetchMock.mock.calls[0][1];
        expect(signal.aborted).toBe(false);
        unmount();
        expect(signal.aborted).toBe(true);
    });
});
