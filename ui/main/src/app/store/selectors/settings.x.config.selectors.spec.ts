/* Copyright (c) 2018-2020, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */



import {AppState} from "@ofStore/index";
import {settingsInitialState, SettingsState} from "@ofStates/settings.state";
import {configInitialState, ConfigState} from "@ofStates/config.state";
import {buildSettingsOrConfigSelector} from "@ofSelectors/settings.x.config.selectors";
import {emptyAppState4Test} from "@tests/helpers";

describe('SettingsXConfigSelectors', () => {
    let emptyAppState: AppState = emptyAppState4Test;

    let loadedSettingsState: SettingsState = {
        ...settingsInitialState,
        loaded: true,
        settings: {
            test: {
                path: {my: {settings: 'value'}}
            },
            booleanTest1: false,
            booleanTest2: true
        }

    };
    let loadedConfigState: ConfigState = {
        ...configInitialState,
        loaded: true,
        config: {
            settings: {
                test: {
                    path: {my: {settings: 'default value'}},
                    byDefault:{
                        value: 'default value'
                    }
                },
                booleanTest1: true,
                booleanTest2: false,
                booleanTest3: true
            }
        }
    };



    it('manage empty', () => {
        let testAppState = {...emptyAppState, settings: settingsInitialState, config: configInitialState};
        expect(buildSettingsOrConfigSelector('test.path.my.settings')(testAppState)).toEqual(null);
        expect(buildSettingsOrConfigSelector('test.byDefault.value')(testAppState)).toEqual(null);
        expect(buildSettingsOrConfigSelector('test.byDefault.value','fallback')(testAppState)).toEqual('fallback');
        expect(buildSettingsOrConfigSelector('booleanTest1')(testAppState)).toEqual(null);
        expect(buildSettingsOrConfigSelector('booleanTest2')(testAppState)).toEqual(null);
        expect(buildSettingsOrConfigSelector('booleanTest3')(testAppState)).toEqual(null);
    });

    it('manage loaded settings and config', () => {
        let testAppState = {...emptyAppState, settings: loadedSettingsState, config: loadedConfigState};
        expect(buildSettingsOrConfigSelector('test.path.my.settings')(testAppState)).toEqual('value');
        expect(buildSettingsOrConfigSelector('test.byDefault.value')(testAppState)).toEqual('default value');
        expect(buildSettingsOrConfigSelector('test.byDefault.value','fallback')(testAppState)).toEqual('default value');
        expect(buildSettingsOrConfigSelector('booleanTest1')(testAppState)).toEqual(false);
        expect(buildSettingsOrConfigSelector('booleanTest2')(testAppState)).toEqual(true);
        expect(buildSettingsOrConfigSelector('booleanTest3')(testAppState)).toEqual(true);
    });

})
;
