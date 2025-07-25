/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Subscription } from 'rxjs';
import { FilterManager } from '../filter_manager';
import { getFilter } from '../filter_manager/test_helpers/get_stub_filter';
import {
  DataStorage,
  Filter,
  FilterStateStore,
  IndexPatternsService,
  Query,
  UI_SETTINGS,
} from '../../../common';
import { coreMock } from '../../../../../core/public/mocks';
import {
  BaseStateContainer,
  createStateContainer,
  IOsdUrlStateStorage,
  createOsdUrlStateStorage,
} from '../../../../opensearch_dashboards_utils/public';
import { QueryService, QueryStart } from '../query_service';
import { connectStorageToQueryState, connectToQueryState } from './connect_to_query_state';
import { TimefilterContract } from '../timefilter';
import { QueryState } from './types';
import { createBrowserHistory, History } from 'history';
import { QueryStringContract } from '../query_string';
import { ISearchInterceptor } from '../../search';

const connectStorageToQueryStateFn = (
  query: QueryStart,
  OsdUrlStateStorage: IOsdUrlStateStorage
) => {
  connectStorageToQueryState(query, OsdUrlStateStorage, {
    filters: FilterStateStore.APP_STATE,
    query: true,
  });
};
const connectToQueryGlobalState = (query: QueryStart, state: BaseStateContainer<QueryState>) =>
  connectToQueryState(query, state, {
    refreshInterval: true,
    time: true,
    filters: FilterStateStore.GLOBAL_STATE,
  });

const connectToQueryAppState = (query: QueryStart, state: BaseStateContainer<QueryState>) =>
  connectToQueryState(query, state, {
    filters: FilterStateStore.APP_STATE,
  });

const setupMock = coreMock.createSetup();
const startMock = coreMock.createStart();

setupMock.uiSettings.get.mockImplementation((key: string) => {
  switch (key) {
    case 'defaultIndex':
      return 'logstash-*';
    case UI_SETTINGS.FILTERS_PINNED_BY_DEFAULT:
      return true;
    case UI_SETTINGS.SEARCH_QUERY_LANGUAGE:
      return 'kuery';
    case UI_SETTINGS.TIMEPICKER_TIME_DEFAULTS:
      return { from: 'now-15m', to: 'now' };
    case UI_SETTINGS.TIMEPICKER_REFRESH_INTERVAL_DEFAULTS:
      return { pause: false, value: 0 };
    case UI_SETTINGS.QUERY_ENHANCEMENTS_ENABLED:
      return false;
    case UI_SETTINGS.SEARCH_MAX_RECENT_DATASETS:
      return 4;
    default:
      throw new Error(`sync_query test: not mocked uiSetting: ${key}`);
  }
});

