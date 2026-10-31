/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../../../elements/AccessibleButton";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { type RoomEchoChamber } from "../../../../../stores/local-echo/RoomEchoChamber";
import { EchoChamber } from "../../../../../stores/local-echo/EchoChamber";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import StyledRadioGroup from "../../../elements/StyledRadioGroup";
import { RoomNotifState } from "../../../../../RoomNotifs";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { UserTab } from "../../../dialogs/UserTab";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import { SDKContextClass } from "../../../../../contexts/SDKContextClass.ts";

interface IProps {
    roomId: string;
    closeSettingsFn(): void;
}

interface IState {
    currentSound: string;
}

export default class NotificationsSettingsTab extends React.Component<IProps, IState> {
    private readonly roomProps: RoomEchoChamber;

    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.roomProps = EchoChamber.forRoom(context.getRoom(this.props.roomId)!);

        let currentSound = "default";
        const soundData = SDKContextClass.instance.notifier.getSoundForRoom(this.props.roomId);
        if (soundData) {
            currentSound = soundData.name || soundData.url;
        }

        this.state = {
            currentSound,
        };
    }

    private clearSound = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        void SettingsStore.setValue("notificationSound", this.props.roomId, SettingLevel.ROOM_ACCOUNT, null);

        this.setState({
            currentSound: "default",
        });
    };

    private onRoomNotificationChange = (value: RoomNotifState): void => {
        this.roomProps.notificationVolume = value;
        this.forceUpdate();
    };

    private onOpenSettingsClick = (event: ButtonEvent): void => {
        // avoid selecting the radio button
        event.preventDefault();
        this.props.closeSettingsFn();
        defaultDispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Notifications,
        });
    };

    public render(): React.ReactNode {
        return (
            <SettingsTab>
                <SettingsSection heading={_t("notifications|enable_prompt_toast_title")}>
                    <div className="mx_NotificationSettingsTab_notificationsSection">
                        <StyledRadioGroup
                            name="roomNotificationSetting"
                            definitions={[
                                {
                                    value: RoomNotifState.AllMessages,
                                    label: (
                                        <>
                                            {_t("notifications|default")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t(
                                                    "room_settings|notifications|settings_link",
                                                    {},
                                                    {
                                                        a: (sub) => (
                                                            <AccessibleButton
                                                                kind="link_inline"
                                                                onClick={this.onOpenSettingsClick}
                                                            >
                                                                {sub}
                                                            </AccessibleButton>
                                                        ),
                                                    },
                                                )}
                                            </div>
                                        </>
                                    ),
                                },
                                {
                                    value: RoomNotifState.AllMessagesLoud,
                                    label: (
                                        <>
                                            {_t("notifications|all_messages")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t("notifications|all_messages_description")}
                                            </div>
                                        </>
                                    ),
                                },
                                {
                                    value: RoomNotifState.MentionsOnly,
                                    label: (
                                        <>
                                            {_t("notifications|mentions_and_keywords")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t(
                                                    "notifications|mentions_and_keywords_description",
                                                    {},
                                                    {
                                                        a: (sub) => (
                                                            <AccessibleButton
                                                                kind="link_inline"
                                                                onClick={this.onOpenSettingsClick}
                                                            >
                                                                {sub}
                                                            </AccessibleButton>
                                                        ),
                                                    },
                                                )}
                                            </div>
                                        </>
                                    ),
                                },
                                {
                                    value: RoomNotifState.Mute,
                                    label: (
                                        <>
                                            {_t("common|mute")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t("notifications|mute_description")}
                                            </div>
                                        </>
                                    ),
                                },
                            ]}
                            onChange={this.onRoomNotificationChange}
                            value={this.roomProps.notificationVolume}
                        />
                    </div>

                    <SettingsSubsection heading={_t("room_settings|notifications|sounds_section")}>
                        <div>
                            <div className="mx_SettingsTab_subsectionText">
                                <span>
                                    {_t("room_settings|notifications|notification_sound")}:{" "}
                                    <code>{this.state.currentSound}</code>
                                </span>
                            </div>
                            <AccessibleButton
                                className="mx_NotificationSound_resetSound"
                                disabled={this.state.currentSound == "default"}
                                onClick={this.clearSound}
                                kind="primary"
                            >
                                {_t("action|reset")}
                            </AccessibleButton>
                        </div>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
