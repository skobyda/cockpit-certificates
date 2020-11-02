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

import cockpit from "cockpit";
import React from "react";

import "./certificateActions.css";

import { Modal } from 'patternfly-react';
import {
    Button,
    Dropdown,
    DropdownItem,
    KebabToggle
} from "@patternfly/react-core";

import { ResubmitCertificateModal } from './requestCertificate.jsx';
import { removeRequest } from "./dbus.js";

const _ = cockpit.gettext;

export class RemoveModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            deleteFiles: false,
        };

        this.onValueChanged = this.onValueChanged.bind(this);
        this.onRemove = this.onRemove.bind(this);
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    onRemove() {
        const { certPath, cert, addAlert, appOnValueChanged, onClose } = this.props;
        const { deleteFiles } = this.state;

        if (deleteFiles) {
            cockpit.file(cert["key-file"].v, { superuser: "try" }).replace(null) // delete key file
                    .then(() => cockpit.file(cert["cert-file"].v, { superuser: "try" }).replace(null)) // delete cert file
                    .then(() => removeRequest(certPath))
                    .then(() => { // There is no dbus signal for cert removal, so we have to update UI manually
                        const { certs } = this.props;
                        delete certs[certPath];

                        appOnValueChanged("certs, certs");
                    })
                    .catch(error => {
                        addAlert(_("Error: ") + (error.name || error.problem), error.message);
                        onClose();
                    });
        } else {
            removeRequest(certPath)
                    .then(() => { // There is no dbus signal for cert removal, so we have to update UI manually
                        const { certs } = this.props;
                        delete certs[certPath];

                        appOnValueChanged("certs, certs");
                    })
                    .catch(error => {
                        addAlert(_("Error: ") + error.name, error.message);
                        onClose();
                    });
        }
    }

    render() {
        const { idPrefix, onClose, cert } = this.props;
        const { deleteFiles } = this.state;

        const title = _("Remove Certificate: ") + (cert["cert-storage"].v === "FILE" ? cert.nickname.v : cert["cert-nickname"].v);

        const fileCertBody = (<div className="ct-form ct-form-delete-dialog">
            <label className="control-label" htmlFor={idPrefix + "cert-file"}>
                {_("Certificate file")}
            </label>
            <samp id={idPrefix + "cert-file"}>
                {cert["cert-file"].v}
            </samp>

            <label className="control-label" htmlFor={idPrefix + "key-file"}>
                {_("Key file")}
            </label>
            <samp id={idPrefix + "key-file"}>
                {cert["key-file"].v}
            </samp>
        </div>);

        const nssdbCertBody = (<div className="ct-form ct-form-delete-dialog">
            <label className="control-label" htmlFor={idPrefix + "cert-database"}>
                {_("NSSDB path")}
            </label>
            <samp id={idPrefix + "cert-database"}>
                {cert["cert-database"].v}
            </samp>

            <label className="control-label" htmlFor={idPrefix + "cert-nickname"}>
                {_("Nickname")}
            </label>
            <samp id={idPrefix + "cert-nickname"}>
                {cert["cert-nickname"].v}
            </samp>
        </div>);

        const body = (<>
            { cert["cert-storage"].v === "FILE" ? fileCertBody : nssdbCertBody }
            { cert["key-file"] && cert["cert-file"] && cert["key-file"].v && cert["cert-file"].v && (
                <label className="checkbox-inline checkbox-delete-files">
                    <input id={idPrefix + "-delete-files"}
                            type="checkbox"
                            checked={deleteFiles}
                            onChange={e => this.onValueChanged("deleteFiles", !deleteFiles)} />
                    {_("Also delete certificate and key files")}
                </label>) }
        </>);

        return (
            <Modal id={idPrefix + "-remove-dialog"} onHide={onClose} show>
                <Modal.Header>
                    <Modal.CloseButton onClick={onClose} />
                    <Modal.Title> { title } </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {body}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="danger" onClick={this.onRemove}>
                        { deleteFiles ? _("Remove and delete") : _("Remove") }
                    </Button>
                    <Button variant="link" className="btn-cancel" onClick={onClose}>
                        {_("Cancel")}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export class CertificateActions extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dropdownOpen: false,
            showRemoveModal: false,
            showResubmitModal: false,
        };

        this.onValueChanged = this.onValueChanged.bind(this);
        this.onRemoveModalOpen = this.onRemoveModalOpen.bind(this);
        this.onRemoveModalClose = this.onRemoveModalClose.bind(this);
        this.onResubmitModalOpen = this.onResubmitModalOpen.bind(this);
        this.onResubmitModalClose = this.onResubmitModalClose.bind(this);
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    onResubmitModalOpen() {
        this.setState({ showResubmitModal: true });
    }

    onResubmitModalClose() {
        this.setState({ showResubmitModal: false });
    }

    onRemoveModalOpen() {
        this.setState({ showRemoveModal: true });
    }

    onRemoveModalClose() {
        this.setState({ showRemoveModal: false });
    }

    render() {
        const { idPrefix, cas, addAlert, cert, certPath } = this.props;
        const { dropdownOpen, showRemoveModal, showResubmitModal } = this.state;

        const dropdownItems = [
            <DropdownItem
                key={`${idPrefix}-resubmit`}
                id={`${idPrefix}-resubmit`}
                onClick={this.onResubmitModalOpen}>
                {_("Resubmit")}
            </DropdownItem>,
            <DropdownItem className="pf-m-danger"
                key={`${idPrefix}-remove`}
                id={`${idPrefix}-remove`}
                onClick={this.onRemoveModalOpen}>
                {_("Remove")}
            </DropdownItem>,
        ];

        return (
            <>
                <Dropdown onSelect={() => this.onValueChanged("dropdownOpen", !dropdownOpen)}
                    id={`${idPrefix}-action-kebab`}
                    toggle={
                        <KebabToggle key={`${idPrefix}-action-kebab-toggle`}
                            onToggle={() => this.onValueChanged("dropdownOpen", !dropdownOpen)} />
                    }
                    isOpen={dropdownOpen}
                    position="right"
                    dropdownItems={dropdownItems}
                    isPlain />

                {showRemoveModal &&
                    <RemoveModal onClose={this.onRemoveModalClose}
                        {...this.props} />}
                {showResubmitModal &&
                    <ResubmitCertificateModal onClose={this.onResubmitModalClose}
                        cas={cas}
                        addAlert={addAlert}
                        cert={cert}
                        certPath={certPath}
                        mode="resubmit" />}
            </>
        );
    }
}
