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

import React, { useEffect } from 'react';
import { get } from 'lodash';
import { i18n } from '@osd/i18n';
import { CoreStart, ChromeBreadcrumb } from 'src/core/public';
import { DataSourceManagementPluginSetup } from 'src/plugins/data_source_management/public';
import { useObservable } from 'react-use';
import { DataPublicPluginStart } from '../../../data/public';
import {
  ISavedObjectsManagementServiceRegistry,
  SavedObjectsManagementActionServiceStart,
  SavedObjectsManagementColumnServiceStart,
  SavedObjectsManagementNamespaceServiceStart,
} from '../services';
import { SavedObjectsTable } from './objects_table';
import { NavigationPublicPluginStart } from '../../../navigation/public';
import { formatInspectUrl } from '../utils';

const SavedObjectsTablePage = ({
  coreStart,
  dataStart,
  allowedTypes,
  serviceRegistry,
  actionRegistry,
  columnRegistry,
  namespaceRegistry,
  setBreadcrumbs,
  dataSourceEnabled,
  dataSourceManagement,
  navigation,
  useUpdatedUX,
}: {
  coreStart: CoreStart;
  dataStart: DataPublicPluginStart;
  allowedTypes: string[];
  serviceRegistry: ISavedObjectsManagementServiceRegistry;
  actionRegistry: SavedObjectsManagementActionServiceStart;
  columnRegistry: SavedObjectsManagementColumnServiceStart;
  namespaceRegistry: SavedObjectsManagementNamespaceServiceStart;
  setBreadcrumbs: (crumbs: ChromeBreadcrumb[]) => void;
  dataSourceEnabled: boolean;
  dataSourceManagement?: DataSourceManagementPluginSetup;
  navigation: NavigationPublicPluginStart;
  useUpdatedUX: boolean;
}) => {
  const capabilities = coreStart.application.capabilities;
  const itemsPerPage = coreStart.uiSettings.get<number>('savedObjects:perPage', 50);
  const dateFormat = coreStart.uiSettings.get<string>('dateFormat');
  const currentWorkspace = useObservable(coreStart.workspaces.currentWorkspace$);

  useEffect(() => {
    setBreadcrumbs([
      useUpdatedUX
        ? currentWorkspace
          ? {
              text: i18n.translate('savedObjectsManagement.updatedUX.workspace.title', {
                defaultMessage: 'Workspace assets',
              }),
            }
          : {
              text: i18n.translate('savedObjectsManagement.updatedUX.title', {
                defaultMessage: 'Assets',
              }),
            }
        : {
            text: i18n.translate('savedObjectsManagement.breadcrumb.index', {
              defaultMessage: 'Saved objects',
            }),
            href: '/',
          },
    ]);
  }, [setBreadcrumbs, useUpdatedUX, currentWorkspace]);

  return (
    <SavedObjectsTable
      allowedTypes={allowedTypes}
      serviceRegistry={serviceRegistry}
      actionRegistry={actionRegistry}
      columnRegistry={columnRegistry}
      namespaceRegistry={namespaceRegistry}
      savedObjectsClient={coreStart.savedObjects.client}
      indexPatterns={dataStart.indexPatterns}
      search={dataStart.search}
      http={coreStart.http}
      overlays={coreStart.overlays}
      notifications={coreStart.notifications}
      applications={coreStart.application}
      workspaces={coreStart.workspaces}
      perPageConfig={itemsPerPage}
      goInspectObject={(savedObject) => {
        const inAppUrl = formatInspectUrl(savedObject, coreStart);
        if (inAppUrl) {
          return coreStart.application.navigateToUrl(inAppUrl);
        }
      }}
      dateFormat={dateFormat}
      canGoInApp={(savedObject) => {
        const { inAppUrl } = savedObject.meta;
        return inAppUrl ? Boolean(get(capabilities, inAppUrl.uiCapabilitiesPath)) : false;
      }}
      dataSourceEnabled={dataSourceEnabled}
      dataSourceManagement={dataSourceManagement}
      navigationUI={navigation.ui}
      useUpdatedUX={useUpdatedUX}
    />
  );
};
// eslint-disable-next-line import/no-default-export
export { SavedObjectsTablePage as default };
