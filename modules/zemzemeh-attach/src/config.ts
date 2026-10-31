/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z, type input } from "zod/mini";

function isExactOrigin(value: string): boolean {
    try {
        const url = new URL(value);
        return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
    } catch {
        return false;
    }
}

/**
 * The module's configuration.
 */
export const ModuleConfig = z.object({
    /**
     * The origin of Zemzemeh. Messages are addressed to and accepted from exactly this origin.
     * @example https://files.example
     */
    zemzemeh_origin: z.string().check(z.refine(isExactOrigin)),
});

export type ModuleConfig = z.infer<typeof ModuleConfig>;

export const CONFIG_KEY = "io.zemzemeh.attach";

declare module "@element-hq/element-web-module-api" {
    export interface Config {
        [CONFIG_KEY]?: input<ModuleConfig>;
    }
}
