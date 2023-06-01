/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { i18n } from '@osd/i18n';
import {
  AppMountParameters,
  CoreSetup,
  Plugin,
  DEFAULT_APP_CATEGORIES, CoreStart,
} from '../../../core/public';

/** @public */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagementOverViewPluginSetup {}

/** @public */
export type ManagementOverViewPluginStart = ManagementOverViewPluginSetup;

/** @public */
export class ManagementOverViewPlugin
  implements Plugin<ManagementOverViewPluginSetup, ManagementOverViewPluginStart> {
  public setup(coreSetup: CoreSetup): ManagementOverViewPluginSetup {
    const { application, getStartServices } = coreSetup;

    application.register({
      id: 'management_overview',
      title: i18n.translate('management.overviewTitle', {
        defaultMessage: 'Overview',
      }),
      icon: '/plugins/home/public/assets/logos/opensearch_mark_default.svg',
      order: 9000,
      category: DEFAULT_APP_CATEGORIES.management,
      mount: async (params: AppMountParameters) => {
        const { element, history } = params;
        const [core] = await getStartServices();

        const { renderApp } = await import('./application');
        return renderApp(core, element, history);
      },
    });

    return {};
  }

  public start(core: CoreStart): ManagementOverViewPluginStart {
    return {};
  }
}
