
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
    DataList,
    DataListItem,
    DataListItemRow,
    DataListCell,
    DataListToggle,
    DataListContent,
    DataListItemCells,
    Flex,
    FlexItem,
    FlexModifiers,
    Tabs,
    Tab,
    TabsVariant,
    TabContent
} from "@patternfly/react-core";

import "./certificateList.css";
import "../lib/form-layout.less";
import { ListingPanel } from "../lib/cockpit-components-listing-panel.jsx";
import { ListingTable } from "../lib/cockpit-components-table.jsx";
import { getRequests, getRequest, getCA } from "./dbus.js";

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
    moment.locale(cockpit.language, {
        calendar : {
            lastDay : `[${yesterday}] LT`,
            sameDay : `[${today}] LT`,
            sameElse : "L"
        }
    });

    return moment(Number(unixTime) * 1000).calendar();
}

function getExpirationTime(cert) {
    if (cert.autorenew.v) {
        return _("Auto-renews before ") + prettyTime(cert["not-valid-after"].v);
    } else {
        const eventdate = moment(Number(cert["not-valid-after"].v) * 1000);
        const todaysdate = moment();
        const diff = eventdate.diff(todaysdate, "days");

        if (diff < 30)
            return _("Expires in ") + diff;
        else
            return _("Expires on ") + prettyTime(cert["not-valid-after"].v);
    }
}

function getCAName(cas, cert) {
    return cas[cert.ca.v.replace("request", "ca")]
        && cas[cert.ca.v.replace("request", "ca")].nickname.v;
}

const generalDetails = ({ cert }) => (
    <Flex className="overview-tab-grid certificate-tab-body"
        breakpointMods={[{modifier: FlexModifiers["justify-content-space-between"]}]}>
        <Flex breakpointMods={[{modifier: FlexModifiers["column", "flex-1"]}]}>
            <div className="ct-form">
                <label className='control-label label-title'>{_("Status")}</label>
                <span>
                    {cert.status.v.charAt(0)
                     + cert.status.v.substring(1).toLowerCase()}
                </span>
                <label className='control-label label-title'>{_("CA")}</label>
                <span>{getCAName(cas, cert)}</span>
            </div>
        </Flex>
        <Flex breakpointMods={[{modifier: FlexModifiers["column", "flex-1"]}]}>
            <div className="ct-form">
                <label className='control-label label-title'>
                    {_("Valid")}
                </label>
                <span>
                    {prettyTime(cert["not-valid-before"].v)
                    +  _(" to ") + prettyTime(cert["not-valid-after"].v)}
                </span>
                <label className='control-label label-title'>
                    {_("Auto-renewal")}
                </label>
                <span>{cert.autorenew.v ? _("Yes") : _("No")}</span>
                <label className='control-label label-title'>{_("Stuck")}</label>
                <span>{cert.stuck.v ? _("Yes") : _("No")}</span>
            </div>
        </Flex>
    </Flex>
);

const keyDetails = ({ cert }) => (
    <Flex className="overview-tab-grid certificate-tab-body"
        breakpointMods={[{modifier: FlexModifiers["justify-content-space-between"]}]}>
        <Flex breakpointMods={[{modifier: FlexModifiers["column", "flex-1"]}]}>
            <div className="ct-form">
                <label className='control-label label-title'>{_("Nickname")}</label>
                <span>{cert["key-nickname"].v}</span>
                <label className='control-label label-title'>{_("Type")}</label>
                <span>{cert["key-type"].v}</span>
                <label className='control-label label-title'>{_("Token")}</label>
                <span>{cert["key-token"].v}</span>
            </div>
        </Flex>
        <Flex breakpointMods={[{modifier: FlexModifiers["column", "flex-1"]}]}>
            <div className="ct-form">
                <label className='control-label label-title'>{_("Location")}</label>
                <span>{cert["key-database"].v}</span>
                <label className='control-label label-title'>{_("Storage")}</label>
                <span>{cert["key-storage"].v}</span>
            </div>
        </Flex>
    </Flex>
);

const certDetails = ({ cert }) => (
    <Flex className="overview-tab-grid certificate-tab-body"
        breakpointMods={[{modifier: FlexModifiers["justify-content-space-between"]}]}>
        <Flex breakpointMods={[{modifier: FlexModifiers["column", "flex-1"]}]}>
            <div className="ct-form">
                <label className='control-label label-title'>{_("Nickname")}</label>
                <span>{cert["cert-nickname"].v}</span>
                <label className='control-label label-title'>{_("Token")}</label>
                <span>{cert["cert-token"].v}</span>
            </div>
        </Flex>
        <Flex breakpointMods={[{modifier: FlexModifiers["column", "flex-1"]}]}>
            <div className="ct-form">
                <label className='control-label label-title'>{_("Location")}</label>
                <span>{cert["cert-database"].v}</span>
                <label className='control-label label-title'>{_("Storage")}</label>
                <span>{cert["cert-storage"].v}</span>
            </div>
        </Flex>
    </Flex>
);

class CertificateList extends React.Component {
    constructor() {
        super();
        this.state = {
            certs: [],
            cas: {},
            expanded: [],
            activeTabKey: 0,
        };

        this.toggle = this.toggle.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    componentDidMount() {
        const addAlert = this.props.addAlert;

        getRequests()
                .then(paths => {
                    paths[0].forEach(p => {
                        let caPath;
                        return getRequest(p)
                                .then(ret => {
                                    const certs = [...this.state.certs, ret[0]];
                                    this.onValueChanged("certs", certs);

                                    // TODO report bug
                                    caPath = ret[0].ca.v.replace("request", "ca");
                                    return getCA(caPath);
                                })
                                .then(ret => {
                                    const cas = {...this.state.cas, [caPath]: ret[0]};
                                    this.onValueChanged("cas", cas);
                                })
                    });
                })
                .catch(error => {
                    addAlert(_("Error: ") + error.name, error.message);
                });
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
        const { cas, certs} = this.state;
        const items = certs.map(cert => {
            const idPrefix = cockpit.format("certificate-$0", cert.nickname.v);

            const tabRenderers = [
                { name: _("General"), id: idPrefix + "-general", renderer: generalDetails, data: { cert } },
                { name: _("Keys"), id: idPrefix + "-keys", renderer: keyDetails, data: { cert } },
                { name: _("Cert"), id: idPrefix + "-cert", renderer: certDetails, data: { cert } },
            ];

            const expandedContent = (<ListingPanel colSpan='4' tabRenderers={tabRenderers} />);

            return {
                columns: [
                    { title: <span id={`${idPrefix}-name`}>{cert["cert-nickname"].v}</span> },
                    { title: <span id={`${idPrefix}-validity`}>{getExpirationTime(cert)}</span> },
                    { title: <span id={`${idPrefix}-ca`}>{getCAName(cas, cert)}</span> },
                ],
                rowId: idPrefix,
                props: { key: idPrefix },
                initiallyExpanded: false,
                expandedContent: expandedContent,
            };
        });

        console.log(items);
        return (
            <ListingTable caption={_("Certificates")}
                variant='compact'
                emptyCaption={_("No certificate is tracked on this host")}
                columns={[
                    { title: _("Name") },
                    { title: _("Validity") },
                    { title: _("Certificate Authority") },
                ]}
                rows={items} />
        );
    }
}

export default CertificateList;
