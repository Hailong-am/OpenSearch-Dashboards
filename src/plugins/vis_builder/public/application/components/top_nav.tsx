/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { isEqual } from 'lodash';
import { useParams } from 'react-router-dom';
import { useUnmount } from 'react-use';
import { i18n } from '@osd/i18n';
import {
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiInputPopover,
  EuiListGroup,
  EuiListGroupItem,
  EuiSmallButton,
} from '@elastic/eui';
import { useOpenSearchDashboards } from '../../../../opensearch_dashboards_react/public';
import { getLegacyTopNavConfig, getNavActions, getTopNavConfig } from '../utils/get_top_nav_config';
import { VisBuilderServices } from '../../types';

import './top_nav.scss';
import AIIcon from '../../sparkle_mark.svg';
import { useIndexPatterns, useSavedVisBuilderVis } from '../utils/use';
import {
  useTypedSelector,
  useTypedDispatch,
  setActiveVisualization,
} from '../utils/state_management';
import {
  editDraftAgg,
  saveDraftAgg,
  setSavedQuery,
} from '../utils/state_management/visualization_slice';
import { MetadataState, setEditorState, setState } from '../utils/state_management/metadata_slice';
import { useCanSave } from '../utils/use/use_can_save';
import { saveStateToSavedObject } from '../../saved_visualizations/transforms';
import { TopNavMenuData, TopNavMenuItemRenderType } from '../../../../navigation/public';
import { opensearchFilters, connectStorageToQueryState } from '../../../../data/public';
import { RootState } from '../../../../data_explorer/public';
import { getAssistantDashboards } from '../../plugin_services';
import { getPersistedAggParams } from '../utils/get_persisted_agg_params';
import { CreateAggConfigParams } from '../../../../data/common';

function useDeepEffect(callback, dependencies) {
  const currentDepsRef = useRef(dependencies);

  if (!isEqual(currentDepsRef.current, dependencies)) {
    callback();
    currentDepsRef.current = dependencies;
  }
}

