/* Copyright (c) 2018-2020, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */



import {CardEffects} from './card.effects';
import {getOneRandomCard} from '@tests/helpers';
import {Actions} from '@ngrx/effects';
import {hot} from 'jasmine-marbles';
import {LoadCard, LoadCardSuccess, ClearCard} from "@ofActions/card.actions";
import { ClearLightCardSelection } from '@ofStore/actions/light-card.actions';

describe('CardEffects', () => {
    let effects: CardEffects;
    xit('should return a LoadLightCardsSuccess when the cardService serve an array of Light Card', () => {
        const expectedCard =  getOneRandomCard();

        const localActions$ = new Actions(hot('-a--', {a: new LoadCard({id:"123"})}));

        const localMockCardService = jasmine.createSpyObj('CardService', ['loadCard']);

        const mockStore = jasmine.createSpyObj('Store',['dispatch']);

        localMockCardService.loadCard.and.returnValue(hot('---b', {b: expectedCard}));
        const expectedAction = new LoadCardSuccess({card: expectedCard, childCards: undefined});
        const localExpected = hot('---c', {c: expectedAction});

        effects = new CardEffects(mockStore, localActions$, localMockCardService);

        expect(effects).toBeTruthy();
        expect(effects.loadById).toBeObservable(localExpected);
    });
    it('should cleat the card selection', () => {
        const mockStore = jasmine.createSpyObj('Store', ['dispatch']);
        const localMockCardService = jasmine.createSpyObj('CardService', ['loadCard']);
        const clearAction$ = new Actions(hot('--a', {a: new ClearLightCardSelection()}));
        const expectedClearAction = new ClearCard();
        const localClearExpected = hot('--c', {c: expectedClearAction});
        effects = new CardEffects(mockStore, clearAction$, localMockCardService);
        expect(effects).toBeTruthy();
        expect(effects.clearCardSelection).toBeObservable(localClearExpected);
    });

});
