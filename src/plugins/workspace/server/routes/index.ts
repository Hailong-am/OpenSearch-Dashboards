/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema } from '@osd/config-schema';
import {
  IRouter,
  Logger,
  PrincipalType,
  ACL,
  DEFAULT_NAV_GROUPS,
  WorkspacePermissionMode,
  DEFAULT_WORKSPACE_ID,
} from '../../../../core/server';
import {
  MAX_WORKSPACE_NAME_LENGTH,
  MAX_WORKSPACE_DESCRIPTION_LENGTH,
} from '../../common/constants';
import { IWorkspaceClientImpl, WorkspaceAttributeWithPermission } from '../types';
import { SavedObjectsPermissionControlContract } from '../permission_control/client';
import { registerDuplicateRoute } from './duplicate';
import { transferCurrentUserInPermissions, translatePermissionsToRole } from '../utils';
import { validateWorkspaceColor } from '../../common/utils';
import { getUseCaseFeatureConfig } from '../../../../core/server';
import { ConfigSchema } from '../../config';

export const WORKSPACES_API_BASE_URL = '/api/workspaces';

const workspacePermissionMode = schema.oneOf([
  schema.literal(WorkspacePermissionMode.Read),
  schema.literal(WorkspacePermissionMode.Write),
  schema.literal(WorkspacePermissionMode.LibraryRead),
  schema.literal(WorkspacePermissionMode.LibraryWrite),
]);

const principalType = schema.oneOf([
  schema.literal(PrincipalType.Users),
  schema.literal(PrincipalType.Groups),
]);

const workspacePermissions = schema.recordOf(
  workspacePermissionMode,
  schema.recordOf(principalType, schema.arrayOf(schema.string()), {})
);

const dataSourceIds = schema.arrayOf(schema.string());
const dataConnectionIds = schema.arrayOf(schema.string());

const settingsSchema = schema.object({
  permissions: schema.maybe(workspacePermissions),
  dataSources: schema.maybe(dataSourceIds),
  dataConnections: schema.maybe(dataConnectionIds),
});

const featuresSchema = schema.arrayOf(schema.string(), {
  minSize: 1,
  validate: (featureConfigs) => {
    const validateUseCaseConfigs = [
      DEFAULT_NAV_GROUPS.all,
      DEFAULT_NAV_GROUPS.observability,
      DEFAULT_NAV_GROUPS['security-analytics'],
      DEFAULT_NAV_GROUPS.essentials,
      DEFAULT_NAV_GROUPS.search,
    ].map(({ id }) => getUseCaseFeatureConfig(id));

    const useCaseConfigCount = featureConfigs.filter((config) =>
      validateUseCaseConfigs.includes(config)
    ).length;

    if (useCaseConfigCount === 0) {
      return `At least one use case is required. Valid options: ${validateUseCaseConfigs.join(
        ', '
      )}`;
    } else if (useCaseConfigCount > 1) {
      return 'Only one use case is allowed per workspace.';
    }
  },
});

const workspaceOptionalAttributesSchema = {
  description: schema.maybe(schema.string({ maxLength: MAX_WORKSPACE_DESCRIPTION_LENGTH })),
  color: schema.maybe(
    schema.string({
      validate: (color) => {
        if (!validateWorkspaceColor(color)) {
          return 'invalid workspace color format';
        }
      },
    })
  ),
  icon: schema.maybe(schema.string()),
  defaultVISTheme: schema.maybe(schema.string()),
  reserved: schema.maybe(schema.boolean()),
};

const workspaceNameSchema = schema.string({
  maxLength: MAX_WORKSPACE_NAME_LENGTH,
  validate(value) {
    if (!value || value.trim().length === 0) {
      return "can't be empty or blank.";
    }
  },
});

const createWorkspaceAttributesSchema = schema.object({
  name: workspaceNameSchema,
  features: featuresSchema,
  ...workspaceOptionalAttributesSchema,
});

const updateWorkspaceAttributesSchema = schema.object({
  name: schema.maybe(workspaceNameSchema),
  features: schema.maybe(featuresSchema),
  ...workspaceOptionalAttributesSchema,
});