describe('connect_storage_to_query_state', () => {
  let queryServiceStart: QueryStart;
  let queryString: QueryStringContract;
  let queryChangeSub: Subscription;
  let queryChangeTriggered = jest.fn();
  let filterManager: FilterManager;
  let filterManagerChangeSub: Subscription;
  let filterManagerChangeTriggered = jest.fn();
  let osdUrlStateStorage: IOsdUrlStateStorage;
  let indexPatternsMock: IndexPatternsService;
  let history: History;
  let gF1: Filter;
  // @ts-expect-error TS6133 TODO(ts-error): fixme
  let gF2: Filter;
  let aF1: Filter;
  let aF2: Filter;
  let q1: Query;
  let mockSearchInterceptor: jest.Mocked<ISearchInterceptor>;

  beforeEach(() => {
    const queryService = new QueryService();
    mockSearchInterceptor = {} as jest.Mocked<ISearchInterceptor>;
    queryService.setup({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      sessionStorage: new DataStorage(window.sessionStorage, 'opensearch_dashboards.'),
      defaultSearchInterceptor: mockSearchInterceptor,
      application: setupMock.application,
      notifications: setupMock.notifications,
    });
    queryServiceStart = queryService.start({
      uiSettings: startMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      savedObjectsClient: startMock.savedObjects.client,
      indexPatterns: indexPatternsMock,
      application: startMock.application,
      notifications: startMock.notifications,
    });
    indexPatternsMock = ({
      get: jest.fn(),
    } as unknown) as IndexPatternsService;

    queryString = queryServiceStart.queryString;
    queryChangeTriggered = jest.fn();
    queryChangeSub = queryString.getUpdates$().subscribe(queryChangeTriggered);

    filterManager = queryServiceStart.filterManager;
    filterManagerChangeTriggered = jest.fn();
    filterManagerChangeSub = filterManager.getUpdates$().subscribe(filterManagerChangeTriggered);

    window.location.href = '/';
    history = createBrowserHistory();
    osdUrlStateStorage = createOsdUrlStateStorage({ useHash: false, history });

    gF1 = getFilter(FilterStateStore.GLOBAL_STATE, true, true, 'key1', 'value1');
    gF2 = getFilter(FilterStateStore.GLOBAL_STATE, false, false, 'key2', 'value2');
    aF1 = getFilter(FilterStateStore.APP_STATE, true, true, 'key3', 'value3');
    aF2 = getFilter(FilterStateStore.APP_STATE, false, false, 'key4', 'value4');

    q1 = {
      query: 'count is less than 100',
      language: 'kuery',
    };
  });

  afterEach(() => {
    filterManagerChangeSub.unsubscribe();
    queryChangeSub.unsubscribe();
  });

  test('state is initialized with default state', () => {
    expect(osdUrlStateStorage.get('_q')).toBeNull();
    connectStorageToQueryStateFn(queryServiceStart, osdUrlStateStorage);

    expect(osdUrlStateStorage.get('_q')).toEqual({
      query: queryString.getDefaultQuery(),
      filters: filterManager.getAppFilters(),
    });
  });

  test('state is initialized with URL states', () => {
    const initialStates = {
      filters: [aF1, aF2],
      query: q1,
    };
    osdUrlStateStorage.set('_q', initialStates, {
      replace: true,
    });
    connectStorageToQueryStateFn(queryServiceStart, osdUrlStateStorage);
    expect(filterManager.getFilters().length).toBe(2);
    expect(queryString.getQuery()).toStrictEqual(q1);
  });

  test('when global filter changes, filter in storage should not be updated', () => {
    connectStorageToQueryStateFn(queryServiceStart, osdUrlStateStorage);
    const previousStorage = osdUrlStateStorage.get('_q');
    filterManager.setFilters([gF1, gF1]);
    const updatedStorage = osdUrlStateStorage.get('_q');
    expect(previousStorage).toStrictEqual(updatedStorage);
  });

  test('when app filter changes, filter storage should be updated', () => {
    connectStorageToQueryStateFn(queryServiceStart, osdUrlStateStorage);
    const previousStorage = osdUrlStateStorage.get('_q');
    filterManager.setFilters([aF1, aF1]);
    const updatedStorage = osdUrlStateStorage.get('_q');
    expect(previousStorage).not.toStrictEqual(updatedStorage);
  });

  test('when query changes, state updates query', () => {
    connectStorageToQueryStateFn(queryServiceStart, osdUrlStateStorage);
    const previousStorage = osdUrlStateStorage.get('_q');
    queryString.setQuery(q1);
    const updatedStorage = osdUrlStateStorage.get('_q');
    expect(previousStorage).not.toStrictEqual(updatedStorage);
  });
});

