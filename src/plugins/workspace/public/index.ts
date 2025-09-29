/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { PluginInitializerContext } from '../../../core/public';
import { WorkspacePlugin } from './plugin';
import { ConfigSchema } from '../config';

export function plugin(initializerContext: PluginInitializerContext<ConfigSchema>) {
  return new WorkspacePlugin(initializerContext);
}

export { WorkspacePluginSetup, WorkspaceCollaborator } from './types';
export { WorkspaceCollaboratorType } from './services';
