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
    Badge,
    Flex,
    FlexModifiers,
    Text,
    TextVariants,
    Tooltip,
    TooltipPosition
} from "@patternfly/react-core";
import { InfoAltIcon } from '@patternfly/react-icons';

import { CertificateActions } from "./certificateActions.jsx";
import { RequestCertificate } from './requestCertificate.jsx';
import "../lib/form-layout.scss";
import "./certificateList.css";
import { ListingPanel } from "../lib/cockpit-components-listing-panel.jsx";
import { ListingTable } from "../lib/cockpit-components-table.jsx";
import { modifyRequest } from "./dbus.js";
import { certificateStates } from "./states.js";

const _ = cockpit.gettext;
function prettyTime(unixTime) {
    moment.locale(cockpit.language, {
        longDateFormat : {
            LT: "hh:mm:ss",
            L: "DD/MM/YYYY",
        }
    });
    const yesterday = _("Yesterday");
    const today = _("Today");
    const tomorrow = _("Tomorrow");
    moment.locale(cockpit.language, {
        calendar : {
            lastDay : `[${yesterday}] LT`,
            sameDay : `[${today}] LT`,
            nextDay : `[${tomorrow}] LT`,
            sameElse : "L"
        }
    });

    return moment(Number(unixTime) * 1000).calendar();
}

function getExpirationTime(cert) {
    if (cert.autorenew && cert.autorenew.v) {
        return _("Auto-renews before ") + prettyTime(cert["not-valid-after"].v).toLowerCase();
    } else {
        const eventdate = moment(Number(cert["not-valid-after"].v) * 1000);
        const todaysdate = moment();
        const diff = eventdate.diff(todaysdate, "days");
        const diffSeconds = eventdate.diff(todaysdate, "seconds");

        if (diffSeconds < 0) { // Expired
            if (diff > -1) { // Expired yesterday
                return (
                    <>
                        <span className="fa fa-exclamation-circle" />
                        {_("Expired ") + prettyTime(cert["not-valid-after"].v).toLowerCase()}
                    </>
                );
            }
            if (diff > -28) { // Expired X days ago
                return (
                    <>
                        <span className="fa fa-exclamation-circle" />
                        {_("Expired ") + diff + _(" ago")}
                    </>
                );
            }
            return (
                <>
                    <span className="fa fa-exclamation-circle" />
                    {_("Expired on ") + prettyTime(cert["not-valid-after"].v)}
                </>
            );
        }

        // Expires
        if (diff < 2) { // Expires today or tomorrow
            return (
                <>
                    <span className="fa fa-exclamation-triangle" />
                    {_("Expires ") + prettyTime(cert["not-valid-after"].v).toLowerCase()}
                </>
            );
        }
        if (diff < 28) { // Expires in X days
            return (
                <>
                    <span className="fa fa-exclamation-triangle" />
                    {_("Expires in ") + diff + _(" days")}
                </>
            );
        }
        return _("Expires on ") + prettyTime(cert["not-valid-after"].v);
    }
}

function getCAName(cas, cert) {
    if (cert.ca && cas[cert.ca.v.replace("request", "ca")])
        return cas[cert.ca.v.replace("request", "ca")].nickname.v;
}