export function registerRoutes({
  client,
  logger,
  router,
  maxImportExportSize,
  permissionControlClient,
  isPermissionControlEnabled,
  isDataSourceEnabled,
  workspaceConfig,
}: {
  client: IWorkspaceClientImpl;
  logger: Logger;
  router: IRouter;
  maxImportExportSize: number;
  permissionControlClient?: SavedObjectsPermissionControlContract;
  isPermissionControlEnabled: boolean;
  isDataSourceEnabled: boolean;
  workspaceConfig: ConfigSchema;
}) {
  router.post(
    {
      path: `${WORKSPACES_API_BASE_URL}/_list`,
      validate: {
        body: schema.object({
          search: schema.maybe(schema.string()),
          sortOrder: schema.maybe(schema.string()),
          perPage: schema.number({ min: 0, defaultValue: 20 }),
          page: schema.number({ min: 0, defaultValue: 1 }),
          sortField: schema.maybe(schema.string()),
          searchFields: schema.maybe(schema.arrayOf(schema.string())),
          permissionModes: schema.maybe(schema.arrayOf(workspacePermissionMode)),
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const result = await client.list(
        {
          request: req,
        },
        req.body
      );
      if (!result.success) {
        return res.ok({ body: result });
      }
      let { workspaces } = result.result;

      // Check if default workspace exists, if not create it
      let hasDefaultWorkspace = true;
      if (workspaceConfig.single_default_workspace) {
        // do the actual check
        hasDefaultWorkspace = workspaces.some((workspace) => workspace.id === DEFAULT_WORKSPACE_ID);
      } else {
        // remove default workspace if it exists
        workspaces = workspaces.filter((workspace) => workspace.id !== DEFAULT_WORKSPACE_ID);
      }

      if (!hasDefaultWorkspace) {
        logger.info('Default workspace not found, creating it automatically');

        // Create open permissions (everyone can read and write)
        const openPermissions = isPermissionControlEnabled
          ? {
              [WorkspacePermissionMode.LibraryRead]: {
                users: ['*'],
                groups: ['*'],
              },
              [WorkspacePermissionMode.LibraryWrite]: {
                users: ['*'],
                groups: ['*'],
              },
            }
          : undefined;

        const defaultWorkspacePayload: Omit<WorkspaceAttributeWithPermission, 'id'> = {
          name: 'Pulsar',
          description: 'Default workspace for Pulsar',
          features: [getUseCaseFeatureConfig(DEFAULT_NAV_GROUPS.all.id)],
          permissions: openPermissions,
          reserved: true,
        };

        try {
          const createResult = await client.create(
            {
              request: req,
            },
            defaultWorkspacePayload
          );

          if (createResult.success) {
            logger.info(
              `Default workspace created successfully with ID: ${createResult.result.id}`
            );

            // Refresh the workspace list to include the newly created default workspace
            const refreshedResult = await client.list(
              {
                request: req,
              },
              req.body
            );

            if (refreshedResult.success) {
              workspaces = refreshedResult.result.workspaces;
            }
          } else {
            logger.error(
              `Failed to create default workspace: ${
                createResult.success === false ? createResult.error : 'Unknown error'
              }`
            );
          }
        } catch (error) {
          logger.error(`Error creating default workspace: ${error}`);
        }
      }

      // enrich workspace permissionMode
      const principals = permissionControlClient?.getPrincipalsFromRequest(req);
      workspaces.forEach((workspace) => {
        const permissionMode = translatePermissionsToRole(
          isPermissionControlEnabled,
          workspace.permissions,
          principals
        );
        workspace.permissionMode = permissionMode;
      });

      return res.ok({
        body: result.success ? { ...result, result: { ...result.result, workspaces } } : result,
      });
    })
  );
  router.get(
    {
      path: `${WORKSPACES_API_BASE_URL}/{id}`,
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const { id } = req.params;
      const result = await client.get(
        {
          request: req,
        },
        id
      );

      return res.ok({
        body: result,
      });
    })
  );
  router.post(
    {
      path: `${WORKSPACES_API_BASE_URL}`,
      validate: {
        body: schema.object({
          attributes: createWorkspaceAttributesSchema,
          settings: settingsSchema,
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const { attributes, settings } = req.body;
      const principals = permissionControlClient?.getPrincipalsFromRequest(req);
      const createPayload: Omit<WorkspaceAttributeWithPermission, 'id'> & {
        dataSources?: string[];
        dataConnections?: string[];
      } = attributes;

      if (isPermissionControlEnabled) {
        createPayload.permissions = settings.permissions;
        if (!!principals?.users?.length) {
          const currentUserId = principals.users[0];
          const acl = new ACL(
            transferCurrentUserInPermissions(currentUserId, settings.permissions)
          );
          createPayload.permissions = acl.getPermissions();
        }
      }

      createPayload.dataSources = settings.dataSources;
      createPayload.dataConnections = settings.dataConnections;

      const result = await client.create(
        {
          request: req,
        },
        createPayload
      );
      return res.ok({ body: result });
    })
  );
  router.put(
    {
      path: `${WORKSPACES_API_BASE_URL}/{id?}`,
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
        body: schema.object({
          attributes: updateWorkspaceAttributesSchema,
          settings: settingsSchema,
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const { id } = req.params;
      const { attributes, settings } = req.body;

      const result = await client.update(
        {
          request: req,
        },
        id,
        {
          ...attributes,
          ...(isPermissionControlEnabled ? { permissions: settings.permissions } : {}),
          ...{ dataSources: settings.dataSources },
          ...{ dataConnections: settings.dataConnections },
        }
      );
      return res.ok({ body: result });
    })
  );
  router.delete(
    {
      path: `${WORKSPACES_API_BASE_URL}/{id?}`,
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const { id } = req.params;

      const result = await client.delete(
        {
          request: req,
        },
        id
      );
      return res.ok({ body: result });
    })
  );

  router.post(
    {
      path: `${WORKSPACES_API_BASE_URL}/_associate`,
      validate: {
        body: schema.object({
          workspaceId: schema.string(),
          savedObjects: schema.arrayOf(
            schema.object({ id: schema.string(), type: schema.string() })
          ),
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const { workspaceId, savedObjects } = req.body;

      const result = await client.associate(
        {
          request: req,
        },
        workspaceId,
        savedObjects
      );
      return res.ok({ body: result });
    })
  );

  router.post(
    {
      path: `${WORKSPACES_API_BASE_URL}/_dissociate`,
      validate: {
        body: schema.object({
          workspaceId: schema.string(),
          savedObjects: schema.arrayOf(
            schema.object({ id: schema.string(), type: schema.string() })
          ),
        }),
      },
    },
    router.handleLegacyErrors(async (context, req, res) => {
      const { workspaceId, savedObjects } = req.body;

      const result = await client.dissociate(
        {
          request: req,
        },
        workspaceId,
        savedObjects
      );
      return res.ok({ body: result });
    })
  );

  // duplicate saved objects among workspaces
  registerDuplicateRoute(router, logger, client, maxImportExportSize, isDataSourceEnabled);
}
