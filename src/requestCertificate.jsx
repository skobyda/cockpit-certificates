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
import moment from "moment";

import {
    Button,
    FormSelect, FormSelectOption,
    Modal,
    Radio,
    TextInput
} from "@patternfly/react-core";

import { addRequest } from "./dbus.js";
import "form-layout.scss";
import { ModalError } from "cockpit-components-inline-notification.jsx";
import { FileAutoComplete } from "cockpit-components-file-autocomplete.jsx";
import "./requestCertificate.scss";

const _ = cockpit.gettext;

const NSSDB_PATH = "/etc/pki/nssdb";

const StorageRow = ({ onValueChanged, dialogValues }) => {
    return (
        <>
            <label className="control-label" htmlFor="storage-row">
                {_("Certificate storage")}
            </label>
            <div id="storage-row" className="storage-row">
                <Radio isChecked={dialogValues.storage === "nssdb"}
                    name="nssdb"
                    onChange={() => onValueChanged("storage", "nssdb")}
                    label="NSSDB"
                    id="nssdb"
                    value="nssdb" />
                <Radio isChecked={dialogValues.storage === "file"}
                    name="file"
                    onChange={() => onValueChanged("storage", "file")}
                    label="File"
                    id="file"
                    value="file" />
            </div>
        </>
    );
};

const CAsRow = ({ onValueChanged, dialogValues, cas }) => {
    return (
        <>
            <label className="control-label" htmlFor="ca">
                {_("CA")}
            </label>
            <FormSelect id="ca"
                value={dialogValues.ca}
                onChange={value => onValueChanged("ca", value)}>
                {cas.map(ca => {
                    return (
                        <FormSelectOption value={ca.nickname.v} key={ca.nickname.v}
                                          label={ca.nickname.v} />
                    );
                })}
            </FormSelect>
        </>
    );
};

const NicknameRow = ({ onValueChanged, dialogValues }) => {
    return (
        <>
            <label className="control-label" htmlFor="nickname">
                {_("Nickname")}
            </label>
            <TextInput value={dialogValues.nickname}
                id="nickname"
                type="text"
                onChange={(value) => onValueChanged("nickname", value)}
                aria-label={_("Nickname input text")} />
        </>
    );
};

const CertFileRow = ({ onValueChanged, dialogValues }) => {
    /* FileAutoComplete does not accept custom className and without it the Select gets shrinked
     * because of ct-form. Let's just have this workaround and fix this properly by *not* using ct-form
     */
    return (
        <>
            <label className="control-label" htmlFor="cert-file">
                {_("Certificate path")}
            </label>
            <span className="ct-form-stretch">
                <FileAutoComplete id="cert-file"
                    isOptionCreatable
                    superuser="try"
                    placeholder={_("Path to store the certificate")}
                    onChange={value => onValueChanged("certFile", value)} />
            </span>
        </>
    );
};

const KeyFileRow = ({ onValueChanged, dialogValues }) => {
    /* FileAutoComplete does not accept custom className and without it the Select gets shrinked
     * because of ct-form. Let's just have this workaround and fix this properly by *not* using ct-form
     */
    return (
        <>
            <label className="control-label" htmlFor="key-file">
                {_("Key path")}
            </label>
            <span className="ct-form-stretch">
                <FileAutoComplete id="key-file"
                    isOptionCreatable
                    superuser="try"
                    placeholder={_("Path to store the generated key or to an existing key")}
                    onChange={value => onValueChanged("keyFile", value)} />
            </span>
        </>
    );
};

