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

/* eslint-disable-next-line @osd/eslint/module_migration */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as xJson from './xjson';
import * as opensearchql from './opensearchql';
import * as painless from './painless';
import * as opensearchsql from './opensearchsql';

export const registerLexerRules = (m: typeof monaco) => {
  m.languages.register({ id: xJson.ID });
  m.languages.setMonarchTokensProvider(xJson.ID, xJson.lexerRules);
  m.languages.register({ id: painless.ID });
  m.languages.setMonarchTokensProvider(painless.ID, painless.lexerRules);
  m.languages.register({ id: opensearchql.ID });
  m.languages.setMonarchTokensProvider(opensearchql.ID, opensearchql.lexerRules);
  m.languages.register({ id: opensearchsql.ID });
  m.languages.setMonarchTokensProvider(opensearchsql.ID, opensearchsql.lexerRules);
  m.languages.register({ id: 'kuery' });
};
