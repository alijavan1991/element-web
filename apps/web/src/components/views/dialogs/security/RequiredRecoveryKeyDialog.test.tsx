/*
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import RequiredRecoveryKeyDialog from "./RequiredRecoveryKeyDialog";
import dis from "../../../../dispatcher/dispatcher";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";

describe("<RequiredRecoveryKeyDialog />", () => {
    let matrixClient: MatrixClient;
    const onFinished = vi.fn();

    beforeEach(() => {
        matrixClient = createTestClient();
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(matrixClient); // BaseDialog provides the client context.
        vi.spyOn(dis, "dispatch");
    });

    afterEach(() => {
        vi.restoreAllMocks();
        onFinished.mockReset();
    });

    const renderDialog = async (): Promise<void> => {
        render(<RequiredRecoveryKeyDialog onFinished={onFinished} />, withClientContextRenderOptions(matrixClient));
        await screen.findByText("Save your recovery key somewhere safe");
    };

    it("shows the recovery key with no way to skip it", async () => {
        await renderDialog();
        expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
        for (const name of ["Cancel", "Not now", "Close dialog", "Dismiss", "Back"]) {
            expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
        }
    });

    it("has no way to skip the confirmation step either", async () => {
        await renderDialog();
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(await screen.findByText("Enter your recovery key to confirm")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });

    it("ignores Escape", async () => {
        await renderDialog();
        await userEvent.keyboard("{Escape}");
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("offers signing out as the only way out", async () => {
        await renderDialog();
        await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
        expect(dis.dispatch).toHaveBeenCalledWith({ action: "logout" });
    });
});
