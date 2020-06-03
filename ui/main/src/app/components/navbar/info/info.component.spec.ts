

import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {InfoComponent} from './info.component';
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import {RouterTestingModule} from "@angular/router/testing";
import {StoreModule} from "@ngrx/store";
import {appReducer} from "@ofStore/index";
import {TimeService} from "@ofServices/time.service";
import createSpyObj = jasmine.createSpyObj;

describe('InfoComponent', () => {
  let component: InfoComponent;
  let fixture: ComponentFixture<InfoComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ InfoComponent ],
        imports: [
            NgbModule.forRoot(),
            RouterTestingModule,
            StoreModule.forRoot(appReducer)
        ],
        providers: [{provide:'TimeEventSource',useValue:null},
          {provide:TimeService,useValue:createSpyObj('TimeService',
                 ['formatTime'])}]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
