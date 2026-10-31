/*
Copyright 2026 Zemzemeh

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type CSSProperties, type JSX, useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod/mini";

import type { I18nApi, MatrixEvent } from "@element-hq/element-web-module-api";
import type { ChatSession } from "./ChatSession";
import { pickerLanguage } from "./PickerDialog";
import { FileRefContent } from "./protocol";

// A stopped backend can leave a request waiting on the proxy for a minute; offer another try well before that.
const ANSWER_TIMEOUT_MS = 15_000;
const KNOWN_LABELS = new Set(["public", "internal", "confidential", "restricted"]);

const VerifiedFile = z.object({
    state: z.literal("available"),
    name: z.string(),
    content_type: z.string(),
    size: z.number(),
    classification: z.string(),
});
type VerifiedFile = z.infer<typeof VerifiedFile>;

const ChangedFile = z.object({ state: z.literal("changed") });

type Answer =
    | { kind: "available"; file: VerifiedFile }
    | { kind: "changed" }
    | { kind: "unavailable" }
    | { kind: "retry" }
    | { kind: "expired" };
type CardState = { kind: "loading" } | { kind: "signin" } | Exclude<Answer, { kind: "expired" }>;

async function askZemzemeh(
    origin: string,
    roomId: string,
    content: FileRefContent,
    signal: AbortSignal,
): Promise<Answer> {
    const url =
        `${origin}/api/chat/refs/${content.file_id}` +
        `?room_id=${encodeURIComponent(roomId)}&version=${content.file_version}`;
    let response: Response;
    let body: unknown;
    try {
        response = await fetch(url, {
            credentials: "include",
            referrerPolicy: "no-referrer",
            signal: AbortSignal.any([signal, AbortSignal.timeout(ANSWER_TIMEOUT_MS)]),
        });
        if (response.status === 401) return { kind: "expired" };
        if (response.status === 404) return { kind: "unavailable" };
        if (response.status !== 200) return { kind: "retry" };
        body = await response.json();
    } catch {
        return { kind: "retry" };
    }
    const verified = VerifiedFile.safeParse(body);
    if (verified.success) return { kind: "available", file: verified.data };
    return ChangedFile.safeParse(body).success ? { kind: "changed" } : { kind: "retry" };
}

function formatSize(size: number, language: string): string {
    const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];
    const unit = Math.min(Math.floor(Math.log(Math.max(size, 1)) / Math.log(1024)), units.length - 1);
    return new Intl.NumberFormat(language, {
        style: "unit",
        unit: units[unit],
        unitDisplay: "short",
        maximumFractionDigits: 1,
    }).format(size / 1024 ** unit);
}

const CARD_STYLE: CSSProperties = {
    boxSizing: "border-box",
    maxWidth: "100%",
    width: "fit-content",
    overflowWrap: "anywhere",
    padding: "var(--cpd-space-3x)",
    border: "1px solid var(--cpd-color-border-interactive-secondary)",
    borderRadius: "var(--cpd-space-2x)",
};
const MUTED_STYLE: CSSProperties = {
    color: "var(--cpd-color-text-secondary)",
    fontSize: "var(--cpd-font-size-body-sm)",
};
const STATUS_STYLE: CSSProperties = { marginBlockStart: "var(--cpd-space-1x)" };
const BUTTON_STYLE: CSSProperties = {
    padding: "var(--cpd-space-1x) var(--cpd-space-3x)",
    color: "var(--cpd-color-text-primary)",
    background: "transparent",
    border: "1px solid var(--cpd-color-border-interactive-primary)",
    borderRadius: "var(--cpd-space-4x)",
    cursor: "pointer",
};
const ACTIONS_STYLE: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--cpd-space-2x)",
    marginBlockStart: "var(--cpd-space-2x)",
};

/**
 * Props for {@link FileCard}.
 */
export interface FileCardProps {
    /** The reference event. Its content is untrusted. */
    mxEvent: MatrixEvent;
    /** The exact origin of Zemzemeh. */
    origin: string;
    /** The module's translations. */
    i18n: I18nApi;
    /** Renews the chat session when it has expired. */
    session: ChatSession;
}

