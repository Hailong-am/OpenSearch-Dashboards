/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema, TypeOf } from '@osd/config-schema';

export const configSchema = schema.object({
  enabled: schema.boolean({ defaultValue: false }),
  maximum_workspaces: schema.maybe(schema.number()),
  /**
   * only support single default workspace
   */
  single_default_workspace: schema.boolean({ defaultValue: false }),
});

export type ConfigSchema = TypeOf<typeof configSchema>;