describe('connect_to_global_state', () => {
  let queryServiceStart: QueryStart;
  let filterManager: FilterManager;
  let timeFilter: TimefilterContract;
  let globalState: BaseStateContainer<QueryState>;
  let globalStateSub: Subscription;
  let globalStateChangeTriggered = jest.fn();
  let filterManagerChangeSub: Subscription;
  let filterManagerChangeTriggered = jest.fn();
  let indexPatternsMock: IndexPatternsService;
  let mockSearchInterceptor: jest.Mocked<ISearchInterceptor>;

  let gF1: Filter;
  let gF2: Filter;
  let aF1: Filter;
  let aF2: Filter;

  beforeEach(() => {
    const queryService = new QueryService();
    mockSearchInterceptor = {} as jest.Mocked<ISearchInterceptor>;
    // @ts-expect-error TS2345 TODO(ts-error): fixme
    queryService.setup({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      sessionStorage: new DataStorage(window.sessionStorage, 'opensearch_dashboards.'),
      defaultSearchInterceptor: mockSearchInterceptor,
      application: setupMock.application,
    });
    // @ts-expect-error TS2345 TODO(ts-error): fixme
    queryServiceStart = queryService.start({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      savedObjectsClient: startMock.savedObjects.client,
      indexPatterns: indexPatternsMock,
      application: startMock.application,
    });
    filterManager = queryServiceStart.filterManager;
    timeFilter = queryServiceStart.timefilter.timefilter;
    indexPatternsMock = ({
      get: jest.fn(),
    } as unknown) as IndexPatternsService;

    globalState = createStateContainer({});
    globalStateChangeTriggered = jest.fn();
    globalStateSub = globalState.state$.subscribe(globalStateChangeTriggered);

    filterManagerChangeTriggered = jest.fn();
    filterManagerChangeSub = filterManager.getUpdates$().subscribe(filterManagerChangeTriggered);

    gF1 = getFilter(FilterStateStore.GLOBAL_STATE, true, true, 'key1', 'value1');
    gF2 = getFilter(FilterStateStore.GLOBAL_STATE, false, false, 'key2', 'value2');
    aF1 = getFilter(FilterStateStore.APP_STATE, true, true, 'key3', 'value3');
    aF2 = getFilter(FilterStateStore.APP_STATE, false, false, 'key4', 'value4');
  });
  afterEach(() => {
    globalStateSub.unsubscribe();
    filterManagerChangeSub.unsubscribe();
  });

  test('state is initialized with state from query service', () => {
    const stop = connectToQueryGlobalState(queryServiceStart, globalState);

    expect(globalState.get()).toEqual({
      filters: filterManager.getGlobalFilters(),
      refreshInterval: timeFilter.getRefreshInterval(),
      time: timeFilter.getTime(),
    });

    stop();
  });

  test('when time range changes, state container contains updated time range', () => {
    const stop = connectToQueryGlobalState(queryServiceStart, globalState);
    timeFilter.setTime({ from: 'now-30m', to: 'now' });
    expect(globalState.get().time).toEqual({
      from: 'now-30m',
      to: 'now',
    });
    stop();
  });

  test('when refresh interval changes, state container contains updated refresh interval', () => {
    const stop = connectToQueryGlobalState(queryServiceStart, globalState);
    timeFilter.setRefreshInterval({ pause: true, value: 100 });
    expect(globalState.get().refreshInterval).toEqual({
      pause: true,
      value: 100,
    });
    stop();
  });

  test('state changes should propagate to services', () => {
    const stop = connectToQueryGlobalState(queryServiceStart, globalState);
    globalStateChangeTriggered.mockClear();
    globalState.set({
      ...globalState.get(),
      filters: [gF1, gF2],
      refreshInterval: { pause: true, value: 100 },
      time: { from: 'now-30m', to: 'now' },
    });

    expect(globalStateChangeTriggered).toBeCalledTimes(1);

    expect(filterManager.getGlobalFilters()).toHaveLength(2);
    expect(timeFilter.getRefreshInterval()).toEqual({ pause: true, value: 100 });
    expect(timeFilter.getTime()).toEqual({ from: 'now-30m', to: 'now' });
    stop();
  });

  describe('sync from filterManager to global state', () => {
    test('should sync global filters to global state when new global filters set to filterManager', () => {
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);

      filterManager.setFilters([gF1, aF1]);

      expect(globalState.get().filters).toHaveLength(1);
      stop();
    });

    test('should not sync app filters to global state ', () => {
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);

      filterManager.setFilters([aF1, aF2]);

      expect(globalState.get().filters).toHaveLength(0);
      stop();
    });

    test("should not trigger changes when global filters didn't change", () => {
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      globalStateChangeTriggered.mockClear();

      filterManager.setFilters([gF1, aF1]);
      filterManager.setFilters([gF1, aF2]);

      expect(globalStateChangeTriggered).toBeCalledTimes(1);
      expect(globalState.get().filters).toHaveLength(1);

      stop();
    });

    test('should trigger changes when global filters change', () => {
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      globalStateChangeTriggered.mockClear();

      filterManager.setFilters([gF1, aF1]);
      filterManager.setFilters([gF2, aF1]);

      expect(globalStateChangeTriggered).toBeCalledTimes(2);
      expect(globalState.get().filters).toHaveLength(1);

      stop();
    });

    test('resetting filters should sync to global state', () => {
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);

      filterManager.setFilters([gF1, aF1]);

      expect(globalState.get().filters).toHaveLength(1);

      filterManager.removeAll();

      expect(globalState.get().filters).toHaveLength(0);

      stop();
    });

    test("shouldn't sync filters when syncing is stopped", () => {
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);

      filterManager.setFilters([gF1, aF1]);

      expect(globalState.get().filters).toHaveLength(1);

      stop();

      filterManager.removeAll();

      expect(globalState.get().filters).toHaveLength(1);
    });

    test('should pick up initial state from filterManager', () => {
      globalState.set({ filters: [gF1] });
      filterManager.setFilters([aF1]);

      globalStateChangeTriggered.mockClear();
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      expect(globalStateChangeTriggered).toBeCalledTimes(1);
      expect(globalState.get().filters).toHaveLength(0);

      stop();
    });
  });
  describe('sync from global state to filterManager', () => {
    test('changes to global state should be synced to global filters', () => {
      filterManager.setFilters([aF1]);
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      globalStateChangeTriggered.mockClear();

      globalState.set({ ...globalState.get(), filters: [gF1] });

      expect(filterManager.getFilters()).toHaveLength(2);
      expect(filterManager.getAppFilters()).toHaveLength(1);
      expect(filterManager.getGlobalFilters()).toHaveLength(1);
      expect(globalStateChangeTriggered).toBeCalledTimes(1);
      stop();
    });

    test('app filters should remain untouched', () => {
      filterManager.setFilters([gF1, gF2, aF1, aF2]);
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      globalStateChangeTriggered.mockClear();

      globalState.set({ ...globalState.get(), filters: [] });

      expect(filterManager.getFilters()).toHaveLength(2);
      expect(filterManager.getAppFilters()).toHaveLength(2);
      expect(filterManager.getGlobalFilters()).toHaveLength(0);
      expect(globalStateChangeTriggered).toBeCalledTimes(1);
      stop();
    });

    test("if filters are not changed, filterManager shouldn't trigger update", () => {
      filterManager.setFilters([gF1, gF2, aF1, aF2]);
      filterManagerChangeTriggered.mockClear();

      globalState.set({ ...globalState.get(), filters: [gF1, gF2] });
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      globalState.set({ ...globalState.get(), filters: [gF1, gF2] });

      expect(filterManagerChangeTriggered).toBeCalledTimes(0);
      stop();
    });

    test('stop() should stop syncing', () => {
      filterManager.setFilters([gF1, gF2, aF1, aF2]);
      const stop = connectToQueryGlobalState(queryServiceStart, globalState);
      globalState.set({ ...globalState.get(), filters: [] });
      expect(filterManager.getFilters()).toHaveLength(2);
      stop();
      globalState.set({ ...globalState.get(), filters: [gF1] });
      expect(filterManager.getFilters()).toHaveLength(2);
    });
  });
});

