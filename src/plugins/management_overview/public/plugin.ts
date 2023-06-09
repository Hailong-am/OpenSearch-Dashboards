/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { i18n } from '@osd/i18n';
import {
  AppMountParameters,
  CoreSetup,
  Plugin,
  DEFAULT_APP_CATEGORIES,
  CoreStart,
} from '../../../core/public';
import { FeatureCatalogueCategory, HomePublicPluginSetup } from '../../home/public';
import { MANAGEMENT_LANDING_PLUGIN_ID } from '../common/constants';

interface ManagementOverviewSetupDependencies {
  home?: HomePublicPluginSetup;
}

/** @public */
export class ManagementOverViewPlugin implements Plugin<{}, {}> {
  public setup(coreSetup: CoreSetup, { home }: ManagementOverviewSetupDependencies): {} {
    const { application, getStartServices } = coreSetup;

    if (home) {
      home.featureCatalogue.register({
        id: MANAGEMENT_LANDING_PLUGIN_ID,
        title: i18n.translate('management.stackManagement.managementLabel', {
          defaultMessage: 'Management',
        }),
        description: i18n.translate('management.stackManagement.managementDescription', {
          defaultMessage: 'Your center console for managing the OpenSearch Stack.',
        }),
        icon: 'managementApp',
        path: `/app/${MANAGEMENT_LANDING_PLUGIN_ID}`,
        showOnHomePage: false,
        category: FeatureCatalogueCategory.ADMIN,
      });
    }

    application.register({
      id: MANAGEMENT_LANDING_PLUGIN_ID,
      title: i18n.translate('management.overviewTitle', {
        defaultMessage: 'Overview',
      }),
      icon: '/plugins/home/public/assets/logos/opensearch_mark_default.svg',
      order: 9000,
      category: DEFAULT_APP_CATEGORIES.management,
      mount: async (params: AppMountParameters) => {
        const { element } = params;
        const [core] = await getStartServices();

        const { renderApp } = await import('./application');
        return renderApp(core, element);
      },
    });

    return {};
  }

  public start(core: CoreStart): {} {
    return {};
  }
}
