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
    const sendFileReference = vi.fn(async () => "$sent");
    const registerMessageRenderer = vi.fn();
    const openDialog = vi.fn(() => ({ finished: Promise.resolve({ ok: false, model: null }), close: vi.fn() }));
    const instance = {
        config: { get: vi.fn((key: string) => (key === "io.zemzemeh.attach" ? config : undefined)) },
        i18n: { language, register: vi.fn(), translate: vi.fn((key: string) => key) },
        composer: { addFileUploadOption, sendFileReference },
        customComponents: { registerMessageRenderer },
        openDialog,
    } as unknown as Api;
    return { instance, addFileUploadOption, openDialog, sendFileReference, registerMessageRenderer };
}

const CONTENT = {
    msgtype: "io.zemzemeh.file_ref",
    body: "Zemzemeh file",
    schema: 1,
    file_id: "f".repeat(32),
    file_version: "a".repeat(64),
    classification: "internal",
    display: { name: "report.pdf", content_type: "application/pdf", size: 1024 },
};

describe("ZemzemehAttachModule", () => {
    test("sends what the picker selected, keeping the reply and thread", async () => {
        const { instance, addFileUploadOption, openDialog, sendFileReference } = api();
        openDialog.mockReturnValue({
            finished: Promise.resolve({ ok: true, model: CONTENT }),
            close: vi.fn(),
        } as never);
        await new ZemzemehAttachModule(instance).load();
        await addFileUploadOption.mock.calls[0][0].onSelected(
            "!room:chat.example",
            { view: "thread" },
            { inReplyToEventId: "$parent", relType: "m.thread", threadRootEventId: "$root" },
        );
        expect(sendFileReference).toHaveBeenCalledExactlyOnceWith(
            "!room:chat.example",
            CONTENT,
            { inReplyToEventId: "$parent", threadRootEventId: "$root" },
            { view: "thread" },
        );
    });

    test("cancelling the picker sends nothing", async () => {
        const { instance, addFileUploadOption, sendFileReference } = api();
        await new ZemzemehAttachModule(instance).load();
        await addFileUploadOption.mock.calls[0][0].onSelected("!room:chat.example");
        expect(sendFileReference).not.toHaveBeenCalled();
    });

    test("a failed send tells the user", async () => {
        const { instance, addFileUploadOption, openDialog, sendFileReference } = api();
        openDialog.mockReturnValueOnce({
            finished: Promise.resolve({ ok: true, model: CONTENT }),
            close: vi.fn(),
        } as never);
        sendFileReference.mockRejectedValue(new Error("offline"));
        await new ZemzemehAttachModule(instance).load();
        await addFileUploadOption.mock.calls[0][0].onSelected("!room:chat.example");
        expect(openDialog).toHaveBeenCalledTimes(2);
        expect((openDialog.mock.calls[1] as unknown as [unknown, unknown, { text: string }])[2].text).toBe(
            "zemzemeh_send_failed",
        );
    });

    test("renders only messages of the reference type, and they cannot be edited", async () => {
        const { instance, registerMessageRenderer } = api();
        await new ZemzemehAttachModule(instance).load();
        const [filter, , hints] = registerMessageRenderer.mock.calls[0] as unknown as [
            (event: unknown) => boolean,
            unknown,
            { allowEditingEvent: boolean },
        ];
        expect(filter({ type: "m.room.message", content: { msgtype: "io.zemzemeh.file_ref" } })).toBe(true);
        expect(filter({ type: "m.room.message", content: { msgtype: "m.text" } })).toBe(false);
        expect(filter({ type: "io.zemzemeh.file_ref", content: { msgtype: "io.zemzemeh.file_ref" } })).toBe(false);
        expect(hints.allowEditingEvent).toBe(false);
    });

    test("without config it renders nothing either", async () => {
        const { instance, registerMessageRenderer } = api(null);
        await new ZemzemehAttachModule(instance).load();
        expect(registerMessageRenderer).not.toHaveBeenCalled();
    });

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
        expect(Object.keys(registered)).toContain("zemzemeh_attach_option");
        expect(Object.keys(registered)).toContain("zemzemeh_card_unverified");
        expect(Object.keys(registered).every((key) => !key.includes("|"))).toBe(true);
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