export class RequestCertificateModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            _hostname: undefined,
            _userChangedNickname: false,
            ca: props.cas[Object.keys(props.cas)[0]] ? props.cas[Object.keys(props.cas)[0]].nickname.v : undefined,
            storage: "nssdb",
            nickname: "",
            certFile: "",
            keyFile: "",
        };

        this.onValueChanged = this.onValueChanged.bind(this);
        this.onRequest = this.onRequest.bind(this);
        this.onAddError = this.onAddError.bind(this);
    }

    componentDidMount() {
        cockpit.file("/etc/hostname", { superuser: "try" }).read()
                .done((content, tag) => this.onValueChanged("hostname", content.trim()))
                .catch(error => this.onAddError(error.name, error.message));
    }

    onValueChanged(key, value) {
        const { _userChangedNickname, hostname, ca } = this.state;
        const stateDelta = { [key]: value };

        if (key === "hostname" && !_userChangedNickname) {
            stateDelta.nickname = value + '_' + ca + '_' + moment().format("DD-MM-YYYYTHH:mm:ss");
        }
        if (key === "ca" && !_userChangedNickname) {
            stateDelta.nickname = hostname + '_' + value + '_' + moment().format("DD-MM-YYYYTHH:mm:ss");
        }
        if (key === "nickname")
            stateDelta._userChangedNickname = true;

        this.setState(stateDelta);
    }

    checkParameters() {
        return null;
    }

    onAddError(errorName, errorMessage) {
        this.setState({ errorName, errorMessage });
    }

    onRequest() {
        const casKeys = Object.keys(this.props.cas);
        let caPath;
        casKeys.forEach(key => {
            if (this.props.cas[key].nickname.v === this.state.ca)
                caPath = key;
        });

        const parameter = {
            "cert-storage": cockpit.variant("s", this.state.storage),
            "key-storage": cockpit.variant("s", this.state.storage),
            ca: cockpit.variant("s", caPath),
        };

        if (this.state.storage === "nssdb") {
            parameter["cert-database"] = cockpit.variant("s", NSSDB_PATH);
            parameter["cert-nickname"] = cockpit.variant("s", this.state.nickname);
            parameter["key-database"] = cockpit.variant("s", NSSDB_PATH);
            parameter["key-nickname"] = cockpit.variant("s", this.state.nickname);
        } else { // file
            parameter["cert-file"] = cockpit.variant("s", this.state.certFile);
            parameter["key-file"] = cockpit.variant("s", this.state.keyFile);
        }

        console.log(parameter);

        addRequest(parameter)
                .then(() => this.props.onClose())
                .catch(error => this.onAddError(error.name, error.message));
    }

    render() {
        const { onClose } = this.props;
        const cas = Object.values(this.props.cas);

        const body = (
            <form className="ct-form">
                <CAsRow dialogValues={this.state} onValueChanged={this.onValueChanged} cas={cas} />

                <hr />

                <StorageRow dialogValues={this.state} onValueChanged={this.onValueChanged} />
                {this.state.storage === "nssdb" &&
                    <NicknameRow dialogValues={this.state} onValueChanged={this.onValueChanged} />}

                <hr />

                {this.state.storage === "file" && <>
                    <CertFileRow dialogValues={this.state} onValueChanged={this.onValueChanged} />
                    <hr />
                    <KeyFileRow dialogValues={this.state} onValueChanged={this.onValueChanged} />
                </>}

                <hr />
            </form>
        );

        return (
            <Modal id="request-certificate-dialog" onClose={onClose}
                   position="top" variant="medium"
                   isOpen
                   title={_("Request Certificate")}
                   footer={<>
                       {this.state.errorName && <ModalError dialogError={this.state.errorName} dialogErrorDetail={this.state.errorMessage} />}
                       <Button variant="primary"
                           onClick={this.onRequest}>
                           {_("Request")}
                       </Button>
                       <Button variant="link" className="btn-cancel" onClick={onClose}>
                           {_("Cancel")}
                       </Button>
                   </>}>
                {body}
            </Modal>
        );
    }
}

export class RequestCertificate extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showDialog: false,
        };

        this.onOpen = this.onOpen.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    onOpen() {
        this.setState({ showDialog: true });
    }

    onClose() {
        this.setState({ showDialog: false });
    }

    render() {
        const cas = Object.values(this.props.cas);
        const canRequest = cas.length !== 0;

        return (
            <>
                <Button id="request-certificate-action"
                        variant="secondary"
                        isDisabled={!canRequest}
                        onClick={this.onOpen}>
                    {_("Request Certificate")}
                </Button>

                { canRequest && this.state.showDialog &&
                    <RequestCertificateModal onClose={this.onClose} {...this.props} /> }
            </>
        );
    }
}
