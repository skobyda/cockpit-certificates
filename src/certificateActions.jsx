/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2020 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from "react";

import "./certificateActions.css";

import {
    Button,
    Dropdown,
    DropdownItem,
    DropdownSeparator,
    KebabToggle
} from "@patternfly/react-core";

import { removeRequest } from "./dbus.js";

const _ = cockpit.gettext;

export class CertificateActions extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dropdownOpen: false,
        };

        this.onValueChanged = this.onValueChanged.bind(this);
        this.onResubmit = this.onResubmit.bind(this);
        this.onRemove = this.onRemove.bind(this);
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    onResubmit() {
        const { cert } = this.props;

        removeRequest(cert.path)
                .catch(error => addAlert(_("Error: ") + error.name, error.message));
    }

    onRemove() {
        const { cert } = this.props;

        removeRequest(cert.path)
                .catch(error => addAlert(_("Error: ") + error.name, error.message));
    }

    render() {
        const { cert, idPrefix } = this.props;
        const { dropdownOpen } = this.state;

        const dropdownItems = [
            <DropdownItem key={`${idPrefix}-resubmit`} id={`${idPrefix}-resubmit`} onClick={this.onResubmit}>
                {_("Resubmit")}
            </DropdownItem>,
            <DropdownSeparator key={`${idPrefix}-separator`}/>,
            <DropdownItem className="pf-m-danger" key={`${idPrefix}-remove`} id={`${idPrefix}-remove`} onClick={this.onRemove}>
                {_("Remove")}
            </DropdownItem>,
        ];

        return (
            <Dropdown onSelect={() => this.onValueChanged("dropdownOpen", !dropdownOpen)}
                id={`${idPrefix}-action-kebab`}
                toggle={<KebabToggle key={`${idPrefix}-action-kebab-toggle`} onToggle={() => this.onValueChanged("dropdownOpen", !dropdownOpen)} />}
                isOpen={dropdownOpen}
                position="right"
                dropdownItems={dropdownItems}
                isPlain />
        );
    }
}