const generalDetails = ({ idPrefix, cas, cert, certPath, onAutorenewChanged }) => (
    <Flex breakpointMods={[{ modifier: FlexModifiers.column }]}>
        <Flex breakpointMods={[{ modifier: FlexModifiers["justify-content-space-between"] }]}>
            <Flex breakpointMods={[{ modifier: FlexModifiers.column }, { modifier: FlexModifiers["flex-1"] }]}>
                <div className="ct-form">
                    {cert.status && cert.status.v && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-status`}>{_("Status")}</label>
                        <div id={`${idPrefix}-general-status`} role="group">
                            {cert.stuck.v && (<span>
                                <span className="fa fa-exclamation-triangle" />
                                <span id={`${idPrefix}-general-stuck`}>{_("Stuck: ")}</span>
                            </span>)}
                            <span>
                                {cert.status.v.includes('_')
                                    ? cert.status.v
                                    : cert.status.v.charAt(0) + cert.status.v.slice(1).toLowerCase()}
                                <Tooltip position={TooltipPosition.top}
                                    entryDelay={0}
                                    content={certificateStates[cert.status.v]}>
                                    <span className="info-circle">
                                        <InfoAltIcon />
                                    </span>
                                </Tooltip>
                            </span>
                        </div>
                    </>}
                    {cert.ca && cert.ca.v && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-ca`}>{_("CA")}</label>
                        <span id={`${idPrefix}-general-ca`}>{getCAName(cas, cert)}</span>
                    </>}
                </div>
            </Flex>
            <Flex breakpointMods={[{ modifier: FlexModifiers.column }, { modifier: FlexModifiers["flex-1"] }]}>
                <div className="ct-form">
                    {cert["not-valid-after"] && cert["not-valid-after"].v !== 0 && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-validity`}>
                            {_("Valid")}
                        </label>
                        <span id={`${idPrefix}-general-validity`}>
                            {prettyTime(cert["not-valid-before"].v) +
                            _(" to ") + prettyTime(cert["not-valid-after"].v)}
                        </span>
                    </>}
                    {cert.autorenew && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-autorenewal`}>
                            {_("Auto-renewal")}
                        </label>
                        <label className='checkbox-inline'>
                            <input id={`${idPrefix}-general-autorenewal`}
                                   type="checkbox"
                                   checked={cert.autorenew.v}
                                   onChange={() => onAutorenewChanged(cert, certPath)} />
                            {_("Renew before expiration")}
                        </label>
                    </>}
                </div>
            </Flex>
        </Flex>

        <Text component={TextVariants.h5}>
            {_("Signing request properties")}
        </Text>

        <Flex breakpointMods={[{ modifier: FlexModifiers["justify-content-space-between"] }]}>
            <Flex breakpointMods={[{ modifier: FlexModifiers.column }, { modifier: FlexModifiers["flex-1"] }]}>
                <div className='ct-form'>
                    {cert.subject && cert.subject.v && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-subject`}>
                            {_("Subject name")}
                        </label>
                        <span id={`${idPrefix}-general-subject`}>{cert.subject.v}</span>
                    </>}

                    {cert.principal && cert.principal.v.length > 0 && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-principal`}>
                            {_("Principal name")}
                        </label>
                        <span id={`${idPrefix}-general-principal`}>{cert.principal.v.join(", ")}</span>
                    </>}
                </div>
            </Flex>

            <Flex breakpointMods={[{ modifier: FlexModifiers.column }, { modifier: FlexModifiers["flex-1"] }]}>
                <div className='ct-form'>
                    {cert.hostname && cert.hostname.v.length > 0 && <>
                        <label className='control-label label-title' htmlFor={`${idPrefix}-general-dns`}>
                            {_("DNS name")}
                        </label>
                        <span id={`${idPrefix}-general-dns`}>{cert.hostname.v.join(", ")}</span>
                    </>}
                </div>
            </Flex>
        </Flex>
    </Flex>
);

const keyDetails = ({ idPrefix, cert }) => (
    <div className="ct-form">
        {cert["key-nickname"] && cert["key-nickname"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-key-nickname`}>{_("Nickname")}</label>
            <span id={`${idPrefix}-key-nickname`}>{cert["key-nickname"].v}</span>
        </>}
        {cert["key-type"] && cert["key-type"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-key-type`}>{_("Type")}</label>
            <span id={`${idPrefix}-key-type`}>{cert["key-type"].v}</span>
        </>}
        {cert["key-token"] && cert["key-token"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-key-token`}>{_("Token")}</label>
            <span id={`${idPrefix}-key-token`}>{cert["key-token"].v}</span>
        </>}
        {cert["key-storage"] && cert["key-storage"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-key-storage`}>{_("Storage")}</label>
            <span id={`${idPrefix}-key-storage`}>{cert["key-storage"].v}</span>
        </>}
        {((cert["key-database"] && cert["key-database"].v) || (cert["key-file"] && cert["key-file"].v)) && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-key-location`}>{_("Location")}</label>
            {cert["key-storage"].v === "FILE"
                ? <span id={`${idPrefix}-key-location`}>{cert["key-file"].v}</span>
                : <span id={`${idPrefix}-key-location`}>{cert["key-database"].v}</span>
            }
        </>}
    </div>
);

const certDetails = ({ idPrefix, cert }) => (
    <div className="ct-form">
        {cert["cert-nickname"] && cert["cert-nickname"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-cert-nickname`}>{_("Nickname")}</label>
            <span id={`${idPrefix}-cert-nickname`}>{cert["cert-nickname"].v}</span>
        </>}
        {cert["cert-token"] && cert["cert-token"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-cert-token`}>{_("Token")}</label>
            <span id={`${idPrefix}-cert-token`}>{cert["cert-token"].v}</span>
        </>}
        {cert["cert-storage"] && cert["cert-storage"].v && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-cert-storage`}>{_("Storage")}</label>
            <span id={`${idPrefix}-cert-storage`}>{cert["cert-storage"].v}</span>
        </>}
        {((cert["cert-database"] && cert["cert-database"].v) || (cert["cert-file"] && cert["cert-file"].v)) && <>
            <label className='control-label label-title' htmlFor={`${idPrefix}-cert-location`}>{_("Location")}</label>
            {cert["cert-storage"].v === "FILE"
                ? <span id={`${idPrefix}-cert-location`}>{cert["cert-file"].v}</span>
                : <span id={`${idPrefix}-cert-location`}>{cert["cert-database"].v}</span>
            }
        </>}
    </div>
);

