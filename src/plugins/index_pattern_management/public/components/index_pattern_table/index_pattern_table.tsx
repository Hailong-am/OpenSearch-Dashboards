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

import {
  EuiBadge,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiInMemoryTable,
  EuiSpacer,
  EuiText,
  EuiBadgeGroup,
  EuiPageContent,
  // @ts-expect-error TS6133 TODO(ts-error): fixme
  EuiLink,
} from '@elastic/eui';
import { FormattedMessage } from '@osd/i18n/react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { i18n } from '@osd/i18n';
import { useEffectOnce, useObservable } from 'react-use';
import { of } from 'rxjs';
import {
  reactRouterNavigate,
  useOpenSearchDashboards,
} from '../../../../opensearch_dashboards_react/public';
import { IndexPatternManagmentContext } from '../../types';
import { CreateButton } from '../create_button';
import { IndexPatternTableItem, IndexPatternCreationOption } from '../types';
import { getIndexPatterns } from '../utils';
import { getListBreadcrumbs } from '../breadcrumbs';
import { EmptyState } from './empty_state';
import { MatchedItem, ResolveIndexResponseItemAlias } from '../create_index_pattern_wizard/types';
import { EmptyIndexPatternPrompt } from './empty_index_pattern_prompt';
import { getIndices } from '../create_index_pattern_wizard/lib';

const pagination = {
  initialPageSize: 10,
  pageSizeOptions: [5, 10, 25, 50],
};

const sorting = {
  sort: {
    field: 'title',
    direction: 'asc' as const,
  },
};

const search = {
  box: {
    incremental: true,
    schema: {
      fields: { title: { type: 'string' } },
    },
  },
};

const ariaRegion = i18n.translate('indexPatternManagement.editIndexPatternLiveRegionAriaLabel', {
  defaultMessage: 'Index patterns',
});

const title = i18n.translate('indexPatternManagement.indexPatternTable.title', {
  defaultMessage: 'Index patterns',
});

interface Props extends RouteComponentProps {
  canSave: boolean;
}

