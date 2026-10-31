/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import { TimelineRenderingType } from "../contexts/RoomContext";
import { Action } from "../dispatcher/actions";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { type ComposerInsertPayload, ComposerType } from "../dispatcher/payloads/ComposerInsertPayload";
import { ComposerApi, ModuleComposerApiEvents } from "./ComposerApi";
import { MatrixClientPeg } from "../MatrixClientPeg";
import type { ComposerInsertFilesPayload } from "../dispatcher/payloads/ComposerInsertFilePayload";

const REFERENCE = {
    schema: 1 as const,
    file_id: "f".repeat(32),
    file_version: "a".repeat(64),
    classification: "internal",
    display: { name: "report.pdf", content_type: "application/pdf", size: 1024 },
};
const CONTENT = { msgtype: "io.zemzemeh.file_ref", body: "Zemzemeh file", ...REFERENCE };

describe("ComposerApi", () => {
    describe("sendFileReference()", () => {
        function setup() {
            const sendEvent = vi.fn().mockResolvedValue({ event_id: "$sent" });
            vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue({ sendEvent } as never);
            return { sendEvent, api: new ComposerApi({ dispatch: vi.fn() } as unknown as MatrixDispatcher) };
        }

        it("sends the reference as a room message and returns the event ID", async () => {
            const { api, sendEvent } = setup();
            await expect(api.sendFileReference("!room:example", REFERENCE)).resolves.toBe("$sent");
            expect(sendEvent).toHaveBeenCalledExactlyOnceWith("!room:example", null, "m.room.message", CONTENT);
        });

        it("strips everything the schema does not name", async () => {
            const { api, sendEvent } = setup();
            await api.sendFileReference("!room:example", {
                ...REFERENCE,
                url: "mxc://evil",
                body: "report.pdf",
                msgtype: "m.file",
                file: { url: "mxc://evil" },
                display: { ...REFERENCE.display, url: "mxc://evil" },
            } as never);
            expect(sendEvent.mock.calls[0][3]).toEqual(CONTENT);
        });

        it.each([
            ["another schema", { ...REFERENCE, schema: 2 }],
            ["a short file ID", { ...REFERENCE, file_id: "abc" }],
            ["an uppercase file ID", { ...REFERENCE, file_id: "F".repeat(32) }],
            ["a short version", { ...REFERENCE, file_version: "abc" }],
            ["an empty label", { ...REFERENCE, classification: "" }],
            ["a long label", { ...REFERENCE, classification: "x".repeat(65) }],
            ["no display", { ...REFERENCE, display: undefined }],
            ["a long name", { ...REFERENCE, display: { ...REFERENCE.display, name: "x".repeat(1025) } }],
            ["a type that is not text", { ...REFERENCE, display: { ...REFERENCE.display, content_type: 1 } }],
            ["a negative size", { ...REFERENCE, display: { ...REFERENCE.display, size: -1 } }],
            ["a fractional size", { ...REFERENCE, display: { ...REFERENCE.display, size: 1.5 } }],
        ])("refuses %s and sends nothing", async (_name, reference) => {
            const { api, sendEvent } = setup();
            await expect(api.sendFileReference("!room:example", reference as never)).rejects.toThrow();
            expect(sendEvent).not.toHaveBeenCalled();
        });

        it("keeps a reply", async () => {
            const { api, sendEvent } = setup();
            await api.sendFileReference("!room:example", REFERENCE, { inReplyToEventId: "$parent" });
            expect(sendEvent).toHaveBeenCalledExactlyOnceWith("!room:example", null, "m.room.message", {
                ...CONTENT,
                "m.relates_to": { "m.in_reply_to": { event_id: "$parent" } },
            });
        });

        it("clears the composer's reply state once the reply is sent", async () => {
            const { sendEvent } = setup();
            const dispatch = vi.fn();
            const api = new ComposerApi({ dispatch } as unknown as MatrixDispatcher);
            await api.sendFileReference(
                "!room:example",
                REFERENCE,
                { inReplyToEventId: "$parent" },
                { view: "thread" },
            );
            expect(sendEvent).toHaveBeenCalledOnce();
            expect(dispatch).toHaveBeenCalledExactlyOnceWith({
                action: "reply_to_event",
                event: null,
                context: TimelineRenderingType.Thread,
            });
        });

        it("keeps the reply state when the send fails, and without a reply clears nothing", async () => {
            const { sendEvent } = setup();
            const dispatch = vi.fn();
            const api = new ComposerApi({ dispatch } as unknown as MatrixDispatcher);
            await api.sendFileReference("!room:example", REFERENCE);
            sendEvent.mockRejectedValueOnce(new Error("offline"));
            await expect(
                api.sendFileReference("!room:example", REFERENCE, { inReplyToEventId: "$p" }),
            ).rejects.toThrow();
            expect(dispatch).not.toHaveBeenCalled();
        });

        it("keeps a thread, leaving its fallback to the SDK", async () => {
            const { api, sendEvent } = setup();
            await api.sendFileReference("!room:example", REFERENCE, { threadRootEventId: "$root" });
            expect(sendEvent).toHaveBeenCalledExactlyOnceWith("!room:example", "$root", "m.room.message", CONTENT);
        });

        it("keeps a reply inside a thread", async () => {
            const { api, sendEvent } = setup();
            await api.sendFileReference("!room:example", REFERENCE, {
                threadRootEventId: "$root",
                inReplyToEventId: "$parent",
            });
            expect(sendEvent).toHaveBeenCalledExactlyOnceWith("!room:example", "$root", "m.room.message", {
                ...CONTENT,
                "m.relates_to": { "m.in_reply_to": { event_id: "$parent" } },
            });
        });
    });

    describe("insertPlaintextIntoComposer()", () => {
        it("should be able to insert text", () => {
            const dispatcher = {
                dispatch: vi.fn(),
            } as unknown as MatrixDispatcher;
            const api = new ComposerApi(dispatcher);
            api.insertPlaintextIntoComposer("Hello world", { view: "room" });
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ComposerInsert,
                text: "Hello world",
                timelineRenderingType: TimelineRenderingType.Room,
                composerType: ComposerType.Send,
            } satisfies ComposerInsertPayload);
        });
        it("throws if called with an invalid view", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            expect(() => api.insertPlaintextIntoComposer("text", { view: "bleh" as "room" })).toThrow(
                "Invalid view 'bleh'",
            );
        });
    });
    describe("openFileUploadConfirmation()", () => {
        it("should be able to initiate a file upload", () => {
            const dispatcher = {
                dispatch: vi.fn(),
            } as unknown as MatrixDispatcher;
            const api = new ComposerApi(dispatcher);
            const files = [new File(["test"], "test.txt")];
            api.openFileUploadConfirmation(files, { view: "room" });
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ComposerFileInsert,
                files: files,
                timelineRenderingType: TimelineRenderingType.Room,
            } satisfies ComposerInsertFilesPayload);
        });
        it("throws if called with an invalid view", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            const files = [new File(["test"], "test.txt")];
            expect(() => api.openFileUploadConfirmation(files, { view: "bleh" as "room" })).toThrow(
                "Invalid view 'bleh'",
            );
        });
    });
    describe("addFileUploadOption()", () => {
        it("should be able to add a file upload option", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            const eventCb = vi.fn();
            api.on(ModuleComposerApiEvents.UploaderOptionsChanged, eventCb);
            const option = { type: "an_option", label: "New option", onSelected: () => {} };
            api.addFileUploadOption(option);
            expect(api.fileUploadOptions).toHaveLength(1);
            expect(api.fileUploadOptions).toContain(option);
            expect(eventCb).toHaveBeenCalledWith(option);
        });
        it("throws if called with the type 'local'", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            expect(() => api.addFileUploadOption({ type: "local", label: "New option", onSelected: () => {} })).toThrow(
                'Option "local" is reserved',
            );
        });
        it("throws if called with a duplicate type", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            const option = { type: "an_option", label: "New option", onSelected: () => {} };
            api.addFileUploadOption(option);
            expect(() => api.addFileUploadOption({ ...option })).toThrow('Option "an_option" already exists');
        });
    });
});
