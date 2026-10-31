/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        environment: "happy-dom",
        // Tests render the picker frame; it must not try to fetch its address.
        environmentOptions: { happyDOM: { settings: { disableIframePageLoading: true } } },
    },
});
