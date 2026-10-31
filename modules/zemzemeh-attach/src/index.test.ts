/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, test, vi } from "vitest";

import type { Api } from "@element-hq/element-web-module-api";
import ZemzemehAttachModule from "./index";
import { PickerDialog } from "./PickerDialog";

const ORIGIN = "https://files.example";

function api(config: unknown = { zemzemeh_origin: ORIGIN }, language = "fa") {
    const addFileUploadOption = vi.fn();
    const openDialog = vi.fn(() => ({ finished: Promise.resolve({ ok: false, model: null }), close: vi.fn() }));
    const instance = {
        config: { get: vi.fn((key: string) => (key === "io.zemzemeh.attach" ? config : undefined)) },
        i18n: { language, register: vi.fn(), translate: vi.fn((key: string) => key) },
        composer: { addFileUploadOption },
        openDialog,
    } as unknown as Api;
    return { instance, addFileUploadOption, openDialog };
}

describe("ZemzemehAttachModule", () => {
    test("declares the Module API version it was tested with", () => {
        expect(ZemzemehAttachModule.moduleApiVersion).toBe("^2.3.0");
    });

    test("adds one upload option", async () => {
        const { instance, addFileUploadOption } = api();
        await new ZemzemehAttachModule(instance).load();
        expect(addFileUploadOption).toHaveBeenCalledOnce();
        const option = addFileUploadOption.mock.calls[0][0];
        expect(option.type).toBe("io.zemzemeh.attach");
        expect(option.label).toBe("zemzemeh_attach_option");
    });

    test("registers both labels in both languages, under keys Element looks up as they are", async () => {
        const { instance } = api();
        await new ZemzemehAttachModule(instance).load();
        const registered = vi.mocked(instance.i18n.register).mock.calls[0][0] as Record<string, Record<string, string>>;
        expect(Object.keys(registered).sort()).toEqual(["zemzemeh_attach_option", "zemzemeh_attach_title"]);
        for (const labels of Object.values(registered)) {
            expect(Object.keys(labels).sort()).toEqual(["en", "fa"]);
        }
    });

    test("without config it adds nothing", async () => {
        const { instance, addFileUploadOption } = api(null);
        await new ZemzemehAttachModule(instance).load();
        expect(addFileUploadOption).not.toHaveBeenCalled();
    });

    test("refuses a bad origin rather than guessing", async () => {
        const { instance, addFileUploadOption } = api({ zemzemeh_origin: "*" });
        await expect(new ZemzemehAttachModule(instance).load()).rejects.toThrow();
        expect(addFileUploadOption).not.toHaveBeenCalled();
    });

    test("opens the picker for the focused room, with the validated origin", async () => {
        const { instance, addFileUploadOption, openDialog } = api();
        await new ZemzemehAttachModule(instance).load();
        await addFileUploadOption.mock.calls[0][0].onSelected("!room:chat.example");
        expect(openDialog).toHaveBeenCalledOnce();
        const [options, component, props] = openDialog.mock.calls[0] as unknown as [
            { title: string },
            unknown,
            Record<string, unknown>,
        ];
        expect(options.title).toBe("zemzemeh_attach_title");
        expect(component).toBe(PickerDialog);
        expect(props).toEqual({
            origin: ORIGIN,
            roomId: "!room:chat.example",
            language: "fa",
            title: "zemzemeh_attach_title",
        });
    });

    test("with no room in focus it opens nothing", async () => {
        const { instance, addFileUploadOption, openDialog } = api();
        await new ZemzemehAttachModule(instance).load();
        await addFileUploadOption.mock.calls[0][0].onSelected(undefined);
        expect(openDialog).not.toHaveBeenCalled();
    });
});