describe('connect_to_app_state', () => {
  let queryServiceStart: QueryStart;
  let filterManager: FilterManager;
  let appState: BaseStateContainer<QueryState>;
  let appStateSub: Subscription;
  let appStateChangeTriggered = jest.fn();
  let filterManagerChangeSub: Subscription;
  let filterManagerChangeTriggered = jest.fn();
  let indexPatternsMock: IndexPatternsService;
  let mockSearchInterceptor;

  let gF1: Filter;
  let gF2: Filter;
  let aF1: Filter;
  let aF2: Filter;

  beforeEach(() => {
    const queryService = new QueryService();
    mockSearchInterceptor = {} as jest.Mocked<ISearchInterceptor>;
    // @ts-expect-error TS2345 TODO(ts-error): fixme
    queryService.setup({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      sessionStorage: new DataStorage(window.sessionStorage, 'opensearch_dashboards.'),
      defaultSearchInterceptor: mockSearchInterceptor,
      application: setupMock.application,
    });
    // @ts-expect-error TS2345 TODO(ts-error): fixme
    queryServiceStart = queryService.start({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      savedObjectsClient: startMock.savedObjects.client,
      indexPatterns: indexPatternsMock,
      application: startMock.application,
    });
    filterManager = queryServiceStart.filterManager;
    indexPatternsMock = ({
      get: jest.fn(),
    } as unknown) as IndexPatternsService;

    appState = createStateContainer({});
    appStateChangeTriggered = jest.fn();
    appStateSub = appState.state$.subscribe(appStateChangeTriggered);

    filterManagerChangeTriggered = jest.fn();
    filterManagerChangeSub = filterManager.getUpdates$().subscribe(filterManagerChangeTriggered);

    gF1 = getFilter(FilterStateStore.GLOBAL_STATE, true, true, 'key1', 'value1');
    gF2 = getFilter(FilterStateStore.GLOBAL_STATE, false, false, 'key2', 'value2');
    aF1 = getFilter(FilterStateStore.APP_STATE, true, true, 'key3', 'value3');
    aF2 = getFilter(FilterStateStore.APP_STATE, false, false, 'key4', 'value4');
  });
  afterEach(() => {
    appStateSub.unsubscribe();
    filterManagerChangeSub.unsubscribe();
  });

  describe('sync from filterManager to app state', () => {
    test('should sync app filters to app state when new app filters set to filterManager', () => {
      const stop = connectToQueryAppState(queryServiceStart, appState);

      filterManager.setFilters([gF1, aF1]);

      expect(appState.get().filters).toHaveLength(1);
      stop();
    });

    test('should not sync global filters to app state ', () => {
      const stop = connectToQueryAppState(queryServiceStart, appState);

      filterManager.setFilters([gF1, gF2]);

      expect(appState.get().filters).toHaveLength(0);
      stop();
    });

    test("should not trigger changes when app filters didn't change", () => {
      const stop = connectToQueryAppState(queryServiceStart, appState);
      appStateChangeTriggered.mockClear();

      filterManager.setFilters([gF1, aF1]);
      filterManager.setFilters([gF2, aF1]);

      expect(appStateChangeTriggered).toBeCalledTimes(1);
      expect(appState.get().filters).toHaveLength(1);

      stop();
    });

    test('should trigger changes when app filters change', () => {
      const stop = connectToQueryAppState(queryServiceStart, appState);
      appStateChangeTriggered.mockClear();

      filterManager.setFilters([gF1, aF1]);
      filterManager.setFilters([gF1, aF2]);

      expect(appStateChangeTriggered).toBeCalledTimes(2);
      expect(appState.get().filters).toHaveLength(1);

      stop();
    });

    test('resetting filters should sync to app state', () => {
      const stop = connectToQueryAppState(queryServiceStart, appState);

      filterManager.setFilters([gF1, aF1]);

      expect(appState.get().filters).toHaveLength(1);

      filterManager.removeAll();

      expect(appState.get().filters).toHaveLength(0);

      stop();
    });

    test("shouldn't sync filters when syncing is stopped", () => {
      const stop = connectToQueryAppState(queryServiceStart, appState);

      filterManager.setFilters([gF1, aF1]);

      expect(appState.get().filters).toHaveLength(1);

      stop();

      filterManager.removeAll();

      expect(appState.get().filters).toHaveLength(1);
    });

    test('should pick up initial state from filterManager', () => {
      appState.set({ filters: [aF1] });
      filterManager.setFilters([gF1]);

      appStateChangeTriggered.mockClear();
      const stop = connectToQueryAppState(queryServiceStart, appState);
      expect(appStateChangeTriggered).toBeCalledTimes(1);
      expect(appState.get().filters).toHaveLength(0);

      stop();
    });
  });
  describe('sync from app state to filterManager', () => {
    test('changes to app state should be synced to app filters', () => {
      filterManager.setFilters([gF1]);
      const stop = connectToQueryAppState(queryServiceStart, appState);
      appStateChangeTriggered.mockClear();

      appState.set({ filters: [aF1] });

      expect(filterManager.getFilters()).toHaveLength(2);
      expect(filterManager.getAppFilters()).toHaveLength(1);
      expect(filterManager.getGlobalFilters()).toHaveLength(1);
      expect(appStateChangeTriggered).toBeCalledTimes(1);
      stop();
    });

    test('global filters should remain untouched', () => {
      filterManager.setFilters([gF1, gF2, aF1, aF2]);
      const stop = connectToQueryAppState(queryServiceStart, appState);
      appStateChangeTriggered.mockClear();

      appState.set({ filters: [] });

      expect(filterManager.getFilters()).toHaveLength(2);
      expect(filterManager.getGlobalFilters()).toHaveLength(2);
      expect(appStateChangeTriggered).toBeCalledTimes(1);
      stop();
    });

    test("if filters are not changed, filterManager shouldn't trigger update", () => {
      filterManager.setFilters([gF1, gF2, aF1, aF2]);
      filterManagerChangeTriggered.mockClear();

      appState.set({ filters: [aF1, aF2] });
      const stop = connectToQueryAppState(queryServiceStart, appState);
      appState.set({ filters: [aF1, aF2] });

      expect(filterManagerChangeTriggered).toBeCalledTimes(0);
      stop();
    });

    test('stop() should stop syncing', () => {
      filterManager.setFilters([gF1, gF2, aF1, aF2]);
      const stop = connectToQueryAppState(queryServiceStart, appState);
      appState.set({ filters: [] });
      expect(filterManager.getFilters()).toHaveLength(2);
      stop();
      appState.set({ filters: [aF1] });
      expect(filterManager.getFilters()).toHaveLength(2);
    });
  });
});

