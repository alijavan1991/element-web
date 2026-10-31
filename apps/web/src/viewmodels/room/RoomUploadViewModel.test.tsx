/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import {
    type IEventRelation,
    type MatrixClient,
    type MatrixEvent,
    type Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { vi, describe, it, expect, beforeEach, afterEach, afterAll, type MockedObject } from "vitest";
import { getRoomContext, mkEvent, mkStubRoom, stubClient } from "test-utils";

import { RoomUploadContextProvider, RoomUploadViewModel } from "./RoomUploadViewModel";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import defaultDispatcher, { MatrixDispatcher } from "../../dispatcher/dispatcher";
import ContentMessages from "../../ContentMessages";
import { ComposerApi } from "../../modules/ComposerApi";
import type { ComposerInsertFilesPayload } from "../../dispatcher/payloads/ComposerInsertFilePayload";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext";
import { Action } from "../../dispatcher/actions";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { PosthogAnalytics } from "../../PosthogAnalytics";

const sendContentListToRoomSpy = vi.spyOn(ContentMessages.sharedInstance(), "sendContentListToRoom");

describe("RoomUploadViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let room: MockedObject<Room>;
    beforeEach(() => {
        vi.clearAllMocks();
        client = stubClient() as MockedObject<MatrixClient>;
        room = mkStubRoom("!room", undefined, undefined) as MockedObject<Room>;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it.each([true, false])("handles state when room.maySendMessage = %s", (maySendMessage) => {
        room.maySendMessage.mockReturnValue(maySendMessage);
        const vm = new RoomUploadViewModel(room, TimelineRenderingType.Room, undefined, undefined);
        // Attachments come from a module, so without one no option exists whatever the permission.
        expect(vm.getSnapshot().options).toHaveLength(0);
        expect(vm.getSnapshot().mayDragAndDropFile).toBe(false);
        room.maySendMessage.mockReturnValue(!maySendMessage);
        room.emit(RoomEvent.CurrentStateUpdated, room, null as any, null as any);
        expect(vm.getSnapshot().options).toHaveLength(0);
        expect(vm.getSnapshot().mayDragAndDropFile).toBe(false);
    });

    it("handles custom upload option", async () => {
        const compApi = new ComposerApi(new MatrixDispatcher());
        const replyEv = mkEvent({ type: "fake", content: {}, user: "any", event: true });
        const vm = new RoomUploadViewModel(
            room,
            TimelineRenderingType.Room,
            replyEv,
            {
                rel_type: "any_type",
                event_id: "$any_event",
            },
            compApi,
        );
        const onSelected = vi.fn();
        const icon = { myicon: 5 } as any;
        compApi.addFileUploadOption({
            type: "org.example.test",
            label: "My uploader",
            icon,
            onSelected,
        });
        // The module option is the only one: the built-in local option is gone.
        expect(vm.getSnapshot().options).toEqual([{ type: "org.example.test", label: "My uploader", icon }]);
        vm.onUploadOptionSelected("org.example.test");
        expect(onSelected).toHaveBeenCalledWith(
            room.roomId,
            { view: "room" },
            {
                inReplyToEventId: replyEv.getId(),
                relType: "any_type",
                threadRootEventId: "$any_event",
            },
        );
    });

    describe("local files", () => {
        const files = [{ name: "fake.png", size: 1024, type: "image/png" }] as unknown as FileList;

        function createPlainVm(): RoomUploadViewModel {
            return new RoomUploadViewModel(room, TimelineRenderingType.Room, undefined, undefined);
        }

        it("the file input sends nothing", async () => {
            await createPlainVm().initiateViaInputFiles(files);
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("drop and paste send nothing", async () => {
            await createPlainVm().initiateViaDataTransfer({ files } as DataTransfer);
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("the local option cannot be selected", () => {
            expect(() => createPlainVm().onUploadOptionSelected("local")).toThrow();
        });
    });

    describe("RoomUploadContextProvider", () => {
        function renderProvider(): HTMLElement {
            return render(
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                        <RoomUploadContextProvider>
                            <p>Any child</p>
                        </RoomUploadContextProvider>
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            ).container;
        }

        it("renders no file input", () => {
            expect(renderProvider().querySelector("input[type=file]")).toBeNull();
        });

        it("sends nothing when called via module API", () => {
            renderProvider();
            defaultDispatcher.dispatch(
                {
                    action: Action.ComposerFileInsert,
                    files: [{ name: "fake.png", size: 1024, type: "image/png" }] as File[],
                    timelineRenderingType: TimelineRenderingType.Room,
                } satisfies ComposerInsertFilesPayload,
                true,
            );
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });
    });

    describe("analytics", () => {
        let trackEvent: ReturnType<typeof vi.spyOn>;
        const type = "org.example.test";

        beforeEach(() => {
            trackEvent = vi.spyOn(PosthogAnalytics.instance, "trackEvent").mockImplementation(() => {});
        });

        afterEach(() => {
            trackEvent.mockRestore();
        });

        function createVm(
            onSelected: () => Promise<void>,
            replyToEvent?: MatrixEvent,
            threadRelation?: IEventRelation,
            timelineRenderingType = TimelineRenderingType.Room,
        ): RoomUploadViewModel {
            const compApi = new ComposerApi(new MatrixDispatcher());
            const vm = new RoomUploadViewModel(room, timelineRenderingType, replyToEvent, threadRelation, compApi);
            compApi.addFileUploadOption({ type, label: "My uploader", icon: {} as any, onSelected });
            return vm;
        }

        it("tracks AttachmentOpen and invokes the upload function when an option is selected", () => {
            const onSelected = vi.fn();
            createVm(onSelected).onUploadOptionSelected(type);

            expect(trackEvent).toHaveBeenCalledWith({
                eventName: "AttachmentOpen",
                isReply: false,
                inThread: false,
                kind: type,
            });
            expect(onSelected).toHaveBeenCalled();
        });

        it("marks the attachment as a reply and in-thread when applicable", () => {
            const replyToEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            createVm(vi.fn(), replyToEvent, { rel_type: "m.thread" }).onUploadOptionSelected(type);

            expect(trackEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventName: "AttachmentOpen",
                    isReply: true,
                    inThread: true,
                }),
            );
        });

        it("throws for unknown upload types and does not track anything", () => {
            const vm = createVm(vi.fn());
            expect(() => vm.onUploadOptionSelected("unknown-module-type")).toThrow();
            expect(trackEvent).not.toHaveBeenCalled();
        });

        it("throws when the timeline rendering type is not Room or Thread", () => {
            const vm = createVm(vi.fn(), undefined, undefined, TimelineRenderingType.File);
            expect(() => vm.onUploadOptionSelected(type)).toThrow("TimelineRenderingType must be Room or Thread");
            expect(trackEvent).not.toHaveBeenCalled();
        });
    });
});
