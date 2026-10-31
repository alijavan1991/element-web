/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import { guardUploads, uploadAvatar } from "./zemzemehUploads";

function fakeClient(): MatrixClient {
    return { uploadContent: vi.fn().mockResolvedValue({ content_uri: "mxc://server/id" }) } as unknown as MatrixClient;
}

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) return sourceFiles(file);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
    });
}

describe("guardUploads", () => {
    it("refuses every upload by default", async () => {
        const client = fakeClient();
        const original = client.uploadContent;
        guardUploads(client);
        await expect(client.uploadContent(new Blob(["x"]))).rejects.toThrow("Zemzemeh");
        expect(original).not.toHaveBeenCalled();
    });

    it("lets an avatar through its own route", async () => {
        const client = fakeClient();
        const original = client.uploadContent;
        guardUploads(client);
        const file = new File(["x"], "me.png", { type: "image/png" });
        await expect(uploadAvatar(client, file)).resolves.toEqual({ content_uri: "mxc://server/id" });
        expect(original).toHaveBeenCalledWith(file);
    });

    it("guarding twice keeps the original upload", async () => {
        const client = fakeClient();
        const original = client.uploadContent;
        guardUploads(client);
        guardUploads(client);
        await uploadAvatar(client, new File(["x"], "me.png"));
        expect(original).toHaveBeenCalledTimes(1);
    });

    it("covers every client the app creates", () => {
        const source = readFileSync(path.join(import.meta.dirname, "createMatrixClient.ts"), "utf8");
        expect(source).toMatch(/guardUploads\(client\)/);
    });
});

describe("callers of uploadContent", () => {
    // A new upstream caller fails closed at runtime, and fails here so that someone looks at it on a rebase.
    const expected: Record<string, number> = {
        "ContentMessages.ts": 2, // refused at runtime: attachments
        "stores/widgets/ElementWidgetDriver.ts": 1, // refused at runtime: widgets are off
    };

    it("are only the reviewed ones", { timeout: 120000 }, () => {
        const root = path.join(import.meta.dirname, "..");
        const found: Record<string, number> = {};
        for (const file of sourceFiles(root)) {
            const count = readFileSync(file, "utf8").match(/\.uploadContent\s*\(/g)?.length ?? 0;
            const name = path.relative(root, file).replaceAll("\\", "/");
            if (count && name !== "utils/zemzemehUploads.ts") found[name] = count;
        }
        expect(found).toEqual(expected);
    });

    it("avatar callers use their own route", () => {
        const root = path.join(import.meta.dirname, "..");
        const avatars = [
            "components/views/elements/MiniAvatarUploader.tsx",
            "components/views/room_settings/RoomProfileSettings.tsx",
            "components/views/settings/UserProfileSettings.tsx",
            "components/views/spaces/SpaceSettingsGeneralTab.tsx",
            "createRoom.ts",
            "slash-commands/utils.ts",
        ];
        const missing = avatars.filter(
            (name) => !readFileSync(path.join(root, name), "utf8").includes("uploadAvatar("),
        );
        expect(missing).toEqual([]);
    });
});
