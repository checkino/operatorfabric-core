

import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from "@angular/forms";
import {Store} from "@ngrx/store";
import {AppState} from "@ofStore/index";
import {Observable, Subject, timer} from "rxjs";
import {buildFilterSelector} from "@ofSelectors/feed.selectors";
import {FilterType} from "@ofServices/filter.service";
import {debounce, distinctUntilChanged, first, takeUntil} from "rxjs/operators";
import {Filter} from "@ofModel/feed-filter.model";
import * as _ from "lodash";
import {ApplyFilter} from "@ofActions/feed.actions";

@Component({
    selector: 'of-tags-filter',
    templateUrl: './tags-filter.component.html',
    styleUrls: ['./tags-filter.component.scss']
})
export class TagsFilterComponent implements OnInit, OnDestroy {

    tagFilterForm: FormGroup;
    private ngUnsubscribe$ = new Subject<void>();
    private _filter$: Observable<Filter>;

    constructor(private formBuilder: FormBuilder,private store: Store<AppState>) {
        this.tagFilterForm = this.createFormGroup()
    }

    ngOnInit() {
        this._filter$ = this.store.select(buildFilterSelector(FilterType.TAG_FILTER));
        this._filter$.pipe(takeUntil(this.ngUnsubscribe$)).subscribe((next: Filter) => {
            if (next) {
                this.tagFilterForm.get('tags').setValue(next.active?next.status.tags:[], {emitEvent: false});
            } else {
                this.tagFilterForm.get('tags').setValue([], {emitEvent: false});
            }
        });
        this._filter$.pipe(first(),takeUntil(this.ngUnsubscribe$)).subscribe(()=>{
            this.tagFilterForm
                .valueChanges
                .pipe(
                    takeUntil(this.ngUnsubscribe$),
                    distinctUntilChanged((formA, formB)=>{
                        console.log(new Date().toISOString(),"BUG OC-604 tags-filter.component.ts ngOnInit() formA.tags=",formA.tags,",formB.tags=",formB.tags);
                        return _.difference(formA.tags,formB.tags).length===0 && _.difference(formB.tags,formA.tags).length===0;
                    }),
                    debounce(() => timer(500)))
                .subscribe(form => {
                    console.log(new Date().toISOString(),"BUG OC-604 tags-filter.component.ts ngOnInit() new ApplyFilter TAG_FILTER");
                    this.store.dispatch(
                    new ApplyFilter({
                        name: FilterType.TAG_FILTER,
                        active: form.tags.length>0,
                        status: form
                    }))
                });
        });
    }

    ngOnDestroy() {
        this.ngUnsubscribe$.next();
        this.ngUnsubscribe$.complete();
    }

    private createFormGroup() {
        return this.formBuilder.group({
                tags: []
            }
        );
    }
}
