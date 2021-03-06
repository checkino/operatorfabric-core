/* Copyright (c) 2018-2021, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */


import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {AppState} from '@ofStore/index';
import {ProcessesService} from '@ofServices/processes.service';
import {Store} from '@ngrx/store';
import {takeUntil} from 'rxjs/operators';
import {FormControl, FormGroup} from '@angular/forms';
import {ConfigService} from '@ofServices/config.service';
import {TimeService} from '@ofServices/time.service';
import {NgbDateStruct, NgbModal, NgbModalOptions, NgbModalRef, NgbTimeStruct} from '@ng-bootstrap/ng-bootstrap';
import {DateTimeNgb} from '@ofModel/datetime-ngb.model';
import {CardService} from '@ofServices/card.service';
import {LightCard} from '@ofModel/light-card.model';
import {Page} from '@ofModel/page.model';
import {ExportService} from '@ofServices/export.service';
import {TranslateService} from '@ngx-translate/core';
import {Card} from '@ofModel/card.model';
import {buildSettingsOrConfigSelector} from '@ofStore/selectors/settings.x.config.selectors';

export enum FilterDateTypes {
    PUBLISH_DATE_FROM_PARAM = 'publishDateFrom',
    PUBLISH_DATE_TO_PARAM = 'publishDateTo',
    ACTIVE_FROM_PARAM = 'activeFrom',
    ACTIVE_TO_PARAM = 'activeTo'

}

export const checkElement = (enumeration: typeof FilterDateTypes, value: string): boolean => {
    let result = false;
    if (Object.values(enumeration).map(enumValue => enumValue.toString()).includes(value)) {
        result = true;
    }
    return result;
};

export const transformToTimestamp = (date: NgbDateStruct, time: NgbTimeStruct): string => {
    return new DateTimeNgb(date, time).formatDateTime();
};

@Component({
    selector: 'of-archives',
    templateUrl: './archives.component.html',
    styleUrls: ['./archives.component.scss']
})
export class ArchivesComponent implements OnDestroy, OnInit {

    unsubscribe$: Subject<void> = new Subject<void>();

    tags: any[];
    size: number;
    archiveForm: FormGroup;

    filters;
    results: LightCard[];
    currentPage = 0;
    resultsNumber: number = 0;
    hasResult = false;
    firstQueryHasBeenDone = false;

    // Filter values
    serviceDropdownList = [];
    serviceDropdownSettings = {};
    processDropdownList = [];
    processDropdownListWhenSelectedService = [];
    processesWithoutServiceDropdownList = [];
    processDropdownSettings = {};
    stateDropdownListWhenSelectedProcess = [];
    stateDropdownSettings = {};
    tagsDropdownList = [];
    tagsDropdownSettings = {};

    // View card
    modalRef: NgbModalRef;
    @ViewChild('cardDetail') cardDetailTemplate: ElementRef;
    selectedCard : Card;

    processesDropdownListPerServices = new Map();
    statesDropdownListPerProcesses = new Map();
    processesGroups: {id: string, processes: string[]}[];

    constructor(private store: Store<AppState>,
                private processesService: ProcessesService,
                private configService: ConfigService,
                private timeService: TimeService,
                private cardService: CardService,
                private exportService: ExportService,
                private translate: TranslateService,
                private modalService: NgbModal
    ) {

        this.archiveForm = new FormGroup({
            tags: new FormControl([]),
            state: new FormControl([]),
            process: new FormControl([]),
            service: new FormControl([]),
            publishDateFrom: new FormControl(),
            publishDateTo: new FormControl(''),
            activeFrom: new FormControl(''),
            activeTo: new FormControl(''),
        });


    }

    ngOnInit() {
        this.tags = this.configService.getConfigValue('archive.filters.tags.list');
        this.size = this.configService.getConfigValue('archive.filters.page.size', 10);
        this.results = new Array();
        this.processesGroups = this.processesService.getProcessGroups();
        this.processesService.getAllProcesses().forEach((process) => {
            const id = process.id;
            let itemName = process.name;
            if (!itemName) {
                itemName = id;
            }
            this.processDropdownList.push({ id: id, itemName: itemName, i18nPrefix: `${process.id}.${process.version}` });
        });
        this.processDropdownListWhenSelectedService = [];
        this.stateDropdownListWhenSelectedProcess = [];

        if (!!this.tags) {
            this.tags.forEach(tag => this.tagsDropdownList.push({ id: tag.value, itemName: tag.label }));
        }

        this.loadAllProcessesPerServices();
        this.loadAllStatesPerProcesses();

        this.getLocale().pipe(takeUntil(this.unsubscribe$)).subscribe(locale => {
            this.translate.use(locale);
            this.translate.get(['archive.selectServiceText','archive.selectProcessText','archive.selectStateText',
                'archive.selectTagText'])
                .subscribe(translations => {
                    this.serviceDropdownSettings = {
                        text: translations['archive.selectServiceText'],
                        badgeShowLimit: 1,
                        enableSearchFilter: true
                    }
                    this.processDropdownSettings = {
                        text: translations['archive.selectProcessText'],
                        badgeShowLimit: 1,
                        enableSearchFilter: true
                    }
                    this.stateDropdownSettings = {
                        text: translations['archive.selectStateText'],
                        badgeShowLimit: 1,
                        enableSearchFilter: true
                    }
                    this.tagsDropdownSettings = {
                        text: translations['archive.selectTagText'],
                        badgeShowLimit: 1,
                        enableSearchFilter: true
                    };
                })
        });
        this.changeProcessesWhenSelectService();
        this.changeStatesWhenSelectProcess();
    }