export const TopNav = () => {
  // id will only be set for the edit route
  const { id: visualizationIdFromUrl } = useParams<{ id: string }>();
  const { services } = useOpenSearchDashboards<VisBuilderServices>();
  const {
    data,
    setHeaderActionMenu,
    navigation: {
      ui: { TopNavMenu },
    },
    uiSettings,
    appName,
    capabilities,
    types,
    notifications,
  } = services;

  const rootState = useTypedSelector((state: RootState) => state);
  const dispatch = useTypedDispatch();
  const showActionsInGroup = uiSettings.get('home:useNewHomePage');

  useDeepEffect(() => {
    dispatch(setEditorState({ state: 'dirty' }));
  }, [data.query.queryString.getQuery(), data.query.filterManager.getFilters()]);

  const saveDisabledReason = useCanSave();
  const savedVisBuilderVis = useSavedVisBuilderVis(visualizationIdFromUrl);
  connectStorageToQueryState(services.data.query, services.osdUrlStateStorage, {
    filters: opensearchFilters.FilterStateStore.APP_STATE,
    query: true,
  });
  const { selected: indexPattern } = useIndexPatterns();
  const [config, setConfig] = useState<TopNavMenuData[] | undefined>();
  const originatingApp = useTypedSelector((state) => {
    return state.metadata.originatingApp;
  });

  useEffect(() => {
    const getConfig = () => {
      if (!savedVisBuilderVis || !indexPattern) return;

      const navActions = getNavActions(
        {
          visualizationIdFromUrl,
          savedVisBuilderVis: saveStateToSavedObject(savedVisBuilderVis, rootState, indexPattern),
          saveDisabledReason,
          dispatch,
          originatingApp,
        },
        services
      );

      return showActionsInGroup
        ? getTopNavConfig(
            {
              visualizationIdFromUrl,
              savedVisBuilderVis: saveStateToSavedObject(
                savedVisBuilderVis,
                rootState,
                indexPattern
              ),
              saveDisabledReason,
              dispatch,
              originatingApp,
            },
            services,
            navActions
          )
        : getLegacyTopNavConfig(
            {
              visualizationIdFromUrl,
              savedVisBuilderVis: saveStateToSavedObject(
                savedVisBuilderVis,
                rootState,
                indexPattern
              ),
              saveDisabledReason,
              dispatch,
              originatingApp,
            },
            services,
            navActions
          );
    };

    setConfig(getConfig());
  }, [
    rootState,
    savedVisBuilderVis,
    services,
    visualizationIdFromUrl,
    saveDisabledReason,
    dispatch,
    indexPattern,
    originatingApp,
    showActionsInGroup,
  ]);

  // reset validity before component destroyed
  useUnmount(() => {
    dispatch(setEditorState({ state: 'loading' }));
  });

  const updateSavedQueryId = (newSavedQueryId: string | undefined) => {
    dispatch(setSavedQuery(newSavedQueryId));
  };
  const showSaveQuery = !!capabilities['visualization-visbuilder']?.saveQuery;

  const preDefinedQuestions = {
    opensearch_dashboards_sample_data_logs: [
      'I want to know the log number different between each month',
      'I want to know the max of monthly count for each year.',
      'Count visit number by ip only for success response in past week',
    ],
    log_index: [
      'I want to know the log number different between each month',
      'I want to know the max of monthly count for each year',
      'Count visit number by ip only for success response in past week',
    ],
    opensearch_dashboards_sample_data_ecommerce: [
      'I want to know order numbers by customer location',
      'Which are the top 5 countries and cities where the orders are placed, based on the number of orders',
    ],
  };

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const assistant = getAssistantDashboards();
  // const agentId = 'fB9Xi5MBoE1KrU6uQY14';
  const agentId = 'ylVIlZMBRt9ZXgWu-JmL';
  const callAgent = async () => {
    setIsLoading(true);
    try {
      const indexName = indexPattern?.getIndex();
      if (!input || !indexName) {
        notifications.toasts.addWarning(
          'please select index pattern and type your instruction first'
        );
        return;
      }

      const parameters = {
        question: input,
        index: indexName,
      };
      const agentResponse = await assistant.assistantClient.executeAgent(agentId, parameters, {
        dataSourceId: indexPattern?.dataSourceRef?.id,
      });

      const result = agentResponse.body.inference_results[0].output[0].result;

      // eslint-disable-next-line no-console
      console.log('agent result' + JSON.stringify(result));
      let resultJson: any;
      try {
        resultJson = JSON.parse(result);
      } catch {
        notifications.toasts.addWarning('Agent response with invalid json format');
        return;
      }

      const type = resultJson.type;
      // try to match with title and name
      const visualizationType = types
        .all()
        .find(
          (visType) => visType.title.toLowerCase() === type || visType.name.toLowerCase() === type
        );

      if (!visualizationType) {
        notifications.toasts.addWarning('Unsupported visualization type: ' + type);
        return;
      }

      const currentVisSchemas = [];
      const newVisSchemas = visualizationType.ui.containerConfig.data.schemas.all ?? [];
      const persistedAggParams = getPersistedAggParams([], currentVisSchemas, newVisSchemas);

      const newVis = {
        name: visualizationType.name,
        aggConfigParams: persistedAggParams,
        style: visualizationType.ui.containerConfig.style.defaults,
      };

      dispatch(setActiveVisualization(newVis));

      const configs = resultJson.config as CreateAggConfigParams[];
      configs.forEach((aggConfig) => {
        if (aggConfig.type === 'derivative' && aggConfig.params) {
          aggConfig.params.metricAgg = 'custom';
        }
        if (
          aggConfig.type === 'terms' &&
          aggConfig.schema === 'segment' &&
          aggConfig.params.orderBy === '_key'
        ) {
          aggConfig.params.orderBy = 'custom';
        }
        dispatch(editDraftAgg(aggConfig));
        dispatch(saveDraftAgg());
      });

      data.query.timefilter.timefilter.setTime({
        from: 'Jan 1, 2021',
        to: 'Dec 31, 2024',
      });

      // filters
      const filters = resultJson.filter;
      if (indexPattern && filters) {
        data.query.filterManager.setFilters(filters);

        if (indexPattern.isTimeBased()) {
          const timeFieldName = indexPattern.getTimeField()!.name;
          const filterState = filters.find(
            (filter) => filter.range && filter.meta.key === timeFieldName
          );
          if (filterState) {
            data.query.timefilter.timefilter.setTime({
              from: filterState.meta.params.gte || 'now-3y',
              to: filterState.meta.params.lte || 'now',
            });
          }
        }
      }

      const editorState: MetadataState = {
        editor: {
          state: 'clean',
          errors: {
            SECONDARY_PANEL: false,
          },
        },
      };
      dispatch(setState(editorState));
      // back to normal state to enable save button
      dispatch(editDraftAgg());
      notifications.toasts.addSuccess(
        'Visualization generated, you can make adjustment and save it.',
        {
          toastLifeTimeMs: 1000 * 30,
        }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      notifications.toasts.addError(error as Error, {
        title: 'generate visualization has error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (input) {
      setIsPopoverOpen(false);
    }
  }, [input]);

  return (
    <div className="vbTopNav">
      <>
        <TopNavMenu
          appName={appName}
          config={config}
          setMenuMountPoint={setHeaderActionMenu}
          indexPatterns={indexPattern ? [indexPattern] : []}
          showDatePicker={!!indexPattern?.timeFieldName ?? true}
          showSearchBar={TopNavMenuItemRenderType.IN_PORTAL}
          showSaveQuery={showSaveQuery}
          useDefaultBehaviors
          savedQueryId={rootState.visualization.savedQuery}
          onSavedQueryIdChange={updateSavedQueryId}
          groupActions={showActionsInGroup}
          screenTitle={
            savedVisBuilderVis?.title ||
            i18n.translate('visBuilder.savedSearch.newTitle', {
              defaultMessage: 'New visualization',
            })
          }
        />
        <EuiFlexGroup gutterSize="xs" style={{ margin: '4px' }}>
          <EuiFlexItem>
            <EuiInputPopover
              fullWidth
              input={
                <EuiFlexGroup gutterSize="none" alignItems="center">
                  <EuiFlexItem grow={false}>
                    <EuiIcon type={AIIcon} size="l" />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiFieldText
                      fullWidth
                      compressed
                      placeholder="Using nature language to accelerate your visualization creation"
                      value={input}
                      disabled={isLoading}
                      onFocus={() => {
                        if (!input) {
                          setIsPopoverOpen(true);
                        }
                      }}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </EuiFlexItem>
                </EuiFlexGroup>
              }
              isOpen={isPopoverOpen}
              closePopover={() => {
                setIsPopoverOpen(false);
              }}
            >
              <EuiListGroup flush={true} maxWidth={false}>
                {preDefinedQuestions[indexPattern?.getIndex() || '']?.map((str, index) => (
                  <EuiListGroupItem
                    key={index}
                    onClick={() => {
                      setInput(str);
                      setIsPopoverOpen(false);
                    }}
                    label={str}
                  />
                ))}
              </EuiListGroup>
            </EuiInputPopover>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiSmallButton isLoading={isLoading} onClick={callAgent}>
              Go!!
            </EuiSmallButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </>
    </div>
  );
};