/**
 * Shows a file reference. What Zemzemeh verifies wins; the event's own values appear only when it cannot, and are then
 * labelled as the sender's. Everything is rendered as text. The event grants nothing: the card asks on every mount.
 */
export function FileCard({ mxEvent, origin, i18n, session }: FileCardProps): JSX.Element {
    const parsed = FileRefContent.safeParse(mxEvent.content);
    const content = parsed.success ? parsed.data : null;
    const [state, setState] = useState<CardState>({ kind: "loading" });
    const running = useRef<AbortController | null>(null);
    const fileId = content?.file_id;
    const version = content?.file_version;

    const load = useCallback(
        async (asked: boolean) => {
            if (!content) return;
            running.current?.abort();
            const controller = new AbortController();
            running.current = controller;
            const { signal } = controller;
            setState({ kind: "loading" });
            let answer = await askZemzemeh(origin, mxEvent.roomId, content, signal);
            if (answer.kind === "expired") {
                const renewed = await session.refresh(asked);
                if (signal.aborted) return;
                answer = renewed ? await askZemzemeh(origin, mxEvent.roomId, content, signal) : answer;
            }
            if (!signal.aborted) setState(answer.kind === "expired" ? { kind: "signin" } : answer);
        },
        // The parsed content is a new object on each render; its identity is the file and version.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [origin, mxEvent.roomId, fileId, version, session],
    );

    useEffect(() => {
        void load(false);
        return () => running.current?.abort();
    }, [load]);

    if (!content) return <div style={MUTED_STYLE}>{i18n.translate("zemzemeh_card_invalid")}</div>;

    // The event's values are the sender's, so they wait until they can appear beside what Zemzemeh said about them.
    if (state.kind === "loading") {
        return (
            <div data-testid="zemzemeh-file-card" style={CARD_STYLE}>
                <div role="status" style={MUTED_STYLE}>
                    {i18n.translate("zemzemeh_card_checking")}
                </div>
            </div>
        );
    }

    const verified = state.kind === "available" ? state.file : null;
    const name = verified?.name ?? content.display.name;
    const size = verified?.size ?? content.display.size;
    const classification = verified?.classification ?? content.classification;
    const label = KNOWN_LABELS.has(classification)
        ? i18n.translate(`zemzemeh_label_${classification}`)
        : classification;
    const statusKey = {
        available: null,
        changed: "zemzemeh_card_changed",
        unavailable: "zemzemeh_card_unavailable",
        retry: "zemzemeh_card_retry_text",
        signin: "zemzemeh_card_signin_text",
    }[state.kind];
    const unverified = state.kind !== "available";

    return (
        <div data-testid="zemzemeh-file-card" style={CARD_STYLE}>
            <div style={{ fontWeight: "var(--cpd-font-weight-semibold)" }}>
                <bdi>{name}</bdi>
            </div>
            <div style={MUTED_STYLE}>
                {formatSize(size, i18n.language)} · {label}
            </div>
            {statusKey && <div style={STATUS_STYLE}>{i18n.translate(statusKey)}</div>}
            {unverified && <div style={MUTED_STYLE}>{i18n.translate("zemzemeh_card_unverified")}</div>}
            {state.kind === "available" && (
                <div style={ACTIONS_STYLE}>
                    <a
                        href={
                            `${origin}/chat/view/${content.file_id}?room_id=${encodeURIComponent(mxEvent.roomId)}` +
                            `&version=${content.file_version}&lang=${pickerLanguage(i18n.language)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {i18n.translate("zemzemeh_card_open")}
                    </a>
                </div>
            )}
            {(state.kind === "retry" || state.kind === "signin") && (
                <div style={ACTIONS_STYLE}>
                    {state.kind === "signin" && (
                        <button
                            type="button"
                            style={BUTTON_STYLE}
                            onClick={() =>
                                window.open(
                                    `${origin}/auth/chat/login?interactive=true&next=/chat/signed-in`,
                                    "_blank",
                                    "noopener",
                                )
                            }
                        >
                            {i18n.translate("zemzemeh_card_signin")}
                        </button>
                    )}
                    <button type="button" style={BUTTON_STYLE} onClick={() => void load(true)}>
                        {i18n.translate("zemzemeh_card_try_again")}
                    </button>
                </div>
            )}
        </div>
    );
}
