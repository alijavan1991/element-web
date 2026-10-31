/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { type NumberSize, Resizable } from "re-resizable";
import { type Direction } from "re-resizable/lib/resizer";
import { type WebPanelResize } from "@matrix-org/analytics-events/types/typescript/WebPanelResize";

import { PosthogAnalytics } from "../../PosthogAnalytics.ts";
import { SDKContext } from "../../contexts/SDKContext.ts";

interface IProps {
    collapsedRhs?: boolean;
    panel?: JSX.Element;
    children: ReactNode;
    /**
     * A unique identifier for this panel split.
     *
     * This is appended to the key used to store the panel size in localStorage, allowing the widths of different
     * panels to be stored.
     */
    sizeKey?: string;
    /**
     * The size to use for the panel component if one isn't persisted in storage. Defaults to 320.
     */
    defaultSize: number;

    analyticsRoomType: WebPanelResize["roomType"];
}

export default class MainSplit extends React.Component<IProps> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public static defaultProps = {
        defaultSize: 320,
    };

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);
    }

    private onResizeStart = (): void => {
        this.context.resizeNotifier.startResizing();
    };

    private onResize = (): void => {
        this.context.resizeNotifier.notifyRightHandleResized();
    };

    private get sizeSettingStorageKey(): string {
        let key = "mx_rhs_size";
        if (!!this.props.sizeKey) {
            key += `_${this.props.sizeKey}`;
        }
        return key;
    }

    private onResizeStop = (
        event: MouseEvent | TouchEvent,
        direction: Direction,
        elementRef: HTMLElement,
        delta: NumberSize,
    ): void => {
        const newSize = this.loadSidePanelSize().width + delta.width;
        this.context.resizeNotifier.stopResizing();
        window.localStorage.setItem(this.sizeSettingStorageKey, newSize.toString());

        PosthogAnalytics.instance.trackEvent<WebPanelResize>({
            eventName: "WebPanelResize",
            panel: "right",
            roomType: this.props.analyticsRoomType,
            size: newSize,
        });
    };

    private loadSidePanelSize(): { height: string | number; width: number } {
        let rhsSize = parseInt(window.localStorage.getItem(this.sizeSettingStorageKey)!, 10);

        if (isNaN(rhsSize)) {
            rhsSize = this.props.defaultSize;
        }

        return {
            height: "100%",
            width: rhsSize,
        };
    }

    public render(): React.ReactNode {
        const bodyView = React.Children.only(this.props.children);
        const panelView = this.props.panel;

        const hasResizer = !this.props.collapsedRhs && panelView;

        let children;
        if (hasResizer) {
            // The panel sits on the other side in right-to-left languages, so its handle has to as well.
            const handleSide = document.documentElement.dir === "rtl" ? "right" : "left";
            children = (
                <Resizable
                    key={this.props.sizeKey}
                    defaultSize={this.loadSidePanelSize()}
                    minWidth={320}
                    maxWidth="50%"
                    enable={{
                        top: false,
                        right: handleSide === "right",
                        bottom: false,
                        left: handleSide === "left",
                        topRight: false,
                        bottomRight: false,
                        bottomLeft: false,
                        topLeft: false,
                    }}
                    onResizeStart={this.onResizeStart}
                    onResize={this.onResize}
                    onResizeStop={this.onResizeStop}
                    className="mx_RightPanel_ResizeWrapper"
                    handleClasses={{ [handleSide]: "mx_ResizeHandle--horizontal" }}
                >
                    {panelView}
                </Resizable>
            );
        }

        return (
            <div className="mx_MainSplit">
                {bodyView}
                {children}
            </div>
        );
    }
}
