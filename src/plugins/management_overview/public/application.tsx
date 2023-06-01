/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreStart, ScopedHistory } from 'opensearch-dashboards/public';
import ReactDOM from 'react-dom';
import { I18nProvider } from '@osd/i18n/react';
import React from 'react';
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

export interface ControlCenterOverviewProps {
  features?: [];
}

export interface OverviewCardProps {
  title: string;
  features?: string[];
}

function OverviewCard(props: OverviewCardProps) {
  const { title, features } = props;
  return (
    <EuiPanel>
      <EuiTitle size="s">
        <h5>{title}</h5>
      </EuiTitle>
      <EuiHorizontalRule />
      <EuiListGroup>
        {features?.map((feature) => (
          <EuiListGroupItem onClick={() => {}} label={feature} color="primary" size="m" />
        ))}
      </EuiListGroup>
    </EuiPanel>
  );
}

function ControlCenterOverviewWrapper(props: ControlCenterOverviewProps) {
  return (
    <EuiPanel>
      <EuiTitle size="l">
        <h1>Control Center</h1>
      </EuiTitle>
      <EuiSpacer />
      <EuiFlexGrid columns={2}>
        <EuiFlexItem>
          <OverviewCard title="Index Management" features={['Indexes']} />
        </EuiFlexItem>
        <EuiFlexItem>
          <OverviewCard title="Snapshot Management" features={['Polices']} />
        </EuiFlexItem>
        <EuiFlexItem>
          <OverviewCard title="Dashboard Management" />
        </EuiFlexItem>
        <EuiFlexItem>
          <OverviewCard title="Security" />
        </EuiFlexItem>
        <EuiFlexItem>
          <OverviewCard title="Notifications" />
        </EuiFlexItem>
        <EuiFlexItem>
          <OverviewCard title="Dev tools" />
        </EuiFlexItem>
      </EuiFlexGrid>
    </EuiPanel>
  );
}

export function renderApp(
  { application, chrome, savedObjects, notifications }: CoreStart,
  element: HTMLElement,
  history: ScopedHistory
) {
  ReactDOM.render(
    <I18nProvider>
      <ControlCenterOverviewWrapper />
    </I18nProvider>,
    element
  );

  // dispatch synthetic hash change event to update hash history objects
  // this is necessary because hash updates triggered by using popState won't trigger this event naturally.
  const unlisten = history.listen(() => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  return () => {
    chrome.docTitle.reset();
    ReactDOM.unmountComponentAtNode(element);
    unlisten();
  };
}
