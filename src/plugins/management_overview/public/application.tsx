/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import ReactDOM from 'react-dom';
import { I18nProvider } from '@osd/i18n/react';
import React, { useMemo } from 'react';
import {
  EuiFlexGrid,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiListGroup,
  EuiListGroupItem,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';
import { useObservable } from 'react-use';
import { i18n } from '@osd/i18n';
import { App, ApplicationStart, AppStatus, CoreStart } from '../../../core/public';
import { PluginPages } from '../../../core/types';

type OverviewCardApp = Pick<App, 'title' | 'pages' | 'order' | 'id'>;

export interface ManagementOverviewProps {
  application: ApplicationStart;
}

export interface OverviewCardProps {
  title: string;
  pages: PluginPages[];
  onClick: (url: string) => void;
}

function OverviewCard(props: OverviewCardProps) {
  const { title, pages, onClick } = props;

  return (
    <EuiPanel>
      <EuiTitle size="s">
        <h5>{title}</h5>
      </EuiTitle>
      <EuiHorizontalRule margin="s" />
      <EuiListGroup gutterSize="none" size="s">
        {pages.map((page) => (
          <EuiListGroupItem
            key={page.title}
            onClick={() => onClick(page.url)}
            label={page.title}
            color="primary"
            size="s"
          />
        ))}
      </EuiListGroup>
    </EuiPanel>
  );
}

function ManagementOverviewWrapper(props: ManagementOverviewProps) {
  const { application } = props;

  const applications = useObservable(application.applications$);
  const overviewApp = useMemo(() => {
    if (applications) {
      const apps = [] as OverviewCardApp[];
      applications.forEach((app) => {
        if (app.pages && app.pages.length > 0 && app.status === AppStatus.accessible) {
          apps.push({
            title: app.title,
            order: app.order,
            id: app.id,
            pages: app.pages,
          });
        }
      });

      apps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return apps;
    }
  }, [applications]);

  const onClick = (appId: string) => {
    return (url: string) => {
      const pageUrl = application.getUrlForApp(appId, { path: url });
      application.navigateToUrl(pageUrl);
    };
  };

  const title = i18n.translate('core.ui.managementNavList.label', {
    defaultMessage: 'Management',
  });

  return (
    <EuiPanel style={{ padding: '20px' }}>
      <EuiTitle size="l">
        <h1>{title}</h1>
      </EuiTitle>
      <EuiSpacer />
      <EuiFlexGrid columns={3}>
        {overviewApp?.map((app) => (
          <EuiFlexItem key={app.title}>
            <OverviewCard title={app.title} pages={app.pages || []} onClick={onClick(app.id)} />
          </EuiFlexItem>
        ))}
      </EuiFlexGrid>
    </EuiPanel>
  );
}

export function renderApp({ application, chrome }: CoreStart, element: HTMLElement) {
  ReactDOM.render(
    <I18nProvider>
      <ManagementOverviewWrapper application={application} />
    </I18nProvider>,
    element
  );

  return () => {
    chrome.docTitle.reset();
    ReactDOM.unmountComponentAtNode(element);
  };
}
