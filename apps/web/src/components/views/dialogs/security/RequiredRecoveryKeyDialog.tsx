/*
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import dis from "../../../../dispatcher/dispatcher";
import { ChangeRecoveryKeyBody } from "../../settings/encryption/ChangeRecoveryKeyBody";
import BaseDialog from "../BaseDialog";

interface Props {
    onFinished(): void;
}

/**
 * Zemzemeh requires a recovery key, so this has no skip, cancel or close control. Signing out is the only way out.
 */
export default function RequiredRecoveryKeyDialog({ onFinished }: Readonly<Props>): JSX.Element {
    return (
        <BaseDialog hasCancel={false} fixedWidth={false} aria-label={_t("encryption|set_up_recovery")}>
            <ChangeRecoveryKeyBody
                userHasRecoveryKey={false}
                onFinish={onFinished}
                className="mx_EncryptionCard_noBorder"
            />
            <Button kind="tertiary" onClick={() => dis.dispatch({ action: "logout" })}>
                {_t("action|sign_out_before_verify")}
            </Button>
        </BaseDialog>
    );
}
