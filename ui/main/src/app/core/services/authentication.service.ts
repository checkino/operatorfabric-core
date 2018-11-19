/* Copyright (c) 2018, RTE (http://www.rte-france.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, map} from 'rxjs/operators';

export enum LocalStorageAuthContent {
    token = 'token',
    expirationDate = 'expirationDate',
    identifier = 'identifier',
    clientId = 'clientId'
}

export const ONE_SECOND = 1000;

@Injectable()
export class AuthenticationService {


    private checkTokenUrl = '/auth/check_token';
    private askTokenUrl = '/auth/token';

    constructor(private httpClient: HttpClient) {
    }

    checkAuthentication(token: string): Observable<CheckTokenResponse> {

        const postData = new FormData();
        postData.append('token', token);
        return this.httpClient.post<CheckTokenResponse>(this.checkTokenUrl, postData).pipe(
            map(check => check),
            catchError(this.handleError)
        );
    }


    tempLogin(): Observable<any> {
        /*
         * uses a default user defined in the class org/lfenergy.operatorfabric.auth.config.WebSecurityConfiguration.java
         * in $OPERATOR_FABRIC_CORE_HOME/services/infra/auth/src/main/java/
        */
        const loginData = new LoginData('rte-operator', 'test', 'clientIdPassword');
        return this.askForToken(loginData);
    }

    askForToken(loginData): Observable<any> {

        const params = new URLSearchParams();
        params.append('username', loginData.username);
        params.append('password', loginData.password);
        params.append('grant_type', 'password');
        params.append('client_id', loginData.clientId);

        const headers = new HttpHeaders({'Content-type': 'application/x-www-form-urlencoded; charset=utf-8'});
        return this.httpClient.post<AuthObjet>(this.askTokenUrl
            , params.toString()
            , {headers: headers}).pipe(
            map(data => {
                const trackism = {...data};
                trackism.identifier = loginData.username;
                trackism.clientId = loginData.clientId;
                this.saveTokenAndAuthenticationInformation(trackism);
                return trackism;
            }),
            catchError(this.handleError)
        );

    }

    private handleError(error: any) {
        console.error(error);
        return throwError(error);
    }

    public extractToken() {
        return localStorage.getItem('token');
    }

    public verifyExpirationDate(): boolean {
        const expirationDate = Date.parse(localStorage.getItem(LocalStorageAuthContent.expirationDate));
        return (!expirationDate && Date.now() > expirationDate) || isNaN(expirationDate);
    }

    public clearAuthenticationInformation(): void {
        localStorage.removeItem(LocalStorageAuthContent.token);
        localStorage.removeItem(LocalStorageAuthContent.expirationDate);
        localStorage.removeItem(LocalStorageAuthContent.identifier);
    }

    public registerAuthenticationInformation(payload: CheckTokenResponse, token: string) {
        const identifier = payload.sub;
        const expirationDate = new Date(payload.exp);
        localStorage.setItem(LocalStorageAuthContent.identifier, identifier);
        localStorage.setItem(LocalStorageAuthContent.token, token);
        localStorage.setItem(LocalStorageAuthContent.expirationDate, expirationDate.toString());
        return {identifier: identifier, expirationDate: expirationDate};
    }

    public saveTokenAndAuthenticationInformation(payload: AuthObjet) {
        const expirationDate = new Date().getTime() + ONE_SECOND * payload.expires_in;
        localStorage.setItem(LocalStorageAuthContent.identifier, payload.identifier);
        localStorage.setItem(LocalStorageAuthContent.token, payload.access_token);
        localStorage.setItem(LocalStorageAuthContent.expirationDate, new Date(expirationDate).toString());
        localStorage.setItem(LocalStorageAuthContent.clientId, payload.clientId);
    }

}

export class AuthObjet {
    identifier?: string;
    access_token: string;
    expires_in: number;
    clientId: string;
}

export class CheckTokenResponse {
    sub: string;
    exp: number;
    client_id: string;
}

export class LoginData {
    constructor(public  username: string,
                public password: string,
                public clientId: string) {
    }
}