describe('filters with different state', () => {
  let queryServiceStart: QueryStart;
  let filterManager: FilterManager;
  let state: BaseStateContainer<QueryState>;
  let stateSub: Subscription;
  let stateChangeTriggered = jest.fn();
  let filterManagerChangeSub: Subscription;
  let filterManagerChangeTriggered = jest.fn();
  let indexPatternsMock: IndexPatternsService;
  let mockSearchInterceptor;

  let filter: Filter;

  beforeEach(() => {
    const queryService = new QueryService();
    mockSearchInterceptor = {} as jest.Mocked<ISearchInterceptor>;
    // @ts-expect-error TS2345 TODO(ts-error): fixme
    queryService.setup({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      sessionStorage: new DataStorage(window.sessionStorage, 'opensearch_dashboards.'),
      defaultSearchInterceptor: mockSearchInterceptor,
      application: setupMock.application,
    });
    // @ts-expect-error TS2345 TODO(ts-error): fixme
    queryServiceStart = queryService.start({
      uiSettings: setupMock.uiSettings,
      storage: new DataStorage(window.localStorage, 'opensearch_dashboards.'),
      savedObjectsClient: startMock.savedObjects.client,
      indexPatterns: indexPatternsMock,
      application: startMock.application,
    });
    filterManager = queryServiceStart.filterManager;
    indexPatternsMock = ({
      get: jest.fn(),
    } as unknown) as IndexPatternsService;

    state = createStateContainer({});
    stateChangeTriggered = jest.fn();
    stateSub = state.state$.subscribe(stateChangeTriggered);

    filterManagerChangeTriggered = jest.fn();
    filterManagerChangeSub = filterManager.getUpdates$().subscribe(filterManagerChangeTriggered);

    filter = getFilter(FilterStateStore.GLOBAL_STATE, true, true, 'key1', 'value1');
  });

  // applies filter state changes, changes only internal $state.store value
  function runChanges() {
    filter = { ...filter, $state: { store: FilterStateStore.GLOBAL_STATE } };

    state.set({
      filters: [filter],
    });

    filter = { ...filter, $state: { store: FilterStateStore.APP_STATE } };

    state.set({
      filters: [filter],
    });

    filter = { ...filter };
    delete filter.$state;

    state.set({
      filters: [filter],
    });
  }

  test('when syncing all filters, changes to filter.state$ should be taken into account', () => {
    const stop = connectToQueryState(queryServiceStart, state, {
      filters: true,
    });

    runChanges();

    expect(filterManagerChangeTriggered).toBeCalledTimes(3);

    stop();
  });

  test('when syncing app state filters, changes to filter.state$ should be ignored', () => {
    const stop = connectToQueryState(queryServiceStart, state, {
      filters: FilterStateStore.APP_STATE,
    });

    runChanges();

    expect(filterManagerChangeTriggered).toBeCalledTimes(1);

    stop();
  });

  test('when syncing global state filters, changes to filter.state$ should be ignored', () => {
    const stop = connectToQueryState(queryServiceStart, state, {
      filters: FilterStateStore.GLOBAL_STATE,
    });

    runChanges();

    expect(filterManagerChangeTriggered).toBeCalledTimes(1);

    stop();
  });

  afterEach(() => {
    stateSub.unsubscribe();
    filterManagerChangeSub.unsubscribe();
  });
});
