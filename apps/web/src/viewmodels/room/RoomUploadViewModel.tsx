/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type UploadButtonViewActions,
    type UploadButtonViewSnapshot,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";
import React, { createContext, type ReactNode, useContext, useEffect } from "react";
import { type Room, type IEventRelation, type MatrixEvent, RoomEvent } from "matrix-js-sdk/src/matrix";

import type { ComposerApiFileUploadOption } from "@element-hq/element-web-module-api";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { ModuleApi } from "../../modules/Api";
import { ModuleComposerApiEvents } from "../../modules/ComposerApi";
import { type AttachmentOpen } from "@matrix-org/analytics-events/types/typescript/AttachmentOpen";
import { PosthogAnalytics } from "../../PosthogAnalytics";

interface RoomUploadViewSnapshot extends UploadButtonViewSnapshot {
    mayDragAndDropFile: boolean;
}

export class RoomUploadViewModel
    extends BaseViewModel<RoomUploadViewSnapshot, Record<string, never>>
    implements UploadButtonViewActions
{
    private readonly uploadSelectFns = new Map<string, ComposerApiFileUploadOption["onSelected"]>();
    public constructor(
        private readonly room: Room,
        private readonly timelineRenderingType: TimelineRenderingType,
        private replyToEvent: MatrixEvent | undefined,
        private threadRelation: IEventRelation | undefined,
        private readonly moduleComposerApi = ModuleApi.instance.composer,
    ) {
        super(
            {},
            {
                options: [],
                mayDragAndDropFile: false,
            },
        );
        // Initial check.
        this.updateOptions();
        // Configure upload functions
        for (const option of moduleComposerApi.fileUploadOptions) {
            this.uploadSelectFns.set(option.type, option.onSelected);
        }
        this.disposables.trackListener(room, RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
        this.disposables.trackListener(
            moduleComposerApi,
            ModuleComposerApiEvents.UploaderOptionsChanged,
            // Types issue.
            this.onUploaderOptionsChanged as any,
        );
    }

    private onRoomCurrentStateUpdated = (): void => {
        this.updateOptions();
    };

    private updateOptions(): void {
        const maySendMessage = this.room.maySendMessage();
        this.snapshot.set({
            // Attachments only come from a module's option: nothing here reads a local file.
            mayDragAndDropFile: false,
            options: maySendMessage
                ? this.moduleComposerApi.fileUploadOptions.map((option) => ({
                      type: option.type,
                      label: option.label,
                      icon: option.icon,
                  }))
                : [],
        });
    }

    private readonly onUploaderOptionsChanged = (option: ComposerApiFileUploadOption): void => {
        this.uploadSelectFns.set(option.type, option.onSelected);
        this.updateOptions();
    };

    public setReplyToEvent = (replyToEvent?: MatrixEvent): void => {
        this.replyToEvent = replyToEvent;
    };

    public setThreadRelation = (threadRelation?: IEventRelation): void => {
        this.threadRelation = threadRelation;
    };

    /** Reached by paste and drop in the composers. Local files never become attachments. */
    public initiateViaInputFiles = async (_files: FileList | File[] | null): Promise<void> => {};

    public initiateViaDataTransfer = async (_dataTransfer: DataTransfer): Promise<void> => {};

    public onUploadOptionSelected = (type: ComposerApiFileUploadOption["type"]): void => {
        const fn = this.uploadSelectFns.get(type);
        if (!fn) {
            throw new Error("Unexpectedly called onUploadOptionSelected with an unknown type");
        }
        // At the point of this function being called, we should be in a state that is either rendering a room
        // or timeline.
        if (![TimelineRenderingType.Room, TimelineRenderingType.Thread].includes(this.timelineRenderingType)) {
            throw new Error("TimelineRenderingType must be Room or Thread");
        }
        PosthogAnalytics.instance.trackEvent<AttachmentOpen>({
            eventName: "AttachmentOpen",
            isReply: !!this.replyToEvent,
            inThread: !!this.threadRelation,
            kind: type,
        });
        void fn(
            this.room.roomId,
            {
                view: this.timelineRenderingType === TimelineRenderingType.Room ? "room" : "thread",
            },
            {
                inReplyToEventId: this.replyToEvent?.getId(),
                relType: this.threadRelation?.rel_type,
                threadRootEventId: this.threadRelation?.event_id,
            },
        );
    };
}

export const RoomUploadContext = createContext<RoomUploadViewModel | null>(null);

export function useRoomUploadViewModel(): RoomUploadViewModel {
    const ctx = useContext(RoomUploadContext);
    if (!ctx) {
        throw new Error("RoomFileUploadProvider is not present");
    }
    return ctx;
}

export function RoomUploadContextProvider({
    children,
    threadRelation,
}: {
    children: ReactNode;
    threadRelation?: IEventRelation;
}): ReactNode {
    const { room, timelineRenderingType, replyToEvent } = useScopedRoomContext(
        "room",
        "timelineRenderingType",
        "replyToEvent",
    );
    const vm = useCreateAutoDisposedViewModel(() => {
        if (!room) {
            throw new Error("RoomUploadContextProvider must have a room");
        }
        return new RoomUploadViewModel(
            room,
            // Checked earlier
            timelineRenderingType,
            replyToEvent,
            threadRelation,
        );
    });

    useEffect(() => {
        vm.setReplyToEvent(replyToEvent);
    }, [vm, replyToEvent]);

    useEffect(() => {
        vm.setThreadRelation(threadRelation);
    }, [vm, threadRelation]);

    return <RoomUploadContext.Provider value={vm}>{children}</RoomUploadContext.Provider>;
}