    addProcessesDropdownList(processesDropdownList: any[]): void {
        processesDropdownList.forEach( processDropdownList =>
            this.processDropdownListWhenSelectedService.push(processDropdownList) );
    }

    addStatesDropdownList(statesDropdownList: any[]): void {
        statesDropdownList.forEach( stateDropdownList =>
            this.stateDropdownListWhenSelectedProcess.push(stateDropdownList) );
    }

    changeProcessesWhenSelectService(): void {
        this.archiveForm.get('service').valueChanges.subscribe((selectedServices) => {

            if (!! selectedServices && selectedServices.length > 0) {
                this.processDropdownListWhenSelectedService = [];
                selectedServices.forEach(service => {

                    if (service.id == '--')
                        this.addProcessesDropdownList(this.processesWithoutServiceDropdownList);
                    else
                        this.addProcessesDropdownList(this.processesDropdownListPerServices.get(service.id));
                });
            }
            else
                this.processDropdownListWhenSelectedService = [];
        });
    }

    changeStatesWhenSelectProcess(): void {
        this.archiveForm.get('process').valueChanges.subscribe((selectedProcesses) => {

            if (!! selectedProcesses && selectedProcesses.length > 0) {
                this.stateDropdownListWhenSelectedProcess = [];
                selectedProcesses.forEach(process =>
                    this.addStatesDropdownList(this.statesDropdownListPerProcesses.get(process.id))
                );
            }
            else
                this.stateDropdownListWhenSelectedProcess = [];
        });
    }

    findServiceForProcess(processId : string) : string {
        for (let group of this.processesGroups) {
            if (group.processes.find(process => process == processId))
                return group.id;
        }
        return '';
    }

    findServiceLabelForProcess(processId : string) : string {
        const serviceId = this.findServiceForProcess(processId);
        return (!! serviceId && serviceId != '') ? serviceId : "service.defaultLabel";
    }

    loadAllProcessesPerServices(): void {
        this.processesService.getAllProcesses().forEach(process => {

            const service = this.findServiceForProcess(process.id);
            if (service != '') {
                let processes = (!! this.processesDropdownListPerServices.get(service) ? this.processesDropdownListPerServices.get(service) : []);
                processes.push({id: process.id, itemName: process.name, i18nPrefix: `${process.id}.${process.version}`});
                this.processesDropdownListPerServices.set(service, processes);
            }
            else
                this.processesWithoutServiceDropdownList.push({ id: process.id, itemName: process.name, i18nPrefix: `${process.id}.${process.version}` });
        });
        if (this.processesWithoutServiceDropdownList.length > 0)
            this.serviceDropdownList.push({ id: '--', itemName: "service.defaultLabel" });

        const services = Array.from(this.processesDropdownListPerServices.keys());
        services.forEach(service => this.serviceDropdownList.push({ id: service, itemName: service }));
    }

    loadAllStatesPerProcesses(): void {
        this.processesService.getAllProcesses().forEach(process => {

            let statesDropdownList = [];
            for (let state in process.states)
                statesDropdownList.push({id: process.id + '.' + state, itemName: process.states[state].name, i18nPrefix: `${process.id}.${process.version}`});
            this.statesDropdownListPerProcesses.set(process.id, statesDropdownList);
        });
    }

    displayServiceFilter() {
        return !!this.serviceDropdownList && this.serviceDropdownList.length > 1 ;
    }

    protected getLocale(): Observable<string> {
        return this.store.select(buildSettingsOrConfigSelector('locale'));
    }

    /**
     * Transforms the filters list to Map
     */
    filtersToMap = (filters: any) : void => {
        this.filters = new Map();
        Object.keys(filters).forEach(key => {
            const element = filters[key];
            // if the form element is date
            if (element) {
                if (checkElement(FilterDateTypes, key))
                    this.dateFilterToMap(key, element);
                else {
                    if (element.length) {
                        const ids = [];
                        if (key == 'state')
                            this.stateFilterToMap(element);
                        else if (key == 'service')
                            this.serviceFilterToMap(element);
                        else {
                            element.forEach(val => ids.push(val.id));
                            this.filters.set(key, ids);
                        }
                    }
                }
            }
        });
    }