export const IndexPatternTable = ({ canSave, history }: Props) => {
  const {
    setBreadcrumbs,
    savedObjects,
    uiSettings,
    indexPatternManagementStart,
    chrome,
    navigationUI: { HeaderControl },
    docLinks,
    application,
    http,
    getMlCardState,
    data,
    dataSourceEnabled,
    workspaces,
  } = useOpenSearchDashboards<IndexPatternManagmentContext>().services;

  const [indexPatterns, setIndexPatterns] = useState<IndexPatternTableItem[]>([]);
  const [creationOptions, setCreationOptions] = useState<IndexPatternCreationOption[]>([]);
  const [sources, setSources] = useState<MatchedItem[]>([]);
  const [remoteClustersExist, setRemoteClustersExist] = useState<boolean>(false);
  const [isLoadingSources, setIsLoadingSources] = useState<boolean>(!dataSourceEnabled);
  const [isLoadingIndexPatterns, setIsLoadingIndexPatterns] = useState<boolean>(true);
  // @ts-expect-error TS6133 TODO(ts-error): fixme
  const [isColumnDataLoaded, setIsColumnDataLoaded] = useState(false);

  const currentWorkspace = useObservable(workspaces ? workspaces.currentWorkspace$ : of(null));
  const { columns: columnRegistry } = indexPatternManagementStart;

  const useUpdatedUX = uiSettings.get('home:useNewHomePage');
  useEffect(() => {
    setBreadcrumbs(getListBreadcrumbs(useUpdatedUX ? currentWorkspace?.name : undefined));
  }, [chrome, currentWorkspace, setBreadcrumbs, useUpdatedUX]);

  useEffect(() => {
    (async function () {
      const options = await indexPatternManagementStart.creation.getIndexPatternCreationOptions(
        history.push
      );
      const gettedIndexPatterns: IndexPatternTableItem[] = await getIndexPatterns(
        savedObjects.client,
        uiSettings.get('defaultIndex'),
        indexPatternManagementStart
      );
      setIsLoadingIndexPatterns(false);
      setCreationOptions(options);
      setIndexPatterns(gettedIndexPatterns);
    })();
  }, [
    history.push,
    indexPatterns.length,
    indexPatternManagementStart,
    uiSettings,
    savedObjects.client,
  ]);

  const removeAliases = (item: MatchedItem) =>
    !((item as unknown) as ResolveIndexResponseItemAlias).indices;

  const searchClient = data.search.search;

  const loadSources = () => {
    getIndices({ http, pattern: '*', searchClient }).then((dataSources) =>
      setSources(dataSources.filter(removeAliases))
    );
    getIndices({ http, pattern: '*:*', searchClient }).then((dataSources) =>
      setRemoteClustersExist(!!dataSources.filter(removeAliases).length)
    );
  };

  const loadColumnData = async () => {
    await Promise.all(columnRegistry.getAll().map((column) => column.loadData()));
    setIsColumnDataLoaded(true);
  };

  useEffect(() => {
    if (!dataSourceEnabled) {
      getIndices({ http, pattern: '*', searchClient }).then((dataSources) => {
        setSources(dataSources.filter(removeAliases));
        setIsLoadingSources(false);
      });
      getIndices({ http, pattern: '*:*', searchClient }).then((dataSources) =>
        setRemoteClustersExist(!!dataSources.filter(removeAliases).length)
      );
    }
  }, [http, creationOptions, searchClient, dataSourceEnabled]);

  useEffectOnce(() => {
    loadColumnData();
  });

  chrome.docTitle.change(title);

  const columns = [
    {
      field: 'title',
      name: 'Pattern',
      render: (
        name: string,
        index: {
          id: string;
          tags?: Array<{
            key: string;
            name: string;
          }>;
        }
      ) => (
        <>
          <EuiButtonEmpty
            size="xs"
            {...reactRouterNavigate(history, `patterns/${index.id}`)}
            {...(useUpdatedUX ? { textProps: { style: { fontWeight: 600 } } } : {})}
          >
            {name}
          </EuiButtonEmpty>
          &emsp;
          <EuiBadgeGroup gutterSize="s">
            {index.tags &&
              index.tags.map(({ key: tagKey, name: tagName }) => (
                <EuiBadge key={tagKey}>{tagName}</EuiBadge>
              ))}
          </EuiBadgeGroup>
        </>
      ),
      dataType: 'string' as const,
      sortable: ({ sort }: { sort: string }) => sort,
    },
    ...columnRegistry.getAll().map((column) => {
      return {
        ...column.euiColumn,
        sortable: false,
        'data-test-subj': `indexPatternTableColumn-${column.id}`,
      };
    }),
  ];

  const createButton = (() => {
    if (!canSave) return null;

    const button = (
      <CreateButton options={creationOptions}>
        <FormattedMessage
          id="indexPatternManagement.indexPatternTable.createBtn"
          defaultMessage="Create index pattern"
        />
      </CreateButton>
    );

    return useUpdatedUX ? (
      <HeaderControl
        controls={[{ renderComponent: button }]}
        setMountPoint={application.setAppRightControls}
      />
    ) : (
      <EuiFlexItem grow={false}>{button}</EuiFlexItem>
    );
  })();

  const description = currentWorkspace
    ? i18n.translate(
        'indexPatternManagement.indexPatternTable.indexPatternExplanationWithWorkspace',
        {
          defaultMessage:
            'Create and manage the index patterns that help you retrieve your data from OpenSearch for {name} workspace.',
          values: {
            name: currentWorkspace.name,
          },
        }
      )
    : i18n.translate('indexPatternManagement.indexPatternTable.indexPatternExplanation', {
        defaultMessage:
          'Create and manage the index patterns that help you retrieve your data from OpenSearch.',
      });
  const pageTitleAndDescription = useUpdatedUX ? (
    <HeaderControl
      controls={[{ description }]}
      setMountPoint={application.setAppDescriptionControls}
    />
  ) : (
    <EuiFlexItem grow={false}>
      <EuiText size="s">
        <h1>{title}</h1>
      </EuiText>
      <EuiSpacer size="s" />
      <EuiText size="s">
        <p>{description}</p>
      </EuiText>
    </EuiFlexItem>
  );

  if (isLoadingSources || isLoadingIndexPatterns) {
    return <></>;
  }

  const hasDataIndices = sources.some(({ name }: MatchedItem) => !name.startsWith('.'));

  if (!indexPatterns.length) {
    if (!dataSourceEnabled) {
      if (!hasDataIndices && !remoteClustersExist) {
        return (
          <EmptyState
            onRefresh={loadSources}
            docLinks={docLinks}
            navigateToApp={application.navigateToApp}
            getMlCardState={getMlCardState}
            canSave={canSave}
          />
        );
      }
    } else {
      return (
        <EmptyIndexPatternPrompt
          canSave={canSave}
          creationOptions={creationOptions}
          docLinksIndexPatternIntro={docLinks.links.noDocumentation.indexPatterns.introduction}
        />
      );
    }
  }

  return (
    <>
      <EuiPageContent
        data-test-subj="indexPatternTable"
        role="region"
        aria-label={ariaRegion}
        {...(useUpdatedUX ? { paddingSize: 'm' } : {})}
      >
        <EuiFlexGroup justifyContent="spaceBetween">
          {pageTitleAndDescription}
          {createButton}
        </EuiFlexGroup>
        <EuiSpacer />
        <EuiInMemoryTable
          allowNeutralSort={false}
          itemId="id"
          isSelectable={false}
          items={indexPatterns}
          // @ts-expect-error TS2322 TODO(ts-error): fixme
          columns={columns}
          pagination={pagination}
          sorting={sorting}
          search={search}
        />
      </EuiPageContent>
    </>
  );
};

export const IndexPatternTableWithRouter = withRouter(IndexPatternTable);
