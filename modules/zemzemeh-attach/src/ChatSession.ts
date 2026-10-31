/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PICKER_SANDBOX } from "./protocol";

const ANSWER_TIMEOUT_MS = 10_000;
const FAILURE_WAIT_MS = 60_000;

/**
 * Renews the short chat session for file cards. The picker page signs in silently when framed and says it is ready only
 * once it has a session, so a hidden picker frame does the work and Element never touches a token.
 */
export class ChatSession {
    private pending: Promise<boolean> | null = null;
    private failedAt: number | null = null;

    public constructor(private readonly origin: string) {}

    /**
     * Try to renew the session.
     * @param force - A person asked, so do not hold back after a recent failure.
     * @returns Whether a session now exists.
     */
    public refresh(force = false): Promise<boolean> {
        if (this.pending) return this.pending;
        if (!force && this.failedAt !== null && Date.now() - this.failedAt < FAILURE_WAIT_MS) {
            return Promise.resolve(false);
        }
        this.pending = this.signIn().then((signedIn) => {
            this.pending = null;
            this.failedAt = signedIn ? null : Date.now();
            return signedIn;
        });
        return this.pending;
    }

    private signIn(): Promise<boolean> {
        return new Promise((resolve) => {
            const frame = document.createElement("iframe");
            const finish = (signedIn: boolean): void => {
                clearTimeout(timer);
                window.removeEventListener("message", onMessage);
                frame.remove();
                resolve(signedIn);
            };
            const onMessage = (event: MessageEvent): void => {
                const picker = frame.contentWindow;
                if (!picker || event.source !== picker || event.origin !== this.origin) return;
                if (event.data?.type === "zemzemeh.picker.ready") finish(true);
            };
            const timer = setTimeout(() => finish(false), ANSWER_TIMEOUT_MS);
            window.addEventListener("message", onMessage);
            frame.hidden = true;
            frame.setAttribute("sandbox", PICKER_SANDBOX);
            frame.referrerPolicy = "no-referrer";
            frame.src = `${this.origin}/chat/picker`;
            document.body.append(frame);
        });
    }
}