    dateFilterToMap(key: string, element: any) {
        const { date, time } = element;
        if (date) {
            const timeStamp = this.timeService.toNgBTimestamp(transformToTimestamp(date, time));
            if (timeStamp !== 'NaN')
                this.filters.set(key, [timeStamp]);
        }
    }

    stateFilterToMap(element: any) {
        const ids = [];
        element.forEach(val => ids.push(val.id.substring(val.id.indexOf('.') + 1)));
        this.filters.set('state', ids);
    }

    serviceFilterToMap(element: any) {
        const ids = [];

        element.forEach(service => {
            if (service.id == '--')
                this.processesWithoutServiceDropdownList.forEach(process => ids.push(process.id))
            else
                this.processesDropdownListPerServices.get(service.id).forEach(process => ids.push(process.id))
        });

        if (!this.filters.get('process'))
            this.filters.set('process', ids);
    }

    resetForm() {
        this.archiveForm.reset();
        this.firstQueryHasBeenDone = false;
        this.hasResult = false;
        this.resultsNumber = 0;
    }


    sendQuery(page_number): void {
        const { value } = this.archiveForm;
        this.filtersToMap(value);
        this.filters.set('size', [this.size.toString()]);
        this.filters.set('page', [page_number]);
        this.cardService.fetchArchivedCards(this.filters)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((page: Page<LightCard>) => {
                this.resultsNumber = page.totalElements;
                this.currentPage = page_number + 1; // page on ngb-pagination component start at 1 , and page on backend start at 0
                this.firstQueryHasBeenDone = true;
                if (page.content.length > 0) this.hasResult = true;
                else this.hasResult = false;
                page.content.forEach(card => this.loadTranslationForCardIfNeeded(card));
                this.results = page.content;
            });

    }

    loadTranslationForCardIfNeeded(card: LightCard) {
        this.processesService.loadTranslationsForProcess(card.process, card.processVersion);
    }

    updateResultPage(currentPage): void {
        // page on ngb-pagination component start at 1 , and page on backend start at 0
        this.sendQuery(currentPage - 1);
    }

    displayTime(date) {
        return this.timeService.formatDateTime(date);
    }


    // EXPORT TO EXCEL

    initExportArchiveData(): void {
        const exportArchiveData = [];

        this.filters.set('size', [this.resultsNumber.toString()]);
        this.filters.set('page', [0]);

        this.cardService.fetchArchivedCards(this.filters).pipe(takeUntil(this.unsubscribe$))
            .subscribe((page: Page<LightCard>) => {
                const lines = page.content;

                const severityColumnName = this.translateColomn('archive.result.severity');
                const publishDateColumnName = this.translateColomn('archive.result.publishDate');
                const businessDateColumnName = this.translateColomn('archive.result.businessPeriod');
                const titleColumnName = this.translateColomn('archive.result.title');
                const summaryColumnName = this.translateColomn('archive.result.summary');

                lines.forEach((card: LightCard) => {
                    if (typeof card !== undefined) {
                        // TO DO translation for old process should be done  , but loading local arrive to late , solution to find
                        exportArchiveData.push({
                            [severityColumnName]: card.severity,
                            [publishDateColumnName]: this.timeService.formatDateTime(card.publishDate),
                            [businessDateColumnName]: this.displayTime(card.startDate) + '-' + this.displayTime(card.endDate),
                            [titleColumnName]: this.translateColomn(card.process + '.' + card.processVersion + '.' + card.title.key, card.title.parameters),
                            [summaryColumnName]: this.translateColomn(card.process + '.' + card.processVersion + '.' + card.summary.key, card.summary.parameters)
                        });
                    }
                });
                this.exportService.exportAsExcelFile(exportArchiveData, 'Archive');
            });
    }

    export(): void {
        this.initExportArchiveData();
    }

    translateColomn(key: string | Array<string>, interpolateParams?: Object): any {
        let translatedColomn: number;

        this.translate.get(key, interpolateParams)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((translate) => { translatedColomn = translate; });

        return translatedColomn;
    }


    openCard(cardId) {
        this.cardService.loadArchivedCard(cardId).subscribe((card: Card) => {
                this.selectedCard = card;
                const options: NgbModalOptions = {
                    size: 'fullscreen'
                };
                this.modalRef = this.modalService.open(this.cardDetailTemplate, options);
            }
        );
    }

    getPublishDateTranslationParams(): any {
        const param = {
            'time': this.timeService.formatDateTime(this.selectedCard.publishDate)
        }
        return param;
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

}
