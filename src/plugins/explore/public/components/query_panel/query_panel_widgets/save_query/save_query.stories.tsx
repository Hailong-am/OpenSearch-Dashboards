/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SaveQueryButton } from './save_query';
import { StorybookProviders } from '../../mock_provider.mocks';
import { EditorMode } from '../../../../application/utils/state_management/types';

const meta: Meta<typeof SaveQueryButton> = {
  title: 'src/plugins/explore/public/components/query_panel/query_panel_widgets/save_query',
  component: SaveQueryButton,
  decorators: [
    (Story) => (
      <StorybookProviders>
        <div style={{ padding: '20px' }}>
          <Story />
        </div>
      </StorybookProviders>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SaveQueryButton>;

export const Default: Story = {
  render: () => <SaveQueryButton />,
};

export const PromptMode: Story = {
  render: () => (
    <StorybookProviders editorMode={EditorMode.Prompt}>
      <SaveQueryButton />
    </StorybookProviders>
  ),
};