class CertificateList extends React.Component {
    constructor() {
        super();
        this.state = {
            expanded: [],
            activeTabKey: 0,
        };

        this.toggle = this.toggle.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
        this.onAutorenewChanged = this.onAutorenewChanged.bind(this);
    }

    onAutorenewChanged(cert, certPath) {
        const { addAlert } = this.props;
        const updates = { autorenew: cockpit.variant("b", !cert.autorenew.v) };

        modifyRequest(certPath, updates)
                .catch(error => addAlert(error.name, error.message));
    }

    toggle(certId) {
        this.setState(oldState => {
            const newExpanded = oldState.expanded;
            const certIndex = newExpanded.findIndex(e => e === certId);

            if (certIndex < 0)
                newExpanded.push(certId);
            else
                newExpanded.splice(certIndex, 1);
            return { expanded:  newExpanded };
        });
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    render() {
        const { addAlert, certs, cas, appOnValueChanged } = this.props;

        const items = Object.entries(certs).map(([certPath, cert], idx) => {
            const idPrefix = cockpit.format("certificate-$0", idx);
            const onAutorenewChanged = this.onAutorenewChanged;

            const tabRenderers = [
                {
                    name: _("General"),
                    id: idPrefix + "-general-tab",
                    renderer: generalDetails,
                    data: { idPrefix, cas, cert, certPath, onAutorenewChanged }
                },
                {
                    name: _("Keys"),
                    id: idPrefix + "-keys-tab",
                    renderer: keyDetails,
                    data: { idPrefix, cert }
                },
                {
                    name: _("Cert"),
                    id: idPrefix + "-cert-tab",
                    renderer: certDetails,
                    data: { idPrefix, cert }
                },
            ];

            const expandedContent = (<ListingPanel colSpan='4' tabRenderers={tabRenderers} />);
            let caTitle = getCAName(cas, cert);
            if (caTitle !== "SelfSign") {
                caTitle = (
                    <Badge id={`${idPrefix}-ca`}>
                        {caTitle}
                    </Badge>
                );
            } else {
                caTitle = (
                    <span id={`${idPrefix}-ca`}>
                        {caTitle}
                    </span>
                );
            }

            return {
                columns: [
                    {
                        title: (cert["cert-nickname"] && cert["cert-nickname"].v)
                            ? <span id={`${idPrefix}-name`}>{cert["cert-nickname"].v}</span>
                            : <span id={`${idPrefix}-name`}>
                                {cert.nickname && cert.nickname.v + _(" (Request ID)")}
                            </span>
                    },
                    {
                        title: cert["not-valid-after"] && cert["not-valid-after"].v !== 0 &&
                        <span id={`${idPrefix}-validity`}>{getExpirationTime(cert)}</span>
                    },
                    { title: cert.ca && cert.ca.v && caTitle },
                    {
                        title: <CertificateActions certs={certs}
                                 cert={cert}
                                 certPath={certPath}
                                 addAlert={addAlert}
                                 appOnValueChanged={appOnValueChanged}
                                 idPrefix={idPrefix} />
                    },
                ],
                rowId: idPrefix,
                props: { key: idPrefix },
                initiallyExpanded: false,
                expandedContent: expandedContent,
            };
        });

        const actions = (
            <RequestCertificate cas={cas} addAlert={addAlert} />
        );

        return (
            <ListingTable caption={_("Certificates")}
                variant='compact'
                emptyCaption={_("No certificate is tracked on this host")}
                columns={[
                    { title: _("Name") },
                    { title: _("Validity") },
                    { title: _("Certificate Authority") },
                    { title: _("Actions") },
                ]}
                actions={actions}
                rows={items} />
        );
    }
}

export default CertificateList;
