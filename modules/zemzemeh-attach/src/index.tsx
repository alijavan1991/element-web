/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api, Module, ModuleFactory } from "@element-hq/element-web-module-api";
import { ChatSession } from "./ChatSession";
import { CONFIG_KEY, ModuleConfig } from "./config";
import { FileCard } from "./FileCard";
import { MessageDialog, type MessageDialogProps } from "./MessageDialog";
import { PickerDialog, type PickerDialogProps } from "./PickerDialog";
import type { FileRefContent } from "./protocol";
import Translations from "./translations.json";

class ZemzemehAttachModule implements Module {
    public static readonly moduleApiVersion = "^2.3.0";

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        const rawConfig = this.api.config.get(CONFIG_KEY);
        if (!rawConfig) return;

        const { zemzemeh_origin: origin } = ModuleConfig.parse(rawConfig);
        const { i18n } = this.api;
        const session = new ChatSession(origin);

        i18n.register(Translations);
        this.api.customComponents.registerMessageRenderer(
            (event) => event.type === "m.room.message" && event.content.msgtype === "io.zemzemeh.file_ref",
            ({ mxEvent }) => <FileCard mxEvent={mxEvent} origin={origin} i18n={i18n} session={session} />,
            { allowEditingEvent: false },
        );
        this.api.composer.addFileUploadOption({
            type: "io.zemzemeh.attach",
            label: i18n.translate("zemzemeh_attach_option"),
            onSelected: async (roomId, view, relation) => {
                if (!roomId) return;
                const title = i18n.translate("zemzemeh_attach_title");
                const { finished } = this.api.openDialog<FileRefContent, PickerDialogProps>({ title }, PickerDialog, {
                    origin,
                    roomId,
                    language: i18n.language,
                    title,
                });
                const { ok, model } = await finished;
                if (!ok || !model) return;
                try {
                    await this.api.composer.sendFileReference(
                        roomId,
                        model,
                        {
                            inReplyToEventId: relation?.inReplyToEventId,
                            threadRootEventId: relation?.threadRootEventId,
                        },
                        view,
                    );
                } catch {
                    this.api.openDialog<void, MessageDialogProps>({ title }, MessageDialog, {
                        text: i18n.translate("zemzemeh_send_failed"),
                    });
                }
            },
        });
    }
}

export default ZemzemehAttachModule satisfies ModuleFactory;
