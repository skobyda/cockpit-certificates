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
import "./app.scss";

import { Alert, AlertGroup, AlertActionCloseButton, AlertVariant } from '@patternfly/react-core';

import EmptyState from "./emptyState.jsx";
import { getRequests, getRequest, getCAs, getCA } from './dbus.js';
import * as service from "../lib/service.js";

import CertificateList from "./certificateList.jsx";

const _ = cockpit.gettext;
const CERTMONGER_SERVICE_NAME = "certmonger.service";

export class Application extends React.Component {
    constructor() {
        super();
        this.state = {
            alerts: [],
            certmongerService: undefined,
            initialPhase: true,
            cas: [],
        };

        this.addAlert = this.addAlert.bind(this);
        this.removeAlert = this.removeAlert.bind(this);
    }

    addAlert(title, message) {
        const alerts = [...this.state.alerts];
        alerts.push({ title, message });

        this.setState({ alerts: alerts });
    }

    removeAlert(index) {
        const alerts = [...this.state.alerts];
        alerts.splice(index, 1);

        this.setState({ alerts: alerts });
    }

    componentDidMount() {
        this.subscribeToSystemd();
        this.updateCertmongerService();
        this.getCertificateAuthorities();
    }

    getCertificateAuthorities() {
        getCAs().then(paths => {
                    paths[0].forEach(path => {
                        getCA(path)
                                .then(ret => {
                                    const ca = { path: path, obj: ret[0] };
                                    this.setState({ cas: {...this.state.cas, [path]: ret[0]} });
                                });
                    });
                })
                .catch(error => this.addAlert(_("Error: ") + error.name, error.message));
    }

    subscribeToSystemd() {
        const systemdClient = cockpit.dbus('org.freedesktop.systemd1', { bus: "system" });
        systemdClient.subscribe(
            // path string source:
            // #dbus-send --system --dest=org.freedesktop.systemd1 --type=method_call --print-reply /org/freedesktop/systemd1 org.freedesktop.systemd1.Manager.ListUnits
            { interface: 'org.freedesktop.DBus.Properties', path: '/org/freedesktop/systemd1/unit/certmonger_2eservice', member: 'PropertiesChanged' },
            (path, iface, signal, args) => {
                if (args[0] === "org.freedesktop.systemd1.Unit")
                    this.updateCertmongerService();
            }
        );
    }

    updateCertmongerService() {
        const { initialPhase } = this.state;

        const certmongerService = service.proxy(CERTMONGER_SERVICE_NAME);
        certmongerService.wait(() => {
            if (initialPhase && certmongerService.state === "stopped") {
                certmongerService.start()
                        .catch(error => this.setState({ startErrorMessage: JSON.stringify(error) }));
            }
            this.setState({ initialPhase: false, certmongerService });
        });
    }

    render() {
        const { certmongerService, startErrorMessage, cas } = this.state;

        const certificatesBody = (
            <CertificateList cas={cas} addAlert={this.addAlert}/>
        );

        const emptyStateBody = (
            <EmptyState service={ certmongerService }
                serviceName={ CERTMONGER_SERVICE_NAME }
                errorMessage={ startErrorMessage }
                updateService={ () => this.updateCertmongerService() } />
        );

        const body = () => {
            if (!certmongerService || !certmongerService.exists || !certmongerService.state || certmongerService.state !== "running")
                return emptyStateBody;

            return certificatesBody;
        }

        return (
            <>
                <div className="container-fluid">
                    { body() }
                </div>
                <AlertGroup isToast>
                    {this.state.alerts.map((danger, index) => (
                        <Alert isLiveRegion
                            variant={AlertVariant["danger"]}
                            title={danger.title}
                            action={
                                <AlertActionCloseButton variantLabel="danger alert"
                                  onClose={() => this.removeAlert(index)} />
                            }
                            key={index}>
                                {_("Error message: ") + danger.message}
                            </Alert>
                    ))}
                </AlertGroup>
            </>
        );
    }
}
