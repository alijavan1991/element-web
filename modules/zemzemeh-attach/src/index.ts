/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api, Module, ModuleFactory } from "@element-hq/element-web-module-api";
import { CONFIG_KEY, ModuleConfig } from "./config";
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

        this.api.i18n.register(Translations);
        this.api.composer.addFileUploadOption({
            type: "io.zemzemeh.attach",
            label: this.api.i18n.translate("zemzemeh_attach_option"),
            onSelected: (roomId) => {
                if (!roomId) return;
                const title = this.api.i18n.translate("zemzemeh_attach_title");
                // The dialog's result is not sent yet: sending the reference event needs the send check from the
                // next increment, and the Module API has no way to send it.
                this.api.openDialog<FileRefContent, PickerDialogProps>({ title }, PickerDialog, {
                    origin,
                    roomId,
                    language: this.api.i18n.language,
                    title,
                });
            },
        });
    }
}

export default ZemzemehAttachModule satisfies ModuleFactory;
